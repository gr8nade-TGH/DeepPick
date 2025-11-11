'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TestMinimalPage() {
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  useEffect(() => {
    const test = async () => {
      try {
        addLog('🔍 Creating fresh Supabase client...')
        
        const url = 'https://xckbsyeaywrfzvcahhtk.supabase.co'
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVheXdyZnp2Y2FoaHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk5OTQsImV4cCI6MjA3NjI3NTk5NH0.X_FRhkUhefhTeiGRRNBckxusVFurEJ_bZMy1BImaCpI'
        
        addLog(`📍 URL: ${url}`)
        addLog(`🔑 Key length: ${key.length}`)
        
        const client = createClient(url, key, {
          auth: {
            persistSession: false, // Don't use localStorage
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        })
        
        addLog('✅ Client created')
        
        addLog('⏳ Calling getSession()...')
        const start = Date.now()
        
        const { data, error } = await client.auth.getSession()
        
        const duration = Date.now() - start
        addLog(`✅ getSession() completed in ${duration}ms`)
        addLog(`📊 Session: ${!!data.session}`)
        addLog(`❌ Error: ${error?.message || 'none'}`)
        
        // Try a simple query
        addLog('⏳ Testing query...')
        const queryStart = Date.now()
        
        const { data: result, error: queryError } = await client
          .from('profiles')
          .select('count')
          .limit(1)
        
        const queryDuration = Date.now() - queryStart
        addLog(`✅ Query completed in ${queryDuration}ms`)
        addLog(`📊 Result: ${JSON.stringify(result)}`)
        addLog(`❌ Error: ${queryError?.message || 'none'}`)
        
      } catch (err) {
        addLog(`💥 Exception: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    test()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Minimal Supabase Test</h1>
        
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">Logs</h2>
          <div className="space-y-2 font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-slate-400">Running...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-slate-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="mt-6 bg-yellow-900/20 border border-yellow-500 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">This test:</h2>
          <ul className="list-disc list-inside space-y-2 text-yellow-300">
            <li>Creates a fresh Supabase client (not using the singleton)</li>
            <li>Disables localStorage (persistSession: false)</li>
            <li>Disables auto-refresh and URL detection</li>
            <li>Calls getSession() directly</li>
            <li>Tests a simple database query</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

