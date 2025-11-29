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
  units: number
}

export default function ManualPicksPage() {
  const { addSelection: addToSlip, hasSelection, getSelection, isInSlip, picksPlacedCount } = useBettingSlip()
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

  // Get units for an existing pick
  const getExistingPickUnits = (gameId: string, pickType: 'spread' | 'total' | 'moneyline') => {
    return existingPicks.get(`${gameId}:${pickType}`)?.units || 1
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
          picksMap.set(key, { selection: p.selection, pickId: p.id, units: p.units || 1 })
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

  // Get capper name from user profile (same source as GlobalBettingSlip uses)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        if (data.profile?.full_name) {
          setCapperId(data.profile.full_name)
          console.log('[MakePicks] Capper ID from profile:', data.profile.full_name)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }

    fetchProfile()
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
        // Filter out games that have already started, have no odds, and sort by start time
        const now = new Date()
        const upcomingGames = (data.games || [])
          .filter((game: Game) => {
            const gameStartTime = new Date(game.game_start_timestamp)
            // Must be in the future AND have at least spread or total odds
            const hasOdds = game.odds.spread !== null || game.odds.total !== null
            return gameStartTime > now && hasOdds
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

        {/* Games Grid - 2 columns */}
        <div className="pb-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {games.map(game => {
                const hasSpreadPick = hasExistingPick(game.id, 'spread')
                const hasTotalPick = hasExistingPick(game.id, 'total')
                const spreadSelection = getExistingPickSelection(game.id, 'spread')
                const totalSelection = getExistingPickSelection(game.id, 'total')
                const spreadUnits = getExistingPickUnits(game.id, 'spread')
                const totalUnits = getExistingPickUnits(game.id, 'total')
                const hasAnyPick = hasSpreadPick || hasTotalPick

                // Check what's currently in the betting slip for this game
                const slipSpread = getSelection(game.id, 'spread')
                const slipTotal = getSelection(game.id, 'total')

                // Helper to format selection for badge display (abbreviated)
                const formatBadgeSelection = (selection: string | null, betType: 'spread' | 'total', units: number): string => {
                  if (!selection) return ''
                  // For spread: "Boston Celtics -7.5" -> "BOS -7.5"
                  // For total: "O 226.5" or "OVER 226.5" -> "o226.5"
                  if (betType === 'spread') {
                    // Extract just the spread number from the selection
                    const match = selection.match(/([+-]?\d+\.?\d*)$/)
                    const spreadNum = match ? match[1] : ''
                    // Try to figure out which team from the selection
                    const isHome = selection.toLowerCase().includes(game.home_team.name.toLowerCase()) ||
                      selection.includes(game.home_team.abbreviation)
                    const teamAbbr = isHome ? game.home_team.abbreviation : game.away_team.abbreviation
                    return `${units}U: ${teamAbbr} ${spreadNum}`
                  } else {
                    // Total: normalize to "o226.5" or "u226.5" format
                    const isOver = selection.toLowerCase().includes('over') || selection.startsWith('O ')
                    const match = selection.match(/(\d+\.?\d*)/)
                    const line = match ? match[1] : ''
                    return `${units}U: ${isOver ? 'o' : 'u'}${line}`
                  }
                }

                return (
                  <div
                    key={game.id}
                    className={`bg-slate-900/50 backdrop-blur-sm border rounded-lg overflow-hidden transition-all hover:shadow-lg ${hasAnyPick
                      ? 'border-emerald-500/50 shadow-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-600 hover:shadow-blue-500/10'
                      }`}
                  >
                    {/* Compact Game Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 px-3 py-2 border-b border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-sm">
                            <span className="text-blue-400">{game.away_team.abbreviation}</span>
                            <span className="text-slate-500 mx-1">@</span>
                            <span className="text-cyan-400">{game.home_team.abbreviation}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{formatGameDateTime(game.game_start_timestamp)}</span>
                            {(() => {
                              const countdown = getCountdown(game.game_start_timestamp)
                              return countdown ? (
                                <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  {countdown}
                                </span>
                              ) : null
                            })()}
                          </div>
                        </div>
                        {/* Compact pick badges - show placed picks with units */}
                        <div className="flex gap-1 flex-shrink-0">
                          {hasSpreadPick && (
                            <div className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                              ✓ {formatBadgeSelection(spreadSelection, 'spread', spreadUnits)}
                            </div>
                          )}
                          {hasTotalPick && (
                            <div className="bg-orange-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                              ✓ {formatBadgeSelection(totalSelection, 'total', totalUnits)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compact Odds Grid */}
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {/* Spread Column */}
                      <div>
                        <div className={`text-[10px] font-bold mb-1 text-center uppercase tracking-wider ${hasSpreadPick ? 'text-emerald-400' : 'text-slate-500'}`}>
                          Spread {hasSpreadPick && '✓'}
                        </div>
                        {game.odds.spread ? (
                          hasSpreadPick ? (
                            <button
                              onClick={() => openInsightCard(game.id, 'spread')}
                              className="w-full bg-gradient-to-br from-emerald-900/30 to-slate-900 border border-emerald-500/50 hover:border-emerald-400 rounded p-2 text-center transition-all cursor-pointer group"
                            >
                              <div className="text-emerald-400 font-bold text-xs group-hover:text-emerald-300">{spreadSelection}</div>
                              <div className="text-slate-500 text-[9px] group-hover:text-cyan-400">View insight</div>
                            </button>
                          ) : (
                            <div className="space-y-1">
                              {(() => {
                                const awayId = `${game.id}-spread-away`
                                const homeId = `${game.id}-spread-home`
                                const awaySelected = isInSlip(awayId)
                                const homeSelected = isInSlip(homeId)
                                return (
                                  <>
                                    <button
                                      onClick={() => addSelection(game, 'spread', 'away')}
                                      className={`w-full rounded p-1.5 transition-all group ${awaySelected
                                        ? 'bg-blue-600 border-2 border-blue-400 shadow-lg shadow-blue-500/30'
                                        : 'bg-slate-800 hover:bg-blue-900/50 border border-slate-600 hover:border-blue-500'
                                        }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className={`font-bold text-xs ${awaySelected ? 'text-white' : 'text-white group-hover:text-blue-400'}`}>
                                          {game.away_team.abbreviation}
                                        </span>
                                        <span className={`font-bold text-xs ${awaySelected ? 'text-white' : 'text-white'}`}>
                                          {game.odds.spread.line > 0 ? '+' : ''}{game.odds.spread.line.toFixed(1)} <span className={`text-[10px] ${awaySelected ? 'text-blue-200' : 'text-emerald-400'}`}>{formatOdds(game.odds.spread.away_odds)}</span>
                                        </span>
                                      </div>
                                    </button>
                                    <button
                                      onClick={() => addSelection(game, 'spread', 'home')}
                                      className={`w-full rounded p-1.5 transition-all group ${homeSelected
                                        ? 'bg-cyan-600 border-2 border-cyan-400 shadow-lg shadow-cyan-500/30'
                                        : 'bg-slate-800 hover:bg-cyan-900/50 border border-slate-600 hover:border-cyan-500'
                                        }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className={`font-bold text-xs ${homeSelected ? 'text-white' : 'text-white group-hover:text-cyan-400'}`}>
                                          {game.home_team.abbreviation}
                                        </span>
                                        <span className={`font-bold text-xs ${homeSelected ? 'text-white' : 'text-white'}`}>
                                          {-game.odds.spread.line > 0 ? '+' : ''}{(-game.odds.spread.line).toFixed(1)} <span className={`text-[10px] ${homeSelected ? 'text-cyan-200' : 'text-emerald-400'}`}>{formatOdds(game.odds.spread.home_odds)}</span>
                                        </span>
                                      </div>
                                    </button>
                                  </>
                                )
                              })()}
                            </div>
                          )
                        ) : (
                          <div className="text-center text-slate-500 text-[10px] py-3 bg-slate-800/50 rounded border border-slate-700">
                            N/A
                          </div>
                        )}
                      </div>

                      {/* Total Column */}
                      <div>
                        <div className={`text-[10px] font-bold mb-1 text-center uppercase tracking-wider ${hasTotalPick ? 'text-emerald-400' : 'text-slate-500'}`}>
                          Total {hasTotalPick && '✓'}
                        </div>
                        {game.odds.total ? (
                          hasTotalPick ? (
                            <button
                              onClick={() => openInsightCard(game.id, 'total')}
                              className="w-full bg-gradient-to-br from-emerald-900/30 to-slate-900 border border-emerald-500/50 hover:border-emerald-400 rounded p-2 text-center transition-all cursor-pointer group"
                            >
                              <div className="text-emerald-400 font-bold text-xs group-hover:text-emerald-300">{totalSelection}</div>
                              <div className="text-slate-500 text-[9px] group-hover:text-cyan-400">View insight</div>
                            </button>
                          ) : (
                            <div className="space-y-1">
                              {(() => {
                                const overId = `${game.id}-total-over`
                                const underId = `${game.id}-total-under`
                                const overSelected = isInSlip(overId)
                                const underSelected = isInSlip(underId)
                                return (
                                  <>
                                    <button
                                      onClick={() => addSelection(game, 'total', 'over')}
                                      className={`w-full rounded p-1.5 transition-all group ${overSelected
                                        ? 'bg-orange-600 border-2 border-orange-400 shadow-lg shadow-orange-500/30'
                                        : 'bg-slate-800 hover:bg-orange-900/50 border border-slate-600 hover:border-orange-500'
                                        }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className={`font-bold text-xs ${overSelected ? 'text-white' : 'text-white group-hover:text-orange-400'}`}>
                                          O {game.odds.total.line.toFixed(1)}
                                        </span>
                                        <span className={`text-[10px] ${overSelected ? 'text-orange-200' : 'text-emerald-400'}`}>{formatOdds(game.odds.total.over_odds)}</span>
                                      </div>
                                    </button>
                                    <button
                                      onClick={() => addSelection(game, 'total', 'under')}
                                      className={`w-full rounded p-1.5 transition-all group ${underSelected
                                        ? 'bg-purple-600 border-2 border-purple-400 shadow-lg shadow-purple-500/30'
                                        : 'bg-slate-800 hover:bg-purple-900/50 border border-slate-600 hover:border-purple-500'
                                        }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className={`font-bold text-xs ${underSelected ? 'text-white' : 'text-white group-hover:text-purple-400'}`}>
                                          U {game.odds.total.line.toFixed(1)}
                                        </span>
                                        <span className={`text-[10px] ${underSelected ? 'text-purple-200' : 'text-emerald-400'}`}>{formatOdds(game.odds.total.under_odds)}</span>
                                      </div>
                                    </button>
                                  </>
                                )
                              })()}
                            </div>
                          )
                        ) : (
                          <div className="text-center text-slate-500 text-[10px] py-3 bg-slate-800/50 rounded border border-slate-700">
                            N/A
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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

