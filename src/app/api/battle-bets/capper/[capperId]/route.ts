import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/battle-bets/capper/[capperId]
 * 
 * Get all battles for a specific capper (both as left and right capper)
 * Supports pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 * - status: Filter by status (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { capperId: string } }
) {
  try {
    const { capperId } = params
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const status = searchParams.get('status') // optional filter
    
    const offset = (page - 1) * limit

    console.log(`[Capper Battles API] Fetching battles for capper: ${capperId}`)

    const supabase = getSupabaseAdmin()

    // Build query - battles where capper is either left or right
    let query = supabase
      .from('battle_matchups')
      .select(`
        *,
        game:games(
          id,
          home_team,
          away_team,
          game_date,
          game_time,
          status,
          final_score
        )
      `, { count: 'exact' })
      .or(`left_capper_id.eq.${capperId},right_capper_id.eq.${capperId}`)
      .order('created_at', { ascending: false })

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: battles, error: battlesError, count } = await query

    if (battlesError) {
      console.error('[Capper Battles API] Error fetching battles:', battlesError)
      return NextResponse.json({
        success: false,
        error: `Database error: ${battlesError.message}`
      }, { status: 500 })
    }

    if (!battles || battles.length === 0) {
      return NextResponse.json({
        success: true,
        battles: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
    }

    // Enrich battles with capper performance data
    const enrichedBattles = await Promise.all(
      battles.map(async (battle) => {
        // Get left capper performance
        const leftCapperPerf = await getCapperPerformance(
          supabase,
          battle.left_capper_id,
          battle.left_team
        )

        // Get right capper performance
        const rightCapperPerf = await getCapperPerformance(
          supabase,
          battle.right_capper_id,
          battle.right_team
        )

        return {
          ...battle,
          left_capper: leftCapperPerf,
          right_capper: rightCapperPerf
        }
      })
    )

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      battles: enrichedBattles,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })

  } catch (error) {
    console.error('[Capper Battles API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * Get capper performance data for a specific team
 */
async function getCapperPerformance(
  supabase: any,
  capperId: string,
  teamAbbrev: string
) {
  // Get capper profile
  const { data: capper } = await supabase
    .from('cappers')
    .select('id, display_name, color_theme')
    .eq('id', capperId)
    .single()

  if (!capper) {
    return {
      id: capperId,
      displayName: capperId.toUpperCase(),
      colorTheme: '#3b82f6',
      teamPerformance: null,
      overallPerformance: null,
      defenseDots: 1
    }
  }

  // Get team-specific performance
  const { data: teamPicks } = await supabase
    .from('picks')
    .select('status, units, net_units')
    .eq('capper_id', capperId)
    .eq('team_abbrev', teamAbbrev)
    .eq('pick_type', 'spread')
    .in('status', ['won', 'lost', 'pushed'])

  const teamStats = calculateStats(teamPicks || [])

  // Get overall performance
  const { data: allPicks } = await supabase
    .from('picks')
    .select('status, units, net_units')
    .eq('capper_id', capperId)
    .in('status', ['won', 'lost', 'pushed'])

  const overallStats = calculateStats(allPicks || [])

  // Calculate defense dots from team net units
  const defenseDots = Math.max(1, Math.min(10, Math.floor(teamStats.netUnits / 3)))

  return {
    id: capper.id,
    displayName: capper.display_name,
    colorTheme: capper.color_theme,
    teamPerformance: teamStats,
    overallPerformance: overallStats,
    defenseDots
  }
}

/**
 * Calculate stats from picks
 */
function calculateStats(picks: any[]) {
  const wins = picks.filter(p => p.status === 'won').length
  const losses = picks.filter(p => p.status === 'lost').length
  const pushes = picks.filter(p => p.status === 'pushed').length
  const netUnits = picks.reduce((sum, p) => sum + (p.net_units || 0), 0)

  return {
    wins,
    losses,
    pushes,
    netUnits,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0
  }
}

