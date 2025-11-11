'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NavBar } from '@/components/navigation/nav-bar'
import Link from 'next/link'
import { Trophy, TrendingUp, Award, Medal, Crown, ExternalLink, Home, User } from 'lucide-react'

interface CapperStats {
  id: string
  name: string
  type: 'system' | 'user'
  role?: string
  avatar_url?: string
  wins: number
  losses: number
  pushes: number
  totalPicks: number
  netUnits: number
  winRate: number
  roi: number
  rank: number
}

const CAPPER_COLORS: Record<string, string> = {
  'shiva': 'from-blue-500 to-cyan-500',
  'ifrit': 'from-orange-500 to-red-500',
  'nexus': 'from-purple-500 to-pink-500',
  'cerberus': 'from-red-500 to-orange-500',
  'deeppick': 'from-blue-500 to-cyan-500',
}

const CAPPER_ICONS: Record<string, string> = {
  'shiva': '🔱',
  'ifrit': '🔥',
  'nexus': '🔷',
  'cerberus': '🐺',
  'deeppick': '🎯',
}

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('all')
  const [leaderboard, setLeaderboard] = useState<CapperStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [timeframe])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/leaderboard?period=${timeframe}`)
      const data = await response.json()

      if (data.success && data.data) {
        setLeaderboard(data.data)
      } else {
        console.error('Error fetching leaderboard:', data.error)
        setLeaderboard([])
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-8 h-8 text-yellow-400" />
      case 2:
        return <Medal className="w-8 h-8 text-gray-300" />
      case 3:
        return <Medal className="w-8 h-8 text-orange-400" />
      default:
        return <Award className="w-6 h-6 text-gray-500" />
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'border-yellow-500 shadow-yellow-glow bg-gradient-to-br from-yellow-500/10 to-orange-500/10'
      case 2:
        return 'border-gray-400 shadow-gray-glow bg-gradient-to-br from-gray-400/10 to-gray-500/10'
      case 3:
        return 'border-orange-500 shadow-orange-glow bg-gradient-to-br from-orange-500/10 to-red-500/10'
      default:
        return 'border-gray-700 bg-gray-800/50'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                LEADERBOARD
              </h1>
              <p className="text-gray-400 text-lg">Top Performing Cappers</p>
            </div>
          </div>
          <NavBar />
        </div>

        {/* Timeframe Selector */}
        <Card className="glass-effect border-yellow-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <span className="text-gray-400 font-semibold">Timeframe:</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setTimeframe('7d')}
                  variant={timeframe === '7d' ? 'default' : 'outline'}
                  className={timeframe === '7d' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : ''}
                >
                  Last 7 Days
                </Button>
                <Button
                  onClick={() => setTimeframe('30d')}
                  variant={timeframe === '30d' ? 'default' : 'outline'}
                  className={timeframe === '30d' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : ''}
                >
                  Last 30 Days
                </Button>
                <Button
                  onClick={() => setTimeframe('all')}
                  variant={timeframe === 'all' ? 'default' : 'outline'}
                  className={timeframe === 'all' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : ''}
                >
                  All Time
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading leaderboard...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <Card className="glass-effect border-gray-700">
            <CardContent className="py-12 text-center text-gray-400">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-xl">No data yet for this timeframe</p>
              <p className="text-sm mt-2">Cappers need to generate picks to appear on the leaderboard</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((capper) => {
              const capperColor = capper.type === 'system'
                ? CAPPER_COLORS[capper.id] || 'from-gray-500 to-gray-600'
                : 'from-purple-500 to-pink-500'
              const capperIcon = capper.type === 'system'
                ? CAPPER_ICONS[capper.id] || '🎯'
                : null

              return (
                <Card
                  key={capper.id}
                  className={`glass-effect ${getRankColor(capper.rank)} transition-all hover:scale-[1.02]`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                      {/* Rank */}
                      <div className="flex flex-col items-center justify-center min-w-[80px]">
                        {getRankIcon(capper.rank)}
                        <span className="text-2xl font-bold text-white mt-2">#{capper.rank}</span>
                      </div>

                      {/* Capper Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {/* Avatar for users - clickable to profile */}
                          {capper.type === 'user' && (
                            <Link href={`/profile/${capper.id}`}>
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold hover:scale-110 transition-transform cursor-pointer">
                                {capper.avatar_url ? (
                                  <img src={capper.avatar_url} alt={capper.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5" />
                                )}
                              </div>
                            </Link>
                          )}

                          {/* Capper name - clickable for users */}
                          {capper.type === 'user' ? (
                            <Link href={`/profile/${capper.id}`}>
                              <Badge className={`bg-gradient-to-r ${capperColor} text-white font-bold text-lg px-4 py-2 hover:scale-105 transition-transform cursor-pointer`}>
                                {capper.name}
                              </Badge>
                            </Link>
                          ) : (
                            <Badge className={`bg-gradient-to-r ${capperColor} text-white font-bold text-lg px-4 py-2`}>
                              {capperIcon && <span className="mr-2">{capperIcon}</span>}
                              {capper.name}
                            </Badge>
                          )}

                          {capper.rank === 1 && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                              👑 CHAMPION
                            </Badge>
                          )}

                          {capper.type === 'user' && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                              USER CAPPER
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {/* Record */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Record</p>
                            <p className="text-lg font-bold text-white">
                              {capper.wins}-{capper.losses}-{capper.pushes}
                            </p>
                          </div>

                          {/* Win Rate */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                            <p className={`text-lg font-bold ${capper.winRate >= 55 ? 'text-green-400' : capper.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {capper.winRate.toFixed(1)}%
                            </p>
                          </div>

                          {/* Net Units */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Net Units</p>
                            <p className={`text-lg font-bold ${capper.netUnits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {capper.netUnits >= 0 ? '+' : ''}{capper.netUnits.toFixed(2)}u
                            </p>
                          </div>

                          {/* ROI */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">ROI</p>
                            <p className={`text-lg font-bold ${capper.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {capper.roi >= 0 ? '+' : ''}{capper.roi.toFixed(1)}%
                            </p>
                          </div>

                          {/* Total Picks */}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Picks</p>
                            <p className="text-lg font-bold text-blue-400">
                              {capper.totalPicks}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        <Link href={capper.type === 'system' ? `/?capper=${capper.id}` : `/profile/${capper.id}`} target="_blank">
                          <Button
                            className={`bg-gradient-to-r ${capperColor} hover:opacity-90 text-white font-semibold shadow-lg`}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Picks
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Stats Summary */}
        {!loading && leaderboard.length > 0 && (
          <Card className="glass-effect border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-xl text-purple-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Overall Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Picks</p>
                  <p className="text-3xl font-bold text-white">
                    {leaderboard.reduce((sum, c) => sum + c.totalPicks, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Combined Units</p>
                  <p className={`text-3xl font-bold ${leaderboard.reduce((sum, c) => sum + c.netUnits, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {leaderboard.reduce((sum, c) => sum + c.netUnits, 0) >= 0 ? '+' : ''}
                    {leaderboard.reduce((sum, c) => sum + c.netUnits, 0).toFixed(2)}u
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Best Win Rate</p>
                  <p className="text-3xl font-bold text-green-400">
                    {Math.max(...leaderboard.map(c => c.winRate)).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Best ROI</p>
                  <p className="text-3xl font-bold text-blue-400">
                    {Math.max(...leaderboard.map(c => c.roi)).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

