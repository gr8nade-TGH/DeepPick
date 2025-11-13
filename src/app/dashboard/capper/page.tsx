'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  TrendingUp, 
  History, 
  Play, 
  Pause, 
  Eye, 
  Loader2,
  ArrowLeft,
  Zap,
  Hand,
  GitMerge,
  Clock,
  Ban,
  Sliders,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

interface CapperData {
  capper_id: string
  display_name: string
  description: string
  sport: string
  bet_types: string[]
  pick_mode: 'manual' | 'auto' | 'hybrid'
  auto_generate_hours_before: number
  excluded_teams: string[]
  factor_config: {
    [betType: string]: {
      enabled_factors: string[]
      weights: { [factor: string]: number }
    }
  }
  is_active: boolean
  created_at: string
}

export default function CapperDashboardPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [capperData, setCapperData] = useState<CapperData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    // Check if user is a capper
    if (!user || !profile || profile.role !== 'capper') {
      router.push('/')
      return
    }

    fetchCapperData()
  }, [user, profile, authLoading])

  const fetchCapperData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user-cappers/my-capper')
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load capper data')
      }

      setCapperData(data.capper)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async () => {
    if (!capperData) return

    try {
      const response = await fetch('/api/user-cappers/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capper_id: capperData.capper_id })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to toggle active status')
      }

      setCapperData(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle active status')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading your capper dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !capperData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-6">
              <p className="text-red-400">{error || 'No capper data found'}</p>
              <Link href="/">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const getPickModeIcon = (mode: string) => {
    switch (mode) {
      case 'manual': return <Hand className="w-4 h-4" />
      case 'auto': return <Zap className="w-4 h-4" />
      case 'hybrid': return <GitMerge className="w-4 h-4" />
      default: return <Zap className="w-4 h-4" />
    }
  }

  const getPickModeLabel = (mode: string) => {
    switch (mode) {
      case 'manual': return 'Manual Only'
      case 'auto': return 'Auto-Generated'
      case 'hybrid': return 'Hybrid (Manual + Auto)'
      default: return mode
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-8 h-8 text-blue-500" />
              My Capper Dashboard
            </h1>
            <p className="text-slate-400">Manage your pick generation settings and performance</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/profile/${user?.id}`}>
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
                <Eye className="w-4 h-4 mr-2" />
                View Public Profile
              </Button>
            </Link>
            <Button
              onClick={toggleActive}
              variant={capperData.is_active ? 'destructive' : 'default'}
              className={capperData.is_active ? '' : 'bg-green-600 hover:bg-green-700'}
            >
              {capperData.is_active ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause Picks
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume Picks
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        <Card className={`mb-6 ${capperData.is_active ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={capperData.is_active ? 'default' : 'secondary'} className={capperData.is_active ? 'bg-green-600' : 'bg-yellow-600'}>
                  {capperData.is_active ? 'Active' : 'Paused'}
                </Badge>
                <span className="text-white font-medium">{capperData.display_name}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400 flex items-center gap-1">
                  {getPickModeIcon(capperData.pick_mode)}
                  {getPickModeLabel(capperData.pick_mode)}
                </span>
              </div>
              <div className="text-sm text-slate-400">
                Created {new Date(capperData.created_at).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Tabs */}
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="settings" className="data-[state=active]:bg-slate-700">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-slate-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-slate-700">
              <History className="w-4 h-4 mr-2" />
              Picks History
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Quick Settings</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage your pick generation configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">Settings interface coming soon...</p>
                <Link href="/dashboard/capper/settings">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Full Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Performance Analytics</CardTitle>
                <CardDescription className="text-slate-400">
                  Track your picks performance and factor accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">Performance analytics coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Picks History</CardTitle>
                <CardDescription className="text-slate-400">
                  View all your generated and manual picks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">Picks history coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

