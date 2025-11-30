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
  TrendingDown,
  Star,
  LayoutGrid
} from 'lucide-react'

import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { getRarityFromConfidence } from '@/app/cappers/shiva/management/components/insight-card'
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
    game_start_timestamp?: string
  }
  games?: {
    status: string
    game_start_timestamp?: string
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

// Helper function to render confidence stars
// Maps confidence scores to star ratings based on ACTUAL units allocation thresholds:
// > 9.0 → 5 stars (5 units - max confidence)
// > 8.0 → 4 stars (4 units)
// > 7.0 → 3 stars (3 units)
// > 6.0 → 2 stars (2 units)
// > 5.0 → 1 star  (1 unit)
// ≤ 5.0 → 0 stars (PASS - no pick generated)
function renderConfidenceStars(confidence?: number) {
  if (!confidence) return null

  // Determine star count based on exact units thresholds
  let starCount = 0
  if (confidence > 9.0) starCount = 5
  else if (confidence > 8.0) starCount = 4
  else if (confidence > 7.0) starCount = 3
  else if (confidence > 6.0) starCount = 2
  else if (confidence > 5.0) starCount = 1
  else starCount = 0 // PASS threshold

  const stars = []

  for (let i = 0; i < 5; i++) {
    if (i < starCount) {
      // Filled star - clean and bright
      stars.push(
        <Star
          key={i}
          className="w-4 h-4 fill-yellow-400 text-yellow-400"
        />
      )
    } else {
      // Empty star - very subtle
      stars.push(
        <Star
          key={i}
          className="w-4 h-4 text-slate-700/40"
        />
      )
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>
}

export function ProfessionalDashboard() {
  const { user, profile } = useAuth()
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
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchDashboardData()
  }, [sportFilter])

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Only fetch pending picks for games that haven't started yet (future games)
      // This prevents old stale picks from showing up
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

      const [picksResponse, activityResponse, perfResponse] = await Promise.all([
        fetch('/api/picks?status=pending&limit=50&sort=confidence'), // Fetch more to sort client-side
        fetch('/api/picks?status=completed&limit=20&sort=created_at'),
        fetch('/api/performance?period=30d')
      ])

      const [picksData, activityData, perfData] = await Promise.all([
        picksResponse.json(),
        activityResponse.json(),
        perfResponse.json()
      ])

      if (picksData.success) {
        // Filter out stale picks (games that started more than 24 hours ago)
        const filteredPicks = (picksData.data || []).filter((pick: Pick) => {
          // If game has a start timestamp, check if it's in the future or recent past (within 24 hours)
          const gameTime = pick.game_snapshot?.game_start_timestamp || pick.games?.game_start_timestamp
          if (gameTime) {
            const gameDate = new Date(gameTime)
            const hoursSinceGame = (now.getTime() - gameDate.getTime()) / (1000 * 60 * 60)
            // Only show picks for games that haven't started yet or started within last 24 hours
            return hoursSinceGame < 24
          }
          // If no timestamp, keep the pick (fallback)
          return true
        })

        console.log('[Dashboard] Filtered picks:', {
          total: picksData.data?.length || 0,
          afterFilter: filteredPicks.length,
          removed: (picksData.data?.length || 0) - filteredPicks.length
        })

        setTodaysPicks(filteredPicks)
      }
      if (activityData.success) {
        console.log('[Dashboard] Recent activity data:', activityData.data)
        console.log('[Dashboard] Recent activity count:', activityData.data?.length)
        setRecentActivity(activityData.data)
      } else {
        console.error('[Dashboard] Failed to fetch recent activity:', activityData)
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
      // Use the leaderboard API which includes ALL cappers (system + user)
      // Add cache-busting timestamp to prevent stale data
      const leaderboardResponse = await fetch(`/api/leaderboard?period=all&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const leaderboardData = await leaderboardResponse.json()

      console.log('[Dashboard] Fetched cappers from leaderboard:', leaderboardData)
      console.log('[Dashboard] Number of cappers returned:', leaderboardData.data?.length)
      console.log('[Dashboard] Capper IDs:', leaderboardData.data?.map((c: any) => c.id))

      if (!leaderboardData.success || !leaderboardData.data || leaderboardData.data.length === 0) {
        console.error('[Dashboard] Failed to fetch cappers or no cappers found')
        setTopCappers([]) // Clear any existing data
        return
      }

      // Map capper IDs to avatars
      const avatarMap: Record<string, string> = {
        'shiva': '🔱',
        'ifrit': '🔥',
        'oracle': '🔮',
        'sentinel': '🛡️',
        'nexus': '🔷',
        'blitz': '⚡',
        'titan': '🏔️',
        'thief': '🎭',
        'cerberus': '🐺',
        'deeppick': '🎯',
        'gr8nade': '💎',
        'picksmith': '⚒️',
        'marshal-harris': '🎖️'
      }

      // Convert leaderboard data to Capper format
      const cappers: Capper[] = leaderboardData.data.map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        avatar: avatarMap[entry.id.toLowerCase()] || (entry.type === 'user' ? '👤' : '🤖'),
        rank: entry.rank,
        roi: entry.roi || 0,
        win_rate: entry.winRate || 0,
        total_units: entry.netUnits || 0,
        streak: 0, // TODO: Calculate streak
        total_picks: entry.totalPicks || 0,
        badge: entry.roi > 20 ? 'diamond' : entry.roi > 10 ? 'platinum' : entry.roi > 5 ? 'gold' : entry.roi > 0 ? 'silver' : 'bronze',
        is_hot: entry.roi > 0
      }))

      console.log('[Dashboard] Final top cappers:', cappers)
      setTopCappers(cappers)

      // Sort picks by capper performance + confidence
      sortPicksByQuality(cappers)
    } catch (error) {
      console.error('[Dashboard] Error fetching top cappers:', error)
      setTopCappers([]) // Clear on error
    }
  }

  const sortPicksByQuality = (cappers: Capper[]) => {
    // Create a map of capper -> performance score
    const capperScoreMap = new Map<string, number>()
    cappers.forEach(capper => {
      // Performance score = ROI * win_rate (both as decimals)
      // This gives higher weight to cappers with both high ROI and high win rate
      const performanceScore = (capper.roi / 100) * (capper.win_rate / 100)
      capperScoreMap.set(capper.id.toLowerCase(), performanceScore)
    })

    // Sort picks by: (capper performance * confidence)
    setTodaysPicks(prev => {
      const sorted = [...prev].sort((a, b) => {
        const capperA = a.capper?.toLowerCase() || 'deeppick'
        const capperB = b.capper?.toLowerCase() || 'deeppick'

        const perfA = capperScoreMap.get(capperA) || 0
        const perfB = capperScoreMap.get(capperB) || 0

        const confA = a.confidence || 0
        const confB = b.confidence || 0

        // Combined score: capper performance (0-1) * confidence (0-10)
        const scoreA = perfA * confA
        const scoreB = perfB * confB

        return scoreB - scoreA // Descending order (best first)
      })

      // Apply diversity: limit to max 2 picks per capper in top 5
      // This ensures variety and prevents one capper from dominating Elite Picks
      const diversified: Pick[] = []
      const capperPickCount = new Map<string, number>()
      const MAX_PICKS_PER_CAPPER = 2

      for (const pick of sorted) {
        const capperId = pick.capper?.toLowerCase() || 'deeppick'
        const currentCount = capperPickCount.get(capperId) || 0

        // If we haven't hit the limit for this capper, add the pick
        if (currentCount < MAX_PICKS_PER_CAPPER) {
          diversified.push(pick)
          capperPickCount.set(capperId, currentCount + 1)
        }

        // Stop once we have enough picks for Elite Picks display (20)
        if (diversified.length >= 20) break
      }

      // If we don't have 20 picks yet (not enough cappers), fill with remaining picks
      if (diversified.length < 20) {
        for (const pick of sorted) {
          if (!diversified.includes(pick)) {
            diversified.push(pick)
            if (diversified.length >= 20) break
          }
        }
      }

      console.log('[Dashboard] Sorted picks by quality (with diversity):', diversified.map(p => ({
        capper: p.capper,
        confidence: p.confidence,
        selection: p.selection
      })))

      return diversified
    })
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
    } else if (capperUpper === 'SENTINEL') {
      return {
        gradient: 'bg-gradient-to-r from-blue-900 to-indigo-900',
        text: 'text-blue-200'
      }
    } else if (capperUpper === 'NEXUS') {
      return {
        gradient: 'bg-gradient-to-r from-purple-900 to-pink-900',
        text: 'text-purple-200'
      }
    } else if (capperUpper === 'BLITZ') {
      return {
        gradient: 'bg-gradient-to-r from-yellow-900 to-orange-900',
        text: 'text-yellow-200'
      }
    } else if (capperUpper === 'TITAN') {
      return {
        gradient: 'bg-gradient-to-r from-gray-900 to-slate-900',
        text: 'text-gray-200'
      }
    } else if (capperUpper === 'THIEF') {
      return {
        gradient: 'bg-gradient-to-r from-violet-900 to-purple-900',
        text: 'text-violet-200'
      }
    } else if (capperUpper === 'PICKSMITH') {
      return {
        gradient: 'bg-gradient-to-r from-amber-900 to-yellow-900',
        text: 'text-amber-200'
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
      <div className="px-2 sm:px-4 py-2 sm:py-4 max-w-[1800px] mx-auto">

        {/* PERFORMANCE STATS BAR - COMPACT - Responsive Grid */}
        {performance && (
          <div className="mb-3 sm:mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 sm:px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Total Picks</div>
              <div className="text-base sm:text-lg font-bold text-white">{performance.total_picks}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 sm:px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Win Rate</div>
              <div className="text-base sm:text-lg font-bold text-emerald-400">{performance.win_rate.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 sm:px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">W / L</div>
              <div className="text-base sm:text-lg font-bold text-white">{performance.wins} / {performance.losses}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-3 sm:px-4 py-2">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">ROI</div>
              <div className={`text-base sm:text-lg font-bold ${performance.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.roi >= 0 ? '+' : ''}{performance.roi?.toFixed(1) || '0.0'}%
              </div>
            </div>
            <div className="bg-slate-900/50 border border-emerald-900/20 rounded-lg px-3 sm:px-4 py-2 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">Net Units</div>
              <div className={`text-base sm:text-lg font-bold ${performance.net_units >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.net_units >= 0 ? '+' : ''}{performance.net_units.toFixed(1)}u
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT - Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 mb-3">

          {/* LEFT COLUMN - TODAY'S PICKS - Full width on mobile, 60% on desktop */}
          <div className="lg:col-span-7">
            {/* Today's Elite Picks - Responsive Height */}
            <Card className="bg-slate-900/50 border-slate-800 h-auto lg:h-[550px] flex flex-col">
              <CardHeader className="pb-2 px-2 sm:px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold text-white">Today's Elite Picks</CardTitle>
                    <Link
                      href="/pick-grid"
                      className="group relative p-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:border-cyan-400 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all duration-300"
                      title="View Consensus Heat Map"
                    >
                      <LayoutGrid className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                      <div className="absolute inset-0 rounded-lg bg-cyan-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Link>
                  </div>
                  <Tabs value={sportFilter} onValueChange={setSportFilter}>
                    <TabsList className="bg-slate-800/50 border border-slate-700 h-7">
                      <TabsTrigger value="all" className="text-[11px] px-2 py-0.5">All</TabsTrigger>
                      <TabsTrigger value="nba" className="text-[11px] px-2 py-0.5">NBA</TabsTrigger>
                      <TabsTrigger value="nfl" className="text-[11px] px-2 py-0.5 opacity-40 cursor-not-allowed" disabled>NFL</TabsTrigger>
                      <TabsTrigger value="mlb" className="text-[11px] px-2 py-0.5 opacity-40 cursor-not-allowed" disabled>MLB</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>

              <CardContent className="px-2 sm:px-3 py-2 flex-1 overflow-y-auto max-h-[500px]">
                {todaysPicks.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400 font-medium">No picks available</p>
                      <p className="text-xs text-slate-600 mt-1">Check back later for today's elite picks</p>
                    </div>
                  </div>
                ) : (
                  /* Scrollable Card Grid - 3 columns, up to 20 picks */
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {todaysPicks.slice(0, 20).map((pick, index) => {
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
                      const capperBadge = getCapperBadge(pick.capper || 'DeepPick')

                      // Get countdown
                      const gameTime = pick.games?.game_start_timestamp ||
                        pick.game_snapshot?.game_start_timestamp ||
                        pick.game_snapshot?.game_date
                      const countdown = getCountdown(gameTime)

                      // Get rarity based on confidence for Diablo-style card styling
                      const rarity = getRarityFromConfidence(pick.confidence || 50)

                      return (
                        <div
                          key={pick.id}
                          className={`relative rounded-lg transition-all duration-200 cursor-pointer group overflow-hidden ${isLocked ? 'opacity-60' : 'hover:scale-[1.02]'}`}
                          style={isLocked ? {
                            background: 'rgba(15,15,25,0.9)',
                            border: '1px solid rgba(100,100,120,0.3)'
                          } : {
                            background: `linear-gradient(135deg, rgba(15,15,25,0.95) 0%, rgba(10,10,18,0.98) 100%)`,
                            border: `2px solid ${rarity.borderColor}`,
                            boxShadow: `0 0 15px ${rarity.glowColor}, inset 0 0 30px rgba(0,0,0,0.4)`
                          }}
                          onClick={() => {
                            if (!isLocked) {
                              setSelectedPick(pick)
                              setShowInsight(true)
                            }
                          }}
                        >
                          {/* Locked Overlay */}
                          {isLocked && (
                            <div className="absolute inset-0 z-10 bg-slate-900/95 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2 p-4">
                              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-2 rounded-full border border-slate-600/50">
                                <Lock className="h-4 w-4 text-slate-400" />
                              </div>
                              <p className="text-xs font-bold text-white">Premium</p>
                              <Link href="/signup" className="text-[10px] text-slate-400 hover:text-white underline">
                                Unlock
                              </Link>
                            </div>
                          )}

                          {/* Card Content */}
                          <div className={`p-3 h-full flex flex-col ${isLocked ? 'blur-sm' : ''}`}>
                            {/* Top Row: Capper Badge + Rarity Badge */}
                            <div className="flex items-center justify-between mb-2">
                              <div className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold ${capperBadge.gradient} ${capperBadge.text} uppercase tracking-wide`}>
                                {pick.capper || 'DeepPick'}
                              </div>
                              {/* Rarity Badge */}
                              <div
                                className="px-1.5 py-0.5 rounded text-[8px] font-bold text-white"
                                style={{ background: `linear-gradient(135deg, ${rarity.borderColor}80, ${rarity.borderColor}60)` }}
                              >
                                {rarity.icon} {rarity.tier}
                              </div>
                            </div>

                            {/* Pick Selection - HERO */}
                            <div
                              className="text-sm sm:text-base font-black text-white transition-colors leading-tight mb-2 line-clamp-2"
                              style={{ textShadow: `0 0 10px ${rarity.glowColor}` }}
                            >
                              {pick.selection}
                            </div>

                            {/* Matchup */}
                            <div className="text-[10px] sm:text-xs text-slate-400 font-medium mb-2 truncate">
                              {matchup}
                            </div>

                            {/* Bottom Row: Type + Status + Countdown + Units */}
                            <div className="mt-auto flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                {/* Bet Type Badge */}
                                <span className="px-1.5 py-0.5 bg-slate-700/80 rounded text-[8px] sm:text-[9px] text-slate-300 font-semibold uppercase">
                                  {pick.pick_type}
                                </span>
                                {/* Status */}
                                <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold ${gameStatus.text === 'LIVE' ? 'bg-red-600/80 text-white animate-pulse' :
                                  gameStatus.text === 'FINAL' ? 'bg-slate-600 text-slate-300' :
                                    'bg-blue-600/50 text-blue-200'
                                  }`}>
                                  {gameStatus.text}
                                </span>
                              </div>

                              {/* Units Badge */}
                              <div className="flex items-center justify-center min-w-[32px] h-7 sm:h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg shadow-lg px-2">
                                <span className="text-sm sm:text-base font-black text-white">
                                  {pick.units}<span className="text-[8px] sm:text-[10px]">u</span>
                                </span>
                              </div>
                            </div>

                            {/* Countdown - subtle at bottom */}
                            {countdown && (
                              <div className="mt-2 text-[9px] sm:text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {countdown}
                              </div>
                            )}

                            {/* Bold Predictions indicator */}
                            {hasPredictions && (
                              <div className="mt-1.5 text-[8px] text-purple-400 flex items-center gap-1">
                                <span>🔮</span>
                                <span className="font-medium">Bold Predictions</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - LEADERBOARD + PERFORMANCE TREND - Full width on mobile, 40% on desktop */}
          <div className="lg:col-span-5 space-y-2 sm:space-y-3">

            {/* LEADERBOARD - Responsive Height */}
            <Card className="bg-slate-900/50 border-slate-800 h-auto lg:h-[310px] flex flex-col">
              <CardHeader className="pb-2 px-2 sm:px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
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

              <CardContent className="px-2 sm:px-3 py-2 space-y-1.5 flex-1 overflow-y-auto max-h-[400px] lg:max-h-none">
                {topCappers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Trophy className="w-12 h-12 text-slate-700 mb-3" />
                    <p className="text-sm text-slate-400 mb-1">No cappers with picks yet</p>
                    <p className="text-xs text-slate-500">
                      {profile?.role === 'capper'
                        ? 'Your picks will appear here once generated'
                        : 'Cappers will appear here once they generate picks'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Column Headers - Responsive */}
                    <div className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2 pb-1 border-b border-slate-800/50">
                      <div className="flex-shrink-0 w-5 sm:w-6 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        #
                      </div>
                      <div className="flex-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        Capper
                      </div>
                      <div className="text-right flex-shrink-0 w-12 sm:w-16 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        ROI
                      </div>
                      <div className="text-right flex-shrink-0 w-10 sm:w-12 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
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
                        group relative flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-1.5 sm:py-2 rounded
                        border transition-all duration-200
                        ${isTop3
                              ? `bg-gradient-to-r ${rankColors[index as 0 | 1 | 2]} hover:border-opacity-60`
                              : 'bg-slate-800/20 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/30'
                            }
                      `}
                        >
                          {/* Rank Badge - Responsive */}
                          <div className={`
                        flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center
                        text-[9px] sm:text-[10px] font-bold text-white shadow-sm
                        ${isTop3 ? rankBgColors[index as 0 | 1 | 2] : 'bg-slate-700'}
                      `}>
                            {isTop3 ? medalEmojis[index] : `#${capper.rank}`}
                          </div>

                          {/* Capper Info - Responsive */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                              <Link href={`/cappers/${capper.id}`} className="hover:underline">
                                <span className={`text-[11px] sm:text-xs font-semibold truncate ${isTop3 ? 'text-white' : 'text-slate-200'} cursor-pointer hover:text-blue-400 transition-colors`}>
                                  {capper.name}
                                </span>
                              </Link>
                              {capper.streak > 0 && (
                                <span className="text-[9px] sm:text-[10px] font-medium text-emerald-400 flex items-center gap-0.5">
                                  🔥<span className="font-mono">{capper.streak}W</span>
                                </span>
                              )}
                              {capper.is_hot && (
                                <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                                  HOT
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-slate-400">
                              <span className="font-mono font-medium">
                                {capper.win_rate.toFixed(1)}%
                              </span>
                              <span className="text-slate-600 hidden sm:inline">•</span>
                              <span className="text-slate-500 hidden sm:inline">{capper.total_picks} picks</span>
                            </div>
                          </div>

                          {/* ROI - Responsive */}
                          <div className="text-right flex-shrink-0 w-12 sm:w-16">
                            <div className={`
                          text-[10px] sm:text-xs font-bold font-mono
                          ${capper.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}
                        `}>
                              {capper.roi >= 0 ? '+' : ''}{capper.roi.toFixed(1)}%
                            </div>
                          </div>

                          {/* Units - Responsive */}
                          <div className="text-right flex-shrink-0 w-10 sm:w-12">
                            <div className={`
                          text-[10px] sm:text-[11px] font-semibold font-mono
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
                  </>
                )}

                {/* Only show "Upgrade to Capper" button for FREE users */}
                {profile && profile.role === 'free' && (
                  <Link href="/upgrade">
                    <Button className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white text-xs h-8 border border-slate-700 transition-all hover:border-slate-600">
                      Upgrade to Capper
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card >

            {/* PERFORMANCE TREND GRAPH - Responsive Height */}
            < Card className="bg-slate-900/50 border-slate-800 h-auto lg:h-[227px] flex flex-col" >
              <CardHeader className="pb-2 px-2 sm:px-3 pt-2.5 border-b border-slate-800 flex-shrink-0">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Performance Trend
                </CardTitle>
              </CardHeader>

              <CardContent className="px-2 sm:px-3 py-2 flex-1 min-h-[200px]">
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
            </Card >
          </div >
        </div >

        {/* PICK HISTORY - FULL WIDTH AT BOTTOM */}
        < Card className="bg-slate-900/50 border-slate-800 h-[250px] flex flex-col" >
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
                  const gameDate = pick.game_snapshot?.game_date
                  const gameStatus = getGameStatus(pick)

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
                            <Badge className={`${gameStatus.color} text-[9px] px-1.5 py-0.5 font-semibold`}>
                              {gameStatus.icon} {gameStatus.text}
                            </Badge>
                            <span className="text-slate-600">•</span>
                            <span className="text-[10px] text-slate-400">
                              {gameDate ? new Date(gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
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
        </Card >
      </div >

      {/* Insight Modal */}
      {
        showInsight && selectedPick && (
          <PickInsightModal
            pickId={selectedPick.id}
            capper={selectedPick.capper}
            onClose={() => {
              setShowInsight(false)
              setSelectedPick(null)
            }}
          />
        )
      }
    </div >
  )
}

