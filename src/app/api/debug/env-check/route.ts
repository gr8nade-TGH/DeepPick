import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('[env-check] Checking environment variables...')
    
    const envVars = {
      ODDS_API_KEY: process.env.ODDS_API_KEY ? '✅ Set' : '❌ Missing',
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'Not set',
      VERCEL: process.env.VERCEL || 'Not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'Not set'
    }
    
    const missingVars = Object.entries(envVars)
      .filter(([key, value]) => value.includes('❌'))
      .map(([key]) => key)
    
    return NextResponse.json({ 
      success: missingVars.length === 0, 
      message: missingVars.length === 0 ? 'All required environment variables are set' : 'Some environment variables are missing',
      environment: envVars,
      missing: missingVars,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[env-check] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred while checking environment'
    }, { status: 500 })
  }
}
