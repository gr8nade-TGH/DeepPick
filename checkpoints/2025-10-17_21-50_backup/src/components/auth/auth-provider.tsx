'use client'

import { createContext, useContext, useState } from 'react'

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, username?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

  const signIn = async (email: string, password: string) => {
    // TODO: Implement Supabase auth
    console.log('Sign in:', email, password)
    return { error: null }
  }

  const signUp = async (email: string, password: string, username?: string) => {
    // TODO: Implement Supabase auth
    console.log('Sign up:', email, password, username)
    return { error: null }
  }

  const signOut = async () => {
    // TODO: Implement Supabase auth
    console.log('Sign out')
  }

  const resetPassword = async (email: string) => {
    // TODO: Implement Supabase auth
    console.log('Reset password:', email)
    return { error: null }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return (
    <AuthContext.Provider value={value}>
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