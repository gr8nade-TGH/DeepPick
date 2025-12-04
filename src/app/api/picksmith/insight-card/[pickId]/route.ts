/**
 * PICKSMITH Insight Card API
 * 
 * GET /api/picksmith/insight-card/[pickId]
 * 
 * Returns insight card data for a PICKSMITH consensus pick.
 * Shows which cappers contributed to the consensus and their individual bets.
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

    // Fetch the PICKSMITH pick
    const { data: pick, error: pickError } = await admin
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single()

    if (pickError || !pick) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 })
    }

    // Verify this is a PICKSMITH pick
    if (pick.capper?.toLowerCase() !== 'picksmith') {
      return NextResponse.json({
        error: 'Not a PICKSMITH pick',
        redirect: `/api/shiva/insight-card/${pickId}`
      }, { status: 400 })
    }

    // Parse the reasoning to extract contributing cappers
    // Format: "PICKSMITH consensus: ... Contributing cappers: SHIVA(3u, +15.5u record), SENTINEL(4u, +12.3u record)"
    const contributingCappers = parseContributingCappers(pick.reasoning || '')

    // Check if this is a wizard-pipeline pick (has insight_card_snapshot with factors but no consensus data)
    const isWizardPipelinePick = pick.reasoning?.includes('wizard pipeline') ||
      (pick.insight_card_snapshot?.factors?.length > 0 && contributingCappers.length === 0)

    // Get game details
    const { data: game } = await admin
      .from('games')
      .select('*')
      .eq('id', pick.game_id)
      .single()

    // Get the actual picks from contributing cappers for this game (only if we have cappers)
    let contributorPicks: any[] = []
    if (contributingCappers.length > 0) {
      const capperIds = contributingCappers.map(c => c.id.toLowerCase())
      const { data } = await admin
        .from('picks')
        .select('*')
        .eq('game_id', pick.game_id)
        .in('capper', capperIds)
        .ilike('pick_type', `${pick.pick_type.replace('_over', '').replace('_under', '')}%`)
      contributorPicks = data || []
    }

    // Build insight card data
    const pickType = pick.pick_type?.toUpperCase() || 'TOTAL'
    const isSpread = pickType.includes('SPREAD')

    // Extract team names - handle both string and object formats
    const extractTeamName = (team: any): string => {
      if (typeof team === 'string') return team
      if (team?.name) return typeof team.name === 'string' ? team.name : team.name?.name || 'Unknown'
      return 'Unknown'
    }
    const extractTeamAbbr = (team: any, fallback: string): string => {
      if (typeof team === 'string') return team.substring(0, 3).toUpperCase()
      if (team?.abbreviation) return typeof team.abbreviation === 'string' ? team.abbreviation : team.abbreviation?.abbreviation || fallback
      return fallback
    }

    const homeTeamName = extractTeamName(game?.home_team) || extractTeamName(pick.game_snapshot?.home_team) || 'Home'
    const awayTeamName = extractTeamName(game?.away_team) || extractTeamName(pick.game_snapshot?.away_team) || 'Away'
    const homeTeamAbbr = extractTeamAbbr(game?.home_team || pick.game_snapshot?.home_team, homeTeamName.substring(0, 3).toUpperCase())
    const awayTeamAbbr = extractTeamAbbr(game?.away_team || pick.game_snapshot?.away_team, awayTeamName.substring(0, 3).toUpperCase())

    // For wizard-pipeline picks, use the snapshot factors; for consensus picks, build from cappers
    const factors = isWizardPipelinePick
      ? (pick.insight_card_snapshot?.factors || []).map((f: any, idx: number) => ({
        id: `factor-${idx + 1}`,
        name: f.name || f.key || 'Unknown Factor',
        key: f.key,
        weight: f.weight || 0,
        contribution: f.contribution || 0,
        description: f.notes || '',
        dataSource: 'Factor Analysis',
        rawValue: f.z || 0
      }))
      : buildConsensusFactors(contributingCappers, contributorPicks)

    // Get tier grade from game_snapshot if available
    const tierGrade = pick.game_snapshot?.tier_grade

    const insightCard = {
      capper: 'PICKSMITH',
      capperIconUrl: '/cappers/picksmith.png',
      sport: 'NBA' as const,
      gameId: pick.game_id,
      pickId: pick.id,
      generatedAt: pick.created_at,
      is_system_pick: true,
      // Flag to indicate this was generated via wizard pipeline (legacy)
      isWizardPipelinePick,
      matchup: {
        away: { name: awayTeamName, abbreviation: awayTeamAbbr },
        home: { name: homeTeamName, abbreviation: homeTeamAbbr },
        spreadText: `${awayTeamName} @ ${homeTeamName}`,
        totalText: pick.selection,
        gameDateLocal: game?.game_start_timestamp || pick.created_at
      },
      pick: {
        type: isSpread ? 'SPREAD' : 'TOTAL',
        selection: pick.selection,
        units: pick.units,
        confidence: pick.confidence || 7,
        edgeRaw: 0,
        edgePct: 0,
        confScore: pick.confidence || 7,
        locked_odds: pick.game_snapshot,
        locked_at: pick.created_at
      },
      factors,
      predictedScore: { away: 0, home: 0, winner: isWizardPipelinePick ? 'Factor Analysis' : 'Consensus' },
      writeups: {
        prediction: isWizardPipelinePick
          ? buildWizardPipelineWriteup(pick, factors)
          : buildConsensusWriteup(pick, contributingCappers),
        gamePrediction: isWizardPipelinePick
          ? `PICKSMITH pick generated via factor analysis (legacy pipeline)`
          : `PICKSMITH consensus pick based on ${contributingCappers.length} profitable cappers`,
        bold: pick.insight_card_snapshot?.bold_predictions || null
      },
      market: {
        conf7: pick.confidence || 7,
        confAdj: 0,
        confFinal: pick.confidence || 7,
        dominant: isSpread ? 'spread' as const : 'total' as const
      },
      results: {
        status: pick.status === 'won' ? 'win'
          : pick.status === 'lost' ? 'loss'
            : pick.status === 'push' ? 'push'
              : 'pending',
        // Try game.final_score first (from games table), then pick.result?.final_score (graded)
        finalScore: game?.final_score ? {
          away: game.final_score.away,
          home: game.final_score.home
        } : pick.result?.final_score ? {
          away: pick.result.final_score.away,
          home: pick.result.final_score.home
        } : undefined,
        postMortem: null
      },
      // Tier grade from game_snapshot
      tierGrade: tierGrade ? {
        tier: tierGrade.tier,
        confluenceScore: tierGrade.confluenceScore,
        breakdown: tierGrade.breakdown
      } : null,
      // PICKSMITH-specific fields
      consensus: isWizardPipelinePick ? {
        contributingCappers: [],
        contributorPicks: [],
        consensusType: 'LEGACY_WIZARD_PIPELINE' as const,
        note: 'This pick was generated via the wizard pipeline (factor analysis) instead of consensus aggregation.'
      } : {
        contributingCappers,
        contributorPicks: contributorPicks.map(p => ({
          capper: p.capper?.toUpperCase(),
          selection: p.selection,
          units: p.units,
          confidence: p.confidence
        })),
        consensusType: contributingCappers.length >= 3 ? 'STRONG' : 'STANDARD'
      },
      onClose: () => { }
    }

    return NextResponse.json({
      success: true,
      data: insightCard
    })

  } catch (error: any) {
    console.error('[PICKSMITH:InsightCard] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch insight card'
    }, { status: 500 })
  }
}

// Parse contributing cappers from reasoning string
function parseContributingCappers(reasoning: string): Array<{
  id: string
  name: string
  units: number
  netUnits: number
}> {
  const cappers: Array<{ id: string; name: string; units: number; netUnits: number }> = []

  // Match pattern: "SHIVA(3u, +15.5u record)"
  const regex = /(\w+)\((\d+)u,\s*\+?([\d.]+)u\s*record\)/g
  let match

  while ((match = regex.exec(reasoning)) !== null) {
    cappers.push({
      id: match[1].toLowerCase(),
      name: match[1].toUpperCase(),
      units: parseInt(match[2]),
      netUnits: parseFloat(match[3])
    })
  }

  return cappers
}

// Build consensus factors for display (show each capper as a "factor")
function buildConsensusFactors(
  cappers: Array<{ id: string; name: string; units: number; netUnits: number }>,
  picks: any[]
): any[] {
  return cappers.map((capper, index) => {
    const capperPick = picks.find(p => p.capper?.toLowerCase() === capper.id)

    return {
      id: `capper-${index + 1}`,
      name: capper.name,
      weight: capper.netUnits, // Use net units as "weight"
      overScore: capper.units, // Units bet
      underScore: 0,
      description: capperPick
        ? `${capper.name} bet ${capper.units}u on ${capperPick.selection} (${capper.netUnits > 0 ? '+' : ''}${capper.netUnits.toFixed(1)}u record)`
        : `${capper.name} contributed ${capper.units}u (${capper.netUnits > 0 ? '+' : ''}${capper.netUnits.toFixed(1)}u record)`,
      dataSource: 'Consensus',
      rawValue: capper.units,
      contribution: capper.units
    }
  })
}

// Build consensus writeup
function buildConsensusWriteup(
  pick: any,
  cappers: Array<{ id: string; name: string; units: number; netUnits: number }>
): string {
  if (cappers.length === 0) {
    return `## PICKSMITH Analysis

No contributing cappers data available for this pick.

${pick.reasoning || ''}`
  }

  const capperList = cappers.map(c =>
    `**${c.name}** (${c.units}u, +${c.netUnits.toFixed(1)}u record)`
  ).join(', ')

  const totalUnits = cappers.reduce((sum, c) => sum + c.units, 0)
  const avgUnits = (totalUnits / cappers.length).toFixed(1)

  return `## PICKSMITH Consensus Analysis

### Contributing Cappers
${capperList}

### Consensus Details
- **${cappers.length} profitable cappers** agree on this pick
- **Average bet size:** ${avgUnits}u
- **Total conviction:** ${totalUnits}u combined

### Why This Pick?
PICKSMITH identified strong consensus among system cappers with proven track records. When multiple profitable cappers independently arrive at the same conclusion, it signals a high-value opportunity.

${pick.reasoning || ''}`
}

// Build writeup for wizard-pipeline picks (legacy)
function buildWizardPipelineWriteup(pick: any, factors: any[]): string {
  const topFactors = factors
    .filter(f => Math.abs(f.contribution || 0) > 0.5)
    .sort((a, b) => Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0))
    .slice(0, 3)

  const factorSummary = topFactors.length > 0
    ? topFactors.map(f => `- **${f.name}**: ${f.description || 'N/A'}`).join('\n')
    : 'No significant factors identified.'

  return `## PICKSMITH Factor Analysis

⚠️ **Note:** This pick was generated via the legacy wizard pipeline (factor analysis) instead of the standard consensus aggregation method.

### Key Factors
${factorSummary}

### Analysis
This pick was generated using PICKSMITH's factor-based analysis system, which evaluates statistical indicators to identify betting opportunities.

${pick.insight_card_snapshot?.professional_analysis || pick.reasoning || ''}`
}
