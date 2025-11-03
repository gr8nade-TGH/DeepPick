'use client'

import { Marker } from 'react-map-gl'
import { TerritoryData, TerritoryTier } from './types'
import { NBATeamCoordinate } from './nba-team-coordinates'

interface TeamMarkerProps {
  team: NBATeamCoordinate
  territory: TerritoryData
  onClick: () => void
  onHover: (team: string | null) => void
}

const getTierBorderWidth = (tier?: TerritoryTier): number => {
  if (!tier) return 2
  switch (tier) {
    case 'dominant': return 4
    case 'strong': return 3
    case 'weak': return 2
    default: return 2
  }
}

export function TeamMarker({ team, territory, onClick, onHover }: TeamMarkerProps) {
  const isUnclaimed = territory.state === 'unclaimed'
  const isActive = territory.state === 'active'
  const borderWidth = getTierBorderWidth(territory.tier)

  return (
    <Marker
      longitude={team.longitude}
      latitude={team.latitude}
      anchor="center"
    >
      <div
        className="relative cursor-pointer transition-transform hover:scale-110"
        onClick={onClick}
        onMouseEnter={() => onHover(team.abbr)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Territory Marker */}
        <div
          className={`
            relative
            w-16 h-16
            rounded-full
            flex items-center justify-center
            transition-all duration-300
            ${isUnclaimed ? 'bg-gray-300 border-dashed' : 'bg-white'}
            ${isActive ? 'animate-pulse-glow' : ''}
          `}
          style={{
            borderWidth: `${borderWidth}px`,
            borderColor: isUnclaimed ? '#9CA3AF' : isActive ? '#D4AF37' : '#3E2723',
            borderStyle: isUnclaimed ? 'dashed' : 'solid',
          }}
        >
          {/* Team Abbreviation */}
          <span
            className={`
              text-sm font-bold
              ${isUnclaimed ? 'text-gray-500' : 'text-gray-900'}
            `}
          >
            {team.abbr}
          </span>

          {/* Crown Icon for Dominant Territories */}
          {territory.tier === 'dominant' && !isUnclaimed && (
            <div className="absolute -top-2 -right-2 text-xl">
              👑
            </div>
          )}

          {/* LIVE Badge for Active Picks */}
          {isActive && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                LIVE
              </span>
            </div>
          )}
        </div>

        {/* Capper Info (for claimed/active territories) */}
        {!isUnclaimed && territory.capperUsername && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-center">
            <div className="text-xs font-semibold text-gray-900">
              {territory.capperUsername}
            </div>
            <div className="text-xs text-green-600 font-bold">
              +{territory.units?.toFixed(1)}u
            </div>
          </div>
        )}

        {/* Unclaimed Label */}
        {isUnclaimed && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs text-gray-500 italic">Unclaimed</span>
          </div>
        )}
      </div>
    </Marker>
  )
}

