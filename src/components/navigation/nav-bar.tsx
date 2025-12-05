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
  Swords,
  Flame,
  Cpu
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
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center shadow-lg shadow-orange-500/50 group-hover:shadow-orange-500/70 transition-all group-hover:scale-105 overflow-hidden">
              {/* Custom Basketball + Brain AI Icon */}
              <svg className="w-5 h-5 text-white relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {/* Basketball seams */}
                <circle cx="12" cy="12" r="9" strokeWidth="2.5" />
                <path d="M12 3 C 8 8, 8 16, 12 21" strokeWidth="1.5" />
                <path d="M12 3 C 16 8, 16 16, 12 21" strokeWidth="1.5" />
                <path d="M3 12 C 8 10, 16 10, 21 12" strokeWidth="1.5" />
                <path d="M3 12 C 8 14, 16 14, 21 12" strokeWidth="1.5" />
                {/* AI Neural node in center */}
                <circle cx="12" cy="12" r="2.5" fill="currentColor" className="animate-pulse" />
                {/* Neural connections */}
                <circle cx="7" cy="7" r="1" fill="currentColor" opacity="0.6" />
                <circle cx="17" cy="7" r="1" fill="currentColor" opacity="0.6" />
                <circle cx="7" cy="17" r="1" fill="currentColor" opacity="0.6" />
                <circle cx="17" cy="17" r="1" fill="currentColor" opacity="0.6" />
                <line x1="12" y1="12" x2="7" y2="7" strokeWidth="0.5" opacity="0.4" />
                <line x1="12" y1="12" x2="17" y2="7" strokeWidth="0.5" opacity="0.4" />
                <line x1="12" y1="12" x2="7" y2="17" strokeWidth="0.5" opacity="0.4" />
                <line x1="12" y1="12" x2="17" y2="17" strokeWidth="0.5" opacity="0.4" />
              </svg>
              {/* Animated glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400/30 to-transparent animate-pulse" />
              {/* Rotating ring effect */}
              <div className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40 transition-all" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent">
                DEEP PICK
              </span>
            </div>
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
                      href="/battle-bets-game?debug=1"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Swords className="w-4 h-4 text-orange-400" />
                      <span>Game Debug</span>
                    </Link>
                    <Link
                      href="/battle-arena-v2/index.html?debug=1&testMode=1"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Flame className="w-4 h-4 text-red-400" />
                      <span>Battle Arena V2 Test</span>
                    </Link>
                    <Link
                      href="/admin/system-health"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span>System Health</span>
                    </Link>
                    <Link
                      href="/admin/factors"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span>Factor Dashboard</span>
                    </Link>
                    <Link
                      href="/admin/ai-manager"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                    >
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <span>AI Manager</span>
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

              {/* Active Battles */}
              <Link
                href="/battle-arena-v2/index.html"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive('/battle-arena')
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Swords className="w-5 h-5" />
                <span>Active Battles</span>
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
                    href="/battle-bets-game?debug=1"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Swords className="w-5 h-5 text-orange-400" />
                    <span>Game Debug</span>
                  </Link>
                  <Link
                    href="/battle-arena-v2/index.html?debug=1&testMode=1"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Flame className="w-5 h-5 text-red-400" />
                    <span>Battle Arena V2 Test</span>
                  </Link>
                  <Link
                    href="/admin/system-health"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Shield className="w-5 h-5 text-blue-400" />
                    <span>System Health</span>
                  </Link>
                  <Link
                    href="/admin/factors"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Activity className="w-5 h-5 text-cyan-400" />
                    <span>Factor Dashboard</span>
                  </Link>
                  <Link
                    href="/admin/ai-manager"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <span>AI Manager</span>
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

