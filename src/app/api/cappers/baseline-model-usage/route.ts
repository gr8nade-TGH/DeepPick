import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/cappers/baseline-model-usage
 * 
 * Returns count of how many cappers use each baseline model
 * Used to select least-used model as default for pick diversity
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Fetch all cappers with their factor_config
    const { data: cappers, error } = await supabase
      .from('user_cappers')
      .select('factor_config')
      .eq('is_active', true)
    
    if (error) {
      console.error('Error fetching cappers:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch cappers' 
      }, { status: 500 })
    }
    
    // Count baseline model usage
    const totalsModelCounts: Record<string, number> = {
      'pace-efficiency': 0,
      'ppg-based': 0,
      'matchup-defensive': 0
    }
    
    const spreadModelCounts: Record<string, number> = {
      'net-rating': 0,
      'scoring-margin': 0,
      'h2h-projection': 0
    }
    
    for (const capper of cappers || []) {
      const factorConfig = capper.factor_config as Record<string, any>
      
      // Count TOTAL baseline models
      const totalsModel = factorConfig?.TOTAL?.baseline_model
      if (totalsModel && totalsModel in totalsModelCounts) {
        totalsModelCounts[totalsModel]++
      } else {
        // Cappers without explicit model default to pace-efficiency
        totalsModelCounts['pace-efficiency']++
      }
      
      // Count SPREAD baseline models
      const spreadModel = factorConfig?.SPREAD?.baseline_model
      if (spreadModel && spreadModel in spreadModelCounts) {
        spreadModelCounts[spreadModel]++
      } else {
        // Cappers without explicit model default to net-rating
        spreadModelCounts['net-rating']++
      }
    }
    
    return NextResponse.json({
      success: true,
      totals: totalsModelCounts,
      spread: spreadModelCounts,
      totalCappers: cappers?.length || 0
    })
    
  } catch (err) {
    console.error('Error in baseline-model-usage:', err)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

