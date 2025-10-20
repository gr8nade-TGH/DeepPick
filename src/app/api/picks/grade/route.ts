import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GradePickSchema = z.object({
  pick_id: z.string().min(1),
}).strict()

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

    // TODO: Fetch final score from scores API
    // For now, return a placeholder response
    
    const result = {
      pick_id,
      result: 'win' as const, // Placeholder
      units_delta: pick.units || 0,
      final_score: { home: 0, away: 0 }, // Placeholder
      explanation: 'Grading not yet implemented. This is a placeholder response.',
      factors_review: [],
      grading_version: 'v1_stub',
      created_at: new Date().toISOString(),
    }

    console.log('[PickGrading]', {
      pick_id,
      result: result.result,
      units_delta: result.units_delta,
      latencyMs: Date.now() - startTime,
      status: 'placeholder',
    })

    return new Response(JSON.stringify(result), {
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

