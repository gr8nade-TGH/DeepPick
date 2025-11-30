'use client'

import { useState, useEffect } from 'react'
import { Activity, Clock, Zap, Lock, Flame, Filter } from 'lucide-react'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'

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
        home_team: { name?: string; abbreviation?: string } | string
        away_team: { name?: string; abbreviation?: string } | string
        game_date: string
        game_time: string
        game_start_timestamp?: string
    }
    game?: {
        home_team: { name?: string; abbreviation?: string } | string
        away_team: { name?: string; abbreviation?: string } | string
        status: string
        game_start_timestamp?: string
    }
    games?: {
        status: string
        game_start_timestamp?: string
    }
}

interface CapperStats {
    capper: string
    display_name: string
    wins: number
    losses: number
    pushes: number
    net_units: number
    roi: number
    win_rate: number
}

// Featured/AI cappers with custom branding (optional overrides)
const FEATURED_CAPPERS: Record<string, { color: string; gradient: string; icon?: string }> = {
    'SHIVA': { color: 'bg-purple-500', gradient: 'from-purple-500 to-indigo-600', icon: '🔮' },
    'IFRIT': { color: 'bg-orange-500', gradient: 'from-orange-500 to-red-600', icon: '🔥' },
    'TITAN': { color: 'bg-cyan-500', gradient: 'from-cyan-500 to-blue-600', icon: '⚡' },
    'PICKSMITH': { color: 'bg-amber-500', gradient: 'from-amber-500 to-orange-600', icon: '⚒️' },
}

// Color palette for dynamic capper colors (vibrant, distinguishable)
const COLOR_PALETTE = [
    { bg: 'bg-rose-500', gradient: 'from-rose-500 to-pink-600' },
    { bg: 'bg-orange-500', gradient: 'from-orange-500 to-amber-600' },
    { bg: 'bg-amber-500', gradient: 'from-amber-500 to-yellow-600' },
    { bg: 'bg-lime-500', gradient: 'from-lime-500 to-green-600' },
    { bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-600' },
    { bg: 'bg-teal-500', gradient: 'from-teal-500 to-cyan-600' },
    { bg: 'bg-cyan-500', gradient: 'from-cyan-500 to-blue-600' },
    { bg: 'bg-blue-500', gradient: 'from-blue-500 to-indigo-600' },
    { bg: 'bg-indigo-500', gradient: 'from-indigo-500 to-purple-600' },
    { bg: 'bg-violet-500', gradient: 'from-violet-500 to-purple-600' },
    { bg: 'bg-purple-500', gradient: 'from-purple-500 to-pink-600' },
    { bg: 'bg-fuchsia-500', gradient: 'from-fuchsia-500 to-rose-600' },
    { bg: 'bg-pink-500', gradient: 'from-pink-500 to-rose-600' },
    { bg: 'bg-red-500', gradient: 'from-red-500 to-orange-600' },
    { bg: 'bg-sky-500', gradient: 'from-sky-500 to-blue-600' },
    { bg: 'bg-green-500', gradient: 'from-green-500 to-emerald-600' },
]

// Generate consistent hash from string
function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return Math.abs(hash)
}

// Get capper config dynamically
function getCapperConfig(capper: string): { color: string; gradient: string; initials: string; icon?: string } {
    const upper = capper?.toUpperCase() || ''

    // Check featured cappers first
    const featured = FEATURED_CAPPERS[upper]
    if (featured) {
        return {
            ...featured,
            initials: upper.slice(0, 2)
        }
    }

    // Generate dynamic config based on name hash
    const hash = hashString(upper)
    const colorIdx = hash % COLOR_PALETTE.length
    const palette = COLOR_PALETTE[colorIdx]

    // Generate smart initials
    let initials = ''
    const parts = capper.replace(/[-_]/g, ' ').split(' ').filter(Boolean)
    if (parts.length >= 2) {
        // Multi-word: take first letter of each word
        initials = parts.slice(0, 2).map(p => p[0]).join('').toUpperCase()
    } else {
        // Single word: take first 2 letters
        initials = (capper || '??').slice(0, 2).toUpperCase()
    }

    return {
        color: palette.bg,
        gradient: palette.gradient,
        initials
    }
}

