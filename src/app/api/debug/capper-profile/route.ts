import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Query for SHIVA profile
    const { data: profileData, error: profileError } = await supabase
      .from('capper_profiles')
      .select('*')
      .eq('capper_id', 'SHIVA')
      .eq('sport', 'NBA')
      .eq('bet_type', 'TOTAL')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({
        success: false,
        error: profileError.message,
        query: {
          capper_id: 'SHIVA',
          sport: 'NBA',
          bet_type: 'TOTAL',
          is_default: true
        }
      }, { status: 500 })
    }

    if (!profileData) {
      return NextResponse.json({
        success: false,
        error: 'No profile found',
        query: {
          capper_id: 'SHIVA',
          sport: 'NBA',
          bet_type: 'TOTAL',
          is_default: true
        }
      }, { status: 404 })
    }

    // Extract factor weights
    const factorWeights: Record<string, number> = {}
    const enabledFactors: string[] = []
    const disabledFactors: string[] = []

    for (const factor of profileData.factors || []) {
      if (factor.enabled && factor.key !== 'edgeVsMarket') {
        factorWeights[factor.key] = factor.weight
        enabledFactors.push(factor.key)
      } else if (!factor.enabled) {
        disabledFactors.push(factor.key)
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profileData.id,
        capper_id: profileData.capper_id,
        sport: profileData.sport,
        bet_type: profileData.bet_type,
        is_default: profileData.is_default,
        is_active: profileData.is_active,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at
      },
      factors: profileData.factors,
      analysis: {
        total_factors: profileData.factors?.length || 0,
        enabled_factors: enabledFactors,
        disabled_factors: disabledFactors,
        factor_weights: factorWeights,
        enabled_count: enabledFactors.length,
        disabled_count: disabledFactors.length
      }
    })

  } catch (error) {
    console.error('[Debug:CapperProfile] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

