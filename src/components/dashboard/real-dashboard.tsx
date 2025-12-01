'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { TrendingUp, Activity, Lightbulb, AlertTriangle, Zap, BarChart, Rocket, MessageCircle, CheckCircle, XCircle, PlayCircle, Clock, BarChart3, Archive, Brain, X, Target, TrendingDown, Trophy } from 'lucide-react'
import { NavBar } from '@/components/navigation/nav-bar'
import Link from 'next/link'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { PickHistoryGrid } from '@/components/dashboard/pick-history-grid'

interface PredictionLog {
  timestamp: string
  capper: string
  game: string
  steps: Array<{
    step: number
    title: string
    description: string
    calculation?: string
    result: string
    impact: 'positive' | 'negative' | 'neutral'
  }>
  finalPrediction: {
    homeScore: number
    awayScore: number
    total: number
    margin: number
    winner: string
  }
  vegasComparison: {
    totalLine: number | null
    spreadLine: number | null
    totalGap: number | null
    spreadGap: number | null
  }
  confidenceBreakdown: {
    totalConfidence: number | null
    spreadConfidence: number | null
    moneylineConfidence: number | null
    selectedBet: string
    finalConfidence: number
  }
  decisionFactors: {
    passedFavoriteRule: boolean
    passedMinConfidence: boolean
    bestOddsAvailable: number
    unitsAllocated: number
  }
}

interface Pick {
  id: string
  selection: string
  created_at: string
  units: number
  status: string
  pick_type: string
  reasoning?: string
  net_units?: number
  capper?: string
  confidence?: number
  result?: {
    prediction_log?: PredictionLog
    final_score?: {
      home: number
      away: number
      winner?: string
    }
    outcome?: string
    notes?: string
  }
  game_snapshot?: {
    sport: string
    league: string
    home_team: any
    away_team: any
    game_date: string
    game_time: string
    game_start_timestamp?: string // Full UTC timestamp (ISO-8601)
  }
  games?: {
    status: string
    final_score?: {
      home: number
      away: number
      winner?: string
    }
  }
}

interface PerformanceData {
  metrics: {
    total_picks: number
    wins: number
    losses: number
    pushes: number
    win_rate: number
    net_units: number
    roi: number
  }
  chartData: Array<{
    date: string
    profit: number
    cumulative_profit: number
  }>
}

const CAPPERS = [
  { id: 'all', name: 'All Cappers', color: 'from-neon-blue via-neon-purple to-neon-green', path: null },
  { id: 'deeppick', name: 'DeepPick', color: 'from-neon-blue to-neon-cyan', path: '/cappers/deeppick' },
  { id: 'nexus', name: 'Nexus', color: 'from-purple-500 to-pink-500', path: '/cappers/nexus' },
  { id: 'shiva', name: 'SHIVA', color: 'from-blue-500 to-cyan-500', path: '/cappers/shiva' },
  { id: 'cerberus', name: 'Cerberus', color: 'from-red-500 to-orange-500', path: '/cappers/cerberus' },
  { id: 'ifrit', name: 'IFRIT', color: 'from-yellow-500 to-red-500', path: '/cappers/ifrit' },
  { id: 'titan', name: 'TITAN', color: 'from-slate-400 to-slate-600', path: null },
  { id: 'thief', name: 'THIEF', color: 'from-emerald-500 to-teal-500', path: null },
  { id: 'sentinel', name: 'SENTINEL', color: 'from-indigo-500 to-purple-500', path: null },
  { id: 'picksmith', name: 'PICKSMITH', color: 'from-amber-400 to-yellow-500', path: null },
]

