'use client'

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User, Session } from '@supabase/supabase-js'

export type UserRole = 'free' | 'capper' | 'admin'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  username: string | null
  role: UserRole
  email_verified: boolean
  avatar_url: string | null
  bio: string | null
  twitter_url: string | null
  instagram_url: string | null
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  signInWithTwitter: () => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Use the singleton client from client.ts
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('[AuthContext] Creating Supabase client...')
    console.log('[AuthContext] URL exists:', !!url)
    console.log('[AuthContext] Key exists:', !!key)
    console.log('[AuthContext] URL:', url?.substring(0, 30) + '...')

    if (!url || !key) {
      console.error('[AuthContext] MISSING ENVIRONMENT VARIABLES!')
      console.error('[AuthContext] URL:', url)
      console.error('[AuthContext] Key:', key)
    }

    return createBrowserClient(url!, key!)
  }, [])

  // Fetch user profile from profiles table
  const fetchProfile = async (userId: string) => {
    try {
      console.log('[AuthContext] fetchProfile - Starting query for userId:', userId)

      // Add timeout to prevent infinite hang
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 3s')), 3000)
      )

      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        console.error('[AuthContext] Error fetching profile:', error)
        console.error('[AuthContext] Error code:', error.code)
        console.error('[AuthContext] Error details:', error.details)
        console.error('[AuthContext] Error hint:', error.hint)
        console.error('[AuthContext] Error message:', error.message)
        return null
      }

      console.log('[AuthContext] Profile fetched successfully:', data?.role)
      return data as Profile
    } catch (error) {
      console.error('[AuthContext] Exception in fetchProfile:', error)
      return null
    }
  }

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  // Initialize auth state
  useEffect(() => {
    console.log('[AuthContext] Initializing...')
    let mounted = true

    // Listen for auth changes
    console.log('[AuthContext] Setting up auth state listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      console.log('[AuthContext] Auth state changed:', event, 'User:', !!newSession?.user, newSession?.user?.id)
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        console.log('[AuthContext] Fetching profile after auth change...')
        const profileData = await fetchProfile(newSession.user.id)
        console.log('[AuthContext] Profile loaded after auth change:', profileData?.role)
        setProfile(profileData)
      } else {
        console.log('[AuthContext] No user after auth change, clearing profile')
        setProfile(null)
      }
    })

    // Get initial session
    const initAuth = async () => {
      try {
        console.log('[AuthContext] Getting initial session...')

        // Add timeout to getSession to prevent infinite hang
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout after 3s')), 3000)
        )

        const sessionPromise = supabase.auth.getSession()

        const result = await Promise.race([sessionPromise, timeoutPromise]) as any
        const { data: { session: initialSession }, error } = result

        if (!mounted) return

        if (error) {
          console.error('[AuthContext] Error getting session:', error)
          setLoading(false)
          return
        }

        console.log('[AuthContext] Initial session:', !!initialSession, initialSession?.user?.id)

        if (initialSession?.user) {
          setSession(initialSession)
          setUser(initialSession.user)
          console.log('[AuthContext] Fetching profile for user:', initialSession.user.id)
          const profileData = await fetchProfile(initialSession.user.id)
          console.log('[AuthContext] Profile loaded:', profileData?.role)
          setProfile(profileData)
        } else {
          console.log('[AuthContext] No initial session - user not logged in')
        }
      } catch (error) {
        console.error('[AuthContext] Exception in initAuth:', error)
        console.error('[AuthContext] Error type:', error instanceof Error ? error.message : 'Unknown')
      } finally {
        if (mounted) {
          console.log('[AuthContext] Initialization complete, setting loading to false')
          setLoading(false)
        }
      }
    }

    initAuth()

    return () => {
      console.log('[AuthContext] Cleaning up auth listener')
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  // Sign up with email/password
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  // Sign in with Twitter
  const signInWithTwitter = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithTwitter,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

