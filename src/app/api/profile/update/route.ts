import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * PATCH /api/profile/update
 * Update user profile settings (bio, social links, avatar, etc.)
 * Only authenticated users can update their own profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { full_name, username, bio, twitter_url, instagram_url, avatar_url } = body

    // Validate bio length (max 500 characters)
    if (bio && bio.length > 500) {
      return NextResponse.json({
        success: false,
        error: 'Bio must be 500 characters or less'
      }, { status: 400 })
    }

    // Validate Twitter URL format
    if (twitter_url && !twitter_url.match(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+$/)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Twitter URL format. Must be a valid Twitter/X profile URL.'
      }, { status: 400 })
    }

    // Validate Instagram URL format
    if (instagram_url && !instagram_url.match(/^https?:\/\/(www\.)?instagram\.com\/.+$/)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Instagram URL format. Must be a valid Instagram profile URL.'
      }, { status: 400 })
    }

    // Build update object (only include fields that were provided)
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (full_name !== undefined) updates.full_name = full_name
    if (username !== undefined) updates.username = username
    if (bio !== undefined) updates.bio = bio
    if (twitter_url !== undefined) updates.twitter_url = twitter_url
    if (instagram_url !== undefined) updates.instagram_url = instagram_url
    if (avatar_url !== undefined) updates.avatar_url = avatar_url

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      
      // Check for unique constraint violations
      if (updateError.code === '23505') {
        if (updateError.message.includes('username')) {
          return NextResponse.json({
            success: false,
            error: 'Username already taken'
          }, { status: 400 })
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to update profile'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profile
    })

  } catch (error) {
    console.error('Error in profile update:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

