import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Fetch all data feed settings
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data: settings, error } = await supabase
      .from('data_feed_settings')
      .select('*')
      .order('sport', { ascending: true })
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      settings: settings || []
    })

  } catch (error) {
    console.error('Error fetching data feed settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

// POST - Update data feed settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sport, enabled, fetch_interval_minutes, active_hours_start, active_hours_end } = body

    if (!sport) {
      return NextResponse.json(
        { success: false, error: 'Sport is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const updateData: any = {
      last_updated: new Date().toISOString(),
      updated_by: 'dashboard_user'
    }

    if (typeof enabled === 'boolean') updateData.enabled = enabled
    if (fetch_interval_minutes) updateData.fetch_interval_minutes = fetch_interval_minutes
    if (active_hours_start) updateData.active_hours_start = active_hours_start
    if (active_hours_end) updateData.active_hours_end = active_hours_end

    const { data, error } = await supabase
      .from('data_feed_settings')
      .update(updateData)
      .eq('sport', sport)
      .select()
      .single()

    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: `Settings updated for ${sport}`,
      settings: data
    })

  } catch (error) {
    console.error('Error updating data feed settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

