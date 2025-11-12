import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()
    
    // Sign out on the server side to clear cookies
    await supabase.auth.signOut()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Sign out error:', error)
    // Return success anyway - we'll clear client state
    return NextResponse.json({ success: true })
  }
}

