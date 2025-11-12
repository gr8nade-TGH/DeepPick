'use client'

import { Marker } from 'react-map-gl/mapbox'
import { TerritoryData, TerritoryTier } from './types'
import { NBATeamCoordinate } from './nba-team-coordinates'
import { NBA_TEAM_COLORS } from './nba-team-colors'
import Image from 'next/image'

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

  // Get team colors
  const teamColors = NBA_TEAM_COLORS[team.abbr] || { primary: '#3E2723', secondary: '#8B4513' }

  // Get tier-based styling
  const getTierGlow = () => {
    if (isUnclaimed) return ''
    if (isActive) return 'shadow-[0_0_20px_rgba(212,175,55,0.6)]'

    switch (territory.tier) {
      case 'dominant':
        return 'shadow-[0_0_15px_rgba(255,215,0,0.5)]'
      case 'strong':
        return 'shadow-[0_0_10px_rgba(212,175,55,0.4)]'
      case 'weak':
        return 'shadow-[0_0_5px_rgba(139,69,19,0.3)]'
      default:
        return ''
    }
  }

  // Get border color based on state and tier
  const getBorderColor = () => {
    if (isUnclaimed) return '#94A3B8'
    if (isActive) return '#F59E0B'

    // Use team primary color for claimed territories
    return teamColors.primary
  }

  return (
    <Marker
      longitude={team.longitude}
      latitude={team.latitude}
      anchor="center"
    >
      <div
        className="relative cursor-pointer transition-all duration-200 hover:scale-110 hover:z-50"
        onClick={onClick}
        onMouseEnter={() => onHover(team.abbr)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Territory Marker - COMPACT BADGE DESIGN */}
        <div
          className={`
            relative
            w-14 h-14
            rounded-full
            flex items-center justify-center
            transition-all duration-200
            ${isUnclaimed
              ? 'bg-gradient-to-br from-slate-400 to-slate-500 border-dashed'
              : 'bg-gradient-to-br from-white to-slate-100 shadow-lg'
            }
            ${isActive ? 'ring-2 ring-amber-400/70' : ''}
            ${getTierGlow()}
          `}
          style={{
            borderWidth: `${borderWidth}px`,
            borderColor: getBorderColor(),
            borderStyle: isUnclaimed ? 'dashed' : 'solid',
          }}
        >
          {/* Inner ring for claimed territories with team color accent */}
          {!isUnclaimed && (
            <div
              className="absolute inset-1 rounded-full opacity-15"
              style={{
                background: `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`
              }}
            ></div>
          )}

          {/* Team Acronym - Always visible */}
          <span
            className={`text-sm font-black z-10 tracking-tight ${isUnclaimed ? 'text-slate-700' : 'text-gray-900'
              }`}
            style={{
              textShadow: isUnclaimed ? 'none' : '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            {team.abbr}
          </span>

          {/* Crown Icon for Dominant Territories */}
          {territory.tier === 'dominant' && !isUnclaimed && (
            <div className="absolute -top-2 -right-2 text-lg animate-bounce-slow drop-shadow-lg">
              👑
            </div>
          )}

          {/* Shield Icon for Strong Territories */}
          {territory.tier === 'strong' && !isUnclaimed && (
            <div className="absolute -top-1.5 -right-1.5 text-sm drop-shadow-md">
              🛡️
            </div>
          )}

          {/* LIVE Badge - Only show if game is actually in progress */}
          {isActive && territory.gameTime && territory.gameStatus && (
            (() => {
              const now = new Date()
              const gameStart = new Date(territory.gameTime)
              const isGameStarted = now >= gameStart
              const isInProgress = territory.gameStatus === 'in_progress' ||
                territory.gameStatus === 'live' ||
                territory.gameStatus === 'in progress'

              // Only show LIVE if game has started AND status indicates in progress
              const shouldShowLive = isGameStarted && isInProgress

              return shouldShowLive ? (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full animate-pulse shadow-lg">
                    LIVE
                  </span>
                </div>
              ) : null
            })()
          )}
        </div>

        {/* Capper Info (for claimed/active territories) - COMPACT */}
        {!isUnclaimed && territory.capperUsername && (
          <div className="absolute -bottom-9 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            {/* Capper Badge - COMPACT: Only name, rank, eye icon, and game time */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-2 py-1 rounded-md shadow-lg border border-amber-500/50 relative">
              {/* Capper Name with Rank Badge and View Icon */}
              <div className="text-[10px] font-bold text-amber-400 tracking-wide flex items-center gap-1 justify-center">
                {/* Rank Badge */}
                {territory.capperRank && (
                  <span
                    className={`text-[8px] font-black px-1 rounded ${territory.capperRank === 1 ? 'bg-yellow-500 text-black' :
                      territory.capperRank === 2 ? 'bg-slate-400 text-black' :
                        territory.capperRank === 3 ? 'bg-amber-700 text-white' :
                          'bg-slate-600 text-white'
                      }`}
                    title={`Rank #${territory.capperRank} for ${territory.teamAbbr}`}
                  >
                    #{territory.capperRank}
                  </span>
                )}
                <span>{territory.capperUsername}</span>
                {isActive && (
                  <span
                    className="text-[10px] text-blue-400 cursor-pointer hover:text-blue-300 animate-pulse"
                    title="Click to view pick"
                  >
                    👁️
                  </span>
                )}
              </div>

              {/* Game Time for Active Picks - ONLY show for active picks */}
              {isActive && territory.gameTime && (
                <div className="text-[8px] text-blue-300 text-center mt-0.5 font-semibold">
                  {new Date(territory.gameTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unclaimed Label - COMPACT */}
        {isUnclaimed && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <div className="bg-slate-700/80 px-2 py-0.5 rounded-md border border-slate-600">
              <span className="text-[9px] text-slate-300 font-semibold tracking-wide">UNCLAIMED</span>
            </div>
          </div>
        )}
      </div>
    </Marker>
  )
}

