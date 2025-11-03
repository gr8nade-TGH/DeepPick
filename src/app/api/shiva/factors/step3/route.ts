import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { computeTotalsFactors } from '@/lib/cappers/shiva-v1/factors/nba-totals-orchestrator'
import { computeSpreadFactors } from '@/lib/cappers/shiva-v1/factors/nba-spread-orchestrator'
import { getFactorWeightsFromProfile } from '@/lib/cappers/shiva-v1/confidence-calculator'
export const runtime = 'nodejs'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const Step3Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    teams: z.object({ home: z.string().min(1), away: z.string().min(1) }).strict(),
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
    ai_provider: z.enum(['perplexity', 'openai']),
    news_window_hours: z.number().finite(),
  }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
      key: z.string().min(1),
      name: z.string().min(1),
      weight_total_pct: z.number().finite(),
      raw_values_json: z.unknown(),
      parsed_values_json: z.record(z.unknown()),
      normalized_value: z.number().finite(),
      caps_applied: z.boolean(),
      cap_reason: z.string().nullable(),
      notes: z.string().nullable().optional(),
    }).strict()),
    meta: z.object({
      ai_provider: z.enum(['perplexity', 'openai']),
      factor_version: z.string().optional(),
    }).passthrough(),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const startTime = Date.now()
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeAllowed = isWriteAllowed()
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') return key

  const body = await request.json().catch(() => null)
  const parse = Step3Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step3]', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }

  const { run_id, inputs, results } = parse.data
  const { sport, betType } = inputs

  return withIdempotency({
    runId: run_id,
    step: 'step3',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      const admin = getSupabaseAdmin()

      // Branch on NBA bet type vs legacy factors
      let factorsToProcess: any[]
      let factorVersion: string

      console.debug('[step3:branch]', {
        sport,
        betType,
        used: sport === 'NBA' && (betType === 'TOTAL' || betType === 'SPREAD') ? betType.toLowerCase() : 'legacy'
      })

      let totalsDebug: any = null

      if (sport === 'NBA' && (betType === 'TOTAL' || betType === 'SPREAD')) {
        // Use new NBA factors (TOTAL or SPREAD)
        try {
          console.log(`[Step3:NBA-${betType}] Starting compute${betType === 'TOTAL' ? 'Totals' : 'Spread'}Factors...`)

          // Fetch capper profile to get factor weights (both dry run and write modes)
          let factorWeights: Record<string, number> = {}
          try {
            console.log(`[Step3:NBA-${betType}] Fetching profile for:`, { capper_id: 'SHIVA', sport: 'NBA', bet_type: betType })
            const profileRes = await admin
              .from('capper_profiles')
              .select('factors')
              .eq('capper_id', 'SHIVA')
              .eq('sport', 'NBA')
              .eq('bet_type', betType)
              .eq('is_default', true)
              .single()

            console.log(`[Step3:NBA-${betType}] Profile query result:`, {
              data: profileRes.data,
              error: profileRes.error,
              hasFactors: !!profileRes.data?.factors,
              factorsCount: profileRes.data?.factors?.length || 0
            })

            if (profileRes.data?.factors && profileRes.data.factors.length > 0) {
              factorWeights = getFactorWeightsFromProfile({ factors: profileRes.data.factors })
              console.log(`[Step3:NBA-${betType}] Using factor weights from profile:`, factorWeights)
            } else {
              console.error(`[Step3:NBA-${betType}] No profile found - FAILING as requested`)
              throw new Error('No capper profile found. Please configure factors first.')
            }
          } catch (profileError) {
            console.error(`[Step3:NBA-${betType}] Could not fetch profile - FAILING as requested:`, profileError)
            throw new Error(`Failed to load capper profile: ${profileError}`)
          }

          // Call the appropriate orchestrator based on betType
          const orchestratorResult = betType === 'TOTAL'
            ? await computeTotalsFactors({
              game_id: run_id,
              away: inputs.teams.away,
              home: inputs.teams.home,
              sport: 'NBA',
              betType: 'TOTAL',
              leagueAverages: {
                pace: 100.1,
                ORtg: 110.0,
                DRtg: 110.0,
                threePAR: 0.39,
                FTr: 0.22,
                threePstdev: 0.036
              },
              factorWeights
            })
            : await computeSpreadFactors({
              game_id: run_id,
              away: inputs.teams.away,
              home: inputs.teams.home,
              sport: 'NBA',
              betType: 'SPREAD',
              leagueAverages: {
                pace: 100.1,
                ORtg: 110.0,
                DRtg: 110.0,
                threePAR: 0.39,
                FTr: 0.22,
                threePstdev: 0.036
              },
              factorWeights
            })

          console.log(`[Step3:NBA-${betType}] Success:`, {
            factorCount: orchestratorResult.factors.length,
            version: orchestratorResult.factor_version
          })

          factorsToProcess = orchestratorResult.factors
          factorVersion = orchestratorResult.factor_version
          totalsDebug = orchestratorResult.totals_debug
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`[Step3:NBA-${betType}] Error details:`, {
            message: errorMsg,
            stack: error instanceof Error ? error.stack : undefined,
            fullError: error
          })
          // Log detailed error and throw for withIdempotency to handle
          throw new Error(`NBA ${betType} computation failed: ${errorMsg}. NBA Stats API may be unavailable or returning invalid data.`)
        }
      } else {
        // Use legacy factors (existing logic)
        factorsToProcess = results.factors
        factorVersion = 'legacy_v1'
      }

      const capsApplied = factorsToProcess.filter(f => f.caps_applied).length

      if (writeAllowed) {
        // Get game_id from the run (it was stored during Step 1 or Step 2)
        const { data: runData } = await admin
          .from('runs')
          .select('game_id')
          .eq('id', run_id)
          .single()

        const game_id = runData?.game_id || null

        // Single transaction: insert all factors
        for (const f of factorsToProcess) {
          const normalizedVal = f.normalized_value || 0
          const weightPct = f.weight_total_pct || 0
          const contribution = (normalizedVal * weightPct) / 100

          const ins = await admin.from('factors').insert({
            run_id,
            game_id,
            factor_no: f.factor_no,
            raw_values_json: f.raw_values_json,
            parsed_values_json: f.parsed_values_json,
            normalized_value: normalizedVal,
            factor_value: normalizedVal, // Map normalized_value to factor_value
            factor_contribution: contribution, // Calculate contribution
            weight_applied: weightPct,
            caps_applied: f.caps_applied || false,
            cap_reason: f.cap_reason ?? null,
            notes: f.notes ?? null,
          })
          if (ins.error) throw new Error(ins.error.message)
        }
      }

      // Extract baseline data from totalsDebug for Step 4
      const bundle = totalsDebug?.console_logs?.bundle
      const baselineData = bundle ? {
        awayPointsPerGame: bundle.awayPointsPerGame || 111.5,
        homePointsPerGame: bundle.homePointsPerGame || 111.5,
        matchupBaseline: (bundle.awayPointsPerGame || 111.5) + (bundle.homePointsPerGame || 111.5)
      } : null

      const responseBody = {
        run_id,
        factors: factorsToProcess,
        factor_count: factorsToProcess.length,
        factor_version: factorVersion,
        baseline: baselineData,
        _debug: totalsDebug ? {
          totals: totalsDebug,
          ai_provider: inputs.ai_provider,
          news_window_hours: inputs.news_window_hours
        } : null
      }

      // Structured logging
      console.log('[SHIVA:Step3]', {
        run_id,
        inputs: {
          ai_provider: results.meta.ai_provider,
        },
        outputs: {
          factor_count: results.factors.length,
          caps_applied: capsApplied,
        },
        writeAllowed,
        latencyMs: Date.now() - startTime,
        status: 200,
      })

      return { body: responseBody, status: 200 }
    }
  })
}


