import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GradePickSchema = z.object({
  pick_id: z.string().min(1),
}).strict()

// ============================================================================
// GRADING LOGIC
// ============================================================================

interface GradeResult {
  result: 'win' | 'loss' | 'push'
  units_delta: number
  explanation: string
  factors_review?: Array<{ key: string; suggested_weight_change: number; reason: string }>
}

/**
 * Grade a pick based on final score
 */
function gradePick(
  pickType: string,
  selection: string,
  units: number,
  finalScore: { home_score: number; away_score: number },
  gameSnapshot: any
): GradeResult {
  const { home_score, away_score } = finalScore

  if (pickType === 'moneyline' || pickType === 'ml') {
    return gradeMoneyline(selection, units, home_score, away_score, gameSnapshot)
  } else if (pickType === 'spread') {
    return gradeSpread(selection, units, home_score, away_score, gameSnapshot)
  } else if (pickType === 'total') {
    return gradeTotal(selection, units, home_score, away_score, gameSnapshot)
  }

  return {
    result: 'push',
    units_delta: 0,
    explanation: `Unknown pick type: ${pickType}`,
  }
}

function gradeMoneyline(
  selection: string,
  units: number,
  homeScore: number,
  awayScore: number,
  snapshot: any
): GradeResult {
  const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie'
  
  // Determine if our pick won
  const selectionLower = selection.toLowerCase()
  const pickWon =
    (selectionLower.includes('home') && winner === 'home') ||
    (selectionLower.includes('away') && winner === 'away')

  if (winner === 'tie') {
    return {
      result: 'push',
      units_delta: 0,
      explanation: `Game ended in a tie ${homeScore}-${awayScore}. Moneyline bet pushed.`,
    }
  }

  return {
    result: pickWon ? 'win' : 'loss',
    units_delta: pickWon ? units : -units,
    explanation: pickWon
      ? `Predicted ${selection}, game ended ${awayScore}-${homeScore}. Win.`
      : `Predicted ${selection}, game ended ${awayScore}-${homeScore}. Loss.`,
  }
}

function gradeSpread(
  selection: string,
  units: number,
  homeScore: number,
  awayScore: number,
  snapshot: any
): GradeResult {
  // Parse spread line from selection (e.g., "LA LAKERS -7" → -7)
  const spreadMatch = selection.match(/([-+]?\d+\.?\d*)/)
  if (!spreadMatch) {
    return {
      result: 'push',
      units_delta: 0,
      explanation: 'Could not parse spread line from selection',
    }
  }

  const line = parseFloat(spreadMatch[1])
  const isHomeTeam = selection.toUpperCase().includes('HOME') || line < 0

  // Calculate cover
  const margin = homeScore - awayScore
  const coverMargin = isHomeTeam ? margin + line : -margin + line

  if (Math.abs(coverMargin) < 0.1) {
    return {
      result: 'push',
      units_delta: 0,
      explanation: `Spread ${line} pushed exactly. Final: ${awayScore}-${homeScore}, margin: ${margin}.`,
    }
  }

  const won = coverMargin > 0

  return {
    result: won ? 'win' : 'loss',
    units_delta: won ? units : -units,
    explanation: won
      ? `${selection} covered. Final: ${awayScore}-${homeScore}, margin: ${margin}, line: ${line}.`
      : `${selection} did not cover. Final: ${awayScore}-${homeScore}, margin: ${margin}, line: ${line}.`,
  }
}

function gradeTotal(
  selection: string,
  units: number,
  homeScore: number,
  awayScore: number,
  snapshot: any
): GradeResult {
  // Parse total line from selection (e.g., "OVER 227.5" → 227.5)
  const totalMatch = selection.match(/(\d+\.?\d*)/)
  if (!totalMatch) {
    return {
      result: 'push',
      units_delta: 0,
      explanation: 'Could not parse total line from selection',
    }
  }

  const line = parseFloat(totalMatch[1])
  const finalTotal = homeScore + awayScore
  const isOver = selection.toUpperCase().includes('OVER')

  // Check for push
  if (Math.abs(finalTotal - line) < 0.1) {
    return {
      result: 'push',
      units_delta: 0,
      explanation: `Total ${line} pushed exactly. Final: ${awayScore}-${homeScore} = ${finalTotal}.`,
    }
  }

  const won = isOver ? finalTotal > line : finalTotal < line

  return {
    result: won ? 'win' : 'loss',
    units_delta: won ? units : -units,
    explanation: won
      ? `${selection} hit. Final total: ${finalTotal}, line: ${line}.`
      : `${selection} missed. Final total: ${finalTotal}, line: ${line}.`,
  }
}

/**
 * POST /api/picks/grade
 * Grade a completed pick and generate result insight
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const body = await request.json().catch(() => null)
    const parse = GradePickSchema.safeParse(body)
    
    if (!parse.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_BODY',
            message: 'Invalid request body',
            details: { issues: parse.error.issues },
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { pick_id } = parse.data
    const admin = getSupabaseAdmin()

    // Fetch the pick with run/factors for context
    const pickQuery = await admin
      .from('picks')
      .select('*, run:runs(*)')
      .eq('id', pick_id)
      .maybeSingle()

    if (!pickQuery.data) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'PICK_NOT_FOUND',
            message: `Pick ${pick_id} not found`,
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const pick = pickQuery.data

    // Fetch final score from game
    const gameQuery = await admin
      .from('games')
      .select('home_score, away_score, status')
      .eq('id', pick.game_id)
      .maybeSingle()

    if (!gameQuery.data) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'GAME_NOT_FOUND',
            message: 'Game not found',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const game = gameQuery.data

    // Check if game is final
    if (game.status !== 'final' || game.home_score === null || game.away_score === null) {
      console.log('[PickGrading]', {
        pick_id,
        game_status: game.status,
        pending: true,
        latencyMs: Date.now() - startTime,
      })
      
      return new Response(
        JSON.stringify({ pending: true, message: 'Game not yet final' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Grade the pick
    const gradeResult = gradePick(
      pick.pick_type,
      pick.selection,
      pick.units || 1,
      {
        home_score: game.home_score,
        away_score: game.away_score,
      },
      pick.game_snapshot as any
    )

    // Write to pick_results
    const insertResult = await admin
      .from('pick_results')
      .insert({
        pick_id,
        result: gradeResult.result,
        units_delta: gradeResult.units_delta,
        final_score: { home: game.home_score, away: game.away_score },
        explanation: gradeResult.explanation,
        factors_review: gradeResult.factors_review || [],
        result_insight_json: gradeResult,
        grading_version: 'v1',
      })
      .select()
      .single()

    if (insertResult.error) {
      console.error('[PickGrading]', {
        error: 'DB_INSERT_FAILED',
        message: insertResult.error.message,
        latencyMs: Date.now() - startTime,
      })
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'DB_ERROR',
            message: insertResult.error.message,
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[PickGrading]', {
      pick_id,
      result: gradeResult.result,
      units_delta: gradeResult.units_delta,
      latencyMs: Date.now() - startTime,
      status: 'complete',
    })

    return new Response(JSON.stringify(insertResult.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[PickGrading]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    })

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to grade pick',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

