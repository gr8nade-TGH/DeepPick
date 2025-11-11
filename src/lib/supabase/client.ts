import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create a singleton Supabase client for client-side use
export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    console.log('[Supabase Client] Creating client with URL:', url)
    console.log('[Supabase Client] Key length:', key?.length)

    return createSupabaseClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            storageKey: 'sb-xckbsyeaywrfzvcahhtk-auth-token',
            flowType: 'pkce'
        }
    })
}

// Export a singleton instance for backwards compatibility
export const supabase = createClient()
