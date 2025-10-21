"use client"
import { useEffect, useState } from 'react'

interface GameInboxItem {
  game_id: string
  sport: string
  status: string
  start_time_utc: string
  away: string
  home: string
  odds: {
    ml_home: number
    ml_away: number
    spread_team: string
    spread_line: number
    total_line: number
  }
}

export function SHIVAManagementInbox() {
  const [games, setGames] = useState<GameInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSport, setSelectedSport] = useState('NBA')

  useEffect(() => {
    async function fetchGames() {
      try {
        const response = await fetch(`/api/games/current?league=${selectedSport}&limit=20`)
        if (response.ok) {
          const data = await response.json()
          setGames(data.games || [])
        }
      } catch (error) {
        console.error('Failed to fetch games:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchGames()
  }, [selectedSport])

  const formatLocalTime = (utcTime: string) => {
    try {
      return new Date(utcTime).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    } catch {
      return 'TBD'
    }
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'scheduled': return { text: 'UPCOMING', class: 'bg-blue-600 text-white' }
      case 'live': return { text: 'LIVE', class: 'bg-green-600 text-white' }
      case 'final': return { text: 'FINAL', class: 'bg-gray-600 text-white' }
      case 'postponed': return { text: 'POSTPONED', class: 'bg-yellow-600 text-white' }
      default: return { text: status.toUpperCase(), class: 'bg-gray-600 text-white' }
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-bold text-white">Game Inbox</div>
        <div className="flex items-center gap-2">
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="px-2 py-1 border border-gray-600 rounded text-xs bg-gray-800 text-white"
          >
            <option value="NBA">NBA</option>
            <option value="NFL">NFL</option>
            <option value="MLB">MLB</option>
          </select>
          <div className="text-xs text-gray-300 font-semibold">• SHIVA</div>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center text-gray-400 text-sm py-4">Loading games...</div>
      ) : games.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-4">No upcoming games found</div>
      ) : (
        <ul className="divide-y divide-gray-700">
          {games.map((game) => {
            const statusChip = getStatusChip(game.status)
            return (
              <li key={game.game_id} className="py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm">
                      {game.away} @ {game.home}
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      ML {game.away.split(' ').pop()} {game.odds.ml_away !== 0 ? (game.odds.ml_away > 0 ? '+' : '') + game.odds.ml_away : '—'} • {game.home.split(' ').pop()} {game.odds.ml_home !== 0 ? (game.odds.ml_home > 0 ? '+' : '') + game.odds.ml_home : '—'}
                    </div>
                    <div className="text-xs text-gray-300">
                      Spread: {game.odds.spread_team.split(' ').pop()} {game.odds.spread_line !== 0 ? (game.odds.spread_line > 0 ? '+' : '') + game.odds.spread_line : '—'} • Total: {game.odds.total_line !== 0 ? game.odds.total_line : '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end ml-2">
                    <div className="text-xs text-gray-400">{formatLocalTime(game.start_time_utc)}</div>
                    <div className="mt-1">
                      <span className={`px-1 py-0.5 rounded text-xs ${statusChip.class}`}>
                        {statusChip.text}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}


