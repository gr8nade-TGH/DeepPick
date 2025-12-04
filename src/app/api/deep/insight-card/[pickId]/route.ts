/**
 * DEEP Insight Card API
 * 
 * GET /api/deep/insight-card/[pickId]
 * 
 * Returns insight card data for a DEEP consensus pick.
 * Shows factor confluence, contributing cappers, and counter-thesis analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { pickId: string } }
) {
  try {
    const { pickId } = params

    if (!pickId) {
      return NextResponse.json({ error: 'Pick ID required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Fetch the DEEP pick
    const { data: pick, error: pickError } = await admin
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single()

    if (pickError || !pick) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 })
    }

    // Verify this is a DEEP or PICKSMITH pick
    const capperLower = pick.capper?.toLowerCase()
    if (capperLower !== 'deep' && capperLower !== 'picksmith') {
      return NextResponse.json({
        error: 'Not a DEEP pick',
        redirect: `/api/shiva/insight-card/${pickId}`
      }, { status: 400 })
    }

    // Get game details
    const { data: game } = await admin
      .from('games')
      .select('*')
      .eq('id', pick.game_id)
      .single()

    // Extract factor confluence and contributing cappers from insight_card_snapshot
    const insightData = pick.insight_card_snapshot || {}
    const factorConfluence = insightData.factorConfluence || []
    const counterThesis = insightData.counterThesis || null
    const contributingCappers = insightData.contributingCappers || []

    // Get tier grade
    const tierGrade = pick.game_snapshot?.tier_grade || {}

    const isSpread = pick.pick_type?.toLowerCase().includes('spread')

    // Build factors array for display (from factor confluence)
    const factors = factorConfluence.slice(0, 5).map((fc: any, idx: number) => ({
      key: fc.factorKey || `factor_${idx}`,
      name: fc.factorName || 'Unknown Factor',
      normalized_value: fc.avgContribution || 0,
      weight: fc.alignmentScore || 0,
      agreeingCappers: fc.agreeingCappers || [],
      totalMentions: fc.totalMentions || 0
    }))

    return NextResponse.json({
      success: true,
      data: {
        modelName: 'DEEP',
        modelDescription: 'Factor Confluence Meta-Capper',
        pick: {
          type: isSpread ? 'SPREAD' : 'TOTAL',
          selection: pick.selection,
          units: pick.units,
          confidence: pick.confidence || 7,
          edgeRaw: 0,
          edgePct: 0,
          confScore: pick.confidence || 7,
          locked_odds: pick.game_snapshot,
          locked_at: pick.created_at,
          tierGrade: tierGrade.tier || 'Common',
          tierScore: tierGrade.tierScore || 0
        },
        game: game ? {
          home_team: game.home_team,
          away_team: game.away_team,
          game_start_timestamp: game.game_start_timestamp
        } : pick.game_snapshot,
        factors,
        factorConfluence,
        counterThesis,
        contributingCappers,
        predictedScore: { away: 0, home: 0, winner: 'Factor Confluence' },
        writeups: {
          prediction: buildDeepWriteup(pick, factorConfluence, contributingCappers, counterThesis),
          gamePrediction: `DEEP consensus pick based on ${contributingCappers.length} profitable cappers with factor alignment`,
          bold: null
        },
        tierBreakdown: tierGrade.breakdown || null
      }
    })
  } catch (error: any) {
    console.error('[API:DEEP] Insight card error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch DEEP insight card'
    }, { status: 500 })
  }
}

function buildDeepWriteup(
  pick: any,
  factorConfluence: any[],
  contributingCappers: any[],
  counterThesis: any
): string {
  const topFactor = factorConfluence[0]
  let writeup = `**DEEP Factor Confluence Analysis**\n\n`
  
  writeup += `This ${pick.selection} pick represents consensus from ${contributingCappers.length} profitable cappers.\n\n`
  
  if (topFactor) {
    writeup += `**Primary Driver:** ${topFactor.factorName} (${topFactor.totalMentions}/${contributingCappers.length} cappers agree)\n\n`
  }
  
  if (counterThesis) {
    writeup += `**Counter-Thesis:** ${counterThesis.disagreeingCapper} (${counterThesis.tier}) disagrees - ${counterThesis.reason}\n`
    writeup += `Counter strength: ${counterThesis.counterStrength}\n`
  }
  
  return writeup
}

