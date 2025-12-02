import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/cappers/check-name?name=...
 * 
 * Checks if a capper name already exists
 * Checks both user_cappers.display_name and profiles.full_name
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name || !name.trim()) {
      return NextResponse.json({ exists: false, error: 'Name required' })
    }

    const trimmedName = name.trim().toLowerCase()
    const supabase = getSupabaseAdmin()

    // Check user_cappers table (case-insensitive)
    const { data: capperData, error: capperError } = await supabase
      .from('user_cappers')
      .select('display_name')
      .ilike('display_name', trimmedName)
      .limit(1)

    if (capperError) {
      console.error('[check-name] Error checking user_cappers:', capperError)
    }

    if (capperData && capperData.length > 0) {
      return NextResponse.json({ exists: true, reason: 'capper_name' })
    }

    // Check profiles table (case-insensitive)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .ilike('full_name', trimmedName)
      .limit(1)

    if (profileError) {
      console.error('[check-name] Error checking profiles:', profileError)
    }

    if (profileData && profileData.length > 0) {
      return NextResponse.json({ exists: true, reason: 'profile_name' })
    }

    return NextResponse.json({ exists: false })
  } catch (error) {
    console.error('[check-name] Error:', error)
    return NextResponse.json({ 
      exists: false, 
      error: 'Check failed' 
    })
  }
}

