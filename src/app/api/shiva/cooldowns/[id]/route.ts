import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Cooldown ID is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    
    console.log('[CooldownsAPI] Attempting to delete cooldown with ID:', id)
    
    // First, check if the record exists
    const { data: existing } = await supabase
      .from('pick_generation_cooldowns')
      .select('id, game_id, capper, bet_type')
      .eq('id', id)
      .single()
    
    console.log('[CooldownsAPI] Existing record:', existing)
    
    // Delete the cooldown
    const { error, data } = await supabase
      .from('pick_generation_cooldowns')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('[CooldownsAPI] Error deleting cooldown:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('[CooldownsAPI] Deleted cooldown:', { id, deletedRows: data?.length || 0 })

    return NextResponse.json({
      success: true,
      message: 'Cooldown cleared successfully',
      deletedCount: data?.length || 0
    })
  } catch (error: any) {
    console.error('[CooldownsAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

