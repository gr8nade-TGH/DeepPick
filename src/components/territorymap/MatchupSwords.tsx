'use client'

import { Marker } from 'react-map-gl/mapbox'

interface MatchupSwordsProps {
  latitude: number
  longitude: number
  gameId: string
  status: string
  homeTeam: string
  awayTeam: string
  onClick?: () => void
}

export function MatchupSwords({
  latitude,
  longitude,
  gameId,
  status,
  homeTeam,
  awayTeam,
  onClick
}: MatchupSwordsProps) {
  const isInProgress = status === 'in_progress' || status === 'live' || status === 'inprogress'

  return (
    <Marker
      latitude={latitude}
      longitude={longitude}
      anchor="center"
    >
      <div
        className="relative cursor-pointer group"
        onClick={onClick}
        title={`${awayTeam} @ ${homeTeam}${isInProgress ? ' - LIVE' : ''}`}
      >
        {/* Pulsing glow effect for live games */}
        {isInProgress && (
          <div className="absolute inset-0 animate-ping">
            <div className="w-10 h-10 bg-amber-400/30 rounded-full blur-md" />
          </div>
        )}

        {/* Swords clashing icon */}
        <div className={`relative z-10 text-3xl transition-transform group-hover:scale-125 ${
          isInProgress ? 'animate-pulse' : ''
        }`}>
          ⚔️
        </div>

        {/* Hover tooltip */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <div className="bg-slate-900/95 border-2 border-amber-500 rounded-lg px-3 py-2 shadow-xl">
            <div className="text-xs font-bold text-amber-400 text-center">
              {awayTeam} @ {homeTeam}
            </div>
            {isInProgress && (
              <div className="text-[10px] text-red-400 text-center mt-1 font-semibold animate-pulse">
                🔴 LIVE
              </div>
            )}
            {!isInProgress && (
              <div className="text-[10px] text-blue-300 text-center mt-1">
                Click to view battle
              </div>
            )}
          </div>
        </div>
      </div>
    </Marker>
  )
}

