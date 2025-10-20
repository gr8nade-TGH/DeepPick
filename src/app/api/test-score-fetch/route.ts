import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Test endpoint to manually trigger score fetching
 * Visit /api/test-score-fetch to run this
 */
export async function GET() {
  try {
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.env.VERCEL === '1'
    if (isBuild) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Build-time skip' })
    }
    console.log('🧪 TEST: Manually triggering score fetch...')
    
    // Get the base URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://deep-pick.vercel.app'
    
    console.log(`📍 Using base URL: ${baseUrl}`)
    
    // Call fetch-scores
    const scoresResponse = await fetch(`${baseUrl}/api/fetch-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const scoresResult = await scoresResponse.json()
    
    console.log('📋 Full scores result:', JSON.stringify(scoresResult, null, 2))
    
    return NextResponse.json({
      success: true,
      message: 'Test score fetch completed',
      baseUrl,
      scoresResult,
      responseStatus: scoresResponse.status,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ TEST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

