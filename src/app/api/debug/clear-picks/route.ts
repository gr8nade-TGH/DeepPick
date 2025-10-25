import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    console.log('[clear-picks] Starting clear operation...')
    
    // First, count existing picks
    const { count: beforePicksCount, error: countError } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .eq('capper', 'shiva')
    
    if (countError) {
      console.error('Error counting picks:', countError)
    }
    
    // Count cooldown records
    const { count: beforeCooldownCount, error: cooldownCountError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*', { count: 'exact', head: true })
      .eq('capper', 'shiva')
    
    if (cooldownCountError) {
      console.error('Error counting cooldowns:', cooldownCountError)
    }
    
    console.log(`[clear-picks] Found ${beforePicksCount || 0} SHIVA picks and ${beforeCooldownCount || 0} cooldown records to delete`)
    
    // Clear all SHIVA picks - use lowercase 'shiva' as per database enum
    const { error: picksError, count: deletedPicksCount } = await supabase
      .from('picks')
      .delete({ count: 'exact' })
      .eq('capper', 'shiva')
    
    if (picksError) {
      console.error('Error deleting picks:', picksError)
      return NextResponse.json({ 
        success: false, 
        error: picksError.message,
        details: 'Failed to delete picks from database'
      }, { status: 500 })
    }
    
    // Clear all SHIVA cooldown records
    const { error: cooldownError, count: deletedCooldownCount } = await supabase
      .from('pick_generation_cooldowns')
      .delete({ count: 'exact' })
      .eq('capper', 'shiva')
    
    if (cooldownError) {
      console.error('Error deleting cooldowns:', cooldownError)
      // Don't fail the whole operation if cooldowns fail
    }
    
    console.log(`[clear-picks] Successfully deleted ${deletedPicksCount || 0} SHIVA picks and ${deletedCooldownCount || 0} cooldown records`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${deletedPicksCount || 0} SHIVA picks and ${deletedCooldownCount || 0} cooldown records`,
      deletedPicksCount: deletedPicksCount || 0,
      deletedCooldownCount: deletedCooldownCount || 0,
      beforePicksCount: beforePicksCount || 0,
      beforeCooldownCount: beforeCooldownCount || 0
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