interface PickData {
    capper: string
    selection: string
    units: number
    confidence: number
    pickId: string
}

interface SideData {
    selection: string
    picks: PickData[]
    avgUnits: number
    heatLevel: number
}

interface CellData {
    sides: SideData[] // Multiple sides if cappers disagree
    totalPicks: number
    isSplit: boolean // true if cappers disagree
}

interface GameRow {
    gameKey: string
    matchup: string
    gameTime: string
    homeTeam: string
    awayTeam: string
    spread: CellData | null
    total: CellData | null
    moneyline: CellData | null
    isUrgent?: boolean // Game starting soon (< 1hr)
}

type FilterType = 'all' | 'locks' | 'hot' | 'splits'

// Get countdown string
function getCountdown(gameDate: string | undefined): string {
    if (!gameDate) return ''
    const now = new Date()
    const game = new Date(gameDate)
    const diff = game.getTime() - now.getTime()
    if (diff < 0) return 'LIVE'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 24) return `${Math.floor(hours / 24)}d`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

// Get minutes until game starts (for urgency)
function getMinutesUntilGame(gameDate: string | undefined): number {
    if (!gameDate) return Infinity
    const now = new Date()
    const game = new Date(gameDate)
    return (game.getTime() - now.getTime()) / (1000 * 60)
}

// Helper to extract team abbreviation from various formats
function getTeamAbbrev(team: any): string {
    if (!team) return ''
    if (typeof team === 'string') return team.slice(0, 3).toUpperCase()
    return team.abbreviation || team.name?.slice(0, 3) || ''
}

// Build game rows from picks
function buildGameRows(picks: Pick[]): GameRow[] {
    const gameMap = new Map<string, { picks: Pick[]; gameTime: string; homeTeam: string; awayTeam: string; isLive: boolean }>()

    picks.forEach(pick => {
        // Try game_snapshot first, then game (from API transform), then games
        const snapshot = pick.game_snapshot
        const game = pick.game

        const home = getTeamAbbrev(snapshot?.home_team) || getTeamAbbrev(game?.home_team) || 'HOM'
        const away = getTeamAbbrev(snapshot?.away_team) || getTeamAbbrev(game?.away_team) || 'AWY'
        const gameKey = `${away}_${home}`.toUpperCase()

        const gameTime = snapshot?.game_start_timestamp || game?.game_start_timestamp || pick.games?.game_start_timestamp || ''
        const isLive = gameTime ? new Date(gameTime).getTime() < Date.now() : false

        if (!gameMap.has(gameKey)) {
            gameMap.set(gameKey, {
                picks: [],
                gameTime,
                homeTeam: home.toUpperCase(),
                awayTeam: away.toUpperCase(),
                isLive
            })
        }
        gameMap.get(gameKey)!.picks.push(pick)
    })

    const rows: GameRow[] = []

    gameMap.forEach((data, gameKey) => {
        // Filter picks by type (case-insensitive)
        const spreadPicks = data.picks.filter(p => p.pick_type?.toUpperCase() === 'SPREAD')
        const totalPicks = data.picks.filter(p => p.pick_type?.toUpperCase() === 'TOTAL')
        const mlPicks = data.picks.filter(p => p.pick_type?.toUpperCase() === 'MONEYLINE')

        // Normalize selection for grouping (handle case differences, extra spaces)
        const normalizeSelection = (sel: string): string => {
            return sel.trim().toUpperCase()
        }

        // Build cell with sides grouped by selection
        const buildCell = (cellPicks: Pick[]): CellData | null => {
            if (cellPicks.length === 0) return null

            // Group picks by normalized selection
            const sideMap = new Map<string, PickData[]>()
            cellPicks.forEach(p => {
                const key = normalizeSelection(p.selection)
                if (!sideMap.has(key)) {
                    sideMap.set(key, [])
                }
                sideMap.get(key)!.push({
                    capper: p.capper || 'Unknown',
                    selection: p.selection, // Keep original formatting
                    units: p.units,
                    confidence: p.confidence || 0,
                    pickId: p.id
                })
            })

            // Convert to sides array, sorted by count (most picks first)
            const sides: SideData[] = Array.from(sideMap.entries())
                .map(([key, picks]) => ({
                    selection: picks[0].selection, // Use first pick's formatting
                    picks,
                    avgUnits: picks.reduce((s, p) => s + p.units, 0) / picks.length,
                    heatLevel: Math.min(5, picks.length)
                }))
                .sort((a, b) => b.picks.length - a.picks.length)

            return {
                sides,
                totalPicks: cellPicks.length,
                isSplit: sides.length > 1
            }
        }

        // Check if game is starting soon (within 1 hour)
        const now = Date.now()
        const gameTimeMs = data.gameTime ? new Date(data.gameTime).getTime() : Infinity
        const hoursUntilGame = (gameTimeMs - now) / (1000 * 60 * 60)
        const isUrgent = hoursUntilGame > 0 && hoursUntilGame <= 1

        rows.push({
            gameKey,
            matchup: `${data.awayTeam} @ ${data.homeTeam}`,
            gameTime: data.gameTime,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            spread: buildCell(spreadPicks),
            total: buildCell(totalPicks),
            moneyline: buildCell(mlPicks),
            isUrgent
        })
    })

    // Sort: LIVE games at BOTTOM, then by game time (nearest first)
    return rows.sort((a, b) => {
        const now = Date.now()
        const aTime = a.gameTime ? new Date(a.gameTime).getTime() : Infinity
        const bTime = b.gameTime ? new Date(b.gameTime).getTime() : Infinity
        const aIsLive = aTime < now
        const bIsLive = bTime < now

        // LIVE games go to bottom
        if (aIsLive && !bIsLive) return 1
        if (!aIsLive && bIsLive) return -1

        // Within same category, sort by time (earliest first for upcoming, most recent first for live)
        if (aIsLive && bIsLive) {
            return bTime - aTime // Most recently started live games first
        }
        return aTime - bTime // Nearest upcoming games first
    })
}

