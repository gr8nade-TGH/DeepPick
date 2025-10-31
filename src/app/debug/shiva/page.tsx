'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ShivaDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [dbState, setDbState] = useState<any>(null)
  const [triggerResult, setTriggerResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'database' | 'trigger'>('diagnostics')

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/shiva-diagnostics')
      const data = await response.json()
      setDiagnostics(data)
    } catch (error) {
      console.error('Failed to run diagnostics:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkDatabaseState = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/database-state')
      const data = await response.json()
      setDbState(data)
    } catch (error) {
      console.error('Failed to check database state:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerCron = async () => {
    setLoading(true)
    setTriggerResult(null)
    try {
      const response = await fetch('/api/debug/trigger-shiva')
      const data = await response.json()
      setTriggerResult(data)
    } catch (error) {
      console.error('Failed to trigger cron:', error)
      setTriggerResult({ error: 'Failed to trigger cron' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runDiagnostics()
    checkDatabaseState()
  }, [])

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-500'
      case 'warning': return 'text-yellow-500'
      case 'critical': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            SHIVA Diagnostics Dashboard
          </h1>
          <p className="text-gray-400">
            Comprehensive system health check for SHIVA auto-picks
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button
            onClick={runDiagnostics}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading && activeTab === 'diagnostics' ? 'Running...' : 'Run Full Diagnostics'}
          </Button>
          <Button
            onClick={checkDatabaseState}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading && activeTab === 'database' ? 'Checking...' : 'Check Database State'}
          </Button>
          <Button
            onClick={triggerCron}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading && activeTab === 'trigger' ? 'Triggering...' : 'Trigger Cron Manually'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'diagnostics'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            System Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'database'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Database State
          </button>
          <button
            onClick={() => setActiveTab('trigger')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'trigger'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Manual Trigger
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Diagnostics Tab */}
          {activeTab === 'diagnostics' && diagnostics && (
            <div className="space-y-6">
              {/* Health Status */}
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <h2 className="text-2xl font-bold mb-4">System Health</h2>
                <div className={`text-3xl font-bold mb-2 ${getHealthColor(diagnostics.health)}`}>
                  {diagnostics.health?.toUpperCase()}
                </div>
                <p className="text-gray-400">{diagnostics.health_message}</p>
              </div>

              {/* Summary */}
              {diagnostics.summary && (
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                  <h2 className="text-2xl font-bold mb-4">Issues Summary</h2>
                  
                  {diagnostics.summary.critical_issues?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-red-500 font-bold mb-2">🚨 Critical Issues</h3>
                      <ul className="space-y-1">
                        {diagnostics.summary.critical_issues.map((issue: string, i: number) => (
                          <li key={i} className="text-red-400">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diagnostics.summary.warnings?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-yellow-500 font-bold mb-2">⚠️ Warnings</h3>
                      <ul className="space-y-1">
                        {diagnostics.summary.warnings.map((warning: string, i: number) => (
                          <li key={i} className="text-yellow-400">{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diagnostics.summary.critical_issues?.length === 0 && diagnostics.summary.warnings?.length === 0 && (
                    <p className="text-green-400">✅ No issues detected</p>
                  )}
                </div>
              )}

              {/* Detailed Checks */}
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <h2 className="text-2xl font-bold mb-4">Detailed Checks</h2>
                <pre className="bg-gray-950 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(diagnostics.checks, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Database State Tab */}
          {activeTab === 'database' && dbState && (
            <div className="space-y-6">
              {/* Diagnosis */}
              {dbState.diagnosis && (
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                  <h2 className="text-2xl font-bold mb-4">Diagnosis</h2>
                  <ul className="space-y-2">
                    {dbState.diagnosis.map((item: string, i: number) => (
                      <li key={i} className={
                        item.startsWith('🚨') ? 'text-red-400' :
                        item.startsWith('⚠️') ? 'text-yellow-400' :
                        item.startsWith('✅') ? 'text-green-400' :
                        'text-blue-400'
                      }>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tables Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="font-bold mb-2">Games</h3>
                  <p className="text-2xl font-bold text-purple-400">{dbState.tables?.games?.active_games || 0}</p>
                  <p className="text-sm text-gray-400">Active NBA Games</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="font-bold mb-2">Runs</h3>
                  <p className="text-2xl font-bold text-blue-400">{dbState.tables?.runs?.runs_last_24h || 0}</p>
                  <p className="text-sm text-gray-400">Runs (Last 24h)</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="font-bold mb-2">Cooldowns</h3>
                  <p className="text-2xl font-bold text-yellow-400">{dbState.tables?.cooldowns?.active_cooldowns || 0}</p>
                  <p className="text-sm text-gray-400">Active Cooldowns</p>
                </div>
              </div>

              {/* Full State */}
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                <h2 className="text-2xl font-bold mb-4">Full Database State</h2>
                <pre className="bg-gray-950 p-4 rounded overflow-auto text-xs max-h-96">
                  {JSON.stringify(dbState, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Trigger Tab */}
          {activeTab === 'trigger' && (
            <div className="space-y-6">
              {!triggerResult && (
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-center">
                  <p className="text-gray-400 mb-4">Click the button above to manually trigger the SHIVA cron job</p>
                  <p className="text-sm text-gray-500">This will execute the same logic as the automated cron</p>
                </div>
              )}

              {triggerResult && (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4">Trigger Result</h2>
                    <div className={`text-xl font-bold mb-2 ${
                      triggerResult.result === 'success' ? 'text-green-400' :
                      triggerResult.result === 'failed' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {triggerResult.result?.toUpperCase()}
                    </div>
                    {triggerResult.outcome && (
                      <p className="text-gray-300 mb-2">Outcome: <span className="font-bold">{triggerResult.outcome}</span></p>
                    )}
                    {triggerResult.message && (
                      <p className="text-gray-400">{triggerResult.message}</p>
                    )}
                  </div>

                  <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4">Full Response</h2>
                    <pre className="bg-gray-950 p-4 rounded overflow-auto text-xs max-h-96">
                      {JSON.stringify(triggerResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

