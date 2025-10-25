import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
    console.log('[clear-all-picks] Starting clear operation for ALL picks...')
    
    // Count total picks before deletion
    const { count: beforePicksCount, error: countError } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('Error counting picks:', countError)
    }
    
    console.log(`[clear-all-picks] Found ${beforePicksCount || 0} total picks to delete`)
    
    // Delete ALL picks (for testing) - use IN with all capper values
    const { error: picksError, count: deletedPicksCount } = await supabase
      .from('picks')
      .delete({ count: 'exact' })
      .in('capper', ['shiva', 'cerberus', 'nexus', 'ifrit', 'deeppick', 'oracle']) // All known cappers
    
    if (picksError) {
      console.error('Error deleting picks:', picksError)
      return NextResponse.json({ 
        success: false, 
        error: picksError.message,
        details: 'Failed to delete picks from database'
      }, { status: 500 })
    }
    
    // Also clear all cooldowns - use IN with all capper values
    const { error: cooldownError, count: deletedCooldownCount } = await supabase
      .from('pick_generation_cooldowns')
      .delete({ count: 'exact' })
      .in('capper', ['shiva', 'cerberus', 'nexus', 'ifrit', 'deeppick', 'oracle']) // All known cappers
    
    if (cooldownError) {
      console.error('Error deleting cooldowns:', cooldownError)
    }
    
    console.log(`[clear-all-picks] Successfully deleted ${deletedPicksCount || 0} picks and ${deletedCooldownCount || 0} cooldown records`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${deletedPicksCount || 0} picks and ${deletedCooldownCount || 0} cooldown records`,
      deletedPicksCount: deletedPicksCount || 0,
      deletedCooldownCount: deletedCooldownCount || 0,
      beforePicksCount: beforePicksCount || 0
    })
    
  } catch (error: any) {
    console.error('[clear-all-picks] Unexpected error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}
