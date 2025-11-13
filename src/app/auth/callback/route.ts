import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('[Auth Callback] Processing OAuth callback...')
  console.log('[Auth Callback] Code present:', !!code)
  console.log('[Auth Callback] Error:', error)
  console.log('[Auth Callback] Error description:', error_description)

  // Handle OAuth errors
  if (error) {
    console.error('[Auth Callback] OAuth error:', error, error_description)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error_description || error)}`, requestUrl.origin))
  }

  if (code) {
    const cookieStore = cookies()

    // Create response object first so we can set cookies on it
    const response = NextResponse.redirect(new URL('/', requestUrl.origin))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            // Set cookie on both the cookie store AND the response
            cookieStore.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            // Remove cookie from both the cookie store AND the response
            cookieStore.set({ name, value: '', ...options })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[Auth Callback] Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin))
    }

    console.log('[Auth Callback] Session exchange successful!')
    console.log('[Auth Callback] User ID:', data.user?.id)
    console.log('[Auth Callback] User email:', data.user?.email)
    console.log('[Auth Callback] Session expires at:', data.session?.expires_at)
    console.log('[Auth Callback] Access token present:', !!data.session?.access_token)
    console.log('[Auth Callback] Refresh token present:', !!data.session?.refresh_token)

    // Log cookies being set
    console.log('[Auth Callback] Response cookies:', response.cookies.getAll().map(c => c.name))

    return response
  }

  // No code provided, redirect to login
  console.log('[Auth Callback] No code provided, redirecting to login')
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}

