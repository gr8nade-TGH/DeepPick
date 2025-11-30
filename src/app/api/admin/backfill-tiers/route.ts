import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { calculateTierGrade } from '@/lib/tier-grading'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * One-time backfill endpoint to add tier grades to existing picks
 * POST /api/admin/backfill-tiers
 * 
 * Note: Uses current team/7-day records (not historical snapshots)
 * since we didn't capture that data at pick generation time.
 */
export async function POST() {
  const supabase = getSupabaseAdmin()

  // Get all picks that don't have tier_grade
  const { data: picks, error } = await supabase
    .from('picks')
    .select('id, capper, pick_type, confidence, units, game_snapshot, selection')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Filter to picks without tier_grade
  const picksToBackfill = picks?.filter(p => !p.game_snapshot?.tier_grade) || []

  console.log(`[Backfill] Found ${picksToBackfill.length} picks to backfill`)

  let updated = 0
  let failed = 0
  let firstError: string | null = null

  for (const pick of picksToBackfill) {
    try {
      // Get team abbreviation from the pick
      const homeTeamAbbr = pick.game_snapshot?.home_team?.abbreviation || pick.game_snapshot?.home_team || ''
      const awayTeamAbbr = pick.game_snapshot?.away_team?.abbreviation || pick.game_snapshot?.away_team || ''
      const relevantTeam = pick.pick_type === 'spread'
        ? (pick.selection?.includes(homeTeamAbbr) ? homeTeamAbbr : awayTeamAbbr)
        : homeTeamAbbr

      // Fetch current team record (not historical - we don't have that)
      let teamRecord = undefined
      if (relevantTeam) {
        const { data: teamPicks } = await supabase
          .from('picks')
          .select('status, net_units, game_snapshot')
          .eq('capper', pick.capper)
          .eq('pick_type', pick.pick_type)
          .in('status', ['win', 'loss'])

        const teamFiltered = teamPicks?.filter((p: any) => {
          const h = p.game_snapshot?.home_team?.abbreviation || p.game_snapshot?.home_team
          const a = p.game_snapshot?.away_team?.abbreviation || p.game_snapshot?.away_team
          return h === relevantTeam || a === relevantTeam
        }) || []

        if (teamFiltered.length >= 3) {
          teamRecord = {
            wins: teamFiltered.filter((p: any) => p.status === 'win').length,
            losses: teamFiltered.filter((p: any) => p.status === 'loss').length,
            netUnits: teamFiltered.reduce((s: number, p: any) => s + (p.net_units || 0), 0)
          }
        }
      }

      // Fetch 7-day record
      let last7DaysRecord = undefined
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentPicks } = await supabase
        .from('picks')
        .select('status, net_units')
        .eq('capper', pick.capper)
        .in('status', ['win', 'loss'])
        .gte('created_at', sevenDaysAgo)

      if (recentPicks && recentPicks.length >= 3) {
        last7DaysRecord = {
          wins: recentPicks.filter((p: any) => p.status === 'win').length,
          losses: recentPicks.filter((p: any) => p.status === 'loss').length,
          netUnits: recentPicks.reduce((s: number, p: any) => s + (p.net_units || 0), 0)
        }
      }

      // Calculate tier
      const tierGrade = calculateTierGrade({
        baseConfidence: pick.confidence || 65,
        unitsRisked: pick.units || 1,
        teamRecord,
        last7DaysRecord
      })

      // Update pick
      const updatedSnapshot = {
        ...pick.game_snapshot,
        tier_grade: {
          tier: tierGrade.tier,
          tierScore: tierGrade.tierScore,
          bonuses: tierGrade.bonuses,
          backfilled: true // Mark as backfilled (not original)
        }
      }

      const { error: updateError } = await supabase
        .from('picks')
        .update({ game_snapshot: updatedSnapshot })
        .eq('id', pick.id)

      if (updateError) throw updateError
      updated++
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[Backfill] Failed to update pick ${pick.id}:`, errMsg)
      if (!firstError) firstError = `Pick ${pick.id}: ${errMsg}`
      failed++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Backfilled ${updated} picks, ${failed} failed`,
    total: picksToBackfill.length,
    updated,
    failed,
    firstError
  })
}

