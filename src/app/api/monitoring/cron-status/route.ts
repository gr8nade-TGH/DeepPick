import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET - Fetch all cron job statuses
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data: cronJobs, error } = await supabase
      .from('cron_job_status')
      .select('*')
      .order('job_name', { ascending: true })
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      cronJobs: cronJobs || []
    })

  } catch (error) {
    console.error('Error fetching cron job status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

