import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
    console.log('[clear-picks-sql] Using direct SQL to delete all picks...')
    
    // Use raw SQL to delete all picks
    const { data: pickData, error: pickError } = await supabase.rpc('exec_sql', {
      query: 'DELETE FROM picks WHERE true RETURNING id'
    })
    
    // If that doesn't work, try a simpler approach
    if (pickError) {
      console.log('[clear-picks-sql] RPC failed, trying TRUNCATE...')
      
      // Try TRUNCATE (faster and more reliable)
      const { error: truncateError } = await supabase.rpc('exec_sql', {
        query: 'TRUNCATE TABLE picks CASCADE'
      })
      
      if (truncateError) {
        console.error('[clear-picks-sql] TRUNCATE failed:', truncateError)
        return NextResponse.json({ 
          success: false, 
          error: truncateError.message,
          details: 'Failed to truncate picks table'
        }, { status: 500 })
      }
      
      console.log('[clear-picks-sql] TRUNCATE successful')
      
      return NextResponse.json({ 
        success: true, 
        message: 'Successfully truncated picks table (all picks cleared)',
        method: 'TRUNCATE'
      })
    }
    
    const deletedCount = pickData?.length || 0
    console.log(`[clear-picks-sql] Deleted ${deletedCount} picks via SQL`)
    
    // Also clear cooldowns
    const { error: cooldownError } = await supabase.rpc('exec_sql', {
      query: 'DELETE FROM pick_generation_cooldowns WHERE true'
    })
    
    if (cooldownError) {
      console.error('[clear-picks-sql] Cooldown deletion failed:', cooldownError)
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} picks via SQL`,
      deletedPicksCount: deletedCount,
      method: 'SQL DELETE'
    })
    
  } catch (error: any) {
    console.error('[clear-picks-sql] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Unexpected error occurred'
    }, { status: 500 })
  }
}
