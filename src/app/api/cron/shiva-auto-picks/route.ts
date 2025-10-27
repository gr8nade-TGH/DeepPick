import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * SHIVA AUTO-PICKS CRON
 * 
 * Runs every 5 minutes to automatically generate SHIVA picks
 * Uses the same logic as the manual pick generation wizard
 * 
 * Cooldown Logic:
 * - Step 1 Scanner checks if game is eligible (no existing picks, not in cooldown)
 * - If PASS (units=0): Records 2-hour cooldown
 * - If PICK_GENERATED (units>0): Records no cooldown (game has pick)
 * - Next run skips games with existing picks or in cooldown
 * 
 * Retry Logic:
 * - Attempts up to 5 games per execution
 * - If a game results in PASS, automatically tries the next eligible game
 * - Tracks which games have been attempted to avoid duplicates
 */
export async function GET() {
  const executionTime = new Date().toISOString()
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🤖 [SHIVA-AUTO-PICKS] EXECUTION START: ${executionTime}`)
  console.log(`${'='.repeat(80)}\n`)
  
  try {
    console.log('🤖 [SHIVA-AUTO-PICKS] Starting automated SHIVA pick generation...')
    const startTime = Date.now()
    const maxRetries = 5 // Maximum number of games to try
    let attempts = 0
    const gamesAttempted: string[] = [] // Track games we've already tried
    let pickGenerated = false
    let finalResult: any = null

    // Loop until we generate a pick or exhaust retries
    while (attempts < maxRetries && !pickGenerated) {
      attempts++
      console.log(`\n🔄 [SHIVA-AUTO-PICKS] Attempt ${attempts}/${maxRetries}`)

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
        break // Exit loop if no games available
      }

      const selectedGame = scannerResult.selected_game
      const gameId = selectedGame.id
      
      // Skip if we've already tried this game in this execution
      if (gamesAttempted.includes(gameId)) {
        console.log(`⚠️ [SHIVA-AUTO-PICKS] Already tried game ${gameId}, skipping`)
        continue
      }
      
      gamesAttempted.push(gameId)
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

      // Check if a pick was generated (not a PASS)
      if (pickResult.decision === 'PICK' && pickResult.pick) {
        pickGenerated = true
        console.log('✅ [SHIVA-AUTO-PICKS] Pick generated successfully!')
        finalResult = {
          success: true,
          message: 'SHIVA pick generated successfully',
          picksGenerated: 1,
          game: `${selectedGame.away_team.name} @ ${selectedGame.home_team.name}`,
          pickDetails: pickResult,
          attempts,
          timestamp: executionTime
        }
      } else if (pickResult.decision === 'PASS') {
        console.log('⚠️ [SHIVA-AUTO-PICKS] Game resulted in PASS, will try next game')
        // Continue to next iteration to try another game
      } else {
        console.log('❌ [SHIVA-AUTO-PICKS] Unexpected result, will try next game')
        // Continue to next iteration
      }
    }

    const duration = Date.now() - startTime
    
    console.log(`\n${'='.repeat(80)}`)
    if (pickGenerated) {
      console.log(`✅ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: Pick generated in ${attempts} attempt(s)`)
    } else {
      console.log(`⚠️ [SHIVA-AUTO-PICKS] EXECUTION COMPLETE: No pick generated after ${attempts} attempts`)
    }
    console.log(`Duration: ${duration}ms`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: pickGenerated,
      message: pickGenerated 
        ? 'SHIVA pick generated successfully' 
        : `No pick generated after ${attempts} attempts`,
      picksGenerated: pickGenerated ? 1 : 0,
      attempts,
      gamesAttempted,
      duration: `${duration}ms`,
      timestamp: executionTime,
      ...(finalResult || {})
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
