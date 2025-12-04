'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, CalendarDays, History, HelpCircle } from 'lucide-react'
import { getRarityTierFromConfidence, getRarityStyleFromTier, type RarityTier } from '@/lib/tier-grading'

// NBA Team name to abbreviation map
const NBA_TEAM_MAP: Record<string, string> = {
  'ATLANTA HAWKS': 'ATL', 'HAWKS': 'ATL', 'ATLANTA': 'ATL',
  'BOSTON CELTICS': 'BOS', 'CELTICS': 'BOS', 'BOSTON': 'BOS',
  'BROOKLYN NETS': 'BKN', 'NETS': 'BKN', 'BROOKLYN': 'BKN',
  'CHARLOTTE HORNETS': 'CHA', 'HORNETS': 'CHA', 'CHARLOTTE': 'CHA',
  'CHICAGO BULLS': 'CHI', 'BULLS': 'CHI', 'CHICAGO': 'CHI',
  'CLEVELAND CAVALIERS': 'CLE', 'CAVALIERS': 'CLE', 'CAVS': 'CLE', 'CLEVELAND': 'CLE',
  'DALLAS MAVERICKS': 'DAL', 'MAVERICKS': 'DAL', 'MAVS': 'DAL', 'DALLAS': 'DAL',
  'DENVER NUGGETS': 'DEN', 'NUGGETS': 'DEN', 'DENVER': 'DEN',
  'DETROIT PISTONS': 'DET', 'PISTONS': 'DET', 'DETROIT': 'DET',
  'GOLDEN STATE WARRIORS': 'GSW', 'WARRIORS': 'GSW', 'GOLDEN STATE': 'GSW',
  'HOUSTON ROCKETS': 'HOU', 'ROCKETS': 'HOU', 'HOUSTON': 'HOU',
  'INDIANA PACERS': 'IND', 'PACERS': 'IND', 'INDIANA': 'IND',
  'LA CLIPPERS': 'LAC', 'LOS ANGELES CLIPPERS': 'LAC', 'CLIPPERS': 'LAC',
  'LOS ANGELES LAKERS': 'LAL', 'LAKERS': 'LAL',
  'MEMPHIS GRIZZLIES': 'MEM', 'GRIZZLIES': 'MEM', 'MEMPHIS': 'MEM',
  'MIAMI HEAT': 'MIA', 'HEAT': 'MIA', 'MIAMI': 'MIA',
  'MILWAUKEE BUCKS': 'MIL', 'BUCKS': 'MIL', 'MILWAUKEE': 'MIL',
  'MINNESOTA TIMBERWOLVES': 'MIN', 'TIMBERWOLVES': 'MIN', 'WOLVES': 'MIN', 'MINNESOTA': 'MIN',
  'NEW ORLEANS PELICANS': 'NOP', 'PELICANS': 'NOP', 'NEW ORLEANS': 'NOP',
  'NEW YORK KNICKS': 'NYK', 'KNICKS': 'NYK', 'NEW YORK': 'NYK',
  'OKLAHOMA CITY THUNDER': 'OKC', 'THUNDER': 'OKC', 'OKLAHOMA CITY': 'OKC', 'OKC THUNDER': 'OKC',
  'ORLANDO MAGIC': 'ORL', 'MAGIC': 'ORL', 'ORLANDO': 'ORL',
  'PHILADELPHIA 76ERS': 'PHI', '76ERS': 'PHI', 'SIXERS': 'PHI', 'PHILADELPHIA': 'PHI',
  'PHOENIX SUNS': 'PHX', 'SUNS': 'PHX', 'PHOENIX': 'PHX',
  'PORTLAND TRAIL BLAZERS': 'POR', 'TRAIL BLAZERS': 'POR', 'BLAZERS': 'POR', 'PORTLAND': 'POR',
  'SACRAMENTO KINGS': 'SAC', 'KINGS': 'SAC', 'SACRAMENTO': 'SAC',
  'SAN ANTONIO SPURS': 'SAS', 'SPURS': 'SAS', 'SAN ANTONIO': 'SAS',
  'TORONTO RAPTORS': 'TOR', 'RAPTORS': 'TOR', 'TORONTO': 'TOR',
  'UTAH JAZZ': 'UTA', 'JAZZ': 'UTA', 'UTAH': 'UTA',
  'WASHINGTON WIZARDS': 'WAS', 'WIZARDS': 'WAS', 'WASHINGTON': 'WAS',
}

