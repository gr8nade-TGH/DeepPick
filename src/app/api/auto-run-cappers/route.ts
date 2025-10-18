import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Automated Capper Runner
 * 
 * This endpoint runs all active cappers and generates picks.
 * Called by Vercel cron job every 20 minutes.
 * 
 * Each capper will:
 * 1. Fetch scheduled games
 * 2. Check for existing picks (duplicate prevention)
 * 3. Analyze games and generate new picks
 * 4. Store picks in database
 */
export async function GET(request: Request) {
  try {
    // Verify this is called by Vercel Cron (security)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🤖 Auto-running all cappers...')
    const startTime = Date.now()

    const results = {
      ifrit: { success: false, picks: 0, error: null as string | null },
      nexus: { success: false, picks: 0, error: null as string | null },
      shiva: { success: false, picks: 0, error: null as string | null },
      cerberus: { success: false, picks: 0, error: null as string | null },
      deeppick: { success: false, picks: 0, error: null as string | null },
    }

    // Get base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://deep-pick.vercel.app'

    // Run each capper
    const cappers = [
      { name: 'ifrit', endpoint: '/api/run-ifrit' },
      // Add other cappers as they're implemented
      // { name: 'nexus', endpoint: '/api/run-nexus' },
      // { name: 'shiva', endpoint: '/api/run-shiva' },
      // { name: 'cerberus', endpoint: '/api/run-cerberus' },
      // { name: 'deeppick', endpoint: '/api/run-deeppick' },
    ]

    for (const capper of cappers) {
      try {
        console.log(`🔄 Running ${capper.name}...`)
        
        const response = await fetch(`${baseUrl}${capper.endpoint}?trigger=cron`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (data.success) {
          results[capper.name as keyof typeof results] = {
            success: true,
            picks: data.picks?.length || 0,
            error: null,
          }
          console.log(`✅ ${capper.name}: ${data.picks?.length || 0} picks generated`)
        } else {
          results[capper.name as keyof typeof results] = {
            success: false,
            picks: 0,
            error: data.error || 'Unknown error',
          }
          console.error(`❌ ${capper.name} failed:`, data.error)
        }
      } catch (error) {
        results[capper.name as keyof typeof results] = {
          success: false,
          picks: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        console.error(`❌ ${capper.name} error:`, error)
      }
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    const totalPicks = Object.values(results).reduce((sum, r) => sum + r.picks, 0)
    const successCount = Object.values(results).filter(r => r.success).length

    console.log(`✅ Auto-run complete: ${successCount}/${cappers.length} cappers succeeded, ${totalPicks} total picks in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: `Auto-run complete: ${successCount}/${cappers.length} cappers succeeded`,
      totalPicks,
      duration,
      timestamp: new Date().toISOString(),
      results,
    })

  } catch (error) {
    console.error('❌ Auto-run error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

