import { createBrowserClient } from '@supabase/ssr'

// DO NOT create a singleton! Each component should call createClient() to get a fresh instance
// This ensures the client is created in the browser, not during build/server-side
export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    console.log('[Supabase Client] Creating browser client with URL:', url)
    console.log('[Supabase Client] Key length:', key?.length)

    const client = createBrowserClient(url, key)

    console.log('[Supabase Client] Browser client created successfully')

    return client
}
