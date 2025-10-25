'use client'

import { useState } from 'react'

export default function APITestPage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState<string | null>(null)

  const testAPI = async (name: string, url: string, method: string = 'GET') => {
    setLoading(name)
    try {
      console.log(`🧪 [${name}] Testing ${method} ${url}`)
      const response = await fetch(url, { method })
      const data = await response.json()
      console.log(`🧪 [${name}] Response:`, data)
      
      setResults(prev => ({
        ...prev,
        [name]: {
          status: response.status,
          success: response.ok,
          data: data,
          timestamp: new Date().toISOString()
        }
      }))
    } catch (error) {
      console.error(`🧪 [${name}] Error:`, error)
      setResults(prev => ({
        ...prev,
        [name]: {
          status: 'ERROR',
          success: false,
          error: error,
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setLoading(null)
    }
  }

  const testOddsAPI = async () => {
    setLoading('Odds API Direct')
    try {
      console.log('🧪 [Odds API Direct] Testing direct Odds API call...')
      
      // Test if we can call the Odds API directly
      const response = await fetch('/api/debug/test-odds-api')
      const data = await response.json()
      console.log('🧪 [Odds API Direct] Response:', data)
      
      setResults(prev => ({
        ...prev,
        'Odds API Direct': {
          status: response.status,
          success: response.ok,
          data: data,
          timestamp: new Date().toISOString()
        }
      }))
    } catch (error) {
      console.error('🧪 [Odds API Direct] Error:', error)
      setResults(prev => ({
        ...prev,
        'Odds API Direct': {
          status: 'ERROR',
          success: false,
          error: error,
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🧪 API Testing Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Database Tests */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">📊 Database Tests</h2>
            <div className="space-y-3">
              <button
                onClick={() => testAPI('Check DB', '/api/debug/check-database')}
                disabled={loading === 'Check DB'}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Check DB' ? 'Loading...' : 'Check Database'}
              </button>
              
              <button
                onClick={() => testAPI('Clear Picks', '/api/debug/clear-picks', 'POST')}
                disabled={loading === 'Clear Picks'}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Clear Picks' ? 'Loading...' : 'Clear Picks'}
              </button>
            </div>
          </div>

          {/* Games Tests */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🎮 Games Tests</h2>
            <div className="space-y-3">
              <button
                onClick={() => testAPI('Games Current', '/api/games/current?league=NBA')}
                disabled={loading === 'Games Current'}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Games Current' ? 'Loading...' : 'Get Current Games'}
              </button>
              
              <button
                onClick={() => testAPI('Fetch NBA Games', '/api/debug/fetch-nba-games', 'POST')}
                disabled={loading === 'Fetch NBA Games'}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Fetch NBA Games' ? 'Loading...' : 'Fetch NBA Games'}
              </button>
              
              <button
                onClick={() => testAPI('Simple Ingest', '/api/simple-ingest')}
                disabled={loading === 'Simple Ingest'}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Simple Ingest' ? 'Loading...' : 'Simple Ingest All'}
              </button>
            </div>
          </div>

          {/* Odds API Tests */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🎯 Odds API Tests</h2>
            <div className="space-y-3">
              <button
                onClick={testOddsAPI}
                disabled={loading === 'Odds API Direct'}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Odds API Direct' ? 'Loading...' : 'Test Odds API Direct'}
              </button>
              
              <button
                onClick={() => testAPI('Environment Check', '/api/debug/env-check')}
                disabled={loading === 'Environment Check'}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm"
              >
                {loading === 'Environment Check' ? 'Loading...' : 'Check Environment'}
              </button>
            </div>
          </div>
        </div>

        {/* Results Display */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">📋 Test Results</h2>
          
          {Object.keys(results).length === 0 ? (
            <p className="text-gray-400">No tests run yet. Click a button above to test an API.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(results).map(([name, result]: [string, any]) => (
                <div key={name} className="border border-gray-600 rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        result.success ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {result.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <pre className="bg-gray-900 p-3 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(result.data || result.error, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
