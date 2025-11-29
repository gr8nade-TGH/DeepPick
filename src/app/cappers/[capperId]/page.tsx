'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, TrendingUp, Target, Calendar, ExternalLink, Twitter, Instagram, Youtube, Globe, ArrowLeft, Clock, CheckCircle2, XCircle, Minus, Map, Crown, Medal, Award, Star, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

interface CapperProfile {
  capper_id: string
  display_name: string
  description?: string | null
  color_theme?: string | null
  created_at?: string | null
  social_links?: {
    twitter?: string
    instagram?: string
    youtube?: string
    website?: string
  } | null
}

interface CapperStats {
  total_picks: number
  wins: number
  losses: number
  pushes: number
  win_rate: number
  net_units: number
  roi: number
  best_bet_type?: string
  current_streak?: { type: 'W' | 'L', count: number }
}

interface Pick {
  id: string
  game_id: string
  pick_type: string
  selection: string
  units: number
  confidence: number
  odds: number
  status: string // 'pending' | 'won' | 'lost' | 'push'
  result: any // JSONB object with detailed result data
  net_units: number | null
  created_at: string
  game?: {
    home_team?: { name: string, abbreviation: string }
    away_team?: { name: string, abbreviation: string }
    game_start_timestamp?: string
    status?: string
  } | null
  game_snapshot?: {
    home_team?: { name: string, abbreviation: string }
    away_team?: { name: string, abbreviation: string }
    game_start_timestamp?: string
    status?: string
  } | null
}

interface TeamDominance {
  team: string
  netUnits: number
  wins: number
  losses: number
  pushes: number
  totalPicks: number
  rank: number
  totalCappers: number
}

