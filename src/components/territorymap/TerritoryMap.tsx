'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Map from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { NBA_TEAM_COORDINATES } from './nba-team-coordinates'
import { TeamMarker } from './TeamMarker'
import { MapLegend } from './MapLegend'
import { MapFiltersPanel } from './MapFiltersPanel'
import { MapFilters, MapStats, TerritoryData } from './types'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import type { MapRef } from 'react-map-gl/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoiZ3I4bmFkZSIsImEiOiJjbWhpcjVuM2IxNTRkMmtwcTM0dHoyc2N4In0.xTuWFyLgmwGbuQKWLOGv4A'

export function TerritoryMap() {
  const mapRef = useRef<MapRef>(null)
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null)
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
  const [filters, setFilters] = useState<MapFilters>({
    timePeriod: 'all-time',
    capper: null,
    activePicksOnly: false
  })
  const [territoryData, setTerritoryData] = useState<TerritoryData[]>([])
  const [loading, setLoading] = useState(true)
  const [pickIdMap, setPickIdMap] = useState<Record<string, string>>({})

  // Apply medieval/fantasy map styling when map loads
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Wait for style to load
    if (!map.isStyleLoaded()) {
      map.once('styledata', () => handleMapLoad())
      return
    }

    // Get all layers
    const layers = map.getStyle().layers
    if (!layers) return

    // Apply medieval/vintage styling to layers
    layers.forEach((layer) => {
      const layerId = layer.id

      // Hide POI labels and icons to reduce clutter
      if (layerId.includes('poi-label') || layerId.includes('transit')) {
        map.setLayoutProperty(layerId, 'visibility', 'none')
      }

      // Hide country labels except US and Canada
      if (layerId.includes('country-label')) {
        map.setLayoutProperty(layerId, 'visibility', 'none')
      }

      // Reduce road visibility for cleaner look
      if (layerId.includes('road') && layer.type === 'line') {
        map.setPaintProperty(layerId, 'line-opacity', 0.2)
      }

      // Style water with vintage blue
      if (layerId.includes('water')) {
        if (layer.type === 'fill') {
          map.setPaintProperty(layerId, 'fill-color', '#B8D4E8')
          map.setPaintProperty(layerId, 'fill-opacity', 0.6)
        }
      }

      // Style land/background with parchment tone for US/Canada, gray for others
      if (layerId.includes('land') || layerId === 'background') {
        if (layer.type === 'background') {
          map.setPaintProperty(layerId, 'background-color', '#D0D0D0')
        } else if (layer.type === 'fill') {
          // Gray out all land by default
          map.setPaintProperty(layerId, 'fill-color', '#D0D0D0')
          map.setPaintProperty(layerId, 'fill-opacity', 0.4)
        }
      }

      // Enhance admin boundaries with medieval aesthetic
      if (layerId.includes('admin')) {
        if (layer.type === 'line') {
          // State boundaries (US/Canada provinces)
          if (layerId.includes('1')) {
            map.setPaintProperty(layerId, 'line-color', '#8B4513')
            map.setPaintProperty(layerId, 'line-width', 2)
            map.setPaintProperty(layerId, 'line-opacity', 0.7)
          }
          // Country boundaries - make more prominent
          if (layerId.includes('0')) {
            map.setPaintProperty(layerId, 'line-color', '#654321')
            map.setPaintProperty(layerId, 'line-width', 3)
            map.setPaintProperty(layerId, 'line-opacity', 0.9)
          }
        }
      }
    })

    // Add a custom layer to highlight US and Canada with parchment color
    if (!map.getSource('us-canada-highlight')) {
      map.addSource('us-canada-highlight', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-125, 24], // Southwest corner
                  [-125, 50], // Northwest corner
                  [-66, 50],  // Northeast corner
                  [-66, 24],  // Southeast corner
                  [-125, 24]  // Close polygon
                ]]
              }
            }
          ]
        }
      })

      map.addLayer({
        id: 'us-canada-highlight-layer',
        type: 'fill',
        source: 'us-canada-highlight',
        paint: {
          'fill-color': '#F4E8D0',
          'fill-opacity': 0.9
        }
      }, 'waterway-label') // Add before labels
    }
  }, [])

  // Fetch real territory data from API
  useEffect(() => {
    async function fetchTerritoryData() {
      try {
        console.log('[TerritoryMap] Fetching territory data...')
        const response = await fetch('/api/territory-map')
        console.log('[TerritoryMap] Response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('[TerritoryMap] Data received:', data)
          console.log('[TerritoryMap] Territories count:', data.territories?.length)
          console.log('[TerritoryMap] Claimed territories:', data.territories?.filter((t: any) => t.state === 'claimed').length)
          setTerritoryData(data.territories)
          setPickIdMap(data.pickIdMap || {})
        } else {
          console.error('[TerritoryMap] Failed to fetch:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('[TerritoryMap] Failed to fetch territory data:', error)
        // Fall back to mock data on error
      } finally {
        setLoading(false)
      }
    }
    fetchTerritoryData()
  }, [])

  // Filter territories based on current filters
  const filteredTerritories = useMemo(() => {
    console.log('[TerritoryMap] Filtering territories. Total:', territoryData.length)
    console.log('[TerritoryMap] Filters:', filters)

    let filtered = territoryData

    // Filter by capper
    if (filters.capper) {
      filtered = filtered.filter(t =>
        t.state === 'unclaimed' || t.capperUsername === filters.capper
      )
      console.log('[TerritoryMap] After capper filter:', filtered.length)
    }

    // Filter by active picks only
    if (filters.activePicksOnly) {
      filtered = filtered.filter(t => t.state === 'active')
      console.log('[TerritoryMap] After active picks filter:', filtered.length)
    }

    console.log('[TerritoryMap] Final filtered count:', filtered.length)
    console.log('[TerritoryMap] Claimed in filtered:', filtered.filter(t => t.state === 'claimed').length)

    return filtered
  }, [territoryData, filters])

  // Calculate stats
  const stats: MapStats = useMemo(() => {
    const claimed = filteredTerritories.filter(t => t.state === 'claimed').length
    const active = filteredTerritories.filter(t => t.state === 'active').length
    const unclaimed = filteredTerritories.filter(t => t.state === 'unclaimed').length

    return { claimed, active, unclaimed }
  }, [filteredTerritories])

  // Get territory data for a team
  const getTerritoryData = (teamAbbr: string): TerritoryData => {
    return filteredTerritories.find(t => t.teamAbbr === teamAbbr) || {
      teamAbbr,
      state: 'unclaimed'
    }
  }

  // Get hovered team details
  const hoveredTerritory = hoveredTeam ? getTerritoryData(hoveredTeam) : null
  const hoveredTeamInfo = hoveredTeam ? NBA_TEAM_COORDINATES.find(t => t.abbr === hoveredTeam) : null

  // Handle team click
  const handleTeamClick = (territory: TerritoryData) => {
    if (territory.state === 'unclaimed') {
      return // No action for unclaimed territories
    }

    // For active picks, show the insight modal if we have a pick ID
    if (territory.state === 'active' && territory.activePick?.gameId) {
      const pickId = pickIdMap[territory.teamAbbr]
      if (pickId) {
        setSelectedPickId(pickId)
      } else {
        alert(`Active Pick: ${territory.activePick?.prediction}\nConfidence: ${territory.activePick?.confidence}/10\nGame: ${territory.activePick?.opponent}`)
      }
    } else {
      // For claimed territories, show summary
      alert(`Territory: ${territory.teamAbbr}\nCapper: ${territory.capperUsername}\nUnits: +${territory.units}u\nRecord: ${territory.wins}-${territory.losses}-${territory.pushes}`)
    }
  }

  return (
    <div className="relative w-full h-screen bg-[#F4E8D0]">
      {/* Medieval parchment texture overlay */}
      <div className="medieval-map-overlay z-[1]" />

      {/* Title Overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-[#3E2723] text-[#D4AF37] px-6 py-3 rounded-lg shadow-lg border-2 border-[#D4AF37]">
        <h1 className="text-2xl font-bold tracking-wide">🏀 NBA TERRITORY MAP 🗺️</h1>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#F4E8D0]/90">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#D4AF37] border-t-transparent mx-auto mb-4"></div>
            <p className="text-[#3E2723] text-xl font-bold">Loading Territory Data...</p>
          </div>
        </div>
      )}

      {/* Map - Medieval/Fantasy gameboard style */}
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        initialViewState={{
          longitude: -98.5795,
          latitude: 39.8283,
          zoom: 4
        }}
        minZoom={3.5}
        maxZoom={6}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        logoPosition="bottom-right"
        onLoad={handleMapLoad}
      >
        {/* Render team markers */}
        {NBA_TEAM_COORDINATES.map((team) => {
          const territory = getTerritoryData(team.abbr)

          // Skip if filtering and this team doesn't match
          if (filters.activePicksOnly && territory.state !== 'active') {
            return null
          }

          return (
            <TeamMarker
              key={team.abbr}
              team={team}
              territory={territory}
              onClick={() => handleTeamClick(territory)}
              onHover={setHoveredTeam}
            />
          )
        })}
      </Map>

      {/* Filters Panel */}
      <MapFiltersPanel filters={filters} onFiltersChange={setFilters} territories={territoryData} />

      {/* Legend */}
      <MapLegend />

      {/* Stats Summary */}
      <div className="absolute bottom-4 left-4 bg-[#F4E8D0] border-2 border-[#3E2723] rounded-lg p-4 shadow-lg">
        <h3 className="text-sm font-bold text-[#3E2723] mb-2 border-b border-[#3E2723] pb-2">
          📊 Territory Stats
        </h3>
        <div className="space-y-1 text-xs mb-3">
          <div className="flex justify-between gap-4">
            <span className="text-gray-700">Claimed:</span>
            <span className="font-bold text-green-600">{stats.claimed}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-700">Active:</span>
            <span className="font-bold text-red-600">{stats.active}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-700">Unclaimed:</span>
            <span className="font-bold text-gray-500">{stats.unclaimed}</span>
          </div>
        </div>

        {/* Battle Bets Link */}
        <Link
          href="/battle-bets"
          className="block w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white text-center py-2 px-3 rounded-md text-xs font-bold transition-all duration-200 shadow-md hover:shadow-lg border border-red-800"
        >
          ⚔️ Active Battles
        </Link>
      </div>

      {/* Hover Tooltip */}
      {hoveredTerritory && hoveredTeamInfo && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white border-2 border-[#3E2723] rounded-lg p-3 shadow-lg z-20 min-w-[250px]">
          <div className="text-sm font-bold text-[#3E2723] mb-2">
            {hoveredTeamInfo.name}
          </div>
          {hoveredTerritory.state === 'unclaimed' ? (
            <div className="text-xs text-gray-600 italic">Territory unclaimed</div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-700">Capper:</span>
                <span className="font-semibold">{hoveredTerritory.capperUsername}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Units:</span>
                <span className="font-bold text-green-600">+{hoveredTerritory.units?.toFixed(1)}u</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Record:</span>
                <span className="font-semibold">{hoveredTerritory.wins}-{hoveredTerritory.losses}-{hoveredTerritory.pushes}</span>
              </div>
              {hoveredTerritory.activePick && (
                <>
                  <div className="border-t border-gray-300 my-2"></div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Pick:</span>
                    <span className="font-bold text-blue-600">{hoveredTerritory.activePick.prediction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Confidence:</span>
                    <span className="font-semibold">{hoveredTerritory.activePick.confidence}/10</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pick Insight Modal */}
      {selectedPickId && (
        <PickInsightModal
          pickId={selectedPickId}
          onClose={() => setSelectedPickId(null)}
        />
      )}
    </div>
  )
}

