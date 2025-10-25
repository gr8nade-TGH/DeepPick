import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    console.log('[inspect-picks] Inspecting ALL picks in database...')
    
    // Get ALL picks without any filters
    const { data: allPicks, error: allPicksError } = await supabase
      .from('picks')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (allPicksError) {
      console.error('Error fetching all picks:', allPicksError)
      return NextResponse.json({ 
        success: false, 
        error: allPicksError.message 
      }, { status: 500 })
    }
    
    console.log(`[inspect-picks] Found ${allPicks?.length || 0} total picks`)
    
    // Group by capper
    const byCapper: any = {}
    allPicks?.forEach((pick: any) => {
      const capper = pick.capper || 'NULL'
      if (!byCapper[capper]) {
        byCapper[capper] = []
      }
      byCapper[capper].push({
        id: pick.id,
        game_id: pick.game_id,
        pick_type: pick.pick_type,
        status: pick.status,
        created_at: pick.created_at
      })
    })
    
    // Get unique game IDs from the Game Inbox games
    const {data: games, error: gamesError} = await supabase
      .from('games')
      .select('id, home_team, away_team')
      .eq('sport', 'nba')
      .eq('game_date', new Date().toISOString().split('T')[0])
    
    const gameIdsInInbox = games?.map(g => g.id) || []
    
    // Find picks that match the games in the inbox
    const picksForInboxGames = allPicks?.filter((pick: any) => 
      gameIdsInInbox.includes(pick.game_id)
    ) || []
    
    console.log(`[inspect-picks] ${picksForInboxGames.length} picks match games in inbox`)
    
    return NextResponse.json({ 
      success: true,
      totalPicks: allPicks?.length || 0,
      byCapper,
      gameIdsInInbox,
      picksForInboxGames: picksForInboxGames.map((p: any) => ({
        id: p.id,
        game_id: p.game_id,
        capper: p.capper,
        pick_type: p.pick_type,
        status: p.status,
        created_at: p.created_at
      })),
      allPicksSample: allPicks?.slice(0, 5).map((p: any) => ({
        id: p.id,
        game_id: p.game_id,
        capper: p.capper,
        pick_type: p.pick_type,
        status: p.status
      }))
    })
    
  } catch (e) {
    console.error('[inspect-picks] API error:', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
