import { NextResponse } from 'next/server'

/**
 * Test endpoint to manually trigger score fetching
 * Visit /api/test-score-fetch to run this
 */
export async function GET() {
  try {
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
    
    return NextResponse.json({
      success: true,
      message: 'Test score fetch completed',
      baseUrl,
      scoresResult,
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

