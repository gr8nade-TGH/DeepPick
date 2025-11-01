/**
 * Factor Configuration API
 * GET: Retrieve factor config for capper/sport/bet type
 * POST: Save factor configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDefaultProfile, FACTOR_REGISTRY } from '@/lib/cappers/shiva-v1/factor-config-registry'
import { FACTOR_REGISTRY as MAIN_FACTOR_REGISTRY, getFactorsByContext } from '@/lib/cappers/shiva-v1/factor-registry'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================================
// SCHEMAS
// ============================================================================

const GetConfigSchema = z.object({
  capperId: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB']),
  betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL', 'SPREAD/MONEYLINE'])
})

const FactorConfigSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  weight: z.number().min(0).max(250), // Updated to support 250% weight budget
  dataSource: z.enum(['nba-stats-api', 'odds-api-scores', 'llm', 'openai', 'manual', 'system']),
  maxPoints: z.number(),
  sport: z.string(),
  betType: z.string(),
  scope: z.enum(['team', 'player', 'matchup', 'global', 'GLOBAL', 'SPORT', 'LEAGUE']),
  icon: z.string(),
  shortName: z.string()
}).transform((data) => {
  // Automatically set weight to 0 for disabled factors
  if (!data.enabled) {
    return { ...data, weight: 0 }
  }
  return data
})

const SaveConfigSchema = z.object({
  capperId: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB']),
  betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL', 'SPREAD/MONEYLINE']),
  name: z.string().min(1),
  description: z.string().optional(),
  factors: z.array(FactorConfigSchema)
})

// ============================================================================
// GET: Retrieve factor configuration
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const capperId = searchParams.get('capperId')
    const sport = searchParams.get('sport')
    const betType = searchParams.get('betType')

    const parse = GetConfigSchema.safeParse({ capperId, sport, betType })

    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parse.error.issues },
        { status: 400 }
      )
    }

    const { capperId: capper, sport: spt, betType: bt } = parse.data

    // Try to fetch from database first
    // CRITICAL: Query by is_default: true to match pick generation logic
    const supabase = getSupabase()
    const { data: savedProfile, error } = await supabase
      .from('capper_profiles')
      .select('*')
      .eq('capper_id', capper)
      .eq('sport', spt)
      .eq('bet_type', bt)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()

    if (error || !savedProfile) {
      // Fallback to default profile if no saved profile found
      console.log('[Factors:Config:GET] No saved profile found, using default')
      const profile = getDefaultProfile(capper, spt, bt)
      // Use the proper getFactorsByContext function
      const applicableFactors = getFactorsByContext(spt as any, bt as any);

      console.log('[Factors:Config:GET] Fallback debug info:', {
        capper: capper,
        sport: spt,
        betType: bt,
        totalFactors: MAIN_FACTOR_REGISTRY.length,
        applicableFactors: applicableFactors.length,
        factorKeys: applicableFactors.map(f => f.key)
      });

      // Convert array to object for frontend compatibility
      const registryObject = applicableFactors.reduce((acc, factor) => {
        acc[factor.key] = factor
        return acc
      }, {} as Record<string, any>)

      return NextResponse.json({
        success: true,
        profile,
        registry: registryObject
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Convert database profile to expected format
    const profile = {
      id: savedProfile.id,
      capperId: savedProfile.capper_id,
      sport: savedProfile.sport,
      betType: savedProfile.bet_type,
      name: savedProfile.name,
      description: savedProfile.description,
      factors: savedProfile.factors,
      isActive: savedProfile.is_active,
      isDefault: savedProfile.is_default,
      createdAt: savedProfile.created_at,
      updatedAt: savedProfile.updated_at
    }

    // Use the proper getFactorsByContext function
    const applicableFactors = getFactorsByContext(spt as any, bt as any);

    console.log('[Factors:Config:GET] Debug info:', {
      capper: capper,
      sport: spt,
      betType: bt,
      totalFactors: MAIN_FACTOR_REGISTRY.length,
      applicableFactors: applicableFactors.length,
      factorKeys: applicableFactors.map(f => f.key)
    });

    // Convert array to object for frontend compatibility
    const registryObject = applicableFactors.reduce((acc, factor) => {
      acc[factor.key] = factor
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      profile,
      registry: registryObject
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('[Factors:Config:GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST: Save factor configuration
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)

  try {
    console.log(`[${requestId}] [Factors:Config:POST] Starting POST request`)

    // Parse request body first
    const body = await request.json()
    console.log(`[${requestId}] [Factors:Config:POST] Request body parsed:`, {
      capperId: body.capperId,
      sport: body.sport,
      betType: body.betType,
      factorsCount: body.factors?.length || 0
    })

    // Debug: Log factor details for validation issues
    if (body.factors) {
      console.log(`[${requestId}] [Factors:Config:POST] Factor details:`,
        body.factors.map((f: any) => ({
          key: f.key,
          enabled: f.enabled,
          weight: f.weight,
          dataSource: f.dataSource,
          scope: f.scope
        }))
      )
    }

    // Validate request body
    const parse = SaveConfigSchema.safeParse(body)
    if (!parse.success) {
      console.error(`[${requestId}] [Factors:Config:POST] Validation failed:`, parse.error.issues)
      console.error(`[${requestId}] [Factors:Config:POST] Full request body:`, JSON.stringify(body, null, 2))
      return NextResponse.json({
        error: 'Invalid request body',
        details: parse.error.issues,
        requestId
      }, { status: 400 })
    }

    console.log(`[${requestId}] [Factors:Config:POST] Validation passed`)

    // Test database connection
    console.log(`[${requestId}] [Factors:Config:POST] Testing database connection...`)
    const supabase = getSupabase()
    console.log(`[${requestId}] [Factors:Config:POST] Supabase client created`)

    const { data: testData, error: testError } = await supabase
      .from('capper_profiles')
      .select('count')
      .limit(1)

    console.log(`[${requestId}] [Factors:Config:POST] Database test result:`, { testData, testError })

    if (testError) {
      console.error(`[${requestId}] [Factors:Config:POST] Database connection failed:`, testError)
      return NextResponse.json({
        error: 'Database connection failed',
        details: testError.message,
        code: testError.code,
        hint: testError.hint,
        requestId
      }, { status: 500 })
    }

    console.log(`[${requestId}] [Factors:Config:POST] Database connection successful`)

    const { capperId, sport, betType, name, description, factors } = parse.data
    console.log(`[${requestId}] [Factors:Config:POST] Extracted data:`, { capperId, sport, betType, name, description, factorsCount: factors.length })

    // Generate profile ID
    const profileId = `${capperId}-${sport}-${betType}-custom-${Date.now()}`.toLowerCase()
    console.log(`[${requestId}] [Factors:Config:POST] Generated profile ID:`, profileId)

    // First, deactivate any existing default profile for this capper/sport/betType
    console.log(`[${requestId}] [Factors:Config:POST] Deactivating existing profiles...`)
    const { error: deactivateError } = await supabase
      .from('capper_profiles')
      .update({ is_active: false, is_default: false })
      .eq('capper_id', capperId)
      .eq('sport', sport)
      .eq('bet_type', betType)
      .eq('is_default', true)

    if (deactivateError) {
      console.error(`[${requestId}] [Factors:Config:POST] Error deactivating existing profiles:`, deactivateError)
    } else {
      console.log(`[${requestId}] [Factors:Config:POST] Successfully deactivated existing profiles`)
    }

    // Insert new profile
    console.log(`[${requestId}] [Factors:Config:POST] Inserting new profile...`)
    const insertData = {
      id: profileId,
      capper_id: capperId,
      sport,
      bet_type: betType,
      name,
      description,
      factors,
      is_active: true,
      is_default: true  // CRITICAL: Set is_default to true so pick generation can find it
    }
    console.log(`[${requestId}] [Factors:Config:POST] Insert data:`, JSON.stringify(insertData, null, 2))

    const { data: savedProfile, error } = await supabase
      .from('capper_profiles')
      .insert(insertData)
      .select()
      .single()

    console.log(`[${requestId}] [Factors:Config:POST] Insert operation completed`)

    if (error) {
      console.error(`[${requestId}] [Factors:Config:POST] Database error:`, error)
      console.error(`[${requestId}] [Factors:Config:POST] Error code:`, error.code)
      console.error(`[${requestId}] [Factors:Config:POST] Error details:`, error.details)
      console.error(`[${requestId}] [Factors:Config:POST] Error hint:`, error.hint)

      return NextResponse.json({
        error: 'Failed to save configuration',
        details: error.message,
        code: error.code,
        hint: error.hint,
        requestId
      }, { status: 500 })
    }

    // Convert database profile to expected format
    const profile = {
      id: savedProfile.id,
      capperId: savedProfile.capper_id,
      sport: savedProfile.sport,
      betType: savedProfile.bet_type,
      name: savedProfile.name,
      description: savedProfile.description,
      factors: savedProfile.factors,
      isActive: savedProfile.is_active,
      isDefault: savedProfile.is_default,
      createdAt: savedProfile.created_at,
      updatedAt: savedProfile.updated_at
    }

    const duration = Date.now() - startTime
    console.log(`[${requestId}] [Factors:Config:POST] Success! Profile saved in ${duration}ms:`, {
      profileId,
      capperId,
      sport,
      betType,
      factorCount: factors.length
    })

    return NextResponse.json({
      success: true,
      profile,
      message: 'Factor configuration saved successfully',
      requestId,
      duration
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${requestId}] [Factors:Config:POST] Unexpected error after ${duration}ms:`, error)
    console.error(`[${requestId}] [Factors:Config:POST] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      duration
    }, { status: 500 })
  }
}

