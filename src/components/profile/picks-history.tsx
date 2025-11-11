'use client'

import { useState } from 'react'
import { UserPick } from '@/types/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Trophy, 
  X, 
  Minus, 
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Target,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { format } from 'date-fns'

interface PicksHistoryProps {
  picks: UserPick[]
}

export function PicksHistory({ picks }: PicksHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost' | 'push'>('all')
  const [expandedPick, setExpandedPick] = useState<string | null>(null)

  const filteredPicks = picks.filter(pick => {
    if (filter === 'all') return true
    return pick.status === filter
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return <Trophy className="w-4 h-4 text-emerald-400" />
      case 'lost':
        return <X className="w-4 h-4 text-red-400" />
      case 'push':
        return <Minus className="w-4 h-4 text-slate-400" />
      default:
        return <Clock className="w-4 h-4 text-blue-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
      case 'lost':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'push':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    }
  }

  const getPickTypeColor = (pickType: string) => {
    switch (pickType.toLowerCase()) {
      case 'total':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'spread':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
      case 'moneyline':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
    }
  }

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          All ({picks.length})
        </Button>
        <Button
          variant={filter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('pending')}
          className={filter === 'pending' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          Pending ({picks.filter(p => p.status === 'pending').length})
        </Button>
        <Button
          variant={filter === 'won' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('won')}
          className={filter === 'won' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          Won ({picks.filter(p => p.status === 'won').length})
        </Button>
        <Button
          variant={filter === 'lost' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('lost')}
          className={filter === 'lost' ? 'bg-red-600 hover:bg-red-700' : ''}
        >
          Lost ({picks.filter(p => p.status === 'lost').length})
        </Button>
        {picks.some(p => p.status === 'push') && (
          <Button
            variant={filter === 'push' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('push')}
            className={filter === 'push' ? 'bg-slate-600 hover:bg-slate-700' : ''}
          >
            Push ({picks.filter(p => p.status === 'push').length})
          </Button>
        )}
      </div>

      {/* Picks list */}
      <div className="space-y-3">
        {filteredPicks.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No picks found</p>
            </CardContent>
          </Card>
        ) : (
          filteredPicks.map(pick => {
            const isExpanded = expandedPick === pick.id
            const gameSnapshot = pick.game_snapshot || {}
            const gameInfo = `${gameSnapshot.away_team || 'TBD'} @ ${gameSnapshot.home_team || 'TBD'}`

            return (
              <Card key={pick.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Pick info */}
                    <div className="flex-1 min-w-0">
                      {/* Game info */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-white truncate">
                          {gameInfo}
                        </span>
                        {pick.is_system_pick && (
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50 text-xs">
                            SYSTEM
                          </Badge>
                        )}
                      </div>

                      {/* Pick details */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className={`${getPickTypeColor(pick.pick_type)} border text-xs`}>
                          {pick.pick_type.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-slate-300 font-medium">
                          {pick.selection}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatOdds(pick.odds)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {pick.units}u
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(pick.created_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    </div>

                    {/* Right: Status and result */}
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={`${getStatusColor(pick.status)} border`}>
                        <span className="mr-1">{getStatusIcon(pick.status)}</span>
                        {pick.status.toUpperCase()}
                      </Badge>

                      {pick.net_units !== null && (
                        <div className={`text-lg font-bold ${
                          pick.net_units >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {pick.net_units > 0 ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />
                              <span>+{pick.net_units.toFixed(2)}u</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <TrendingDown className="w-4 h-4" />
                              <span>{pick.net_units.toFixed(2)}u</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expand button */}
                      {(pick.results_analysis || pick.result) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedPick(isExpanded ? null : pick.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 mr-1" />
                              Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4 mr-1" />
                              Details
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                      {/* Results analysis */}
                      {pick.results_analysis && (
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <h4 className="text-sm font-semibold text-slate-300 mb-2">
                            AI Post-Mortem Analysis
                          </h4>
                          <p className="text-sm text-slate-400 whitespace-pre-wrap">
                            {pick.results_analysis}
                          </p>
                        </div>
                      )}

                      {/* Result details */}
                      {pick.result && (
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <h4 className="text-sm font-semibold text-slate-300 mb-2">
                            Result Details
                          </h4>
                          <pre className="text-xs text-slate-400 overflow-x-auto">
                            {JSON.stringify(pick.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

