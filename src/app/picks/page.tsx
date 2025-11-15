'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { useBettingSlip } from '@/contexts/betting-slip-context'
import type { BetSelection } from '@/contexts/betting-slip-context'

interface Pick {
  id: string
  selection: string
  created_at: string
  units: number
  status: string
  pick_type: string
  confidence?: number
  net_units?: number
  capper?: string
  game_snapshot?: {
    home_team: any
    away_team: any
    game_date: string
    game_time: string
    game_start_timestamp?: string
  }
  games?: {
    status: string
    game_start_timestamp?: string
  }
}

export default function AllPicksPage() {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
  const { addSelection, removeSelection, hasSelection, selections } = useBettingSlip()

  useEffect(() => {
    fetchPicks()
  }, [statusFilter])

  const fetchPicks = async () => {
    setLoading(true)
    try {
      const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`
      const response = await fetch(`/api/picks?limit=100${statusParam}`)
      const data = await response.json()

      if (data.success) {
        setPicks(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching picks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCapperBadge = (capper: string) => {
    const capperUpper = capper?.toUpperCase() || 'DEEPPICK'

    const capperColors: Record<string, { gradient: string; text: string }> = {
      'SHIVA': { gradient: 'bg-gradient-to-r from-purple-900 to-pink-900', text: 'text-purple-200' },
      'IFRIT': { gradient: 'bg-gradient-to-r from-orange-900 to-red-900', text: 'text-orange-200' },
      'SENTINEL': { gradient: 'bg-gradient-to-r from-blue-900 to-indigo-900', text: 'text-blue-200' },
      'NEXUS': { gradient: 'bg-gradient-to-r from-purple-900 to-pink-900', text: 'text-purple-200' },
      'BLITZ': { gradient: 'bg-gradient-to-r from-yellow-900 to-orange-900', text: 'text-yellow-200' },
      'TITAN': { gradient: 'bg-gradient-to-r from-gray-900 to-slate-900', text: 'text-gray-200' },
      'THIEF': { gradient: 'bg-gradient-to-r from-violet-900 to-purple-900', text: 'text-violet-200' }
    }

    return capperColors[capperUpper] || { gradient: 'bg-gradient-to-r from-blue-900 to-cyan-900', text: 'text-blue-200' }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Won</Badge>
      case 'lost':
        return <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 mr-1" />Lost</Badge>
      case 'push':
        return <Badge className="bg-gray-600 text-white">Push</Badge>
      case 'pending':
        return <Badge className="bg-blue-600 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      default:
        return <Badge className="bg-slate-600 text-white">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  // Convert pick to bet selection format
  const convertPickToBetSelection = (pick: Pick): BetSelection | null => {
    const gameSnapshot = pick.game_snapshot
    if (!gameSnapshot) return null

    const homeTeam = gameSnapshot.home_team?.abbreviation || gameSnapshot.home_team?.name || 'Home'
    const awayTeam = gameSnapshot.away_team?.abbreviation || gameSnapshot.away_team?.name || 'Away'
    const gameTime = gameSnapshot.game_time || ''

    // Parse selection to determine bet type and line
    const selection = pick.selection
    let betType: 'spread' | 'total' | 'moneyline' = 'total'
    let team = ''
    let line = ''

    if (selection.includes('OVER') || selection.includes('UNDER')) {
      betType = 'total'
      team = selection.includes('OVER') ? 'OVER' : 'UNDER'
      line = selection
    } else if (selection.includes('+') || selection.includes('-')) {
      betType = 'spread'
      // Extract team and spread (e.g., "LAL -4.5" or "MEM +4.5")
      const parts = selection.split(' ')
      team = parts[0]
      line = parts.slice(1).join(' ')
    } else {
      betType = 'moneyline'
      team = selection
      line = 'ML'
    }

    return {
      id: pick.id,
      gameId: pick.game_snapshot?.game_id || pick.id, // Use game_id from snapshot if available
      team,
      betType,
      line,
      odds: 0, // Picks don't always have odds stored
      homeTeam,
      awayTeam,
      gameTime
    }
  }

  // Toggle pick in bet slip
  const togglePickInSlip = (pick: Pick, event: React.MouseEvent) => {
    // Prevent opening modal when clicking the card
    event.stopPropagation()

    // Only allow pending picks to be added to slip
    if (pick.status !== 'pending') {
      return
    }

    const betSelection = convertPickToBetSelection(pick)
    if (!betSelection) return

    // Check if already in slip
    const inSlip = selections.some(s => s.id === pick.id)

    if (inSlip) {
      removeSelection(pick.id)
    } else {
      addSelection(betSelection)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="px-4 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4 text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">All Picks</h1>
          <p className="text-slate-400">View all picks across all cappers</p>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white">Filter by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="bg-slate-800/50 border border-slate-700">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="won">Won</TabsTrigger>
                <TabsTrigger value="lost">Lost</TabsTrigger>
                <TabsTrigger value="push">Push</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Picks List */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">
              {loading ? 'Loading...' : `${picks.length} Pick${picks.length !== 1 ? 's' : ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading picks...</div>
            ) : picks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No picks found</div>
            ) : (
              <div className="space-y-3">
                {picks.map((pick) => {
                  const capperBadge = getCapperBadge(pick.capper || 'DeepPick')
                  const homeTeam = pick.game_snapshot?.home_team
                  const awayTeam = pick.game_snapshot?.away_team
                  const matchup = `${awayTeam?.name || 'Away'} @ ${homeTeam?.name || 'Home'}`
                  const inSlip = selections.some(s => s.id === pick.id)
                  const isPending = pick.status === 'pending'

                  return (
                    <div
                      key={pick.id}
                      className={`bg-slate-800/50 border rounded-lg p-4 transition-all cursor-pointer relative ${inSlip
                        ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 bg-emerald-900/10'
                        : isPending
                          ? 'border-slate-700 hover:border-cyan-500/40'
                          : 'border-slate-700/50 opacity-75'
                        }`}
                      onClick={(e) => {
                        if (isPending) {
                          togglePickInSlip(pick, e)
                        } else {
                          setSelectedPickId(pick.id)
                        }
                      }}
                    >
                      {/* Selected indicator */}
                      {inSlip && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                          ✓ IN SLIP
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Capper + Pick Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`px-2 py-1 rounded text-xs font-bold ${capperBadge.gradient} ${capperBadge.text} uppercase`}>
                              {pick.capper || 'DeepPick'}
                            </div>
                            {getStatusBadge(pick.status)}
                          </div>
                          <div className="text-white font-semibold mb-1">{pick.selection}</div>
                          <div className="text-sm text-slate-400 mb-1">{matchup}</div>
                          {/* Game Date */}
                          {pick.game_snapshot?.game_date && (
                            <div className="text-xs text-slate-500">
                              Game: {new Date(pick.game_snapshot.game_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          )}
                        </div>

                        {/* Right: Stats */}
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-1">
                            Pick: {formatDate(pick.created_at)}
                          </div>
                          <div className="flex items-center gap-3">
                            {pick.confidence && (
                              <div className="text-xs text-slate-500">
                                Conf: <span className="text-cyan-400 font-semibold">{pick.confidence.toFixed(1)}</span>
                              </div>
                            )}
                            <div className="text-sm font-bold text-white">{pick.units}u</div>
                            {pick.net_units !== null && pick.net_units !== undefined && (
                              <div className={`text-sm font-bold flex items-center ${pick.net_units >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pick.net_units >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                                {pick.net_units >= 0 ? '+' : ''}{pick.net_units.toFixed(2)}u
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insight Modal */}
      {selectedPickId && (
        <PickInsightModal
          pickId={selectedPickId}
          onClose={() => setSelectedPickId(null)}
        />
      )}
    </div>
  )
}

