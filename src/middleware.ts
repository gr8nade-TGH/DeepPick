import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get user session
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile with role
  let userRole: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    userRole = profile?.role || null
  }

  const path = request.nextUrl.pathname

  // Protected routes that require authentication
  const authRequiredRoutes = ['/make-picks', '/profile', '/settings']
  const isAuthRequired = authRequiredRoutes.some(route => path.startsWith(route))

  // Routes that require CAPPER role
  const capperRoutes = ['/make-picks']
  const isCapperRoute = capperRoutes.some(route => path.startsWith(route))

  // Routes that require ADMIN role
  const adminRoutes = ['/admin', '/cappers/shiva/management', '/cappers/ifrit/management', '/monitoring']
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))

  // Redirect to login if auth required and not logged in
  if (isAuthRequired && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to upgrade page if capper route and user is FREE
  if (isCapperRoute && user && userRole === 'free') {
    const redirectUrl = new URL('/upgrade', request.url)
    redirectUrl.searchParams.set('reason', 'capper_required')
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to home if admin route and user is not ADMIN
  if (isAdminRoute && user && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
}

