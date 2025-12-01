'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, CalendarDays, History } from 'lucide-react'
import { getRarityTierFromConfidence, getRarityStyleFromTier, type RarityTier } from '@/lib/tier-grading'

interface Pick {
  id: string
  selection: string
  status: 'pending' | 'won' | 'lost' | 'push'
  capper: string
  pick_type: string
  confidence?: number
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
type TierFilter = 'all' | 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'

// Get tier from confidence score
const getTierFromPick = (pick: Pick): RarityTier => {
  const confidence = pick.confidence || 50
  return getRarityTierFromConfidence(confidence)
}

export function PickHistoryGrid({ onPickClick }: PickHistoryGridProps) {
  const [allPicks, setAllPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')

  useEffect(() => {
    fetchPicks()
  }, [])

  const fetchPicks = async () => {
    setLoading(true)
    try {
      // Fetch all picks (we'll filter client-side for responsiveness)
      const response = await fetch('/api/picks?limit=500')
      const data = await response.json()

      if (data.success) {
        setAllPicks(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching picks:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort picks based on timeFilter and tierFilter
  const picks = (() => {
    const now = new Date()
    let cutoffDate: Date | null = null

    if (timeFilter === '24h') {
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    } else if (timeFilter === '7d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (timeFilter === '30d') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Filter by date
    let filtered = cutoffDate
      ? allPicks.filter(p => new Date(p.created_at) >= cutoffDate!)
      : allPicks

    // Filter by tier
    if (tierFilter !== 'all') {
      filtered = filtered.filter(p => getTierFromPick(p) === tierFilter)
    }

    // Sort: LIVE (pending) first, then by date descending
    return filtered.sort((a, b) => {
      // Pending picks always come first
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (b.status === 'pending' && a.status !== 'pending') return 1

      // Both pending or both not pending - sort by date descending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  })()

  // Tier-styled colors based on status
  const getPickStyle = (pick: Pick) => {
    const tier = getTierFromPick(pick)
    const rarity = getRarityStyleFromTier(tier)
    const status = pick.status

    // Base border color from tier
    const borderColor = rarity.borderColor

    // Status determines the inner color
    if (status === 'won') {
      return {
        background: `linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))`,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 8px ${rarity.glowColor}, inset 0 0 6px rgba(16, 185, 129, 0.3)`
      }
    } else if (status === 'lost') {
      return {
        background: `linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(185, 28, 28, 0.9))`,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 8px ${rarity.glowColor}, inset 0 0 6px rgba(239, 68, 68, 0.3)`
      }
    } else if (status === 'push') {
      return {
        background: `linear-gradient(135deg, rgba(100, 116, 139, 0.9), rgba(71, 85, 105, 0.9))`,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 8px ${rarity.glowColor}`
      }
    } else {
      // Pending/Live
      return {
        background: `linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9))`,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 12px ${rarity.glowColor}, 0 0 20px rgba(245, 158, 11, 0.4)`
      }
    }
  }

  const timeFilters: { key: TimeFilter; label: string; icon: React.ReactNode }[] = [
    { key: '24h', label: '24H', icon: <Clock className="w-3 h-3" /> },
    { key: '7d', label: '7D', icon: <Calendar className="w-3 h-3" /> },
    { key: '30d', label: '30D', icon: <CalendarDays className="w-3 h-3" /> },
    { key: 'all', label: 'ALL', icon: <History className="w-3 h-3" /> },
  ]

  const tierFilters: { key: TierFilter; label: string; icon: string; color: string }[] = [
    { key: 'all', label: 'All', icon: '◉', color: 'text-slate-300' },
    { key: 'Common', label: 'Common', icon: '◆', color: 'text-slate-400' },
    { key: 'Uncommon', label: 'Uncommon', icon: '✦', color: 'text-green-400' },
    { key: 'Rare', label: 'Rare', icon: '💠', color: 'text-blue-400' },
    { key: 'Epic', label: 'Epic', icon: '💎', color: 'text-purple-400' },
    { key: 'Legendary', label: 'Legend', icon: '🏆', color: 'text-amber-400' },
  ]

  // Stats
  const wins = picks.filter(p => p.status === 'won').length
  const losses = picks.filter(p => p.status === 'lost').length
  const pending = picks.filter(p => p.status === 'pending').length
  const pushes = picks.filter(p => p.status === 'push').length
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0'

  return (
    <div className="glass-effect p-4 rounded-lg border border-gray-800">
      {/* Header Row 1: Title + Stats + Time Filters */}
      <div className="flex items-center justify-between mb-2">
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
          {timeFilters.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={timeFilter === f.key ? 'default' : 'ghost'}
              onClick={() => setTimeFilter(f.key)}
              className={`h-7 px-2 text-xs ${timeFilter === f.key
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

      {/* Header Row 2: Tier Filters */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <span className="text-xs text-slate-500 mr-1">Tier:</span>
        {tierFilters.map(t => {
          const rarity = t.key !== 'all' ? getRarityStyleFromTier(t.key) : null
          return (
            <button
              key={t.key}
              onClick={() => setTierFilter(t.key)}
              className={`h-6 px-2 text-[10px] font-semibold rounded transition-all flex items-center gap-1 ${tierFilter === t.key
                ? 'ring-1 ring-white/30 scale-105'
                : 'opacity-70 hover:opacity-100'
                }`}
              style={rarity ? {
                background: `linear-gradient(135deg, ${rarity.borderColor}30, ${rarity.borderColor}15)`,
                border: `1px solid ${rarity.borderColor}60`,
                color: rarity.borderColor
              } : {
                background: 'rgba(100,116,139,0.2)',
                border: '1px solid rgba(100,116,139,0.4)',
                color: '#94a3b8'
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          )
        })}
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
            {picks.map((pick) => {
              const tier = getTierFromPick(pick)
              const rarity = getRarityStyleFromTier(tier)
              const style = getPickStyle(pick)

              return (
                <Tooltip key={pick.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onPickClick?.(pick)}
                      className={`w-6 h-6 rounded cursor-pointer transition-all hover:scale-125 ${pick.status === 'pending' ? 'animate-pulse' : ''}`}
                      style={style}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="p-0 border-0 bg-transparent"
                  >
                    <div
                      className="rounded-lg p-2.5 max-w-xs"
                      style={{
                        background: `linear-gradient(135deg, rgba(15,15,25,0.98), rgba(25,25,40,0.98))`,
                        border: `2px solid ${rarity.borderColor}`,
                        boxShadow: `0 0 15px ${rarity.glowColor}`
                      }}
                    >
                      <div className="space-y-1.5">
                        {/* Tier badge + Status */}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: `linear-gradient(135deg, ${rarity.borderColor}40, ${rarity.borderColor}20)`,
                              color: rarity.borderColor,
                              border: `1px solid ${rarity.borderColor}60`
                            }}
                          >
                            {rarity.icon} {tier.toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-bold ${pick.status === 'won' ? 'text-emerald-400' :
                            pick.status === 'lost' ? 'text-red-400' :
                              pick.status === 'push' ? 'text-slate-400' :
                                'text-amber-400'
                            }`}>
                            {pick.status === 'pending' ? '🔴 LIVE' : pick.status.toUpperCase()}
                          </span>
                        </div>
                        {/* Pick selection */}
                        <div className="font-bold text-white text-sm" style={{ textShadow: `0 0 10px ${rarity.glowColor}` }}>
                          {pick.selection}
                        </div>
                        {/* Matchup */}
                        <div className="text-slate-400 text-xs">
                          {pick.game_snapshot?.away_team?.abbreviation} @ {pick.game_snapshot?.home_team?.abbreviation}
                        </div>
                        {/* Date + Confidence */}
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">
                            {new Date(pick.created_at).toLocaleDateString()}
                          </span>
                          {pick.confidence && (
                            <span style={{ color: rarity.borderColor }}>
                              Sharp: {pick.confidence.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {/* Tier Formula Note */}
                        <div className="pt-1.5 mt-1.5 border-t border-slate-700/50">
                          <div className="text-[9px] text-slate-500">
                            <div className="flex justify-between">
                              <span>📊 Base Score:</span>
                              <span className="text-slate-300">{((pick.confidence || 50) * 10).toFixed(0)}</span>
                            </div>
                            <div className="text-[8px] text-slate-600 mt-0.5 italic">
                              Click for full tier breakdown →
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
      )}
    </div>
  )
}

