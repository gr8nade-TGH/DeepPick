import { NextResponse } from 'next/server'

/**
 * MANUAL SHIVA CRON TRIGGER
 * 
 * This endpoint manually triggers the SHIVA auto-picks cron job
 * with enhanced logging to help diagnose why picks aren't being generated.
 * 
 * Usage:
 * - GET: Trigger the cron job
 * - Returns detailed execution log
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  const executionLog: any = {
    timestamp: new Date().toISOString(),
    trigger: 'manual',
    steps: []
  }

  try {
    executionLog.steps.push({
      step: 'init',
      message: 'Manual trigger initiated',
      timestamp: new Date().toISOString()
    })

    // Determine the base URL for API calls
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    executionLog.baseUrl = baseUrl
    executionLog.steps.push({
      step: 'config',
      message: `Using base URL: ${baseUrl}`,
      timestamp: new Date().toISOString()
    })

    // Call the actual cron endpoint
    executionLog.steps.push({
      step: 'calling_cron',
      message: 'Calling /api/cron/shiva-auto-picks...',
      timestamp: new Date().toISOString()
    })

    const cronUrl = `${baseUrl}/api/cron/shiva-auto-picks`
    console.log('[TRIGGER-SHIVA] Calling cron endpoint:', cronUrl)

    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DeepPick-Manual-Trigger',
        'X-Trigger-Source': 'manual-debug'
      }
    })

    const cronData = await cronResponse.json()
    const duration = Date.now() - startTime

    executionLog.steps.push({
      step: 'cron_response',
      message: `Cron responded with status ${cronResponse.status}`,
      status: cronResponse.status,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    })

    executionLog.cronResponse = {
      status: cronResponse.status,
      statusText: cronResponse.statusText,
      data: cronData
    }

    // Analyze the response
    if (cronResponse.status === 200) {
      if (cronData.success) {
        executionLog.result = 'success'
        executionLog.message = 'Cron executed successfully'
        
        if (cronData.pick_generated) {
          executionLog.outcome = 'PICK_GENERATED'
          executionLog.pick = cronData.pick
        } else if (cronData.result === 'PASS') {
          executionLog.outcome = 'PASS'
          executionLog.reason = cronData.reason || 'Confidence too low'
        } else if (cronData.result === 'NO_ELIGIBLE_GAMES') {
          executionLog.outcome = 'NO_ELIGIBLE_GAMES'
          executionLog.reason = 'No games available for pick generation'
        }
      } else {
        executionLog.result = 'failed'
        executionLog.message = cronData.message || 'Cron execution failed'
        executionLog.error = cronData.error
      }
    } else {
      executionLog.result = 'error'
      executionLog.message = `Cron returned error status ${cronResponse.status}`
      executionLog.error = cronData
    }

    executionLog.duration_ms = duration
    executionLog.steps.push({
      step: 'complete',
      message: `Execution complete in ${duration}ms`,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(executionLog, { status: 200 })

  } catch (error) {
    console.error('[TRIGGER-SHIVA] Error:', error)
    
    executionLog.result = 'error'
    executionLog.error = error instanceof Error ? error.message : 'Unknown error'
    executionLog.duration_ms = Date.now() - startTime
    executionLog.steps.push({
      step: 'error',
      message: 'Fatal error during execution',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(executionLog, { status: 500 })
  }
}

// Also support POST
export async function POST(request: Request) {
  return GET(request)
}

