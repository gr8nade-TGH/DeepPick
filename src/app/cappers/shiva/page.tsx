'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Calculator, TrendingUp, Zap, BarChart3 } from 'lucide-react'

/**
 * SHIVA - The Statistical Powerhouse
 * 
 * Strategy: Advanced statistics, regression models, Elo ratings
 * Focus: Team performance metrics, efficiency ratings, matchup analysis
 */

export default function ShivaCapperPage() {
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
    // SHIVA Algorithm Logic
    const analysis = {
      confidence: 0,
      pick: null as any,
      reasoning: [] as string[],
      stats: {} as any
    }

    // 1. Calculate Team Efficiency Ratings
    const homeEfficiency = calculateTeamEfficiency(game.home_team)
    const awayEfficiency = calculateTeamEfficiency(game.away_team)
    
    const efficiencyDiff = Math.abs(homeEfficiency - awayEfficiency)
    if (efficiencyDiff > 5) {
      analysis.confidence += 25
      analysis.reasoning.push(`${efficiencyDiff.toFixed(1)}% efficiency advantage`)
      analysis.stats.efficiencyEdge = efficiencyDiff
    }

    // 2. Elo Rating System
    const homeElo = getEloRating(game.home_team, game.sport)
    const awayElo = getEloRating(game.away_team, game.sport)
    const eloDiff = Math.abs(homeElo - awayElo)
    
    if (eloDiff > 100) {
      analysis.confidence += 20
      analysis.reasoning.push(`${eloDiff} Elo rating difference`)
      analysis.stats.eloDiff = eloDiff
    }

    // 3. Home/Away Performance Split
    const homeAdvantage = calculateHomeAdvantage(game.home_team, game.sport)
    if (homeAdvantage > 0.6) {
      analysis.confidence += 15
      analysis.reasoning.push(`Strong home performance (${(homeAdvantage * 100).toFixed(0)}%)`)
    }

    // 4. Recent Form Analysis (last 5 games)
    const homeForm = calculateRecentForm(game.home_team)
    const awayForm = calculateRecentForm(game.away_team)
    const formDiff = Math.abs(homeForm - awayForm)
    
    if (formDiff > 0.3) {
      analysis.confidence += 15
      analysis.reasoning.push(`Significant form difference`)
    }

    // 5. Matchup History
    const h2hAdvantage = getHeadToHeadAdvantage(game.home_team, game.away_team)
    if (h2hAdvantage > 0.65) {
      analysis.confidence += 10
      analysis.reasoning.push(`Historical matchup advantage`)
    }

    // 6. Regression to Mean
    const regressionOpportunity = checkRegressionOpportunity(game)
    if (regressionOpportunity.exists) {
      analysis.confidence += 15
      analysis.reasoning.push(`Regression opportunity detected`)
    }

    return analysis
  }

  const calculateTeamEfficiency = (team: any) => {
    // Placeholder - would calculate offensive/defensive efficiency
    // Based on points per possession, turnover rate, etc.
    return Math.random() * 20 + 80 // Mock: 80-100
  }

  const getEloRating = (team: any, sport: string) => {
    // Placeholder - would fetch/calculate Elo rating
    // Starting Elo: 1500, ranges typically 1200-1800
    return Math.random() * 600 + 1200 // Mock: 1200-1800
  }

  const calculateHomeAdvantage = (team: any, sport: string) => {
    // Placeholder - calculate home win %
    return Math.random() * 0.4 + 0.4 // Mock: 40-80%
  }

  const calculateRecentForm = (team: any) => {
    // Placeholder - calculate win % in last 5 games
    return Math.random() // Mock: 0-1
  }

  const getHeadToHeadAdvantage = (home: any, away: any) => {
    // Placeholder - historical matchup win rate
    return Math.random() // Mock: 0-1
  }

  const checkRegressionOpportunity = (game: any) => {
    // Placeholder - check if team is over/underperforming expectations
    return { exists: Math.random() > 0.7, direction: 'up' }
  }

  const runShivaAlgorithm = async () => {
    setProcessing(true)
    try {
      const analyses = games.map(game => ({
        game,
        analysis: analyzeGame(game)
      }))

      // Filter for high confidence picks (>65%)
      const highConfidencePicks = analyses.filter(a => a.analysis.confidence > 65)

      console.log('SHIVA Analysis:', highConfidencePicks)

      alert(`SHIVA found ${highConfidencePicks.length} high-confidence picks!`)
    } catch (error) {
      console.error('Error running Shiva:', error)
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
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
            SHIVA - Statistical Powerhouse
          </h1>
          
          <div className="w-[120px]" />
        </div>

        {/* Algorithm Info */}
        <Card className="glass-effect border-2 border-blue-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Calculator className="w-6 h-6" />
              Algorithm Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-white mb-2">Core Principles:</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• <strong>Efficiency Ratings:</strong> Offensive/defensive performance metrics</li>
                <li>• <strong>Elo System:</strong> Dynamic team strength ratings</li>
                <li>• <strong>Advanced Stats:</strong> Possession, pace, turnover rates</li>
                <li>• <strong>Regression Analysis:</strong> Identify over/underperforming teams</li>
                <li>• <strong>Matchup Analytics:</strong> Historical H2H performance</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-2">Confidence Factors:</h3>
              <div className="grid grid-cols-2 gap-3">
                <Badge variant="outline" className="border-blue-500 text-blue-300">
                  Efficiency Edge: +25%
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-300">
                  Elo Advantage: +20%
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-300">
                  Home Advantage: +15%
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-300">
                  Recent Form: +15%
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-300">
                  H2H History: +10%
                </Badge>
                <Badge variant="outline" className="border-blue-500 text-blue-300">
                  Regression: +15%
                </Badge>
              </div>
            </div>

            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
              <h4 className="font-bold text-blue-300 mb-2">Statistical Model:</h4>
              <code className="text-xs text-gray-300">
                Confidence = Σ(efficiency_edge, elo_diff, home_adv, form, h2h, regression)
                <br />
                Pick Threshold: confidence &gt; 65%
                <br />
                Unit Sizing: (confidence - 50) / 10
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="glass-effect">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={runShivaAlgorithm}
                disabled={processing || loading}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                {processing ? 'Analyzing...' : 'Run SHIVA Algorithm'}
              </Button>

              <Button
                onClick={fetchGames}
                disabled={loading}
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
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
            <CardTitle>Statistical Analysis</CardTitle>
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
                    <div key={game.id} className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-white">
                          {game.away_team.name} @ {game.home_team.name}
                        </div>
                        <Badge className={`${
                          analysis.confidence > 75 ? 'bg-green-500' :
                          analysis.confidence > 60 ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}>
                          {analysis.confidence.toFixed(0)}% Confidence
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {game.game_date} • {game.sport.toUpperCase()}
                      </div>
                      {analysis.reasoning.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {analysis.reasoning.map((reason, i) => (
                            <div key={i} className="text-xs text-blue-300">
                              • {reason}
                            </div>
                          ))}
                        </div>
                      )}
                      {analysis.stats && Object.keys(analysis.stats).length > 0 && (
                        <div className="mt-2 flex gap-3 text-xs">
                          {analysis.stats.efficiencyEdge && (
                            <span className="text-cyan-400">
                              Efficiency: {analysis.stats.efficiencyEdge.toFixed(1)}%
                            </span>
                          )}
                          {analysis.stats.eloDiff && (
                            <span className="text-cyan-400">
                              Elo Δ: {analysis.stats.eloDiff.toFixed(0)}
                            </span>
                          )}
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
        <Card className="glass-effect border border-blue-500/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Real Team Stats API</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Live Elo Ratings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">Coming Soon</div>
                <div className="text-sm text-gray-400">ML Regression Models</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

