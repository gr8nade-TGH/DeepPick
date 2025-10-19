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
      console.log('🧪 Starting pick generation test...')
      
      const response = await fetch('/api/test-pick-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setPickTestError(data)
        console.error('❌ Pick generation test failed:', data)
      } else {
        setPickTestResult(data)
        console.log('✅ Pick generation test complete:', data)
      }
    } catch (error) {
      console.error('❌ Error during pick generation test:', error)
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

                {/* Result Display */}
                <Card className="glass-effect border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400">Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-gray-300 bg-gray-900 p-4 rounded overflow-auto max-h-96">
                      {JSON.stringify(pickTestResult, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
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

