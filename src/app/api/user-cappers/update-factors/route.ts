import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/user-cappers/update-factors
 * 
 * Updates the user's capper factor configuration
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    
    // Create authenticated Supabase client
    const supabase = createServerClient(
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { capper_id, factor_config } = body

    if (!capper_id) {
      return NextResponse.json(
        { success: false, error: 'capper_id is required' },
        { status: 400 }
      )
    }

    if (!factor_config) {
      return NextResponse.json(
        { success: false, error: 'factor_config is required' },
        { status: 400 }
      )
    }

    // Use admin client for database operations
    const admin = getSupabaseAdmin()

    // Verify the capper belongs to the user
    const { data: existingCapper, error: verifyError } = await admin
      .from('user_cappers')
      .select('id')
      .eq('capper_id', capper_id)
      .eq('user_id', user.id)
      .single()

    if (verifyError || !existingCapper) {
      return NextResponse.json(
        { success: false, error: 'Capper not found or unauthorized' },
        { status: 404 }
      )
    }

    // Update the factor configuration
    const { data: updatedCapper, error: updateError } = await admin
      .from('user_cappers')
      .update({
        factor_config,
        updated_at: new Date().toISOString()
      })
      .eq('capper_id', capper_id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[UpdateFactors] Database error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update factor configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      capper: updatedCapper
    })
  } catch (error) {
    console.error('[UpdateFactors] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

