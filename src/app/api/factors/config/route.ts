/**
 * Factor Configuration API
 * GET: Retrieve factor config for capper/sport/bet type
 * POST: Save factor configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDefaultProfile, FACTOR_REGISTRY } from '@/lib/cappers/shiva-v1/factor-config-registry'

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
  dataSource: z.enum(['nba-stats-api', 'statmuse', 'manual', 'llm', 'news-api']),
  maxPoints: z.number(),
  sport: z.string(),
  betType: z.string(),
  scope: z.enum(['team', 'player', 'matchup', 'global']),
  icon: z.string(),
  shortName: z.string()
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
    
    // For now, return default profile
    // TODO: Fetch from database when capper_profiles table is created
    const profile = getDefaultProfile(capper, spt, bt)
    
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
      return NextResponse.json(
        { error: 'Invalid request body', details: parse.error.issues },
        { status: 400 }
      )
    }
    
    const { capperId, sport, betType, name, description, factors } = parse.data
    
    // TODO: Save to database when capper_profiles table is created
    // For now, just return success
    
    const profileId = `${capperId}-${sport}-${betType}-custom-${Date.now()}`.toLowerCase()
    
    const savedProfile = {
      id: profileId,
      capperId,
      sport,
      betType,
      name,
      description,
      factors,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      isDefault: false
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
      profile: savedProfile,
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

