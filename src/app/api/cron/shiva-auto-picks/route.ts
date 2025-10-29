import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * SHIVA AUTO-PICKS CRON
 *
 * Runs every 10 minutes to automatically generate SHIVA picks
 * Uses the same logic as the manual pick generation wizard
 *
 * Cooldown Logic:
 * - Step 1 Scanner checks if game is eligible (no existing picks, not in cooldown)
 * - If PASS (units=0): Records 2-hour cooldown
 * - If PICK_GENERATED (units>0): Records no cooldown (game has pick)
 * - Next run skips games with existing picks or in cooldown
 *
 * One-Game-Per-Run Policy:
 * - Each 10-minute cycle attempts ONLY ONE game
 * - No retry logic - if the game results in PASS, wait for next cycle
 * - This ensures controlled, predictable pick generation
 */
export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🤖 [SHIVA-AUTO-PICKS] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)

  try {
    console.log('🤖 [SHIVA-AUTO-PICKS] Starting automated SHIVA pick generation...')
    const startTime = Date.now()

    // Step 1: Find eligible games (excludes games in cooldown or already picked)
    console.log('🎯 [SHIVA-AUTO-PICKS] Finding eligible games...')
    const scannerResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shiva/step1-scanner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedGame: null }) // Scan all games
    })

    const scannerResult = await scannerResponse.json()
    console.log('📊 [SHIVA-AUTO-PICKS] Scanner result:', scannerResult)

    if (!scannerResult.success || !scannerResult.selected_game) {
      console.log('⚠️ [SHIVA-AUTO-PICKS] No eligible games found')
      const duration = Date.now() - startTime
      console.log(`\n${'='.repeat(80)}`)
      console.log(`⚠️ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: No eligible games`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: false,
        message: 'No eligible games found',
        picksGenerated: 0,
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    }

    const selectedGame = scannerResult.selected_game
    const gameId = selectedGame.id
    console.log(`🎮 [SHIVA-AUTO-PICKS] Selected game: ${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`)

    // Step 2: Run full pick generation pipeline
    console.log('⚡ [SHIVA-AUTO-PICKS] Running pick generation...')
    const pickResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/shiva/generate-pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedGame })
    })

    const pickResult = await pickResponse.json()
    console.log('📈 [SHIVA-AUTO-PICKS] Pick generation result:', pickResult)

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(80)}`)
    if (pickResult.decision === 'PICK' && pickResult.pick) {
      console.log(`✅ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: Pick generated`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: true,
        message: 'SHIVA pick generated successfully',
        picksGenerated: 1,
        game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
        gameId,
        pickDetails: pickResult,
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    } else if (pickResult.decision === 'PASS') {
      console.log(`⚠️ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: Game resulted in PASS (cooldown recorded)`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: false,
        message: 'Game resulted in PASS - cooldown recorded',
        picksGenerated: 0,
        game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
        gameId,
        decision: 'PASS',
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    } else {
      console.log(`❌ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: Unexpected result`)
      console.log(`Duration: ${duration}ms`)
      console.log(`${'='.repeat(80)}\n`)

      return NextResponse.json({
        success: false,
        message: 'Unexpected pick generation result',
        picksGenerated: 0,
        game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
        gameId,
        pickResult,
        duration: `${duration}ms`,
        timestamp: executionTime
      })
    }

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
