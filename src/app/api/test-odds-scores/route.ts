import { NextResponse } from 'next/server'
import { fetchTeamRecentForm } from '@/lib/data-sources/odds-api-scores'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Test endpoint to verify Odds API scores integration
 * Tests fetching recent form for Denver Nuggets and Golden State Warriors
 */
export async function GET() {
  try {
    console.log('[TEST:ODDS-SCORES] Starting test...')
    
    const [denverForm, gswForm] = await Promise.all([
      fetchTeamRecentForm('Denver Nuggets', 5),
      fetchTeamRecentForm('Golden State Warriors', 5)
    ])
    
    console.log('[TEST:ODDS-SCORES] Results:', {
      denver: {
        ok: denverForm.ok,
        gamesPlayed: denverForm.data?.gamesPlayed,
        ppg: denverForm.data?.pointsPerGame?.toFixed(1),
        papg: denverForm.data?.pointsAllowedPerGame?.toFixed(1),
        pace: denverForm.data?.estimatedPace?.toFixed(1)
      },
      gsw: {
        ok: gswForm.ok,
        gamesPlayed: gswForm.data?.gamesPlayed,
        ppg: gswForm.data?.pointsPerGame?.toFixed(1),
        papg: gswForm.data?.pointsAllowedPerGame?.toFixed(1),
        pace: gswForm.data?.estimatedPace?.toFixed(1)
      }
    })
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        denver: {
          ok: denverForm.ok,
          data: denverForm.data,
          error: denverForm.error,
          cached: denverForm.cached,
          latencyMs: denverForm.latencyMs
        },
        gsw: {
          ok: gswForm.ok,
          data: gswForm.data,
          error: gswForm.error,
          cached: gswForm.cached,
          latencyMs: gswForm.latencyMs
        }
      }
    })
  } catch (error) {
    console.error('[TEST:ODDS-SCORES] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

