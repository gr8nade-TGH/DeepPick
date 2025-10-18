'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NavBar } from '@/components/navigation/nav-bar'
import { Home, BarChart3, Activity, TrendingUp, Calculator } from 'lucide-react'
import AlgorithmDebugLogs from '@/components/cappers/algorithm-debug-logs'

export default function ShivaCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)

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
    try {
      const response = await fetch('/api/run-shiva?trigger=manual', {
        method: 'POST',
      })
      const result = await response.json()
      if (result.success) {
        alert(`✅ Shiva generated ${result.picks?.length || 0} picks!`)
        window.location.reload()
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error running algorithm:', error)
      alert('❌ Failed to run algorithm')
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
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                SHIVA
              </h1>
              <p className="text-gray-400 text-lg">Statistical Powerhouse</p>
            </div>
          </div>
          <NavBar />
        </div>

        {/* Strategy Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-effect border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Efficiency Ratings</h3>
              </div>
              <p className="text-sm text-gray-400">Offensive and defensive performance metrics</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Calculator className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white">Expected Value</h3>
              </div>
              <p className="text-sm text-gray-400">Point differential and spread calculations</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Regression Analysis</h3>
              </div>
              <p className="text-sm text-gray-400">Statistical models and trend forecasting</p>
            </CardContent>
          </Card>
        </div>

        {/* Run Algorithm */}
        <Card className="glass-effect border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Algorithm Control</h3>
                <p className="text-sm text-gray-400">Manually trigger Shiva to analyze current games and generate picks</p>
              </div>
              <Button 
                onClick={runAlgorithm} 
                disabled={running || loading}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold px-8 py-6 text-lg shadow-lg shadow-blue-500/50"
              >
                {running ? '⏳ Running...' : '🔱 Run Shiva Algorithm'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Algorithm Strategy */}
        <Card className="glass-effect border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-blue-400">How Shiva Picks Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Core Philosophy</h3>
                <p className="text-gray-400 italic mb-4">"Numbers don't lie. Statistical edges win long-term."</p>
                
                <h4 className="font-semibold text-white mb-2">Confidence Factors:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">▸</span>
                    <span><strong>High (85%+):</strong> Large statistical edge with significance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">▸</span>
                    <span><strong>Medium (65-84%):</strong> Moderate edge with good sample size</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">▸</span>
                    <span><strong>Low (&lt;65%):</strong> Small edge or limited data</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Key Metrics</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="font-semibold text-white mb-1">📈 Offensive Efficiency</div>
                    <div className="text-sm text-gray-400">Points per possession, scoring rate</div>
                  </div>
                  <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <div className="font-semibold text-white mb-1">🛡️ Defensive Rating</div>
                    <div className="text-sm text-gray-400">Points allowed, defensive metrics</div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="font-semibold text-white mb-1">📊 Expected Differential</div>
                    <div className="text-sm text-gray-400">Projected point spread</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Game Analysis */}
        <Card className="glass-effect border-blue-500/30">
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
                  <div key={game.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {game.away_team?.name} @ {game.home_team?.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(game.game_date).toLocaleDateString()} • {game.sport?.toUpperCase()}
                        </div>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                        {game.status}
                      </Badge>
                    </div>

                    {/* Mock Analysis Display */}
                    <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Confidence</div>
                        <div className="text-lg font-bold text-blue-400">---%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Off. Edge</div>
                        <div className="text-lg font-bold text-cyan-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Def. Edge</div>
                        <div className="text-lg font-bold text-cyan-400">--</div>
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

        {/* Algorithm Debugging Section */}
        <AlgorithmDebugLogs capper="shiva" capperName="Shiva" />
      </div>
    </div>
  )
}
