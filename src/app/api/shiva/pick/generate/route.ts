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
      predicted_total: z.number().optional(),
      baseline_avg: z.number().optional(),
      market_total_line: z.number().optional(),
      predicted_home_score: z.number().optional(),
      predicted_away_score: z.number().optional(),
      bold_predictions: z.any().optional()
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
            if (run_id) {
              const now = new Date().toISOString()

              // CRITICAL: Validate game_id exists - fail loudly if missing
              if (!gameId) {
                console.error('[SHIVA:PickGenerate] ❌ CRITICAL ERROR: No game_id found in snapshot')
                console.error('[SHIVA:PickGenerate] ❌ activeSnapshot:', JSON.stringify(activeSnapshot))
                throw new Error('CRITICAL: No game_id found in odds snapshot. Cannot save run without game_id.')
              }

              // Extract factor data from total_data if available
              const totalData = parse.data.inputs.total_data
              const factorContributions = totalData?.factor_contributions || null

              // CRITICAL: Only set predicted_total, baseline_avg, market_total for TOTALS picks
              // For SPREAD picks, these should be NULL
              const isTotal = results.decision.pick_type === 'TOTAL'
              const predictedTotal = isTotal ? (totalData?.predicted_total || null) : null
              const baselineAvg = isTotal ? (totalData?.baseline_avg || null) : null
              const marketTotal = isTotal ? (totalData?.market_total_line || null) : null

              const predictedHomeScore = totalData?.predicted_home_score || null
              const predictedAwayScore = totalData?.predicted_away_score || null
              const boldPredictions = totalData?.bold_predictions || null

              console.log('[SHIVA:PickGenerate] PASS - Attempting to upsert run:', {
                id: run_id,
                game_id: gameId,
                capper: 'shiva',
                bet_type: results.decision.pick_type,
                units: 0,
                hasFactors: !!factorContributions,
                predictedTotal,
                predictedHomeScore,
                predictedAwayScore,
                hasBoldPredictions: !!boldPredictions
              })

              // Build metadata object for backwards compatibility (run log uses this)
              const metadata = {
                capper: 'shiva',
                pick_type: results.decision.pick_type,
                selection: `${results.decision.pick_side} ${results.decision.line}`,
                units: 0,
                confidence: parse.data.inputs.conf_final,
                factor_contributions: factorContributions,
                predicted_total: predictedTotal,
                baseline_avg: baselineAvg,
                market_total: marketTotal,
                predicted_home_score: predictedHomeScore,
                predicted_away_score: predictedAwayScore,
                bold_predictions: boldPredictions
              }

              const { data, error } = await admin
                .from('runs')
                .upsert({
                  id: run_id,
                  run_id: run_id,
                  game_id: gameId,
                  capper: 'shiva',
                  bet_type: results.decision.pick_type,
                  units: 0,
                  confidence: parse.data.inputs.conf_final,
                  pick_type: results.decision.pick_type,
                  selection: `${results.decision.pick_side} ${results.decision.line}`,
                  // NEW format (separate columns)
                  factor_contributions: factorContributions,
                  predicted_total: predictedTotal,
                  baseline_avg: baselineAvg,
                  market_total: marketTotal,
                  predicted_home_score: predictedHomeScore,
                  predicted_away_score: predictedAwayScore,
                  bold_predictions: boldPredictions,
                  // OLD format (metadata JSONB) - for backwards compatibility with run log
                  metadata: metadata,
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
        // CRITICAL: Insert into runs table FIRST (parent record) before picks table (child record)
        // This respects the foreign key constraint: picks.run_id REFERENCES runs.run_id

        // Prepare factor data for runs table
        const totalData = parse.data.inputs.total_data
        const factorContributions = totalData?.factor_contributions || null

        // CRITICAL: Only set predicted_total, baseline_avg, market_total for TOTALS picks
        // For SPREAD picks, these should be NULL
        const isTotal = results.decision.pick_type === 'TOTAL'
        const predictedTotal = isTotal ? (totalData?.predicted_total || null) : null
        const baselineAvg = isTotal ? (totalData?.baseline_avg || null) : null
        const marketTotal = isTotal ? (totalData?.market_total_line || null) : null

        const predictedHomeScore = totalData?.predicted_home_score || null
        const predictedAwayScore = totalData?.predicted_away_score || null
        const boldPredictions = totalData?.bold_predictions || null

        console.log('[SHIVA:PickGenerate] 🔍 CRITICAL DEBUG - Received request body:', {
          run_id,
          has_total_data: !!totalData,
          total_data_keys: totalData ? Object.keys(totalData) : []
        })

        console.log('[SHIVA:PickGenerate] 🔍 CRITICAL DEBUG - Extracted data for runs table:', {
          hasFactorContributions: !!factorContributions,
          factorContributionsCount: factorContributions?.length || 0,
          factorContributionsSample: factorContributions?.[0],
          predictedTotal,
          baselineAvg,
          marketTotal,
          predictedHomeScore,
          predictedAwayScore,
          hasBoldPredictions: !!boldPredictions,
          totalDataKeys: totalData ? Object.keys(totalData) : []
        })

        console.log('[SHIVA:PickGenerate] 🔍 FULL factor_contributions array:', JSON.stringify(factorContributions, null, 2))

        // Get game_id from snapshot for the run record
        const gameId = activeSnapshot?.game_id

        const now = new Date().toISOString()

        console.log('[SHIVA:PickGenerate] STEP 1: Creating runs table record with run_id:', run_id)

        // CRITICAL FIX: Check if a run with THIS EXACT run_id already exists
        // This prevents duplicate inserts if the same run_id is processed multiple times
        const existingRunWithSameId = await admin
          .from('runs')
          .select('id, run_id')
          .eq('run_id', run_id)
          .maybeSingle()

        if (existingRunWithSameId.data) {
          console.log('[SHIVA:PickGenerate] ⚠️ Run with this exact run_id already exists - updating instead of inserting:', {
            run_id: existingRunWithSameId.data.run_id,
            game_id: gameId,
            hasBoldPredictions: !!boldPredictions
          })

          // First, fetch the existing run to get current metadata
          const { data: existingRun } = await admin
            .from('runs')
            .select('metadata')
            .eq('run_id', run_id)
            .single()

          // Merge new data into existing metadata
          const updatedMetadata = {
            ...(existingRun?.metadata || {}),
            factor_contributions: factorContributions,
            predicted_total: predictedTotal,
            baseline_avg: baselineAvg,
            market_total: marketTotal,
            predicted_home_score: predictedHomeScore,
            predicted_away_score: predictedAwayScore,
            bold_predictions: boldPredictions
          }

          const updateData = {
            // NEW format (separate columns)
            factor_contributions: factorContributions,
            predicted_total: predictedTotal,
            baseline_avg: baselineAvg,
            market_total: marketTotal,
            predicted_home_score: predictedHomeScore,
            predicted_away_score: predictedAwayScore,
            bold_predictions: boldPredictions,
            // OLD format (metadata JSONB) - for backwards compatibility with run log
            metadata: updatedMetadata,
            updated_at: now
          }

          console.log('[SHIVA:PickGenerate] 🔄 CRITICAL DEBUG - UPDATE data being sent to database:', {
            factor_contributions_count: factorContributions?.length || 0,
            predicted_total: predictedTotal,
            predicted_home_score: predictedHomeScore,
            predicted_away_score: predictedAwayScore,
            baseline_avg: baselineAvg,
            market_total: marketTotal,
            has_bold_predictions: !!boldPredictions
          })

          // UPDATE the existing run with new data (e.g., bold predictions)
          const updateRun = await admin
            .from('runs')
            .update(updateData)
            .eq('run_id', run_id)

          if (updateRun.error) {
            console.error('[SHIVA:PickGenerate] ❌ ERROR updating runs table:', updateRun.error.message)
            console.error('[SHIVA:PickGenerate] ❌ Full error:', JSON.stringify(updateRun.error, null, 2))
            throw new Error(updateRun.error.message)
          }
          console.log('[SHIVA:PickGenerate] ✅ Successfully updated runs table with new data')
        } else {
          // Check if ANY run exists for this game (for logging purposes only)
          const anyExistingRun = await admin
            .from('runs')
            .select('id, run_id')
            .eq('game_id', gameId || 'unknown')
            .eq('capper', 'shiva')
            .eq('bet_type', results.decision.pick_type)
            .maybeSingle()

          if (anyExistingRun.data) {
            console.log('[SHIVA:PickGenerate] ⚠️ WARNING: Another run exists for this game, but creating NEW run anyway:', {
              existing_run_id: anyExistingRun.data.run_id,
              new_run_id: run_id,
              game_id: gameId,
              bet_type: results.decision.pick_type,
              reason: 'Data integrity - never update existing runs with picks'
            })
          }

          // CRITICAL: Validate game_id exists - fail loudly if missing
          if (!gameId) {
            console.error('[SHIVA:PickGenerate] ❌ CRITICAL ERROR: No game_id found for PICK')
            console.error('[SHIVA:PickGenerate] ❌ activeSnapshot:', JSON.stringify(activeSnapshot))
            throw new Error('CRITICAL: No game_id found. Cannot save pick without game_id.')
          }

          // Create new run with current run_id
          console.log('[SHIVA:PickGenerate] Creating new run with id:', run_id)

          // Build metadata object for backwards compatibility (run log uses this)
          const metadata = {
            capper: 'shiva',
            pick_type: results.decision.pick_type,
            selection: r.selection,
            units: r.units,
            confidence: r.confidence,
            factor_contributions: factorContributions,
            predicted_total: predictedTotal,
            baseline_avg: baselineAvg,
            market_total: marketTotal,
            predicted_home_score: predictedHomeScore,
            predicted_away_score: predictedAwayScore,
            bold_predictions: boldPredictions
          }

          const insertData = {
            id: run_id,
            run_id: run_id,
            game_id: gameId,
            capper: 'shiva',
            bet_type: results.decision.pick_type,
            units: r.units,
            confidence: r.confidence,
            pick_type: results.decision.pick_type,
            selection: r.selection,
            // NEW format (separate columns)
            factor_contributions: factorContributions,
            predicted_total: predictedTotal,
            baseline_avg: baselineAvg,
            market_total: marketTotal,
            predicted_home_score: predictedHomeScore,
            predicted_away_score: predictedAwayScore,
            bold_predictions: boldPredictions,
            // OLD format (metadata JSONB) - for backwards compatibility with run log
            metadata: metadata,
            created_at: now,
            updated_at: now
          }

          console.log('[SHIVA:PickGenerate] 💾 CRITICAL DEBUG - INSERT data being sent to database:', {
            run_id,
            game_id: gameId,
            factor_contributions_count: factorContributions?.length || 0,
            predicted_total: predictedTotal,
            predicted_home_score: predictedHomeScore,
            predicted_away_score: predictedAwayScore,
            baseline_avg: baselineAvg,
            market_total: marketTotal,
            has_bold_predictions: !!boldPredictions
          })

          const insertRun = await admin
            .from('runs')
            .insert(insertData)

          if (insertRun.error) {
            console.error('[SHIVA:PickGenerate] ❌ ERROR inserting into runs table:', insertRun.error.message)
            console.error('[SHIVA:PickGenerate] ❌ Full error:', JSON.stringify(insertRun.error, null, 2))
            throw new Error(insertRun.error.message)
          }
          console.log('[SHIVA:PickGenerate] ✅ Successfully inserted into runs table')
        }

        console.log('[SHIVA:PickGenerate] Upserted runs table with factor data:', {
          run_id,
          gameId: gameId || 'unknown',
          hasFactorContributions: !!factorContributions,
          factorContributionsLength: factorContributions?.length || 0,
          predictedTotal,
          baselineAvg,
          marketTotal
        })

        // STEP 2: Now insert into picks table (child record) with run_id foreign key
        console.log('[SHIVA:PickGenerate] STEP 2: Inserting into picks table with run_id:', run_id, 'game_id:', gameId)
        // NOTE: Do NOT provide 'id' - let database generate UUID automatically
        // CRITICAL: Must include game_id so game selection logic can filter out games with existing picks
        const ins = await admin.from('picks').insert({
          game_id: gameId || null, // Use gameId from snapshot (CRITICAL for game selection filtering)
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
        if (ins.error) {
          console.error('[SHIVA:PickGenerate] ERROR inserting into picks table:', ins.error.message)
          throw new Error(ins.error.message)
        }
        console.log('[SHIVA:PickGenerate] ✓ Successfully inserted into picks table with game_id:', gameId)

        // Record PICK_GENERATED result with cooldown
        console.log('[SHIVA:PickGenerate] 🔄 Starting cooldown creation for PICK_GENERATED...')
        try {
          // gameId is already available from line 217
          console.log('[SHIVA:PickGenerate] PICK_GENERATED - using game_id:', gameId)

          if (gameId) {
            console.log('[SHIVA:PickGenerate] Calling recordPickGenerationResult with:', {
              runId: run_id,
              gameId: gameId,
              capper: 'shiva',
              betType: results.decision.pick_type.toLowerCase(),
              result: 'PICK_GENERATED',
              units: r.units,
              confidence: r.confidence,
              pickId: r.id,
              cooldownHours: 2
            })

            const cooldownResult = await pickGenerationService.recordPickGenerationResult({
              runId: run_id,
              gameId: gameId,
              capper: 'shiva',
              betType: results.decision.pick_type.toLowerCase() as 'TOTAL' | 'SPREAD',
              result: 'PICK_GENERATED',
              units: r.units,
              confidence: r.confidence,
              pickId: r.id
            }, 2) // 2-hour cooldown for all pick generation attempts (both PICK_GENERATED and PASS)

            console.log('[SHIVA:PickGenerate] recordPickGenerationResult returned:', cooldownResult)

            if (cooldownResult.success) {
              console.log('[SHIVA:PickGenerate] ✅ PICK_GENERATED cooldown recorded successfully for game:', gameId)
            } else {
              console.error('[SHIVA:PickGenerate] ❌ Failed to record PICK_GENERATED cooldown:', cooldownResult.error)
            }
          } else {
            console.warn('[SHIVA:PickGenerate] ⚠️ No game_id found for run:', run_id, 'Skipping cooldown recording')
          }
        } catch (error) {
          console.error('[SHIVA:PickGenerate] ❌ Exception recording PICK_GENERATED cooldown:', error)
          console.error('[SHIVA:PickGenerate] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
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


