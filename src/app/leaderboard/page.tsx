'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  'sentinel': 'from-blue-600 to-indigo-700',
  'nexus': 'from-purple-500 to-pink-500',
  'blitz': 'from-yellow-600 to-orange-700',
  'titan': 'from-gray-600 to-slate-700',
  'thief': 'from-violet-600 to-purple-700',
  'cerberus': 'from-red-500 to-orange-500',
  'deeppick': 'from-blue-500 to-cyan-500',
  'picksmith': 'from-amber-500 to-orange-600',
  'gr8nade': 'from-lime-500 to-green-600',
  'marshal-harris': 'from-emerald-500 to-teal-600',
}

const CAPPER_ICONS: Record<string, string> = {
  'shiva': '🔱',
  'ifrit': '🔥',
  'sentinel': '🛡️',
  'nexus': '🔷',
  'blitz': '⚡',
  'titan': '🏔️',
  'thief': '🎭',
  'cerberus': '🐺',
  'deeppick': '🎯',
  'picksmith': '⚒️',
  'gr8nade': '💎',
  'marshal-harris': '🎖️',
}

const NBA_TEAMS = [
  { name: 'All Teams', abbreviation: 'all' },
  { name: 'Atlanta Hawks', abbreviation: 'ATL' },
  { name: 'Boston Celtics', abbreviation: 'BOS' },
  { name: 'Brooklyn Nets', abbreviation: 'BKN' },
  { name: 'Charlotte Hornets', abbreviation: 'CHA' },
  { name: 'Chicago Bulls', abbreviation: 'CHI' },
  { name: 'Cleveland Cavaliers', abbreviation: 'CLE' },
  { name: 'Dallas Mavericks', abbreviation: 'DAL' },
  { name: 'Denver Nuggets', abbreviation: 'DEN' },
  { name: 'Detroit Pistons', abbreviation: 'DET' },
  { name: 'Golden State Warriors', abbreviation: 'GSW' },
  { name: 'Houston Rockets', abbreviation: 'HOU' },
  { name: 'Indiana Pacers', abbreviation: 'IND' },
  { name: 'LA Clippers', abbreviation: 'LAC' },
  { name: 'Los Angeles Lakers', abbreviation: 'LAL' },
  { name: 'Memphis Grizzlies', abbreviation: 'MEM' },
  { name: 'Miami Heat', abbreviation: 'MIA' },
  { name: 'Milwaukee Bucks', abbreviation: 'MIL' },
  { name: 'Minnesota Timberwolves', abbreviation: 'MIN' },
  { name: 'New Orleans Pelicans', abbreviation: 'NOP' },
  { name: 'New York Knicks', abbreviation: 'NYK' },
  { name: 'Oklahoma City Thunder', abbreviation: 'OKC' },
  { name: 'Orlando Magic', abbreviation: 'ORL' },
  { name: 'Philadelphia 76ers', abbreviation: 'PHI' },
  { name: 'Phoenix Suns', abbreviation: 'PHX' },
  { name: 'Portland Trail Blazers', abbreviation: 'POR' },
  { name: 'Sacramento Kings', abbreviation: 'SAC' },
  { name: 'San Antonio Spurs', abbreviation: 'SAS' },
  { name: 'Toronto Raptors', abbreviation: 'TOR' },
  { name: 'Utah Jazz', abbreviation: 'UTA' },
  { name: 'Washington Wizards', abbreviation: 'WAS' },
]

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [betTypeFilter, setBetTypeFilter] = useState<'all' | 'total' | 'spread'>('all')
  const [leaderboard, setLeaderboard] = useState<CapperStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [timeframe, teamFilter, betTypeFilter])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: timeframe })
      if (teamFilter !== 'all') {
        params.append('team', teamFilter)
      }
      if (betTypeFilter !== 'all') {
        params.append('bet_type', betTypeFilter)
      }
      const response = await fetch(`/api/leaderboard?${params.toString()}`)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col gap-6">
            {/* Timeframe */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-slate-400 font-semibold min-w-[100px]">Timeframe:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setTimeframe('7d')}
                  size="sm"
                  className={timeframe === '7d'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  }
                >
                  Last 7 Days
                </Button>
                <Button
                  onClick={() => setTimeframe('30d')}
                  size="sm"
                  className={timeframe === '30d'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  }
                >
                  Last 30 Days
                </Button>
                <Button
                  onClick={() => setTimeframe('all')}
                  size="sm"
                  className={timeframe === 'all'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  }
                >
                  All Time
                </Button>
              </div>
            </div>

            {/* Team Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-slate-400 font-semibold min-w-[100px]">Team:</span>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white font-semibold hover:border-yellow-500 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 cursor-pointer"
              >
                {NBA_TEAMS.map(team => (
                  <option key={team.abbreviation} value={team.abbreviation}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bet Type Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-slate-400 font-semibold min-w-[100px]">Bet Type:</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setBetTypeFilter('all')}
                  size="sm"
                  className={betTypeFilter === 'all'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  }
                >
                  All
                </Button>
                <Button
                  onClick={() => setBetTypeFilter('total')}
                  size="sm"
                  className={betTypeFilter === 'total'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  }
                >
                  Total
                </Button>
                <Button
                  onClick={() => setBetTypeFilter('spread')}
                  size="sm"
                  className={betTypeFilter === 'spread'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  }
                >
                  Spread
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-500 border-t-transparent mx-auto"></div>
            <p className="text-slate-400 mt-6 text-lg font-medium">Loading leaderboard...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
            <Trophy className="w-20 h-20 mx-auto mb-6 text-slate-600" />
            <p className="text-2xl font-bold text-slate-300 mb-2">No data yet for this timeframe</p>
            <p className="text-slate-500">Cappers need to generate picks to appear on the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((capper) => {
              const capperColor = capper.type === 'system'
                ? CAPPER_COLORS[capper.id] || 'from-gray-500 to-gray-600'
                : 'from-purple-500 to-pink-500'
              const capperIcon = capper.type === 'system'
                ? CAPPER_ICONS[capper.id] || '🎯'
                : null

              return (
                <div
                  key={capper.id}
                  className={`bg-slate-900/70 backdrop-blur-sm border ${getRankColor(capper.rank)} rounded-xl p-5 transition-all hover:scale-[1.01] hover:shadow-2xl`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className="flex flex-col items-center justify-center min-w-[70px]">
                      {getRankIcon(capper.rank)}
                      <span className="text-xl font-black text-white mt-1">#{capper.rank}</span>
                    </div>

                    {/* Capper Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name Row */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Link href={`/cappers/${capper.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity group">
                          {capper.type === 'user' ? (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {capper.avatar_url ? (
                                <img src={capper.avatar_url} alt={capper.name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <User className="w-4 h-4" />
                              )}
                            </div>
                          ) : null}
                          <span className={`bg-gradient-to-r ${capperColor} text-white font-bold text-base px-3 py-1 rounded-lg inline-flex items-center gap-1 group-hover:ring-2 group-hover:ring-white/30 transition-all`}>
                            {capper.type === 'system' && capperIcon && <span>{capperIcon}</span>}
                            {capper.name}
                          </span>
                        </Link>

                        {capper.rank === 1 && (
                          <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 text-xs px-2 py-0.5 rounded-md font-bold">
                            👑 CHAMPION
                          </span>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-5 gap-3 text-center">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Record</p>
                          <p className="text-sm font-bold text-white">
                            {capper.wins}-{capper.losses}-{capper.pushes}
                          </p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Win Rate</p>
                          <p className={`text-sm font-bold ${capper.winRate >= 55 ? 'text-green-400' : capper.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {capper.winRate.toFixed(1)}%
                          </p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Net Units</p>
                          <p className={`text-sm font-bold ${capper.netUnits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {capper.netUnits >= 0 ? '+' : ''}{capper.netUnits.toFixed(2)}u
                          </p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">ROI</p>
                          <p className={`text-sm font-bold ${capper.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {capper.roi >= 0 ? '+' : ''}{capper.roi.toFixed(1)}%
                          </p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Picks</p>
                          <p className="text-sm font-bold text-cyan-400">
                            {capper.totalPicks}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* View Picks Button */}
                    <Link href={`/cappers/${capper.id}`} target="_blank">
                      <Button
                        size="sm"
                        className={`bg-gradient-to-r ${capperColor} hover:opacity-90 text-white font-bold shadow-lg whitespace-nowrap`}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        View Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Stats Summary */}
        {!loading && leaderboard.length > 0 && (
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">Overall Statistics</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-xs uppercase font-semibold mb-2">Total Picks</p>
                <p className="text-3xl font-black text-white">
                  {leaderboard.reduce((sum, c) => sum + c.totalPicks, 0)}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-xs uppercase font-semibold mb-2">Combined Units</p>
                <p className={`text-3xl font-black ${leaderboard.reduce((sum, c) => sum + c.netUnits, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {leaderboard.reduce((sum, c) => sum + c.netUnits, 0) >= 0 ? '+' : ''}
                  {leaderboard.reduce((sum, c) => sum + c.netUnits, 0).toFixed(2)}u
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-xs uppercase font-semibold mb-2">Best Win Rate</p>
                <p className="text-3xl font-black text-green-400">
                  {Math.max(...leaderboard.map(c => c.winRate)).toFixed(1)}%
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-slate-400 text-xs uppercase font-semibold mb-2">Best ROI</p>
                <p className="text-3xl font-black text-green-400">
                  +{Math.max(...leaderboard.map(c => c.roi)).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

