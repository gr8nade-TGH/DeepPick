'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { UserMenu } from '@/components/auth/user-menu'
import {
  Home,
  Trophy,
  Map,
  PlusCircle,
  Sparkles,
  Menu,
  X,
  ChevronDown,
  Brain,
  Activity,
  Shield,
  Users,
  Flame
} from 'lucide-react'

export function NavBar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false)
  const adminDropdownRef = useRef<HTMLDivElement>(null)

  // Check if user has required role
  const hasRole = (requiredRole: 'free' | 'capper' | 'admin') => {
    if (!profile) return false
    if (requiredRole === 'free') return true
    if (requiredRole === 'capper') return profile.role === 'capper' || profile.role === 'admin'
    if (requiredRole === 'admin') return profile.role === 'admin'
    return false
  }

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
    setAdminDropdownOpen(false)
  }, [pathname])

  // Close admin dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false)
      }
    }

    if (adminDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [adminDropdownOpen])

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/50 group-hover:shadow-cyan-500/70 transition-all">
              <span className="text-2xl font-bold text-white">⚔️</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hidden sm:block">
              Sharp Siege
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {/* Dashboard */}
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isActive('/')
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            {/* Leaderboard */}
            <Link
              href="/leaderboard"
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isActive('/leaderboard')
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </Link>

            {/* Battle Map */}
            <Link
              href="/territory-map"
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isActive('/territory-map')
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Map className="w-4 h-4" />
              <span>Battle Map</span>
            </Link>

            {/* Admin Dropdown */}
            {hasRole('admin') && (
              <div className="relative" ref={adminDropdownRef}>
                <button
                  onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${isActive('/admin') || isActive('/cappers') || isActive('/monitoring')
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${adminDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {adminDropdownOpen && (
                  <div className="absolute top-full mt-2 right-0 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <Link
                      href="/cappers/shiva/management"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Brain className="w-4 h-4 text-cyan-400" />
                      <span>SHIVA Management</span>
                    </Link>
                    <Link
                      href="/monitoring"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Activity className="w-4 h-4 text-green-400" />
                      <span>Monitoring</span>
                    </Link>
                    <Link
                      href="/admin/system-health"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span>System Health</span>
                    </Link>
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white border-t border-slate-700"
                    >
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>User Management</span>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Make Picks - CAPPER+ only */}
            {hasRole('capper') && (
              <Link
                href="/make-picks"
                className="ml-2 px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30 transition-all flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Make Picks</span>
              </Link>
            )}

            {/* Become a Capper - FREE users only */}
            {profile && profile.role === 'free' && (
              <Link
                href="/upgrade"
                className="ml-2 px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg shadow-yellow-500/30 transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upgrade</span>
              </Link>
            )}
          </div>

          {/* User Menu - Desktop */}
          <div className="hidden md:block">
            <UserMenu />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <div className="space-y-1">
              {/* Dashboard */}
              <Link
                href="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive('/')
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Home className="w-5 h-5" />
                <span>Dashboard</span>
              </Link>

              {/* Leaderboard */}
              <Link
                href="/leaderboard"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive('/leaderboard')
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Trophy className="w-5 h-5" />
                <span>Leaderboard</span>
              </Link>

              {/* Battle Map */}
              <Link
                href="/territory-map"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive('/territory-map')
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Map className="w-5 h-5" />
                <span>Battle Map</span>
              </Link>

              {/* Make Picks - CAPPER+ only */}
              {hasRole('capper') && (
                <Link
                  href="/make-picks"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Make Picks</span>
                </Link>
              )}

              {/* Upgrade - FREE users only */}
              {profile && profile.role === 'free' && (
                <Link
                  href="/upgrade"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Become a Capper</span>
                </Link>
              )}

              {/* Admin Section - ADMIN only */}
              {hasRole('admin') && (
                <div className="pt-2 mt-2 border-t border-slate-800">
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Admin</div>
                  <Link
                    href="/cappers/shiva/management"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Brain className="w-5 h-5 text-cyan-400" />
                    <span>SHIVA Management</span>
                  </Link>
                  <Link
                    href="/monitoring"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Activity className="w-5 h-5 text-green-400" />
                    <span>Monitoring</span>
                  </Link>
                  <Link
                    href="/admin/system-health"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Shield className="w-5 h-5 text-blue-400" />
                    <span>System Health</span>
                  </Link>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Users className="w-5 h-5 text-purple-400" />
                    <span>User Management</span>
                  </Link>
                </div>
              )}

              {/* User Menu - Mobile */}
              <div className="pt-2 mt-2 border-t border-slate-800">
                <UserMenu />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

