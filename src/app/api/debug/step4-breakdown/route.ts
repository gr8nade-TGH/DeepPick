import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  
  // Get the most recent run
  const { data: recentRun } = await supabase
    .from('runs')
    .select('run_id, conf_final, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (!recentRun) {
    return NextResponse.json({ error: 'No runs found' })
  }
  
  // Get the full run data with all steps
  const { data: runData } = await supabase
    .from('runs')
    .select('*')
    .eq('run_id', recentRun.run_id)
    .single()
  
  return NextResponse.json({
    run_id: recentRun.run_id,
    created_at: recentRun.created_at,
    conf_final: recentRun.conf_final,
    breakdown: {
      conf7: runData?.conf7,
      conf_source: runData?.conf_source,
      factor_adjustments: runData?.factor_adjustments || {},
      total_pred: runData?.predicted_total,
      market_total: runData?.market_total_line,
      edge_pts: runData?.edge_pts,
      edge_factor: runData?.edge_factor,
      base_confidence: runData?.conf7,
      adjusted_confidence: runData?.conf_final
    }
  })
}

