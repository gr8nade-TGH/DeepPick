'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Shield, Flame, Droplet, Wind } from 'lucide-react'
import AlgorithmDebugLogs from '@/components/cappers/algorithm-debug-logs'

export default function CerberusCapperPage() {
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
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/50">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                CERBERUS
              </h1>
              <p className="text-gray-400 text-lg">Multi-Model Consensus Guardian</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Three Heads Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-effect border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-white">Model A: Momentum</h3>
              </div>
              <p className="text-sm text-gray-400">Recent form, streaks, hot/cold teams</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-orange-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Droplet className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-white">Model B: Value</h3>
              </div>
              <p className="text-sm text-gray-400">Market inefficiencies, odds value</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Wind className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-white">Model C: Situational</h3>
              </div>
              <p className="text-sm text-gray-400">Matchup-specific factors</p>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm Strategy */}
        <Card className="glass-effect border-red-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-red-400">How Cerberus Picks Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Core Philosophy</h3>
                <p className="text-gray-400 italic mb-4">"Three heads are better than one. Consensus reduces risk."</p>
                
                <h4 className="font-semibold text-white mb-2">Consensus Rules:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">▸</span>
                    <span><strong>All 3 Agree (90%):</strong> 🔥 STRONG SIGNAL - High confidence pick</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400 mt-1">▸</span>
                    <span><strong>2 Agree (70%):</strong> ⚡ MODERATE SIGNAL - Solid pick</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">▸</span>
                    <span><strong>No Agreement:</strong> ❌ CONFLICTING - No pick</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Model Breakdown</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="font-semibold text-white mb-1 flex items-center gap-2">
                      <Flame className="w-4 h-4" /> Momentum Model
                    </div>
                    <div className="text-sm text-gray-400">Win streaks, recent performance, momentum indicators</div>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <div className="font-semibold text-white mb-1 flex items-center gap-2">
                      <Droplet className="w-4 h-4" /> Value Model
                    </div>
                    <div className="text-sm text-gray-400">Odds discrepancies, market overreactions</div>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="font-semibold text-white mb-1 flex items-center gap-2">
                      <Wind className="w-4 h-4" /> Situational Model
                    </div>
                    <div className="text-sm text-gray-400">Head-to-head, injuries, weather, travel</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Game Analysis */}
        <Card className="glass-effect border-red-500/30">
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
                  <div key={game.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-red-500/50 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {game.away_team?.name} @ {game.home_team?.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(game.game_date).toLocaleDateString()} • {game.sport?.toUpperCase()}
                        </div>
                      </div>
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                        {game.status}
                      </Badge>
                    </div>

                    {/* Mock Three-Head Analysis */}
                    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-700">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Model A</div>
                        <div className="text-sm font-bold text-red-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Model B</div>
                        <div className="text-sm font-bold text-orange-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Model C</div>
                        <div className="text-sm font-bold text-red-400">--</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Consensus</div>
                        <div className="text-sm font-bold text-gray-400">Analyzing...</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-500">
                        Agreement: --/3
                      </Badge>
                      <span className="text-xs text-gray-500 italic">
                        ⚠️ Algorithm not yet active
                      </span>
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
                  UI is ready. Three-model consensus logic will be implemented step-by-step.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Algorithm Debugging Section */}
        <AlgorithmDebugLogs capper="cerberus" capperName="Cerberus" />
      </div>
    </div>
  )
}