export function RealDashboard() {
  const [picks, setPicks] = useState<Pick[]>([])
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('all')
  const [selectedCapper, setSelectedCapper] = useState('all')
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)

  useEffect(() => {
    fetchData()
  }, [timeFilter, selectedCapper])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch picks with capper filter
      const capperParam = selectedCapper !== 'all' ? `&capper=${selectedCapper}` : ''

      // Fetch current picks (pending/live)
      const picksResponse = await fetch(`/api/picks?status=pending${capperParam}`)
      const picksData = await picksResponse.json()

      if (picksData.success) {
        setPicks(picksData.data)
      }

      // Fetch performance data with capper filter
      const performanceResponse = await fetch(`/api/performance?period=${timeFilter}${capperParam}`)
      const performanceData = await performanceResponse.json()

      if (performanceData.success) {
        setPerformance(performanceData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won': return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'lost': return <XCircle className="h-4 w-4 text-red-400" />
      case 'active': return <PlayCircle className="h-4 w-4 text-yellow-400" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getOutcomeText = (pick: Pick) => {
    if (pick.status === 'won') {
      const netUnits = pick.net_units || 0
      return `✅ +${netUnits.toFixed(2)}u`
    } else if (pick.status === 'lost') {
      const netUnits = pick.net_units || 0
      return `❌ ${netUnits.toFixed(2)}u`
    } else if (pick.status === 'push') {
      return `🟡 Push (0u)`
    }
    return '⏳ Pending'
  }

  const getInsightIcon = (pick: Pick) => {
    if (pick.status === 'won') return Lightbulb
    if (pick.status === 'lost') return AlertTriangle
    return BarChart
  }

  const getGameStatusDisplay = (pick: Pick) => {
    // Check if game still exists in games table (not archived)
    const gameStatus = pick.games?.status
    const finalScore = pick.games?.final_score
    const homeTeam = pick.game_snapshot?.home_team
    const awayTeam = pick.game_snapshot?.away_team

    // If game is archived (games is null), check pick status
    if (!pick.games) {
      // Game was archived, show based on pick status
      if (pick.status === 'won' || pick.status === 'lost' || pick.status === 'push') {
        return (
          <div className="space-y-1">
            <Badge className="bg-gray-600 text-white">
              COMPLETED
            </Badge>
            <div className="text-xs text-gray-400 mt-1">
              Game archived
            </div>
          </div>
        )
      }
      return (
        <Badge variant="secondary">
          Scheduled
        </Badge>
      )
    }

    if (gameStatus === 'live') {
      return (
        <div className="space-y-1">
          <Badge className="bg-red-500 text-white animate-pulse">
            🔴 LIVE
          </Badge>
          {finalScore && (
            <div className="text-xs text-gray-300 mt-1">
              <div>{awayTeam?.abbreviation || 'Away'}: {finalScore.away || 0}</div>
              <div>{homeTeam?.abbreviation || 'Home'}: {finalScore.home || 0}</div>
            </div>
          )}
        </div>
      )
    }

    if (gameStatus === 'final' && finalScore) {
      return (
        <div className="space-y-1">
          <Badge className="bg-gray-500 text-white">
            FINAL
          </Badge>
          <div className="text-xs text-gray-300 mt-1">
            <div className={finalScore.winner === 'away' ? 'font-bold text-green-400' : ''}>
              {awayTeam?.abbreviation || 'Away'}: {finalScore.away || 0}
            </div>
            <div className={finalScore.winner === 'home' ? 'font-bold text-green-400' : ''}>
              {homeTeam?.abbreviation || 'Home'}: {finalScore.home || 0}
            </div>
          </div>
        </div>
      )
    }

    return (
      <Badge variant="secondary">
        Scheduled
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="p-6 space-y-8 bg-gradient-to-br from-gray-900 via-black to-gray-950 text-white min-h-screen font-mono">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-green-400 tracking-wider">DEEP PICKS</h1>
        <NavBar />
      </header>

      {/* Capper Selector */}
      <section className="glass-effect p-4 rounded-lg shadow-lg border border-gray-800">
        <div className="space-y-4">
          <div>
            <span className="text-sm font-semibold text-gray-400">SELECT CAPPER:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {CAPPERS.map((capper) => (
                <Button
                  key={capper.id}
                  onClick={() => setSelectedCapper(capper.id)}
                  variant={selectedCapper === capper.id ? 'default' : 'outline'}
                  className={`${selectedCapper === capper.id
                    ? `bg-gradient-to-r ${capper.color} text-white font-bold`
                    : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                >
                  {capper.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-700 pt-3">
            <span className="text-sm font-semibold text-gray-400">ALGORITHM PAGES:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {CAPPERS.filter(c => c.path).map((capper) => (
                <Link
                  key={capper.id}
                  href={capper.path!}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-neon-blue/50 bg-neon-blue/10 hover:bg-neon-blue/20 hover:border-neon-blue transition-all text-sm text-neon-blue font-semibold"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>{capper.name} Algorithm</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Summary Graph Section */}
      <section className="glass-effect p-6 rounded-lg shadow-lg border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-200">
            Performance Overview {selectedCapper !== 'all' && `- ${CAPPERS.find(c => c.id === selectedCapper)?.name}`}
          </h2>
          <Tabs value={timeFilter} onValueChange={setTimeFilter}>
            <TabsList className="bg-gray-800 border border-gray-700">
              <TabsTrigger value="week" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-300">Week</TabsTrigger>
              <TabsTrigger value="month" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-300">Month</TabsTrigger>
              <TabsTrigger value="year" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-300">Year</TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-300">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="col-span-2 bg-gray-800 border border-green-500 shadow-green-glow">
            <CardHeader>
              <CardTitle className="text-xl text-green-400">Profit Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                try {
                  console.log('📊 CHART DEBUG:', {
                    hasPerformance: !!performance,
                    hasChartData: !!performance?.chartData,
                    chartDataLength: performance?.chartData?.length,
                    chartData: performance?.chartData,
                    firstDataPoint: performance?.chartData?.[0],
                    performanceKeys: performance ? Object.keys(performance) : 'undefined',
                    chartDataType: typeof performance?.chartData,
                    chartDataIsArray: Array.isArray(performance?.chartData)
                  })

                  // Test all potential length accesses
                  console.log('🔍 LENGTH TESTS:', {
                    'performance?.chartData?.length': performance?.chartData?.length,
                    'picks.length': picks?.length,
                    'performance?.metrics': performance?.metrics,
                    'performance?.metrics?.net_units': performance?.metrics?.net_units
                  })
                } catch (error) {
                  console.error('🚨 CHART DEBUG ERROR:', error)
                }
                return null
              })()}
              {!performance?.chartData || performance?.chartData?.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <p className="text-lg mb-2">No data yet</p>
                    <p className="text-sm">Place some picks to see your profit over time</p>
                  </div>
                </div>
              ) : performance?.chartData?.length === 1 ? (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-2">
                      {new Date(performance?.chartData?.[0]?.date || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className={`text-4xl font-bold ${(performance?.chartData?.[0]?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${(performance?.chartData?.[0]?.profit || 0).toFixed(2)}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">Current Profit</p>
                    <p className="text-gray-600 text-xs mt-4">Chart will show when you have multiple days of picks</p>
                  </div>
                </div>
              ) : (
                <div className="h-[280px]">
                  {(() => {
                    try {
                      const chartData = performance?.chartData?.filter(item => item && typeof item === 'object' && item.date && typeof item.cumulative_profit === 'number') || []
                      const isPositive = (performance?.metrics?.net_units || 0) >= 0

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={chartData}
                            margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
                          >
                            <defs>
                              {/* Glow effect for the line */}
                              <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                  <feMergeNode in="coloredBlur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>

                              {/* Gradient for positive line */}
                              <linearGradient id="lineGradientPositive" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#10B981" />
                                <stop offset="100%" stopColor="#34D399" />
                              </linearGradient>

                              {/* Gradient for negative line */}
                              <linearGradient id="lineGradientNegative" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#EF4444" />
                                <stop offset="100%" stopColor="#F87171" />
                              </linearGradient>
                            </defs>

                            {/* Subtle grid */}
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#374151"
                              strokeOpacity={0.3}
                              vertical={false}
                            />

                            <XAxis
                              dataKey="date"
                              stroke="#6B7280"
                              tick={{ fill: '#9CA3AF', fontSize: 11 }}
                              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              axisLine={{ stroke: '#4B5563' }}
                              tickLine={false}
                            />

                            <YAxis
                              stroke="#6B7280"
                              tick={{ fill: '#9CA3AF', fontSize: 11 }}
                              tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}u`}
                              axisLine={{ stroke: '#4B5563' }}
                              tickLine={false}
                            />

                            {/* Zero reference line */}
                            <ReferenceLine
                              y={0}
                              stroke="#6B7280"
                              strokeDasharray="5 5"
                              strokeWidth={1.5}
                              strokeOpacity={0.5}
                            />

                            <Tooltip
                              cursor={{ stroke: isPositive ? '#10B981' : '#EF4444', strokeWidth: 1, strokeDasharray: '5 5' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length > 0) {
                                  const data = payload[0].payload
                                  const cumulativeProfit = data.cumulative_profit || 0
                                  const dailyProfit = data.profit || 0
                                  const wins = data.wins || 0
                                  const losses = data.losses || 0
                                  const pushes = data.pushes || 0
                                  const winRate = data.win_rate || 0
                                  const profitColor = cumulativeProfit >= 0 ? '#10B981' : '#EF4444'
                                  const dailyColor = dailyProfit >= 0 ? '#10B981' : '#EF4444'

                                  return (
                                    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl">
                                      <p className="text-gray-200 font-semibold text-sm mb-2">
                                        {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </p>

                                      <div className="space-y-1.5 mb-2">
                                        <div className="flex items-center justify-between gap-4">
                                          <span className="text-gray-400 text-xs">Total:</span>
                                          <span className="font-bold text-base" style={{ color: profitColor }}>
                                            {cumulativeProfit >= 0 ? '+' : ''}{cumulativeProfit.toFixed(2)}u
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                          <span className="text-gray-400 text-xs">Daily:</span>
                                          <span className="font-semibold text-sm" style={{ color: dailyColor }}>
                                            {dailyProfit >= 0 ? '+' : ''}{dailyProfit.toFixed(2)}u
                                          </span>
                                        </div>
                                      </div>

                                      <div className="border-t border-gray-700 pt-2 space-y-1">
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                          <span className="text-gray-400">Record:</span>
                                          <span>
                                            <span className="text-green-400 font-semibold">{wins}W</span>
                                            <span className="text-gray-500 mx-1">-</span>
                                            <span className="text-red-400 font-semibold">{losses}L</span>
                                            {pushes > 0 && (
                                              <>
                                                <span className="text-gray-500 mx-1">-</span>
                                                <span className="text-gray-400 font-semibold">{pushes}P</span>
                                              </>
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                          <span className="text-gray-400">Win Rate:</span>
                                          <span
                                            className="font-bold"
                                            style={{
                                              color: winRate >= 55 ? '#10B981' : winRate >= 50 ? '#FBBF24' : '#EF4444'
                                            }}
                                          >
                                            {winRate.toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />

                            <Line
                              type="monotone"
                              dataKey="cumulative_profit"
                              stroke={isPositive ? 'url(#lineGradientPositive)' : 'url(#lineGradientNegative)'}
                              strokeWidth={3}
                              dot={{
                                fill: isPositive ? '#10B981' : '#EF4444',
                                strokeWidth: 2,
                                stroke: '#1F2937',
                                r: 4
                              }}
                              activeDot={{
                                fill: isPositive ? '#10B981' : '#EF4444',
                                strokeWidth: 3,
                                stroke: '#1F2937',
                                r: 6,
                                filter: 'url(#glow)'
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )
                    } catch (error) {
                      console.error('🚨 CHART RENDERING ERROR:', error)
                      return (
                        <div className="h-[280px] flex items-center justify-center text-red-400">
                          <div className="text-center">
                            <p className="text-lg mb-2">Chart Error</p>
                            <p className="text-sm">Failed to render chart: {error instanceof Error ? error.message : 'Unknown error'}</p>
                          </div>
                        </div>
                      )
                    }
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className={`bg-gray-800 border ${(performance?.metrics?.net_units || 0) >= 0 ? 'border-green-500 shadow-green-glow' : 'border-red-500 shadow-red-glow'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${(performance?.metrics?.net_units || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Total Profit
                </CardTitle>
                <TrendingUp className={`h-4 w-4 ${(performance?.metrics?.net_units || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(performance?.metrics?.net_units || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  ${performance?.metrics?.net_units?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-gray-400">
                  {performance?.metrics?.roi?.toFixed(2) || '0.00'}% ROI
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border border-purple-500 shadow-purple-glow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-400">Record</CardTitle>
                <Activity className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-300">
                  {performance?.metrics?.wins || 0}-{performance?.metrics?.losses || 0}-{performance?.metrics?.pushes || 0}
                </div>
                <p className="text-xs text-gray-400">
                  {performance?.metrics?.win_rate?.toFixed(1) || '0.0'}% Win Rate
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Current Picks Table Section */}
      <section className="glass-effect p-6 rounded-lg shadow-lg border border-gray-800">
        <h2 className="text-2xl font-semibold text-gray-200 mb-4">CURRENT PICKS</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 px-4">Capper</th>
                <th className="py-2 px-4">Pick</th>
                <th className="py-2 px-4">Units</th>
                <th className="py-2 px-4">Matchup</th>
                <th className="py-2 px-4">Game Start</th>
                <th className="py-2 px-4">Posted</th>
                <th className="py-2 px-4">Sport</th>
                <th className="py-2 px-4">Game Status</th>
                <th className="py-2 px-4">Pick Status</th>
                <th className="py-2 px-4">Outcome</th>
                <th className="py-2 px-4">Analysis</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                try {
                  console.log('🔍 PICKS LENGTH CHECK:', { picksLength: picks?.length, picks: picks })
                } catch (error) {
                  console.error('🚨 PICKS LENGTH ERROR:', error)
                }
                return null
              })()}
              {picks?.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 px-4 text-center text-gray-400">
                    No picks found. Add some picks to see them here!
                  </td>
                </tr>
              ) : (
                (picks || []).map((pick) => {
                  const InsightIcon = getInsightIcon(pick)
                  const capperInfo = CAPPERS.find(c => c.id === pick.capper) || CAPPERS[1] // Default to DeepPick
                  return (
                    <tr key={pick.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-4 align-middle">
                        <Badge className={`bg-gradient-to-r ${capperInfo.color} text-white font-bold`}>
                          {capperInfo.name}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 align-middle font-bold text-gray-100">{pick.selection}</td>
                      <td className="py-3 px-4 align-middle">
                        <span className="text-green-400 font-bold text-lg">{pick.units}</span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        {pick.game_snapshot?.away_team && pick.game_snapshot?.home_team ? (
                          <span className="text-gray-300 font-mono text-sm">
                            {pick.game_snapshot.away_team.abbreviation}@{pick.game_snapshot.home_team.abbreviation}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        {pick.game_snapshot?.game_start_timestamp || (pick.game_snapshot?.game_date && pick.game_snapshot?.game_time) ? (
                          <div className="text-sm">
                            <div className="text-gray-300 font-semibold">
                              {new Date(pick.game_snapshot.game_start_timestamp || `${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                            <div className={`text-xs font-mono ${(() => {
                              const gameTime = new Date(pick.game_snapshot.game_start_timestamp || `${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`)
                              const now = new Date()
                              const hoursUntil = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60)
                              if (hoursUntil < 0) return 'text-red-400'
                              if (hoursUntil < 3) return 'text-orange-400'
                              return 'text-cyan-400'
                            })()}`}>
                              {(() => {
                                const gameTime = new Date(pick.game_snapshot.game_start_timestamp || `${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`)
                                const now = new Date()
                                const diff = gameTime.getTime() - now.getTime()
                                if (diff < 0) return 'STARTED'
                                const hours = Math.floor(diff / (1000 * 60 * 60))
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                                return `${hours}h ${mins}m`
                              })()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">No game time</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle text-gray-300 text-sm">
                        {new Date(pick.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 align-middle text-gray-300">
                        {pick.game_snapshot?.sport?.toUpperCase() || 'N/A'}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        {getGameStatusDisplay(pick)}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <Badge variant={pick.status === 'won' ? 'default' : pick.status === 'lost' ? 'destructive' : 'secondary'}>
                          {pick.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className={getOutcomeText(pick).includes('✅') ? 'text-green-400' : getOutcomeText(pick).includes('❌') ? 'text-red-400' : 'text-gray-400'}>
                          {getOutcomeText(pick)}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <Button
                          onClick={() => {
                            setSelectedPick(pick)
                            setShowBreakdown(true)
                          }}
                          size="sm"
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-lg"
                        >
                          <Brain className="h-4 w-4 mr-2" />
                          View Breakdown
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pick History Grid */}
      <PickHistoryGrid
        onPickClick={(pick) => {
          setSelectedPick(pick as Pick)
          setShowBreakdown(true)
        }}
      />

      {/* Pick Insight Modal - Using SHIVA Insight Card */}
      {showBreakdown && selectedPick && (
        <PickInsightModal
          pickId={selectedPick.id}
          capper={selectedPick.capper}
          onClose={() => setShowBreakdown(false)}
        />
      )}

      {/* Disclaimer Footer */}
      <footer className="mt-12 pb-8">
        <div className="glass-effect p-6 rounded-lg border-2 border-yellow-500/50 bg-yellow-500/5">
          <p className="text-center text-yellow-400 font-bold text-lg">
            ⚠️ For entertainment purposes only. Not financial or gambling advice. ⚠️
          </p>
        </div>
      </footer>
    </main>
  )
}
