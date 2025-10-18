'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Brain, TrendingUp, Zap } from 'lucide-react'

/**
 * NEXUS - The Pattern Recognition Bot
 * 
 * Strategy: Identifies historical patterns and trends
 * Focus: Line movement, public betting percentages, historical matchups
 */

export default function NexusCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

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

  const analyzeGame = (game: any) => {
    // NEXUS Algorithm Logic
    const analysis = {
      confidence: 0,
      pick: null as any,
      reasoning: [] as string[]
    }

    // 1. Line Movement Analysis
    const oddsHistory = game.odds_history || []
    if (oddsHistory.length > 2) {
      // Check if line is moving
      const lineMovement = calculateLineMovement(oddsHistory)
      if (lineMovement.significant) {
        analysis.confidence += 15
        analysis.reasoning.push(`Line moving ${lineMovement.direction} (${lineMovement.amount} points)`)
      }
    }

    // 2. Odds Value Detection
    const avgOdds = calculateAverageOdds(game)
    const bestOdds = findBestOdds(game)
    if (bestOdds.value > avgOdds.value * 1.05) {
      analysis.confidence += 20
      analysis.reasoning.push(`Found ${((bestOdds.value - avgOdds.value) / avgOdds.value * 100).toFixed(1)}% value at ${bestOdds.book}`)
    }

    // 3. Consensus Fade (contrarian)
    // If public heavily on one side, fade them
    // This would require public betting data (not available yet)

    // 4. Sharp Money Indicator
    // Look for reverse line movement (line moves opposite to public)
    // This indicates sharp money

    return analysis
  }

  const calculateLineMovement = (history: any[]) => {
    // Placeholder - implement actual line movement calculation
    return { significant: false, direction: 'up', amount: 0 }
  }

  const calculateAverageOdds = (game: any) => {
    // Placeholder - calculate average odds across books
    return { value: 0 }
  }

  const findBestOdds = (game: any) => {
    // Placeholder - find best odds
    return { value: 0, book: '' }
  }

  const runNexusAlgorithm = async () => {
    setProcessing(true)
    try {
      // Analyze all games
      const analyses = games.map(game => ({
        game,
        analysis: analyzeGame(game)
      }))

      // Filter for high confidence picks (>60%)
      const highConfidencePicks = analyses.filter(a => a.analysis.confidence > 60)

      console.log('NEXUS Analysis:', highConfidencePicks)

      // TODO: Auto-place picks for high confidence games
      // For now, just log them

      alert(`NEXUS found ${highConfidencePicks.length} high-confidence picks!`)
    } catch (error) {
      console.error('Error running Nexus:', error)
    } finally {
      setProcessing(false)
    }
  }

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
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            NEXUS - Pattern Recognition
          </h1>
          
          <div className="w-[120px]" />
        </div>

        {/* Algorithm Info */}
        <Card className="glass-effect border-2 border-purple-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-400">
              <Brain className="w-6 h-6" />
              Algorithm Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-white mb-2">Core Principles:</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Line Movement Analysis:</strong> Tracks odds changes across sportsbooks</li>
                <li>• <strong>Value Detection:</strong> Finds discrepancies between books</li>
                <li>• <strong>Sharp Money Indicators:</strong> Identifies professional bettor activity</li>
                <li>• <strong>Contrarian Approach:</strong> Fades public when appropriate</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-2">Confidence Factors:</h3>
              <div className="grid grid-cols-2 gap-3">
                <Badge variant="outline" className="border-purple-500 text-purple-300">
                  Line Movement: +15%
                </Badge>
                <Badge variant="outline" className="border-purple-500 text-purple-300">
                  Odds Value: +20%
                </Badge>
                <Badge variant="outline" className="border-purple-500 text-purple-300">
                  Sharp Action: +25%
                </Badge>
                <Badge variant="outline" className="border-purple-500 text-purple-300">
                  Public Fade: +15%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="glass-effect">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={runNexusAlgorithm}
                disabled={processing || loading}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                {processing ? 'Analyzing...' : 'Run NEXUS Algorithm'}
              </Button>

              <Button
                onClick={fetchGames}
                disabled={loading}
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Refresh Games
              </Button>

              <div className="ml-auto text-sm text-gray-400">
                {games.length} games available for analysis
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Games Analysis */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle>Live Game Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-400">Loading games...</div>
            ) : games.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No games available</div>
            ) : (
              <div className="space-y-4">
                {games.slice(0, 5).map((game) => {
                  const analysis = analyzeGame(game)
                  return (
                    <div key={game.id} className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-white">
                          {game.away_team.name} @ {game.home_team.name}
                        </div>
                        <Badge className={`${
                          analysis.confidence > 70 ? 'bg-green-500' :
                          analysis.confidence > 50 ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}>
                          {analysis.confidence}% Confidence
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400">
                        {game.game_date} • {game.sport.toUpperCase()}
                      </div>
                      {analysis.reasoning.length > 0 && (
                        <div className="mt-2 text-xs text-purple-300">
                          {analysis.reasoning.join(' • ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Algorithm Status */}
        <Card className="glass-effect border border-purple-500/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Auto-Pick Placement</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Public Betting Data</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">Coming Soon</div>
                <div className="text-sm text-gray-400">ML Pattern Recognition</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

