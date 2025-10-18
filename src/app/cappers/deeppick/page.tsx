'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Sparkles, Brain, BarChart3, Shield, Flame } from 'lucide-react'

export default function DeepPickCapperPage() {
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
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
                DEEPPICK
              </h1>
              <p className="text-gray-400 text-lg">Meta-Algorithm Aggregator</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Capper Integration Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-effect border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Nexus</h3>
              </div>
              <p className="text-xs text-gray-400">Pattern Recognition</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Shiva</h3>
              </div>
              <p className="text-xs text-gray-400">Statistical Analysis</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-white">Cerberus</h3>
              </div>
              <p className="text-xs text-gray-400">Multi-Model</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">Ifrit</h3>
              </div>
              <p className="text-xs text-gray-400">Value Hunter</p>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm Strategy */}
        <Card className="glass-effect border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-400">How DeepPick Aggregates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Core Philosophy</h3>
                <p className="text-gray-400 italic mb-4">"Wisdom of the crowd. Aggregate the best minds."</p>
                
                <h4 className="font-semibold text-white mb-2">Consensus Logic:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">▸</span>
                    <span><strong>4/4 Agree (95%):</strong> 🌟 UNANIMOUS - Highest confidence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">▸</span>
                    <span><strong>3/4 Agree (80%):</strong> ⭐ STRONG CONSENSUS - High confidence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">▸</span>
                    <span><strong>2/4 Agree (60%):</strong> ✨ MODERATE - Proceed with caution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">▸</span>
                    <span><strong>No Consensus:</strong> ❌ SPLIT - No pick</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">How It Works</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="font-semibold text-white mb-1">1️⃣ Collect Votes</div>
                    <div className="text-sm text-gray-400">Each capper analyzes the game independently</div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="font-semibold text-white mb-1">2️⃣ Find Consensus</div>
                    <div className="text-sm text-gray-400">Count agreements and disagreements</div>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="font-semibold text-white mb-1">3️⃣ Make Pick</div>
                    <div className="text-sm text-gray-400">Only pick when consensus is strong (3+ agree)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-green-500/10 border border-purple-500/30 rounded-lg">
              <div className="font-semibold text-white mb-2">🎯 Why Aggregation Works</div>
              <p className="text-sm text-gray-400">
                By combining multiple algorithms with different approaches, DeepPick reduces individual biases and captures 
                opportunities that all experts agree on. This "wisdom of the crowd" approach historically produces the most 
                consistent long-term results.
              </p>
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

                    {/* Mock Capper Votes */}
                    <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Nexus</div>
                        <div className="text-sm font-bold text-purple-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Shiva</div>
                        <div className="text-sm font-bold text-blue-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Cerberus</div>
                        <div className="text-sm font-bold text-red-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Ifrit</div>
                        <div className="text-sm font-bold text-yellow-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Consensus</div>
                        <div className="text-sm font-bold text-gray-400">--/4</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 italic">
                      ⚠️ Algorithm not yet active - Waiting for individual cappers to be functional
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
                  DeepPick will activate once the individual capper algorithms are functional.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
