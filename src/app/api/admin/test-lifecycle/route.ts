/**
 * TEST LIFECYCLE ENDPOINT
 * 
 * Comprehensive endpoint to test the full pick lifecycle:
 * 1. Clear picks (optional)
 * 2. Create test picks (Manual, AI, Picksmith)
 * 3. Mark game as final with scores
 * 4. Trigger grading
 * 
 * POST /api/admin/test-lifecycle
 * Body: {
 *   action: 'clear' | 'create' | 'grade' | 'full-cycle',
 *   gameId?: string,           // Required for 'create' and 'grade'
 *   awayScore?: number,        // Required for 'grade'
 *   homeScore?: number,        // Required for 'grade'
 *   pickTypes?: ('manual' | 'ai' | 'picksmith')[]  // For 'create', defaults to all
 * }
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/admin/test-lifecycle
 *
 * Get available games and current picks for testing
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    // Get scheduled games for today
    const today = new Date().toISOString().split('T')[0]
    const { data: games } = await supabase
      .from('games')
      .select('id, home_team, away_team, status, game_start_timestamp')
      .gte('game_start_timestamp', `${today}T00:00:00Z`)
      .lte('game_start_timestamp', `${today}T23:59:59Z`)
      .order('game_start_timestamp', { ascending: true })
      .limit(10)

    // Get current picks count by type
    const { data: picks } = await supabase
      .from('picks')
      .select('id, capper, status, is_system_pick, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    const stats = {
      total: picks?.length || 0,
      pending: picks?.filter(p => p.status === 'pending').length || 0,
      graded: picks?.filter(p => ['won', 'lost', 'push'].includes(p.status)).length || 0,
      byType: {
        manual: picks?.filter(p => !p.is_system_pick).length || 0,
        ai: picks?.filter(p => p.is_system_pick && p.capper?.toUpperCase() !== 'PICKSMITH').length || 0,
        picksmith: picks?.filter(p => p.capper?.toUpperCase() === 'PICKSMITH').length || 0
      }
    }

    return NextResponse.json({
      success: true,
      games: games?.map(g => ({
        id: g.id,
        matchup: `${g.away_team?.abbreviation || g.away_team?.name} @ ${g.home_team?.abbreviation || g.home_team?.name}`,
        status: g.status,
        time: g.game_start_timestamp
      })),
      picks: stats,
      recentPicks: picks?.slice(0, 5)
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { action, gameId, awayScore, homeScore, pickTypes = ['manual', 'ai', 'picksmith'] } = body

    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 [TEST-LIFECYCLE] Action: ${action}`)
    console.log(`${'='.repeat(60)}\n`)

    if (action === 'clear' || action === 'full-cycle') {
      // Clear all picks and related data
      console.log('🗑️ Clearing picks...')
      await supabase.from('picks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('runs').delete().neq('run_id', '')
      await supabase.from('results_analysis').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      console.log('✅ Picks cleared')
    }

    if ((action === 'create' || action === 'full-cycle') && gameId) {
      // Fetch game details
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()

      if (gameError || !game) {
        return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 })
      }

      const results = { manual: null as any, ai: null as any, picksmith: null as any }

      // Create manual pick
      if (pickTypes.includes('manual')) {
        const { data, error } = await supabase.from('picks').insert({
          capper: 'tucker',
          game_id: gameId,
          pick_type: 'spread',
          selection: `${game.home_team?.name || 'Home'} -4.5`,
          units: 2,
          confidence: 70,
          status: 'pending',
          is_system_pick: false,
          run_id: null,
          game_snapshot: {
            home_team: game.home_team,
            away_team: game.away_team,
            game_start_timestamp: game.game_start_timestamp
          }
        }).select().single()
        results.manual = { success: !error, data, error: error?.message }
      }

      // Create AI pick (simulated)
      if (pickTypes.includes('ai')) {
        const runId = `test_ai_${Date.now()}`
        await supabase.from('runs').insert({
          run_id: runId,
          capper: 'TITAN',
          game_id: gameId,
          status: 'completed',
          decision: 'BET',
          bet_type: 'TOTAL'
        })
        const { data, error } = await supabase.from('picks').insert({
          capper: 'TITAN',
          game_id: gameId,
          pick_type: 'total',
          selection: 'OVER 220.5',
          units: 3,
          confidence: 75,
          status: 'pending',
          is_system_pick: true,
          run_id: runId,
          game_snapshot: {
            home_team: game.home_team,
            away_team: game.away_team,
            game_start_timestamp: game.game_start_timestamp,
            total_line: 220.5
          }
        }).select().single()
        results.ai = { success: !error, data, error: error?.message }
      }

      // Create Picksmith pick
      if (pickTypes.includes('picksmith')) {
        const { data, error } = await supabase.from('picks').insert({
          capper: 'PICKSMITH',
          game_id: gameId,
          pick_type: 'total',
          selection: 'UNDER 222.5',
          units: 4,
          confidence: 80,
          status: 'pending',
          is_system_pick: true,
          run_id: null,
          reasoning: 'PICKSMITH consensus: 2 cappers agree. Contributing cappers: TITAN(3u), SHIVA(2u)',
          game_snapshot: {
            home_team: game.home_team,
            away_team: game.away_team,
            game_start_timestamp: game.game_start_timestamp,
            total_line: 222.5
          }
        }).select().single()
        results.picksmith = { success: !error, data, error: error?.message }
      }

      if (action === 'create') {
        return NextResponse.json({ success: true, action: 'create', results })
      }
    }

    if ((action === 'grade' || action === 'full-cycle') && gameId) {
      // Mark game as final and trigger grading
      const away = awayScore ?? 105
      const home = homeScore ?? 110
      const winner = home > away ? 'home' : away > home ? 'away' : 'tie'

      await supabase.from('games').update({
        status: 'final',
        home_score: home,
        away_score: away,
        final_score: { home, away, winner },
        updated_at: new Date().toISOString()
      }).eq('id', gameId)

      // DB trigger should auto-grade, but let's verify
      const { data: picks } = await supabase
        .from('picks')
        .select('id, capper, status, result')
        .eq('game_id', gameId)

      return NextResponse.json({
        success: true,
        action: action === 'full-cycle' ? 'full-cycle' : 'grade',
        game: { id: gameId, finalScore: { away, home, winner } },
        picks
      })
    }

    return NextResponse.json({ success: true, action, message: 'Action completed' })
  } catch (error: any) {
    console.error('[TEST-LIFECYCLE] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

