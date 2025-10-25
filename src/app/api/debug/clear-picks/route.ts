import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // First, count existing picks
    const { count: beforeCount, error: countError } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('capper', 'shiva')
    
    if (countError) {
      console.error('Error counting picks:', countError)
    }
    
    console.log(`[clear-picks] Found ${beforeCount || 0} SHIVA picks to delete`)
    
    // Clear all SHIVA picks for testing
    const { error, count: deletedCount } = await supabase
      .from('picks')
      .delete({ count: 'exact' })
      .eq('capper', 'shiva')
    
    if (error) {
      console.error('Error deleting picks:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: 'Failed to delete picks from database'
      }, { status: 500 })
    }
    
    console.log(`[clear-picks] Successfully deleted ${deletedCount || 0} SHIVA picks`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${deletedCount || 0} SHIVA picks`,
      deletedCount: deletedCount || 0,
      beforeCount: beforeCount || 0
    })
    
  } catch (error: any) {
    console.error('[clear-picks] Unexpected error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}
