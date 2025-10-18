import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeBatch } from '@/lib/cappers/ifrit-algorithm'
import type { CapperGame } from '@/lib/cappers/shared-logic'

export const dynamic = 'force-dynamic'

/**
 * Run Ifrit's algorithm on current games and generate picks
 */
export async function POST() {
  try {
    console.log('🔥 Running Ifrit algorithm...')
    
    // 1. Fetch scheduled games
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString().split('T')[0])
      .order('game_date', { ascending: true })
      .limit(50)

    if (gamesError) {
      return NextResponse.json({
        success: false,
        error: gamesError.message
      }, { status: 500 })
    }

    if (!games || games.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled games available',
        picks: []
      })
    }

    console.log(`📊 Analyzing ${games.length} games...`)

    // 2. Run Ifrit's algorithm
    const picks = analyzeBatch(games as CapperGame[], 5) // Top 5 picks

    console.log(`✅ Ifrit generated ${picks.length} picks`)

    // 3. Store picks in database
    const storedPicks = []
    for (const pick of picks) {
      // Get game snapshot
      const game = games.find(g => g.id === pick.gameId)
      if (!game) continue

      const gameSnapshot = {
        sport: game.sport,
        league: game.league || game.sport.toUpperCase(),
        home_team: game.home_team,
        away_team: game.away_team,
        game_date: game.game_date,
        game_time: game.game_time,
      }

      // Insert pick
      const { data: insertedPick, error: insertError } = await supabaseAdmin
        .from('picks')
        .insert({
          game_id: pick.gameId,
          pick_type: pick.pickType,
          selection: pick.selection,
          odds: pick.odds,
          units: pick.units,
          game_snapshot: gameSnapshot,
          is_system_pick: true,
          confidence: pick.confidence,
          reasoning: pick.reasoning.join('\n'),
          algorithm_version: 'ifrit-v1',
          capper: 'ifrit',
        })
        .select()
        .single()

      if (insertError) {
        console.error(`❌ Error storing pick:`, insertError.message)
      } else {
        storedPicks.push(insertedPick)
        console.log(`✅ Stored pick: ${pick.selection} (${pick.confidence}% confidence)`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ifrit generated ${picks.length} picks`,
      picks: storedPicks,
      analysis: picks.map(p => ({
        selection: p.selection,
        confidence: p.confidence,
        units: p.units,
        reasoning: p.reasoning,
      })),
    })

  } catch (error) {
    console.error('❌ Error running Ifrit:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

