'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestSupabasePage() {
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Create client in browser
  const supabase = useMemo(() => createClient(), [])

  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  useEffect(() => {
    const testSupabase = async () => {
      try {
        addLog('🔍 Starting Supabase test...')
        addLog(`📍 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
        addLog(`🔑 Anon Key exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`)
        addLog(`🔑 Anon Key length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length}`)

        // Check localStorage
        const storageKey = 'sb-xckbsyeaywrfzvcahhtk-auth-token'
        const storedData = localStorage.getItem(storageKey)
        addLog(`💾 LocalStorage key exists: ${!!storedData}`)
        if (storedData) {
          addLog(`💾 LocalStorage data length: ${storedData.length}`)
        }

        addLog('⏳ Calling supabase.auth.getSession()...')
        const startTime = Date.now()

        // Add timeout to prevent infinite hang
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => {
            addLog('⏰ TIMEOUT: getSession() took more than 5 seconds!')
            reject(new Error('getSession timeout after 5s'))
          }, 5000)
        )

        const sessionPromise = supabase.auth.getSession()

        const result = await Promise.race([sessionPromise, timeoutPromise]) as any
        const { data, error } = result

        const endTime = Date.now()
        const duration = endTime - startTime

        addLog(`✅ getSession() completed in ${duration}ms`)
        addLog(`📊 Session exists: ${!!data?.session}`)
        addLog(`👤 User exists: ${!!data?.session?.user}`)

        if (error) {
          addLog(`❌ Error: ${error.message}`)
          setError(error.message)
        } else {
          addLog('✅ No errors!')
        }

        // Test a simple query
        addLog('⏳ Testing database query...')
        const queryStart = Date.now()

        const { data: profiles, error: queryError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)

        const queryEnd = Date.now()
        const queryDuration = queryEnd - queryStart

        addLog(`✅ Query completed in ${queryDuration}ms`)

        if (queryError) {
          addLog(`❌ Query error: ${queryError.message}`)
          addLog(`❌ Query error code: ${queryError.code}`)
          addLog(`❌ Query error details: ${queryError.details}`)
        } else {
          addLog('✅ Query successful!')
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        addLog(`💥 Exception: ${errorMessage}`)
        setError(errorMessage)
      }
    }

    testSupabase()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Supabase Connection Test</h1>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <h2 className="text-red-400 font-semibold mb-2">Error Detected</h2>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">Test Logs</h2>
          <div className="space-y-2 font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-slate-400">Running tests...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-slate-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-300">
            <li>Open browser DevTools (F12)</li>
            <li>Go to Network tab</li>
            <li>Filter by "supabase"</li>
            <li>Look for any failed/pending requests</li>
            <li>Check Console tab for any CORS errors</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

