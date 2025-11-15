'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useBettingSlip, BetSelection } from '@/contexts/betting-slip-context'
import { useAuth } from '@/contexts/auth-context'

interface Game {
  id: string
  home_team: { name: string; abbreviation: string }
  away_team: { name: string; abbreviation: string }
  game_date: string
  game_time: string
  game_start_timestamp: string
  status: string
  odds: {
    spread: { line: number; home_odds: number; away_odds: number } | null
    total: { line: number; over_odds: number; under_odds: number } | null
    moneyline: { home: number; away: number } | null
  }
}

// Helper function to get countdown to game start
function getCountdown(gameDate: string | undefined): string {
  if (!gameDate) return ''

  const now = new Date()
  const game = new Date(gameDate)
  const diff = game.getTime() - now.getTime()

  if (diff < 0) return '' // Game has started or passed

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

export default function ManualPicksPage() {
  const { addSelection: addToSlip, hasSelection } = useBettingSlip()
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [existingPicks, setExistingPicks] = useState<Set<string>>(new Set())
  const [capperId, setCapperId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Fetch user's capper_id from user_cappers table
  useEffect(() => {
    const fetchCapperId = async () => {
      if (!user) return

      try {
        const response = await fetch(`/api/user-cappers?userId=${user.id}`)
        const data = await response.json()
        if (data.success && data.cappers && data.cappers.length > 0) {
          setCapperId(data.cappers[0].capper_id)
        }
      } catch (error) {
        console.error('Error fetching capper ID:', error)
      }
    }

    fetchCapperId()
  }, [user])

  useEffect(() => {
    if (capperId) {
      fetchGames()
      fetchExistingPicks()
    }
  }, [capperId])

  const fetchGames = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/games/today')
      const data = await response.json()
      if (data.success) {
        // Filter out games that have already started and sort by start time (soonest first)
        const now = new Date()
        const upcomingGames = (data.games || [])
          .filter((game: Game) => {
            const gameStartTime = new Date(game.game_start_timestamp)
            return gameStartTime > now
          })
          .sort((a: Game, b: Game) => {
            const aTime = new Date(a.game_start_timestamp).getTime()
            const bTime = new Date(b.game_start_timestamp).getTime()
            return aTime - bTime // Ascending order (soonest first)
          })
        setGames(upcomingGames)
      }
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingPicks = async () => {
    try {
      const response = await fetch(`/api/picks?capper=${capperId}&status=pending`)
      const data = await response.json()
      if (data.success) {
        const gameIds = new Set<string>(data.picks.map((p: any) => p.game_id as string))
        setExistingPicks(gameIds)
      }
    } catch (error) {
      console.error('Error fetching existing picks:', error)
    }
  }

  const addSelection = (game: Game, betType: 'spread' | 'total' | 'moneyline', side: 'home' | 'away' | 'over' | 'under') => {
    // CRITICAL: Check if game has already started
    const gameStartTime = new Date(game.game_start_timestamp)
    const now = new Date()
    if (now >= gameStartTime) {
      alert('⚠️ GAME HAS STARTED - Cannot place picks on games that have already begun!')
      return
    }

    // Check if game already has a pick
    if (existingPicks.has(game.id)) {
      alert('You already have a pick on this game!')
      return
    }

    let team = ''
    let line = ''
    let odds = 0

    if (betType === 'spread') {
      if (!game.odds.spread) return
      team = side === 'home' ? game.home_team.abbreviation : game.away_team.abbreviation
      const spreadLine = side === 'home' ? -game.odds.spread.line : game.odds.spread.line
      line = `${spreadLine > 0 ? '+' : ''}${spreadLine.toFixed(1)}`
      odds = game.odds.spread.home_odds
    } else if (betType === 'total') {
      if (!game.odds.total) return
      team = side === 'over' ? 'OVER' : 'UNDER'
      line = `${side === 'over' ? 'O' : 'U'} ${game.odds.total.line.toFixed(1)}`
      odds = side === 'over' ? game.odds.total.over_odds : game.odds.total.under_odds
    } else if (betType === 'moneyline') {
      if (!game.odds.moneyline) return
      team = side === 'home' ? game.home_team.abbreviation : game.away_team.abbreviation
      line = 'ML'
      odds = side === 'home' ? game.odds.moneyline.home : game.odds.moneyline.away
    }

    const selection: BetSelection = {
      id: `${game.id}-${betType}-${side}`,
      gameId: game.id,
      team,
      betType,
      line,
      odds,
      homeTeam: game.home_team.abbreviation,
      awayTeam: game.away_team.abbreviation,
      gameTime: game.game_time
    }

    // Add to global betting slip (context handles validation)
    addToSlip(selection)
  }

  const formatGameDateTime = (timestamp: string) => {
    // Parse the UTC timestamp and convert to local time
    const date = new Date(timestamp)

    // Format date as "Mon, Jan 15"
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })

    // Format time as "6:00 PM"
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    return `${dateStr} at ${timeStr}`
  }

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Manual Picks</h1>
          <p className="text-slate-400">Select games to add to your bet slip</p>
        </div>

        {/* Refresh Button */}
        <div className="mb-4">
          <button
            onClick={fetchGames}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Games
          </button>
        </div>

        {/* Games List */}
        <div className="space-y-4 pb-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading games...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg">No games available</p>
              <p className="text-sm mt-2">Check back later for today's games</p>
            </div>
          ) : (
            games.map(game => {
              const hasPick = existingPicks.has(game.id)

              return (
                <div
                  key={game.id}
                  className={`bg-slate-900 border rounded-lg overflow-hidden ${hasPick ? 'border-green-500/50 opacity-60' : 'border-slate-700'
                    }`}
                >
                  {/* Game Header */}
                  <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {game.away_team.name} <span className="text-slate-500">@</span> {game.home_team.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-semibold">
                            SGP
                          </span>
                          <span>{formatGameDateTime(game.game_start_timestamp)}</span>
                          {(() => {
                            const countdown = getCountdown(game.game_start_timestamp)
                            return countdown ? (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  {countdown}
                                </span>
                              </>
                            ) : null
                          })()}
                        </div>
                      </div>
                      {hasPick && (
                        <div className="bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold">
                          PICK PLACED
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Odds Grid */}
                  <div className="grid grid-cols-2 gap-px bg-slate-700">
                    {/* Spread Column */}
                    <div className="bg-slate-900 p-4">
                      <div className="text-xs text-slate-400 font-semibold mb-3 text-center">Spread</div>
                      {game.odds.spread ? (
                        <div className="space-y-2">
                          {/* Away Spread */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'spread', 'away')}
                            disabled={hasPick}
                            className={`w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded p-3 transition-colors text-left ${hasPick ? 'cursor-not-allowed opacity-50' : ''
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-semibold text-sm">{game.away_team.abbreviation}</span>
                              <div className="text-right">
                                <div className="text-white font-bold">
                                  {game.odds.spread.line > 0 ? '+' : ''}{game.odds.spread.line.toFixed(1)}
                                </div>
                                <div className="text-green-400 text-xs">{formatOdds(game.odds.spread.away_odds)}</div>
                              </div>
                            </div>
                          </button>
                          {/* Home Spread */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'spread', 'home')}
                            disabled={hasPick}
                            className={`w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded p-3 transition-colors text-left ${hasPick ? 'cursor-not-allowed opacity-50' : ''
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-semibold text-sm">{game.home_team.abbreviation}</span>
                              <div className="text-right">
                                <div className="text-white font-bold">
                                  {-game.odds.spread.line > 0 ? '+' : ''}{(-game.odds.spread.line).toFixed(1)}
                                </div>
                                <div className="text-green-400 text-xs">{formatOdds(game.odds.spread.home_odds)}</div>
                              </div>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-4">No spread available</div>
                      )}
                    </div>

                    {/* Total Column */}
                    <div className="bg-slate-900 p-4">
                      <div className="text-xs text-slate-400 font-semibold mb-3 text-center">Total</div>
                      {game.odds.total ? (
                        <div className="space-y-2">
                          {/* Over */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'total', 'over')}
                            disabled={hasPick}
                            className={`w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded p-3 transition-colors text-left ${hasPick ? 'cursor-not-allowed opacity-50' : ''
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-semibold text-sm">O {game.odds.total.line.toFixed(1)}</span>
                              <div className="text-green-400 text-xs font-bold">{formatOdds(game.odds.total.over_odds)}</div>
                            </div>
                          </button>
                          {/* Under */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'total', 'under')}
                            disabled={hasPick}
                            className={`w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded p-3 transition-colors text-left ${hasPick ? 'cursor-not-allowed opacity-50' : ''
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-semibold text-sm">U {game.odds.total.line.toFixed(1)}</span>
                              <div className="text-green-400 text-xs font-bold">{formatOdds(game.odds.total.under_odds)}</div>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-4">No total available</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Betting Slip - Hidden, selections managed by global slip */}
    </div>
  )
}

