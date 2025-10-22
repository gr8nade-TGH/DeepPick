/**
 * Factor Configuration API
 * GET: Retrieve factor config for capper/sport/bet type
 * POST: Save factor configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDefaultProfile, FACTOR_REGISTRY } from '@/lib/cappers/shiva-v1/factor-config-registry'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// SCHEMAS
// ============================================================================

const GetConfigSchema = z.object({
  capperId: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB']),
  betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL'])
})

const FactorConfigSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  weight: z.number().min(0).max(150), // Updated to support 150% weight budget
  dataSource: z.enum(['nba-stats-api', 'statmuse', 'manual', 'llm', 'news-api', 'system']),
  maxPoints: z.number(),
  sport: z.string(),
  betType: z.string(),
  scope: z.enum(['team', 'player', 'matchup', 'global']),
  icon: z.string(),
  shortName: z.string()
}).refine((data) => {
  // If factor is disabled, allow weight to be 0 and be more lenient with other fields
  if (!data.enabled) {
    return data.weight === 0
  }
  return true
}, {
  message: "Disabled factors must have weight 0"
})

const SaveConfigSchema = z.object({
  capperId: z.string().min(1),
  sport: z.enum(['NBA', 'NFL', 'MLB']),
  betType: z.enum(['SPREAD', 'MONEYLINE', 'TOTAL']),
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
    const supabase = getSupabase()
    const { data: savedProfile, error } = await supabase
      .from('capper_profiles')
      .select('*')
      .eq('capper_id', capper)
      .eq('sport', spt)
      .eq('bet_type', bt)
      .eq('is_active', true)
      .single()
    
    if (error || !savedProfile) {
      // Fallback to default profile if no saved profile found
      console.log('[Factors:Config:GET] No saved profile found, using default')
      const profile = getDefaultProfile(capper, spt, bt)
      return NextResponse.json({
        success: true,
        profile,
        registry: FACTOR_REGISTRY
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
    
    return NextResponse.json({
      success: true,
      profile,
      registry: FACTOR_REGISTRY
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
  try {
    const body = await request.json()
    console.log('[Factors:Config:POST] Request body:', JSON.stringify(body, null, 2))
    
    const parse = SaveConfigSchema.safeParse(body)
    
    if (!parse.success) {
      console.error('[Factors:Config:POST] Validation error:', parse.error.issues)
      console.error('[Factors:Config:POST] Full error object:', parse.error)
      console.error('[Factors:Config:POST] Request body that failed:', JSON.stringify(body, null, 2))
      return NextResponse.json(
        { error: 'Invalid request body', details: parse.error.issues },
        { status: 400 }
      )
    }
    
    const { capperId, sport, betType, name, description, factors } = parse.data
    
    // Save to database
    const supabase = getSupabase()
    const profileId = `${capperId}-${sport}-${betType}-custom-${Date.now()}`.toLowerCase()
    
    // First, deactivate any existing active profile for this capper/sport/betType
    await supabase
      .from('capper_profiles')
      .update({ is_active: false })
      .eq('capper_id', capperId)
      .eq('sport', sport)
      .eq('bet_type', betType)
      .eq('is_active', true)
    
    // Insert new profile
    const { data: savedProfile, error } = await supabase
      .from('capper_profiles')
      .insert({
        id: profileId,
        capper_id: capperId,
        sport,
        bet_type: betType,
        name,
        description,
        factors,
        is_active: true,
        is_default: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Factors:Config:POST] Database error:', error)
      console.error('[Factors:Config:POST] Error code:', error.code)
      console.error('[Factors:Config:POST] Error details:', error.details)
      console.error('[Factors:Config:POST] Error hint:', error.hint)
      console.error('[Factors:Config:POST] Full error object:', JSON.stringify(error, null, 2))
      
      // Return detailed error info to help debug
      return NextResponse.json({
        error: 'Failed to save configuration',
        details: error.message,
        code: error.code,
        hint: error.hint,
        fullError: error
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
    
    console.log('[Factors:Config:POST] Saved profile:', {
      profileId,
      capperId,
      sport,
      betType,
      factorCount: factors.length
    })
    
    return NextResponse.json({
      success: true,
      profile,
      message: 'Factor configuration saved successfully'
    })
  } catch (error) {
    console.error('[Factors:Config:POST] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

