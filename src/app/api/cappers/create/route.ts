import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CreateCapperRequest {
  capper_id: string
  display_name: string
  description?: string
  avatar_url?: string
  color_theme?: string
  sport: string
  bet_types: string[]
  pick_mode: 'manual' | 'auto' | 'hybrid'
  excluded_teams?: string[]
  social_links?: {
    twitter?: string
    instagram?: string
    youtube?: string
    website?: string
  }
  factor_config: {
    [betType: string]: {
      enabled_factors: string[]
      weights: { [factor: string]: number }
    }
  }
  execution_interval_minutes: number
  execution_priority: number
  is_active?: boolean
}

/**
 * POST /api/cappers/create
 * 
 * Creates a new user capper with custom factor configuration
 * Automatically creates execution schedules via database trigger
 */
export async function POST(request: Request) {
  try {
    // Get authenticated user
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - must be logged in to create a capper' },
        { status: 401 }
      )
    }

    const body: CreateCapperRequest = await request.json()

    // Validation
    const errors: string[] = []

    if (!body.capper_id || !/^[a-z0-9_-]+$/.test(body.capper_id)) {
      errors.push('capper_id must be lowercase alphanumeric with hyphens/underscores only')
    }

    if (!body.display_name || body.display_name.trim().length === 0) {
      errors.push('display_name is required')
    }

    if (!body.sport || !['NBA', 'NFL', 'MLB', 'NHL'].includes(body.sport)) {
      errors.push('sport must be one of: NBA, NFL, MLB, NHL')
    }

    if (!body.bet_types || body.bet_types.length === 0) {
      errors.push('bet_types must include at least one type')
    }

    const validBetTypes = ['TOTAL', 'SPREAD', 'MONEYLINE']
    if (body.bet_types && !body.bet_types.every(bt => validBetTypes.includes(bt))) {
      errors.push('bet_types must only include: TOTAL, SPREAD, MONEYLINE')
    }

    if (!body.pick_mode || !['manual', 'auto', 'hybrid'].includes(body.pick_mode)) {
      errors.push('pick_mode must be one of: manual, auto, hybrid')
    }

    // For manual mode, factor_config is optional
    if (body.pick_mode !== 'manual') {
      if (!body.factor_config || Object.keys(body.factor_config).length === 0) {
        errors.push('factor_config is required for auto/hybrid modes')
      }
    }

    if (!body.execution_interval_minutes || body.execution_interval_minutes < 5 || body.execution_interval_minutes > 1440) {
      errors.push('execution_interval_minutes must be between 5 and 1440')
    }

    if (!body.execution_priority || body.execution_priority < 1 || body.execution_priority > 10) {
      errors.push('execution_priority must be between 1 and 10')
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors
      }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Check if capper_id already exists
    const { data: existing } = await supabase
      .from('user_cappers')
      .select('capper_id')
      .eq('capper_id', body.capper_id)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `Capper ID '${body.capper_id}' already exists`
      }, { status: 409 })
    }

    // Insert new capper (linked to authenticated user)
    const { data: newCapper, error: insertError } = await supabase
      .from('user_cappers')
      .insert({
        user_id: user.id, // Link to authenticated user
        capper_id: body.capper_id,
        display_name: body.display_name,
        description: body.description || null,
        avatar_url: body.avatar_url || null,
        color_theme: body.color_theme || 'blue',
        sport: body.sport,
        bet_types: body.bet_types,
        pick_mode: body.pick_mode,
        excluded_teams: body.excluded_teams || [],
        social_links: body.social_links || {},
        factor_config: body.factor_config || {},
        execution_interval_minutes: body.execution_interval_minutes,
        execution_priority: body.execution_priority,
        is_active: body.is_active !== undefined ? body.is_active : true,
        is_system_capper: false
      })
      .select()
      .single()

    if (insertError) {
      console.error('[CreateCapper] Insert error:', insertError)
      return NextResponse.json({
        success: false,
        error: insertError.message
      }, { status: 500 })
    }

    // Upgrade user's role to 'capper' and update their profile name
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        role: 'capper',
        full_name: body.display_name // Set profile name to capper display name
      })
      .eq('id', user.id)
      .in('role', ['free', 'capper']) // Update free or existing capper, don't downgrade admins

    if (profileUpdateError) {
      console.error('[CreateCapper] Profile update error:', profileUpdateError)
      // Don't fail the request, just log the error
    }

    // Fetch the auto-created execution schedules
    const { data: schedules } = await supabase
      .from('capper_execution_schedules')
      .select('*')
      .eq('capper_id', body.capper_id)

    console.log('[CreateCapper] ✅ Created capper:', {
      capper_id: newCapper.capper_id,
      display_name: newCapper.display_name,
      schedules_created: schedules?.length || 0
    })

    return NextResponse.json({
      success: true,
      capper: newCapper,
      schedules: schedules || [],
      message: `Capper '${newCapper.display_name}' created successfully with ${schedules?.length || 0} execution schedule(s)`
    })

  } catch (error) {
    console.error('[CreateCapper] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/cappers/create
 * 
 * Returns available configuration options for creating a capper
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    options: {
      sports: ['NBA', 'NFL', 'MLB', 'NHL'],
      bet_types: ['TOTAL', 'SPREAD', 'MONEYLINE'],
      factors: {
        NBA: {
          TOTAL: ['F1', 'F2', 'F3', 'F4', 'F5'],
          SPREAD: ['S1', 'S2', 'S3', 'S4', 'S5']
        }
      },
      interval_options: [5, 10, 15, 20, 30, 60],
      priority_range: { min: 1, max: 10 },
      color_themes: ['blue', 'green', 'red', 'purple', 'yellow', 'orange', 'pink', 'cyan']
    }
  })
}

