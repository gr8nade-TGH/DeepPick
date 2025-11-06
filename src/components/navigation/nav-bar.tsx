'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, BarChart3, Trophy, Activity, Target, Brain, Map, Shield, Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function NavBar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  return (
    <nav className="flex gap-2">
      <Link href="/">
        <Button
          variant={isActive('/') ? 'default' : 'outline'}
          className="gap-2"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Button>
      </Link>

      <Link href="/odds">
        <Button
          variant={isActive('/odds') ? 'default' : 'outline'}
          className="gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Odds & Factors
        </Button>
      </Link>

      <Link href="/leaderboard">
        <Button
          variant={isActive('/leaderboard') ? 'default' : 'outline'}
          className="gap-2"
        >
          <Trophy className="w-4 h-4" />
          Leaderboard
        </Button>
      </Link>

      <Link href="/cappers/shiva/management">
        <Button
          variant={isActive('/cappers/shiva/management') ? 'default' : 'outline'}
          className="gap-2"
        >
          <Brain className="w-4 h-4" />
          SHIVA Management
        </Button>
      </Link>

      <Link href="/monitoring">
        <Button
          variant={isActive('/monitoring') ? 'default' : 'outline'}
          className="gap-2"
        >
          <Activity className="w-4 h-4" />
          Monitoring
        </Button>
      </Link>

      <Link href="/territory-map">
        <Button
          variant={isActive('/territory-map') ? 'default' : 'outline'}
          className="gap-2"
        >
          <Map className="w-4 h-4" />
          Battle Map
        </Button>
      </Link>

      <Link href="/admin/system-health">
        <Button
          variant={isActive('/admin/system-health') ? 'default' : 'outline'}
          className="gap-2"
        >
          <Shield className="w-4 h-4" />
          System Health
        </Button>
      </Link>

      <Link href="/cappers/create">
        <Button
          variant={isActive('/cappers/create') ? 'default' : 'outline'}
          className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0"
        >
          <Sparkles className="w-4 h-4" />
          Become a Capper
        </Button>
      </Link>
    </nav>
  )
}

