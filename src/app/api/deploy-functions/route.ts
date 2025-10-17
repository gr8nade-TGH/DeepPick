import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Read the Edge Function files
    const ingestOddsCode = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/edge-function-code/ingest-odds`)
    const oddsCronCode = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/edge-function-code/odds-cron`)

    if (!ingestOddsCode.ok || !oddsCronCode.ok) {
      throw new Error('Failed to read Edge Function code')
    }

    const ingestCode = await ingestOddsCode.text()
    const cronCode = await oddsCronCode.text()

    return NextResponse.json({
      success: true,
      message: 'Edge Function code ready for deployment',
      instructions: {
        step1: 'Go to https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk/functions',
        step2: 'Create new function: ingest-odds',
        step3: 'Paste the ingest-odds code below',
        step4: 'Create new function: odds-cron', 
        step5: 'Paste the odds-cron code below',
        step6: 'Deploy both functions'
      },
      functions: {
        'ingest-odds': ingestCode,
        'odds-cron': cronCode
      }
    })

  } catch (error) {
    console.error('Error preparing Edge Functions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
