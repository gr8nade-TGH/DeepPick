'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  RefreshCw,
  Home,
  BarChart3,
  Calendar,
  Target,
  Archive
} from 'lucide-react'

interface HistoryGame {
  id: string
  sport: string
  league: string
  home_team: { name: string; abbreviation: string }
  away_team: { name: string; abbreviation: string }
  game_date: string
  game_time: string
  status: string
  final_score?: any
  archived_at: string
  completed_at?: string
  sportsbooks: string[]
}

const SPORTS = [
  { key: 'all', label: 'All Sports', icon: BarChart3 },
  { key: 'nfl', label: 'NFL', icon: Target },
  { key: 'nba', label: 'NBA', icon: Target },
  { key: 'mlb', label: 'MLB', icon: Target },
]

export default function HistoryPage() {
  const [games, setGames] = useState<HistoryGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSport, setSelectedSport] = useState('all')

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/games-history?sport=${selectedSport}`, { cache: 'no-store' })
      const data = await response.json()

      if (data.success) {
        setGames(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch history')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [selectedSport])

  const getSportIcon = (sport: string) => {
    const sportConfig = SPORTS.find(s => s.key === sport)
    return sportConfig?.icon || BarChart3
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final': return 'bg-gray-500 text-white'
      case 'live': return 'bg-red-500 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Archive className="w-10 h-10 text-neon-blue" />
          <div>
            <h1 className="text-4xl font-bold text-gradient bg-gradient-to-r from-neon-purple via-neon-blue to-neon-green bg-clip-text text-transparent">
              Games History
            </h1>
            <p className="text-slate-400 text-sm mt-1">View archived and completed games</p>
          </div>
        </div>

        {/* Controls */}
        <Card className="glass-effect">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => fetchHistory()}
                disabled={loading}
                className="bg-neon-purple hover:bg-neon-purple/80"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <div className="flex-1" />

              {/* Sport Filter */}
              <div className="flex gap-2">
                {SPORTS.map((sport) => {
                  const Icon = sport.icon
                  return (
                    <Button
                      key={sport.key}
                      onClick={() => setSelectedSport(sport.key)}
                      variant={selectedSport === sport.key ? 'default' : 'outline'}
                      className={`flex items-center gap-2 ${selectedSport === sport.key
                          ? 'bg-neon-blue text-white'
                          : 'border-gray-500 text-gray-400 hover:bg-gray-700/20'
                        }`}
                      size="sm"
                    >
                      <Icon className="w-4 h-4" />
                      {sport.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-effect">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-neon-green">
                {games.length}
              </div>
              <div className="text-sm text-muted-foreground">Archived Games</div>
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-neon-blue">
                {games.filter(g => g.status === 'final').length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-neon-purple">
                {games[0] ? new Date(games[0].archived_at).toLocaleString() : 'Never'}
              </div>
              <div className="text-sm text-muted-foreground">Last Archived</div>
            </CardContent>
          </Card>
        </div>

        {/* Games List */}
        <div className="space-y-4">
          {loading ? (
            <Card className="glass-effect">
              <CardContent className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-neon-blue" />
                <span className="ml-2 text-lg">Loading history...</span>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="glass-effect">
              <CardContent className="flex items-center justify-center py-12 text-red-400">
                <div className="text-center">
                  <p className="text-lg">Error loading history</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </CardContent>
            </Card>
          ) : games.length === 0 ? (
            <Card className="glass-effect">
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <Archive className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-lg">No archived games yet</p>
                  <p className="text-sm">Games will appear here after completion</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            games.map((game) => {
              const SportIcon = getSportIcon(game.sport)
              return (
                <Card key={game.id} className="glass-effect hover:neon-glow transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <SportIcon className="w-5 h-5 text-neon-blue" />
                          <Badge variant="outline" className="text-xs">
                            {game.league}
                          </Badge>
                          <Badge className={getStatusColor(game.status)}>
                            {game.status}
                          </Badge>
                        </div>

                        <div className="text-lg font-semibold mb-1">
                          {game.away_team.name} @ {game.home_team.name}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(game.game_date).toLocaleDateString()}
                          </div>
                          <div>
                            Archived: {new Date(game.archived_at).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {game.final_score && (
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            <span className={game.final_score.winner === 'away' ? 'text-neon-green' : 'text-gray-400'}>
                              {game.away_team.abbreviation} {game.final_score.away}
                            </span>
                            <span className="text-gray-500 mx-2">-</span>
                            <span className={game.final_score.winner === 'home' ? 'text-neon-green' : 'text-gray-400'}>
                              {game.final_score.home} {game.home_team.abbreviation}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {game.final_score.winner === 'tie' ? 'Tie Game' :
                              game.final_score.winner === 'home' ? `${game.home_team.name} Won` :
                                `${game.away_team.name} Won`}
                            {game.final_score.margin && ` by ${game.final_score.margin}`}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

