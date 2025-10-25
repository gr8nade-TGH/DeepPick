import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * FORCE CLEAR: Delete all picks using multiple strategies
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[FORCE-CLEAR] Starting force clear operation...')
    
    const supabase = getSupabaseAdmin()
    
    // Count before deletion
    const { count: beforeCount } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
    
    console.log(`[FORCE-CLEAR] Found ${beforeCount || 0} picks to delete`)
    
    // Strategy 1: Try to delete all records (no filter)
    let deleteError = null
    try {
      const { error } = await supabase
        .from('picks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // This should match all records
      
      if (error) {
        console.log('[FORCE-CLEAR] Strategy 1 failed:', error.message)
        deleteError = error
      } else {
        console.log('[FORCE-CLEAR] Strategy 1 succeeded')
      }
    } catch (e) {
      console.log('[FORCE-CLEAR] Strategy 1 exception:', e)
      deleteError = e
    }
    
    // Strategy 2: If strategy 1 failed, try deleting by capper
    if (deleteError) {
      console.log('[FORCE-CLEAR] Trying strategy 2 - delete by capper...')
      
      const cappers = ['shiva', 'nexus', 'cerberus', 'ifrit', 'deeppick', 'oracle']
      
      for (const capper of cappers) {
        try {
          const { error } = await supabase
            .from('picks')
            .delete()
            .eq('capper', capper)
          
          if (error) {
            console.log(`[FORCE-CLEAR] Failed to delete ${capper} picks:`, error.message)
          } else {
            console.log(`[FORCE-CLEAR] Deleted ${capper} picks`)
          }
        } catch (e) {
          console.log(`[FORCE-CLEAR] Exception deleting ${capper}:`, e)
        }
      }
    }
    
    // Strategy 3: Try deleting by status
    if (deleteError) {
      console.log('[FORCE-CLEAR] Trying strategy 3 - delete by status...')
      
      const statuses = ['pending', 'won', 'lost', 'push', 'cancelled', 'active', 'completed']
      
      for (const status of statuses) {
        try {
          const { error } = await supabase
            .from('picks')
            .delete()
            .eq('status', status)
          
          if (error) {
            console.log(`[FORCE-CLEAR] Failed to delete ${status} picks:`, error.message)
          } else {
            console.log(`[FORCE-CLEAR] Deleted ${status} picks`)
          }
        } catch (e) {
          console.log(`[FORCE-CLEAR] Exception deleting ${status}:`, e)
        }
      }
    }
    
    // Clear cooldowns
    try {
      await supabase
        .from('pick_generation_cooldowns')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      console.log('[FORCE-CLEAR] Cleared cooldowns')
    } catch (e) {
      console.log('[FORCE-CLEAR] Failed to clear cooldowns:', e)
    }
    
    // Verify deletion
    const { count: afterCount } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
    
    console.log(`[FORCE-CLEAR] After deletion: ${afterCount || 0} picks remaining`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Force clear completed!`,
      beforeCount: beforeCount || 0,
      afterCount: afterCount || 0,
      deletedCount: (beforeCount || 0) - (afterCount || 0)
    })
    
  } catch (error: any) {
    console.error('[FORCE-CLEAR] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Force clear failed. Check console logs for details.'
    }, { status: 500 })
  }
}
