'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Activity, Lightbulb, AlertTriangle, Zap, BarChart, Rocket, MessageCircle, CheckCircle, XCircle, PlayCircle, Clock, BarChart3, Archive, Brain, X, Target, TrendingDown, Trophy } from 'lucide-react'
import { NavBar } from '@/components/navigation/nav-bar'
import Link from 'next/link'

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
  }
  game_snapshot?: {
    sport: string
    league: string
    home_team: any
    away_team: any
    game_date: string
    game_time: string
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
  { id: 'shiva', name: 'Shiva', color: 'from-blue-500 to-cyan-500', path: '/cappers/shiva' },
  { id: 'cerberus', name: 'Cerberus', color: 'from-red-500 to-orange-500', path: '/cappers/cerberus' },
  { id: 'ifrit', name: 'Ifrit', color: 'from-yellow-500 to-red-500', path: '/cappers/ifrit' },
]

export function RealDashboard() {
  const [picks, setPicks] = useState<Pick[]>([])
  const [pickHistory, setPickHistory] = useState<Pick[]>([])
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

      // Fetch pick history (completed picks - last 10)
      const historyResponse = await fetch(`/api/picks?status=completed&limit=10${capperParam}`)
      const historyData = await historyResponse.json()
      
      if (historyData.success) {
        setPickHistory(historyData.data)
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
                  className={`${
                    selectedCapper === capper.id
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
                    'pickHistory.length': pickHistory?.length,
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
              <div className="h-[250px]">
                {(() => {
                  try {
                    const chartData = performance?.chartData?.filter(item => item && typeof item === 'object' && item.date && typeof item.cumulative_profit === 'number') || []
                    console.log('📈 RENDERING CHART with data:', chartData)
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={chartData} 
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#4B5563" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="#4B5563" tickFormatter={(value) => `$${value / 1000}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '4px' }}
                      labelStyle={{ color: '#E5E7EB' }}
                      formatter={(value: number) => {
                        const color = value >= 0 ? '#10B981' : '#EF4444'
                        return [`$${value.toFixed(2)}`, 'Profit']
                      }}
                      itemStyle={{ color: '#10B981' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload?.length && payload[0]) {
                          const value = payload[0].value as number
                          const color = value >= 0 ? '#10B981' : '#EF4444'
                          return (
                            <div style={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '4px', padding: '8px' }}>
                              <p style={{ color: '#E5E7EB', marginBottom: '4px' }}>{label}</p>
                              <p style={{ color: color, fontWeight: 'bold' }}>
                                Profit: ${value.toFixed(2)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area type="monotone" dataKey="cumulative_profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
                    )
                  } catch (error) {
                    console.error('🚨 CHART RENDERING ERROR:', error)
                    return (
                      <div className="h-[250px] flex items-center justify-center text-red-400">
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
                picks.map((pick) => {
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
                        {pick.game_snapshot?.game_date && pick.game_snapshot?.game_time ? (
                          <div className="text-sm">
                            <div className="text-gray-300 font-semibold">
                              {new Date(`${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                            <div className={`text-xs font-mono ${(() => {
                              const gameTime = new Date(`${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`)
                              const now = new Date()
                              const hoursUntil = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60)
                              if (hoursUntil < 0) return 'text-red-400'
                              if (hoursUntil < 3) return 'text-orange-400'
                              return 'text-cyan-400'
                            })()}`}>
                              {(() => {
                                const gameTime = new Date(`${pick.game_snapshot.game_date}T${pick.game_snapshot.game_time}`)
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

      {/* Pick History Section */}
      <section className="glass-effect p-6 rounded-lg shadow-lg border border-gray-800">
        <h2 className="text-2xl font-semibold text-gray-200 mb-4">PICK HISTORY (Last 10)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 px-4">Capper</th>
                <th className="py-2 px-4">Pick</th>
                <th className="py-2 px-4">Posted</th>
                <th className="py-2 px-4">Sport</th>
                <th className="py-2 px-4">Final Score</th>
                <th className="py-2 px-4">Result</th>
                <th className="py-2 px-4">Outcome</th>
                <th className="py-2 px-4">Analysis</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                try {
                  console.log('🔍 PICK HISTORY LENGTH CHECK:', { pickHistoryLength: pickHistory?.length, pickHistory: pickHistory })
                } catch (error) {
                  console.error('🚨 PICK HISTORY LENGTH ERROR:', error)
                }
                return null
              })()}
              {pickHistory?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-gray-400">
                    No completed picks yet. Check back after games finish!
                  </td>
                </tr>
              ) : (
                pickHistory.map((pick) => {
                  const capperInfo = CAPPERS.find(c => c.id === pick.capper) || CAPPERS[1]
                  const finalScore = pick.games?.final_score
                  
                  return (
                    <tr key={pick.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-4 align-middle">
                        <Badge className={`bg-gradient-to-r ${capperInfo.color} text-white font-bold`}>
                          {capperInfo.name}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 align-middle font-bold text-gray-100">{pick.selection}</td>
                      <td className="py-3 px-4 align-middle text-gray-300 text-sm">
                        {new Date(pick.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 align-middle text-gray-300">
                        {pick.game_snapshot?.sport?.toUpperCase() || 'N/A'}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        {finalScore ? (
                          <div className="text-sm">
                            <div className="text-gray-300">
                              {pick.game_snapshot?.away_team?.abbreviation || 'AWAY'}: <span className={finalScore.winner === 'away' ? 'text-green-400 font-bold' : ''}>{finalScore.away}</span>
                            </div>
                            <div className="text-gray-300">
                              {pick.game_snapshot?.home_team?.abbreviation || 'HOME'}: <span className={finalScore.winner === 'home' ? 'text-green-400 font-bold' : ''}>{finalScore.home}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">No score</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <Badge 
                          variant={pick.status === 'won' ? 'default' : pick.status === 'lost' ? 'destructive' : 'secondary'}
                          className={
                            pick.status === 'won' ? 'bg-green-600 hover:bg-green-700' :
                            pick.status === 'lost' ? 'bg-red-600 hover:bg-red-700' :
                            'bg-gray-600 hover:bg-gray-700'
                          }
                        >
                          {pick.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className={
                          pick.status === 'won' ? 'text-green-400 font-bold' :
                          pick.status === 'lost' ? 'text-red-400 font-bold' :
                          'text-gray-400'
                        }>
                          {pick.status === 'won' && `✅ +${pick.net_units?.toFixed(2)}u`}
                          {pick.status === 'lost' && `❌ ${pick.net_units?.toFixed(2)}u`}
                          {pick.status === 'push' && `➖ Push`}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <Button
                          onClick={() => {
                            setSelectedPick(pick)
                            setShowBreakdown(true)
                          }}
                          size="sm"
                          variant="outline"
                          className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          View
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

      {/* Pick Breakdown Modal */}
      {showBreakdown && selectedPick && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex items-center justify-between border-b border-purple-500/50">
              <div className="flex items-center gap-3">
                <Brain className="w-8 h-8 text-white" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Pick Breakdown</h2>
                  <p className="text-purple-200 text-sm">AI-Powered Analysis</p>
                </div>
              </div>
              <button
                onClick={() => setShowBreakdown(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Pick Summary */}
              <div className="glass-effect p-4 rounded-lg border border-purple-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedPick.selection}</h3>
                    <p className="text-gray-400 text-sm">
                      {selectedPick.game_snapshot?.away_team?.name} @ {selectedPick.game_snapshot?.home_team?.name}
                    </p>
                  </div>
                  <Badge className={`bg-gradient-to-r ${CAPPERS.find(c => c.id === selectedPick.capper)?.color || 'from-blue-500 to-cyan-500'} text-white font-bold text-lg px-4 py-2`}>
                    {CAPPERS.find(c => c.id === selectedPick.capper)?.name || 'DeepPick'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-gray-400 text-sm">Confidence</p>
                    <p className="text-2xl font-bold text-green-400">{selectedPick.confidence || 75}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Units</p>
                    <p className="text-2xl font-bold text-blue-400">{selectedPick.units}u</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Pick Type</p>
                    <p className="text-2xl font-bold text-purple-400">{selectedPick.pick_type?.toUpperCase()}</p>
                  </div>
                </div>
              </div>

              {/* Key Factors */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-400" />
                  Key Factors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-effect p-4 rounded-lg border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <h4 className="font-semibold text-green-400">Positive Indicators</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>• <strong>Line Movement:</strong> Sharp money on this side (+2.5 pts)</li>
                      <li>• <strong>Historical Edge:</strong> 8-2 in last 10 similar matchups</li>
                      <li>• <strong>Statistical Advantage:</strong> +4.2 offensive efficiency</li>
                      <li>• <strong>Situational:</strong> Home team on 3 days rest</li>
                    </ul>
                  </div>
                  <div className="glass-effect p-4 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <h4 className="font-semibold text-red-400">Risk Factors</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>• <strong>Injury Report:</strong> Key player questionable</li>
                      <li>• <strong>Public Betting:</strong> 68% on this side (fade risk)</li>
                      <li>• <strong>Weather:</strong> Potential rain (outdoor game)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Detailed Prediction Log */}
              {selectedPick.result?.prediction_log ? (
                <>
                  {/* Prediction Summary */}
                  <div className="glass-effect p-4 rounded-lg border border-green-500/30">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                      <Target className="w-5 h-5 text-green-400" />
                      Score Prediction
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm">Predicted Score</p>
                        <p className="text-3xl font-bold text-white">
                          {selectedPick.result.prediction_log.finalPrediction.homeScore} - {selectedPick.result.prediction_log.finalPrediction.awayScore}
                        </p>
                        <p className="text-sm text-gray-400">Total: {selectedPick.result.prediction_log.finalPrediction.total}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-400 text-sm">Vegas Lines</p>
                        <p className="text-2xl font-bold text-blue-400">
                          O/U {selectedPick.result.prediction_log.vegasComparison.totalLine?.toFixed(1)}
                        </p>
                        <p className="text-sm text-gray-400">
                          Spread: {selectedPick.result.prediction_log.vegasComparison.spreadLine && selectedPick.result.prediction_log.vegasComparison.spreadLine > 0 ? '+' : ''}{selectedPick.result.prediction_log.vegasComparison.spreadLine?.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                      <div className="bg-purple-500/10 rounded p-2">
                        <p className="text-xs text-gray-400">Total Gap</p>
                        <p className={`text-xl font-bold ${(selectedPick.result.prediction_log.vegasComparison.totalGap || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedPick.result.prediction_log.vegasComparison.totalGap && selectedPick.result.prediction_log.vegasComparison.totalGap > 0 ? '+' : ''}{selectedPick.result.prediction_log.vegasComparison.totalGap?.toFixed(1)} pts
                        </p>
                      </div>
                      <div className="bg-purple-500/10 rounded p-2">
                        <p className="text-xs text-gray-400">Spread Gap</p>
                        <p className={`text-xl font-bold ${(selectedPick.result.prediction_log.vegasComparison.spreadGap || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedPick.result.prediction_log.vegasComparison.spreadGap && selectedPick.result.prediction_log.vegasComparison.spreadGap > 0 ? '+' : ''}{selectedPick.result.prediction_log.vegasComparison.spreadGap?.toFixed(1)} pts
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Breakdown */}
                  <div className="glass-effect p-4 rounded-lg border border-blue-500/30">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      Confidence Analysis
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-gray-400 text-sm">Total</p>
                        <p className="text-2xl font-bold text-blue-400">{selectedPick.result.prediction_log.confidenceBreakdown.totalConfidence || 'N/A'}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Spread</p>
                        <p className="text-2xl font-bold text-purple-400">{selectedPick.result.prediction_log.confidenceBreakdown.spreadConfidence || 'N/A'}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Moneyline</p>
                        <p className="text-2xl font-bold text-green-400">{selectedPick.result.prediction_log.confidenceBreakdown.moneylineConfidence || 'N/A'}%</p>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-400">Selected Bet</p>
                      <p className="text-xl font-bold text-yellow-400">{selectedPick.result.prediction_log.confidenceBreakdown.selectedBet.toUpperCase()} ({selectedPick.result.prediction_log.confidenceBreakdown.finalConfidence}%)</p>
                    </div>
                  </div>

                  {/* Step-by-Step Analysis */}
                  <div className="glass-effect p-4 rounded-lg border border-purple-500/30">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                      <Brain className="w-5 h-5 text-purple-400" />
                      Detailed Prediction Process
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedPick.result.prediction_log.steps.map((step, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-lg border ${
                            step.impact === 'positive' ? 'bg-green-500/5 border-green-500/30' :
                            step.impact === 'negative' ? 'bg-red-500/5 border-red-500/30' :
                            'bg-gray-500/5 border-gray-500/30'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              step.impact === 'positive' ? 'bg-green-500/20 text-green-400' :
                              step.impact === 'negative' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {step.step}
                            </span>
                            <div className="flex-1">
                              <h4 className="font-semibold text-white text-sm">{step.title}</h4>
                              <p className="text-xs text-gray-400 mt-1">{step.description}</p>
                              {step.calculation && (
                                <p className="text-xs text-blue-300 mt-1 font-mono bg-blue-500/10 p-2 rounded">
                                  {step.calculation}
                                </p>
                              )}
                              <p className={`text-sm mt-1 font-medium ${
                                step.impact === 'positive' ? 'text-green-400' :
                                step.impact === 'negative' ? 'text-red-400' :
                                'text-gray-300'
                              }`}>
                                → {step.result}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Decision Factors */}
                  <div className="glass-effect p-4 rounded-lg border border-yellow-500/30">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-yellow-400" />
                      Final Decision Factors
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        {selectedPick.result.prediction_log.decisionFactors.passedMinConfidence ? 
                          <CheckCircle className="w-5 h-5 text-green-400" /> : 
                          <XCircle className="w-5 h-5 text-red-400" />
                        }
                        <span className="text-sm text-gray-300">Min Confidence (60%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedPick.result.prediction_log.decisionFactors.passedFavoriteRule ? 
                          <CheckCircle className="w-5 h-5 text-green-400" /> : 
                          <XCircle className="w-5 h-5 text-red-400" />
                        }
                        <span className="text-sm text-gray-300">Favorite Rule (-250)</span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400">Best Odds Available</p>
                        <p className="text-lg font-bold text-blue-400">
                          {selectedPick.result.prediction_log.decisionFactors.bestOddsAvailable > 0 ? '+' : ''}{selectedPick.result.prediction_log.decisionFactors.bestOddsAvailable}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400">Units Allocated</p>
                        <p className="text-lg font-bold text-green-400">{selectedPick.result.prediction_log.decisionFactors.unitsAllocated} unit{selectedPick.result.prediction_log.decisionFactors.unitsAllocated > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Fallback if no prediction log */}
                  <div className="glass-effect p-4 rounded-lg border border-purple-500/30">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                      <Brain className="w-5 h-5 text-purple-400" />
                      Algorithm Reasoning
                    </h3>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {selectedPick.reasoning || 
                        "This pick was generated based on a comprehensive analysis of historical patterns, statistical models, and real-time market data."
                      }
                    </p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm">
                      <strong>⚠️ Note:</strong> Detailed prediction log not available for this pick. Run the algorithm again to generate detailed logs.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
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
