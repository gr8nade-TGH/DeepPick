import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * DEBUG ENDPOINT: Check capper_profiles table
 * 
 * This endpoint checks what profiles exist in the database
 * and helps diagnose why factor weights aren't loading
 */
export async function GET() {
  const supabase = getSupabaseAdmin()

  console.log('[DEBUG:CheckProfiles] Checking capper_profiles table...')

  // Get all profiles
  const { data: allProfiles, error: allError } = await supabase
    .from('capper_profiles')
    .select('*')

  console.log('[DEBUG:CheckProfiles] All profiles query result:', {
    error: allError,
    count: allProfiles?.length || 0,
    profiles: allProfiles
  })

  // Get SHIVA NBA TOTAL profiles specifically
  const { data: shivaProfiles, error: shivaError } = await supabase
    .from('capper_profiles')
    .select('*')
    .eq('capper_id', 'shiva')
    .eq('sport', 'NBA')
    .eq('bet_type', 'TOTAL')

  console.log('[DEBUG:CheckProfiles] SHIVA NBA TOTAL profiles:', {
    error: shivaError,
    count: shivaProfiles?.length || 0,
    profiles: shivaProfiles
  })

  // Get active SHIVA NBA TOTAL profiles
  const { data: activeProfiles, error: activeError } = await supabase
    .from('capper_profiles')
    .select('*')
    .eq('capper_id', 'shiva')
    .eq('sport', 'NBA')
    .eq('bet_type', 'TOTAL')
    .eq('is_active', true)

  console.log('[DEBUG:CheckProfiles] Active SHIVA NBA TOTAL profiles:', {
    error: activeError,
    count: activeProfiles?.length || 0,
    profiles: activeProfiles
  })

  // Get default SHIVA NBA TOTAL profile
  const { data: defaultProfile, error: defaultError } = await supabase
    .from('capper_profiles')
    .select('*')
    .eq('capper_id', 'shiva')
    .eq('sport', 'NBA')
    .eq('bet_type', 'TOTAL')
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  console.log('[DEBUG:CheckProfiles] Default SHIVA NBA TOTAL profile:', {
    error: defaultError,
    profile: defaultProfile
  })

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results: {
      all_profiles: {
        count: allProfiles?.length || 0,
        error: allError?.message || null,
        data: allProfiles
      },
      shiva_nba_total_profiles: {
        count: shivaProfiles?.length || 0,
        error: shivaError?.message || null,
        data: shivaProfiles
      },
      active_shiva_profiles: {
        count: activeProfiles?.length || 0,
        error: activeError?.message || null,
        data: activeProfiles
      },
      default_shiva_profile: {
        found: !!defaultProfile,
        error: defaultError?.message || null,
        data: defaultProfile
      }
    }
  })
}

