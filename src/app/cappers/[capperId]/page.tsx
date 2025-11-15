'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, TrendingUp, Target, Calendar, ExternalLink, Twitter, Instagram, Youtube, Globe, ArrowLeft, Clock, CheckCircle2, XCircle, Minus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CapperProfile {
  capper_id: string
  display_name: string
  description: string
  color_theme: string
  created_at: string
  social_links?: {
    twitter?: string
    instagram?: string
    youtube?: string
    website?: string
  }
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
  result: string | null
  created_at: string
  game: {
    home_team: { name: string, abbreviation: string }
    away_team: { name: string, abbreviation: string }
    game_start_timestamp: string
    status: string
  }
}

export default function CapperPublicProfile({ params }: { params: Promise<{ capperId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<CapperProfile | null>(null)
  const [stats, setStats] = useState<CapperStats | null>(null)
  const [recentPicks, setRecentPicks] = useState<Pick[]>([])

  useEffect(() => {
    fetchCapperData()
  }, [resolvedParams.capperId])

  const fetchCapperData = async () => {
    try {
      setLoading(true)

      // Fetch capper profile
      const profileRes = await fetch(`/api/cappers/public-profile?capperId=${resolvedParams.capperId}`)
      const profileData = await profileRes.json()

      if (!profileData.success) {
        throw new Error('Capper not found')
      }

      setProfile(profileData.capper)

      // Fetch capper stats
      const statsRes = await fetch(`/api/performance?capper=${resolvedParams.capperId}`)
      const statsData = await statsRes.json()

      if (statsData.success) {
        setStats(statsData.data.metrics)
      }

      // Fetch recent picks
      const picksRes = await fetch(`/api/picks?capper=${resolvedParams.capperId}&limit=20`)
      const picksData = await picksRes.json()

      if (picksData.success) {
        setRecentPicks(picksData.picks || [])
      }
    } catch (error) {
      console.error('Failed to fetch capper data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (result: string | null, status: string) => {
    if (status === 'scheduled') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Pending</Badge>
    }
    if (result === 'won') {
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Won</Badge>
    }
    if (result === 'lost') {
      return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Lost</Badge>
    }
    if (result === 'push') {
      return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30"><Minus className="w-3 h-3 mr-1" />Push</Badge>
    }
    return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30">TBD</Badge>
  }

  const getCountdown = (gameStart: string) => {
    const now = new Date()
    const start = new Date(gameStart)
    const diff = start.getTime() - now.getTime()

    if (diff < 0) return 'Live/Final'

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
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
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

        {/* Recent Picks */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Recent Picks
            </CardTitle>
            <CardDescription>Latest predictions from {profile.display_name}</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPicks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No picks yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPicks.map((pick) => (
                  <div key={pick.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold">
                            {pick.game.away_team.abbreviation} @ {pick.game.home_team.abbreviation}
                          </span>
                          {getStatusBadge(pick.result, pick.game.status)}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                            {pick.pick_type}
                          </Badge>
                          <span className="text-white font-medium">{pick.selection}</span>
                          <span className="text-slate-400">{pick.units}U @ {pick.odds > 0 ? '+' : ''}{pick.odds}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{pick.confidence.toFixed(0)}% confidence</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getCountdown(pick.game.game_start_timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

