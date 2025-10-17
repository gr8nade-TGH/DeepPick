'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  RefreshCw, 
  Filter, 
  Clock, 
  TrendingUp, 
  Activity,
  Zap,
  BarChart3,
  Calendar,
  MapPin,
  Target
} from 'lucide-react'

interface Game {
  id: string
  sport: string
  league: string
  home_team: { name: string; abbreviation: string }
  away_team: { name: string; abbreviation: string }
  game_date: string
  game_time: string
  status: string
  venue?: string
  odds: {
    [bookmaker: string]: {
      moneyline?: { home: number; away: number }
      spread?: { home: number; away: number; line: number }
      total?: { over: number; under: number; line: number }
      last_update: string
    }
  }
  created_at: string
  updated_at: string
  time_until_game: string
  sportsbooks: string[]
}

const SPORTS = [
  { key: 'all', label: 'All Sports', icon: BarChart3 },
  { key: 'americanfootball_nfl', label: 'NFL', icon: Target },
  { key: 'basketball_nba', label: 'NBA', icon: Target },
  { key: 'baseball_mlb', label: 'MLB', icon: Target },
]

export default function OddsPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSport, setSelectedSport] = useState('all')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchOdds = async (sport: string = selectedSport) => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (sport !== 'all') params.append('sport', sport)
      params.append('limit', '100')
      
      const response = await fetch(`/api/odds?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setGames(data.data)
        setLastRefresh(new Date())
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch odds')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOdds()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchOdds()
      }, 30000) // Refresh every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedSport])

  const handleSportChange = (sport: string) => {
    setSelectedSport(sport)
    fetchOdds(sport)
  }

  const getSportIcon = (sport: string) => {
    const sportConfig = SPORTS.find(s => s.key === sport)
    return sportConfig?.icon || BarChart3
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'final': return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
      case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'postponed': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const formatOdds = (odds: number) => {
    if (odds > 0) return `+${odds}`
    return odds.toString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-200 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">
              Live Odds Dashboard
            </h1>
            <p className="text-xl text-muted-foreground">
              Real-time sports odds from The Odds API
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-neon-green/20 text-neon-green border-neon-green/50' : ''}
            >
              <Activity className="w-4 h-4 mr-2" />
              {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
            </Button>
            
            <Button
              onClick={() => fetchOdds()}
              disabled={loading}
              className="bg-neon-blue hover:bg-neon-blue/80"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Now
            </Button>
            
            <Button
              onClick={async () => {
                try {
                  const response = await fetch('/api/ingest-odds', { method: 'POST' })
                  const result = await response.json()
                  if (result.success) {
                    alert('Odds ingestion triggered successfully!')
                    fetchOdds() // Refresh the display
                  } else {
                    alert('Failed to trigger odds ingestion: ' + result.error)
                  }
                } catch (error) {
                  alert('Error triggering odds ingestion: ' + error)
                }
              }}
              disabled={loading}
              variant="outline"
              className="border-neon-green text-neon-green hover:bg-neon-green/20"
            >
              <Zap className="w-4 h-4 mr-2" />
              Ingest Fresh Odds
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-effect neon-glow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neon-green">Total Games</CardTitle>
              <BarChart3 className="h-4 w-4 text-neon-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-green">{games.length}</div>
              <p className="text-xs text-muted-foreground">
                {selectedSport === 'all' ? 'All Sports' : SPORTS.find(s => s.key === selectedSport)?.label}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect neon-glow-blue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neon-blue">Live Games</CardTitle>
              <Activity className="h-4 w-4 text-neon-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-blue">
                {games.filter(g => g.status === 'live').length}
              </div>
              <p className="text-xs text-muted-foreground">Currently playing</p>
            </CardContent>
          </Card>

          <Card className="glass-effect neon-glow-purple">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neon-purple">Scheduled</CardTitle>
              <Clock className="h-4 w-4 text-neon-purple" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neon-purple">
                {games.filter(g => g.status === 'scheduled').length}
              </div>
              <p className="text-xs text-muted-foreground">Upcoming games</p>
            </CardContent>
          </Card>

          <Card className="glass-effect neon-glow-yellow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-400">Last Updated</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold text-yellow-400">
                {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}
              </div>
              <p className="text-xs text-muted-foreground">Data refresh time</p>
            </CardContent>
          </Card>
        </div>

        {/* Sport Filter */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter by Sport
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedSport} onValueChange={handleSportChange}>
              <TabsList className="grid w-full grid-cols-4">
                {SPORTS.map((sport) => {
                  const Icon = sport.icon
                  return (
                    <TabsTrigger 
                      key={sport.key} 
                      value={sport.key}
                      className="flex items-center gap-2 data-[state=active]:bg-neon-green/20 data-[state=active]:text-neon-green"
                    >
                      <Icon className="w-4 h-4" />
                      {sport.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Games Table */}
        <Card className="glass-effect">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-neon-blue" />
                <span className="ml-2 text-lg">Loading odds...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-400">
                <div className="text-center">
                  <Zap className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-lg">Error loading odds</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            ) : games.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-lg">No games found</p>
                  <p className="text-sm">Try refreshing or changing the sport filter</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 font-semibold text-neon-blue">Matchup</th>
                      <th className="text-left p-4 font-semibold text-neon-blue">Time</th>
                      {games[0]?.sportsbooks?.map((bookmaker) => (
                        <th key={bookmaker} className="text-center p-4 font-semibold text-neon-green">
                          {bookmaker.charAt(0).toUpperCase() + bookmaker.slice(1)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => {
                      const SportIcon = getSportIcon(game.sport)
                      return (
                        <tr key={game.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <SportIcon className="w-5 h-5 text-neon-blue" />
                              <div>
                                <div className="font-semibold">
                                  {game.away_team.name} @ {game.home_team.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {game.league} • {game.away_team.abbreviation} @ {game.home_team.abbreviation}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className={getStatusColor(game.status)}>
                                    {game.status}
                                  </Badge>
                                  {game.venue && (
                                    <span className="text-xs text-muted-foreground">
                                      <MapPin className="w-3 h-3 inline mr-1" />
                                      {game.venue}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(game.game_date).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-4 h-4" />
                                {game.time_until_game}
                              </div>
                            </div>
                          </td>
                          {game.sportsbooks?.map((bookmaker) => {
                            const bookmakerOdds = game.odds[bookmaker]
                            return (
                              <td key={bookmaker} className="p-4 text-center">
                                {bookmakerOdds ? (
                                  <div className="space-y-2">
                                    {bookmakerOdds.moneyline && (
                                      <div className="bg-dark-300 p-2 rounded text-xs">
                                        <div className="text-muted-foreground mb-1">ML</div>
                                        <div className="text-neon-green">
                                          {game.away_team.abbreviation} {formatOdds(bookmakerOdds.moneyline.away)}
                                        </div>
                                        <div className="text-neon-green">
                                          {game.home_team.abbreviation} {formatOdds(bookmakerOdds.moneyline.home)}
                                        </div>
                                      </div>
                                    )}
                                    {bookmakerOdds.spread && (
                                      <div className="bg-dark-300 p-2 rounded text-xs">
                                        <div className="text-muted-foreground mb-1">Spread</div>
                                        <div className="text-neon-blue">
                                          {game.away_team.abbreviation} {bookmakerOdds.spread.line > 0 ? '+' : ''}{bookmakerOdds.spread.line}
                                        </div>
                                        <div className="text-neon-blue">
                                          {game.home_team.abbreviation} {bookmakerOdds.spread.line > 0 ? '-' : '+'}{Math.abs(bookmakerOdds.spread.line)}
                                        </div>
                                      </div>
                                    )}
                                    {bookmakerOdds.total && (
                                      <div className="bg-dark-300 p-2 rounded text-xs">
                                        <div className="text-muted-foreground mb-1">Total</div>
                                        <div className="text-neon-purple">
                                          O {formatOdds(bookmakerOdds.total.over)}
                                        </div>
                                        <div className="text-neon-purple">
                                          U {formatOdds(bookmakerOdds.total.under)}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {bookmakerOdds.total.line}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground text-sm">No odds</div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
