'use client'

import { UserProfileStats } from '@/types/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Flame,
  Award,
  BarChart3,
  DollarSign
} from 'lucide-react'

interface ProfileStatsOverviewProps {
  stats: UserProfileStats
}

export function ProfileStatsOverview({ stats }: ProfileStatsOverviewProps) {
  const isPositive = stats.net_units >= 0
  const hasActivity = stats.total_picks > 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Picks */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Total Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">
            {stats.total_picks}
          </div>
          {hasActivity && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-emerald-400">{stats.wins}W</span>
              <span className="text-slate-500">•</span>
              <span className="text-red-400">{stats.losses}L</span>
              {stats.pushes > 0 && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{stats.pushes}P</span>
                </>
              )}
            </div>
          )}
          {stats.pending_picks > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              {stats.pending_picks} pending
            </div>
          )}
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Win Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">
            {hasActivity ? `${stats.win_rate.toFixed(1)}%` : '—'}
          </div>
          {hasActivity && (
            <div className="text-sm text-slate-400">
              {stats.wins} / {stats.wins + stats.losses} decided
            </div>
          )}
        </CardContent>
      </Card>

      {/* Net Units */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            Net Units
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold mb-2 ${
            isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {hasActivity ? (
              <>
                {stats.net_units > 0 ? '+' : ''}
                {stats.net_units.toFixed(2)}u
              </>
            ) : '—'}
          </div>
          {hasActivity && (
            <div className="text-sm text-slate-400">
              ROI: {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Streak */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Flame className="w-4 h-4" />
            Current Streak
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.current_streak > 0 && stats.current_streak_type ? (
            <>
              <div className={`text-3xl font-bold mb-2 ${
                stats.current_streak_type === 'win' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {stats.current_streak}
                {stats.current_streak_type === 'win' ? 'W' : 'L'}
              </div>
              <div className="text-sm text-slate-400">
                {stats.current_streak_type === 'win' ? 'Winning' : 'Losing'} streak
              </div>
            </>
          ) : (
            <div className="text-3xl font-bold text-slate-500 mb-2">—</div>
          )}
        </CardContent>
      </Card>

      {/* Longest Win Streak */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Best Win Streak
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-400 mb-1">
            {stats.longest_win_streak > 0 ? `${stats.longest_win_streak}W` : '—'}
          </div>
          <div className="text-xs text-slate-500">
            Longest winning streak
          </div>
        </CardContent>
      </Card>

      {/* Total Picks */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            TOTAL Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white mb-1">
            {stats.by_pick_type.total.picks}
          </div>
          {stats.by_pick_type.total.picks > 0 && (
            <div className="text-xs text-slate-400">
              {stats.by_pick_type.total.winRate.toFixed(1)}% WR • 
              <span className={stats.by_pick_type.total.netUnits >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{stats.by_pick_type.total.netUnits > 0 ? '+' : ''}
                {stats.by_pick_type.total.netUnits.toFixed(1)}u
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spread Picks */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            SPREAD Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white mb-1">
            {stats.by_pick_type.spread.picks}
          </div>
          {stats.by_pick_type.spread.picks > 0 && (
            <div className="text-xs text-slate-400">
              {stats.by_pick_type.spread.winRate.toFixed(1)}% WR • 
              <span className={stats.by_pick_type.spread.netUnits >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{stats.by_pick_type.spread.netUnits > 0 ? '+' : ''}
                {stats.by_pick_type.spread.netUnits.toFixed(1)}u
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moneyline Picks */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            MONEYLINE Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white mb-1">
            {stats.by_pick_type.moneyline.picks}
          </div>
          {stats.by_pick_type.moneyline.picks > 0 && (
            <div className="text-xs text-slate-400">
              {stats.by_pick_type.moneyline.winRate.toFixed(1)}% WR • 
              <span className={stats.by_pick_type.moneyline.netUnits >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {' '}{stats.by_pick_type.moneyline.netUnits > 0 ? '+' : ''}
                {stats.by_pick_type.moneyline.netUnits.toFixed(1)}u
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

