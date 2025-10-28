'use client'

import { useState } from 'react'

interface FactorTestResult {
  factorName: string
  status: 'success' | 'error' | 'pending'
  data?: any
  error?: string
  formula?: string
}

export default function APITestPage() {
  const [testingFactor, setTestingFactor] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, FactorTestResult>>({})
  const [oddsData, setOddsData] = useState<any>(null)

  const testFactor = async (factorName: string, teamAbbrev: string = 'BOS') => {
    setTestingFactor(factorName)
    
    try {
      const response = await fetch('/api/test/factor-calculation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorName, teamAbbrev })
      })
      
      const data = await response.json()
      
      setResults(prev => ({
        ...prev,
        [factorName]: {
          online: data.success ? 'success' : 'error',
          data: data.data,
          error: data.error,
          formula: data.formula
        }
      }))
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [factorName]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    } finally {
      setTestingFactor(null)
    }
  }

  const fetchOdds = async () => {
    try {
      const response = await fetch('/api/test/mysportsfeeds')
      const data = await response.json()
      setOddsData(data)
    } catch (error) {
      console.error('Failed to fetch odds:', error)
    }
  }

  const factors = [
    { name: 'Pace', formula: 'Poss = FGA + 0.44 * FTA - OREB + TOV | Pace = avg(Poss_team, Poss_opp)' },
    { name: 'ORtg', formula: 'ORtg = (PTS / Poss) * 100' },
    { name: 'DRtg', formula: 'DRtg = (OppPTS / OppPoss) * 100' },
    { name: '3P%', formula: '3P% = 3PM / 3PA' },
    { name: '3PAR', formula: '3PAR = 3PA / FGA' },
    { name: 'FTr', formula: 'FTr = FTA / FGA' }
  ]

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">🧪 MySportsFeeds Factor Testing</h1>
      
      {/* Odds Testing Section */}
      <div className="mb-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-bold mb-4">📊 Odds Data Test</h2>
        <button
          onClick={fetchOdds}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Fetch MySportsFeeds Odds
        </button>
        {oddsData && (
          <div className="mt-4">
            <h3 className="font-bold">Odds Update Frequency:</h3>
            <p className="text-sm text-gray-300 mt-2">
              Last Updated: {oddsData?.lastUpdatedOn || 'N/A'}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-400">View Raw Data</summary>
              <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(oddsData, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      {/* Factor Testing Section */}
      <div className="grid grid-cols-2 gap-4">
        {factors.map((factor) => (
          <div key={factor.name} className="p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold mb-2">{factor.name}</h3>
            <p className="text-sm text-gray-400 mb-3">{factor.formula}</p>
            <button
              onClick={() => testFactor(factor.name)}
              disabled={testingFactor === factor.name}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded"
            >
              {testingFactor === factor.name ? 'Testing...' : `Test ${factor.name}`}
            </button>
            
            {results[factor.name] && (
              <div className="mt-3 text-sm">
                {results[factor.name].status === 'success' && (
                  <div className="text-green-400">
                    ✅ Success
                    <pre className="mt-2 p-2 bg-gray-900 rounded text-xs overflow-auto">
                      {JSON.stringify(results[factor.name].data, null, 2)}
                    </pre>
                  </div>
                )}
                {results[factor.name].status === 'error' && (
                  <div className="text-red-400">
                    ❌ Error: {results[factor.name].error}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data Requirements Section */}
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-bold mb-4">📋 Required Data Points</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>✅ FGA (Field Goal Attempts)</div>
          <div>✅ FTA (Free Throw Attempts)</div>
          <div>✅ OREB (Offensive Rebounds)</div>
          <div>✅ TOV (Turnovers)</div>
          <div>✅ 3PA (3-Point Attempts)</div>
          <div>✅ 3PM (3-Point Makes)</div>
          <div>✅ PTS (Points)</div>
          <div>✅ ptsAgainst (Opponent Points)</div>
        </div>
      </div>
    </div>
  )
}

