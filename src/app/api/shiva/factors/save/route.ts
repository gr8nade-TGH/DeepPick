import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabase } from '@/lib/supabase/server'
import { createRequestId, withApiCall } from '@/lib/telemetry/tracing'
import { logError } from '@/lib/telemetry/logger'
import { CapperProfile, FactorId } from '@/lib/domain/shiva.types'

// Valid factor IDs
const VALID_FACTOR_IDS: FactorId[] = [
  'pace', 'efg', 'tov', 'orb', 'ftr', 'home_away', 
  'form10', 'schedule_tax', 'injuries', 'market_move', 'edge_vs_market'
]

// Zod schemas for validation
const FactorConfigSchema = z.object({
  id: z.enum(VALID_FACTOR_IDS as [FactorId, ...FactorId[]]),
  weight: z.number().min(0).max(1),
  enabled: z.boolean(),
})

const FactorsPayloadSchema = z.object({
  factors: z.array(FactorConfigSchema),
  thresholds: z.object({
    play_abs: z.number().min(0).max(1),
    units_map: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(5)])),
  }),
  weights_sum: z.number().min(0.95).max(1.05),
})

const SaveConfigSchema = z.object({
  capper_code: z.string().min(1).max(50),
  label: z.string().optional(),
  config: FactorsPayloadSchema,
})

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  
  return withApiCall(
    { request_id: requestId, route: '/api/shiva/factors/save' },
    async () => {
      try {
        const body = await request.json()
        
        // Validate request body
        const parse = SaveConfigSchema.safeParse(body)
        if (!parse.success) {
          await logError({
            source: 'api',
            route: '/api/shiva/factors/save',
            request_id: requestId,
            code: 'VALIDATION_FAILED',
            details: {
              errors: parse.error.issues,
              body,
            },
          })

          return NextResponse.json({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Invalid request body',
              details: parse.error.issues,
            },
            request_id: requestId,
          }, { status: 400 })
        }

        const { capper_code, label, config } = parse.data

        // Additional validation: ensure weights sum matches
        const calculatedSum = config.factors
          .filter(f => f.enabled)
          .reduce((sum: number, f) => sum + f.weight, 0)

        if (Math.abs(calculatedSum - config.weights_sum) > 0.01) {
          await logError({
            source: 'api',
            route: '/api/shiva/factors/save',
            request_id: requestId,
            code: 'WEIGHTS_MISMATCH',
            details: {
              calculated_sum: calculatedSum,
              provided_sum: config.weights_sum,
            },
          })

          return NextResponse.json({
            error: {
              code: 'WEIGHTS_MISMATCH',
              message: 'Calculated weights sum does not match provided sum',
              details: {
                calculated_sum: calculatedSum,
                provided_sum: config.weights_sum,
              },
            },
            request_id: requestId,
          }, { status: 400 })
        }

        // Deactivate existing active profiles for this capper
        const supabase = getSupabase()
        await supabase
          .from('capper_profiles')
          .update({ is_active: false })
          .eq('capper_code', capper_code)
          .eq('is_active', true)

        // Insert new profile
        const { data: savedProfile, error } = await supabase
          .from('capper_profiles')
          .insert({
            capper_code,
            label: label || `${capper_code} v${Date.now()}`,
            config,
          })
          .select()
          .single()

        if (error) {
          await logError({
            source: 'api',
            route: '/api/shiva/factors/save',
            request_id: requestId,
            code: 'DB_ERROR',
            details: {
              error: error.message,
              code: error.code,
              hint: error.hint,
            },
          })

          return NextResponse.json({
            error: {
              code: 'DB_ERROR',
              message: 'Failed to save configuration',
              details: error.message,
            },
            request_id: requestId,
          }, { status: 500 })
        }

        // Convert to expected format
        const profile: CapperProfile = {
          profile_id: savedProfile.profile_id,
          capper_code: savedProfile.capper_code,
          version: savedProfile.version,
          is_active: savedProfile.is_active,
          label: savedProfile.label,
          config: savedProfile.config,
          created_at: savedProfile.created_at,
          updated_at: savedProfile.updated_at,
        }

        return NextResponse.json({
          profile_id: profile.profile_id,
          status: 'SAVED',
          profile,
          request_id: requestId,
        })

      } catch (error: any) {
        await logError({
          source: 'api',
          route: '/api/shiva/factors/save',
          request_id: requestId,
          code: 'UNHANDLED_ERROR',
          details: {
            message: error.message,
            stack: error.stack,
          },
        })

        return NextResponse.json({
          error: {
            code: 'UNHANDLED_ERROR',
            message: 'Internal server error',
            details: error.message,
          },
          request_id: requestId,
        }, { status: 500 })
      }
    }
  )
}
