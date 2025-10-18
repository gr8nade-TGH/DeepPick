'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Flame, Target, TrendingUp, Zap, Bug, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface AlgorithmLog {
  id: string
  triggerType: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  status: string
  gamesAnalyzed: number
  picksGenerated: number
  picksSkipped: number
  errorMessage?: string
  summary?: any
}

export default function IfritCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [logs, setLogs] = useState<AlgorithmLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    fetchGames()
    fetchLogs()
  }, [])

  const fetchGames = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/odds')
      const data = await response.json()
      if (data.success) {
        setGames(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const response = await fetch('/api/algorithm-logs?capper=ifrit&limit=20')
      const data = await response.json()
      if (data.success) {
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const runAlgorithm = async () => {
    setRunning(true)
    setResult(null)
    try {
      const response = await fetch('/api/run-ifrit?trigger=manual', {
        method: 'POST',
      })
      const data = await response.json()
      setResult(data)
      
      if (data.success) {
        alert(`✅ Ifrit generated ${data.picks?.length || 0} picks! Check the dashboard.`)
        // Refresh logs after running
        fetchLogs()
      } else {
        alert(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error running algorithm:', error)
      alert('❌ Error running algorithm')
    } finally {
      setRunning(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'no_picks':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'no_games':
        return <AlertCircle className="w-5 h-5 text-gray-400" />
      default:
        return <Clock className="w-5 h-5 text-blue-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'no_picks':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'no_games':
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400'
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-yellow-500 to-red-500 flex items-center justify-center shadow-lg shadow-yellow-500/50 animate-pulse">
              <Flame className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-red-400 bg-clip-text text-transparent">
                IFRIT
              </h1>
              <p className="text-gray-400 text-lg">Aggressive Value Hunter</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Strategy Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-effect border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Underdog Hunter</h3>
              </div>
              <p className="text-sm text-gray-400">Targets high-value underdogs with upside</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-white">Market Overreaction</h3>
              </div>
              <p className="text-sm text-gray-400">Identifies when public overvalues favorites</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Contrarian Edge</h3>
              </div>
              <p className="text-sm text-gray-400">Fades public, follows sharp money</p>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm Strategy */}
        <Card className="glass-effect border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-yellow-400">How Ifrit Picks Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Core Philosophy</h3>
                <p className="text-gray-400 italic mb-4">"High risk, high reward. Attack market inefficiencies."</p>
                
                <h4 className="font-semibold text-white mb-2">Risk Profile:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">▸</span>
                    <span><strong>Lower Win Rate:</strong> ~45-50% (vs 55% for others)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">▸</span>
                    <span><strong>Higher Payouts:</strong> Targets +150 to +300 odds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">▸</span>
                    <span><strong>High Variance:</strong> Boom or bust approach</span>
                  </li>
                </ul>

                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="font-semibold text-orange-400 mb-1">⚡ HIGH VARIANCE WARNING</div>
                  <div className="text-xs text-gray-400">
                    Ifrit is designed for aggressive bankroll management. Expect swings.
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Value Indicators</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="font-semibold text-white mb-1">🎯 Underdog Value</div>
                    <div className="text-sm text-gray-400">Public fade opportunities, inflated lines</div>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="font-semibold text-white mb-1">📊 Market Sentiment</div>
                    <div className="text-sm text-gray-400">Betting percentages vs line movement</div>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="font-semibold text-white mb-1">⚡ Sharp Action</div>
                    <div className="text-sm text-gray-400">Reverse line movement indicators</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Game Analysis */}
        <Card className="glass-effect border-yellow-500/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl text-white">Live Game Analysis</CardTitle>
            <Button onClick={fetchGames} disabled={loading} size="sm">
              {loading ? 'Loading...' : 'Refresh Games'}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading games...</div>
            ) : games.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No upcoming games available</div>
            ) : (
              <div className="space-y-4">
                {games.slice(0, 5).map((game) => (
                  <div key={game.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-yellow-500/50 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {game.away_team?.name} @ {game.home_team?.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(game.game_date).toLocaleDateString()} • {game.sport?.toUpperCase()}
                        </div>
                      </div>
                      <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                        {game.status}
                      </Badge>
                    </div>

                    {/* Mock Analysis Display */}
                    <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Value Score</div>
                        <div className="text-lg font-bold text-yellow-400">--/100</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Public %</div>
                        <div className="text-lg font-bold text-red-400">--%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Expected Odds</div>
                        <div className="text-lg font-bold text-yellow-400">+---</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Suggested Pick</div>
                        <div className="text-lg font-bold text-gray-400">Analyzing...</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 italic">
                      ⚠️ Algorithm not yet active - Analysis coming soon
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run Algorithm */}
        <Card className="glass-effect border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-red-500/10">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="text-5xl">🔥</div>
              <h3 className="text-2xl font-bold text-white">Ready to Generate Picks</h3>
              <p className="text-gray-300">
                Ifrit will analyze all scheduled games and generate high-scoring OVER picks
              </p>
              <Button
                onClick={runAlgorithm}
                disabled={running}
                size="lg"
                className="bg-gradient-to-r from-yellow-500 to-red-500 hover:from-yellow-600 hover:to-red-600 text-white font-bold text-lg px-8 py-6 shadow-lg"
              >
                <Flame className="w-6 h-6 mr-2" />
                {running ? 'Running Algorithm...' : 'Run Ifrit Algorithm'}
              </Button>
              
              {result && result.success && (
                <div className="mt-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <p className="text-green-400 font-semibold">
                    ✅ Generated {result.picks?.length || 0} picks!
                  </p>
                  {result.analysis && result.analysis.length > 0 && (
                    <div className="mt-3 text-left space-y-2">
                      {result.analysis.map((pick: any, i: number) => (
                        <div key={i} className="text-sm text-gray-300">
                          <strong>{pick.selection}</strong> - {pick.confidence}% confidence ({pick.units}u)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Algorithm Debugging Section */}
        <Card className="glass-effect border-purple-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bug className="w-6 h-6 text-purple-400" />
                <CardTitle className="text-white">Algorithm Run Logs</CardTitle>
              </div>
              <Button
                onClick={fetchLogs}
                disabled={logsLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Every algorithm run is logged here - see what happened, why picks were generated or passed, and debug any errors
            </p>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-center py-8 text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No algorithm runs yet</p>
                <p className="text-sm mt-1">Run the algorithm manually or wait for the automated cron (every 20 min)</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg border ${getStatusColor(log.status)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(log.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">
                              {log.status === 'success' ? '✅ Success' :
                               log.status === 'error' ? '❌ Error' :
                               log.status === 'no_picks' ? '⚠️ No Picks Generated' :
                               log.status === 'no_games' ? '📭 No Games Available' :
                               '🔄 Running'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.triggerType}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-gray-300 space-y-1">
                            <div className="flex items-center gap-4">
                              <span>
                                <Clock className="w-3 h-3 inline mr-1" />
                                {new Date(log.startedAt).toLocaleString()}
                              </span>
                              {log.durationMs && (
                                <span className="text-gray-400">
                                  ({(log.durationMs / 1000).toFixed(2)}s)
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs">
                              <span>
                                📊 {log.gamesAnalyzed} games analyzed
                              </span>
                              <span className="text-green-400">
                                ✅ {log.picksGenerated} picks generated
                              </span>
                              {log.picksSkipped > 0 && (
                                <span className="text-yellow-400">
                                  ⏭️ {log.picksSkipped} skipped (duplicates)
                                </span>
                              )}
                            </div>

                            {log.errorMessage && (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                                <strong>Error:</strong> {log.errorMessage}
                              </div>
                            )}

                            {log.summary && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-purple-400 hover:text-purple-300">
                                  View Details
                                </summary>
                                <div className="mt-2 p-3 bg-gray-800/50 rounded text-xs space-y-2">
                                  {log.summary.gamesWithOdds !== undefined && (
                                    <div>
                                      <strong>Games with odds:</strong> {log.summary.gamesWithOdds}
                                    </div>
                                  )}
                                  {log.summary.gamesWithoutOdds > 0 && (
                                    <div className="text-yellow-400">
                                      <strong>Games without odds:</strong> {log.summary.gamesWithoutOdds}
                                    </div>
                                  )}
                                  {log.summary.existingPicksFound > 0 && (
                                    <div>
                                      <strong>Existing picks found:</strong> {log.summary.existingPicksFound} games
                                    </div>
                                  )}
                                  {log.summary.generatedPicks && log.summary.generatedPicks.length > 0 && (
                                    <div>
                                      <strong>Generated Picks:</strong>
                                      <ul className="ml-4 mt-1 space-y-1">
                                        {log.summary.generatedPicks.map((pick: any, i: number) => (
                                          <li key={i} className="text-green-400">
                                            • {pick.selection} ({pick.confidence}% confidence)
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {log.summary.errors && log.summary.errors.length > 0 && (
                                    <div className="text-red-400">
                                      <strong>Errors:</strong>
                                      <ul className="ml-4 mt-1 space-y-1">
                                        {log.summary.errors.map((err: string, i: number) => (
                                          <li key={i}>• {err}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
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