export default function CapperPublicProfile() {
  const params = useParams()
  const capperId = params?.capperId as string
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<CapperProfile | null>(null)
  const [stats, setStats] = useState<CapperStats | null>(null)
  const [recentPicks, setRecentPicks] = useState<Pick[]>([])
  const [currentPicks, setCurrentPicks] = useState<Pick[]>([])
  const [topTeams, setTopTeams] = useState<TeamDominance[]>([])
  const [pickHistoryFilter, setPickHistoryFilter] = useState<'7d' | '30d' | 'all'>('all')

  const fetchCapperData = async () => {
    if (!capperId) return

    try {
      setLoading(true)
      console.log('[CapperProfile] Fetching data for capperId:', capperId)

      // Fetch capper profile
      const profileRes = await fetch(`/api/cappers/public-profile?capperId=${capperId}`)
      const profileData = await profileRes.json()

      console.log('[CapperProfile] Profile response:', profileData)

      if (!profileData.success) {
        console.error('[CapperProfile] Profile fetch failed:', profileData.error)
        throw new Error(profileData.error || 'Capper not found')
      }

      setProfile(profileData.capper)

      // Fetch capper stats
      const statsRes = await fetch(`/api/performance?capper=${capperId}`)
      const statsData = await statsRes.json()

      console.log('[CapperProfile] Stats response:', statsData)

      if (statsData.success && statsData.data?.metrics) {
        setStats(statsData.data.metrics)
      }

      // Fetch current (pending) picks
      const currentPicksRes = await fetch(`/api/picks?capper=${capperId}&status=pending&limit=10`)
      const currentPicksData = await currentPicksRes.json()

      console.log('[CapperProfile] Current picks response:', currentPicksData)

      if (currentPicksData.success) {
        setCurrentPicks(currentPicksData.picks || [])
      }

      // Fetch recent picks (only graded: won/lost/push) - limit to 10 for Pick History
      const picksRes = await fetch(`/api/picks?capper=${capperId}&status=completed&limit=10`)
      const picksData = await picksRes.json()

      console.log('[CapperProfile] Picks response:', picksData)

      if (picksData.success) {
        setRecentPicks(picksData.picks || [])
      }

      // Fetch team dominance data
      const dominanceRes = await fetch(`/api/cappers/team-dominance?capperId=${capperId}`)
      const dominanceData = await dominanceRes.json()

      console.log('[CapperProfile] Team dominance response:', dominanceData)

      if (dominanceData.success) {
        setTopTeams(dominanceData.topTeams || [])
      }
    } catch (error) {
      console.error('[CapperProfile] Failed to fetch capper data:', error)
      // Don't throw - let the component render with error state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCapperData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capperId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <Trophy className="w-4 h-4 text-emerald-400" />
      case 'lost':
        return <X className="w-4 h-4 text-red-400" />
      case 'push':
        return <Minus className="w-4 h-4 text-slate-400" />
      case 'pending':
        return <Clock className="w-4 h-4 text-blue-400" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'lost':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      case 'push':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
      case 'pending':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  const getCountdown = (gameStart: string) => {
    const now = new Date()
    const start = new Date(gameStart)
    const diff = start.getTime() - now.getTime()

    if (diff < 0) return ''

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-48 bg-slate-800 rounded-lg"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-32 bg-slate-800 rounded-lg"></div>
              <div className="h-32 bg-slate-800 rounded-lg"></div>
              <div className="h-32 bg-slate-800 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-white">Capper Not Found</CardTitle>
            <CardDescription>The capper you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <Button onClick={() => router.back()} variant="ghost" className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur">
          <CardContent className="p-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500 flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">{profile.display_name}</h1>
                    <p className="text-slate-400">@{profile.capper_id}</p>
                  </div>
                </div>
                <p className="text-slate-300 mb-4">{profile.description || 'No description provided.'}</p>
                {profile.created_at && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
              </div>

              {/* Social Links */}
              {profile.social_links && Object.keys(profile.social_links).length > 0 && (
                <div className="flex gap-2">
                  {profile.social_links.twitter && (
                    <Button variant="outline" size="icon" className="border-slate-700" asChild>
                      <a href={profile.social_links.twitter} target="_blank" rel="noopener noreferrer">
                        <Twitter className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  {profile.social_links.instagram && (
                    <Button variant="outline" size="icon" className="border-slate-700" asChild>
                      <a href={profile.social_links.instagram} target="_blank" rel="noopener noreferrer">
                        <Instagram className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  {profile.social_links.youtube && (
                    <Button variant="outline" size="icon" className="border-slate-700" asChild>
                      <a href={profile.social_links.youtube} target="_blank" rel="noopener noreferrer">
                        <Youtube className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  {profile.social_links.website && (
                    <Button variant="outline" size="icon" className="border-slate-700" asChild>
                      <a href={profile.social_links.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardDescription className="text-slate-400">Win Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${stats.win_rate >= 55 ? 'text-emerald-400' : stats.win_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {stats.win_rate.toFixed(1)}%
                  </span>
                  <span className="text-sm text-slate-500">({stats.wins}-{stats.losses}-{stats.pushes})</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardDescription className="text-slate-400">Total Picks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats.total_picks}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardDescription className="text-slate-400">Net Units</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stats.net_units > 0 ? 'text-emerald-400' : stats.net_units < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {stats.net_units > 0 ? '+' : ''}{stats.net_units.toFixed(1)}U
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardDescription className="text-slate-400">ROI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stats.roi > 0 ? 'text-emerald-400' : stats.roi < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team Dominance - Battle Map Integration */}
        {topTeams.length > 0 && (
          <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    Territory Dominance
                  </CardTitle>
                  <CardDescription>Top teams based on SPREAD pick performance</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                  onClick={() => router.push('/territory-map')}
                >
                  <Map className="w-4 h-4 mr-2" />
                  View Battle Map
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topTeams.map((teamData, index) => {
                  // Rank badge styling based on position
                  // All teams shown here are Rank #1 for their respective team
                  // So they all get gold crowns
                  const rankBadgeStyle = 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                  const rankIcon = <Crown className="w-5 h-5 text-yellow-900" />

                  const winRate = teamData.totalPicks > 0
                    ? ((teamData.wins / (teamData.wins + teamData.losses)) * 100).toFixed(1)
                    : '0.0'

                  return (
                    <div
                      key={teamData.team}
                      className="relative p-5 rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group"
                      onClick={() => router.push(`/territory-map?team=${teamData.team}`)}
                    >
                      {/* Rank Badge */}
                      <div className={`absolute -top-3 -right-3 w-12 h-12 rounded-full ${rankBadgeStyle} flex items-center justify-center border-2 border-slate-900 shadow-lg`}>
                        {rankIcon}
                      </div>

                      {/* Team Name */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-2xl font-black text-white">{teamData.team}</h3>
                          {teamData.rank === 1 && (
                            <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 border-0 font-bold">
                              👑 KING
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                            Rank #{teamData.rank} of {teamData.totalCappers}
                          </Badge>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-sm">Net Units</span>
                          <span className={`text-lg font-bold ${teamData.netUnits > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {teamData.netUnits > 0 ? '+' : ''}{teamData.netUnits}U
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-sm">Record</span>
                          <span className="text-white font-semibold">
                            {teamData.wins}-{teamData.losses}-{teamData.pushes}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-sm">Win Rate</span>
                          <span className={`font-semibold ${parseFloat(winRate) >= 55 ? 'text-emerald-400' : parseFloat(winRate) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {winRate}%
                          </span>
                        </div>
                      </div>

                      {/* Hover Effect */}
                      <div className="absolute inset-0 rounded-xl bg-blue-500/0 group-hover:bg-blue-500/5 transition-all pointer-events-none" />

                      {/* Click to view on map hint */}
                      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2 text-xs text-slate-500 group-hover:text-blue-400 transition-colors">
                        <Map className="w-3 h-3" />
                        <span>Click to view on Battle Map</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Picks - Active Bets */}
        {currentPicks.length > 0 && (
          <Card className="bg-gradient-to-br from-emerald-900/20 to-slate-900/50 border-emerald-500/30 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <div className="relative">
                      <Target className="w-5 h-5 text-emerald-400" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    </div>
                    Current Picks
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 ml-2">
                      {currentPicks.length} Active
                    </Badge>
                  </CardTitle>
                  <CardDescription>Live bets from {profile?.display_name}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentPicks.map((pick) => {
                  const gameData = pick.game || pick.game_snapshot
                  const awayTeam = gameData?.away_team?.abbreviation || 'TBD'
                  const homeTeam = gameData?.home_team?.abbreviation || 'TBD'
                  const gameTime = gameData?.game_start_timestamp

                  // Convert confidence to star rating using same logic as dashboard
                  const confidence = pick.confidence ?? 0
                  let starCount = 0
                  if (confidence > 9.0) starCount = 5
                  else if (confidence > 8.0) starCount = 4
                  else if (confidence > 7.0) starCount = 3
                  else if (confidence > 6.0) starCount = 2
                  else if (confidence > 5.0) starCount = 1
                  else starCount = 0

                  return (
                    <div
                      key={pick.id}
                      className="relative p-4 rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition-all group"
                    >
                      {/* LIVE indicator */}
                      <div className="absolute -top-2 -right-2 px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                        LIVE
                      </div>

                      {/* Game matchup */}
                      <div className="mb-3">
                        <div className="text-lg font-bold text-white mb-1">
                          {awayTeam} @ {homeTeam}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {gameTime ? getCountdown(gameTime) : 'TBD'}
                        </div>
                      </div>

                      {/* Pick details */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                            {pick.pick_type}
                          </Badge>
                          <span className="text-emerald-400 font-bold text-lg">{pick.selection}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Units</span>
                          <span className="text-white font-semibold">{pick.units}U</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Odds</span>
                          <span className="text-white font-semibold">{pick.odds > 0 ? '+' : ''}{pick.odds}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Confidence</span>
                          <div className="flex flex-col items-end gap-1">
                            {/* Stars */}
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${i < starCount
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-slate-700/40'
                                    }`}
                                />
                              ))}
                            </div>
                            {/* Confidence score */}
                            <div className="text-xs font-bold text-slate-400">
                              {confidence.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hover glow effect */}
                      <div className="absolute inset-0 rounded-xl bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-all pointer-events-none" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pick History */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Pick History
                </CardTitle>
                <CardDescription>
                  {pickHistoryFilter === '7d' && 'Last 7 days of predictions'}
                  {pickHistoryFilter === '30d' && 'Last 30 days of predictions'}
                  {pickHistoryFilter === 'all' && `Recent predictions from ${profile.display_name}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Time Period Filters */}
                <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickHistoryFilter('7d')}
                    className={`h-7 px-3 text-xs ${pickHistoryFilter === '7d' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  >
                    7D
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickHistoryFilter('30d')}
                    className={`h-7 px-3 text-xs ${pickHistoryFilter === '30d' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  >
                    30D
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickHistoryFilter('all')}
                    className={`h-7 px-3 text-xs ${pickHistoryFilter === 'all' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  >
                    All
                  </Button>
                </div>
                <Link href={`/picks?capper=${capperId}`}>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7">
                    View All
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentPicks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No picks yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPicks
                  .filter(pick => {
                    // Filter by time period based on game date
                    if (pickHistoryFilter === 'all') return true

                    const gameData = pick.game || pick.game_snapshot
                    const gameTime = gameData?.game_start_timestamp
                    if (!gameTime) return true // Include picks without game time

                    const gameDate = new Date(gameTime)
                    const now = new Date()
                    const daysDiff = Math.floor((now.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24))

                    if (pickHistoryFilter === '7d') return daysDiff <= 7
                    if (pickHistoryFilter === '30d') return daysDiff <= 30
                    return true
                  })
                  .map((pick) => {
                    // Use game data if available, otherwise fall back to game_snapshot
                    const gameData = pick.game || pick.game_snapshot
                    const awayTeam = gameData?.away_team?.abbreviation || 'TBD'
                    const homeTeam = gameData?.home_team?.abbreviation || 'TBD'
                    const gameStatus = gameData?.status || 'scheduled'
                    const gameTime = gameData?.game_start_timestamp

                    // Convert confidence to star rating using same logic as dashboard
                    const confidence = pick.confidence ?? 0
                    let starCount = 0
                    if (confidence > 9.0) starCount = 5
                    else if (confidence > 8.0) starCount = 4
                    else if (confidence > 7.0) starCount = 3
                    else if (confidence > 6.0) starCount = 2
                    else if (confidence > 5.0) starCount = 1
                    else starCount = 0

                    return (
                      <div key={pick.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium">
                                {awayTeam} @ {homeTeam}
                              </span>
                              {gameTime && getCountdown(gameTime) && (
                                <span className="text-cyan-400 text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {getCountdown(gameTime)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-xs">
                                {pick.pick_type}
                              </Badge>
                              <span className="text-slate-300">{pick.selection}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-blue-400">{pick.units}U</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={getStatusColor(pick.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(pick.status)}
                                {pick.status.toUpperCase()}
                              </span>
                            </Badge>
                            {pick.net_units !== null && pick.net_units !== 0 && (
                              <span className={`text-sm font-medium ${pick.net_units > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pick.net_units > 0 ? '+' : ''}{pick.net_units.toFixed(2)}U
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <span>Confidence:</span>
                            {/* Star emojis */}
                            <span>{'⭐'.repeat(starCount)}</span>
                            {/* Confidence score */}
                            <span className="font-medium text-slate-400">
                              {confidence.toFixed(1)}
                            </span>
                          </div>
                          {/* Show game date instead of pick created date */}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {gameTime ? new Date(gameTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date(pick.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

