'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Target, Trophy, DollarSign } from 'lucide-react'
import type { UserStats } from '@/types/admin'

interface UserStatsCardProps {
  stats: UserStats
  compact?: boolean
}

export function UserStatsCard({ stats, compact = false }: UserStatsCardProps) {
  const isPositive = stats.net_units >= 0
  const hasActivity = stats.total_picks > 0

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Target className="w-4 h-4 text-slate-400" />
          <span className="text-slate-300">{stats.total_picks}</span>
        </div>
        {hasActivity && (
          <>
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">{stats.win_rate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
                {stats.net_units > 0 ? '+' : ''}{stats.net_units}u
              </span>
            </div>
          </>
        )}
        {!hasActivity && (
          <span className="text-slate-500 text-xs">No picks yet</span>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {/* Total Picks */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Picks</span>
          </div>
          <div className="text-xl font-bold text-white">{stats.total_picks}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.wins}W / {stats.losses}L / {stats.pushes}P
          </div>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Win Rate</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">
            {hasActivity ? `${stats.win_rate.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.wins} wins
          </div>
        </CardContent>
      </Card>

      {/* Net Units */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-xs text-slate-400">Net Units</span>
          </div>
          <div className={`text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.net_units > 0 ? '+' : ''}{stats.net_units}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            units
          </div>
        </CardContent>
      </Card>

      {/* ROI */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">ROI</span>
          </div>
          <div className={`text-xl font-bold ${stats.roi >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {hasActivity ? `${stats.roi > 0 ? '+' : ''}${stats.roi.toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            return
          </div>
        </CardContent>
      </Card>

      {/* Last Pick */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400">Last Pick</span>
          </div>
          <div className="text-sm font-medium text-white">
            {stats.last_pick_at ? (
              new Date(stats.last_pick_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })
            ) : (
              'Never'
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.last_pick_at ? (
              new Date(stats.last_pick_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })
            ) : (
              'No activity'
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

