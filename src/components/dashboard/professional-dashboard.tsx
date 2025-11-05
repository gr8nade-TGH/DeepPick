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

export function ProfessionalDashboard() {
  const [todaysPicks, setTodaysPicks] = useState<Pick[]>([])
  const [topCappers, setTopCappers] = useState<Capper[]>([])
  const [recentActivity, setRecentActivity] = useState<Pick[]>([])
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null)
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
        fetch('/api/picks?status=pending&limit=8&sort=confidence'),
        fetch('/api/picks?status=completed&limit=15'),
        fetch('/api/performance?period=30d')
      ])

      const [picksData, activityData, perfData] = await Promise.all([
        picksResponse.json(),
        activityResponse.json(),
        perfResponse.json()
      ])

      if (picksData.success) setTodaysPicks(picksData.data)
      if (activityData.success) setRecentActivity(activityData.data)
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
                {todaysPicks.slice(0, 8).map((pick) => {
                  const confidenceBadge = getConfidenceBadge(pick.confidence)
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
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">{pick.capper || 'DeepPick'}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-600">
                            {pick.pick_type?.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-xs font-semibold text-emerald-400">
                          {pick.units}u
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

            {/* LEADERBOARD - COMPACT */}
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
                {topCappers.map((capper, index) => (
                  <div
                    key={capper.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-all"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                      #{capper.rank}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-white truncate">{capper.name}</span>
                        {capper.streak > 0 && (
                          <span className="text-[10px] text-emerald-400">🔥{capper.streak}W</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{capper.win_rate.toFixed(1)}% WR</span>
                        <span>•</span>
                        <span>{capper.total_picks} picks</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-semibold text-emerald-400">
                        +{capper.roi.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-500">
                        +{capper.total_units.toFixed(0)}u
                      </div>
                    </div>
                  </div>
                ))}

                <Link href="/become-capper">
                  <Button className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white text-xs h-8 border border-slate-700">
                    Become a Capper
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* LIVE FEED - COMPACT */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2 px-3 pt-2.5 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>

              <CardContent className="px-3 py-2 space-y-1 max-h-[400px] overflow-y-auto">
                {recentActivity.map((pick) => {
                  const isWin = pick.status === 'won'
                  const isLoss = pick.status === 'lost'
                  const netUnits = pick.net_units || 0

                  return (
                    <div
                      key={pick.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800/20 border border-slate-700/30"
                    >
                      <div className="flex-shrink-0">
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
                        <div className="text-[11px] font-semibold text-white truncate">
                          {pick.selection}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {pick.capper || 'DeepPick'} • {pick.units}u
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {isWin && (
                          <div className="text-[11px] font-semibold text-emerald-400">
                            +{netUnits.toFixed(1)}u
                          </div>
                        )}
                        {isLoss && (
                          <div className="text-[11px] font-semibold text-red-400">
                            {netUnits.toFixed(1)}u
                          </div>
                        )}
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

