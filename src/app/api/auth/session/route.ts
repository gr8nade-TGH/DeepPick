import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
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

    // Get user from server-side (this works, unlike client-side)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ user: null, session: null, profile: null })
    }

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

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

