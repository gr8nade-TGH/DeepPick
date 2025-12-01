'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, CalendarDays, History } from 'lucide-react'

interface Pick {
  id: string
  selection: string
  status: 'pending' | 'won' | 'lost' | 'push'
  capper: string
  pick_type: string
  created_at: string
  game_snapshot?: {
    away_team?: { abbreviation?: string }
    home_team?: { abbreviation?: string }
    game_date?: string
  }
  result?: {
    final_score?: { home: number; away: number }
  }
}

interface PickHistoryGridProps {
  onPickClick?: (pick: Pick) => void
}

type TimeFilter = '24h' | '7d' | '30d' | 'all'

export function PickHistoryGrid({ onPickClick }: PickHistoryGridProps) {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d')

  useEffect(() => {
    fetchPicks()
  }, [timeFilter])

  const fetchPicks = async () => {
    setLoading(true)
    try {
      // Calculate date filter
      let since = ''
      const now = new Date()
      if (timeFilter === '24h') {
        since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      } else if (timeFilter === '7d') {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      } else if (timeFilter === '30d') {
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }

      const url = `/api/picks?limit=200${since ? `&since=${since}` : ''}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        // Sort by date descending
        const sorted = (data.data || []).sort((a: Pick, b: Pick) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setPicks(sorted)
      }
    } catch (error) {
      console.error('Error fetching picks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPickColor = (status: string) => {
    switch (status) {
      case 'won': return 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30'
      case 'lost': return 'bg-red-500 hover:bg-red-400 shadow-red-500/30'
      case 'push': return 'bg-slate-500 hover:bg-slate-400 shadow-slate-500/30'
      default: return 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30 animate-pulse'
    }
  }

  const filters: { key: TimeFilter; label: string; icon: React.ReactNode }[] = [
    { key: '24h', label: '24H', icon: <Clock className="w-3 h-3" /> },
    { key: '7d', label: '7D', icon: <Calendar className="w-3 h-3" /> },
    { key: '30d', label: '30D', icon: <CalendarDays className="w-3 h-3" /> },
    { key: 'all', label: 'ALL', icon: <History className="w-3 h-3" /> },
  ]

  // Stats
  const wins = picks.filter(p => p.status === 'won').length
  const losses = picks.filter(p => p.status === 'lost').length
  const pending = picks.filter(p => p.status === 'pending').length
  const pushes = picks.filter(p => p.status === 'push').length
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0'

  return (
    <div className="glass-effect p-4 rounded-lg border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-200">Pick History</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">{wins}W</span>
            <span className="text-slate-500">-</span>
            <span className="text-red-400">{losses}L</span>
            {pushes > 0 && <>
              <span className="text-slate-500">-</span>
              <span className="text-slate-400">{pushes}P</span>
            </>}
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400">{winRate}%</span>
            {pending > 0 && (
              <span className="text-amber-400 ml-2">({pending} live)</span>
            )}
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex gap-1">
          {filters.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={timeFilter === f.key ? 'default' : 'ghost'}
              onClick={() => setTimeFilter(f.key)}
              className={`h-7 px-2 text-xs ${
                timeFilter === f.key 
                  ? 'bg-cyan-600 hover:bg-cyan-700' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.icon}
              <span className="ml-1">{f.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : picks.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No picks in this timeframe
        </div>
      ) : (
        <TooltipProvider delayDuration={100}>
          <div className="flex flex-wrap gap-1.5">
            {picks.map((pick) => (
              <Tooltip key={pick.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPickClick?.(pick)}
                    className={`w-6 h-6 rounded shadow-lg cursor-pointer transition-all hover:scale-110 ${getPickColor(pick.status)}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 border-slate-700 p-2 max-w-xs">
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-white">{pick.selection}</div>
                    <div className="text-slate-400">
                      {pick.game_snapshot?.away_team?.abbreviation} @ {pick.game_snapshot?.home_team?.abbreviation}
                    </div>
                    <div className="text-slate-500">
                      {new Date(pick.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}

