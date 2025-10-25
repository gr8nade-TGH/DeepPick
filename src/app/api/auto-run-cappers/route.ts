import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * AUTO-RUN-CAPPERS: DISABLED
 * 
 * This endpoint has been disabled to prevent automatic pick generation.
 * Use the SHIVA management page for manual, controlled pick generation.
 * 
 * If you see this being called, go to Vercel Dashboard → Settings → Cron Jobs
 * and delete all cron jobs.
 */
export async function GET(request: Request) {
  console.log('🚨 [AUTO-RUN-CAPPERS] DISABLED - This endpoint is disabled')
  console.log('🚨 [AUTO-RUN-CAPPERS] If you see this message, a cron job is still active')
  console.log('🚨 [AUTO-RUN-CAPPERS] Go to Vercel Dashboard → Settings → Cron Jobs and delete all crons')
  
  return NextResponse.json({
    success: false,
    error: 'AUTO-RUN-CAPPERS DISABLED',
    message: 'This endpoint has been permanently disabled.',
    instructions: [
      'This endpoint no longer generates picks automatically.',
      'Use the SHIVA management page at /cappers/shiva/management for manual pick generation.',
      'If you are seeing this message, a cron job is still active in Vercel.',
      'Go to Vercel Dashboard → Settings → Cron Jobs and delete all cron jobs.'
    ],
    timestamp: new Date().toISOString()
  }, { status: 503 })
}

export async function POST(request: Request) {
  return GET(request)
}