// Format selection to use abbreviations
function formatSelectionAbbrev(selection: string): string {
  if (!selection) return ''
  const upper = selection.trim().toUpperCase()

  // Handle OVER/UNDER totals
  const totalMatch = upper.match(/^(OVER|UNDER|O|U)\s*([\d.]+)/i)
  if (totalMatch) {
    const dir = (totalMatch[1] === 'O' || totalMatch[1] === 'OVER') ? 'OVER' : 'UNDER'
    return `${dir} ${totalMatch[2]}`
  }

  // Handle spreads like "San Antonio Spurs -5.5"
  const spreadMatch = upper.match(/^(.+?)\s*([-+][\d.]+)$/)
  if (spreadMatch) {
    const teamPart = spreadMatch[1].trim()
    const spread = spreadMatch[2]
    const abbrev = NBA_TEAM_MAP[teamPart] || (teamPart.length <= 3 ? teamPart : teamPart)
    return `${abbrev} ${spread}`
  }

  return NBA_TEAM_MAP[upper] || selection
}

interface Pick {
  id: string
  selection: string
  status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
  capper: string
  pick_type: string
  confidence?: number
  created_at: string
  units?: number
  is_system_pick?: boolean
  game_snapshot?: {
    away_team?: { abbreviation?: string; name?: string }
    home_team?: { abbreviation?: string; name?: string }
    game_date?: string
    game_start_timestamp?: string
    tier_grade?: {
      tier: string
      tierScore: number
      // New structure
      breakdown?: {
        sharpScore: number
        edgeBonus: number
        teamRecordBonus: number
        recentFormBonus: number
        losingStreakPenalty: number
        rawScore: number
        unitGateApplied?: boolean
        originalTier?: string
      }
      // Legacy structure
      inputs?: {
        baseConfidence: number
        unitsRisked: number
        teamRecord?: any
        last7DaysRecord?: any
      }
      bonuses?: {
        units: number
        hotStreak: number
        teamRecord: number
        edge?: number
        unitGateApplied?: boolean
        originalTier?: string
      }
    }
  }
  games?: {
    status?: string
    game_start_timestamp?: string
    final_score?: { home: number; away: number; winner?: string }
    home_score?: number
    away_score?: number
  }
  result?: {
    final_score?: { home: number; away: number; winner?: string }
    outcome?: string
  }
}

// Determine if a pending pick's game is LIVE, SCHEDULED, or STALE
const getGameLiveStatus = (pick: Pick): 'live' | 'scheduled' | 'stale' => {
  if (pick.status !== 'pending') return 'scheduled' // Not pending, doesn't matter

  const gameTimestamp = pick.games?.game_start_timestamp || pick.game_snapshot?.game_start_timestamp
  if (!gameTimestamp) return 'scheduled' // No timestamp, assume scheduled

  const now = new Date()
  const gameStart = new Date(gameTimestamp)
  const hoursSinceStart = (now.getTime() - gameStart.getTime()) / (1000 * 60 * 60)

  if (hoursSinceStart < 0) {
    // Game hasn't started yet
    return 'scheduled'
  } else if (hoursSinceStart < 4) {
    // Game started within last 4 hours - likely still live or just finished
    return 'live'
  } else {
    // Game started more than 4 hours ago but pick still pending = STALE (should have been graded)
    return 'stale'
  }
}

interface PickHistoryGridProps {
  onPickClick?: (pick: Pick) => void
}

type TimeFilter = '24h' | '7d' | '30d' | 'all'
type TierFilter = 'all' | 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'
type SourceFilter = 'all' | 'system' | 'manual'

// Get tier from stored tier_grade or fallback to confidence calculation
const getTierFromPick = (pick: Pick): RarityTier => {
  // Prefer stored tier from tier_grade (accurate)
  if (pick.game_snapshot?.tier_grade?.tier) {
    return pick.game_snapshot.tier_grade.tier as RarityTier
  }
  // Fallback to confidence-based calculation for legacy picks
  const confidence = pick.confidence || 50
  return getRarityTierFromConfidence(confidence)
}

