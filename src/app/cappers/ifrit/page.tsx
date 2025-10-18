'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NavBar } from '@/components/navigation/nav-bar'
import { Home, Flame, Target, TrendingUp, Zap } from 'lucide-react'
import AlgorithmDebugLogs from '@/components/cappers/algorithm-debug-logs'

export default function IfritCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetchGames()
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
          <NavBar />
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
        <AlgorithmDebugLogs capper="ifrit" capperName="Ifrit" />
      </div>
    </div>
  )
}
