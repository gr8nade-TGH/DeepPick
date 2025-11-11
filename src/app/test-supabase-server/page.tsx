'use client'

import { useState } from 'react'

export default function TestSupabaseServerPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTest = async () => {
    setLoading(true)
    setError(null)
    setLogs(['🚀 Calling server API...'])

    try {
      const response = await fetch('/api/test-supabase')
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
      } else {
        setError(data.error)
        setLogs(data.logs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLogs(prev => [...prev, `💥 Fetch error: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Server-Side Supabase Test</h1>

        <div className="mb-8">
          <button
            onClick={runTest}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold"
          >
            {loading ? 'Testing...' : 'Run Server Test'}
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-500 rounded-lg">
            <h2 className="text-xl font-bold mb-2">❌ Error</h2>
            <p className="font-mono text-sm">{error}</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📋 Logs</h2>
          <div className="space-y-2 font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Click "Run Server Test" to start.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
          <h3 className="font-bold mb-2">ℹ️ About This Test</h3>
          <p className="text-sm text-gray-300">
            This test runs Supabase operations on the <strong>server-side</strong> via a Next.js API route.
            This bypasses the browser client-side issues with getSession() hanging.
          </p>
        </div>
      </div>
    </div>
  )
}