export function PickHistoryGrid({ onPickClick }: PickHistoryGridProps) {
  const [allPicks, setAllPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

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

  // Filter and sort picks based on timeFilter, tierFilter, and sourceFilter
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

    // Filter by source (system vs manual)
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(p => {
        const isSystem = p.is_system_pick === true
        return sourceFilter === 'system' ? isSystem : !isSystem
      })
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
        background: `linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))`,  // Brighter green
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 10px ${rarity.glowColor}, inset 0 0 8px rgba(34, 197, 94, 0.4)`
      }
    } else if (status === 'lost') {
      return {
        background: `linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(185, 28, 28, 0.9))`,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 8px ${rarity.glowColor}, inset 0 0 6px rgba(239, 68, 68, 0.3)`
      }
    } else if (status === 'push' || status === 'cancelled') {
      // Push or Cancelled - muted gray styling
      return {
        background: `linear-gradient(135deg, rgba(100, 116, 139, 0.9), rgba(71, 85, 105, 0.9))`,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 8px ${rarity.glowColor}`
      }
    } else {
      // Pending - distinguish between LIVE, SCHEDULED, and STALE
      const liveStatus = getGameLiveStatus(pick)

      if (liveStatus === 'live') {
        // LIVE - Bright amber/yellow with pulsing glow
        return {
          background: `linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))`,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 12px ${rarity.glowColor}, 0 0 20px rgba(245, 158, 11, 0.5)`
        }
      } else if (liveStatus === 'stale') {
        // STALE - Orange/red tint to indicate problem (should have been graded)
        return {
          background: `linear-gradient(135deg, rgba(249, 115, 22, 0.9), rgba(194, 65, 12, 0.9))`,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 8px ${rarity.glowColor}, 0 0 10px rgba(249, 115, 22, 0.4)`
        }
      } else {
        // SCHEDULED - Cyan/blue tint (upcoming, not started)
        return {
          background: `linear-gradient(135deg, rgba(34, 211, 238, 0.85), rgba(6, 182, 212, 0.85))`,
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 8px ${rarity.glowColor}, 0 0 12px rgba(34, 211, 238, 0.3)`
        }
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

  // Stats - separate pending into live, scheduled, and stale
  const wins = picks.filter(p => p.status === 'won').length
  const losses = picks.filter(p => p.status === 'lost').length
  const pendingPicks = picks.filter(p => p.status === 'pending')
  const livePicks = pendingPicks.filter(p => getGameLiveStatus(p) === 'live').length
  const scheduledPicks = pendingPicks.filter(p => getGameLiveStatus(p) === 'scheduled').length
  const stalePicks = pendingPicks.filter(p => getGameLiveStatus(p) === 'stale').length
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
            {livePicks > 0 && (
              <span className="text-amber-400 ml-2">({livePicks} live)</span>
            )}
            {scheduledPicks > 0 && (
              <span className="text-cyan-400 ml-1">({scheduledPicks} scheduled)</span>
            )}
            {stalePicks > 0 && (
              <span className="text-orange-400 ml-1">({stalePicks} stale)</span>
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

      {/* Header Row 2: Tier Filters + Source Filter */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <div className="flex items-center gap-1 mr-1">
          <span className="text-xs text-slate-500">Tier:</span>
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-slate-500 hover:text-slate-300 transition-colors">
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[480px] p-0 bg-slate-900 border border-slate-700 shadow-2xl">
              <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto text-sm">
                <div className="text-center border-b border-slate-700 pb-3">
                  <h3 className="text-lg font-bold bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 text-transparent bg-clip-text">
                    ⚔️ Pick Power Tier System
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">Quality-based tier system — units do NOT affect tier</p>
                </div>

                {/* Tier Thresholds - 1-100 Scale */}
                <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 mb-2">📊 Pick Power Tiers (1-100 Scale)</div>
                  <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                    <div className="text-center p-1.5 rounded bg-amber-500/20 border border-amber-500/40">
                      <div className="text-amber-400 font-bold">🏆 Legendary</div>
                      <div className="text-amber-300">90+</div>
                    </div>
                    <div className="text-center p-1.5 rounded bg-purple-500/20 border border-purple-500/40">
                      <div className="text-purple-400 font-bold">💎 Elite</div>
                      <div className="text-purple-300">75-89</div>
                    </div>
                    <div className="text-center p-1.5 rounded bg-blue-500/20 border border-blue-500/40">
                      <div className="text-blue-400 font-bold">💠 Rare</div>
                      <div className="text-blue-300">60-74</div>
                    </div>
                    <div className="text-center p-1.5 rounded bg-green-500/20 border border-green-500/40">
                      <div className="text-green-400 font-bold">✦ Uncommon</div>
                      <div className="text-green-300">45-59</div>
                    </div>
                    <div className="text-center p-1.5 rounded bg-slate-500/20 border border-slate-500/40">
                      <div className="text-slate-400 font-bold">◆ Common</div>
                      <div className="text-slate-300">0-44</div>
                    </div>
                  </div>
                  {/* Visual tier bar */}
                  <div className="mt-2">
                    <div className="flex gap-0.5 h-3 rounded overflow-hidden">
                      <div className="flex-[45] bg-slate-600/60 flex items-center justify-center text-[8px] text-slate-300 font-medium">0-44</div>
                      <div className="flex-[15] bg-green-700/60 flex items-center justify-center text-[8px] text-green-200 font-medium">45-59</div>
                      <div className="flex-[15] bg-blue-600/60 flex items-center justify-center text-[8px] text-blue-200 font-medium">60-74</div>
                      <div className="flex-[15] bg-purple-600/60 flex items-center justify-center text-[8px] text-purple-200 font-medium">75-89</div>
                      <div className="flex-[10] bg-amber-500/60 flex items-center justify-center text-[8px] text-amber-200 font-medium">90+</div>
                    </div>
                  </div>
                </div>

                {/* AI Picks (SHIVA/IFRIT) Signals */}
                <div className="bg-cyan-950/30 rounded-lg p-3 border border-cyan-800/30">
                  <div className="text-xs font-semibold text-cyan-300 mb-2">🤖 AI Picks (SHIVA/IFRIT) — 4 Signals</div>
                  <div className="text-[10px] text-slate-300 space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>⚡ Edge Strength (confidence score)</span>
                      <span className="text-cyan-400">0-35 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🎯 Specialization Record (bet-type win rate)</span>
                      <span className="text-cyan-400">0-20 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🔥 Win Streak (consecutive wins)</span>
                      <span className="text-cyan-400">0-10 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🧩 Factor Alignment (% factors agree)</span>
                      <span className="text-cyan-400">0-35 pts</span>
                    </div>
                  </div>
                </div>

                {/* Manual Picks Signals */}
                <div className="bg-green-950/30 rounded-lg p-3 border border-green-800/30">
                  <div className="text-xs font-semibold text-green-300 mb-2">👤 Manual/Human Picks — 4 Signals</div>
                  <div className="text-[10px] text-slate-300 space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>💪 Bet Conviction (units risked)</span>
                      <span className="text-green-400">0-35 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🎯 Specialization Record (bet-type win rate)</span>
                      <span className="text-green-400">0-20 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🔥 Win Streak (consecutive wins)</span>
                      <span className="text-green-400">0-10 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>💰 Quality Signal (career net units)</span>
                      <span className="text-green-400">0-35 pts</span>
                    </div>
                  </div>
                </div>

                {/* PICKSMITH Signals */}
                <div className="bg-purple-950/30 rounded-lg p-3 border border-purple-800/30">
                  <div className="text-xs font-semibold text-purple-300 mb-2">🔮 PICKSMITH Consensus — 4 Signals</div>
                  <div className="text-[10px] text-slate-300 space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🤝 Consensus Strength (# cappers agree)</span>
                      <span className="text-purple-400">0-35 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🎯 Specialization Record (PICKSMITH win rate)</span>
                      <span className="text-purple-400">0-20 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>🔥 Win Streak (PICKSMITH streak)</span>
                      <span className="text-purple-400">0-10 pts</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/40 px-2 py-1 rounded">
                      <span>💰 Quality Signal (avg capper net units)</span>
                      <span className="text-purple-400">0-35 pts</span>
                    </div>
                  </div>
                </div>

                {/* Key Principles */}
                <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div className="text-center font-semibold text-slate-300 mb-1">✨ Key Principles</div>
                    <div>• <span className="text-green-400">Units do NOT affect tier</span> — tier = quality, units = bet size</div>
                    <div>• <span className="text-purple-400">TOTAL</span> and <span className="text-cyan-400">SPREAD</span> records tracked separately</div>
                    <div>• All pick types use 1-100 scale with same tier thresholds</div>
                    <div>• Legendary picks are genuinely rare and sharp</div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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

        {/* Divider */}
        <span className="text-slate-600 mx-2">|</span>

        {/* Source Filter */}
        <span className="text-xs text-slate-500 mr-1">Source:</span>
        <button
          onClick={() => setSourceFilter('all')}
          className={`h-6 px-2 text-[10px] font-semibold rounded transition-all ${sourceFilter === 'all'
            ? 'bg-slate-600 text-white ring-1 ring-white/30'
            : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          All
        </button>
        <button
          onClick={() => setSourceFilter('system')}
          className={`h-6 px-2 text-[10px] font-semibold rounded transition-all flex items-center gap-1 ${sourceFilter === 'system'
            ? 'bg-cyan-600/40 text-cyan-300 ring-1 ring-cyan-400/50'
            : 'bg-slate-800 text-slate-400 hover:text-cyan-300'
            }`}
        >
          <span>🤖</span>
          <span>AI</span>
        </button>
        <button
          onClick={() => setSourceFilter('manual')}
          className={`h-6 px-2 text-[10px] font-semibold rounded transition-all flex items-center gap-1 ${sourceFilter === 'manual'
            ? 'bg-purple-600/40 text-purple-300 ring-1 ring-purple-400/50'
            : 'bg-slate-800 text-slate-400 hover:text-purple-300'
            }`}
        >
          <span>👤</span>
          <span>Manual</span>
        </button>
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

              // Get live status for pending picks
              const liveStatus = pick.status === 'pending' ? getGameLiveStatus(pick) : null
              const statusDisplay = pick.status === 'won' ? { text: 'WON', icon: '✓', color: 'text-emerald-400' }
                : pick.status === 'lost' ? { text: 'LOST', icon: '✗', color: 'text-red-400' }
                  : pick.status === 'push' ? { text: 'PUSH', icon: '—', color: 'text-slate-400' }
                    : pick.status === 'cancelled' ? { text: 'VOID', icon: '⊘', color: 'text-slate-500' }
                      : liveStatus === 'live' ? { text: 'LIVE', icon: '🔴', color: 'text-amber-400' }
                        : liveStatus === 'stale' ? { text: 'STALE', icon: '⚠️', color: 'text-orange-400' }
                          : { text: 'SCHEDULED', icon: '📅', color: 'text-cyan-400' }

              // Determine source (system vs manual)
              const isSystemPick = pick.is_system_pick === true

              return (
                <Tooltip key={pick.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onPickClick?.(pick)}
                      className={`w-6 h-6 rounded cursor-pointer transition-all hover:scale-125 flex items-center justify-center relative ${liveStatus === 'live' ? 'animate-pulse' : ''}`}
                      style={style}
                    >
                      {/* Subtle checkmark for wins, X for losses */}
                      {pick.status === 'won' && (
                        <svg
                          className="w-3.5 h-3.5 opacity-70"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.9)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {pick.status === 'lost' && (
                        <svg
                          className="w-3 h-3 opacity-70"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.9)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                      {pick.status === 'push' && (
                        <svg
                          className="w-3 h-3 opacity-70"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.9)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                      {/* Source indicator - tiny dot in corner */}
                      <span
                        className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isSystemPick ? 'bg-cyan-400' : 'bg-purple-400'}`}
                        style={{ boxShadow: isSystemPick ? '0 0 3px rgba(34,211,238,0.8)' : '0 0 3px rgba(192,132,252,0.8)' }}
                      />
                    </button>
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
                        {/* Tier badge + Status + Source */}
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
                          <span className={`text-[10px] font-bold ${statusDisplay.color}`}>
                            {statusDisplay.icon} {statusDisplay.text}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${isSystemPick
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'}`}>
                            {isSystemPick ? '🤖 AI' : '👤 Manual'}
                          </span>
                        </div>

                        {/* Capper name */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-amber-400 uppercase">
                            {pick.capper}
                          </span>
                          {pick.units && (
                            <span className="text-[9px] text-slate-500">
                              {pick.units}U
                            </span>
                          )}
                        </div>

                        {/* Pick selection */}
                        <div className="font-bold text-white text-sm" style={{ textShadow: `0 0 10px ${rarity.glowColor}` }}>
                          {formatSelectionAbbrev(pick.selection)}
                        </div>

                        {/* Matchup with Score for graded picks */}
                        {(() => {
                          const awayAbbr = pick.game_snapshot?.away_team?.abbreviation || '???'
                          const homeAbbr = pick.game_snapshot?.home_team?.abbreviation || '???'
                          const finalScore = pick.result?.final_score || pick.games?.final_score

                          if (pick.status !== 'pending' && finalScore) {
                            // Calculate margin for won/lost picks
                            let marginText = ''
                            if (pick.status === 'won' || pick.status === 'lost') {
                              const actualTotal = (finalScore.away || 0) + (finalScore.home || 0)
                              const scoreDiff = (finalScore.away || 0) - (finalScore.home || 0) // away - home (negative means home won)

                              // Parse line from selection (e.g., "UNDER 243.5", "Lakers -4.5", "+3.5 LAL")
                              const lineMatch = pick.selection.match(/([+-]?\d+\.?\d*)/g)
                              const line = lineMatch ? parseFloat(lineMatch[lineMatch.length - 1]) : null

                              if (line !== null) {
                                if (pick.pick_type === 'total' || pick.selection.toUpperCase().includes('OVER') || pick.selection.toUpperCase().includes('UNDER')) {
                                  // TOTALS: margin = |line - actualTotal|
                                  const margin = Math.abs(line - actualTotal)
                                  marginText = pick.status === 'won'
                                    ? `Won by ${margin.toFixed(1)} pts`
                                    : `Lost by ${margin.toFixed(1)} pts`
                                } else if (pick.pick_type === 'spread' || line !== 0) {
                                  // SPREAD: Need to determine which team was picked
                                  const sel = pick.selection.toUpperCase()
                                  const awayName = (pick.game_snapshot?.away_team?.name || '').toUpperCase()
                                  const homeName = (pick.game_snapshot?.home_team?.name || '').toUpperCase()
                                  const awayAbbr = (pick.game_snapshot?.away_team?.abbreviation || '').toUpperCase()
                                  const homeAbbr = (pick.game_snapshot?.home_team?.abbreviation || '').toUpperCase()

                                  const pickedAway = sel.includes(awayName) || sel.includes(awayAbbr)
                                  const pickedHome = sel.includes(homeName) || sel.includes(homeAbbr)

                                  if (pickedAway || pickedHome) {
                                    // Spread is from picked team's perspective
                                    // If picked away: result = scoreDiff + line (away wins if > 0)
                                    // If picked home: result = -scoreDiff + line (home wins if > 0)
                                    const result = pickedAway
                                      ? scoreDiff + line  // away team cover
                                      : -scoreDiff + line // home team cover
                                    const margin = Math.abs(result)
                                    marginText = pick.status === 'won'
                                      ? `Won by ${margin.toFixed(1)} pts`
                                      : `Lost by ${margin.toFixed(1)} pts`
                                  }
                                }
                              }
                            }

                            // Show result with scores
                            const resultColor = pick.status === 'won' ? 'text-emerald-400'
                              : pick.status === 'lost' ? 'text-red-400'
                                : 'text-slate-400'
                            return (
                              <div>
                                <div className={`text-xs font-semibold ${resultColor}`}>
                                  {pick.status.toUpperCase()}: {awayAbbr} {finalScore.away} - {homeAbbr} {finalScore.home}
                                </div>
                                {marginText && (
                                  <div className={`text-[10px] font-bold ${pick.status === 'won' ? 'text-emerald-300' : 'text-red-300'}`}>
                                    {marginText}
                                  </div>
                                )}
                              </div>
                            )
                          } else {
                            // Pending - just show matchup
                            return (
                              <div className="text-slate-400 text-xs">
                                {awayAbbr} @ {homeAbbr}
                              </div>
                            )
                          }
                        })()}

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
                        {/* Tier Formula Breakdown - Pick Power Scoring */}
                        <div className="pt-1.5 mt-1.5 border-t border-slate-700/50">
                          <div className="text-[9px] text-slate-500 space-y-0.5">
                            {/* Show tier breakdown - handles both Pick Power and legacy formats */}
                            {pick.game_snapshot?.tier_grade ? (() => {
                              const tg = pick.game_snapshot.tier_grade as any
                              // Check if this is new Pick Power format (has edgePoints in breakdown)
                              const isPickPower = tg.breakdown?.edgePoints !== undefined

                              if (isPickPower) {
                                // New Pick Power Format (1-100 scale)
                                const { edgePoints = 0, specPoints = 0, streakPoints = 0, alignmentPoints = 0, alignmentPct = 0 } = tg.breakdown || {}
                                const pickPower = tg.confluenceScore ?? (edgePoints + specPoints + streakPoints + alignmentPoints)

                                return (
                                  <>
                                    <div className="flex justify-between">
                                      <span>⚡ Edge Strength:</span>
                                      <span className={edgePoints >= 25 ? 'text-green-400' : edgePoints >= 15 ? 'text-yellow-400' : 'text-slate-400'}>
                                        +{edgePoints.toFixed(1)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>🎯 {pick.pick_type?.toUpperCase() || 'BET'} Win Rate:</span>
                                      <span className={specPoints >= 10 ? 'text-green-400' : specPoints >= 5 ? 'text-yellow-400' : 'text-slate-400'}>
                                        +{specPoints.toFixed(1)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>🔥 Win Streak:</span>
                                      <span className={streakPoints >= 5 ? 'text-green-400' : streakPoints > 0 ? 'text-yellow-400' : 'text-slate-400'}>
                                        +{streakPoints.toFixed(1)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>🧩 Factor Alignment:</span>
                                      <span className={alignmentPoints >= 25 ? 'text-green-400' : alignmentPoints >= 10 ? 'text-yellow-400' : 'text-slate-400'}>
                                        +{alignmentPoints.toFixed(1)}
                                        <span className="text-slate-600 ml-0.5">({alignmentPct}%)</span>
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-700/50 pt-0.5 mt-0.5 font-semibold">
                                      <span>⚔️ Pick Power:</span>
                                      <span style={{ color: rarity.borderColor }}>{Math.round(pickPower)}</span>
                                    </div>
                                  </>
                                )
                              } else {
                                // Legacy Format
                                const sharpScore = tg.breakdown?.sharpScore ?? (tg.inputs?.baseConfidence ? tg.inputs.baseConfidence * 10 : (pick.confidence || 5) * 10)
                                return (
                                  <>
                                    <div className="text-[8px] text-amber-400/70 mb-0.5">Legacy format</div>
                                    <div className="flex justify-between">
                                      <span>📊 Sharp Score:</span>
                                      <span className="text-slate-300">{sharpScore.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-700/50 pt-0.5 mt-0.5 font-semibold">
                                      <span>⚔️ Pick Power:</span>
                                      <span style={{ color: rarity.borderColor }}>{(tg.tierScore || 0).toFixed(0)}</span>
                                    </div>
                                  </>
                                )
                              }
                            })() : (
                              <>
                                <div className="flex justify-between">
                                  <span>📊 Base Score:</span>
                                  <span className="text-slate-300">{((pick.confidence || 50) * 10).toFixed(0)}</span>
                                </div>
                                <div className="text-[8px] text-slate-600 mt-0.5 italic">
                                  Click for full tier breakdown →
                                </div>
                              </>
                            )}
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

