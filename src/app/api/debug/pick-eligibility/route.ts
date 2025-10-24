import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const capper = searchParams.get('capper') || 'SHIVA'
  const betType = searchParams.get('betType') || 'TOTAL'

  if (!gameId) {
    return NextResponse.json({ error: 'gameId parameter is required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  try {
    console.log(`[DebugPickEligibility] Checking game ${gameId} for capper ${capper}, betType ${betType}`)

    // 1. Check if game exists
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, home_team, away_team, game_date, game_time, status, sport')
      .eq('id', gameId)
      .single()

    console.log(`[DebugPickEligibility] Game data:`, game)
    if (gameError) {
      console.error('[DebugPickEligibility] Game error:', gameError)
    }

    // 2. Check existing picks
    const { data: existingPicks, error: picksError } = await supabase
      .from('picks')
      .select('id, pick_type, status, units, created_at')
      .eq('game_id', gameId)
      .eq('capper', capper)
      .eq('pick_type', betType)

    console.log(`[DebugPickEligibility] Existing picks:`, existingPicks)
    if (picksError) {
      console.error('[DebugPickEligibility] Picks error:', picksError)
    }

    // 3. Check cooldown table
    const { data: cooldownData, error: cooldownError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('game_id', gameId)
      .eq('capper', capper)
      .eq('bet_type', betType)
      .gt('cooldown_until', new Date().toISOString())

    console.log(`[DebugPickEligibility] Cooldown data:`, cooldownData)
    if (cooldownError) {
      console.error('[DebugPickEligibility] Cooldown error:', cooldownError)
    }

    // 4. Call the RPC function
    const { data: rpcResult, error: rpcError } = await supabase.rpc('can_generate_pick', {
      p_game_id: gameId,
      p_capper: capper,
      p_bet_type: betType,
      p_cooldown_hours: 2
    })

    console.log(`[DebugPickEligibility] RPC result:`, rpcResult)
    if (rpcError) {
      console.error('[DebugPickEligibility] RPC error:', rpcError)
    }

    // 5. Check all picks for this game (any capper, any bet type)
    const { data: allPicks, error: allPicksError } = await supabase
      .from('picks')
      .select('id, capper, pick_type, status, units, created_at')
      .eq('game_id', gameId)

    console.log(`[DebugPickEligibility] All picks for game:`, allPicks)
    if (allPicksError) {
      console.error('[DebugPickEligibility] All picks error:', allPicksError)
    }

    return NextResponse.json({
      gameId,
      capper,
      betType,
      game,
      existingPicks,
      cooldownData,
      rpcResult,
      allPicks,
      errors: {
        gameError: gameError?.message,
        picksError: picksError?.message,
        cooldownError: cooldownError?.message,
        rpcError: rpcError?.message,
        allPicksError: allPicksError?.message
      },
      summary: {
        gameExists: !!game,
        hasExistingPicks: existingPicks && existingPicks.length > 0,
        hasActiveCooldown: cooldownData && cooldownData.length > 0,
        rpcAllowsPick: rpcResult === true,
        totalPicksForGame: allPicks ? allPicks.length : 0
      }
    }, { status: 200 })

  } catch (error) {
    console.error('[DebugPickEligibility] Unhandled error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: (error as Error).message 
    }, { status: 500 })
  }
}
