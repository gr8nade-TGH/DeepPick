import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { pickId: string } }
) {
  try {
    const { pickId } = params
    
    if (!pickId) {
      return NextResponse.json(
        { error: 'Pick ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Fetch the pick and its associated run data
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select(`
        *,
        shiva_runs!inner(
          *,
          games(*)
        )
      `)
      .eq('id', pickId)
      .single()

    if (pickError || !pick) {
      return NextResponse.json(
        { error: 'Pick not found' },
        { status: 404 }
      )
    }

    // For now, return mock insight data
    // In the future, this would fetch the actual insight card data from the run
    const insightData = {
      pick_id: pick.id,
      game_id: pick.game_id,
      matchup: `${pick.shiva_runs.games?.away_team?.name || 'Away'} @ ${pick.shiva_runs.games?.home_team?.name || 'Home'}`,
      pick_type: pick.pick_type,
      selection: pick.selection,
      units: pick.units,
      confidence: pick.confidence,
      created_at: pick.created_at,
      factors: [
        { name: 'Edge vs Market', points: 2.5, rationale: 'Market edge analysis' },
        { name: 'Pace Index', points: 1.8, rationale: 'Team pace differential' },
        { name: 'Offensive Form', points: 1.2, rationale: 'Recent offensive performance' },
        { name: 'Defensive Erosion', points: 0.8, rationale: 'Defensive performance trend' },
        { name: '3-Point Environment', points: 1.5, rationale: 'Three-point shooting context' }
      ],
      prediction: `${pick.shiva_runs.games?.home_team?.name || 'Home'} 115-${pick.shiva_runs.games?.away_team?.name || 'Away'} 118 (Total: 233)`,
      reasoning: `Model projects ${pick.selection} with ${pick.confidence}/5 confidence based on market edge and team factors. The ${pick.selection.includes('OVER') ? 'over' : 'under'} is supported by strong pace and offensive indicators.`,
      run_id: pick.shiva_runs.run_id,
      algorithm_version: pick.algorithm_version || 'shiva_v1'
    }

    return NextResponse.json(insightData)

  } catch (error) {
    console.error('Error fetching insight card:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insight card' },
      { status: 500 }
    )
  }
}
