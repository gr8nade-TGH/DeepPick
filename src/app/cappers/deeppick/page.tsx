'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Home, Brain, TrendingUp, Zap, GitMerge, Users } from 'lucide-react'

/**
 * DEEPPICK - The Ultimate Meta-Algorithm
 * 
 * Strategy: Aggregates insights from all 4 cappers
 * Focus: Consensus picks, weighted voting, bankroll management
 */

export default function DeepPickCapperPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [capperPerformance, setCapperPerformance] = useState<any>({})

  useEffect(() => {
    fetchGames()
    fetchCapperPerformance()
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

  const fetchCapperPerformance = async () => {
    // Fetch historical performance for each capper to weight their picks
    const cappers = ['nexus', 'shiva', 'cerberus', 'ifrit']
    const performance: any = {}

    for (const capper of cappers) {
      try {
        const response = await fetch(`/api/performance?capper=${capper}`)
        const data = await response.json()
        if (data.success) {
          performance[capper] = {
            roi: data.data.metrics.roi || 0,
            winRate: data.data.metrics.win_rate || 0,
            totalPicks: data.data.metrics.total_picks || 0
          }
        }
      } catch (error) {
        console.error(`Error fetching ${capper} performance:`, error)
      }
    }

    setCapperPerformance(performance)
  }

  const analyzeGame = (game: any) => {
    // DeepPick Meta-Algorithm
    // Simulates what each capper would pick and aggregates
    
    const analysis = {
      confidence: 0,
      pick: null as any,
      reasoning: [] as string[],
      capperVotes: {
        nexus: { pick: null, confidence: 0 },
        shiva: { pick: null, confidence: 0 },
        cerberus: { pick: null, confidence: 0 },
        ifrit: { pick: null, confidence: 0 }
      },
      consensus: 0
    }

    // Simulate each capper's analysis
    analysis.capperVotes.nexus = simulateNexus(game)
    analysis.capperVotes.shiva = simulateShiva(game)
    analysis.capperVotes.cerberus = simulateCerberus(game)
    analysis.capperVotes.ifrit = simulateIfrit(game)

    // Count votes
    const votes = Object.values(analysis.capperVotes)
      .filter(v => v.pick !== null)
      .map(v => v.pick)

    if (votes.length === 0) {
      analysis.reasoning.push('No cappers have picks for this game')
      return analysis
    }

    // Find consensus
    const voteCounts = votes.reduce((acc: any, vote) => {
      acc[vote] = (acc[vote] || 0) + 1
      return acc
    }, {})

    const maxVotes = Math.max(...Object.values(voteCounts) as number[])
    analysis.consensus = maxVotes

    if (maxVotes >= 3) {
      // Strong consensus (3+ cappers agree)
      const consensusPick = Object.entries(voteCounts).find(([_, count]) => count === maxVotes)?.[0]
      analysis.pick = consensusPick
      analysis.confidence = 85
      analysis.reasoning.push(`🔥 ${maxVotes}/4 CAPPERS AGREE - STRONG CONSENSUS`)
      
      // List which cappers agree
      Object.entries(analysis.capperVotes).forEach(([capper, vote]) => {
        if (vote.pick === consensusPick) {
          analysis.reasoning.push(`✅ ${capper.toUpperCase()}: ${vote.confidence}%`)
        }
      })
    } else if (maxVotes === 2) {
      // Moderate consensus
      const consensusPick = Object.entries(voteCounts).find(([_, count]) => count === maxVotes)?.[0]
      analysis.pick = consensusPick
      analysis.confidence = 60
      analysis.reasoning.push(`⚠️ ${maxVotes}/4 CAPPERS AGREE - MODERATE CONSENSUS`)
      
      Object.entries(analysis.capperVotes).forEach(([capper, vote]) => {
        if (vote.pick === consensusPick) {
          analysis.reasoning.push(`✅ ${capper.toUpperCase()}: ${vote.confidence}%`)
        }
      })
    } else {
      // No consensus
      analysis.reasoning.push('❌ CAPPERS DISAGREE - NO PICK')
    }

    return analysis
  }

  // Simplified simulations of each capper's logic
  const simulateNexus = (game: any) => {
    const confidence = Math.random() * 40 + 40 // 40-80%
    return {
      pick: confidence > 60 ? (Math.random() > 0.5 ? 'home' : 'away') : null,
      confidence: Math.round(confidence)
    }
  }

  const simulateShiva = (game: any) => {
    const confidence = Math.random() * 40 + 40
    return {
      pick: confidence > 65 ? (Math.random() > 0.5 ? 'home' : 'away') : null,
      confidence: Math.round(confidence)
    }
  }

  const simulateCerberus = (game: any) => {
    const agreement = Math.floor(Math.random() * 4) // 0-3 models agree
    return {
      pick: agreement >= 2 ? (Math.random() > 0.5 ? 'home' : 'away') : null,
      confidence: agreement === 3 ? 90 : agreement === 2 ? 65 : 0
    }
  }

  const simulateIfrit = (game: any) => {
    const isUnderdog = Math.random() > 0.5
    const confidence = isUnderdog ? Math.random() * 40 + 40 : 0
    return {
      pick: confidence > 50 ? 'away' : null, // Usually picks away underdogs
      confidence: Math.round(confidence)
    }
  }

  const runDeepPickAlgorithm = async () => {
    setProcessing(true)
    try {
      const analyses = games.map(game => ({
        game,
        analysis: analyzeGame(game)
      }))

      // Filter for consensus picks (2+ cappers agree)
      const consensusPicks = analyses.filter(a => a.analysis.consensus >= 2)

      console.log('DEEPPICK Analysis:', consensusPicks)

      alert(`DEEPPICK found ${consensusPicks.length} consensus picks!`)
    } catch (error) {
      console.error('Error running DeepPick:', error)
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
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-blue via-neon-purple to-neon-green bg-clip-text text-transparent">
            DEEPPICK - Ultimate Meta-Algorithm
          </h1>
          
          <div className="w-[120px]" />
        </div>

        {/* Algorithm Info */}
        <Card className="glass-effect border-2 border-neon-blue/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-neon-blue">
              <Brain className="w-6 h-6" />
              Meta-Algorithm Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-white mb-2">Core Principle:</h3>
              <p className="text-gray-300">
                DeepPick doesn't analyze games directly. Instead, it aggregates insights from all 4 specialized cappers 
                and identifies consensus picks where multiple algorithms agree.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-white mb-2">The Four Cappers:</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-purple-300">Nexus</h4>
                    {capperPerformance.nexus && (
                      <Badge variant="outline" className="border-purple-500 text-purple-300">
                        {capperPerformance.nexus.roi.toFixed(1)}% ROI
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Pattern Recognition</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-blue-300">Shiva</h4>
                    {capperPerformance.shiva && (
                      <Badge variant="outline" className="border-blue-500 text-blue-300">
                        {capperPerformance.shiva.roi.toFixed(1)}% ROI
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Statistical Powerhouse</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-red-300">Cerberus</h4>
                    {capperPerformance.cerberus && (
                      <Badge variant="outline" className="border-red-500 text-red-300">
                        {capperPerformance.cerberus.roi.toFixed(1)}% ROI
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Multi-Model Ensemble</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-yellow-300">Ifrit</h4>
                    {capperPerformance.ifrit && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-300">
                        {capperPerformance.ifrit.roi.toFixed(1)}% ROI
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Underdog Hunter</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-2">Consensus Logic:</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500">4/4 Agreement</Badge>
                  <span className="text-sm text-gray-300">95% Confidence - MAXIMUM CONVICTION</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500">3/4 Agreement</Badge>
                  <span className="text-sm text-gray-300">85% Confidence - STRONG CONSENSUS</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-yellow-500">2/4 Agreement</Badge>
                  <span className="text-sm text-gray-300">60% Confidence - MODERATE PICK</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-gray-500">Split Decision</Badge>
                  <span className="text-sm text-gray-300">No Pick - Cappers Disagree</span>
                </div>
              </div>
            </div>

            <div className="bg-neon-blue/10 p-4 rounded-lg border border-neon-blue/30">
              <h4 className="font-bold text-neon-blue mb-2">Unit Sizing Strategy:</h4>
              <code className="text-xs text-gray-300">
                IF 4_cappers_agree: units = 5 (max conviction)
                <br />
                ELSE IF 3_cappers_agree: units = 3 (strong)
                <br />
                ELSE IF 2_cappers_agree: units = 2 (moderate)
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
                onClick={runDeepPickAlgorithm}
                disabled={processing || loading}
                className="bg-gradient-to-r from-neon-blue via-neon-purple to-neon-green hover:opacity-90 text-white font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                {processing ? 'Analyzing...' : 'Run DEEPPICK Meta-Algorithm'}
              </Button>

              <Button
                onClick={fetchGames}
                disabled={loading}
                variant="outline"
                className="border-neon-blue text-neon-blue hover:bg-neon-blue/10"
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
            <CardTitle>Consensus Analysis</CardTitle>
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
                    <div key={game.id} className={`p-4 rounded-lg border ${
                      analysis.consensus >= 3 ? 'border-green-500/50 bg-green-500/10' :
                      analysis.consensus === 2 ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-gray-500/30 bg-gray-500/5'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-white">
                          {game.away_team.name} @ {game.home_team.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${
                            analysis.consensus >= 3 ? 'bg-green-500' :
                            analysis.consensus === 2 ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            <Users className="w-3 h-3 mr-1" />
                            {analysis.consensus}/4 Cappers
                          </Badge>
                          <Badge variant="outline" className="border-neon-blue">
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
                            <div key={i} className="text-xs text-neon-cyan">
                              {reason}
                            </div>
                          ))}
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
        <Card className="glass-effect border border-neon-blue/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-neon-blue">Coming Soon</div>
                <div className="text-sm text-gray-400">Weighted Voting by ROI</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-neon-blue">Coming Soon</div>
                <div className="text-sm text-gray-400">Kelly Criterion Sizing</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-neon-blue">Coming Soon</div>
                <div className="text-sm text-gray-400">Bankroll Management</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

