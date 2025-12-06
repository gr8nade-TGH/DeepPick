import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getGrokSentiment, getInfluencerSentiment, getInterpreterAnalysis, getDevilsAdvocate } from '@/lib/ai-insights/grok-client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Fetch insights for a game or all games today
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const insightType = searchParams.get('insightType')

  let query = supabase.from('ai_insights').select('*').order('created_at', { ascending: false })

  if (gameId) query = query.eq('game_id', gameId)
  if (insightType) query = query.eq('insight_type', insightType)

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, insights: data })
}

// POST: Generate and save insight for a game
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { gameId, insightType, awayTeam, homeTeam, spread, total, betType } = body

  if (!gameId || !insightType || !awayTeam || !homeTeam) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  // Check if insight already exists
  const { data: existing } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('game_id', gameId)
    .eq('insight_type', insightType)
    .eq('bet_type', betType || 'SPREAD')
    .single()

  if (existing) {
    return NextResponse.json({
      success: true,
      insight: existing,
      cached: true,
      message: 'Insight already exists for this game'
    })
  }

  // Generate insight based on type
  let rawData: any = null
  let quantifiedValue: any = null
  let provider = 'UNKNOWN'

  try {
    const baseRequest = {
      awayTeam,
      homeTeam,
      spread: spread || { away: 0, home: 0 },
      total,
      gameDate: new Date().toISOString().split('T')[0],
      betType: betType || 'SPREAD'
    }

    if (insightType === 'PULSE_SENTIMENT') {
      provider = 'GROK'
      const grokResult = await getGrokSentiment(baseRequest)

      if (!grokResult.success) {
        return NextResponse.json({ success: false, error: grokResult.error }, { status: 500 })
      }

      rawData = {
        sentiment: grokResult.sentiment,
        usage: grokResult.usage
      }
      quantifiedValue = grokResult.pulseScore
    } else if (insightType === 'INFLUENCER_SENTIMENT') {
      provider = 'GROK'
      const influencerResult = await getInfluencerSentiment(baseRequest)

      if (!influencerResult.success) {
        return NextResponse.json({ success: false, error: influencerResult.error }, { status: 500 })
      }

      rawData = {
        sentiment: influencerResult.sentiment,
        usage: influencerResult.usage
      }
      quantifiedValue = influencerResult.influencerScore
    } else if (insightType === 'INTERPRETER_ANALYSIS') {
      provider = 'GROK'
      const interpreterResult = await getInterpreterAnalysis(baseRequest)

      if (!interpreterResult.success) {
        return NextResponse.json({ success: false, error: interpreterResult.error }, { status: 500 })
      }

      rawData = {
        analysis: interpreterResult.analysis,
        usage: interpreterResult.usage
      }
      quantifiedValue = interpreterResult.interpreterScore
    } else if (insightType === 'DEVILS_ADVOCATE') {
      // Devils Advocate requires ourPick and ourConfidence
      const { ourPick, ourConfidence } = body
      if (!ourPick) {
        return NextResponse.json({ success: false, error: 'Devils Advocate requires ourPick parameter' }, { status: 400 })
      }

      provider = 'GROK'
      const devilsResult = await getDevilsAdvocate({
        ...baseRequest,
        ourPick,
        ourConfidence: ourConfidence || 65
      })

      if (!devilsResult.success) {
        return NextResponse.json({ success: false, error: devilsResult.error }, { status: 500 })
      }

      rawData = {
        analysis: devilsResult.analysis,
        usage: devilsResult.usage
      }
      quantifiedValue = devilsResult.devilsScore
    } else {
      return NextResponse.json({ success: false, error: `Unknown insight type: ${insightType}` }, { status: 400 })
    }

    // Save to database
    const { data: inserted, error: insertError } = await supabase
      .from('ai_insights')
      .insert({
        game_id: gameId,
        insight_type: insightType,
        provider,
        bet_type: betType || 'SPREAD',
        away_team: awayTeam,
        home_team: homeTeam,
        spread_line: spread?.away || null,
        total_line: total || null,
        raw_data: rawData,
        quantified_value: quantifiedValue,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, insight: inserted, cached: false })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// DELETE: Clear insights (for testing)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')

  let query = supabase.from('ai_insights').delete()
  if (gameId) {
    query = query.eq('game_id', gameId)
  } else {
    // Safety: require gameId or explicit "all" param
    const all = searchParams.get('all')
    if (all !== 'true') {
      return NextResponse.json({ success: false, error: 'Specify gameId or all=true' }, { status: 400 })
    }
  }

  const { error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Insights cleared' })
}

