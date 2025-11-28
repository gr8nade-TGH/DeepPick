'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Map, { Source, Layer } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { NBA_TEAM_COORDINATES } from './nba-team-coordinates'
import { TeamMarker } from './TeamMarker'
import { MapLegend } from './MapLegend'
import { MapFiltersPanel } from './MapFiltersPanel'
import { MatchupSwords } from './MatchupSwords'
import { MapFilters, MapStats, TerritoryData, ActiveMatchup } from './types'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { useAuth } from '@/contexts/auth-context'
import type { MapRef } from 'react-map-gl/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoiZ3I4bmFkZSIsImEiOiJjbWhpcjVuM2IxNTRkMmtwcTM0dHoyc2N4In0.xTuWFyLgmwGbuQKWLOGv4A'

export function TerritoryMap() {
  const router = useRouter()
  const { user } = useAuth()
  const mapRef = useRef<MapRef>(null)
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null)
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
  const [showLoginMessage, setShowLoginMessage] = useState(false)
  const [filters, setFilters] = useState<MapFilters>({
    timePeriod: 'all-time',
    capper: null,
    activePicksOnly: false
  })
  const [territoryData, setTerritoryData] = useState<TerritoryData[]>([])
  const [loading, setLoading] = useState(true)
  const [pickIdMap, setPickIdMap] = useState<Record<string, string>>({})
  const [activeMatchups, setActiveMatchups] = useState<ActiveMatchup[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

      // Hide ALL place labels except state labels
      if (layerId.includes('place-label')) {
        // Only show state labels
        if (layerId.includes('state')) {
          // Keep state labels visible
        } else {
          // Hide everything else (cities, towns, etc.)
          map.setLayoutProperty(layerId, 'visibility', 'none')
        }
      }

      // Hide settlement labels (cities, towns, neighborhoods)
      if (layerId.includes('settlement') || layerId.includes('subdivision')) {
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

      // Style land with parchment tone - use Mapbox's built-in land layer
      if (layerId.includes('land') || layerId === 'background') {
        if (layer.type === 'background') {
          map.setPaintProperty(layerId, 'background-color', '#F4E8D0')
        } else if (layer.type === 'fill') {
          map.setPaintProperty(layerId, 'fill-color', '#F4E8D0')
          map.setPaintProperty(layerId, 'fill-opacity', 0.9)
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

    // Add country boundaries source for Mexico/Canada overlay
    if (!map.getSource('country-boundaries')) {
      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      })
    }

    // Add gray overlay for Mexico and Canada to de-emphasize them
    // This keeps focus on the United States where all NBA teams are located
    if (!map.getLayer('mexico-canada-overlay')) {
      // Worldview filter for US perspective (avoids disputed border overlaps)
      const worldviewFilter = [
        'all',
        ['==', ['get', 'disputed'], 'false'],
        [
          'any',
          ['==', 'all', ['get', 'worldview']],
          ['in', 'US', ['get', 'worldview']]
        ],
        // Filter to only show Mexico (MX) and Canada (CA)
        ['in', ['get', 'iso_3166_1'], ['literal', ['MX', 'CA']]]
      ]

      map.addLayer({
        id: 'mexico-canada-overlay',
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': '#2a2a2a', // Dark gray overlay
          'fill-opacity': 0.5 // Semi-transparent to maintain subtle effect
        },
        filter: worldviewFilter
      })
    }
  }, [])

  // Fetch territory data from API
  const fetchTerritoryData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    }

    try {
      const response = await fetch('/api/territory-map')

      if (response.ok) {
        const data = await response.json()
        setTerritoryData(data.territories)
        setPickIdMap(data.pickIdMap || {})
        setActiveMatchups(data.activeMatchups || [])
        setLastUpdated(new Date())

        // Debug logging for matchup lines
        console.log('[TerritoryMap] Active matchups:', data.activeMatchups?.length || 0, data.activeMatchups)
      } else {
        console.error('[TerritoryMap] Failed to fetch:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('[TerritoryMap] Failed to fetch territory data:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchTerritoryData()
  }, [fetchTerritoryData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[TerritoryMap] Auto-refreshing data...')
      fetchTerritoryData()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [fetchTerritoryData])

  // Filter territories based on current filters
  const filteredTerritories = useMemo(() => {
    let filtered = territoryData

    // Filter by capper
    if (filters.capper) {
      filtered = filtered.filter(t =>
        t.state === 'unclaimed' || t.capperUsername === filters.capper
      )
    }

    // Filter by active picks only
    if (filters.activePicksOnly) {
      filtered = filtered.filter(t => t.state === 'active')
    }

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

    // For active picks, check authentication and show insight modal
    if (territory.state === 'active') {
      // Check if user is logged in
      if (!user) {
        setShowLoginMessage(true)
        return
      }

      // Get the pick ID for this territory
      const pickId = pickIdMap[territory.teamAbbr]
      if (pickId) {
        setSelectedPickId(pickId)
      } else {
        alert(`No active pick available for ${territory.teamAbbr}`)
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

      {/* Title Overlay with Refresh */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-[#3E2723] text-[#D4AF37] px-6 py-3 rounded-lg shadow-lg border-2 border-[#D4AF37]">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-wide">🏀 NBA TERRITORY MAP 🗺️</h1>

          {/* Refresh Button */}
          <button
            onClick={() => fetchTerritoryData(true)}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white text-sm font-semibold rounded transition-colors flex items-center gap-1.5"
            title="Refresh territory data"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="text-xs text-amber-300 font-medium">
              Updated: {lastUpdated.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </div>
          )}
        </div>
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
        maxBounds={[
          [-130, 20],  // Southwest corner [longitude, latitude]
          [-60, 55]    // Northeast corner [longitude, latitude]
        ]}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        logoPosition="bottom-right"
        onLoad={handleMapLoad}
      >
        {/* Matchup Lines - Active Battles - ENHANCED VISIBILITY */}
        {activeMatchups.length > 0 && (
          <>
            {/* Glow layer for live games */}
            <Source
              id="matchup-lines-glow"
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: activeMatchups
                  .filter(m => m.status === 'in_progress' || m.status === 'live' || m.status === 'inprogress')
                  .map(matchup => {
                    const homeCoords = NBA_TEAM_COORDINATES.find(t => t.abbr === matchup.homeTeam)
                    const awayCoords = NBA_TEAM_COORDINATES.find(t => t.abbr === matchup.awayTeam)

                    if (!homeCoords || !awayCoords) return null

                    return {
                      type: 'Feature',
                      properties: {
                        gameId: matchup.gameId,
                        status: matchup.status
                      },
                      geometry: {
                        type: 'LineString',
                        coordinates: [
                          [awayCoords.longitude, awayCoords.latitude],
                          [homeCoords.longitude, homeCoords.latitude]
                        ]
                      }
                    }
                  }).filter(Boolean) as any[]
              }}
            >
              <Layer
                id="matchup-lines-glow-layer"
                type="line"
                paint={{
                  'line-color': '#FFD700', // Bright gold glow
                  'line-width': 8,
                  'line-opacity': 0.4,
                  'line-blur': 4
                }}
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round'
                }}
              />
            </Source>

            {/* Main matchup lines */}
            <Source
              id="matchup-lines"
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: activeMatchups.map(matchup => {
                  const homeCoords = NBA_TEAM_COORDINATES.find(t => t.abbr === matchup.homeTeam)
                  const awayCoords = NBA_TEAM_COORDINATES.find(t => t.abbr === matchup.awayTeam)

                  if (!homeCoords || !awayCoords) return null

                  const isLive = matchup.status === 'in_progress' || matchup.status === 'live' || matchup.status === 'inprogress'

                  return {
                    type: 'Feature',
                    properties: {
                      gameId: matchup.gameId,
                      status: matchup.status,
                      isLive
                    },
                    geometry: {
                      type: 'LineString',
                      coordinates: [
                        [awayCoords.longitude, awayCoords.latitude],
                        [homeCoords.longitude, homeCoords.latitude]
                      ]
                    }
                  }
                }).filter(Boolean) as any[]
              }}
            >
              <Layer
                id="matchup-lines-layer"
                type="line"
                paint={{
                  'line-color': [
                    'case',
                    ['get', 'isLive'],
                    '#FFD700', // Bright gold for live games
                    '#FFA500'  // Orange for scheduled games
                  ],
                  'line-width': 4,
                  'line-opacity': 0.9,
                  'line-dasharray': [4, 4] // Dashed line for "active battle" effect
                }}
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round'
                }}
              />
            </Source>
          </>
        )}

        {/* Sword clash markers at midpoint of each matchup */}
        {activeMatchups.map(matchup => {
          const homeCoords = NBA_TEAM_COORDINATES.find(t => t.abbr === matchup.homeTeam)
          const awayCoords = NBA_TEAM_COORDINATES.find(t => t.abbr === matchup.awayTeam)

          if (!homeCoords || !awayCoords) return null

          // Calculate midpoint
          const midLat = (homeCoords.latitude + awayCoords.latitude) / 2
          const midLng = (homeCoords.longitude + awayCoords.longitude) / 2

          return (
            <MatchupSwords
              key={matchup.gameId}
              latitude={midLat}
              longitude={midLng}
              gameId={matchup.gameId}
              status={matchup.status}
              homeTeam={matchup.homeTeam}
              awayTeam={matchup.awayTeam}
              onClick={() => {
                // TODO: Navigate to active battle view
                console.log('[TerritoryMap] Clicked matchup:', matchup)
              }}
            />
          )
        })}

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

      {/* Stats Summary - ENHANCED WITH SCROLLING */}
      <div className="absolute bottom-20 left-4 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500 rounded-lg p-4 shadow-2xl max-h-[calc(100vh-24rem)] overflow-y-auto">
        <h3 className="text-sm font-bold text-amber-400 mb-3 border-b border-amber-500/30 pb-2 flex items-center gap-2">
          <span>📊</span>
          <span>Territory Stats</span>
        </h3>
        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between gap-6 items-center">
            <span className="text-slate-400">Claimed:</span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-emerald-400 text-base">{stats.claimed}</span>
              <span className="text-xs text-slate-500">/ 30</span>
            </div>
          </div>
          <div className="flex justify-between gap-6 items-center">
            <span className="text-slate-400">Active:</span>
            <div className="flex items-center gap-1">
              <span className="font-bold text-red-400 text-base">{stats.active}</span>
              {stats.active > 0 && <span className="text-xs animate-pulse">🔴</span>}
            </div>
          </div>
          <div className="flex justify-between gap-6 items-center">
            <span className="text-slate-400">Unclaimed:</span>
            <span className="font-bold text-slate-500 text-base">{stats.unclaimed}</span>
          </div>
        </div>

        {/* Battle Arena Link - Links to Battle Arena V2 */}
        <Link
          href="/battle-arena-v2/index.html"
          className="block w-full bg-gradient-to-r from-red-600 via-orange-600 to-red-600 hover:from-red-700 hover:via-orange-700 hover:to-red-700 text-white text-center py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-red-800 hover:scale-105"
        >
          <span className="flex items-center justify-center gap-2">
            <span>⚔️</span>
            <span>Active Battles</span>
          </span>
        </Link>
      </div>

      {/* Hover Tooltip - ENHANCED */}
      {hoveredTerritory && hoveredTeamInfo && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500 rounded-lg p-4 shadow-2xl z-20 min-w-[280px]">
          {/* Team Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-500/30">
            <div className="text-base font-bold text-amber-400">
              {hoveredTeamInfo.name}
            </div>
            {hoveredTerritory.tier === 'dominant' && <span className="text-lg">👑</span>}
            {hoveredTerritory.tier === 'strong' && <span className="text-base">🛡️</span>}
          </div>

          {hoveredTerritory.state === 'unclaimed' ? (
            <div className="text-sm text-slate-400 italic flex items-center gap-2">
              <span>⚔️</span>
              <span>Territory unclaimed - No capper has positive units</span>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {/* Current Display Capper */}
              <div className="bg-slate-800/50 p-2 rounded border border-amber-500/30">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400">Current Owner:</span>
                  <div className="flex items-center gap-1">
                    {hoveredTerritory.capperRank && (
                      <span
                        className={`text-[8px] font-black px-1 rounded ${hoveredTerritory.capperRank === 1 ? 'bg-yellow-500 text-black' :
                          hoveredTerritory.capperRank === 2 ? 'bg-slate-400 text-black' :
                            hoveredTerritory.capperRank === 3 ? 'bg-amber-700 text-white' :
                              'bg-slate-600 text-white'
                          }`}
                      >
                        #{hoveredTerritory.capperRank}
                      </span>
                    )}
                    <span className="font-bold text-amber-400">{hoveredTerritory.capperUsername}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Units:</span>
                  <span className="font-bold text-emerald-400">+{hoveredTerritory.units?.toFixed(1)}u</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Record:</span>
                  <span className="font-semibold text-slate-200">
                    {hoveredTerritory.wins}W - {hoveredTerritory.losses}L
                    {hoveredTerritory.pushes ? ` - ${hoveredTerritory.pushes}P` : ''}
                  </span>
                </div>
              </div>

              {/* Leaderboard - Top 3 */}
              {hoveredTerritory.leaderboard && hoveredTerritory.leaderboard.length > 1 && (
                <div>
                  <div className="text-xs text-slate-400 mb-1.5 font-semibold">Top Performers:</div>
                  <div className="space-y-1">
                    {hoveredTerritory.leaderboard.map((capper) => (
                      <div
                        key={capper.capperId}
                        className={`flex items-center justify-between text-xs p-1.5 rounded ${capper.hasActivePick ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-slate-800/30'
                          }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[8px] font-black px-1 rounded ${capper.rank === 1 ? 'bg-yellow-500 text-black' :
                              capper.rank === 2 ? 'bg-slate-400 text-black' :
                                capper.rank === 3 ? 'bg-amber-700 text-white' :
                                  'bg-slate-600 text-white'
                              }`}
                          >
                            #{capper.rank}
                          </span>
                          <span className="text-slate-200 font-medium">{capper.capperName}</span>
                          {capper.hasActivePick && (
                            <span className="text-[8px] text-blue-400 animate-pulse">👁️</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold">+{capper.netUnits.toFixed(1)}u</span>
                          <span className="text-slate-400">{capper.wins}-{capper.losses}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Win Rate */}
              {hoveredTerritory.wins !== undefined && hoveredTerritory.losses !== undefined && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                  <span className="text-slate-400">Win Rate:</span>
                  <span className="font-semibold text-blue-400">
                    {((hoveredTerritory.wins / (hoveredTerritory.wins + hoveredTerritory.losses)) * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Active Pick Info */}
              {hoveredTerritory.activePick && (
                <>
                  <div className="border-t border-amber-500/30 my-2 pt-2">
                    <div className="text-xs text-amber-400 font-semibold mb-1 flex items-center gap-1">
                      <span className="animate-pulse">🔴</span>
                      <span>ACTIVE PICK</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pick:</span>
                    <span className="font-bold text-blue-400">{hoveredTerritory.activePick.prediction}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Confidence:</span>
                    <span className="font-semibold text-purple-400">{hoveredTerritory.activePick.confidence}/10</span>
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

      {/* Login Required Message */}
      {showLoginMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500 rounded-lg p-8 shadow-2xl max-w-md mx-4">
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-amber-400 mb-3">Login Required</h3>
              <p className="text-slate-300 mb-6">
                You must be logged in to view pick details and insight cards.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push('/login')}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-bold rounded-lg transition-all duration-200 shadow-lg"
                >
                  Login
                </button>
                <button
                  onClick={() => setShowLoginMessage(false)}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

