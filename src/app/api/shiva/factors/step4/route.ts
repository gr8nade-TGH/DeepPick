import { z } from 'zod'
import { ensureApiEnabled, isWriteAllowed, jsonError, jsonOk, requireIdempotencyKey } from '@/lib/api/shiva-v1/route-helpers'
import { withIdempotency } from '@/lib/api/shiva-v1/idempotency'
import { calculateConfidence } from '@/lib/cappers/shiva-v1/confidence-calculator'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const Step4Schema = z.object({
  run_id: z.string().min(1),
  inputs: z.object({
    sport: z.enum(['NBA', 'NFL', 'MLB']).default('NBA'),
    betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']).default('TOTAL'),
  }).strict(),
  results: z.object({
    factors: z.array(z.object({
      factor_no: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
      key: z.string().min(1),
      name: z.string().min(1),
      weight_total_pct: z.number().finite(),
      normalized_value: z.number().finite(), // This is our signal sᵢ
      raw_values_json: z.unknown(),
      parsed_values_json: z.record(z.unknown()),
      caps_applied: z.boolean(),
      cap_reason: z.string().nullable(),
      notes: z.string().nullable().optional(),
    }).strict()),
    factor_version: z.string(),
    baseline: z.object({
      awayPointsPerGame: z.number(),
      homePointsPerGame: z.number(),
      matchupBaseline: z.number(),
    }).optional(),
    meta: z.object({
      conf_source: z.string(),
    }).optional(),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('[SHIVA:Step4] === ROUTE CALLED ===')
  
  const apiErr = ensureApiEnabled()
  if (apiErr) {
    console.log('[SHIVA:Step4] API not enabled:', apiErr)
    return apiErr
  }
  
  const writeAllowed = isWriteAllowed()
  console.log('[SHIVA:Step4] Write allowed:', writeAllowed)
  
  const key = requireIdempotencyKey(request)
  if (typeof key !== 'string') {
    console.log('[SHIVA:Step4] Invalid idempotency key:', key)
    return key
  }

  const body = await request.json().catch(() => null)
  console.log('[SHIVA:Step4] Request body:', JSON.stringify(body, null, 2))
  console.log('[SHIVA:Step4] Body type:', typeof body)
  console.log('[SHIVA:Step4] Body keys:', body ? Object.keys(body) : 'null')
  console.log('[SHIVA:Step4] Idempotency key:', key)
  
  const parse = Step4Schema.safeParse(body)
  if (!parse.success) {
    console.error('[SHIVA:Step4] Schema validation failed:', {
      error: 'INVALID_BODY',
      issues: parse.error.issues,
      body: body,
      latencyMs: Date.now() - startTime,
    })
    return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })
  }
  
  console.log('[SHIVA:Step4] Schema validation passed')

  const { run_id, inputs, results } = parse.data
  const { sport, betType } = inputs
  
  console.log('[SHIVA:Step4] Parsed data:', { run_id, sport, betType, factorCount: results.factors.length })
  
  return withIdempotency({
    runId: run_id,
    step: 'step4',
    idempotencyKey: key,
    writeAllowed,
    exec: async () => {
      console.log('[SHIVA:Step4] ===== EXEC FUNCTION CALLED =====')
      console.log('[SHIVA:Step4] exec() started, run_id:', run_id)
      const admin = getSupabaseAdmin()
      console.log('[SHIVA:Step4] Supabase admin obtained')
      
      console.log('[SHIVA:Step4] Inside exec, checking conditions:', { sport, betType, isNBA: sport === 'NBA', isTOTAL: betType === 'TOTAL' })
      
      // Only process NBA TOTAL bets with new system
      if (sport === 'NBA' && betType === 'TOTAL') {
        console.log('[SHIVA:Step4] Starting NBA TOTAL processing...')
        try {
          console.log('[SHIVA:Step4] Processing NBA TOTAL bet:', {
            run_id,
            sport,
            betType,
            factorCount: results.factors.length
          })
          
          // Extract factor weights from the factors
          const factorWeights = results.factors.reduce((acc, factor) => {
            acc[factor.key] = factor.weight_total_pct
            return acc
          }, {} as Record<string, number>)
          
          // Calculate confidence using new system
          console.log('[SHIVA:Step4] About to calculate confidence...')
          const confidenceResult = calculateConfidence({
            factors: results.factors.map(f => ({
              ...f,
              raw_values_json: f.raw_values_json as Record<string, any>,
              notes: f.notes || undefined
            })),
            factorWeights,
            confSource: 'nba_totals_v1'
          })
          
          console.log('[SHIVA:Step4] Confidence calculation completed:', {
            factorWeights,
            factorCount: results.factors.length,
            confidenceResult
          })
          
          // Generate real score predictions from factor signals
          // NEW: Use matchup baseline (team averages) instead of league average
          const matchupBaseline = results.baseline?.matchupBaseline || 225.0
          const awayPts = results.baseline?.awayPointsPerGame || 111.5
          const homePts = results.baseline?.homePointsPerGame || 111.5
          console.log('[SHIVA:Step4] Using matchup baseline:', { matchupBaseline, awayPts, homePts })
          
          // Calculate factor adjustments to the total
          let totalAdjustment = 0
          const factorAdjustments: Record<string, number> = {}
          
          for (const factor of results.factors) {
            const signal = factor.normalized_value || 0
            const weight = factorWeights[factor.key] || 0
            const maxPoints = 5.0 // All factors now have 5.0 max points
            
            // Calculate adjustment: signal × maxPoints × (weight/100)
            const adjustment = signal * maxPoints * (weight / 100)
            totalAdjustment += adjustment
            factorAdjustments[factor.key] = adjustment
          }
          
          // Calculate predicted total using matchup baseline
          const predictedTotal = Math.max(180, Math.min(280, matchupBaseline + totalAdjustment))
          
          // Split predicted total based on team averages with home court advantage
          const homeCourtAdvantage = 2.5 // NBA home court advantage
          const totalTeamAvg = awayPts + homePts
          const awayRatio = awayPts / totalTeamAvg
          const homeRatio = homePts / totalTeamAvg
          
          const baseHomeScore = predictedTotal * homeRatio + homeCourtAdvantage
          const baseAwayScore = predictedTotal * awayRatio - homeCourtAdvantage
          
          // Add realistic variance (±2-3 points) but ensure no ties
          const variance = (Math.random() - 0.5) * 4 // ±2 point variance
          let homeScore = Math.round(baseHomeScore + variance)
          let awayScore = Math.round(baseAwayScore - variance)
          
          // Ensure no ties by adding minimum 1-point difference
          if (homeScore === awayScore) {
            // Randomly pick which team gets the extra point
            if (Math.random() > 0.5) {
              homeScore += 1
            } else {
              awayScore += 1
            }
          }
          
          // Ensure scores add up to predicted total (within 1 point)
          const actualTotal = homeScore + awayScore
          const totalDiff = predictedTotal - actualTotal
          if (Math.abs(totalDiff) > 0) {
            // Adjust the higher scoring team to match predicted total
            if (homeScore > awayScore) {
              homeScore += Math.round(totalDiff)
            } else {
              awayScore += Math.round(totalDiff)
            }
          }
          
          const predictedScores = {
            home: homeScore,
            away: awayScore
          }
          
          // Determine winner (guaranteed to be home or away, never tie)
          const winner = homeScore > awayScore ? 'home' : 'away'
          
          if (writeAllowed) {
            // Store confidence calculation and factor data
            const upd = await admin.from('runs').update({ 
              conf7: confidenceResult.confScore,
              conf_source: confidenceResult.confSource,
              factor_contributions: confidenceResult.factorContributions,
              factor_adjustments: factorAdjustments,
              predicted_total: predictedTotal
            }).eq('run_id', run_id)
            if (upd.error) throw new Error(upd.error.message)
          }
          
          const responseBody = {
            run_id,
            predictions: {
              league_average_total: matchupBaseline,
              total_adjustment: totalAdjustment,
              factor_adjustments: factorAdjustments,
              total_pred_points: predictedTotal,
              scores: predictedScores,
              winner: winner,
              conf7_score: confidenceResult.confScore,
            },
            confidence: {
              base_confidence: confidenceResult.confScore,
              signed_sum: confidenceResult.edgeRaw,
              factor_contributions: confidenceResult.factorContributions,
              conf_source: confidenceResult.confSource
            },
            conf_source: confidenceResult.confSource,
          }
          
          console.log('[SHIVA:Step4] Generated response body:', responseBody)
          
          // Structured logging
          console.log('[SHIVA:Step4New]', {
            run_id,
            inputs: { sport, betType },
            outputs: {
              league_average_total: matchupBaseline,
              total_adjustment: totalAdjustment,
              predicted_total: predictedTotal,
              predicted_scores: predictedScores,
              winner: winner,
              base_confidence: confidenceResult.confScore,
              signed_sum: confidenceResult.edgeRaw,
              factor_count: results.factors.length,
            },
            factor_adjustments: factorAdjustments,
            writeAllowed,
            latencyMs: Date.now() - startTime,
            status: 200,
          })
          
          return { body: responseBody, status: 200 }
        } catch (error) {
          console.error('[SHIVA:Step4] Error processing NBA TOTAL bet:', {
            run_id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          
          // Return a valid response structure even on error to avoid caching empty responses
          const errorResponse = {
            run_id,
            predictions: {
              league_average_total: 225.0,
              total_adjustment: 0,
              factor_adjustments: {},
              total_pred_points: 225.0,
              scores: { home: 112, away: 113 },
              winner: 'away',
              conf7_score: 0,
            },
            confidence: {
              base_confidence: 0,
              signed_sum: 0,
              factor_contributions: [],
              conf_source: 'error'
            },
            conf_source: 'error',
            error: error instanceof Error ? error.message : String(error)
          }
          
          return { body: errorResponse, status: 200 }
        }
      } else {
        // For non-NBA or non-TOTAL, return legacy response
        console.log('[SHIVA:Step4] Unsupported bet type:', { sport, betType })
        
        // Return a valid response structure even for unsupported bet types
        const unsupportedResponse = {
          run_id,
          predictions: {
            league_average_total: 225.0,
            total_adjustment: 0,
            factor_adjustments: {},
            total_pred_points: 225.0,
            scores: { home: 112, away: 113 },
            winner: 'away',
            conf7_score: 0,
          },
          confidence: {
            base_confidence: 0,
            signed_sum: 0,
            factor_contributions: [],
            conf_source: 'unsupported'
          },
          conf_source: 'unsupported',
          error: `Unsupported bet type: ${sport} ${betType}`
        }
        
        return { body: unsupportedResponse, status: 200 }
      }
    }
  })
}
