'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Flame, TrendingUp, Zap, Target } from 'lucide-react'

/**
 * IFRIT - The Aggressive Underdog Hunter
 * 
 * Strategy: High-risk, high-reward underdog betting
 * Focus: Upset probability, value underdogs, contrarian plays
 */

export default function IfritCapperPage() {
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
    // IFRIT Algorithm - Underdog Hunter
    const analysis = {
      confidence: 0,
      pick: null as any,
      reasoning: [] as string[],
      underdogValue: 0,
      upsetProbability: 0
    }

    // Get odds
    const homeOdds = game.odds?.draftkings?.moneyline?.home || -110
    const awayOdds = game.odds?.draftkings?.moneyline?.away || -110

    // Identify underdog
    const isHomeUnderdog = homeOdds > awayOdds
    const underdogOdds = isHomeUnderdog ? homeOdds : awayOdds
    const underdogTeam = isHomeUnderdog ? game.home_team : game.away_team

    // Only interested in +150 or higher underdogs
    if (underdogOdds < 150) {
      analysis.reasoning.push('No significant underdog value')
      return analysis
    }

    analysis.pick = isHomeUnderdog ? 'home' : 'away'
    analysis.underdogValue = underdogOdds

    // 1. Underdog Value Score
    if (underdogOdds >= 150 && underdogOdds <= 300) {
      analysis.confidence += 40
      analysis.reasoning.push(`Sweet spot underdog: +${underdogOdds}`)
    } else if (underdogOdds > 300) {
      analysis.confidence += 30
      analysis.reasoning.push(`High-risk underdog: +${underdogOdds}`)
    }

    // 2. Upset Probability Factors
    const upsetFactors = calculateUpsetFactors(game, isHomeUnderdog)
    
    if (upsetFactors.recentForm > 0.6) {
      analysis.confidence += 20
      analysis.reasoning.push('Underdog in good form')
    }

    if (upsetFactors.motivation > 0.7) {
      analysis.confidence += 15
      analysis.reasoning.push('High motivation factor')
    }

    if (upsetFactors.matchupAdvantage > 0.6) {
      analysis.confidence += 15
      analysis.reasoning.push('Favorable matchup dynamics')
    }

    // 3. Contrarian Indicator
    // If public heavily on favorite, fade them
    const publicOnFavorite = Math.random() // Mock: would get real public betting %
    if (publicOnFavorite > 0.75) {
      analysis.confidence += 10
      analysis.reasoning.push('Fading heavy public favorite')
    }

    analysis.upsetProbability = analysis.confidence

    return analysis
  }

  const calculateUpsetFactors = (game: any, isHomeUnderdog: boolean) => {
    // Mock calculations - would use real data
    return {
      recentForm: Math.random(), // Underdog's recent performance
      motivation: Math.random(), // Revenge game, playoff implications, etc.
      matchupAdvantage: Math.random(), // Stylistic matchup favorability
      restAdvantage: Math.random(), // Rest days differential
      injuries: Math.random() // Key injuries to favorite
    }
  }

  const runIfritAlgorithm = async () => {
    setProcessing(true)
    try {
      const analyses = games.map(game => ({
        game,
        analysis: analyzeGame(game)
      }))

      // Filter for high-value underdogs (confidence > 50%)
      const underdogPicks = analyses.filter(a => 
        a.analysis.pick !== null && a.analysis.confidence > 50
      )

      // Sort by underdog value (highest odds first)
      underdogPicks.sort((a, b) => b.analysis.underdogValue - a.analysis.underdogValue)

      console.log('IFRIT Analysis:', underdogPicks)

      alert(`IFRIT found ${underdogPicks.length} underdog opportunities!`)
    } catch (error) {
      console.error('Error running Ifrit:', error)
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
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-red-500 bg-clip-text text-transparent animate-pulse">
            IFRIT - Underdog Hunter
          </h1>
          
          <div className="w-[120px]" />
        </div>

        {/* Algorithm Info */}
        <Card className="glass-effect border-2 border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Flame className="w-6 h-6" />
              Algorithm Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/30">
              <p className="text-yellow-300 font-bold mb-2">⚠️ HIGH VARIANCE STRATEGY</p>
              <p className="text-sm text-gray-300">
                Ifrit specializes in underdog betting with higher risk and higher reward potential. 
                Lower win rate but larger payouts when successful.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-white mb-2">Core Principles:</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Value Underdogs:</strong> Target +150 to +300 range</li>
                <li>• <strong>Upset Probability:</strong> Identify factors favoring underdog</li>
                <li>• <strong>Contrarian Approach:</strong> Fade heavy public favorites</li>
                <li>• <strong>Motivation Factors:</strong> Revenge games, playoff implications</li>
                <li>• <strong>Matchup Analysis:</strong> Stylistic advantages</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-2">Confidence Factors:</h3>
              <div className="grid grid-cols-2 gap-3">
                <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                  Underdog Value: +40%
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                  Recent Form: +20%
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                  Motivation: +15%
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                  Matchup Edge: +15%
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                  Public Fade: +10%
                </Badge>
              </div>
            </div>

            <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
              <h4 className="font-bold text-red-300 mb-2">Risk Profile:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">Target Win Rate:</div>
                  <div className="text-white font-bold">35-45%</div>
                </div>
                <div>
                  <div className="text-gray-400">Target ROI:</div>
                  <div className="text-white font-bold">10-15%</div>
                </div>
                <div>
                  <div className="text-gray-400">Avg Odds:</div>
                  <div className="text-white font-bold">+200</div>
                </div>
                <div>
                  <div className="text-gray-400">Variance:</div>
                  <div className="text-white font-bold">HIGH</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="glass-effect">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={runIfritAlgorithm}
                disabled={processing || loading}
                className="bg-gradient-to-r from-yellow-500 to-red-500 hover:from-yellow-600 hover:to-red-600 text-white font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                {processing ? 'Hunting...' : 'Run IFRIT Algorithm'}
              </Button>

              <Button
                onClick={fetchGames}
                disabled={loading}
                variant="outline"
                className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
              >
                <Target className="w-4 h-4 mr-2" />
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
            <CardTitle>Underdog Opportunities</CardTitle>
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
                  const hasValue = analysis.pick !== null && analysis.confidence > 40
                  
                  return (
                    <div key={game.id} className={`p-4 rounded-lg border ${
                      hasValue ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-gray-500/30 bg-gray-500/5'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-white">
                          {game.away_team.name} @ {game.home_team.name}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasValue && (
                            <Badge className="bg-yellow-500 text-black font-bold">
                              🔥 +{analysis.underdogValue}
                            </Badge>
                          )}
                          <Badge className={`${
                            analysis.confidence > 70 ? 'bg-green-500' :
                            analysis.confidence > 50 ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            {analysis.confidence.toFixed(0)}% Confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {game.game_date} • {game.sport.toUpperCase()}
                      </div>
                      {analysis.reasoning.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {analysis.reasoning.map((reason, i) => (
                            <div key={i} className="text-xs text-yellow-300">
                              • {reason}
                            </div>
                          ))}
                        </div>
                      )}
                      {hasValue && (
                        <div className="mt-3 p-2 rounded bg-yellow-500/20 border border-yellow-500/30">
                          <div className="text-xs font-bold text-yellow-300">
                            Upset Probability: {analysis.upsetProbability.toFixed(0)}%
                          </div>
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
        <Card className="glass-effect border border-yellow-500/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-yellow-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Public Betting Data</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Injury Impact Analysis</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Parlay Builder</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

