'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Trophy, X, Minus, ExternalLink, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface Pick {
  id: string
  game_id: string
  pick_type: string
  selection: string
  units: number
  confidence: number
  status: string
  net_units: number | null
  created_at: string
  game_snapshot: any
  games: {
    away_team: string
    home_team: string
    game_start_timestamp: string
    status: string
  } | null
}

interface RecentPicksProps {
  capperId: string
  limit?: number
}

function getCountdown(gameDate: string | undefined): string {
  if (!gameDate) return ''
  const now = new Date()
  const game = new Date(gameDate)
  const diff = game.getTime() - now.getTime()
  if (diff < 0) return ''
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

export function RecentPicks({ capperId, limit = 10 }: RecentPicksProps) {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchPicks()
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [capperId])

  const fetchPicks = async () => {
    try {
      setLoading(true)
      // Only fetch graded picks (won/lost/push) for Pick History
      const response = await fetch(`/api/picks?capper=${capperId}&status=completed&limit=${limit}`)
      const data = await response.json()
      if (data.success) {
        setPicks(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch picks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <Trophy className="w-4 h-4 text-emerald-400" />
      case 'lost':
        return <X className="w-4 h-4 text-red-400" />
      case 'push':
        return <Minus className="w-4 h-4 text-slate-400" />
      default:
        return <Clock className="w-4 h-4 text-blue-400" />
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
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Recent Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-700/50 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (picks.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Recent Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No picks generated yet</p>
            <p className="text-slate-500 text-sm mt-1">Your picks will appear here once generated</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Recent Picks
        </CardTitle>
        <Link href="/picks">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            View All
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {picks.map((pick) => {
            const game = pick.games || pick.game_snapshot
            const countdown = getCountdown(game?.game_start_timestamp)

            return (
              <div
                key={pick.id}
                className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        {game?.away_team} @ {game?.home_team}
                      </span>
                      {countdown && (
                        <span className="text-cyan-400 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {countdown}
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
                        {pick.status?.toUpperCase() || 'PENDING'}
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
                  <span>Confidence: {pick.confidence}%</span>
                  <span>{new Date(pick.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

