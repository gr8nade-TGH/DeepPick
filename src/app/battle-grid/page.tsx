'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Swords, TrendingUp, Trophy, Users } from 'lucide-react'

interface SystemCapper {
  id: string
  display_name: string
  color_theme: string
  is_system: boolean
  battleCount?: number
  activeBattles?: number
  wins?: number
  losses?: number
}

export default function BattleGridPage() {
  const router = useRouter()
  const [systemCappers, setSystemCappers] = useState<SystemCapper[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSystemCappers()
  }, [])

  const fetchSystemCappers = async () => {
    try {
      // Fetch all system cappers
      const response = await fetch('/api/cappers?system=true')
      const data = await response.json()

      if (data.success) {
        // For each capper, get their battle count
        const cappersWithBattles = await Promise.all(
          data.cappers.map(async (capper: SystemCapper) => {
            const battleResponse = await fetch(
              `/api/battle-bets/capper/${capper.id}?limit=1`
            )
            const battleData = await battleResponse.json()

            return {
              ...capper,
              battleCount: battleData.pagination?.total || 0,
              activeBattles: battleData.battles?.filter(
                (b: any) => !['complete', 'cancelled'].includes(b.status)
              ).length || 0
            }
          })
        )

        setSystemCappers(cappersWithBattles)
      }
    } catch (error) {
      console.error('Error fetching system cappers:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="mt-4 text-gray-400">Loading system cappers...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Swords className="w-12 h-12 text-purple-500" />
            Battle Grid
          </h1>
          <p className="text-gray-400 text-lg">
            Watch AI cappers battle in real-time based on their opposing picks
          </p>
        </div>

        {/* All Active Battles Button */}
        <div className="mb-8 text-center">
          <Button
            onClick={() => router.push('/battle-arena')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg px-8 py-6"
          >
            <Trophy className="w-5 h-5 mr-2" />
            VIEW ALL ACTIVE BATTLES
          </Button>
        </div>

        {/* System Cappers Grid */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            System Cappers
          </h2>

          {systemCappers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No system cappers found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {systemCappers.map((capper) => (
                <Card
                  key={capper.id}
                  className="bg-slate-900/50 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group"
                  onClick={() => router.push(`/battle-grid/${capper.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: capper.color_theme || '#3b82f6' }}
                      >
                        {capper.display_name.charAt(0)}
                      </div>
                      {capper.activeBattles && capper.activeBattles > 0 && (
                        <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-semibold">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          {capper.activeBattles} LIVE
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-white group-hover:text-purple-400 transition-colors">
                      {capper.display_name}
                    </CardTitle>
                    <CardDescription>System Capper</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Battle Count */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 flex items-center gap-2">
                          <Swords className="w-4 h-4" />
                          Total Battles
                        </span>
                        <span className="text-white font-semibold">
                          {capper.battleCount || 0}
                        </span>
                      </div>

                      {/* Active Battles */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Active Battles
                        </span>
                        <span className="text-green-400 font-semibold">
                          {capper.activeBattles || 0}
                        </span>
                      </div>

                      {/* View Button */}
                      <Button
                        className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/battle-grid/${capper.id}`)
                        }}
                      >
                        View Battles
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

