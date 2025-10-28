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
    .select('game_id, moneyline, spread, total, raw_payload')
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
    total_data: z.object({ 
      total_pred: z.number(), 
      market_total: z.number(),
      factor_contributions: z.any().optional(),
      predicted_total: z.number().optional()
    }).optional(),
  }).strict(),
  results: z.object({
    decision: z.object({ pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), pick_side: z.string(), line: z.number(), units: z.number(), reason: z.string() }).strict(),
    persistence: z.object({ picks_row: z.object({ id: z.string(), run_id: z.string(), sport: z.literal('NBA'), matchup: z.string(), confidence: z.number(), units: z.number(), pick_type: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']), selection: z.string(), created_at_utc: z.string() }).nullable() }).strict(),
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
  console.log('[SHIVA:PickGenerate] POST called')
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  console.log('[SHIVA:PickGenerate] writeAllowed:', writeAllowed)
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  console.log('[SHIVA:PickGenerate] Body parsed:', body ? 'success' : 'failed')
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
      console.log('[SHIVA:PickGenerate] EXEC FUNCTION CALLED for run:', run_id)
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

        // Get the game_id and total line from the snapshot (most reliable source) - fetch outside writeAllowed check for response debug
        const activeSnapshot = await getActiveSnapshot(run_id)
        console.log('[SHIVA:PickGenerate] PASS - activeSnapshot result:', activeSnapshot ? 'found' : 'not found')

        // Record PASS decision with cooldown (get game_id from the run's context)
        if (writeAllowed) {
          try {
            const totalLine = activeSnapshot?.total?.line || null
            let gameId = activeSnapshot?.game_id
            
            console.log('[SHIVA:PickGenerate] PASS - Executing database write...')
            console.log('[SHIVA:PickGenerate] PASS - game_id from snapshot:', gameId)
            console.log('[SHIVA:PickGenerate] PASS - activeSnapshot:', JSON.stringify(activeSnapshot))

            // Save the run record to runs table even for PASS decisions
            // Save even if gameId is null/undefined - use placeholder
            if (run_id) {
              const now = new Date().toISOString()
              
              // Extract factor data from total_data if available
              const totalData = parse.data.inputs.total_data
              const factorContributions = totalData?.factor_contributions || null
              const predictedTotal = totalData?.predicted_total || null
              
              console.log('[SHIVA:PickGenerate] PASS - Attempting to upsert run:', {
                id: run_id,
                game_id: gameId || 'unknown',
                capper: 'shiva',
                bet_type: results.decision.pick_type,
                units: 0,
                hasFactors: !!factorContributions,
                predictedTotal
              })
              
              const { data, error } = await admin
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
                  factor_contributions: factorContributions,
                  predicted_total: predictedTotal,
                  created_at: now,
                  updated_at: now
                }, { onConflict: 'id' })
              
              if (error) {
                console.error('[SHIVA:PickGenerate] Error saving PASS run:', error)
              } else {
                console.log('[SHIVA:PickGenerate] PASS run saved successfully!', {
                  run_id,
                  gameId: gameId || 'unknown',
                  hasFactorContributions: !!factorContributions,
                  hasPredictedTotal: !!predictedTotal,
                  factorContributionsLength: factorContributions?.length || 0,
                  predictedTotal
                })
              }
            } else {
              console.log('[SHIVA:PickGenerate] PASS - cannot save run, run_id is null/undefined')
            }

            if (gameId) {
              const cooldownResult = await pickGenerationService.recordPickGenerationResult({
                runId: run_id,
                gameId: gameId,
                capper: 'shiva',
                betType: results.decision.pick_type.toLowerCase() as 'TOTAL' | 'SPREAD',
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

        return { body: { run_id, decision: 'PASS', confidence: parse.data.inputs.conf_final, pick: null, writeAllowed, debug: { hasSnapshot: !!activeSnapshot, gameId: activeSnapshot?.game_id, snapshotGameId: activeSnapshot?.game_id || null } }, status: 200 }
      }
      
      const r = results.persistence.picks_row
      
      // Lock odds at pick-time from active Step-2 snapshot
      const activeSnapshot = await getActiveSnapshot(run_id)
      const locked_odds = activeSnapshot?.raw_payload ?? results.locked_odds ?? null
      
      if (writeAllowed) {
        // Single transaction: insert pick and update runs
        const ins = await admin.from('picks').insert({
          id: r.id,
          game_id: null,
          capper: 'shiva', // Add capper field so picks show up on dashboard
          pick_type: results.decision.pick_type.toLowerCase(),
          selection: r.selection,
          odds: 0,
          units: r.units,
          game_snapshot: locked_odds || {}, // Store locked_odds in game_snapshot
          status: 'pending',
          is_system_pick: true,
          confidence: r.confidence,
          reasoning: results.decision.reason,
          algorithm_version: 'shiva_v1',
          run_id
        })
        if (ins.error) throw new Error(ins.error.message)

        // Update runs table with factor data
        const totalData = parse.data.inputs.total_data
        const factorContributions = totalData?.factor_contributions || null
        const predictedTotal = totalData?.predicted_total || null
        
        const updateData: any = {}
        if (factorContributions) {
          updateData.factor_contributions = factorContributions
        }
        if (predictedTotal) {
          updateData.predicted_total = predictedTotal
        }
        
        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = new Date().toISOString()
          const updateRun = await admin
            .from('runs')
            .update(updateData)
            .eq('id', run_id)
          if (updateRun.error) throw new Error(updateRun.error.message)
          
          console.log('[SHIVA:PickGenerate] Updated runs table with factor data:', {
            hasFactorContributions: !!factorContributions,
            predictedTotal
          })
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
                betType: results.decision.pick_type.toLowerCase() as 'TOTAL' | 'SPREAD',
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


