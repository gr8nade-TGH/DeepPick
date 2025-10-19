'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, BarChart3, Trophy, Activity, Target } from 'lucide-react'
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
      
      <Link href="/pick-test">
        <Button 
          variant={isActive('/pick-test') ? 'default' : 'outline'} 
          className="gap-2"
        >
          <Target className="w-4 h-4" />
          Pick Test
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
    </nav>
  )
}

