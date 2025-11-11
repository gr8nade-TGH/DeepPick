'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch user profile from profiles table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data as Profile
    } catch (error) {
      console.error('Error fetching profile:', error)
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

    const initAuth = async () => {
      try {
        console.log('[AuthContext] Getting initial session...')

        // Add timeout to prevent hanging forever
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        )

        const { data: { session: initialSession } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any

        console.log('[AuthContext] Initial session:', !!initialSession, initialSession?.user?.id)
        setSession(initialSession)
        setUser(initialSession?.user ?? null)

        if (initialSession?.user) {
          console.log('[AuthContext] Fetching profile for user:', initialSession.user.id)
          const profileData = await fetchProfile(initialSession.user.id)
          console.log('[AuthContext] Profile loaded:', profileData?.role)
          setProfile(profileData)
        } else {
          console.log('[AuthContext] No user in initial session')
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing auth:', error)
        // Set to null on error so UI can still function
        setSession(null)
        setUser(null)
        setProfile(null)
      } finally {
        console.log('[AuthContext] Initialization complete, setting loading to false')
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    console.log('[AuthContext] Setting up auth state listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AuthContext] Auth state changed:', event, 'User:', !!newSession?.user)
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

      setLoading(false)
    })

    return () => {
      console.log('[AuthContext] Cleaning up auth listener')
      subscription.unsubscribe()
    }
  }, [])

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

