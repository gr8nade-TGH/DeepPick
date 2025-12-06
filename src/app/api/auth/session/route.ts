import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()

    // Log all cookies for debugging
    const allCookies = cookieStore.getAll()
    console.log('[API /auth/session] All cookies:', allCookies.map(c => c.name))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const value = cookieStore.get(name)?.value
            console.log(`[API /auth/session] Getting cookie ${name}:`, value ? 'exists' : 'missing')
            return value
          },
          set(name: string, value: string, options: any) {
            // Required for SSR - allows Supabase to set cookies
            console.log(`[API /auth/session] Setting cookie ${name}`)
          },
          remove(name: string, options: any) {
            // Required for SSR
            console.log(`[API /auth/session] Removing cookie ${name}`)
          },
        },
      }
    )

    // Get user from server-side (this works, unlike client-side)
    console.log('[API /auth/session] Calling getUser()...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    console.log('[API /auth/session] getUser result:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    })

    if (userError || !user) {
      console.log('[API /auth/session] No user found, returning null')
      return NextResponse.json({ user: null, session: null, profile: null })
    }

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('[API /auth/session] Session:', !!session)

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('[API /auth/session] Profile:', !!profile, profileError?.message)

    return NextResponse.json({
      user,
      session,
      profile: profileError ? null : profile
    })

  } catch (error) {
    console.error('[API /auth/session] Error:', error)
    return NextResponse.json({ user: null, session: null, profile: null })
  }
}

