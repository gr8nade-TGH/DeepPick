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
    
    // Delete picks one capper at a time to avoid enum operator issues
    let totalDeletedPicks = 0
    const cappers = ['shiva', 'cerberus', 'nexus', 'ifrit', 'deeppick', 'oracle']
    
    for (const capper of cappers) {
      const { error, count } = await supabase
        .from('picks')
        .delete({ count: 'exact' })
        .eq('capper', capper)
      
      if (!error && count) {
        totalDeletedPicks += count
        console.log(`[clear-all-picks] Deleted ${count} picks from ${capper}`)
      } else if (error) {
        console.error(`[clear-all-picks] Error deleting ${capper} picks:`, error.message)
      }
    }
    
    // Also clear all cooldowns one capper at a time
    let totalDeletedCooldowns = 0
    for (const capper of cappers) {
      const { error, count } = await supabase
        .from('pick_generation_cooldowns')
        .delete({ count: 'exact' })
        .eq('capper', capper)
      
      if (!error && count) {
        totalDeletedCooldowns += count
        console.log(`[clear-all-picks] Deleted ${count} cooldowns from ${capper}`)
      }
    }
    
    console.log(`[clear-all-picks] Successfully deleted ${totalDeletedPicks} picks and ${totalDeletedCooldowns} cooldown records`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${totalDeletedPicks} picks and ${totalDeletedCooldowns} cooldown records`,
      deletedPicksCount: totalDeletedPicks,
      deletedCooldownCount: totalDeletedCooldowns,
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
