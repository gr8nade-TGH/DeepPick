import { NextResponse } from 'next/server'
import { getRecentRunLogs } from '@/lib/cappers/run-logger'

export const dynamic = 'force-dynamic'

/**
 * Get algorithm run logs for debugging
 * 
 * Query params:
 * - capper: Filter by capper name (ifrit, nexus, etc.)
 * - limit: Number of logs to return (default 50)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const capper = url.searchParams.get('capper') || 'ifrit'
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const logs = await getRecentRunLogs(capper, limit)

    return NextResponse.json({
      success: true,
      capper,
      logs,
      count: logs.length
    })

  } catch (error) {
    console.error('Error fetching algorithm logs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

