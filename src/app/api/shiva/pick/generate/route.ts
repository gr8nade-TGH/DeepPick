import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
export const runtime = 'nodejs'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { pickGenerationService } from '@/lib/services/pick-generation-service'

// Helper to get active snapshot for locking odds
async function getActiveSnapshot(runId: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('odds_snapshots')
    .select('game_id, odds, total')
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

const PickSchema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    conf_final: z.number(),
    edge_dominant: z.enum(['side', 'total']),
    side_data: z.object({ pick_team: z.string(), spread_pred: z.number(), market_spread: z.number() }).optional(),
    total_data: z.object({ total_pred: z.number(), market_total: z.number() }).optional(),
  }).strict(),
  results: z.object({
    decision: z.object({ pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), pick_side: z.string(), line: z.number(), units: z.number(), reason: z.string() }).strict(),
    persistence: z.object({ picks_row: z.object({ id: z.string(), run_id: z.string(), sport: z.literal('NBA'), matchup: z.string(), confidence: z.number(), units: z.number(), pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), selection: z.string(), created_at_utc: z.string() }).strict() }).strict(),
    locked_odds: z.object({
      total_line: z.number().optional(),
      spread_team: z.string().optional(),
      spread_line: z.number().optional(),
      ml_home: z.number().optional(),
      ml_away: z.number().optional(),
    }).optional(),
  }).strict()
}).strict()

