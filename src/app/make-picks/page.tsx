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
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Make Picks
              </h1>
              <p className="text-slate-400">Select games to add to your bet slip</p>
            </div>
            {/* Refresh Button */}
            <button
              onClick={fetchGames}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all shadow-lg hover:shadow-blue-500/50 font-semibold"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Games
            </button>
          </div>
          {/* Stats Bar */}
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              <span>{games.length} games available</span>
            </div>
            {existingPicks.size > 0 && (
              <div className="flex items-center gap-2 text-emerald-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span>{existingPicks.size} picks placed</span>
              </div>
            )}
          </div>
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
                  className={`bg-slate-900/50 backdrop-blur-sm border rounded-xl overflow-hidden transition-all hover:shadow-xl ${hasPick
                    ? 'border-emerald-500/50 shadow-emerald-500/20'
                    : 'border-slate-700 hover:border-slate-600 hover:shadow-blue-500/20'
                    }`}
                >
                  {/* Game Header */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 px-5 py-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg mb-1">
                          <span className="text-blue-400">{game.away_team.abbreviation}</span>
                          {' '}
                          <span className="text-slate-500">@</span>
                          {' '}
                          <span className="text-cyan-400">{game.home_team.abbreviation}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="font-medium">{formatGameDateTime(game.game_start_timestamp)}</span>
                          {(() => {
                            const countdown = getCountdown(game.game_start_timestamp)
                            return countdown ? (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="flex items-center gap-1.5 text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-1 rounded">
                                  <Clock className="w-3.5 h-3.5" />
                                  {countdown}
                                </span>
                              </>
                            ) : null
                          })()}
                        </div>
                      </div>
                      {hasPick && (
                        <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg">
                          ✓ PICK PLACED
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Odds Grid */}
                  <div className="grid grid-cols-2 gap-3 p-5">
                    {/* Spread Column */}
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400 font-bold mb-2 text-center uppercase tracking-wider">Spread</div>
                      {game.odds.spread ? (
                        <div className="space-y-2">
                          {/* Away Spread */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'spread', 'away')}
                            disabled={hasPick}
                            className={`w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-blue-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-blue-500 rounded-lg p-3 transition-all text-left group ${hasPick ? 'cursor-not-allowed opacity-40' : 'hover:shadow-lg hover:shadow-blue-500/20'
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors">
                                {game.away_team.abbreviation}
                              </span>
                              <div className="text-right">
                                <div className="text-white font-bold text-base">
                                  {game.odds.spread.line > 0 ? '+' : ''}{game.odds.spread.line.toFixed(1)}
                                </div>
                                <div className="text-emerald-400 text-xs font-semibold">{formatOdds(game.odds.spread.away_odds)}</div>
                              </div>
                            </div>
                          </button>
                          {/* Home Spread */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'spread', 'home')}
                            disabled={hasPick}
                            className={`w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-cyan-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-cyan-500 rounded-lg p-3 transition-all text-left group ${hasPick ? 'cursor-not-allowed opacity-40' : 'hover:shadow-lg hover:shadow-cyan-500/20'
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-bold text-sm group-hover:text-cyan-400 transition-colors">
                                {game.home_team.abbreviation}
                              </span>
                              <div className="text-right">
                                <div className="text-white font-bold text-base">
                                  {-game.odds.spread.line > 0 ? '+' : ''}{(-game.odds.spread.line).toFixed(1)}
                                </div>
                                <div className="text-emerald-400 text-xs font-semibold">{formatOdds(game.odds.spread.home_odds)}</div>
                              </div>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-6 bg-slate-800/50 rounded-lg border border-slate-700">
                          No spread available
                        </div>
                      )}
                    </div>

                    {/* Total Column */}
                    <div className="space-y-3">
                      <div className="text-xs text-slate-400 font-bold mb-2 text-center uppercase tracking-wider">Total</div>
                      {game.odds.total ? (
                        <div className="space-y-2">
                          {/* Over */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'total', 'over')}
                            disabled={hasPick}
                            className={`w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-orange-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-orange-500 rounded-lg p-3 transition-all text-left group ${hasPick ? 'cursor-not-allowed opacity-40' : 'hover:shadow-lg hover:shadow-orange-500/20'
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-bold text-sm group-hover:text-orange-400 transition-colors">
                                O {game.odds.total.line.toFixed(1)}
                              </span>
                              <div className="text-emerald-400 text-xs font-semibold">{formatOdds(game.odds.total.over_odds)}</div>
                            </div>
                          </button>
                          {/* Under */}
                          <button
                            onClick={() => !hasPick && addSelection(game, 'total', 'under')}
                            disabled={hasPick}
                            className={`w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-purple-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-purple-500 rounded-lg p-3 transition-all text-left group ${hasPick ? 'cursor-not-allowed opacity-40' : 'hover:shadow-lg hover:shadow-purple-500/20'
                              }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white font-bold text-sm group-hover:text-purple-400 transition-colors">
                                U {game.odds.total.line.toFixed(1)}
                              </span>
                              <div className="text-emerald-400 text-xs font-semibold">{formatOdds(game.odds.total.under_odds)}</div>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-6 bg-slate-800/50 rounded-lg border border-slate-700">
                          No total available
                        </div>
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

