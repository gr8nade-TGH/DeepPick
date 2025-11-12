'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  Trophy,
  ArrowUp,
  ArrowDown,
  Activity,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  TrendingDown
} from 'lucide-react'

import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useAuth } from '@/contexts/auth-context'
import { Lock } from 'lucide-react'

interface Pick {
  id: string
  selection: string
  created_at: string
  units: number
  status: string
  pick_type: string
  confidence?: number
  net_units?: number
  capper?: string
  game_snapshot?: {
    home_team: any
    away_team: any
    game_date: string
    game_time: string
  }
  games?: {
    status: string
  }
}

interface Capper {
  id: string
  name: string
  avatar: string
  rank: number
  roi: number
  win_rate: number
  total_units: number
  streak: number
  total_picks: number
  badge: 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze'
  is_hot: boolean
}

interface PerformanceMetrics {
  total_picks: number
  wins: number
  losses: number
  win_rate: number
  net_units: number
  roi: number
}

interface ChartDataPoint {
  date: string
  cumulative_units: number
  daily_units: number
  wins: number
  losses: number
}

export function ProfessionalDashboard() {
  const { user } = useAuth()
  const [todaysPicks, setTodaysPicks] = useState<Pick[]>([])
  const [topCappers, setTopCappers] = useState<Capper[]>([])
  const [recentActivity, setRecentActivity] = useState<Pick[]>([])
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null)
  const [showInsight, setShowInsight] = useState(false)
  const [sportFilter, setSportFilter] = useState('all')
  const [boldPredictionsMap, setBoldPredictionsMap] = useState<Map<string, any>>(new Map())
  const [expandedPicks, setExpandedPicks] = useState<Set<string>>(new Set())
  const [picksPage, setPicksPage] = useState(0) // Pagination for picks (10 per page)

  useEffect(() => {
    fetchDashboardData()
  }, [sportFilter])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const [picksResponse, activityResponse, perfResponse] = await Promise.all([
        fetch('/api/picks?status=pending&limit=12&sort=confidence'),
        fetch('/api/picks?status=completed&limit=20&sort=created_at'),
        fetch('/api/performance?period=30d')
      ])

      const [picksData, activityData, perfData] = await Promise.all([
        picksResponse.json(),
        activityResponse.json(),
        perfResponse.json()
      ])

      if (picksData.success) setTodaysPicks(picksData.data)
      if (activityData.success) {
        setRecentActivity(activityData.data)
      }
      if (perfData.success) {
        console.log('[Dashboard] Performance data:', perfData.data)
        setPerformance(perfData.data.metrics)
        // Use chart data from performance API (more complete than activity picks)
        if (perfData.data.chartData && perfData.data.chartData.length > 0) {
          console.log('[Dashboard] Setting chart data from API:', perfData.data.chartData)
          console.log('[Dashboard] Chart data details:', JSON.stringify(perfData.data.chartData, null, 2))
          setChartData(perfData.data.chartData)
        } else {
          console.log('[Dashboard] No chart data from API, calculating from activity')
          // Fallback to calculating from activity if no chart data
          calculateChartData(activityData.data)
        }
      }

      // Fetch real capper data from user_cappers and performance API
      await fetchTopCappers()

      // Fetch bold predictions and map to picks
      await fetchBoldPredictions()

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBoldPredictions = async () => {
    try {
      const response = await fetch('/api/shiva/bold-predictions-log')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.entries) {
          // Create a map of game_id + capper -> bold_predictions
          const predictionsMap = new Map()
          data.entries.forEach((entry: any) => {
            // We'll need to match by game and capper
            const key = `${entry.matchup}_${entry.capper}`
            predictionsMap.set(key, entry.bold_predictions)
          })
          setBoldPredictionsMap(predictionsMap)
        }
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching bold predictions:', error)
    }
  }

  const togglePickExpansion = (pickId: string) => {
    setExpandedPicks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pickId)) {
        newSet.delete(pickId)
      } else {
        newSet.add(pickId)
      }
      return newSet
    })
  }

  const fetchTopCappers = async () => {
    try {
      // Fetch all cappers from user_cappers table
      const cappersResponse = await fetch('/api/user-cappers')
      const cappersData = await cappersResponse.json()

      console.log('[Dashboard] Fetched cappers:', cappersData)

      if (!cappersData.success || !cappersData.cappers || cappersData.cappers.length === 0) {
        console.error('[Dashboard] Failed to fetch cappers or no cappers found')
        setTopCappers([]) // Clear any existing data
        return
      }

      // Fetch performance for each capper
      const capperPerformance = await Promise.all(
        cappersData.cappers.map(async (capper: any) => {
          const perfResponse = await fetch(`/api/performance?period=all_time&capper=${capper.capper_id}`)
          const perfData = await perfResponse.json()

          console.log(`[Dashboard] Performance for ${capper.capper_id}:`, perfData)

          if (perfData.success && perfData.data) {
            const metrics = perfData.data.metrics
            return {
              id: capper.capper_id,
              name: capper.capper_id.toUpperCase(),
              avatar: capper.capper_id === 'shiva' ? '🔱' : capper.capper_id === 'ifrit' ? '🔥' : '🎯',
              rank: 0, // Will be set after sorting
              roi: metrics.roi || 0,
              win_rate: metrics.win_rate || 0,
              total_units: metrics.net_units || 0,
              streak: 0, // TODO: Calculate streak
              total_picks: metrics.total_picks || 0,
              badge: metrics.roi > 20 ? 'diamond' : metrics.roi > 10 ? 'platinum' : 'gold',
              is_hot: metrics.roi > 0
            }
          }
          return null
        })
      )

      // Filter out nulls and sort by ROI
      const validCappers = capperPerformance.filter(c => c !== null) as Capper[]
      validCappers.sort((a, b) => b.roi - a.roi)

      // Assign ranks
      validCappers.forEach((capper, index) => {
        capper.rank = index + 1
      })

      console.log('[Dashboard] Final top cappers:', validCappers)
      setTopCappers(validCappers)
    } catch (error) {
      console.error('[Dashboard] Error fetching top cappers:', error)
      setTopCappers([]) // Clear on error
    }
  }

  const calculateChartData = (picks: Pick[]) => {
    // Group picks by date and calculate cumulative units
    const dateMap = new Map<string, { units: number, wins: number, losses: number }>()

    picks.forEach(pick => {
      if (pick.status === 'won' || pick.status === 'lost') {
        const date = new Date(pick.created_at).toISOString().split('T')[0]
        const existing = dateMap.get(date) || { units: 0, wins: 0, losses: 0 }
        existing.units += pick.net_units || 0
        if (pick.status === 'won') existing.wins++
        if (pick.status === 'lost') existing.losses++
        dateMap.set(date, existing)
      }
    })

    // Convert to array and sort by date
    const sortedDates = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))

    // Calculate cumulative units
    let cumulative = 0
    const data: ChartDataPoint[] = sortedDates.map(([date, stats]) => {
      cumulative += stats.units
      return {
        date,
        cumulative_units: cumulative,
        daily_units: stats.units,
        wins: stats.wins,
        losses: stats.losses
      }
    })

    setChartData(data)
  }

  const getGameStatus = (pick: Pick) => {
    const gameStatus = pick.games?.status
    if (gameStatus === 'Final' || gameStatus === 'Completed') {
      return { text: 'FINAL', color: 'bg-slate-600 text-slate-300', icon: '✓' }
    }
    if (gameStatus === 'InProgress' || gameStatus === 'Live') {
      return { text: 'LIVE', color: 'bg-red-600 text-white animate-pulse', icon: '●' }
    }
    if (gameStatus === 'Scheduled' || gameStatus === 'Pending') {
      return { text: 'SCHEDULED', color: 'bg-blue-600/80 text-blue-200', icon: '○' }
    }
    return { text: 'PENDING', color: 'bg-slate-700 text-slate-400', icon: '○' }
  }

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return { text: 'N/A', color: 'bg-slate-600' }
    if (confidence >= 80) return { text: 'ELITE', color: 'bg-emerald-600' }
    if (confidence >= 70) return { text: 'HIGH', color: 'bg-blue-600' }
    if (confidence >= 60) return { text: 'GOOD', color: 'bg-slate-600' }
    return { text: 'FAIR', color: 'bg-slate-500' }
  }

  const getCapperBadge = (capper: string) => {
    const capperUpper = capper?.toUpperCase() || 'DEEPPICK'

    // Different gradient for each capper
    if (capperUpper === 'SHIVA') {
      return {
        gradient: 'bg-gradient-to-r from-purple-900 to-pink-900',
        text: 'text-purple-200'
      }
    } else if (capperUpper === 'IFRIT') {
      return {
        gradient: 'bg-gradient-to-r from-orange-900 to-red-900',
        text: 'text-orange-200'
      }
    } else {
      // Default for other cappers
      return {
        gradient: 'bg-gradient-to-r from-blue-900 to-cyan-900',
        text: 'text-blue-200'
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Activity className="h-12 w-12 text-blue-500 animate-pulse mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="px-4 py-4 max-w-[1800px] mx-auto">

        {/* PERFORMANCE STATS BAR - COMPACT */}
        {performance && (
          <div className="mb-4 grid grid-cols-5 gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Total Picks</div>
              <div className="text-lg font-bold text-white">{performance.total_picks}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Win Rate</div>
              <div className="text-lg font-bold text-emerald-400">{performance.win_rate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">W / L</div>
              <div className="text-lg font-bold text-white">{performance.wins} / {performance.losses}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">ROI</div>
              <div className={`text-lg font-bold ${performance.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.roi >= 0 ? '+' : ''}{performance.roi?.toFixed(1) || '0.0'}%
              </div>
            </div>
            <div className="bg-slate-900/50 border border-emerald-900/20 rounded-lg px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Net Units</div>
              <div className={`text-lg font-bold ${performance.net_units >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.net_units >= 0 ? '+' : ''}{performance.net_units.toFixed(1)}u
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT - FIXED HEIGHT DASHBOARD */}
        <div className="grid grid-cols-12 gap-3 mb-3">

          {/* LEFT COLUMN - TODAY'S PICKS (60%) */}
          <div className="col-span-7">
            {/* Today's Elite Picks - Fixed Height to match right column */}
            <Card className="bg-slate-900/50 border-slate-800 h-[550px] flex flex-col">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-white">Today's Elite Picks</CardTitle>
                  <Tabs value={sportFilter} onValueChange={setSportFilter}>
                    <TabsList className="bg-slate-800/50 border border-slate-700 h-7">
                      <TabsTrigger value="all" className="text-[11px] px-2 py-0.5">All</TabsTrigger>
                      <TabsTrigger value="nba" className="text-[11px] px-2 py-0.5">NBA</TabsTrigger>
                      <TabsTrigger value="nfl" className="text-[11px] px-2 py-0.5">NFL</TabsTrigger>
                      <TabsTrigger value="mlb" className="text-[11px] px-2 py-0.5">MLB</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>

              <CardContent className="px-3 py-2 space-y-2 flex-1 overflow-y-auto">
                {todaysPicks.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400 font-medium">No picks available</p>
                      <p className="text-xs text-slate-600 mt-1">Check back later for today's elite picks</p>
                    </div>
                  </div>
                ) : todaysPicks.slice(0, 5).map((pick, index) => {
                  const confidenceBadge = getConfidenceBadge(pick.confidence)
                  const gameStatus = getGameStatus(pick)
                  const homeTeam = pick.game_snapshot?.home_team
                  const awayTeam = pick.game_snapshot?.away_team
                  const matchup = `${awayTeam?.name || 'Away'} @ ${homeTeam?.name || 'Home'}`
                  const boldPredictionsKey = `${matchup}_${pick.capper}`
                  const boldPredictions = boldPredictionsMap.get(boldPredictionsKey)
                  const isExpanded = expandedPicks.has(pick.id)
                  const hasPredictions = boldPredictions && boldPredictions.predictions && boldPredictions.predictions.length > 0
                  const isLocked = !user && index >= 2 // Lock picks 3+ for non-authenticated users

                  return (
                    <div
                      key={pick.id}
                      className={`relative rounded-lg transition-all ${isLocked
                        ? 'bg-slate-900/80 border border-slate-700/50'
                        : 'bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-purple-500/10 border border-cyan-500/40 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10'
                        }`}
                    >
                      {/* Locked Overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 z-10 bg-slate-900/95 backdrop-blur-sm rounded-lg flex items-center justify-center gap-3">
                          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 p-2 rounded-full border border-cyan-500/30">
                            <Lock className="h-5 w-5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Premium Pick</p>
                            <Link href="/signup" className="text-xs text-cyan-400 hover:text-cyan-300 underline">
                              Sign up to unlock
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Main Pick Card - Clickable */}
                      <div
                        className={`cursor-pointer group p-3 ${isLocked ? 'blur-sm' : ''}`}
                        onClick={() => {
                          if (!isLocked) {
                            setSelectedPick(pick)
                            setShowInsight(true)
                          }
                        }}
                      >
                        {/* Single Row Layout - Everything Horizontal */}
                        <div className="flex items-center gap-3">
                          {/* Left: Capper Badge */}
                          {(() => {
                            const capperBadge = getCapperBadge(pick.capper || 'DeepPick')
                            return (
                              <div className={`px-3 py-1.5 rounded-md text-xs font-black ${capperBadge.gradient} ${capperBadge.text} uppercase tracking-wider shadow-md flex-shrink-0`}>
                                {pick.capper || 'DeepPick'}
                              </div>
                            )
                          })()}

                          {/* Center: The Pick (Main Focus) */}
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-black text-white group-hover:text-cyan-400 transition-colors truncate">
                              {pick.selection}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-medium">{matchup}</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-600 h-4">
                                {pick.pick_type?.toUpperCase()}
                              </Badge>
                            </div>
                          </div>

                          {/* Right: Confidence & Units */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={`${confidenceBadge.color} text-white text-xs px-2 py-1 font-bold shadow-md`}>
                              {pick.confidence?.toFixed(1)}
                            </Badge>
                            <div className="text-xl font-black bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                              {pick.units}U
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                          </div>
                        </div>
                      </div>

                      {/* Bold Predictions Toggle Button */}
                      {hasPredictions && !isLocked && (
                        <div className="border-t border-slate-700/50 px-3 py-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePickExpansion(pick.id)
                            }}
                            className="w-full flex items-center justify-between text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <span className="flex items-center gap-1">
                              <span className="font-semibold">🎯 Bold Player Predictions</span>
                              <span className="text-slate-500">({boldPredictions.predictions.length})</span>
                            </span>
                            <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
                          </button>
                        </div>
                      )}

                      {/* Expanded Bold Predictions */}
                      {isExpanded && hasPredictions && !isLocked && (
                        <div className="px-3 pb-2 space-y-2">
                          {/* Summary */}
                          {boldPredictions.summary && (
                            <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded p-2">
                              <div className="text-[9px] font-bold text-purple-400 uppercase mb-1">
                                📊 Summary
                              </div>
                              <div className="text-[10px] text-slate-300 leading-relaxed">
                                {boldPredictions.summary}
                              </div>
                            </div>
                          )}

                          {/* Predictions */}
                          <div className="space-y-1.5">
                            {boldPredictions.predictions.map((pred: any, idx: number) => (
                              <div key={idx} className="bg-slate-900/50 border border-slate-700/50 rounded p-2">
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex-1">
                                    <div className="text-[10px] font-bold text-white">
                                      {pred.player}
                                    </div>
                                    <div className="text-[9px] text-slate-400">
                                      {pred.team}
                                    </div>
                                  </div>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${pred.confidence === 'HIGH' ? 'bg-emerald-900/50 text-emerald-400' :
                                    pred.confidence === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400' :
                                      'bg-slate-700/50 text-slate-400'
                                    }`}>
                                    {pred.confidence}
                                  </span>
                                </div>
                                <div className="text-[10px] text-cyan-400 font-semibold mb-1">
                                  {pred.prediction}
                                </div>
                                <div className="text-[9px] text-slate-400 leading-relaxed">
                                  {pred.reasoning}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Pagination Controls */}
                {todaysPicks.length > 5 && (
                  <Link href="/picks">
                    <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
                      View All {todaysPicks.length} Picks →
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - LEADERBOARD + PERFORMANCE TREND (40%) */}
          <div className="col-span-5 space-y-3">

            {/* LEADERBOARD - Fixed Height */}
            <Card className="bg-slate-900/50 border-slate-800 h-[310px] flex flex-col">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    Top Cappers
                  </CardTitle>
                  <Link href="/leaderboard">
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2 text-slate-400 hover:text-white">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="px-3 py-2 space-y-1.5 flex-1 overflow-y-auto">
                {/* Column Headers */}
                <div className="flex items-center gap-2 px-2 pb-1 border-b border-slate-800/50">
                  <div className="flex-shrink-0 w-6 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    #
                  </div>
                  <div className="flex-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Capper
                  </div>
                  <div className="text-right flex-shrink-0 w-16 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    ROI
                  </div>
                  <div className="text-right flex-shrink-0 w-12 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                    Units
                  </div>
                </div>

                {topCappers.map((capper, index) => {
                  const isTop3 = index < 3
                  const rankColors = {
                    0: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
                    1: 'from-slate-400/20 to-slate-500/5 border-slate-400/30',
                    2: 'from-orange-600/20 to-orange-700/5 border-orange-600/30'
                  }
                  const medalEmojis = ['🥇', '🥈', '🥉']
                  const rankBgColors = {
                    0: 'bg-gradient-to-br from-amber-500 to-amber-600',
                    1: 'bg-gradient-to-br from-slate-400 to-slate-500',
                    2: 'bg-gradient-to-br from-orange-600 to-orange-700'
                  }

                  return (
                    <div
                      key={capper.id}
                      className={`
                        group relative flex items-center gap-2 px-2 py-2 rounded
                        border transition-all duration-200
                        ${isTop3
                          ? `bg-gradient-to-r ${rankColors[index as 0 | 1 | 2]} hover:border-opacity-60`
                          : 'bg-slate-800/20 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/30'
                        }
                      `}
                    >
                      {/* Rank Badge */}
                      <div className={`
                        flex-shrink-0 w-6 h-6 rounded flex items-center justify-center
                        text-[10px] font-bold text-white shadow-sm
                        ${isTop3 ? rankBgColors[index as 0 | 1 | 2] : 'bg-slate-700'}
                      `}>
                        {isTop3 ? medalEmojis[index] : `#${capper.rank}`}
                      </div>

                      {/* Capper Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs font-semibold truncate ${isTop3 ? 'text-white' : 'text-slate-200'}`}>
                            {capper.name}
                          </span>
                          {capper.streak > 0 && (
                            <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-0.5">
                              🔥<span className="font-mono">{capper.streak}W</span>
                            </span>
                          )}
                          {capper.is_hot && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                              HOT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-mono font-medium">
                            {capper.win_rate.toFixed(1)}%
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">{capper.total_picks} picks</span>
                        </div>
                      </div>

                      {/* ROI */}
                      <div className="text-right flex-shrink-0 w-16">
                        <div className={`
                          text-xs font-bold font-mono
                          ${capper.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}
                        `}>
                          {capper.roi >= 0 ? '+' : ''}{capper.roi.toFixed(1)}%
                        </div>
                      </div>

                      {/* Units */}
                      <div className="text-right flex-shrink-0 w-12">
                        <div className={`
                          text-[11px] font-semibold font-mono
                          ${capper.total_units >= 0 ? 'text-emerald-500' : 'text-red-500'}
                        `}>
                          {capper.total_units >= 0 ? '+' : ''}{capper.total_units.toFixed(1)}u
                        </div>
                      </div>

                      {/* Hover Tooltip - Additional Stats */}
                      <div className="
                        absolute left-0 right-0 top-full mt-1 z-10
                        opacity-0 group-hover:opacity-100 pointer-events-none
                        transition-opacity duration-200
                      ">
                        <div className="bg-slate-950 border border-slate-700 rounded shadow-xl p-2 text-[10px]">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <div className="text-slate-500 uppercase tracking-wider mb-0.5">Wins</div>
                              <div className="text-emerald-400 font-semibold font-mono">
                                {Math.round(capper.total_picks * capper.win_rate / 100)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 uppercase tracking-wider mb-0.5">Losses</div>
                              <div className="text-red-400 font-semibold font-mono">
                                {capper.total_picks - Math.round(capper.total_picks * capper.win_rate / 100)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 uppercase tracking-wider mb-0.5">Badge</div>
                              <div className="text-amber-400 font-semibold capitalize">
                                {capper.badge}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <Link href="/upgrade">
                  <Button className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white text-xs h-8 border border-slate-700 transition-all hover:border-slate-600">
                    Upgrade to Capper
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* PERFORMANCE TREND GRAPH - Fixed Height */}
            <Card className="bg-slate-900/50 border-slate-800 h-[227px] flex flex-col">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Performance Trend
                </CardTitle>
              </CardHeader>

              <CardContent className="px-3 py-2 flex-1">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-[11px] text-slate-500">No performance data yet</p>
                      <p className="text-[9px] text-slate-600 mt-1">Check console for debug info</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 5, left: -20, bottom: 5 }}
                      >
                        <defs>
                          {/* Gradient for positive trend */}
                          <linearGradient id="lineGradientPos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                          </linearGradient>
                          {/* Gradient for negative trend */}
                          <linearGradient id="lineGradientNeg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.05} />
                            <stop offset="100%" stopColor="#EF4444" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>

                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          stroke="#334155"
                          interval="preserveStartEnd"
                        />

                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          stroke="#334155"
                          tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}u`}
                        />

                        {/* Zero baseline */}
                        <ReferenceLine
                          y={0}
                          stroke="#475569"
                          strokeDasharray="3 3"
                          strokeWidth={1}
                        />

                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            fontSize: '11px',
                            padding: '6px 8px'
                          }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                          itemStyle={{ color: '#fff', fontSize: '11px' }}
                          formatter={(value: number, name: string) => {
                            if (name === 'cumulative_units') {
                              return [`${value >= 0 ? '+' : ''}${value.toFixed(1)}u`, 'Net Units']
                            }
                            return [value, name]
                          }}
                          labelFormatter={(label) => {
                            const date = new Date(label)
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="cumulative_units"
                          stroke={(chartData[chartData.length - 1]?.cumulative_units || 0) >= 0 ? '#10B981' : '#EF4444'}
                          strokeWidth={2}
                          dot={{
                            fill: (chartData[chartData.length - 1]?.cumulative_units || 0) >= 0 ? '#10B981' : '#EF4444',
                            strokeWidth: 0,
                            r: 2
                          }}
                          activeDot={{
                            fill: (chartData[chartData.length - 1]?.cumulative_units || 0) >= 0 ? '#10B981' : '#EF4444',
                            strokeWidth: 2,
                            stroke: '#1e293b',
                            r: 4
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* PICK HISTORY - FULL WIDTH AT BOTTOM */}
        <Card className="bg-slate-900/50 border-slate-800 h-[250px] flex flex-col">
          <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                Pick History
              </CardTitle>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2 text-slate-400 hover:text-white">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="px-3 py-2 flex-1 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No pick history yet</p>
                  <p className="text-xs text-slate-600 mt-1">Your completed picks will appear here</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {recentActivity.map((pick) => {
                  const isWin = pick.status === 'won'
                  const isLoss = pick.status === 'lost'
                  const isPending = pick.status === 'pending'
                  const netUnits = pick.net_units || 0
                  const homeTeam = pick.game_snapshot?.home_team
                  const awayTeam = pick.game_snapshot?.away_team

                  return (
                    <div
                      key={pick.id}
                      className={`px-2.5 py-2 rounded-lg border transition-all cursor-pointer hover:border-slate-600 ${isWin ? 'bg-emerald-500/5 border-emerald-500/20' :
                        isLoss ? 'bg-red-500/5 border-red-500/20' :
                          'bg-slate-800/20 border-slate-700/30'
                        }`}
                      onClick={() => {
                        setSelectedPick(pick)
                        setShowInsight(true)
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {isWin ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle className="h-3 w-3 text-emerald-400" />
                            </div>
                          ) : isLoss ? (
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                              <XCircle className="h-3 w-3 text-red-400" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-500/20 flex items-center justify-center">
                              <Clock className="h-3 w-3 text-slate-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] font-semibold text-white truncate">
                              {pick.selection}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-600">
                              {pick.pick_type?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-slate-500 mb-1">
                            {awayTeam?.name || 'Away'} @ {homeTeam?.name || 'Home'}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Capper Badge */}
                            {(() => {
                              const capperBadge = getCapperBadge(pick.capper || 'DeepPick')
                              return (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${capperBadge.gradient} ${capperBadge.text} uppercase tracking-wide`}>
                                  {pick.capper || 'DeepPick'}
                                </span>
                              )
                            })()}
                            <span className="text-[10px] text-slate-500">{pick.units}U</span>
                            {pick.confidence && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-[10px] text-slate-500">{pick.confidence.toFixed(1)}/10</span>
                              </>
                            )}
                            <span className="text-slate-600">•</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(pick.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {isWin && (
                            <div className="text-xs font-bold text-emerald-400">
                              +{netUnits.toFixed(1)}u
                            </div>
                          )}
                          {isLoss && (
                            <div className="text-xs font-bold text-red-400">
                              {netUnits.toFixed(1)}u
                            </div>
                          )}
                          {isPending && (
                            <div className="text-[10px] text-slate-500">
                              Pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insight Modal */}
      {showInsight && selectedPick && (
        <PickInsightModal
          pickId={selectedPick.id}
          onClose={() => {
            setShowInsight(false)
            setSelectedPick(null)
          }}
        />
      )}
    </div>
  )
}

