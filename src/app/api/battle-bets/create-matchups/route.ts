import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * POST /api/battle-bets/create-matchups
 * 
 * Creates battle matchups between cappers with opposing SPREAD picks on the same game.
 * 
 * Logic:
 * 1. Find all scheduled NBA games with pending SPREAD picks
 * 2. For each game, group picks by team (home vs away)
 * 3. Create matchups: 1 home picker vs 1 away picker
 * 4. Avoid duplicate matchups (same 2 cappers on same game)
 * 
 * Called by:
 * - Cron job (after picks are generated)
 * - Manual trigger (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Battle Matchmaking] Starting matchup creation...')

    const supabase = getSupabaseAdmin()

    // 1. Find all scheduled NBA games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team, away_team, spread_line, game_start_timestamp')
      .eq('sport', 'nba')
      .eq('status', 'scheduled')
      .gte('game_start_timestamp', new Date().toISOString())
      .order('game_start_timestamp', { ascending: true })

    if (gamesError) {
      console.error('[Battle Matchmaking] Error fetching games:', gamesError)
      return NextResponse.json({ error: gamesError.message }, { status: 500 })
    }

    if (!games || games.length === 0) {
      console.log('[Battle Matchmaking] No scheduled games found')
      return NextResponse.json({
        success: true,
        message: 'No scheduled games found',
        matchupsCreated: 0
      })
    }

    console.log(`[Battle Matchmaking] Found ${games.length} scheduled games`)

    let totalMatchupsCreated = 0
    const matchupDetails: any[] = []

    // 2. For each game, find opposing SPREAD picks
    for (const game of games) {
      console.log(`[Battle Matchmaking] Processing game: ${game.away_team.abbreviation} @ ${game.home_team.abbreviation}`)

      // Get all pending SPREAD picks for this game
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('id, capper, selection, pick_type, units')
        .eq('game_id', game.id)
        .eq('pick_type', 'spread')
        .eq('status', 'pending')

      if (picksError) {
        console.error(`[Battle Matchmaking] Error fetching picks for game ${game.id}:`, picksError)
        continue
      }

      if (!picks || picks.length < 2) {
        console.log(`[Battle Matchmaking] Not enough picks for game ${game.id} (need at least 2)`)
        continue
      }

      console.log(`[Battle Matchmaking] Found ${picks.length} SPREAD picks for this game`)

      // 3. Group picks by team
      const homeTeamPicks = picks.filter(p =>
        p.selection.includes(game.home_team.abbreviation)
      )
      const awayTeamPicks = picks.filter(p =>
        p.selection.includes(game.away_team.abbreviation)
      )

      console.log(`[Battle Matchmaking] Home team (${game.home_team.abbreviation}) picks: ${homeTeamPicks.length}`)
      console.log(`[Battle Matchmaking] Away team (${game.away_team.abbreviation}) picks: ${awayTeamPicks.length}`)

      if (homeTeamPicks.length === 0 || awayTeamPicks.length === 0) {
        console.log(`[Battle Matchmaking] No opposing picks found for game ${game.id}`)
        continue
      }

      // 4. Create matchups (1 home picker vs 1 away picker)
      for (const homePick of homeTeamPicks) {
        for (const awayPick of awayTeamPicks) {
          // Skip if same capper (shouldn't happen, but safety check)
          if (homePick.capper === awayPick.capper) {
            continue
          }

          // Check if matchup already exists
          const { data: existingMatchup } = await supabase
            .from('battle_matchups')
            .select('id')
            .eq('game_id', game.id)
            .or(`and(left_capper_id.eq.${homePick.capper},right_capper_id.eq.${awayPick.capper}),and(left_capper_id.eq.${awayPick.capper},right_capper_id.eq.${homePick.capper})`)
            .single()

          if (existingMatchup) {
            console.log(`[Battle Matchmaking] Matchup already exists: ${homePick.capper} vs ${awayPick.capper}`)
            continue
          }

          // Create new matchup
          const matchup = {
            game_id: game.id,
            left_capper_id: homePick.capper,
            right_capper_id: awayPick.capper,
            left_pick_id: homePick.id,
            right_pick_id: awayPick.id,
            left_team: game.home_team.abbreviation,
            right_team: game.away_team.abbreviation,
            spread: parseFloat(game.spread_line),
            game_start_time: game.game_start_timestamp,
            status: 'scheduled'
          }

          const { data: createdMatchup, error: createError } = await supabase
            .from('battle_matchups')
            .insert(matchup)
            .select()
            .single()

          if (createError) {
            console.error(`[Battle Matchmaking] Error creating matchup:`, createError)
            continue
          }

          console.log(`✅ Created matchup: ${homePick.capper} (${game.home_team.abbreviation}) vs ${awayPick.capper} (${game.away_team.abbreviation})`)

          totalMatchupsCreated++
          matchupDetails.push({
            id: createdMatchup.id,
            leftCapper: homePick.capper,
            rightCapper: awayPick.capper,
            leftTeam: game.home_team.abbreviation,
            rightTeam: game.away_team.abbreviation,
            spread: game.spread_line,
            gameStartTime: game.game_start_timestamp
          })
        }
      }
    }

    console.log(`[Battle Matchmaking] ✅ Complete! Created ${totalMatchupsCreated} matchups`)

    return NextResponse.json({
      success: true,
      matchupsCreated: totalMatchupsCreated,
      matchups: matchupDetails
    })

  } catch (error: any) {
    console.error('[Battle Matchmaking] Unexpected error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

