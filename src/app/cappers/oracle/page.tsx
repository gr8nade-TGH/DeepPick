'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NavBar } from '@/components/navigation/nav-bar'
import { Brain, Search, TrendingUp, Sparkles, Globe, Database } from 'lucide-react'
import AlgorithmDebugLogs from '@/components/cappers/algorithm-debug-logs'

export default function OracleCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [apiKeySet, setApiKeySet] = useState(true)

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
      const response = await fetch('/api/run-oracle?trigger=manual', {
        method: 'POST',
      })
      const result = await response.json()
      if (result.success) {
        alert(`✅ Oracle generated ${result.picks?.length || 0} AI-powered picks!\n\nInsights:\n${result.analysis?.map((a: any) => `• ${a.selection} (${a.confidence}/10)`).join('\n')}`)
        window.location.reload()
      } else {
        if (result.error?.includes('PERPLEXITY_API_KEY')) {
          setApiKeySet(false)
          alert(`❌ ${result.error}\n\nGet your API key at: https://www.perplexity.ai/settings/api`)
        } else {
          alert(`❌ Error: ${result.error}`)
        }
      }
    } catch (error) {
      console.error('Error running algorithm:', error)
      alert('❌ Failed to run algorithm')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/50 animate-pulse">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                ORACLE
              </h1>
              <p className="text-gray-300 text-lg">AI-Powered Seer • Powered by Perplexity</p>
            </div>
          </div>
          <NavBar />
        </div>

        {/* API Key Warning */}
        {!apiKeySet && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-yellow-300 mb-2">Setup Required</h3>
                  <p className="text-yellow-200/80 text-sm mb-3">
                    Oracle requires a Perplexity API key to perform deep web research.
                  </p>
                  <ol className="text-sm text-yellow-200/70 space-y-1 mb-3">
                    <li>1. Get API key: <a href="https://www.perplexity.ai/settings/api" target="_blank" className="underline text-yellow-300">perplexity.ai/settings/api</a></li>
                    <li>2. Add to .env.local: <code className="bg-black/20 px-1 py-0.5 rounded">PERPLEXITY_API_KEY=pplx-xxx</code></li>
                    <li>3. Restart your dev server</li>
                  </ol>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
                    Cost: ~$0.02-0.05 per pick
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-effect border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Search className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Deep Research</h3>
              </div>
              <p className="text-sm text-gray-300">Real-time web search for injuries, trends, expert opinions</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-pink-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-5 h-5 text-pink-400" />
                <h3 className="font-semibold text-white">AI Analysis</h3>
              </div>
              <p className="text-sm text-gray-300">Weights factors, predicts scores, finds value</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-blue-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Smart Betting</h3>
              </div>
              <p className="text-sm text-gray-300">7+ confidence threshold, units based on edge</p>
            </CardContent>
          </Card>
        </div>

        {/* Run Algorithm */}
        <Card className="glass-effect border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">AI Control Center</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Oracle will research matchups, analyze data, and generate autonomous picks
                </p>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                    <Globe className="w-3 h-3 mr-1" />
                    Web Research
                  </Badge>
                  <Badge variant="outline" className="text-xs border-pink-500/30 text-pink-300">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Analysis
                  </Badge>
                  <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                    <Database className="w-3 h-3 mr-1" />
                    Max 3 picks
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={runAlgorithm} 
                disabled={running || loading || !apiKeySet}
                className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 text-white font-semibold px-8 py-6 text-lg shadow-lg shadow-purple-500/50"
              >
                {running ? '🔮 AI Analyzing...' : '✨ Run Oracle AI'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Algorithm Strategy */}
        <Card className="glass-effect border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-2xl text-purple-400">How Oracle Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">AI Philosophy</h3>
                <p className="text-gray-300 italic mb-4">"Let artificial intelligence find edges humans can't."</p>
                
                <h4 className="font-semibold text-white mb-2">Research Process:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">▸</span>
                    <span><strong>Step 1:</strong> Deep web search for matchup intel (injuries, trends, news)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-pink-400 mt-1">▸</span>
                    <span><strong>Step 2:</strong> AI analyzes data and assigns factor weights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">▸</span>
                    <span><strong>Step 3:</strong> Predicts score and compares to Vegas odds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400 mt-1">▸</span>
                    <span><strong>Step 4:</strong> Only bets when 7+ confidence and clear value exists</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Factor Weighting</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="font-semibold text-white mb-1">Vegas Comparison (30%)</div>
                    <div className="text-sm text-gray-300">How our prediction compares to the line</div>
                  </div>
                  <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
                    <div className="font-semibold text-white mb-1">Recent Form (20%)</div>
                    <div className="text-sm text-gray-300">Last 5 games, momentum, streaks</div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="font-semibold text-white mb-1">Injuries & Context (15%)</div>
                    <div className="text-sm text-gray-300">Key player availability, lineup changes</div>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="font-semibold text-white mb-1">Dynamic Factors (35%)</div>
                    <div className="text-sm text-gray-300">AI determines other relevant factors</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <h4 className="font-semibold text-white mb-2">Confidence → Units Mapping:</h4>
              <div className="grid grid-cols-5 gap-2 text-xs">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">7.0-7.9: 1u</Badge>
                <Badge className="bg-purple-500/30 text-purple-200 border-purple-500/40">8.0-8.9: 2u</Badge>
                <Badge className="bg-purple-500/40 text-purple-100 border-purple-500/50">9.0-9.4: 3u</Badge>
                <Badge className="bg-purple-500/50 text-white border-purple-500/60">9.5-9.7: 4u</Badge>
                <Badge className="bg-purple-500/60 text-white border-purple-500/70 font-bold">9.8+: 5u</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Game Analysis */}
        <Card className="glass-effect border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl text-white">Available for AI Analysis</CardTitle>
            <Button onClick={fetchGames} disabled={loading} size="sm">
              {loading ? 'Loading...' : 'Refresh Games'}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-gray-300">Loading games...</div>
            ) : games.length === 0 ? (
              <div className="text-center py-12 text-gray-300">No upcoming games available</div>
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

                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-purple-600 text-purple-400">
                        <Brain className="w-3 h-3 mr-1" />
                        Ready for AI
                      </Badge>
                      <span className="text-xs text-gray-400 italic">
                        Oracle will research and analyze this matchup
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost & Performance Info */}
        <Card className="glass-effect border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-xl text-white">Cost & Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div className="text-2xl font-bold text-purple-400 mb-1">~$0.02-0.05</div>
                <div className="text-sm text-gray-300">Per AI Pick</div>
                <div className="text-xs text-gray-400 mt-2">Includes research + analysis</div>
              </div>
              <div className="p-4 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <div className="text-2xl font-bold text-pink-400 mb-1">1-2 min</div>
                <div className="text-sm text-gray-300">Processing Time</div>
                <div className="text-xs text-gray-400 mt-2">Deep web research takes time</div>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-400 mb-1">Max 3</div>
                <div className="text-sm text-gray-300">Picks Per Run</div>
                <div className="text-xs text-gray-400 mt-2">Cost control measure</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Algorithm Debugging Section */}
        <AlgorithmDebugLogs capper="oracle" capperName="Oracle" />
      </div>
    </div>
  )
}