// Heat indicator dot component
function HeatDot({ level }: { level: number }) {
    if (level === 0) return <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
    if (level === 1) return <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
    if (level === 2) return <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
    if (level === 3) return <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
    return <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
}

// Capper badge with hover card showing stats
function CapperBadge({
    capper,
    size = 'sm',
    stats,
    showHover = true
}: {
    capper: string
    size?: 'sm' | 'md'
    stats?: CapperStats
    showHover?: boolean
}) {
    const config = getCapperConfig(capper)
    const sizeClasses = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'
    const isFeatured = FEATURED_CAPPERS[capper?.toUpperCase()]

    return (
        <div className="relative group/badge">
            <span
                className={`
                    ${sizeClasses} ${config.color} rounded-full flex items-center justify-center
                    font-bold text-white shadow-md cursor-pointer hover:scale-110 transition-transform
                    ring-2 ring-transparent hover:ring-white/30
                    ${isFeatured ? 'ring-1 ring-white/20' : ''}
                `}
                title={capper}
            >
                {config.icon || config.initials}
            </span>

            {/* Hover Card */}
            {showHover && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/badge:opacity-100 pointer-events-none z-50 transition-all duration-200 scale-95 group-hover/badge:scale-100">
                    <div className={`bg-gradient-to-br ${config.gradient} rounded-lg px-3 py-2 shadow-xl border border-white/20 min-w-[120px]`}>
                        <div className="text-white font-bold text-xs mb-1 text-center truncate max-w-[100px]">{capper}</div>
                        {stats ? (
                            <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px] gap-2">
                                    <span className="text-white/70">Record</span>
                                    <span className="text-white font-semibold">{stats.wins}-{stats.losses}</span>
                                </div>
                                <div className="flex justify-between text-[10px] gap-2">
                                    <span className="text-white/70">Units</span>
                                    <span className={`font-semibold ${stats.net_units >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {stats.net_units >= 0 ? '+' : ''}{stats.net_units.toFixed(1)}u
                                    </span>
                                </div>
                                <div className="flex justify-between text-[10px] gap-2">
                                    <span className="text-white/70">ROI</span>
                                    <span className={`font-semibold ${stats.roi >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-white/60 text-center">Loading...</div>
                        )}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                    </div>
                </div>
            )}
        </div>
    )
}

