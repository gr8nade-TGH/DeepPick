import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * NUCLEAR OPTION: Clear all picks using direct SQL
 * This bypasses Supabase client ORM issues with enum types
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[nuclear-clear] Starting NUCLEAR clear operation...')
    
    // Use service role key for admin access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase credentials not configured' 
      }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })
    
    // Count before deletion
    const { count: beforeCount } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
    
    console.log(`[nuclear-clear] Found ${beforeCount || 0} picks to delete`)
    
    // Execute raw SQL to delete ALL picks
    const { data: deleteResult, error: deleteError } = await supabase
      .rpc('exec_sql', {
        sql: 'DELETE FROM picks; DELETE FROM pick_generation_cooldowns;'
      })
    
    // If exec_sql doesn't exist, use alternative approach
    if (deleteError && deleteError.message?.includes('exec_sql')) {
      console.log('[nuclear-clear] exec_sql not available, using alternative method...')
      
      // Try deleting by status (covers all records)
      const { error: altError1 } = await supabase
        .from('picks')
        .delete()
        .in('status', ['pending', 'won', 'lost', 'push', 'cancelled'])
      
      if (altError1) {
        console.error('[nuclear-clear] Alternative delete failed:', altError1)
        return NextResponse.json({ 
          success: false, 
          error: altError1.message,
          details: 'All deletion methods failed. Please use Supabase SQL Editor to run: DELETE FROM picks;'
        }, { status: 500 })
      }
      
      // Also clear cooldowns
      await supabase
        .from('pick_generation_cooldowns')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    }
    
    // Verify deletion
    const { count: afterCount } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
    
    console.log(`[nuclear-clear] After deletion: ${afterCount || 0} picks remaining`)
    
    return NextResponse.json({ 
      success: true, 
      message: `Nuclear clear completed! Deleted ${beforeCount || 0} picks`,
      beforeCount: beforeCount || 0,
      afterCount: afterCount || 0,
      deletedCount: (beforeCount || 0) - (afterCount || 0)
    })
    
  } catch (error: any) {
    console.error('[nuclear-clear] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: 'Use Supabase SQL Editor to run: DELETE FROM picks; DELETE FROM pick_generation_cooldowns;'
    }, { status: 500 })
  }
}
