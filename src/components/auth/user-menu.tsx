'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { User, LogOut, Settings, Crown, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function UserMenu() {
  const { user, profile, signOut, loading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Debug logging
  useEffect(() => {
    console.log('[UserMenu] Auth state:', { user: !!user, profile: !!profile, loading })
  }, [user, profile, loading])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
    router.push('/login')
  }

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="flex gap-2">
        <div className="h-10 w-20 bg-slate-800 animate-pulse rounded-lg"></div>
        <div className="h-10 w-24 bg-slate-800 animate-pulse rounded-lg"></div>
      </div>
    )
  }

  // If not logged in, show login/signup buttons
  if (!user || !profile) {
    return (
      <div className="flex gap-2">
        <Link href="/login">
          <Button variant="outline" className="gap-2">
            Log In
          </Button>
        </Link>
        <Link href="/signup">
          <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
            Sign Up
          </Button>
        </Link>
      </div>
    )
  }

  // Get role badge
  const getRoleBadge = () => {
    switch (profile.role) {
      case 'admin':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/50">
            <Shield className="w-3 h-3 text-red-400" />
            <span className="text-xs font-semibold text-red-400">ADMIN</span>
          </div>
        )
      case 'capper':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/50">
            <Crown className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400">CAPPER</span>
          </div>
        )
      default:
        return (
          <div className="px-2 py-0.5 rounded-full bg-slate-700/50 border border-slate-600">
            <span className="text-xs font-semibold text-slate-400">FREE</span>
          </div>
        )
    }
  }

  // Get user initials for avatar
  const getInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (profile.email) {
      return profile.email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="gap-2 relative"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
          {getInitials()}
        </div>
        <span className="hidden sm:inline">{profile.full_name || profile.email}</span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
          {/* User Info */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {profile.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-400 truncate">{profile.email}</p>
              </div>
            </div>
            <div className="mt-2">
              {getRoleBadge()}
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            {(profile.role === 'capper' || profile.role === 'admin') && (
              <Link href={`/profile/${user.id}`}>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
              </Link>
            )}

            <Link href="/settings/profile">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </Link>

            {profile.role === 'admin' && (
              <Link href="/admin/users">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </button>
              </Link>
            )}
          </div>

          {/* Sign Out */}
          <div className="p-2 border-t border-slate-700">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

