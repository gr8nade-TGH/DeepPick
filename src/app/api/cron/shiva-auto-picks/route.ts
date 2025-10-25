import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * SHIVA AUTO-PICKS CRON
 * 
 * Runs every 30 minutes to automatically generate SHIVA picks
 * Uses the same logic as the manual pick generation wizard
 */
export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🤖 [SHIVA-AUTO-PICKS] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)
  
  try {
    console.log('🤖 [SHIVA-AUTO-PICKS] Starting automated SHIVA pick generation...')
    const startTime = Date.now()

    // Step 1: Find eligible games (same logic as Step 1 scanner)
    console.log('🎯 [SHIVA-AUTO-PICKS] Step 1: Finding eligible games...')
    const scannerResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shiva/step1-scanner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedGame: null }) // Scan all games
    })
    
    const scannerResult = await scannerResponse.json()
    console.log('📊 [SHIVA-AUTO-PICKS] Scanner result:', scannerResult)

    if (!scannerResult.success || !scannerResult.selected_game) {
      console.log('⚠️ [SHIVA-AUTO-PICKS] No eligible games found')
      return NextResponse.json({
        success: true,
        message: 'No eligible games found for SHIVA pick generation',
        picksGenerated: 0,
        duration: `${Date.now() - startTime}ms`,
        timestamp: executionTime
      })
    }

    const selectedGame = scannerResult.selected_game
    console.log(`🎮 [SHIVA-AUTO-PICKS] Selected game: ${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`)

    // Step 2: Run full pick generation pipeline
    console.log('⚡ [SHIVA-AUTO-PICKS] Step 2: Running full pick generation...')
    const pickResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shiva/generate-pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedGame })
    })
    
    const pickResult = await pickResponse.json()
    console.log('📈 [SHIVA-AUTO-PICKS] Pick generation result:', pickResult)

    const duration = Date.now() - startTime
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: ${duration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: true,
      message: 'SHIVA auto-picks completed successfully',
      picksGenerated: pickResult.success ? 1 : 0,
      game: selectedGame ? `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}` : 'None',
      pickDetails: pickResult,
      duration: `${duration}ms`,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [SHIVA-AUTO-PICKS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST() {
  return GET()
}
