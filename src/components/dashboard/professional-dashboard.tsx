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
import { NavBar } from '@/components/navigation/nav-bar'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

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
  const [todaysPicks, setTodaysPicks] = useState<Pick[]>([])
  const [topCappers, setTopCappers] = useState<Capper[]>([])
  const [recentActivity, setRecentActivity] = useState<Pick[]>([])
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null)
  const [showInsight, setShowInsight] = useState(false)
  const [sportFilter, setSportFilter] = useState('all')

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
        // Calculate chart data from activity
        calculateChartData(activityData.data)
      }
      if (perfData.success) setPerformance(perfData.data.metrics)

      // Mock capper data
      setTopCappers([
        { id: 'shiva', name: 'SHIVA', avatar: '🔱', rank: 1, roi: 24.5, win_rate: 68.2, total_units: 127.5, streak: 7, total_picks: 156, badge: 'diamond', is_hot: true },
        { id: 'deeppick', name: 'DeepPick', avatar: '🎯', rank: 2, roi: 18.3, win_rate: 64.1, total_units: 89.2, streak: 3, total_picks: 203, badge: 'platinum', is_hot: true },
        { id: 'nexus', name: 'Nexus', avatar: '⚡', rank: 3, roi: 15.7, win_rate: 61.5, total_units: 72.8, streak: -2, total_picks: 178, badge: 'gold', is_hot: false }
      ])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <NavBar />
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
      <NavBar />

      <div className="container mx-auto px-4 py-3 max-w-[1800px]">

        {/* PERFORMANCE STATS BAR - COMPACT */}
        {performance && (
          <div className="mb-3 grid grid-cols-5 gap-2">
            <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-1.5">
              <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">Total Picks</div>
              <div className="text-base font-semibold text-white">{performance.total_picks}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-1.5">
              <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">Win Rate</div>
              <div className="text-base font-semibold text-emerald-400">{performance.win_rate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-1.5">
              <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">W / L</div>
              <div className="text-base font-semibold text-white">{performance.wins} / {performance.losses}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-1.5">
              <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">ROI</div>
              <div className={`text-base font-semibold ${performance.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.roi >= 0 ? '+' : ''}{performance.roi?.toFixed(1) || '0.0'}%
              </div>
            </div>
            <div className="bg-slate-900/50 border border-emerald-900/20 rounded px-3 py-1.5">
              <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">Net Units</div>
              <div className={`text-base font-semibold ${performance.net_units >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.net_units >= 0 ? '+' : ''}{performance.net_units.toFixed(1)}u
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT - THREE COLUMN LAYOUT */}
        <div className="grid grid-cols-12 gap-3">

          {/* LEFT COLUMN - TODAY'S PICKS (55%) */}
          <div className="col-span-7">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800">
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

              <CardContent className="px-3 py-2 space-y-1.5">
                {todaysPicks.slice(0, 12).map((pick) => {
                  const confidenceBadge = getConfidenceBadge(pick.confidence)
                  const gameStatus = getGameStatus(pick)
                  const homeTeam = pick.game_snapshot?.home_team
                  const awayTeam = pick.game_snapshot?.away_team

                  return (
                    <div
                      key={pick.id}
                      className="bg-slate-800/30 border border-slate-700/50 hover:border-blue-500/50 rounded px-2.5 py-2 cursor-pointer transition-all group"
                      onClick={() => {
                        setSelectedPick(pick)
                        setShowInsight(true)
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Badge className={`${confidenceBadge.color} text-white text-[10px] px-1.5 py-0`}>
                            {pick.confidence?.toFixed(0)}%
                          </Badge>
                          <Badge className={`${gameStatus.color} text-[9px] px-1.5 py-0 font-semibold`}>
                            {gameStatus.icon} {gameStatus.text}
                          </Badge>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">{pick.capper || 'DeepPick'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600">
                            {pick.pick_type?.toUpperCase()}
                          </Badge>
                          <div className="text-xs font-semibold text-emerald-400">
                            {pick.units}u
                          </div>
                        </div>
                      </div>

                      <div className="mb-1">
                        <div className="text-[11px] text-slate-500 mb-0.5">
                          {awayTeam?.name || 'Away'} @ {homeTeam?.name || 'Home'}
                        </div>
                        <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {pick.selection}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(pick.game_snapshot?.game_date || pick.created_at).toLocaleDateString()}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  )
                })}

                <Link href="/picks">
                  <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
                    View All Active Picks
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - LEADERBOARD + LIVE FEED (45%) */}
          <div className="col-span-5 space-y-3">

            {/* LEADERBOARD - ENHANCED BLOOMBERG STYLE */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800">
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

              <CardContent className="px-3 py-2 space-y-1.5">
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

                <Link href="/become-capper">
                  <Button className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white text-xs h-8 border border-slate-700 transition-all hover:border-slate-600">
                    Become a Capper
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* PERFORMANCE TREND GRAPH - COMPACT */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Performance Trend
                </CardTitle>
              </CardHeader>

              <CardContent className="px-3 py-2">
                {chartData.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <p className="text-[11px] text-slate-500">No performance data yet</p>
                  </div>
                ) : (
                  <div className="h-[200px]">
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
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
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

            {/* PICK HISTORY - DETAILED */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                    Pick History
                  </CardTitle>
                  <Link href="/pick-history">
                    <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2 text-slate-400 hover:text-white">
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="px-3 py-2 space-y-1 max-h-[500px] overflow-y-auto">
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
                      className={`px-2 py-1.5 rounded border transition-all cursor-pointer hover:border-slate-600 ${isWin ? 'bg-emerald-500/5 border-emerald-500/20' :
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
                          <div className="text-[10px] text-slate-500 mb-0.5">
                            {awayTeam?.name || 'Away'} @ {homeTeam?.name || 'Home'}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>{pick.capper || 'DeepPick'}</span>
                            <span>•</span>
                            <span>{pick.units}u</span>
                            {pick.confidence && (
                              <>
                                <span>•</span>
                                <span>{pick.confidence.toFixed(0)}%</span>
                              </>
                            )}
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
                          <div className="text-[9px] text-slate-600 mt-0.5">
                            {new Date(pick.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
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

