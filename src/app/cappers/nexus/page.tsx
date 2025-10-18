'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Brain, TrendingUp, Target, Zap } from 'lucide-react'

export default function NexusCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                NEXUS
              </h1>
              <p className="text-gray-400 text-lg">Pattern Recognition Specialist</p>
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
          <Card className="glass-effect border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Line Movement</h3>
              </div>
              <p className="text-sm text-gray-400">Tracks how odds shift over time to identify sharp money</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-pink-400" />
                <h3 className="font-semibold text-white">Historical Patterns</h3>
              </div>
              <p className="text-sm text-gray-400">Analyzes past matchups to find repeating trends</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Situational Edge</h3>
              </div>
              <p className="text-sm text-gray-400">Identifies home/away splits and rest advantages</p>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm Strategy */}
        <Card className="glass-effect border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-400">How Nexus Picks Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Core Philosophy</h3>
                <p className="text-gray-400 italic mb-4">"History repeats itself. Patterns reveal the future."</p>
                
                <h4 className="font-semibold text-white mb-2">Confidence Factors:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">▸</span>
                    <span><strong>High (80%+):</strong> Multiple patterns align with sharp line movement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">▸</span>
                    <span><strong>Medium (60-79%):</strong> Strong pattern but mixed signals</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">▸</span>
                    <span><strong>Low (&lt;60%):</strong> Weak pattern or conflicting data</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Key Indicators</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="font-semibold text-white mb-1">📊 Line Movement Score</div>
                    <div className="text-sm text-gray-400">Measures odds shifts and timing</div>
                  </div>
                  <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                    <div className="font-semibold text-white mb-1">🔄 Pattern Match</div>
                    <div className="text-sm text-gray-400">Historical matchup similarity</div>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="font-semibold text-white mb-1">⚡ Situational Edge</div>
                    <div className="text-sm text-gray-400">Home/away, rest, travel factors</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Game Analysis */}
        <Card className="glass-effect border-purple-500/30">
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
                  <div key={game.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {game.away_team?.name} @ {game.home_team?.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(game.game_date).toLocaleDateString()} • {game.sport?.toUpperCase()}
                        </div>
                      </div>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                        {game.status}
                      </Badge>
                    </div>

                    {/* Mock Analysis Display */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Confidence</div>
                        <div className="text-lg font-bold text-purple-400">---%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Pattern Match</div>
                        <div className="text-lg font-bold text-pink-400">--/100</div>
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

        {/* Status */}
        <Card className="glass-effect border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">⚠️</div>
              <div>
                <div className="font-semibold text-yellow-400 text-lg">Algorithm Development In Progress</div>
                <div className="text-gray-400 text-sm mt-1">
                  UI is ready. Pattern recognition logic will be implemented step-by-step.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
