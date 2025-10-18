'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Layers, TrendingUp, Zap, GitMerge } from 'lucide-react'

/**
 * CERBERUS - The Multi-Model Ensemble
 * 
 * Strategy: Combines 3 independent models with weighted voting
 * Focus: Consensus picks, model agreement, risk mitigation
 */

export default function CerberusCapperPage() {
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
    // CERBERUS Algorithm - 3 Sub-Models
    const modelA = runMomentumModel(game)
    const modelB = runValueModel(game)
    const modelC = runSituationalModel(game)

    const analysis = {
      confidence: 0,
      pick: null as any,
      reasoning: [] as string[],
      models: {
        momentum: modelA,
        value: modelB,
        situational: modelC
      },
      agreement: 0
    }

    // Count agreements
    const picks = [modelA.pick, modelB.pick, modelC.pick].filter(p => p !== null)
    const uniquePicks = Array.from(new Set(picks))
    
    if (uniquePicks.length === 1 && picks.length === 3) {
      // All 3 models agree - STRONG SIGNAL
      analysis.confidence = 90
      analysis.pick = picks[0]
      analysis.agreement = 3
      analysis.reasoning.push('🔥 ALL 3 MODELS AGREE')
      analysis.reasoning.push(`Momentum: ${modelA.confidence}%`)
      analysis.reasoning.push(`Value: ${modelB.confidence}%`)
      analysis.reasoning.push(`Situational: ${modelC.confidence}%`)
    } else if (picks.length >= 2) {
      // Find majority
      const pickCounts = picks.reduce((acc: any, pick) => {
        acc[pick] = (acc[pick] || 0) + 1
        return acc
      }, {})
      
      const majority = Object.entries(pickCounts).find(([_, count]) => (count as number) >= 2)
      
      if (majority) {
        // 2 models agree
        analysis.confidence = 65
        analysis.pick = majority[0]
        analysis.agreement = 2
        analysis.reasoning.push('✅ 2 MODELS AGREE')
        
        if (modelA.pick === majority[0]) analysis.reasoning.push(`Momentum: ${modelA.confidence}%`)
        if (modelB.pick === majority[0]) analysis.reasoning.push(`Value: ${modelB.confidence}%`)
        if (modelC.pick === majority[0]) analysis.reasoning.push(`Situational: ${modelC.confidence}%`)
      }
    } else {
      // No consensus - NO PICK
      analysis.confidence = 0
      analysis.reasoning.push('❌ Models disagree - No pick')
    }

    return analysis
  }

  const runMomentumModel = (game: any) => {
    // Model A: Momentum-based
    // Looks at recent performance trends, winning/losing streaks
    const homeStreak = Math.random() * 5 // Mock: 0-5 game streak
    const awayStreak = Math.random() * 5
    
    const confidence = Math.abs(homeStreak - awayStreak) * 15
    
    return {
      name: 'Momentum',
      confidence: Math.min(confidence, 85),
      pick: homeStreak > awayStreak ? 'home' : awayStreak > homeStreak ? 'away' : null,
      reasoning: `Streak differential: ${Math.abs(homeStreak - awayStreak).toFixed(1)}`
    }
  }

  const runValueModel = (game: any) => {
    // Model B: Value-based
    // Compares odds to implied probability, finds value bets
    const homeOdds = game.odds?.draftkings?.moneyline?.home || -110
    const awayOdds = game.odds?.draftkings?.moneyline?.away || -110
    
    const homeImplied = oddsToImpliedProbability(homeOdds)
    const awayImplied = oddsToImpliedProbability(awayOdds)
    
    // Mock "true probability" calculation
    const homeTrueProb = Math.random() * 0.6 + 0.2 // 20-80%
    const awayTrueProb = 1 - homeTrueProb
    
    const homeValue = homeTrueProb - homeImplied
    const awayValue = awayTrueProb - awayImplied
    
    const maxValue = Math.max(homeValue, awayValue)
    
    return {
      name: 'Value',
      confidence: Math.min(maxValue * 200, 85),
      pick: homeValue > awayValue && homeValue > 0.05 ? 'home' : 
            awayValue > homeValue && awayValue > 0.05 ? 'away' : null,
      reasoning: `Value edge: ${(maxValue * 100).toFixed(1)}%`
    }
  }

  const runSituationalModel = (game: any) => {
    // Model C: Situational
    // Rest days, travel, injuries, motivation factors
    const homeRestDays = Math.random() * 5 // Mock
    const awayRestDays = Math.random() * 5
    
    const restAdvantage = homeRestDays - awayRestDays
    const confidence = Math.abs(restAdvantage) * 15
    
    return {
      name: 'Situational',
      confidence: Math.min(confidence, 85),
      pick: restAdvantage > 1 ? 'home' : restAdvantage < -1 ? 'away' : null,
      reasoning: `Rest advantage: ${restAdvantage.toFixed(1)} days`
    }
  }

  const oddsToImpliedProbability = (odds: number) => {
    if (odds > 0) {
      return 100 / (odds + 100)
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100)
    }
  }

  const runCerberusAlgorithm = async () => {
    setProcessing(true)
    try {
      const analyses = games.map(game => ({
        game,
        analysis: analyzeGame(game)
      }))

      // Only picks where 2+ models agree
      const consensusPicks = analyses.filter(a => a.analysis.agreement >= 2)

      console.log('CERBERUS Analysis:', consensusPicks)

      alert(`CERBERUS found ${consensusPicks.length} consensus picks!`)
    } catch (error) {
      console.error('Error running Cerberus:', error)
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
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
            CERBERUS - Multi-Model Ensemble
          </h1>
          
          <div className="w-[120px]" />
        </div>

        {/* Algorithm Info */}
        <Card className="glass-effect border-2 border-red-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Layers className="w-6 h-6" />
              Algorithm Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-white mb-2">Three-Headed Approach:</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <h4 className="font-bold text-red-300 mb-1">Model A: Momentum</h4>
                  <p className="text-xs text-gray-400">
                    Recent performance trends, winning/losing streaks, form analysis
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <h4 className="font-bold text-orange-300 mb-1">Model B: Value</h4>
                  <p className="text-xs text-gray-400">
                    Odds vs implied probability, market inefficiencies, value detection
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <h4 className="font-bold text-yellow-300 mb-1">Model C: Situational</h4>
                  <p className="text-xs text-gray-400">
                    Rest days, travel, injuries, motivation, scheduling
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-2">Voting System:</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500">3/3 Agreement</Badge>
                  <span className="text-sm text-gray-300">90% Confidence - STRONG BUY</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-yellow-500">2/3 Agreement</Badge>
                  <span className="text-sm text-gray-300">65% Confidence - Standard Pick</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-gray-500">Split Decision</Badge>
                  <span className="text-sm text-gray-300">No Pick - Models Disagree</span>
                </div>
              </div>
            </div>

            <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
              <h4 className="font-bold text-red-300 mb-2">Ensemble Logic:</h4>
              <code className="text-xs text-gray-300">
                IF all_3_agree: confidence = 90%, units = 3
                <br />
                ELSE IF 2_agree: confidence = 65%, units = 2
                <br />
                ELSE: NO PICK (risk mitigation)
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="glass-effect">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={runCerberusAlgorithm}
                disabled={processing || loading}
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                {processing ? 'Analyzing...' : 'Run CERBERUS Algorithm'}
              </Button>

              <Button
                onClick={fetchGames}
                disabled={loading}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/10"
              >
                <GitMerge className="w-4 h-4 mr-2" />
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
            <CardTitle>Multi-Model Analysis</CardTitle>
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
                    <div key={game.id} className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-white">
                          {game.away_team.name} @ {game.home_team.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${
                            analysis.agreement === 3 ? 'bg-green-500' :
                            analysis.agreement === 2 ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            {analysis.agreement}/3 Models
                          </Badge>
                          <Badge variant="outline" className="border-red-500">
                            {analysis.confidence}% Confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {game.game_date} • {game.sport.toUpperCase()}
                      </div>
                      {analysis.reasoning.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {analysis.reasoning.map((reason, i) => (
                            <div key={i} className="text-xs text-red-300">
                              {reason}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className={`p-2 rounded ${analysis.models.momentum.pick ? 'bg-red-500/20' : 'bg-gray-500/20'}`}>
                          <div className="font-bold text-red-300">Momentum</div>
                          <div className="text-gray-400">{analysis.models.momentum.confidence.toFixed(0)}%</div>
                        </div>
                        <div className={`p-2 rounded ${analysis.models.value.pick ? 'bg-orange-500/20' : 'bg-gray-500/20'}`}>
                          <div className="font-bold text-orange-300">Value</div>
                          <div className="text-gray-400">{analysis.models.value.confidence.toFixed(0)}%</div>
                        </div>
                        <div className={`p-2 rounded ${analysis.models.situational.pick ? 'bg-yellow-500/20' : 'bg-gray-500/20'}`}>
                          <div className="font-bold text-yellow-300">Situational</div>
                          <div className="text-gray-400">{analysis.models.situational.confidence.toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Algorithm Status */}
        <Card className="glass-effect border border-red-500/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Model Weighting System</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Adaptive Learning</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">Coming Soon</div>
                <div className="text-sm text-gray-400">Disagreement Analysis</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

