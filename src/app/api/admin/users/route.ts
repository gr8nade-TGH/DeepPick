import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { UserWithStats, AdminUserFilters } from '@/types/admin'

/**
 * GET /api/admin/users
 * Fetch all users with their stats
 * Requires ADMIN role
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Check if user has ADMIN role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl
    const role = searchParams.get('role') || 'all'
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Fetch all user profiles
    const admin = getSupabaseAdmin()
    let profilesQuery = admin
      .from('profiles')
      .select('*')

    // Apply role filter
    if (role !== 'all') {
      profilesQuery = profilesQuery.eq('role', role)
    }

    // Apply search filter (email, username, or full_name)
    if (search) {
      profilesQuery = profilesQuery.or(
        `email.ilike.%${search}%,username.ilike.%${search}%,full_name.ilike.%${search}%`
      )
    }

    const { data: profiles, error: profilesError } = await profilesQuery

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch users'
      }, { status: 500 })
    }

    // Fetch picks stats for each user
    const userIds = profiles.map(p => p.id)
    const { data: picks, error: picksError } = await admin
      .from('picks')
      .select('user_id, status, units, net_units, created_at')
      .in('user_id', userIds)
      .not('user_id', 'is', null)

    if (picksError) {
      console.error('Error fetching picks:', picksError)
    }

    // Calculate stats for each user
    const usersWithStats: UserWithStats[] = profiles.map(profile => {
      const userPicks = picks?.filter(p => p.user_id === profile.id) || []

      const wins = userPicks.filter(p => p.status === 'won').length
      const losses = userPicks.filter(p => p.status === 'lost').length
      const pushes = userPicks.filter(p => p.status === 'push').length
      const totalPicks = wins + losses + pushes

      const netUnits = userPicks
        .filter(p => p.net_units !== null)
        .reduce((sum, p) => sum + (p.net_units || 0), 0)

      const unitsBet = userPicks
        .filter(p => p.status === 'won' || p.status === 'lost')
        .reduce((sum, p) => sum + (p.units || 0), 0)

      const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0
      const roi = unitsBet > 0 ? (netUnits / unitsBet) * 100 : 0

      const lastPickAt = userPicks.length > 0
        ? userPicks.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0].created_at
        : null

      return {
        ...profile,
        stats: {
          total_picks: totalPicks,
          wins,
          losses,
          pushes,
          net_units: parseFloat(netUnits.toFixed(2)),
          win_rate: parseFloat(winRate.toFixed(1)),
          roi: parseFloat(roi.toFixed(1)),
          last_pick_at: lastPickAt
        }
      }
    })

    // Sort users
    const sortedUsers = usersWithStats.sort((a, b) => {
      let aValue: any
      let bValue: any

      if (sortBy === 'total_picks') {
        aValue = a.stats.total_picks
        bValue = b.stats.total_picks
      } else if (sortBy === 'net_units') {
        aValue = a.stats.net_units
        bValue = b.stats.net_units
      } else if (sortBy === 'email') {
        aValue = a.email
        bValue = b.email
      } else {
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return NextResponse.json({
      success: true,
      users: sortedUsers,
      total: sortedUsers.length
    })

  } catch (error) {
    console.error('Error in /api/admin/users:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

