import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/users/[userId]
 * Fetch public user profile with stats and picks history
 * Only available for CAPPER and ADMIN users (FREE users don't get profiles)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Fetch user profile
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // Check if user is CAPPER or ADMIN (FREE users don't get profiles)
    if (profile.role === 'free') {
      return NextResponse.json({
        success: false,
        error: 'Profile not available for FREE users'
      }, { status: 403 })
    }

    // Fetch user's picks
    const { data: picks, error: picksError } = await admin
      .from('picks')
      .select(`
        id,
        game_id,
        capper,
        pick_type,
        selection,
        odds,
        units,
        confidence,
        status,
        net_units,
        created_at,
        graded_at,
        is_system_pick,
        game_snapshot,
        result,
        results_analysis
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (picksError) {
      console.error('Error fetching picks:', picksError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch picks'
      }, { status: 500 })
    }

    // Calculate overall stats
    const allPicks = picks || []
    const gradedPicks = allPicks.filter(p => ['won', 'lost', 'push'].includes(p.status))

    const wins = gradedPicks.filter(p => p.status === 'won').length
    const losses = gradedPicks.filter(p => p.status === 'lost').length
    const pushes = gradedPicks.filter(p => p.status === 'push').length
    const totalPicks = wins + losses + pushes

    const netUnits = gradedPicks
      .filter(p => p.net_units !== null)
      .reduce((sum, p) => sum + (p.net_units || 0), 0)

    const unitsBet = gradedPicks.reduce((sum, p) => sum + (p.units || 0), 0)
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0
    const roi = unitsBet > 0 ? (netUnits / unitsBet) * 100 : 0

    // Calculate current streak
    let currentStreak = 0
    let currentStreakType: 'win' | 'loss' | null = null

    const sortedGradedPicks = [...gradedPicks].sort((a, b) =>
      new Date(b.graded_at || b.created_at).getTime() - new Date(a.graded_at || a.created_at).getTime()
    )

    for (const pick of sortedGradedPicks) {
      if (pick.status === 'push') continue

      if (currentStreakType === null) {
        currentStreakType = pick.status === 'won' ? 'win' : 'loss'
        currentStreak = 1
      } else if (
        (currentStreakType === 'win' && pick.status === 'won') ||
        (currentStreakType === 'loss' && pick.status === 'lost')
      ) {
        currentStreak++
      } else {
        break
      }
    }

    // Calculate longest streaks
    let longestWinStreak = 0
    let longestLossStreak = 0
    let tempWinStreak = 0
    let tempLossStreak = 0

    const chronologicalPicks = [...gradedPicks].sort((a, b) =>
      new Date(a.graded_at || a.created_at).getTime() - new Date(b.graded_at || b.created_at).getTime()
    )

    for (const pick of chronologicalPicks) {
      if (pick.status === 'push') continue

      if (pick.status === 'won') {
        tempWinStreak++
        tempLossStreak = 0
        longestWinStreak = Math.max(longestWinStreak, tempWinStreak)
      } else if (pick.status === 'lost') {
        tempLossStreak++
        tempWinStreak = 0
        longestLossStreak = Math.max(longestLossStreak, tempLossStreak)
      }
    }

    // Calculate stats by pick type
    const totalStats = gradedPicks.filter(p => p.pick_type === 'total')
    const totalWins = totalStats.filter(p => p.status === 'won').length
    const totalLosses = totalStats.filter(p => p.status === 'lost').length
    const totalDecided = totalWins + totalLosses

    const spreadStats = gradedPicks.filter(p => p.pick_type === 'spread')
    const spreadWins = spreadStats.filter(p => p.status === 'won').length
    const spreadLosses = spreadStats.filter(p => p.status === 'lost').length
    const spreadDecided = spreadWins + spreadLosses

    const moneylineStats = gradedPicks.filter(p => p.pick_type === 'moneyline')
    const moneylineWins = moneylineStats.filter(p => p.status === 'won').length
    const moneylineLosses = moneylineStats.filter(p => p.status === 'lost').length
    const moneylineDecided = moneylineWins + moneylineLosses

    const statsByPickType = {
      total: {
        picks: totalStats.length,
        wins: totalWins,
        losses: totalLosses,
        netUnits: totalStats
          .filter(p => p.net_units !== null)
          .reduce((sum, p) => sum + (p.net_units || 0), 0),
        winRate: totalDecided > 0 ? (totalWins / totalDecided) * 100 : 0
      },
      spread: {
        picks: spreadStats.length,
        wins: spreadWins,
        losses: spreadLosses,
        netUnits: spreadStats
          .filter(p => p.net_units !== null)
          .reduce((sum, p) => sum + (p.net_units || 0), 0),
        winRate: spreadDecided > 0 ? (spreadWins / spreadDecided) * 100 : 0
      },
      moneyline: {
        picks: moneylineStats.length,
        wins: moneylineWins,
        losses: moneylineLosses,
        netUnits: moneylineStats
          .filter(p => p.net_units !== null)
          .reduce((sum, p) => sum + (p.net_units || 0), 0),
        winRate: moneylineDecided > 0 ? (moneylineWins / moneylineDecided) * 100 : 0
      }
    }

    // Return profile data
    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        username: profile.username,
        role: profile.role,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        twitter_url: profile.twitter_url,
        instagram_url: profile.instagram_url,
        created_at: profile.created_at
      },
      stats: {
        total_picks: totalPicks,
        pending_picks: allPicks.filter(p => p.status === 'pending').length,
        wins,
        losses,
        pushes,
        net_units: parseFloat(netUnits.toFixed(2)),
        win_rate: parseFloat(winRate.toFixed(1)),
        roi: parseFloat(roi.toFixed(1)),
        current_streak: currentStreak,
        current_streak_type: currentStreakType,
        longest_win_streak: longestWinStreak,
        longest_loss_streak: longestLossStreak,
        by_pick_type: statsByPickType
      },
      picks: allPicks,
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

