'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  Trophy,
  Zap,
  Lock,
  Unlock,
  Eye,
  Flame,
  Target,
  Crown,
  Star,
  ArrowUp,
  ArrowDown,
  Activity,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
  Brain,
  Coins
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

export function NewMainDashboard() {
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

      // Fetch today's top picks (highest confidence, pending)
      const picksResponse = await fetch('/api/picks?status=pending&limit=6&sort=confidence')
      const picksData = await picksResponse.json()
      if (picksData.success) {
        setTodaysPicks(picksData.data)
      }

      // Fetch recent activity (last 10 completed picks)
      const activityResponse = await fetch('/api/picks?status=completed&limit=10')
      const activityData = await activityResponse.json()
      if (activityData.success) {
        setRecentActivity(activityData.data)
      }

      // Fetch performance metrics
      const perfResponse = await fetch('/api/performance?period=30d')
      const perfData = await perfResponse.json()
      if (perfData.success) {
        setPerformance(perfData.data.metrics)
      }

      // TODO: Fetch top cappers from leaderboard API
      // For now, using mock data
      setTopCappers([
        {
          id: 'shiva',
          name: 'SHIVA',
          avatar: '🔱',
          rank: 1,
          roi: 24.5,
          win_rate: 68.2,
          total_units: 127.5,
          streak: 7,
          total_picks: 156,
          badge: 'diamond',
          is_hot: true
        },
        {
          id: 'deeppick',
          name: 'DeepPick',
          avatar: '🎯',
          rank: 2,
          roi: 18.3,
          win_rate: 64.1,
          total_units: 89.2,
          streak: 3,
          total_picks: 203,
          badge: 'platinum',
          is_hot: true
        },
        {
          id: 'nexus',
          name: 'Nexus',
          avatar: '⚡',
          rank: 3,
          roi: 15.7,
          win_rate: 61.5,
          total_units: 72.8,
          streak: -2,
          total_picks: 178,
          badge: 'gold',
          is_hot: false
        }
      ])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'diamond': return 'from-cyan-400 to-blue-600'
      case 'platinum': return 'from-gray-300 to-gray-500'
      case 'gold': return 'from-yellow-400 to-yellow-600'
      case 'silver': return 'from-gray-400 to-gray-600'
      case 'bronze': return 'from-orange-400 to-orange-600'
      default: return 'from-gray-400 to-gray-600'
    }
  }

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return { text: 'N/A', color: 'bg-gray-600' }
    if (confidence >= 80) return { text: 'ELITE', color: 'bg-gradient-to-r from-purple-600 to-pink-600' }
    if (confidence >= 70) return { text: 'HIGH', color: 'bg-gradient-to-r from-green-600 to-emerald-600' }
    if (confidence >= 60) return { text: 'GOOD', color: 'bg-gradient-to-r from-blue-600 to-cyan-600' }
    return { text: 'FAIR', color: 'bg-gradient-to-r from-yellow-600 to-orange-600' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
        <NavBar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Brain className="h-16 w-16 text-neon-blue animate-pulse mx-auto mb-4" />
            <p className="text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <NavBar />

      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HERO SECTION - TODAY'S TOP PICKS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-blue via-neon-purple to-neon-green bg-clip-text text-transparent mb-2">
                🔥 Today's Elite Picks
              </h1>
              <p className="text-gray-400">Highest confidence predictions from our top cappers</p>
            </div>

            {/* Sport Filter */}
            <Tabs value={sportFilter} onValueChange={setSportFilter}>
              <TabsList className="bg-gray-800/50 border border-gray-700">
                <TabsTrigger value="all">All Sports</TabsTrigger>
                <TabsTrigger value="nba">🏀 NBA</TabsTrigger>
                <TabsTrigger value="nfl">🏈 NFL</TabsTrigger>
                <TabsTrigger value="mlb">⚾ MLB</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Top Picks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todaysPicks.slice(0, 6).map((pick) => {
              const confidenceBadge = getConfidenceBadge(pick.confidence)
              const homeTeam = pick.game_snapshot?.home_team
              const awayTeam = pick.game_snapshot?.away_team

              return (
                <Card
                  key={pick.id}
                  className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 hover:border-neon-blue transition-all duration-300 hover:shadow-lg hover:shadow-neon-blue/20 cursor-pointer group"
                  onClick={() => {
                    setSelectedPick(pick)
                    setShowInsight(true)
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl">{pick.capper === 'shiva' ? '🔱' : '🎯'}</div>
                        <div>
                          <div className="text-xs text-gray-400 uppercase tracking-wide">
                            {pick.capper || 'DeepPick'}
                          </div>
                          <Badge className={`${confidenceBadge.color} text-white text-xs mt-1`}>
                            {confidenceBadge.text} {pick.confidence?.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-neon-green">
                          {pick.units}u
                        </div>
                        <div className="text-xs text-gray-400">Units</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Matchup */}
                    <div className="mb-4">
                      <div className="text-sm text-gray-400 mb-2">
                        {awayTeam?.name || 'Away'} @ {homeTeam?.name || 'Home'}
                      </div>
                      <div className="text-lg font-bold text-white group-hover:text-neon-blue transition-colors">
                        {pick.selection}
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {pick.pick_type?.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Game Time */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                      <Clock className="h-3 w-3" />
                      {new Date(pick.game_snapshot?.game_date || pick.created_at).toLocaleDateString()}
                    </div>

                    {/* CTA Button */}
                    <Button
                      className="w-full bg-gradient-to-r from-neon-blue to-neon-purple hover:from-neon-purple hover:to-neon-blue transition-all"
                      size="sm"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      View Full Analysis
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* View All Picks CTA */}
          <div className="text-center mt-8">
            <Link href="/picks">
              <Button
                size="lg"
                className="bg-gradient-to-r from-neon-green to-emerald-600 hover:from-emerald-600 hover:to-neon-green text-black font-bold px-8"
              >
                <Target className="h-5 w-5 mr-2" />
                View All Active Picks
              </Button>
            </Link>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TWO COLUMN LAYOUT - LEADERBOARD + LIVE FEED */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

          {/* LEFT COLUMN - LEADERBOARD */}
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    Top Cappers
                  </span>
                </CardTitle>
                <Link href="/leaderboard">
                  <Button variant="outline" size="sm" className="border-gray-600 hover:border-neon-blue">
                    View Full Leaderboard
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Ranked by ROI • Last 30 days
              </p>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {topCappers.map((capper, index) => (
                  <div
                    key={capper.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-neon-blue transition-all cursor-pointer group"
                  >
                    {/* Rank Badge */}
                    <div className="flex-shrink-0">
                      {index === 0 ? (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                          <Crown className="h-6 w-6 text-white" />
                        </div>
                      ) : (
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getBadgeColor(capper.badge)} flex items-center justify-center text-white font-bold text-lg`}>
                          #{capper.rank}
                        </div>
                      )}
                    </div>

                    {/* Capper Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{capper.avatar}</span>
                        <span className="font-bold text-white group-hover:text-neon-blue transition-colors">
                          {capper.name}
                        </span>
                        {capper.is_hot && (
                          <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{capper.total_picks} picks</span>
                        <span>•</span>
                        <span className="text-green-400">{capper.win_rate.toFixed(1)}% WR</span>
                        {capper.streak > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-neon-green flex items-center gap-1">
                              <Flame className="h-3 w-3" />
                              {capper.streak}W streak
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="text-xl font-bold text-neon-green">
                        +{capper.roi.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-400">ROI</div>
                      <div className="text-sm text-gray-300 mt-1">
                        +{capper.total_units.toFixed(1)}u
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Challenge CTA */}
              <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white mb-1">Think you can beat them?</div>
                    <div className="text-sm text-gray-400">Join as a capper and climb the ranks</div>
                  </div>
                  <Link href="/become-capper">
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-pink-600 hover:to-purple-600">
                      <Zap className="h-4 w-4 mr-2" />
                      Join Now
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT COLUMN - LIVE ACTIVITY FEED */}
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Activity className="h-6 w-6 text-neon-blue animate-pulse" />
                <span className="bg-gradient-to-r from-neon-blue to-neon-cyan bg-clip-text text-transparent">
                  Live Feed
                </span>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">
                Recent picks and results
              </p>
            </CardHeader>

            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {recentActivity.map((pick) => {
                  const isWin = pick.status === 'won'
                  const isLoss = pick.status === 'lost'
                  const netUnits = pick.net_units || 0

                  return (
                    <div
                      key={pick.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-all"
                    >
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {isWin ? (
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          </div>
                        ) : isLoss ? (
                          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Pick Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white truncate">
                            {pick.selection}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {pick.pick_type?.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-400">
                          {pick.capper || 'DeepPick'} • {pick.units}u
                        </div>
                      </div>

                      {/* Result */}
                      <div className="text-right flex-shrink-0">
                        {isWin && (
                          <div className="text-sm font-bold text-green-400">
                            +{netUnits.toFixed(2)}u
                          </div>
                        )}
                        {isLoss && (
                          <div className="text-sm font-bold text-red-400">
                            {netUnits.toFixed(2)}u
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {new Date(pick.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PERFORMANCE OVERVIEW */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {performance && (
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <BarChart3 className="h-6 w-6 text-neon-purple" />
                <span className="bg-gradient-to-r from-neon-purple to-pink-500 bg-clip-text text-transparent">
                  Platform Performance
                </span>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-2">
                Last 30 days • All cappers combined
              </p>
            </CardHeader>

            <CardContent>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {/* Total Picks */}
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Total Picks</div>
                  <div className="text-2xl font-bold text-white">{performance.total_picks}</div>
                </div>

                {/* Win Rate */}
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Win Rate</div>
                  <div className="text-2xl font-bold text-green-400">
                    {performance.win_rate.toFixed(1)}%
                  </div>
                </div>

                {/* Wins */}
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Wins</div>
                  <div className="text-2xl font-bold text-green-400">{performance.wins}</div>
                </div>

                {/* Losses */}
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Losses</div>
                  <div className="text-2xl font-bold text-red-400">{performance.losses}</div>
                </div>

                {/* Net Units */}
                <div className="p-4 rounded-lg bg-gradient-to-br from-neon-green/20 to-emerald-600/20 border border-neon-green/50">
                  <div className="text-sm text-gray-400 mb-1">Net Units</div>
                  <div className={`text-2xl font-bold ${performance.net_units >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                    {performance.net_units >= 0 ? '+' : ''}{performance.net_units.toFixed(2)}u
                  </div>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold text-white">AI-Powered</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Advanced machine learning models analyze thousands of data points
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="font-semibold text-white">Transparent</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Every pick includes full analysis and locked insight cards
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-purple-400" />
                    <span className="font-semibold text-white">Proven Results</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Track record speaks for itself - {performance.win_rate.toFixed(0)}% win rate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CALL TO ACTION - BECOME A CAPPER */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <Card className="bg-gradient-to-r from-purple-900 via-pink-900 to-orange-900 border-2 border-purple-500">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                  <Zap className="h-8 w-8 text-yellow-400" />
                  Ready to Compete?
                </h2>
                <p className="text-gray-200 mb-4">
                  Join our platform as a capper, make your predictions, climb the leaderboard, and earn BattleBet Coins from your followers.
                </p>
                <ul className="space-y-2 text-gray-200">
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-400" />
                    Make public picks to build your reputation
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-yellow-400" />
                    Create private picks and monetize your expertise
                  </li>
                  <li className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    Compete for the #1 spot on the leaderboard
                  </li>
                  <li className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-400" />
                    Earn BattleBet Coins from your followers
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-4">
                <Link href="/become-capper">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-orange-500 hover:to-yellow-400 text-black font-bold px-8 py-6 text-lg"
                  >
                    <Crown className="h-6 w-6 mr-2" />
                    Become a Capper
                  </Button>
                </Link>
                <Link href="/leaderboard">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-2 border-white text-white hover:bg-white hover:text-black px-8 py-6 text-lg"
                  >
                    <Trophy className="h-6 w-6 mr-2" />
                    View Leaderboard
                  </Button>
                </Link>
              </div>
            </div>
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