export async function POST(request: Request) {
  const startTime = Date.now()
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = PickSchema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:PickGenerate]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const { run_id, results } = parse.data
  type PickBody = {
    run_id: string
    decision: string
    confidence: number
    pick: null | { id: string; run_id: string; pick_type: 'SPREAD' | 'MONEYLINE' | 'TOTAL'; selection: string; units: number; confidence: number }
  }
  return withIdempotency<PickBody>({
    runId: run_id,
    step: 'pick',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()
      
      if (!results.persistence?.picks_row || results.persistence.picks_row.units === 0) {
        // PASS decision - no pick row or zero units
        console.log('[SHIVA:PickGenerate]', {
          run_id,
          decision: 'PASS',
          confidence: parse.data.inputs.conf_final,
          reason: !results.persistence?.picks_row ? 'No picks_row' : 'Zero units',
          writeAllowed,
          latencyMs: Date.now() - startTime,
          status: 200,
        })

        // Record PASS decision with cooldown (get game_id from the run's context)
        if (writeAllowed) {
          try {
            // Get the game_id and total line from the snapshot (most reliable source)
            const activeSnapshot = await getActiveSnapshot(run_id)
            const totalLine = activeSnapshot?.total?.line || null
            let gameId = activeSnapshot?.game_id
            
            console.log('[SHIVA:PickGenerate] PASS - game_id from snapshot:', gameId)
            console.log('[SHIVA:PickGenerate] PASS - activeSnapshot:', JSON.stringify(activeSnapshot))

            // Save the run record to runs table even for PASS decisions
            // Save even if gameId is null/undefined - use placeholder
            if (run_id) {
              await admin
                .from('runs')
                .upsert({
                  id: run_id,
                  run_id: run_id,
                  game_id: gameId || 'unknown',
                  capper: 'shiva',
                  bet_type: results.decision.pick_type,
                  units: 0,
                  confidence: parse.data.inputs.conf_final,
                  pick_type: results.decision.pick_type,
                  selection: `${results.decision.pick_side} ${results.decision.line}`,
                  updated_at: new Date().toISOString()
                })
              console.log('[SHIVA:PickGenerate] PASS run saved to runs table:', run_id, 'with gameId:', gameId || 'unknown')
            } else {
              console.log('[SHIVA:PickGenerate] PASS - cannot save run, run_id is null/undefined')
            }

            if (gameId) {
              const cooldownResult = await pickGenerationService.recordPickGenerationResult({
                runId: run_id,
                gameId: gameId,
                capper: 'shiva',
                betType: results.decision.pick_type,
                result: 'PASS',
                units: 0,
                confidence: parse.data.inputs.conf_final,
                totalLine: totalLine // Pass the total line for cooldown tracking
              }, 2) // 2 hour cooldown

              if (cooldownResult.success) {
                console.log('[SHIVA:PickGenerate] PASS cooldown recorded successfully for game:', gameId)
              } else {
                console.error('[SHIVA:PickGenerate] Failed to record PASS cooldown:', cooldownResult.error)
              }
            } else {
              console.warn('[SHIVA:PickGenerate] No game_id found for run:', run_id, 'Skipping cooldown recording')
            }
          } catch (error) {
            console.error('[SHIVA:PickGenerate] Error recording PASS cooldown:', error)
          }
        }

        return { body: { run_id, decision: 'PASS', confidence: parse.data.inputs.conf_final, pick: null }, status: 200 }
      }
      
      const r = results.persistence.picks_row
      
      // Lock odds at pick-time from active Step-2 snapshot
      const activeSnapshot = await getActiveSnapshot(run_id)
      const locked_odds = activeSnapshot?.odds ?? results.locked_odds ?? null
      
      if (writeAllowed) {
        // Single transaction: insert pick with locked odds and update runs
        const ins = await admin.from('picks').insert({
          id: r.id,
          game_id: null,
          capper: 'shiva', // Add capper field so picks show up on dashboard
          pick_type: results.decision.pick_type.toLowerCase(),
          selection: r.selection,
          odds: 0,
          units: r.units,
          game_snapshot: {},
          status: 'pending',
          is_system_pick: true,
          confidence: r.confidence,
          reasoning: results.decision.reason,
          algorithm_version: 'shiva_v1',
          run_id,
          locked_odds: locked_odds,
        })
        if (ins.error) throw new Error(ins.error.message)

        // Update runs table with locked odds
        if (locked_odds) {
          const updateRun = await admin
            .from('runs')
            .update({ locked_odds: locked_odds })
            .eq('id', run_id)
          if (updateRun.error) throw new Error(updateRun.error.message)
        }

        // Record PICK_GENERATED result with cooldown
        try {
          // Get game_id from the snapshot (most reliable source)
          const activeSnapshot = await getActiveSnapshot(run_id)
          const gameId = activeSnapshot?.game_id

          console.log('[SHIVA:PickGenerate] PICK_GENERATED - game_id from snapshot:', gameId)

          if (gameId) {
            const cooldownResult = await pickGenerationService.recordPickGenerationResult({
              runId: run_id,
              gameId: gameId,
              capper: 'shiva',
              betType: results.decision.pick_type,
              result: 'PICK_GENERATED',
              units: r.units,
              confidence: r.confidence,
              pickId: r.id
            }, 0) // No cooldown for successful picks

            if (cooldownResult.success) {
              console.log('[SHIVA:PickGenerate] PICK_GENERATED cooldown recorded successfully for game:', gameId)
            } else {
              console.error('[SHIVA:PickGenerate] Failed to record PICK_GENERATED cooldown:', cooldownResult.error)
            }
          } else {
            console.warn('[SHIVA:PickGenerate] No game_id found for run:', run_id, 'Skipping cooldown recording')
          }
        } catch (error) {
          console.error('[SHIVA:PickGenerate] Error recording PICK_GENERATED cooldown:', error)
        }
      }
      
      const responseBody = { 
        run_id, 
        decision: 'PICK', 
        confidence: r.confidence, 
        pick: { 
          id: r.id, 
          run_id, 
          pick_type: results.decision.pick_type, 
          selection: r.selection, 
          units: r.units, 
          confidence: r.confidence,
          locked_odds: locked_odds,
          locked_at: new Date().toISOString()
        } 
      }
      
      // Structured logging
      console.log('[SHIVA:PickGenerate]', {
        run_id,
        inputs: {
          conf_final: parse.data.inputs.conf_final,
          edge_dominant: parse.data.inputs.edge_dominant,
        },
        outputs: {
          decision: 'PICK',
          pick_type: results.decision.pick_type,
          selection: r.selection,
          units: r.units,
          confidence: r.confidence,
        },
        writeAllowed,
        latencyMs: Date.now() - startTime,
        status: 200,
      })
      
      return { body: responseBody, status: 200 }
    }
  })
}


