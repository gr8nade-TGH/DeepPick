import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// NEW: SSR-compatible server client for Next.js App Router
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// OLD: Lazy-loaded clients to avoid build-time initialization (kept for backwards compatibility)
let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

// Getter function for public client (respects RLS)
export function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xckbsyeaywrfzvcahhtk.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVheXdyZnp2Y2FoaHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk5OTQsImV4cCI6MjA3NjI3NTk5NH0.X_FRhkUhefhTeiGRRNBckxusVFurEJ_bZMy1BImaCpI'
    _supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  }
  return _supabase
}

// Getter function for admin client (bypasses RLS)
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xckbsyeaywrfzvcahhtk.supabase.co'
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVheXdyZnp2Y2FoaHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk5OTQsImV4cCI6MjA3NjI3NTk5NH0.X_FRhkUhefhTeiGRRNBckxusVFurEJ_bZMy1BImaCpI'

    _supabaseAdmin = supabaseServiceKey
      ? createSupabaseClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
      : createSupabaseClient(supabaseUrl, supabaseAnonKey) // Fallback to regular client if no service key
  }
  return _supabaseAdmin
}
