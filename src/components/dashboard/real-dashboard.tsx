'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Activity, Lightbulb, AlertTriangle, Zap, BarChart, Rocket, MessageCircle, CheckCircle, XCircle, PlayCircle, Clock, BarChart3, Archive } from 'lucide-react'
import Link from 'next/link'

interface Pick {
  id: string
  selection: string
  created_at: string
  units: number
  status: string
  pick_type: string
  reasoning?: string
  net_units?: number
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

export function RealDashboard() {
  const [picks, setPicks] = useState<Pick[]>([])
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('all')

  useEffect(() => {
    fetchData()
  }, [timeFilter])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch picks
      const picksResponse = await fetch('/api/picks')
      const picksData = await picksResponse.json()
      
      if (picksData.success) {
        setPicks(picksData.data)
      }

      // Fetch performance data
      const performanceResponse = await fetch(`/api/performance?period=${timeFilter}`)
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
    const gameStatus = pick.games?.status
    const finalScore = pick.games?.final_score
    const homeTeam = pick.game_snapshot?.home_team
    const awayTeam = pick.game_snapshot?.away_team

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
        <div className="flex items-center gap-3">
          <Link 
            href="/odds"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-blue/30 hover:bg-neon-blue/10 transition-all text-neon-blue hover:border-neon-blue"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="font-semibold">Live Odds</span>
          </Link>
          <Link 
            href="/history"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-purple/30 hover:bg-neon-purple/10 transition-all text-neon-purple hover:border-neon-purple"
          >
            <Archive className="w-4 h-4" />
            <span className="font-semibold">History</span>
          </Link>
        </div>
      </header>

      {/* Summary Graph Section */}
      <section className="glass-effect p-6 rounded-lg shadow-lg border border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-200">Performance Overview</h2>
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
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performance?.chartData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#4B5563" tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis stroke="#4B5563" tickFormatter={(value) => `$${value / 1000}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '4px' }}
                      labelStyle={{ color: '#E5E7EB' }}
                      itemStyle={{ color: '#10B981' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Profit']}
                    />
                    <Area type="monotone" dataKey="cumulative_profit" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="bg-gray-800 border border-blue-500 shadow-blue-glow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-400">Total Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-300">
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
                <th className="py-2 px-4">Pick</th>
                <th className="py-2 px-4">Posted</th>
                <th className="py-2 px-4">Units</th>
                <th className="py-2 px-4">Sport</th>
                <th className="py-2 px-4">Game Status</th>
                <th className="py-2 px-4">Pick Status</th>
                <th className="py-2 px-4">Outcome</th>
                <th className="py-2 px-4">Insight</th>
              </tr>
            </thead>
            <tbody>
              {picks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-gray-400">
                    No picks found. Add some picks to see them here!
                  </td>
                </tr>
              ) : (
                picks.map((pick) => {
                  const InsightIcon = getInsightIcon(pick)
                  return (
                    <tr key={pick.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-100">{pick.selection}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(pick.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{pick.units}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {pick.game_snapshot?.sport?.toUpperCase() || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        {getGameStatusDisplay(pick)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={pick.status === 'won' ? 'default' : pick.status === 'lost' ? 'destructive' : 'secondary'}>
                          {pick.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className={getOutcomeText(pick).includes('✅') ? 'text-green-400' : getOutcomeText(pick).includes('❌') ? 'text-red-400' : 'text-gray-400'}>
                          {getOutcomeText(pick)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 flex items-center">
                        <InsightIcon className="h-4 w-4 mr-2" />
                        {pick.reasoning || 'No reasoning provided'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

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
