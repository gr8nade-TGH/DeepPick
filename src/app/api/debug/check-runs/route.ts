import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    // Check runs table
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Check idempotency_keys table
    const { data: idempotency, error: idempotencyError } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('step', 'pick')
      .order('created_at', { ascending: false })
      .limit(5)

    // Check pick_generation_cooldowns
    const { data: cooldowns, error: cooldownsError } = await supabase
      .from('pick_generation_cooldowns')
      .select('*')
      .eq('capper', 'shiva')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      runs: {
        count: runs?.length || 0,
        data: runs,
        error: runsError?.message
      },
      idempotency: {
        count: idempotency?.length || 0,
        data: idempotency,
        error: idempotencyError?.message
      },
      cooldowns: {
        count: cooldowns?.length || 0,
        data: cooldowns,
        error: cooldownsError?.message
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
