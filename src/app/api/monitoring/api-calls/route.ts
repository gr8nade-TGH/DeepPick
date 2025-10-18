import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const provider = request.nextUrl.searchParams.get('provider')

    let query = getSupabaseAdmin()
      .from('api_calls')
      .select('*')
      .order('request_timestamp', { ascending: false })
      .limit(limit)

    if (provider) {
      query = query.eq('api_provider', provider)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      count: data.length
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

