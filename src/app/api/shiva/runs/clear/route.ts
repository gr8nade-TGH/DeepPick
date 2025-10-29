import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/shiva/runs/clear
 * Clears all SHIVA runs from the runs table
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
    console.log('[ClearRuns] Starting clear operation...')
    
    // Count runs before deletion
    const { count: beforeCount, error: countError } = await supabase
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('capper', 'shiva')
    
    if (countError) {
      console.error('[ClearRuns] Error counting runs:', countError)
    }
    
    console.log(`[ClearRuns] Found ${beforeCount || 0} SHIVA runs to delete`)
    
    // Delete all SHIVA runs
    const { error: deleteError, count: deletedCount } = await supabase
      .from('runs')
      .delete({ count: 'exact' })
      .eq('capper', 'shiva')
    
    if (deleteError) {
      console.error('[ClearRuns] Error deleting runs:', deleteError)
      return NextResponse.json({ 
        success: false, 
        error: deleteError.message,
        details: 'Failed to delete runs from database'
      }, { status: 500 })
    }
    
    console.log(`[ClearRuns] Successfully deleted ${deletedCount || 0} SHIVA runs`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${deletedCount || 0} SHIVA runs`,
      deletedCount: deletedCount || 0,
      beforeCount: beforeCount || 0
    })
    
  } catch (error: any) {
    console.error('[ClearRuns] Unexpected error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}

