'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Target, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  TrendingUp
} from 'lucide-react'

/**
 * Dedicated Pick Generation Test Page
 * 
 * Test the complete NBA score-first betting system:
 * - Score prediction (pre-market)
 * - Factor analysis (structural + AI)
 * - Expected value calculation
 * - Slippage testing
 * - Edge attribution
 * - Fractional Kelly sizing
 */
export default function PickTestPage() {
  const [pickTestRunning, setPickTestRunning] = useState(false)
  const [pickTestResult, setPickTestResult] = useState<any>(null)
  const [pickTestError, setPickTestError] = useState<string | { error?: string; errorType?: string; timestamp?: string; environment?: any; stack?: string; rawError?: string; testSteps?: string[] } | null>(null)

  const runPickGenerationTest = async () => {
    setPickTestRunning(true)
    setPickTestError(null)
    setPickTestResult(null)
    
    try {
      console.log('🏀 Starting NBA Sharp Betting test...')
      
      const response = await fetch('/api/test-nba-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setPickTestError(data)
        console.error('❌ NBA test failed:', data)
      } else {
        setPickTestResult(data)
        console.log('✅ NBA test complete:', data)
      }
    } catch (error) {
      console.error('❌ Error during NBA test:', error)
      setPickTestError({
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'FetchException',
        timestamp: new Date().toISOString()
      })
    } finally {
      setPickTestRunning(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Pick Generation Testing</h1>
            <p className="text-gray-400">
              Test the NBA score-first betting system with real games
            </p>
          </div>
          <Target className="w-12 h-12 text-green-400" />
        </div>

        {/* Test Card */}
        <Card className="glass-effect border-green-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-400">
              <Target className="w-6 h-6" />
              Run Pick Generation Test
            </CardTitle>
            <p className="text-sm text-gray-400 mt-2">
              Full end-to-end test of the NBA betting system (30-90 seconds)
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Test Info */}
            <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">What This Tests:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-green-400">🏀 Score Prediction (Pre-Market)</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Possessions × efficiency model</li>
                    <li>• Context adjustments (rest, travel, altitude)</li>
                    <li>• True spread/total calculation</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-purple-400">💎 Factor Analysis</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• 5 NBA-specific structural factors</li>
                    <li>• AI research (Perplexity + ChatGPT)</li>
                    <li>• Reliability-weighted contributions</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-blue-400">📊 Expected Value</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Convert effects → probabilities</li>
                    <li>• EV calculation at avg odds</li>
                    <li>• Slippage test (±3 cents)</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-yellow-400">🎯 Pick Selection</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Edge attribution rule (40%+ structural)</li>
                    <li>• Threshold gating (EV + magnitude)</li>
                    <li>• Fractional Kelly stake (0.25×)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Run Button */}
            <div className="flex justify-center">
              <Button
                onClick={runPickGenerationTest}
                disabled={pickTestRunning}
                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-8 py-6 text-lg"
                size="lg"
              >
                {pickTestRunning ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5" />
                    Run Test
                  </>
                )}
              </Button>
            </div>

            {/* Loading State */}
            {pickTestRunning && (
              <div className="p-8 bg-green-900/20 border border-green-500/30 rounded-lg text-center">
                <RefreshCw className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
                <p className="text-lg font-semibold text-white mb-2">Generating Pick...</p>
                <p className="text-sm text-gray-400">
                  Running NBA score prediction → factor analysis → EV calculation
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  This may take 30-90 seconds for full AI research
                </p>
              </div>
            )}

            {/* Error State */}
            {pickTestError && (
              <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-red-400 mb-2">Test Failed</h4>
                    <p className="text-sm text-gray-300 mb-3 font-mono">
                      {typeof pickTestError === 'string' ? pickTestError : pickTestError?.error || 'Unknown error'}
                    </p>
                    
                    {typeof pickTestError === 'object' && pickTestError !== null && pickTestError.testSteps && Array.isArray(pickTestError.testSteps) && (
                      <details className="mt-4 p-4 bg-black/30 rounded border border-red-500/20">
                        <summary className="cursor-pointer text-xs font-semibold text-red-300 mb-2">View Test Steps</summary>
                        <ul className="text-xs text-gray-400 space-y-0.5 font-mono">
                          {pickTestError.testSteps.map((step: string, idx: number) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Success State - Placeholder for now */}
            {pickTestResult && !pickTestRunning && (
              <div className="space-y-4">
                <div className="p-6 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-green-400 mb-2">
                        ✅ {pickTestResult.message}
                      </h4>
                      
                      {pickTestResult.testSteps && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                            View Test Steps
                          </summary>
                          <ul className="text-xs text-gray-400 space-y-0.5 font-mono mt-2 max-h-64 overflow-y-auto">
                            {pickTestResult.testSteps.map((step: string, idx: number) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                </div>

                {/* Game Info */}
                {pickTestResult.game && (
                  <Card className="glass-effect border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-gray-300">Game Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Matchup</p>
                          <p className="text-lg font-bold text-white">{pickTestResult.game.matchup}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Sport</p>
                          <p className="text-lg font-bold text-white uppercase">{pickTestResult.game.sport}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="text-white">{pickTestResult.game.date}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Time</p>
                          <p className="text-white">{pickTestResult.game.time}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Score Prediction */}
                {pickTestResult.scorePrediction && (
                  <Card className="glass-effect border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-purple-400">🎯 Score Prediction (Pre-Market)</CardTitle>
                      <p className="text-sm text-gray-400 mt-2">Predicted BEFORE seeing market odds</p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded">
                          <p className="text-xs text-gray-500 mb-1">Away Score</p>
                          <p className="text-2xl font-bold text-purple-400">{pickTestResult.scorePrediction.awayScore.toFixed(1)}</p>
                        </div>
                        <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded">
                          <p className="text-xs text-gray-500 mb-1">Home Score</p>
                          <p className="text-2xl font-bold text-purple-400">{pickTestResult.scorePrediction.homeScore.toFixed(1)}</p>
                        </div>
                        <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded">
                          <p className="text-xs text-gray-500 mb-1">True Spread</p>
                          <p className="text-2xl font-bold text-blue-400">{pickTestResult.scorePrediction.trueSpread.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded">
                          <p className="text-xs text-gray-500 mb-1">True Total</p>
                          <p className="text-2xl font-bold text-blue-400">{pickTestResult.scorePrediction.trueTotal.toFixed(1)}</p>
                        </div>
                        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded">
                          <p className="text-xs text-gray-500 mb-1">Win Probability</p>
                          <p className="text-2xl font-bold text-green-400">{(pickTestResult.scorePrediction.winProbTrue * 100).toFixed(1)}%</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Sigma (σ)</p>
                          <p className="text-lg font-mono text-gray-300">
                            Spread: {pickTestResult.scorePrediction.sigmaSpread.toFixed(1)} | Total: {pickTestResult.scorePrediction.sigmaTotal.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Prediction Heads */}
                {pickTestResult.predictionHeads && (
                  <Card className="glass-effect border-yellow-500/30">
                    <CardHeader>
                      <CardTitle className="text-yellow-400">📊 Three Prediction Heads</CardTitle>
                      <p className="text-sm text-gray-400 mt-2">Effect → Probability → Expected Value</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Spread Head */}
                      <div className={`p-4 rounded-lg border ${pickTestResult.predictionHeads.spread.meetsThreshold ? 'bg-green-900/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white">SPREAD</h4>
                          {pickTestResult.predictionHeads.spread.meetsThreshold ? (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">PASS ✓</span>
                          ) : (
                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">FAIL</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">Deviation (Δ)</p>
                            <p className="text-white font-mono">{pickTestResult.predictionHeads.spread.deviation.toFixed(2)} pts</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Expected Value</p>
                            <p className={`font-mono font-semibold ${pickTestResult.predictionHeads.spread.evPercentage > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pickTestResult.predictionHeads.spread.evPercentage > 0 ? '+' : ''}{pickTestResult.predictionHeads.spread.evPercentage.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Status</p>
                            <p className="text-gray-300 text-xs">{pickTestResult.predictionHeads.spread.reason.substring(0, 30)}...</p>
                          </div>
                        </div>
                      </div>

                      {/* Total Head */}
                      <div className={`p-4 rounded-lg border ${pickTestResult.predictionHeads.total.meetsThreshold ? 'bg-green-900/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white">TOTAL</h4>
                          {pickTestResult.predictionHeads.total.meetsThreshold ? (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">PASS ✓</span>
                          ) : (
                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">FAIL</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">Deviation (Δ)</p>
                            <p className="text-white font-mono">{pickTestResult.predictionHeads.total.deviation.toFixed(2)} pts</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Expected Value</p>
                            <p className={`font-mono font-semibold ${pickTestResult.predictionHeads.total.evPercentage > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pickTestResult.predictionHeads.total.evPercentage > 0 ? '+' : ''}{pickTestResult.predictionHeads.total.evPercentage.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Status</p>
                            <p className="text-gray-300 text-xs">{pickTestResult.predictionHeads.total.reason.substring(0, 30)}...</p>
                          </div>
                        </div>
                      </div>

                      {/* Moneyline Head */}
                      <div className={`p-4 rounded-lg border ${pickTestResult.predictionHeads.moneyline.meetsThreshold ? 'bg-green-900/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white">MONEYLINE</h4>
                          {pickTestResult.predictionHeads.moneyline.meetsThreshold ? (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">PASS ✓</span>
                          ) : (
                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">FAIL</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs">Deviation (Δ)</p>
                            <p className="text-white font-mono">{pickTestResult.predictionHeads.moneyline.deviation.toFixed(3)} log-odds</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Expected Value</p>
                            <p className={`font-mono font-semibold ${pickTestResult.predictionHeads.moneyline.evPercentage > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pickTestResult.predictionHeads.moneyline.evPercentage > 0 ? '+' : ''}{pickTestResult.predictionHeads.moneyline.evPercentage.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Status</p>
                            <p className="text-gray-300 text-xs">{pickTestResult.predictionHeads.moneyline.reason.substring(0, 30)}...</p>
                          </div>
                        </div>
                      </div>

                      {/* Best Pick Indicator */}
                      {pickTestResult.predictionHeads.bestPick && (
                        <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-center">
                          <p className="text-sm text-green-400 font-semibold">
                            ✅ Best Pick: {pickTestResult.predictionHeads.bestPick.toUpperCase()} (EV: {pickTestResult.predictionHeads.highestEv.toFixed(4)})
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Factors Display */}
                {pickTestResult.factors && pickTestResult.factors.length > 0 && (
                  <Card className="glass-effect border-blue-500/30">
                    <CardHeader>
                      <CardTitle className="text-blue-400">💎 Factor Analysis</CardTitle>
                      <p className="text-sm text-gray-400 mt-2">
                        Showing {pickTestResult.factors.length} factors with effect sizes in units
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pickTestResult.factors
                        .sort((a: any, b: any) => Math.abs(b.contribution) - Math.abs(a.contribution))
                        .map((factor: any, idx: number) => {
                          const isPositive = factor.contribution > 0.05
                          const isNegative = factor.contribution < -0.05
                          
                          const categoryIcons: Record<string, string> = {
                            lineup: '👥',
                            matchup: '⚔️',
                            context: '📅',
                            officials: '👨‍⚖️',
                            environment: '🌍',
                            market: '📈',
                            ai_research: '🤖',
                          }
                          const icon = categoryIcons[factor.category] || '📊'
                          
                          return (
                            <div key={idx} className={`p-4 rounded-lg border ${
                              isPositive ? 'bg-green-900/10 border-green-500/30' :
                              isNegative ? 'bg-red-900/10 border-red-500/30' :
                              'bg-gray-800/50 border-gray-700'
                            }`}>
                              <div className="flex items-start gap-3">
                                <span className="text-3xl">{icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="text-sm font-bold text-white">{factor.name}</p>
                                      <p className="text-xs text-gray-500 uppercase">{factor.category} • {factor.unit}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-lg font-mono font-bold ${
                                        isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400'
                                      }`}>
                                        {factor.contribution >= 0 ? '+' : ''}{factor.contribution.toFixed(3)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Effect: {factor.effectSize.toFixed(3)} × {factor.reliability.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <p className="text-sm text-gray-300 mb-3">{factor.reasoning}</p>
                                  
                                  {/* Raw Data */}
                                  {factor.rawData && Object.keys(factor.rawData).length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      {factor.rawData.teamA && (
                                        <div className="p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                                          <p className="font-semibold text-blue-300 mb-1">Home Team:</p>
                                          {Object.entries(factor.rawData.teamA).map(([key, val]: [string, any]) => (
                                            <p key={key} className="text-gray-300">
                                              {key}: <span className="font-mono text-blue-400">{JSON.stringify(val)}</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {factor.rawData.teamB && (
                                        <div className="p-2 bg-orange-900/20 border border-orange-500/30 rounded">
                                          <p className="font-semibold text-orange-300 mb-1">Away Team:</p>
                                          {Object.entries(factor.rawData.teamB).map(([key, val]: [string, any]) => (
                                            <p key={key} className="text-gray-300">
                                              {key}: <span className="font-mono text-orange-400">{JSON.stringify(val)}</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {factor.rawData.context && (
                                        <div className="col-span-full p-2 bg-purple-900/20 border border-purple-500/30 rounded">
                                          <p className="font-semibold text-purple-300 mb-1">Context:</p>
                                          {Object.entries(factor.rawData.context).map(([key, val]: [string, any]) => (
                                            <p key={key} className="text-gray-300">
                                              {key}: <span className="font-mono text-purple-400">{JSON.stringify(val)}</span>
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Sources */}
                                  {factor.sources && factor.sources.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {factor.sources.map((source: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 bg-gray-800 text-xs text-gray-400 rounded">
                                          {source}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </CardContent>
                  </Card>
                )}

                {/* Pick Details (if generated) */}
                {pickTestResult.pick && (
                  <Card className="glass-effect border-green-500/30">
                    <CardHeader>
                      <CardTitle className="text-green-400">🎉 Pick Generated!</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-green-900/20 rounded">
                          <p className="text-xs text-gray-500 mb-1">Bet Type</p>
                          <p className="text-lg font-bold text-white uppercase">{pickTestResult.pick.betType}</p>
                        </div>
                        <div className="p-4 bg-purple-900/20 rounded">
                          <p className="text-xs text-gray-500 mb-1">Selection</p>
                          <p className="text-lg font-bold text-purple-400">{pickTestResult.pick.selection}</p>
                        </div>
                        <div className="p-4 bg-yellow-900/20 rounded">
                          <p className="text-xs text-gray-500 mb-1">Expected Value</p>
                          <p className="text-lg font-bold text-yellow-400">+{pickTestResult.pick.evPercentage.toFixed(2)}%</p>
                        </div>
                        <div className="p-4 bg-blue-900/20 rounded">
                          <p className="text-xs text-gray-500 mb-1">Win Probability</p>
                          <p className="text-lg font-bold text-blue-400">{(pickTestResult.pick.winProbability * 100).toFixed(1)}%</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Stake</p>
                          <p className="text-lg font-bold text-white">{pickTestResult.pick.units}U (${pickTestResult.pick.stake.toFixed(2)})</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded">
                          <p className="text-xs text-gray-500 mb-1">True Line</p>
                          <p className="text-lg font-mono text-cyan-400">{pickTestResult.pick.trueLine.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Market Line</p>
                          <p className="text-lg font-mono text-white">{pickTestResult.pick.marketLine}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded">
                          <p className="text-xs text-gray-500 mb-1">Deviation</p>
                          <p className="text-lg font-mono text-orange-400">{pickTestResult.pick.deviation > 0 ? '+' : ''}{pickTestResult.pick.deviation.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Performance */}
                {pickTestResult.performance && (
                  <Card className="glass-effect border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-gray-300">⚡ Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Total Duration</p>
                          <p className="text-2xl font-bold text-white">{pickTestResult.performance.duration_seconds}s</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Analysis Time</p>
                          <p className="text-2xl font-bold text-blue-400">{pickTestResult.performance.analysis_duration_seconds}s</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Estimated Cost</p>
                          <p className="text-2xl font-bold text-green-400">${pickTestResult.performance.estimated_cost_usd.toFixed(4)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-effect border-purple-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">NBA-Focused</h3>
              </div>
              <p className="text-sm text-gray-400">
                System is currently optimized for NBA games. NFL/MLB support coming soon.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-white">Score-First</h3>
              </div>
              <p className="text-sm text-gray-400">
                Predicts game scores BEFORE seeing odds, then compares to market for edge.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold text-white">EV-Based</h3>
              </div>
              <p className="text-sm text-gray-400">
                Gates picks on expected value, not abstract confidence scores.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