// LOCK badge for 4+ capper consensus
function LockBadge({ capperCount, combinedRecord }: { capperCount: number; combinedRecord?: { wins: number; losses: number; netUnits: number } }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full shadow-lg shadow-amber-500/30 animate-pulse">
                <Lock className="w-3 h-3 text-amber-900" />
                <span className="text-[10px] font-black text-amber-900 uppercase tracking-wide">Lock</span>
            </div>
            {combinedRecord && (
                <div className="text-[10px] text-slate-400">
                    <span className="text-white font-semibold">{combinedRecord.wins}-{combinedRecord.losses}</span>
                    <span className="mx-1">•</span>
                    <span className={combinedRecord.netUnits >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {combinedRecord.netUnits >= 0 ? '+' : ''}{combinedRecord.netUnits.toFixed(1)}u
                    </span>
                </div>
            )}
        </div>
    )
}

// Cell content component
function PickCell({
    cell,
    picks,
    onPickClick,
    capperStats
}: {
    cell: CellData | null
    picks: Pick[]
    onPickClick: (pick: Pick) => void
    capperStats: Record<string, CapperStats>
}) {
    if (!cell) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60px]">
                <span className="text-slate-600 text-sm">—</span>
            </div>
        )
    }

    // Format the selection nicely
    const formatSelection = (sel: string) => {
        const totalMatch = sel.match(/^(OVER|UNDER|O|U)\s*([\d.]+)/i)
        if (totalMatch) {
            const direction = totalMatch[1].toUpperCase()
            const number = totalMatch[2]
            const fullDirection = (direction === 'O' || direction === 'OVER') ? 'Over' : 'Under'
            return `${fullDirection} ${number}`
        }
        return sel
    }

    // Calculate combined record for cappers on a side
    const getCombinedRecord = (sideCappers: PickData[]) => {
        let wins = 0, losses = 0, netUnits = 0
        sideCappers.forEach(p => {
            const stats = capperStats[p.capper.toUpperCase()]
            if (stats) {
                wins += stats.wins
                losses += stats.losses
                netUnits += stats.net_units
            }
        })
        return { wins, losses, netUnits }
    }

    // If split, show both sides SIDE BY SIDE in one row
    if (cell.isSplit) {
        return (
            <div className="relative">
                <div className="flex gap-1 rounded-lg border border-amber-500/30 bg-gradient-to-br from-slate-800/60 to-slate-900/40 overflow-hidden">
                    {cell.sides.slice(0, 2).map((side, idx) => {
                        const avgUnitsStr = side.avgUnits.toFixed(side.avgUnits % 1 === 0 ? 0 : 2)
                        const isWinning = idx === 0
                        return (
                            <div key={idx} className={`
                                flex-1 p-2.5 relative
                                ${idx === 0 ? 'border-r border-slate-700/50' : ''}
                                ${isWinning ? 'bg-slate-800/40' : 'bg-slate-900/30 opacity-80'}
                            `}>
                                <div className="flex items-center gap-0.5 mb-1.5 flex-wrap">
                                    {side.picks.slice(0, 3).map((p, i) => (
                                        <div key={i} onClick={() => {
                                            const pick = picks.find(pk => pk.id === p.pickId)
                                            if (pick) onPickClick(pick)
                                        }}>
                                            <CapperBadge
                                                capper={p.capper}
                                                stats={capperStats[p.capper.toUpperCase()]}
                                            />
                                        </div>
                                    ))}
                                    {side.picks.length > 3 && (
                                        <span className="text-[9px] text-slate-400">+{side.picks.length - 3}</span>
                                    )}
                                </div>
                                <div className={`text-xs font-semibold leading-tight ${isWinning ? 'text-white' : 'text-slate-400'}`}>
                                    {formatSelection(side.selection)}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    ({avgUnitsStr}u)
                                </div>
                                <div className="absolute -top-1 -right-1">
                                    <HeatDot level={side.heatLevel} />
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                    <span className="text-[8px] font-bold text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-amber-500/40 uppercase tracking-wider">⚡ Split</span>
                </div>
            </div>
        )
    }

    // Single consensus - all cappers agree
    const side = cell.sides[0]
    const avgUnitsStr = side.avgUnits.toFixed(side.avgUnits % 1 === 0 ? 0 : 2)
    const isLock = side.picks.length >= 4
    const combinedRecord = getCombinedRecord(side.picks)

    return (
        <div className="relative group">
            <div className={`
                rounded-lg p-3 border transition-all duration-200
                ${isLock
                    ? 'bg-gradient-to-br from-amber-900/40 via-yellow-900/30 to-slate-900/50 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : side.heatLevel >= 3
                        ? 'bg-gradient-to-br from-orange-900/30 to-slate-800/50 border-orange-500/30'
                        : side.heatLevel >= 2
                            ? 'bg-gradient-to-br from-yellow-900/20 to-slate-800/50 border-yellow-500/20'
                            : 'bg-slate-800/50 border-slate-700/50'}
            `}>
                {/* LOCK Badge for 4+ consensus */}
                {isLock && <LockBadge capperCount={side.picks.length} combinedRecord={combinedRecord} />}

                {/* Capper badges row */}
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {side.picks.slice(0, 6).map((p, i) => (
                        <div key={i} onClick={() => {
                            const pick = picks.find(pk => pk.id === p.pickId)
                            if (pick) onPickClick(pick)
                        }}>
                            <CapperBadge
                                capper={p.capper}
                                stats={capperStats[p.capper.toUpperCase()]}
                            />
                        </div>
                    ))}
                    {side.picks.length > 6 && (
                        <span className="text-[10px] text-slate-400 font-medium">+{side.picks.length - 6}</span>
                    )}
                </div>

                {/* Pick selection */}
                <div className={`text-sm font-semibold leading-tight ${isLock ? 'text-amber-100' : 'text-white'}`}>
                    {formatSelection(side.selection)}
                </div>

                {/* Units info */}
                <div className="text-[11px] text-slate-400 mt-1">
                    ({avgUnitsStr}u avg)
                </div>
            </div>

            {/* Heat dot indicator (top right) */}
            <div className="absolute -top-1 -right-1">
                {isLock ? (
                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/50 animate-pulse flex items-center justify-center">
                        <Lock className="w-2 h-2 text-amber-900" />
                    </div>
                ) : (
                    <HeatDot level={side.heatLevel} />
                )}
            </div>
        </div>
    )
}


export function PickGrid() {
    const [picks, setPicks] = useState<Pick[]>([])
    const [gameRows, setGameRows] = useState<GameRow[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
    const [selectedCapper, setSelectedCapper] = useState<string | undefined>(undefined)
    const [capperStats, setCapperStats] = useState<Record<string, CapperStats>>({})
    const [activeFilter, setActiveFilter] = useState<FilterType>('all')

    useEffect(() => {
        fetchPicks()
        fetchCapperStats()
    }, [])

    async function fetchPicks() {
        try {
            const response = await fetch('/api/picks?status=pending&limit=100&sort=confidence')
            const data = await response.json()

            if (data.success && data.data) {
                const now = new Date()
                const filtered = data.data.filter((pick: Pick) => {
                    const gameTime = pick.game_snapshot?.game_start_timestamp || pick.games?.game_start_timestamp
                    if (gameTime) {
                        const gameDate = new Date(gameTime)
                        const hoursSinceGame = (now.getTime() - gameDate.getTime()) / (1000 * 60 * 60)
                        return hoursSinceGame < 24
                    }
                    return true
                })

                setPicks(filtered)
                setGameRows(buildGameRows(filtered))
            }
        } catch (error) {
            console.error('Error fetching picks:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchCapperStats() {
        try {
            const response = await fetch('/api/leaderboard')
            const data = await response.json()
            if (data.success && data.data) {
                const statsMap: Record<string, CapperStats> = {}
                data.data.forEach((capper: CapperStats) => {
                    statsMap[capper.capper.toUpperCase()] = capper
                })
                setCapperStats(statsMap)
            }
        } catch (error) {
            console.error('Error fetching capper stats:', error)
        }
    }

    const handlePickClick = (pick: Pick) => {
        setSelectedPickId(pick.id)
        setSelectedCapper(pick.capper)
    }

    // Helper to get max heat level from a cell
    const getMaxHeat = (cell: CellData | null) => {
        if (!cell) return 0
        return Math.max(...cell.sides.map(s => s.heatLevel))
    }

    // Check if a cell qualifies as a "lock" (4+ cappers agree)
    const isLock = (cell: CellData | null) => {
        if (!cell || cell.isSplit) return false
        return cell.sides[0]?.picks.length >= 4
    }

    // Stats
    const totalPicks = picks.length
    const totalGames = gameRows.length
    const hotGames = gameRows.filter(g =>
        getMaxHeat(g.spread) >= 3 || getMaxHeat(g.total) >= 3
    ).length
    const lockCount = gameRows.filter(g => isLock(g.spread) || isLock(g.total)).length
    const splitGames = gameRows.filter(g =>
        g.spread?.isSplit || g.total?.isSplit
    ).length

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Activity className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        )
    }

    // Filter rows based on active filter
    const filteredRows = gameRows.filter(row => {
        if (activeFilter === 'all') return true
        if (activeFilter === 'locks') return isLock(row.spread) || isLock(row.total)
        if (activeFilter === 'hot') return getMaxHeat(row.spread) >= 3 || getMaxHeat(row.total) >= 3
        if (activeFilter === 'splits') return row.spread?.isSplit || row.total?.isSplit
        return true
    })

    return (
        <div className="min-h-screen bg-slate-950 pb-12">
            {/* Header */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <Zap className="w-8 h-8 text-cyan-400" />
                                <h1 className="text-2xl font-black text-white">Pick Grid</h1>
                            </div>
                            <p className="text-slate-400 text-sm">
                                Today's picks organized by game • Hover on badges for capper stats
                            </p>
                        </div>

                        {/* Legend - moved to right */}
                        <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <HeatDot level={2} /> 2
                            </span>
                            <span className="flex items-center gap-1.5">
                                <HeatDot level={3} /> 3
                            </span>
                            <span className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                                    <Lock className="w-2 h-2 text-amber-900" />
                                </div>
                                4+ Lock
                            </span>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 mb-4">
                        {[
                            { id: 'all' as FilterType, label: 'All', count: totalGames, icon: Filter },
                            { id: 'locks' as FilterType, label: 'Locks', count: lockCount, icon: Lock },
                            { id: 'hot' as FilterType, label: 'Hot', count: hotGames, icon: Flame },
                            { id: 'splits' as FilterType, label: 'Splits', count: splitGames, icon: Zap },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                                    ${activeFilter === tab.id
                                        ? tab.id === 'locks'
                                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-900 shadow-lg shadow-amber-500/20'
                                            : 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                    }
                                `}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                <span className={`
                                    text-xs px-1.5 py-0.5 rounded-full
                                    ${activeFilter === tab.id
                                        ? tab.id === 'locks' ? 'bg-amber-900/30' : 'bg-white/20'
                                        : 'bg-slate-700'
                                    }
                                `}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Stats bar */}
                    <div className="flex items-center gap-6 text-sm">
                        <span className="text-slate-400">
                            <span className="text-white font-bold">{totalGames}</span> games
                        </span>
                        <span className="text-slate-400">
                            <span className="text-cyan-400 font-bold">{totalPicks}</span> picks
                        </span>
                        {lockCount > 0 && (
                            <span className="text-slate-400">
                                <span className="text-amber-400 font-bold">{lockCount}</span> 🔒 locks
                            </span>
                        )}
                        <span className="text-slate-400">
                            <span className="text-green-400 font-bold">{hotGames}</span> 🔥 hot
                        </span>
                        {splitGames > 0 && (
                            <span className="text-slate-400">
                                <span className="text-amber-400 font-bold">{splitGames}</span> ⚡ splits
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid Table */}
            <div className="container mx-auto px-4 mt-6">
                {filteredRows.length === 0 ? (
                    <div className="text-center py-20">
                        <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">
                            {activeFilter === 'all'
                                ? 'No picks available today'
                                : `No ${activeFilter} picks available`}
                        </p>
                        {activeFilter !== 'all' && (
                            <button
                                onClick={() => setActiveFilter('all')}
                                className="mt-3 text-cyan-400 text-sm hover:underline"
                            >
                                View all picks →
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                        <table className="w-full border-collapse table-fixed">
                            <thead>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                    <th className="text-left py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider w-[200px]">
                                        Matchup
                                    </th>
                                    <th className="text-center py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider w-[calc((100%-200px)/2)]">
                                        <span className="flex items-center justify-center gap-2">
                                            📊 Spread
                                        </span>
                                    </th>
                                    <th className="text-center py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider w-[calc((100%-200px)/2)]">
                                        <span className="flex items-center justify-center gap-2">
                                            🎯 Total
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, idx) => {
                                    const countdown = getCountdown(row.gameTime)
                                    const isLive = countdown === 'LIVE'
                                    const minutesUntil = getMinutesUntilGame(row.gameTime)
                                    const isUrgent = minutesUntil > 0 && minutesUntil <= 60
                                    const hasLock = isLock(row.spread) || isLock(row.total)

                                    return (
                                        <tr
                                            key={row.gameKey}
                                            className={`
                                                border-b border-slate-800/50 transition-colors
                                                ${hasLock
                                                    ? 'bg-gradient-to-r from-amber-950/20 via-slate-900/30 to-amber-950/20'
                                                    : isLive
                                                        ? 'bg-red-950/20'
                                                        : isUrgent
                                                            ? 'bg-orange-950/10'
                                                            : idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10'
                                                }
                                                hover:bg-slate-800/50
                                            `}
                                        >
                                            {/* Matchup Cell */}
                                            <td className="py-5 px-5 align-top">
                                                <div className="flex items-center gap-2">
                                                    {hasLock && (
                                                        <span className="text-amber-400">🔒</span>
                                                    )}
                                                    <div className="font-bold text-white text-sm">
                                                        {row.matchup}
                                                    </div>
                                                </div>
                                                {countdown && (
                                                    <div className={`
                                                        text-xs mt-1.5 flex items-center gap-1.5 font-medium
                                                        ${isLive
                                                            ? 'text-red-400 animate-pulse'
                                                            : isUrgent
                                                                ? 'text-orange-400 animate-pulse'
                                                                : 'text-slate-500'
                                                        }
                                                    `}>
                                                        <Clock className="w-3 h-3" />
                                                        {isLive
                                                            ? '🔴 LIVE'
                                                            : isUrgent
                                                                ? `⏰ ${countdown} - ACT NOW!`
                                                                : countdown
                                                        }
                                                    </div>
                                                )}
                                            </td>

                                            {/* Spread Cell */}
                                            <td className="py-5 px-4 align-top">
                                                <PickCell
                                                    cell={row.spread}
                                                    picks={picks}
                                                    onPickClick={handlePickClick}
                                                    capperStats={capperStats}
                                                />
                                            </td>

                                            {/* Total Cell */}
                                            <td className="py-5 px-4 align-top">
                                                <PickCell
                                                    cell={row.total}
                                                    picks={picks}
                                                    onPickClick={handlePickClick}
                                                    capperStats={capperStats}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Insight Modal */}
            {selectedPickId && (
                <PickInsightModal
                    pickId={selectedPickId}
                    onClose={() => {
                        setSelectedPickId(null)
                        setSelectedCapper(undefined)
                    }}
                    capper={selectedCapper}
                />
            )}
        </div>
    )
}