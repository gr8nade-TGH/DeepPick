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
        className="relative cursor-pointer transition-all duration-300 hover:scale-125 hover:z-50"
        onClick={onClick}
        onMouseEnter={() => onHover(team.abbr)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Territory Marker - ENHANCED */}
        <div
          className={`
            relative
            w-24 h-24
            rounded-full
            flex items-center justify-center
            transition-all duration-300
            ${isUnclaimed
              ? 'bg-gradient-to-br from-slate-400 to-slate-500 border-dashed'
              : 'bg-gradient-to-br from-white to-slate-50 shadow-2xl'
            }
            ${isActive ? 'animate-pulse-glow ring-4 ring-amber-400/50' : ''}
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
              className="absolute inset-1 rounded-full opacity-20"
              style={{
                background: `linear-gradient(135deg, ${teamColors.primary}, ${teamColors.secondary})`
              }}
            ></div>
          )}

          {/* Team Logo */}
          {!isUnclaimed ? (
            <div className="relative w-16 h-16 z-10">
              <Image
                src={`/nba_territory_logos/${team.abbr}.png`}
                alt={team.abbr}
                fill
                className="object-contain p-1 drop-shadow-md"
              />
            </div>
          ) : (
            <span className="text-base font-bold text-slate-700 z-10">
              {team.abbr}
            </span>
          )}

          {/* Crown Icon for Dominant Territories - ENHANCED */}
          {territory.tier === 'dominant' && !isUnclaimed && (
            <div className="absolute -top-3 -right-3 text-2xl animate-bounce-slow drop-shadow-lg">
              👑
            </div>
          )}

          {/* Shield Icon for Strong Territories */}
          {territory.tier === 'strong' && !isUnclaimed && (
            <div className="absolute -top-2 -right-2 text-lg drop-shadow-md">
              🛡️
            </div>
          )}

          {/* LIVE Badge and Crossed Swords for Active Picks */}
          {isActive && (
            <>
              {/* Crossed Swords Animation - Above LIVE badge */}
              <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 flex items-center justify-center">
                <div className="relative w-8 h-8">
                  {/* Left Sword */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 animate-sword-clash">
                    <span className="text-lg">⚔️</span>
                  </div>
                  {/* Right Sword */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 animate-sword-clash-reverse">
                    <span className="text-lg">⚔️</span>
                  </div>
                </div>
              </div>

              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                  LIVE
                </span>
              </div>
            </>
          )}
        </div>

        {/* Capper Info (for claimed/active territories) - REDESIGNED */}
        {!isUnclaimed && territory.capperUsername && (
          <div className="absolute -bottom-14 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            {/* Capper Badge */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-3 py-1.5 rounded-lg shadow-lg border-2 border-amber-500/50">
              {/* Capper Name */}
              <div className="text-xs font-bold text-amber-400 tracking-wide mb-0.5">
                {territory.capperUsername}
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-center gap-2 text-[10px]">
                {/* Net Units */}
                <div className="flex items-center gap-0.5">
                  <span className="text-emerald-400 font-bold">
                    +{territory.units?.toFixed(1)}u
                  </span>
                </div>

                {/* Separator */}
                <span className="text-slate-600">•</span>

                {/* W-L Record */}
                <div className="text-slate-300 font-medium">
                  {territory.wins}-{territory.losses}
                  {territory.pushes ? `-${territory.pushes}` : ''}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unclaimed Label - REDESIGNED */}
        {isUnclaimed && (
          <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <div className="bg-slate-700/80 px-2.5 py-1 rounded-md border border-slate-600">
              <span className="text-[10px] text-slate-300 font-semibold tracking-wide">UNCLAIMED</span>
            </div>
          </div>
        )}
      </div>
    </Marker>
  )
}

