'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'

export default function DebugAuthPage() {
  const { user, profile, loading } = useAuth()
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      setLogs(prev => [...prev, `[LOG] ${new Date().toISOString()}: ${message}`])
      originalLog(...args)
    }

    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      setLogs(prev => [...prev, `[ERROR] ${new Date().toISOString()}: ${message}`])
      originalError(...args)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
    }
  }, [])

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'))
    alert('Logs copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Auth Debug Page</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Loading State</h2>
            <p className={`text-2xl font-mono ${loading ? 'text-yellow-400' : 'text-green-400'}`}>
              {loading ? 'TRUE ⏳' : 'FALSE ✅'}
            </p>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">User State</h2>
            <p className={`text-2xl font-mono ${user ? 'text-green-400' : 'text-red-400'}`}>
              {user ? `✅ ${user.email}` : '❌ NULL'}
            </p>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Profile State</h2>
            <p className={`text-2xl font-mono ${profile ? 'text-green-400' : 'text-red-400'}`}>
              {profile ? `✅ ${profile.role}` : '❌ NULL'}
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Console Logs</h2>
            <button
              onClick={copyLogs}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Copy All Logs
            </button>
          </div>
          
          <div className="bg-black rounded p-4 max-h-96 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`mb-1 ${log.includes('[ERROR]') ? 'text-red-400' : 'text-green-400'}`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4">
          <h3 className="font-bold mb-2">Expected Behavior:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Loading should be <strong>TRUE</strong> initially</li>
            <li>After ~1-2 seconds, loading should become <strong>FALSE</strong></li>
            <li>User should be <strong>NULL</strong> if not logged in</li>
            <li>Profile should be <strong>NULL</strong> if not logged in</li>
            <li>You should see logs from [AuthContext] in the console</li>
          </ul>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Raw State</h2>
          <pre className="bg-black p-4 rounded overflow-x-auto text-xs">
            {JSON.stringify({ 
              loading, 
              user: user ? { id: user.id, email: user.email } : null,
              profile: profile ? { id: profile.id, role: profile.role } : null
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

