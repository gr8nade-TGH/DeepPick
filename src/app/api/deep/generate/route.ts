/**
 * DEEP Generate API
 * 
 * POST /api/deep/generate
 * 
 * Triggers DEEP pick generation for games within 4 hours of start.
 * DEEP analyzes consensus from other system cappers with factor confluence
 * and tier-weighted voting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateDeepPicks } from '@/lib/cappers/deep'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    console.log('[API:DEEP] Generate request received')
    
    const result = await generateDeepPicks()
    
    return NextResponse.json({
      success: result.success,
      message: `DEEP analyzed ${result.gamesAnalyzed} games, generated ${result.picksGenerated.length} picks`,
      data: {
        gamesAnalyzed: result.gamesAnalyzed,
        picksGenerated: result.picksGenerated,
        errors: result.errors
      }
    })
  } catch (error: any) {
    console.error('[API:DEEP] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate DEEP picks'
    }, { status: 500 })
  }
}

// GET endpoint for testing/debugging
export async function GET(request: NextRequest) {
  try {
    console.log('[API:DEEP] GET request - running generation')
    
    const result = await generateDeepPicks()
    
    return NextResponse.json({
      success: result.success,
      message: `DEEP analyzed ${result.gamesAnalyzed} games, generated ${result.picksGenerated.length} picks`,
      data: {
        gamesAnalyzed: result.gamesAnalyzed,
        picksGenerated: result.picksGenerated,
        errors: result.errors
      }
    })
  } catch (error: any) {
    console.error('[API:DEEP] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate DEEP picks'
    }, { status: 500 })
  }
}

