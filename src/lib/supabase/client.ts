import { createBrowserClient } from '@supabase/ssr'

// Create a singleton Supabase client for client-side use
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

// Export a singleton instance for backwards compatibility
export const supabase = createClient()
