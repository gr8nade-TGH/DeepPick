'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useBettingSlip, BetSelection } from '@/contexts/betting-slip-context'
import { useAuth } from '@/contexts/auth-context'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'

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

// Track existing picks by game_id and pick_type
interface ExistingPickData {
  selection: string
  pickId: string
}

export default function ManualPicksPage() {
  const { addSelection: addToSlip, hasSelection, picksPlacedCount } = useBettingSlip()
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  // Map of "gameId:pickType" -> { selection, pickId }
  const [existingPicks, setExistingPicks] = useState<Map<string, ExistingPickData>>(new Map())
  const [capperId, setCapperId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  // Insight modal state
  const [showInsightModal, setShowInsightModal] = useState(false)
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)

  // Helper to check if a specific bet type is already picked for a game
  const hasExistingPick = (gameId: string, pickType: 'spread' | 'total' | 'moneyline') => {
    return existingPicks.has(`${gameId}:${pickType}`)
  }

  // Get the selection for an existing pick
  const getExistingPickSelection = (gameId: string, pickType: 'spread' | 'total' | 'moneyline') => {
    return existingPicks.get(`${gameId}:${pickType}`)?.selection || null
  }

  // Get the pick ID for an existing pick
  const getExistingPickId = (gameId: string, pickType: 'spread' | 'total' | 'moneyline') => {
    return existingPicks.get(`${gameId}:${pickType}`)?.pickId || null
  }

  // Open insight modal for an existing pick
  const openInsightCard = (gameId: string, pickType: 'spread' | 'total' | 'moneyline') => {
    const pickId = getExistingPickId(gameId, pickType)
    if (pickId) {
      setSelectedPickId(pickId)
      setShowInsightModal(true)
    }
  }

  // Memoize fetchExistingPicks for use in effect dependencies
  const fetchExistingPicks = useCallback(async () => {
    if (!capperId) return
    try {
      const response = await fetch(`/api/picks?capper=${capperId}&status=pending`)
      const data = await response.json()
      if (data.success) {
        const picksMap = new Map<string, ExistingPickData>()
        data.picks.forEach((p: any) => {
          const key = `${p.game_id}:${p.pick_type}`
          picksMap.set(key, { selection: p.selection, pickId: p.id })
        })
        setExistingPicks(picksMap)
        console.log('[MakePicks] Existing picks loaded:', Array.from(picksMap.entries()))
      }
    } catch (error) {
      console.error('Error fetching existing picks:', error)
    }
  }, [capperId])

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
  }, [capperId, fetchExistingPicks])

  // Re-fetch existing picks when picks are placed from the betting slip
  useEffect(() => {
    if (picksPlacedCount > 0 && capperId) {
      console.log('[MakePicks] Picks placed, refreshing existing picks...')
      fetchExistingPicks()
    }
  }, [picksPlacedCount, capperId, fetchExistingPicks])

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

  const addSelection = (game: Game, betType: 'spread' | 'total' | 'moneyline', side: 'home' | 'away' | 'over' | 'under') => {
    // CRITICAL: Check if game has already started
    const gameStartTime = new Date(game.game_start_timestamp)
    const now = new Date()
    if (now >= gameStartTime) {
      alert('⚠️ GAME HAS STARTED - Cannot place picks on games that have already begun!')
      return
    }

    // Check if this specific bet type already has a pick for this game
    if (hasExistingPick(game.id, betType)) {
      alert(`You already have a ${betType.toUpperCase()} pick on this game!`)
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
              const hasSpreadPick = hasExistingPick(game.id, 'spread')
              const hasTotalPick = hasExistingPick(game.id, 'total')
              const spreadSelection = getExistingPickSelection(game.id, 'spread')
              const totalSelection = getExistingPickSelection(game.id, 'total')
              const hasAnyPick = hasSpreadPick || hasTotalPick

              return (
                <div
                  key={game.id}
                  className={`bg-slate-900/50 backdrop-blur-sm border rounded-xl overflow-hidden transition-all hover:shadow-xl ${hasAnyPick
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
                      {/* Show badges for existing picks */}
                      <div className="flex gap-2">
                        {hasSpreadPick && (
                          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg">
                            ✓ {spreadSelection}
                          </div>
                        )}
                        {hasTotalPick && (
                          <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg">
                            ✓ {totalSelection}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Odds Grid */}
                  <div className="grid grid-cols-2 gap-3 p-5">
                    {/* Spread Column */}
                    <div className="space-y-3">
                      <div className={`text-xs font-bold mb-2 text-center uppercase tracking-wider ${hasSpreadPick ? 'text-emerald-400' : 'text-slate-400'}`}>
                        Spread {hasSpreadPick && '✓'}
                      </div>
                      {game.odds.spread ? (
                        hasSpreadPick ? (
                          // Show locked state with the pick highlighted - clickable to view insight card
                          <button
                            onClick={() => openInsightCard(game.id, 'spread')}
                            className="w-full bg-gradient-to-br from-emerald-900/30 to-slate-900 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-lg p-4 text-center transition-all hover:shadow-lg hover:shadow-emerald-500/20 cursor-pointer group"
                          >
                            <div className="text-emerald-400 font-bold text-lg mb-1 group-hover:text-emerald-300">{spreadSelection}</div>
                            <div className="text-slate-500 text-xs group-hover:text-cyan-400">Click to view insight card</div>
                          </button>
                        ) : (
                          <div className="space-y-2">
                            {/* Away Spread */}
                            <button
                              onClick={() => addSelection(game, 'spread', 'away')}
                              className="w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-blue-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-blue-500 rounded-lg p-3 transition-all text-left group hover:shadow-lg hover:shadow-blue-500/20"
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
                              onClick={() => addSelection(game, 'spread', 'home')}
                              className="w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-cyan-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-cyan-500 rounded-lg p-3 transition-all text-left group hover:shadow-lg hover:shadow-cyan-500/20"
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
                        )
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-6 bg-slate-800/50 rounded-lg border border-slate-700">
                          No spread available
                        </div>
                      )}
                    </div>

                    {/* Total Column */}
                    <div className="space-y-3">
                      <div className={`text-xs font-bold mb-2 text-center uppercase tracking-wider ${hasTotalPick ? 'text-emerald-400' : 'text-slate-400'}`}>
                        Total {hasTotalPick && '✓'}
                      </div>
                      {game.odds.total ? (
                        hasTotalPick ? (
                          // Show locked state with the pick highlighted - clickable to view insight card
                          <button
                            onClick={() => openInsightCard(game.id, 'total')}
                            className="w-full bg-gradient-to-br from-emerald-900/30 to-slate-900 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-lg p-4 text-center transition-all hover:shadow-lg hover:shadow-emerald-500/20 cursor-pointer group"
                          >
                            <div className="text-emerald-400 font-bold text-lg mb-1 group-hover:text-emerald-300">{totalSelection}</div>
                            <div className="text-slate-500 text-xs group-hover:text-cyan-400">Click to view insight card</div>
                          </button>
                        ) : (
                          <div className="space-y-2">
                            {/* Over */}
                            <button
                              onClick={() => addSelection(game, 'total', 'over')}
                              className="w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-orange-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-orange-500 rounded-lg p-3 transition-all text-left group hover:shadow-lg hover:shadow-orange-500/20"
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
                              onClick={() => addSelection(game, 'total', 'under')}
                              className="w-full bg-gradient-to-br from-slate-800 to-slate-900 hover:from-purple-900/50 hover:to-slate-800 border-2 border-slate-600 hover:border-purple-500 rounded-lg p-3 transition-all text-left group hover:shadow-lg hover:shadow-purple-500/20"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-white font-bold text-sm group-hover:text-purple-400 transition-colors">
                                  U {game.odds.total.line.toFixed(1)}
                                </span>
                                <div className="text-emerald-400 text-xs font-semibold">{formatOdds(game.odds.total.under_odds)}</div>
                              </div>
                            </button>
                          </div>
                        )
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

      {/* Insight Card Modal */}
      {showInsightModal && selectedPickId && (
        <PickInsightModal
          pickId={selectedPickId}
          onClose={() => {
            setShowInsightModal(false)
            setSelectedPickId(null)
          }}
        />
      )}
    </div>
  )
}

