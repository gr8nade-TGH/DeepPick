import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Simulate a quarter for a battle
 * 
 * This endpoint is called when quarter stats become available.
 * It calculates damage based on player stats and updates HP.
 * 
 * POST /api/battle-bets/[battleId]/simulate-quarter
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { battleId: string } }
) {
  try {
    const { battleId } = params
    const { quarter } = await request.json()

    if (!quarter || quarter < 1 || quarter > 4) {
      return NextResponse.json(
        { success: false, error: 'Invalid quarter (must be 1-4)' },
        { status: 400 }
      )
    }

    console.log(`[Simulate Quarter] Battle: ${battleId}, Quarter: ${quarter}`)

    const supabase = getSupabaseAdmin()

    // Get battle data
    const { data: battle, error: battleError } = await supabase
      .from('battle_matchups')
      .select('*')
      .eq('id', battleId)
      .single()

    if (battleError || !battle) {
      console.error('[Simulate Quarter] Battle not found:', battleError)
      return NextResponse.json(
        { success: false, error: 'Battle not found' },
        { status: 404 }
      )
    }

    // Get quarter stats
    const quarterKey = `q${quarter}_stats` as 'q1_stats' | 'q2_stats' | 'q3_stats' | 'q4_stats'
    const quarterStats = battle[quarterKey]

    if (!quarterStats) {
      console.error(`[Simulate Quarter] No stats found for Q${quarter}`)
      return NextResponse.json(
        { success: false, error: `No stats available for Q${quarter}` },
        { status: 400 }
      )
    }

    console.log(`[Simulate Quarter] Q${quarter} stats:`, quarterStats)

    // Calculate damage based on stats
    const damage = calculateQuarterDamage(quarterStats, battle)

    // Update HP
    const newLeftHP = Math.max(0, battle.left_hp - damage.leftDamage)
    const newRightHP = Math.max(0, battle.right_hp - damage.rightDamage)

    console.log(`[Simulate Quarter] Damage - Left: ${damage.leftDamage}, Right: ${damage.rightDamage}`)
    console.log(`[Simulate Quarter] HP - Left: ${battle.left_hp} → ${newLeftHP}, Right: ${battle.right_hp} → ${newRightHP}`)

    // Determine new status based on quarter progression
    // Flow: Q1_BATTLE → Q2_IN_PROGRESS → Q2_BATTLE → HALFTIME → Q3_IN_PROGRESS → etc.
    let newStatus = battle.status
    const quarterCompleteKey = `q${quarter}_complete` as 'q1_complete' | 'q2_complete' | 'q3_complete' | 'q4_complete'

    if (quarter === 1) {
      newStatus = 'Q2_IN_PROGRESS'
    } else if (quarter === 2) {
      newStatus = 'HALFTIME'
    } else if (quarter === 3) {
      newStatus = 'Q4_IN_PROGRESS'
    } else if (quarter === 4) {
      newStatus = 'GAME_OVER'
    } else if (quarter === 5) {
      newStatus = 'OT2_IN_PROGRESS'
    } else if (quarter === 6) {
      newStatus = 'OT3_IN_PROGRESS'
    } else if (quarter === 7) {
      newStatus = 'OT4_IN_PROGRESS'
    } else if (quarter === 8) {
      newStatus = 'GAME_OVER'
    }

    // Check for knockout
    let winner = null
    let finalBlowSide = null

    if (newLeftHP === 0 && newRightHP > 0) {
      winner = 'right'
      finalBlowSide = 'right'
      newStatus = 'GAME_OVER'
    } else if (newRightHP === 0 && newLeftHP > 0) {
      winner = 'left'
      finalBlowSide = 'left'
      newStatus = 'GAME_OVER'
    } else if (newLeftHP === 0 && newRightHP === 0) {
      // Tie - determine winner by score
      if (quarterStats.leftScore > quarterStats.rightScore) {
        winner = 'left'
        finalBlowSide = 'left'
      } else if (quarterStats.rightScore > quarterStats.leftScore) {
        winner = 'right'
        finalBlowSide = 'right'
      } else {
        winner = 'tie'
      }
      newStatus = 'GAME_OVER'
    }

    // Update battle
    const { error: updateError } = await supabase
      .from('battle_matchups')
      .update({
        left_hp: newLeftHP,
        right_hp: newRightHP,
        status: newStatus,
        [quarterCompleteKey]: true,
        winner,
        final_blow_side: finalBlowSide,
        updated_at: new Date().toISOString()
      })
      .eq('id', battleId)

    if (updateError) {
      console.error('[Simulate Quarter] Update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update battle' },
        { status: 500 }
      )
    }

    console.log(`[Simulate Quarter] ✅ Battle updated - Status: ${newStatus}, Winner: ${winner || 'none'}`)

    return NextResponse.json({
      success: true,
      battle: {
        id: battleId,
        quarter,
        leftHP: newLeftHP,
        rightHP: newRightHP,
        status: newStatus,
        winner,
        damage
      }
    })
  } catch (error) {
    console.error('[Simulate Quarter] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate damage for a quarter based on stats
 * 
 * Damage is based on the difference in performance across 5 stat categories:
 * - POINTS (40% weight)
 * - REBOUNDS (20% weight)
 * - ASSISTS (20% weight)
 * - BLOCKS (10% weight)
 * - 3-POINTERS (10% weight)
 */
function calculateQuarterDamage(quarterStats: any, battle: any): {
  leftDamage: number
  rightDamage: number
  breakdown: any
} {
  const { leftPlayers, rightPlayers } = quarterStats

  // Calculate team totals
  const leftTotals = {
    points: leftPlayers.reduce((sum: number, p: any) => sum + (p.points || 0), 0),
    rebounds: leftPlayers.reduce((sum: number, p: any) => sum + (p.rebounds || 0), 0),
    assists: leftPlayers.reduce((sum: number, p: any) => sum + (p.assists || 0), 0),
    blocks: leftPlayers.reduce((sum: number, p: any) => sum + (p.blocks || 0), 0),
    threePointers: leftPlayers.reduce((sum: number, p: any) => sum + (p.threePointers || 0), 0)
  }

  const rightTotals = {
    points: rightPlayers.reduce((sum: number, p: any) => sum + (p.points || 0), 0),
    rebounds: rightPlayers.reduce((sum: number, p: any) => sum + (p.rebounds || 0), 0),
    assists: rightPlayers.reduce((sum: number, p: any) => sum + (p.assists || 0), 0),
    blocks: rightPlayers.reduce((sum: number, p: any) => sum + (p.blocks || 0), 0),
    threePointers: rightPlayers.reduce((sum: number, p: any) => sum + (p.threePointers || 0), 0)
  }

  // Calculate stat differences (positive = left wins, negative = right wins)
  const pointsDiff = leftTotals.points - rightTotals.points
  const reboundsDiff = leftTotals.rebounds - rightTotals.rebounds
  const assistsDiff = leftTotals.assists - rightTotals.assists
  const blocksDiff = leftTotals.blocks - rightTotals.blocks
  const threePointersDiff = leftTotals.threePointers - rightTotals.threePointers

  // Apply weights and calculate damage
  // Each stat point difference = 0.1 damage, scaled by weight
  const pointsDamage = pointsDiff * 0.1 * 0.4 // 40% weight
  const reboundsDamage = reboundsDiff * 0.1 * 0.2 // 20% weight
  const assistsDamage = assistsDiff * 0.1 * 0.2 // 20% weight
  const blocksDamage = blocksDiff * 0.1 * 0.1 // 10% weight
  const threePointersDamage = threePointersDiff * 0.1 * 0.1 // 10% weight

  const totalDamage = pointsDamage + reboundsDamage + assistsDamage + blocksDamage + threePointersDamage

  // Positive damage = left deals damage to right
  // Negative damage = right deals damage to left
  const leftDamage = totalDamage < 0 ? Math.abs(Math.round(totalDamage)) : 0
  const rightDamage = totalDamage > 0 ? Math.round(totalDamage) : 0

  return {
    leftDamage,
    rightDamage,
    breakdown: {
      leftTotals,
      rightTotals,
      differences: {
        points: pointsDiff,
        rebounds: reboundsDiff,
        assists: assistsDiff,
        blocks: blocksDiff,
        threePointers: threePointersDiff
      },
      damageComponents: {
        points: pointsDamage,
        rebounds: reboundsDamage,
        assists: assistsDamage,
        blocks: blocksDamage,
        threePointers: threePointersDamage,
        total: totalDamage
      }
    }
  }
}

