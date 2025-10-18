'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OddsChart } from '@/components/odds/odds-chart'
import { CountdownTimer } from '@/components/odds/countdown-timer'
import { 
  RefreshCw, 
  Clock, 
  Activity,
  Zap,
  BarChart3,
  Calendar,
  MapPin,
  Target,
  TrendingUp,
  Home
} from 'lucide-react'
import Link from 'next/link'

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
  odds: any
  created_at: string
  updated_at: string
  time_until_game: string
  sportsbooks: string[]
}

const SPORTS = [
  { key: 'all', label: 'All Sports', icon: BarChart3 },
  { key: 'nfl', label: 'NFL', icon: Target },
  { key: 'nba', label: 'NBA', icon: Target },
  { key: 'mlb', label: 'MLB', icon: Target },
]

// Sportsbook colors matching the chart
const SPORTSBOOK_COLORS: Record<string, string> = {
  'draftkings': '#53D337',
  'fanduel': '#1E88E5',
  'williamhill_us': '#C41E3A',
  'betmgm': '#F1C400',
}

export default function OddsPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSport, setSelectedSport] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchOdds = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔄 Fetching odds...')
      const response = await fetch(`/api/odds?sport=${selectedSport}`)
      const data = await response.json()
      
      console.log('📊 Odds response:', data)
      
      if (data.success) {
        setGames(data.data || [])
        console.log(`✅ Loaded ${data.data?.length || 0} games`)
      } else {
        setError(data.error || 'Failed to fetch odds')
        console.error('❌ Error:', data.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('❌ Fetch error:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  useEffect(() => {
    fetchOdds()
  }, [selectedSport])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchOdds, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedSport])

  const getSportIcon = (sport: string) => {
    const sportConfig = SPORTS.find(s => s.key === sport)
    return sportConfig?.icon || BarChart3
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-red-500 text-white'
      case 'scheduled': return 'bg-blue-500 text-white'
      case 'final': return 'bg-gray-500 text-white'
      default: return 'bg-gray-400 text-white'
    }
  }

  const formatOdds = (odds: number) => {
    if (odds > 0) return `+${odds}`
    return odds.toString()
  }

  const totalGames = games.length
  const liveGames = games.filter(g => g.status === 'live').length
  const scheduledGames = games.filter(g => g.status === 'scheduled').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-blue/30 hover:bg-neon-blue/10 transition-all text-neon-blue hover:border-neon-blue"
          >
            <Home className="w-4 h-4" />
            <span className="font-semibold">Dashboard</span>
          </Link>
          
          <h1 className="text-4xl font-bold text-gradient bg-gradient-to-r from-neon-blue via-neon-purple to-neon-green bg-clip-text text-transparent">
            Live Odds Dashboard
          </h1>
          
          <div className="w-[120px]" /> {/* Spacer for centering */}
        </div>

        {/* Controls */}
        <Card className="glass-effect">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => toggleAutoRefresh()}
                variant="outline"
                className={`border ${autoRefresh ? 'border-neon-green text-neon-green' : 'border-gray-500 text-gray-400'} hover:bg-gray-700/20`}
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
                    console.log('🚀 Triggering odds ingestion...')
                    const response = await fetch('/api/simple-ingest', { method: 'GET' })
                    const result = await response.json()
                    console.log('📊 Ingestion result:', result)
                    
                    if (result.success) {
                      alert(`✅ ${result.message}\nStored ${result.storedCount} games`)
                      fetchOdds() // Refresh the display
                    } else {
                      alert(`❌ Failed: ${result.error}`)
                    }
                  } catch (error) {
                    console.error('❌ Ingestion error:', error)
                    alert(`❌ Error: ${error}`)
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
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-effect neon-glow-blue">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-neon-blue">{totalGames}</div>
              <div className="text-sm text-muted-foreground">Total Games</div>
            </CardContent>
          </Card>
          <Card className="glass-effect neon-glow-red">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{liveGames}</div>
              <div className="text-sm text-muted-foreground">Live Games</div>
            </CardContent>
          </Card>
          <Card className="glass-effect neon-glow-green">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-neon-green">{scheduledGames}</div>
              <div className="text-sm text-muted-foreground">Scheduled</div>
            </CardContent>
          </Card>
          <Card className="glass-effect neon-glow-purple">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-neon-purple">
                {games.length > 0 ? new Date(games[0].updated_at).toLocaleTimeString() : 'Never'}
              </div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
            </CardContent>
          </Card>
        </div>

        {/* Sport Filter */}
        <Card className="glass-effect">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((sport) => {
                const Icon = sport.icon
                return (
                  <Button
                    key={sport.key}
                    onClick={() => setSelectedSport(sport.key)}
                    variant={selectedSport === sport.key ? 'default' : 'outline'}
                    className={`flex items-center gap-2 ${
                      selectedSport === sport.key 
                        ? 'bg-neon-blue text-white' 
                        : 'border-gray-500 text-gray-400 hover:bg-gray-700/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {sport.label}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Games List */}
        <div className="space-y-4">
          {loading ? (
            <Card className="glass-effect">
              <CardContent className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-neon-blue" />
                <span className="ml-2 text-lg">Loading odds...</span>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="glass-effect">
              <CardContent className="flex items-center justify-center py-12 text-red-400">
                <div className="text-center">
                  <Zap className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-lg">Error loading odds</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </CardContent>
            </Card>
          ) : games.length === 0 ? (
            <Card className="glass-effect">
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-lg">No games found</p>
                  <p className="text-sm">Try clicking "Ingest Fresh Odds" to get data</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            games.map((game) => {
              const SportIcon = getSportIcon(game.sport)
              return (
                <Card key={game.id} className="glass-effect hover:neon-glow transition-all duration-300">
                  <CardContent className="p-6">
                    {/* Game Header */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <SportIcon className="w-5 h-5 text-neon-blue" />
                        <Badge variant="outline" className="text-xs">
                          {game.league}
                        </Badge>
                        <Badge className={getStatusColor(game.status)}>
                          {game.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(game.game_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <CountdownTimer gameDate={game.game_date} gameTime={game.game_time} />
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-[1fr,auto] gap-6">
                      {/* Left: Odds Table */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-semibold">
                            {game.away_team.name} @ {game.home_team.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="w-3 h-3" />
                            <span>Last updated: {new Date(game.updated_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              second: '2-digit'
                            })}</span>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left p-2 text-xs text-muted-foreground">Team</th>
                                {game.sportsbooks?.map((bookmaker) => {
                                  const displayName = bookmaker === 'williamhill_us' ? 'Caesars' : bookmaker.replace('_', ' ')
                                  return (
                                    <th 
                                      key={bookmaker} 
                                      className="text-center p-2 text-xs capitalize font-semibold"
                                      style={{ color: SPORTSBOOK_COLORS[bookmaker] || '#10b981' }}
                                    >
                                      {displayName}
                                    </th>
                                  )
                                })}
                                <th className="text-center p-2 text-xs text-neon-cyan font-bold">Avg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Away Team Row */}
                              <tr className="border-b border-white/5">
                                <td className="p-2 font-semibold">
                                  <div>{game.away_team.abbreviation}</div>
                                  <div className="text-xs text-muted-foreground">(Away)</div>
                                </td>
                                {game.sportsbooks?.map((bookmaker) => {
                                  const odds = game.odds[bookmaker]
                                  return (
                                    <td key={bookmaker} className="p-2 text-center">
                                      {odds?.moneyline && (
                                        <div className="text-neon-blue font-semibold">
                                          {odds.moneyline.away > 0 ? '+' : ''}{odds.moneyline.away}
                                        </div>
                                      )}
                                      {odds?.spread && (
                                        <div className="text-xs text-neon-purple">
                                          {odds.spread.line > 0 ? '+' : ''}{odds.spread.line}
                                        </div>
                                      )}
                                      {!odds?.moneyline && <span className="text-muted-foreground">-</span>}
                                    </td>
                                  )
                                })}
                                {/* Average Column for Away Team */}
                                <td className="p-2 text-center bg-white/5">
                                  {(() => {
                                    const moneylines = game.sportsbooks
                                      ?.map(book => game.odds[book]?.moneyline?.away)
                                      .filter(val => val !== undefined && val !== null) || []
                                    const avg = moneylines.length > 0 
                                      ? Math.round(moneylines.reduce((a, b) => a + b, 0) / moneylines.length)
                                      : null
                                    return avg !== null ? (
                                      <div className="text-neon-cyan font-bold">
                                        {avg > 0 ? '+' : ''}{avg}
                                      </div>
                                    ) : <span className="text-muted-foreground">-</span>
                                  })()}
                                  {(() => {
                                    const spreads = game.sportsbooks
                                      ?.map(book => game.odds[book]?.spread?.line)
                                      .filter(val => val !== undefined && val !== null) || []
                                    const avg = spreads.length > 0 
                                      ? (spreads.reduce((a, b) => a + b, 0) / spreads.length).toFixed(1)
                                      : null
                                    return avg !== null ? (
                                      <div className="text-xs text-neon-purple">
                                        {parseFloat(avg) > 0 ? '+' : ''}{avg}
                                      </div>
                                    ) : null
                                  })()}
                                </td>
                              </tr>
                              
                              {/* Home Team Row */}
                              <tr className="border-b border-white/5">
                                <td className="p-2 font-semibold">
                                  <div>{game.home_team.abbreviation}</div>
                                  <div className="text-xs text-muted-foreground">(Home)</div>
                                </td>
                                {game.sportsbooks?.map((bookmaker) => {
                                  const odds = game.odds[bookmaker]
                                  return (
                                    <td key={bookmaker} className="p-2 text-center">
                                      {odds?.moneyline && (
                                        <div className="text-neon-blue font-semibold">
                                          {odds.moneyline.home > 0 ? '+' : ''}{odds.moneyline.home}
                                        </div>
                                      )}
                                      {odds?.spread && (
                                        <div className="text-xs text-neon-purple">
                                          {odds.spread.line > 0 ? '-' : '+'}{Math.abs(odds.spread.line)}
                                        </div>
                                      )}
                                      {!odds?.moneyline && <span className="text-muted-foreground">-</span>}
                                    </td>
                                  )
                                })}
                                {/* Average Column for Home Team */}
                                <td className="p-2 text-center bg-white/5">
                                  {(() => {
                                    const moneylines = game.sportsbooks
                                      ?.map(book => game.odds[book]?.moneyline?.home)
                                      .filter(val => val !== undefined && val !== null) || []
                                    const avg = moneylines.length > 0 
                                      ? Math.round(moneylines.reduce((a, b) => a + b, 0) / moneylines.length)
                                      : null
                                    return avg !== null ? (
                                      <div className="text-neon-cyan font-bold">
                                        {avg > 0 ? '+' : ''}{avg}
                                      </div>
                                    ) : <span className="text-muted-foreground">-</span>
                                  })()}
                                  {(() => {
                                    const spreads = game.sportsbooks
                                      ?.map(book => game.odds[book]?.spread?.line)
                                      .filter(val => val !== undefined && val !== null) || []
                                    const avg = spreads.length > 0 
                                      ? (spreads.reduce((a, b) => a + b, 0) / spreads.length).toFixed(1)
                                      : null
                                    return avg !== null ? (
                                      <div className="text-xs text-neon-purple">
                                        {parseFloat(avg) > 0 ? '-' : '+'}{Math.abs(parseFloat(avg))}
                                      </div>
                                    ) : null
                                  })()}
                                </td>
                              </tr>
                              
                              {/* Totals Row */}
                              <tr>
                                <td className="p-2 font-semibold">
                                  <div>O/U</div>
                                  <div className="text-xs text-muted-foreground">(Total)</div>
                                </td>
                                {game.sportsbooks?.map((bookmaker) => {
                                  const odds = game.odds[bookmaker]
                                  return (
                                    <td key={bookmaker} className="p-2 text-center">
                                      {odds?.total && (
                                        <div>
                                          <div className="text-xs text-neon-yellow">
                                            O {odds.total.line}
                                          </div>
                                          <div className="text-xs text-neon-yellow">
                                            U {odds.total.line}
                                          </div>
                                        </div>
                                      )}
                                      {!odds?.total && <span className="text-muted-foreground">-</span>}
                                    </td>
                                  )
                                })}
                                {/* Average Column for Totals */}
                                <td className="p-2 text-center bg-white/5">
                                  {(() => {
                                    const totals = game.sportsbooks
                                      ?.map(book => game.odds[book]?.total?.line)
                                      .filter(val => val !== undefined && val !== null) || []
                                    const avg = totals.length > 0 
                                      ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)
                                      : null
                                    return avg !== null ? (
                                      <div className="text-xs text-neon-yellow">
                                        O/U {avg}
                                      </div>
                                    ) : <span className="text-muted-foreground">-</span>
                                  })()}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Odds Movement Chart */}
                      <div className="lg:w-[400px] border-l border-white/10 pl-6">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-neon-green" />
                          <span className="text-sm font-semibold text-neon-green">Odds Movement</span>
                        </div>
                        <OddsChart gameId={game.id} sportsbooks={game.sportsbooks || []} />
                      </div>
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