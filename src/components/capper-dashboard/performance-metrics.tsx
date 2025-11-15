'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, Percent } from 'lucide-react'

interface PerformanceMetricsProps {
  metrics: {
    total_picks: number
    wins: number
    losses: number
    pushes: number
    win_rate: number
    net_units: number
    roi: number
    units_bet: number
  } | null
  loading?: boolean
}

export function PerformanceMetrics({ metrics, loading }: PerformanceMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-slate-800/50 border-slate-700 animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-slate-700/50 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <p className="text-slate-400 text-center">No performance data available yet</p>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    {
      label: 'Win Rate',
      value: `${metrics.win_rate.toFixed(1)}%`,
      icon: Target,
      color: metrics.win_rate >= 55 ? 'text-emerald-400' : metrics.win_rate >= 50 ? 'text-yellow-400' : 'text-red-400',
      bgColor: metrics.win_rate >= 55 ? 'bg-emerald-500/10' : metrics.win_rate >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10',
      trend: metrics.win_rate >= 52.4 ? 'up' : 'down'
    },
    {
      label: 'Total Picks',
      value: metrics.total_picks.toString(),
      icon: Trophy,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      subtitle: `${metrics.wins}W - ${metrics.losses}L${metrics.pushes > 0 ? ` - ${metrics.pushes}P` : ''}`
    },
    {
      label: 'Net Units',
      value: metrics.net_units >= 0 ? `+${metrics.net_units.toFixed(2)}` : metrics.net_units.toFixed(2),
      icon: DollarSign,
      color: metrics.net_units >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: metrics.net_units >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
      trend: metrics.net_units >= 0 ? 'up' : 'down'
    },
    {
      label: 'ROI',
      value: `${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(1)}%`,
      icon: Percent,
      color: metrics.roi >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: metrics.roi >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
      trend: metrics.roi >= 0 ? 'up' : 'down'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown
        
        return (
          <Card key={index} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                {stat.trend && (
                  <TrendIcon className={`w-4 h-4 ${stat.color}`} />
                )}
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                {stat.subtitle && (
                  <p className="text-slate-500 text-xs mt-1">{stat.subtitle}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

