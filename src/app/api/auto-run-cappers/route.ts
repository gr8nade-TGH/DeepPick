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
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🤖 [AUTO-RUN-CAPPERS CRON] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)
  
  try {
    // Verify this is called by Vercel Cron (security)
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
    
    console.log('🔐 [CRON AUTH] Checking authorization...')
    console.log(`   Expected: Bearer ${process.env.CRON_SECRET ? '[SET]' : '[NOT SET]'}`)
    console.log(`   Received: ${authHeader ? authHeader.substring(0, 20) + '...' : '[NONE]'}`)
    
    if (authHeader !== expectedAuth) {
      console.error('❌ [CRON AUTH] Unauthorized access attempt!')
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid CRON_SECRET' },
        { status: 401 }
      )
    }
    
    console.log('✅ [CRON AUTH] Authorization successful')

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
      { name: 'nexus', endpoint: '/api/run-nexus' },
      { name: 'shiva', endpoint: '/api/run-shiva' },
      { name: 'cerberus', endpoint: '/api/run-cerberus' },
      // DeepPick is a meta-algorithm that runs after the others
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
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ [AUTO-RUN-CAPPERS CRON] EXECUTION COMPLETE: ${duration}ms`)
    console.log(`   Total Picks Generated: ${totalPicks}`)
    console.log(`   Successful Cappers: ${successCount}/${cappers.length}`)
    console.log(`${'='.repeat(80)}\n`)

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

