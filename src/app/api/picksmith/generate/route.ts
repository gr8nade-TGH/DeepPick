/**
 * PICKSMITH Generate API
 * 
 * POST /api/picksmith/generate
 * 
 * Triggers PICKSMITH pick generation for games within 4 hours of start.
 * PICKSMITH analyzes consensus from other system cappers and generates
 * picks when 2+ profitable cappers agree on the same side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generatePicksmithPicks } from '@/lib/cappers/picksmith'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 second timeout

export async function POST(request: NextRequest) {
  try {
    console.log('[API:PICKSMITH] Generate request received')
    
    // Optional: Add auth check here for production
    // const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    const result = await generatePicksmithPicks()
    
    return NextResponse.json({
      success: result.success,
      message: `PICKSMITH analyzed ${result.gamesAnalyzed} games, generated ${result.picksGenerated.length} picks`,
      data: {
        gamesAnalyzed: result.gamesAnalyzed,
        picksGenerated: result.picksGenerated,
        errors: result.errors
      }
    })
  } catch (error: any) {
    console.error('[API:PICKSMITH] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate PICKSMITH picks'
    }, { status: 500 })
  }
}

// GET endpoint for testing/debugging
export async function GET(request: NextRequest) {
  try {
    console.log('[API:PICKSMITH] GET request - running generation')
    
    const result = await generatePicksmithPicks()
    
    return NextResponse.json({
      success: result.success,
      message: `PICKSMITH analyzed ${result.gamesAnalyzed} games, generated ${result.picksGenerated.length} picks`,
      data: {
        gamesAnalyzed: result.gamesAnalyzed,
        picksGenerated: result.picksGenerated,
        errors: result.errors
      }
    })
  } catch (error: any) {
    console.error('[API:PICKSMITH] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate PICKSMITH picks'
    }, { status: 500 })
  }
}

