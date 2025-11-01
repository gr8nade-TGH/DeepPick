"use client"
import { useEffect, useState } from 'react'
import { GeneratedPicksInbox } from '@/components/cappers/game-and-picks-inbox'

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

interface SHIVAManagementInboxProps {
  onGameSelect?: (game: any) => void
  selectedGame?: any
}

export function SHIVAManagementInbox({ onGameSelect, selectedGame }: SHIVAManagementInboxProps = {}) {
  const [games, setGames] = useState<GameInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedSport, setSelectedSport] = useState('NBA')

  const syncGames = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync/mysportsfeeds-games', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        console.log(`[Game Inbox] Synced ${data.gamesSynced} games`)
        console.log(`[Game Inbox] Full sync response:`, data)
        if (data.debug) {
          console.log(`[Game Inbox] Debug info:`, data.debug)
        }
        if (data.errors && data.errors.length > 0) {
          console.error('[Game Inbox] Sync errors:', data.errors)
          alert(`Sync completed with errors:\n${data.errors.slice(0, 3).join('\n')}`)
        }
        // Refresh games after sync
        fetchGames()
      } else {
        console.error('[Game Inbox] Sync failed:', data.error)
        alert(`Sync failed: ${data.error}`)
      }
    } catch (error) {
      console.error('[Game Inbox] Sync error:', error)
      alert('Failed to sync games')
    } finally {
      setSyncing(false)
    }
  }

  const fetchGames = async () => {
    try {
      const response = await fetch(`/api/games/current?league=${selectedSport}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        const allGames = data.games || []

        // Deduplicate games by team matchup (home vs away)
        const deduplicatedGames = deduplicateGamesByMatchup(allGames)

        console.log(`[Game Inbox] Fetched ${allGames.length} games, deduplicated to ${deduplicatedGames.length}`)
        setGames(deduplicatedGames)
      } else {
        console.error('Failed to fetch games:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to fetch games:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGames()
  }, [selectedSport])

  // Deduplicate games by team matchup, keeping the earliest game
  const deduplicateGamesByMatchup = (games: GameInboxItem[]) => {
    const matchupMap = new Map<string, GameInboxItem>()
    const duplicatesRemoved: string[] = []

    games.forEach(game => {
      // Create a unique key based on team names (case-insensitive)
      const homeTeam = game.home.toLowerCase().trim()
      const awayTeam = game.away.toLowerCase().trim()
      const matchupKey = `${awayTeam}@${homeTeam}`

      // If we haven't seen this matchup, or if this game is earlier, keep it
      if (!matchupMap.has(matchupKey)) {
        matchupMap.set(matchupKey, game)
      } else {
        const existingGame = matchupMap.get(matchupKey)!
        const currentGameTime = new Date(game.start_time_utc).getTime()
        const existingGameTime = new Date(existingGame.start_time_utc).getTime()

        // Keep the earlier game
        if (currentGameTime < existingGameTime) {
          duplicatesRemoved.push(`Removed duplicate: ${game.away} @ ${game.home} (${existingGame.start_time_utc})`)
          matchupMap.set(matchupKey, game)
        } else {
          duplicatesRemoved.push(`Removed duplicate: ${game.away} @ ${game.home} (${game.start_time_utc})`)
        }
      }
    })

    if (duplicatesRemoved.length > 0) {
      console.log('[Game Inbox] Deduplication results:', duplicatesRemoved)
    }

    // Convert back to array and sort by start time
    return Array.from(matchupMap.values()).sort((a, b) =>
      new Date(a.start_time_utc).getTime() - new Date(b.start_time_utc).getTime()
    )
  }

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
    <div className="space-y-4">
      {/* Generated Picks Inbox - MOVED TO TOP FOR VISIBILITY */}
      <GeneratedPicksInbox capper="shiva" />

      {/* Game Inbox with fixed height and scroll */}
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
            <button
              onClick={syncGames}
              disabled={syncing}
              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500 disabled:opacity-50"
            >
              {syncing ? '⏳ Syncing...' : '🔄 Sync Games'}
            </button>
          </div>
        </div>

        {/* Deduplication Info */}
        {games.length > 0 && (
          <div className="mb-2 text-xs text-gray-400">
            Showing {games.length} unique matchups (duplicates removed)
          </div>
        )}

        {/* Fixed height container with scroll */}
        <div className="h-64 overflow-y-auto border border-gray-600 rounded bg-gray-800">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-4">Loading games...</div>
          ) : games.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-4">No upcoming games found</div>
          ) : (
            <ul className="divide-y divide-gray-700">
              {games.map((game) => {
                const statusChip = getStatusChip(game.status)
                const isSelected = selectedGame?.game_id === game.game_id
                return (
                  <li
                    key={game.game_id}
                    className={`py-3 px-3 cursor-pointer transition-colors ${isSelected
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-700'
                      }`}
                    onClick={() => {
                      console.log('Game selected:', game)
                      onGameSelect?.(game)
                    }}
                  >
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
                        <div className="text-xs text-gray-500 mt-1">
                          Game ID: {game.game_id}
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
      </div>
    </div>
  )
}


