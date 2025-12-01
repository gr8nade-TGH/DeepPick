import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabase
}

interface PendingFactor {
  name: string
  key: string
  description: string
  bet_type: 'TOTALS' | 'SPREAD'
  stats_used: string[]
  formula: string
  direction: 'higher_over' | 'higher_under' | 'higher_favorite' | 'higher_underdog'
  betting_thesis: string
  edge_explanation: string
  confidence: 'high' | 'medium' | 'low'
  ai_model?: string
}

// GET - List all pending factors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const betType = searchParams.get('betType')

    let query = getSupabase()
      .from('pending_factors')
      .select('*')
      .order('proposed_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (betType) {
      query = query.eq('bet_type', betType)
    }

    const { data, error } = await query

    if (error) {
      console.error('[PendingFactors] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      factors: data,
      count: data.length
    })
  } catch (error) {
    console.error('[PendingFactors] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create a new pending factor from AI proposal
export async function POST(request: NextRequest) {
  try {
    const body: PendingFactor = await request.json()

    // Validate required fields
    if (!body.name || !body.key || !body.bet_type || !body.stats_used || !body.formula) {
      return NextResponse.json(
        { error: 'Missing required fields: name, key, bet_type, stats_used, formula' },
        { status: 400 }
      )
    }

    // Check if factor key already exists
    const { data: existing } = await getSupabase()
      .from('pending_factors')
      .select('id, status')
      .eq('key', body.key)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Factor with key "${body.key}" already exists (status: ${existing.status})` },
        { status: 409 }
      )
    }

    // Insert the pending factor
    const { data, error } = await getSupabase()
      .from('pending_factors')
      .insert({
        name: body.name,
        key: body.key,
        description: body.description,
        bet_type: body.bet_type,
        stats_used: body.stats_used,
        formula: body.formula,
        direction: body.direction,
        betting_thesis: body.betting_thesis,
        edge_explanation: body.edge_explanation,
        confidence: body.confidence,
        ai_model: body.ai_model || 'gpt-4o',
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('[PendingFactors] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[PendingFactors] Created pending factor: ${body.key}`)

    return NextResponse.json({
      success: true,
      factor: data,
      message: `Factor "${body.name}" saved as pending. Ready for implementation.`
    })
  } catch (error) {
    console.error('[PendingFactors] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH - Update factor status (approve, reject, mark as implemented)
export async function PATCH(request: NextRequest) {
  try {
    const { id, status, notes } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
    }

    const updateData: any = { status }

    if (status === 'approved' || status === 'rejected') {
      updateData.reviewed_at = new Date().toISOString()
    }
    if (status === 'implemented') {
      updateData.implemented_at = new Date().toISOString()
    }
    if (notes) {
      updateData.notes = notes
    }

    const { data, error } = await getSupabase()
      .from('pending_factors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, factor: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

