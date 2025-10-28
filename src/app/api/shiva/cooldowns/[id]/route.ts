import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Cooldown ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Delete the cooldown
    const { error } = await supabase
      .from('pick_generation_cooldowns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[CooldownsAPI] Error deleting cooldown:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cooldown cleared successfully'
    })
  } catch (error: any) {
    console.error('[CooldownsAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

