'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

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

export function AuthProvider({
  children,
  initialUser = null,
  initialProfile = null
}: {
  children: ReactNode
  initialUser?: User | null
  initialProfile?: Profile | null
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!initialUser) // If we have initial user, we're not loading

  // Create Supabase client in the browser (not at module load time)
  const supabase = useMemo(() => {
    console.log('[AuthContext] Creating Supabase client in browser...')
    console.log('[AuthContext] Initial user from server:', !!initialUser, initialUser?.id)
    console.log('[AuthContext] Initial profile from server:', !!initialProfile, initialProfile?.role)
    return createClient()
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
    console.log('[AuthContext] Initializing with server-provided initial user and profile')
    let mounted = true

    // Profile is already provided from server, no need to fetch
    // Set loading to false immediately since we have initial state from server
    if (initialUser && initialProfile) {
      console.log('[AuthContext] Using server-provided profile, stopping loading')
      setLoading(false)
    } else if (!initialUser) {
      // No user from server, we're not loading - show login/signup buttons
      console.log('[AuthContext] No initial user from server, stopping loading')
      setLoading(false)
    }

    // Set up auth state change listener for future changes (login, logout, etc.)
    console.log('[AuthContext] Setting up onAuthStateChange listener for auth changes...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      console.log('[AuthContext] Auth event:', event, 'User:', !!newSession?.user, newSession?.user?.id)

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        console.log('[AuthContext] Loading profile for user:', newSession.user.id)
        const profileData = await fetchProfile(newSession.user.id)
        if (mounted) {
          setProfile(profileData)
          setLoading(false)
        }
      } else {
        console.log('[AuthContext] No user, clearing profile')
        if (mounted) {
          setProfile(null)
          setLoading(false)
        }
      }
    })

    return () => {
      console.log('[AuthContext] Cleaning up auth listener')
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, initialUser, initialProfile])

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // If successful, manually update state since onAuthStateChange might not fire
    if (!error && data.user) {
      console.log('[AuthContext] Sign in successful, updating state...')
      setUser(data.user)
      setSession(data.session)

      // Fetch profile
      const profileData = await fetchProfile(data.user.id)
      setProfile(profileData)
      setLoading(false)
    }

    return { error }
  }

  // Sign up with email/password
  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    // If successful, manually update state
    if (!error && data.user) {
      console.log('[AuthContext] Sign up successful, updating state...')
      setUser(data.user)
      setSession(data.session)

      // Fetch profile
      const profileData = await fetchProfile(data.user.id)
      setProfile(profileData)
      setLoading(false)
    }

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
    try {
      console.log('[AuthContext] Signing out...')

      // Clear local state immediately
      setUser(null)
      setProfile(null)
      setSession(null)
      setLoading(false)

      // Call server-side sign out API to clear cookies
      console.log('[AuthContext] Calling server-side sign out API...')
      fetch('/api/auth/signout', { method: 'POST' })
        .then(() => console.log('[AuthContext] Server-side sign out complete'))
        .catch((error) => console.log('[AuthContext] Server-side sign out error (ignored):', error))

      // Force a full page reload to clear all state
      console.log('[AuthContext] Redirecting to login page...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 100) // Small delay to ensure state is cleared
    } catch (error) {
      console.error('[AuthContext] Sign out exception:', error)
      // Force reload even on exception
      window.location.href = '/login'
    }
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

