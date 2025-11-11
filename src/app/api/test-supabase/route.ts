import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const logs: string[] = []
  
  try {
    logs.push('🔍 Creating Supabase client on server...')
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    logs.push(`📍 URL: ${url}`)
    logs.push(`🔑 Key length: ${key.length}`)
    
    const client = createClient(url, key)
    
    logs.push('✅ Client created')
    
    // Test 1: getSession()
    logs.push('⏳ Test 1: Calling getSession()...')
    const start1 = Date.now()
    
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    
    const duration1 = Date.now() - start1
    logs.push(`✅ getSession() completed in ${duration1}ms`)
    logs.push(`📊 Session: ${!!sessionData.session}`)
    logs.push(`❌ Error: ${sessionError?.message || 'none'}`)
    
    // Test 2: Simple query
    logs.push('⏳ Test 2: Testing query...')
    const start2 = Date.now()
    
    const { data: queryData, error: queryError } = await client
      .from('profiles')
      .select('count')
      .limit(1)
    
    const duration2 = Date.now() - start2
    logs.push(`✅ Query completed in ${duration2}ms`)
    logs.push(`📊 Result: ${JSON.stringify(queryData)}`)
    logs.push(`❌ Error: ${queryError?.message || 'none'}`)
    
    // Test 3: Check if we can access the database at all
    logs.push('⏳ Test 3: Testing RPC call...')
    const start3 = Date.now()
    
    const { data: rpcData, error: rpcError } = await client.rpc('get_current_timestamp')
    
    const duration3 = Date.now() - start3
    logs.push(`✅ RPC completed in ${duration3}ms`)
    logs.push(`📊 Result: ${JSON.stringify(rpcData)}`)
    logs.push(`❌ Error: ${rpcError?.message || 'none'}`)
    
    return NextResponse.json({
      success: true,
      logs,
      environment: 'server',
      timestamp: new Date().toISOString()
    })
    
  } catch (err) {
    logs.push(`💥 Exception: ${err instanceof Error ? err.message : String(err)}`)
    
    return NextResponse.json({
      success: false,
      logs,
      error: err instanceof Error ? err.message : String(err),
      environment: 'server',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

