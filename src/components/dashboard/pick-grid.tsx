'use client'

import { useState, useEffect, useMemo } from 'react'
import { Activity, Clock, Zap, Flame, Filter, TrendingUp, BarChart3, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { getRarityTierFromConfidence, getRarityStyleFromTier, type RarityTier } from '@/lib/tier-grading'

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
    is_system_pick?: boolean
    game_snapshot?: {
        home_team: { name?: string; abbreviation?: string } | string
        away_team: { name?: string; abbreviation?: string } | string
        game_date: string
        game_time: string
        game_start_timestamp?: string
        tier_grade?: {
            tier: string
            tierScore: number
        }
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

// NBA Team name to abbreviation map (for normalizing selections)
// Includes alternate abbreviations from MySportsFeeds and other data sources
const NBA_TEAM_MAP: Record<string, string> = {
    // Full names -> abbreviations
    'ATLANTA HAWKS': 'ATL', 'HAWKS': 'ATL', 'ATLANTA': 'ATL',
    'BOSTON CELTICS': 'BOS', 'CELTICS': 'BOS', 'BOSTON': 'BOS',
    'BROOKLYN NETS': 'BKN', 'NETS': 'BKN', 'BROOKLYN': 'BKN', 'BRK': 'BKN',
    'CHARLOTTE HORNETS': 'CHA', 'HORNETS': 'CHA', 'CHARLOTTE': 'CHA', 'CHO': 'CHA',
    'CHICAGO BULLS': 'CHI', 'BULLS': 'CHI', 'CHICAGO': 'CHI',
    'CLEVELAND CAVALIERS': 'CLE', 'CAVALIERS': 'CLE', 'CAVS': 'CLE', 'CLEVELAND': 'CLE',
    'DALLAS MAVERICKS': 'DAL', 'MAVERICKS': 'DAL', 'MAVS': 'DAL', 'DALLAS': 'DAL',
    'DENVER NUGGETS': 'DEN', 'NUGGETS': 'DEN', 'DENVER': 'DEN',
    'DETROIT PISTONS': 'DET', 'PISTONS': 'DET', 'DETROIT': 'DET',
    'GOLDEN STATE WARRIORS': 'GSW', 'WARRIORS': 'GSW', 'GOLDEN STATE': 'GSW', 'GS': 'GSW',
    'HOUSTON ROCKETS': 'HOU', 'ROCKETS': 'HOU', 'HOUSTON': 'HOU',
    'INDIANA PACERS': 'IND', 'PACERS': 'IND', 'INDIANA': 'IND',
    'LOS ANGELES CLIPPERS': 'LAC', 'CLIPPERS': 'LAC', 'LA CLIPPERS': 'LAC', 'LOS': 'LAC',
    'LOS ANGELES LAKERS': 'LAL', 'LAKERS': 'LAL', 'LA LAKERS': 'LAL',
    'MEMPHIS GRIZZLIES': 'MEM', 'GRIZZLIES': 'MEM', 'MEMPHIS': 'MEM',
    'MIAMI HEAT': 'MIA', 'HEAT': 'MIA', 'MIAMI': 'MIA',
    'MILWAUKEE BUCKS': 'MIL', 'BUCKS': 'MIL', 'MILWAUKEE': 'MIL',
    'MINNESOTA TIMBERWOLVES': 'MIN', 'TIMBERWOLVES': 'MIN', 'WOLVES': 'MIN', 'MINNESOTA': 'MIN',
    'NEW ORLEANS PELICANS': 'NOP', 'PELICANS': 'NOP', 'NEW ORLEANS': 'NOP', 'NOR': 'NOP', 'NO': 'NOP',
    'NEW YORK KNICKS': 'NYK', 'KNICKS': 'NYK', 'NEW YORK': 'NYK', 'NY': 'NYK',
    'OKLAHOMA CITY THUNDER': 'OKC', 'THUNDER': 'OKC', 'OKLAHOMA CITY': 'OKC', 'OKLAHOMA': 'OKC',
    'ORLANDO MAGIC': 'ORL', 'MAGIC': 'ORL', 'ORLANDO': 'ORL',
    'PHILADELPHIA 76ERS': 'PHI', '76ERS': 'PHI', 'SIXERS': 'PHI', 'PHILADELPHIA': 'PHI',
    'PHOENIX SUNS': 'PHX', 'SUNS': 'PHX', 'PHOENIX': 'PHX', 'PHO': 'PHX',
    'PORTLAND TRAIL BLAZERS': 'POR', 'TRAIL BLAZERS': 'POR', 'BLAZERS': 'POR', 'PORTLAND': 'POR',
    'SACRAMENTO KINGS': 'SAC', 'KINGS': 'SAC', 'SACRAMENTO': 'SAC',
    'SAN ANTONIO SPURS': 'SAS', 'SPURS': 'SAS', 'SAN ANTONIO': 'SAS', 'SAN': 'SAS', 'SA': 'SAS',
    'TORONTO RAPTORS': 'TOR', 'RAPTORS': 'TOR', 'TORONTO': 'TOR',
    'UTAH JAZZ': 'UTA', 'JAZZ': 'UTA', 'UTAH': 'UTA',
    'WASHINGTON WIZARDS': 'WAS', 'WIZARDS': 'WAS', 'WASHINGTON': 'WAS',
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
    tier: RarityTier
    tierScore: number
    isSystemPick: boolean
}

interface SideData {
    selection: string
    picks: PickData[]
    avgUnits: number
    heatLevel: number
    maxTierScore: number // Highest tier score on this side
    bestTier: RarityTier // Best tier on this side
}

interface CellData {
    sides: SideData[] // Multiple sides if cappers disagree
    totalPicks: number
    isSplit: boolean // true if cappers disagree
    bestTierScore: number // Overall best tier score in this cell
}

// Get tier from pick
function getTierFromPick(pick: Pick): RarityTier {
    // Check for stored tier_grade first
    const tierGrade = pick.game_snapshot?.tier_grade
    if (tierGrade?.tier) {
        const storedTier = tierGrade.tier as string
        if (['Legendary', 'Elite', 'Epic', 'Rare', 'Uncommon', 'Common'].includes(storedTier)) {
            return storedTier === 'Epic' ? 'Elite' : storedTier as RarityTier
        }
    }
    // Fallback to confidence-based calculation
    return getRarityTierFromConfidence(pick.confidence || 0)
}

// Get tier score (for sorting)
function getTierScore(pick: Pick): number {
    const tierGrade = pick.game_snapshot?.tier_grade
    if (tierGrade?.tierScore) return tierGrade.tierScore
    // Convert confidence to approximate tier score (0-100)
    return Math.min(100, (pick.confidence || 0) * 10)
}

// Tier order for sorting (higher is better)
const TIER_ORDER: Record<RarityTier, number> = {
    'Legendary': 5,
    'Elite': 4,
    'Rare': 3,
    'Uncommon': 2,
    'Common': 1
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

        // Normalize team name to 3-letter abbreviation
        const normalizeTeamName = (name: string): string => {
            const upper = name.toUpperCase().trim()
            // Check if already an abbreviation (3 letters)
            if (upper.length <= 3) return upper
            // Look up in team map
            return NBA_TEAM_MAP[upper] || upper
        }

        // Normalize selection for grouping (convert team names to abbreviations)
        const normalizeSelection = (sel: string): string => {
            const upper = sel.trim().toUpperCase()
            // Handle OVER/UNDER totals - normalize direction
            const totalMatch = upper.match(/^(OVER|UNDER|O|U)\s*([\d.]+)/i)
            if (totalMatch) {
                const dir = (totalMatch[1] === 'O' || totalMatch[1] === 'OVER') ? 'OVER' : 'UNDER'
                return `${dir} ${totalMatch[2]}`
            }
            // Handle spreads like "DENVER +6.5" or "DEN +6.5"
            const spreadMatch = upper.match(/^(.+?)\s*([-+][\d.]+)$/)
            if (spreadMatch) {
                const teamName = normalizeTeamName(spreadMatch[1])
                return `${teamName} ${spreadMatch[2]}`
            }
            // Handle moneyline - just normalize team name
            return normalizeTeamName(upper)
        }

        // Format selection for display (convert to abbreviations)
        const formatSelectionForDisplay = (sel: string): string => {
            const upper = sel.trim().toUpperCase()
            // Handle OVER/UNDER totals
            const totalMatch = upper.match(/^(OVER|UNDER|O|U)\s*([\d.]+)/i)
            if (totalMatch) {
                const dir = (totalMatch[1] === 'O' || totalMatch[1] === 'OVER') ? 'Over' : 'Under'
                return `${dir} ${totalMatch[2]}`
            }
            // Handle spreads like "DENVER +6.5" or "DEN +6.5"
            const spreadMatch = upper.match(/^(.+?)\s*([-+][\d.]+)$/)
            if (spreadMatch) {
                const teamName = normalizeTeamName(spreadMatch[1])
                return `${teamName} ${spreadMatch[2]}`
            }
            // Handle moneyline - just normalize team name
            return normalizeTeamName(upper)
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
                const tier = getTierFromPick(p)
                const tierScore = getTierScore(p)
                sideMap.get(key)!.push({
                    capper: p.capper || 'Unknown',
                    selection: formatSelectionForDisplay(p.selection),
                    units: p.units,
                    confidence: p.confidence || 0,
                    pickId: p.id,
                    tier,
                    tierScore,
                    isSystemPick: p.is_system_pick === true
                })
            })

            // Convert to sides array, sorted by best tier first, then by count
            const sides: SideData[] = Array.from(sideMap.entries())
                .map(([key, picks]) => {
                    // Sort picks within side by tier (best first)
                    const sortedPicks = [...picks].sort((a, b) =>
                        TIER_ORDER[b.tier] - TIER_ORDER[a.tier] || b.tierScore - a.tierScore
                    )
                    const maxTierScore = Math.max(...picks.map(p => p.tierScore))
                    const bestTier = sortedPicks[0]?.tier || 'Common'
                    return {
                        selection: picks[0].selection,
                        picks: sortedPicks,
                        avgUnits: picks.reduce((s, p) => s + p.units, 0) / picks.length,
                        heatLevel: Math.min(5, picks.length),
                        maxTierScore,
                        bestTier
                    }
                })
                // Sort sides by best tier, then by pick count
                .sort((a, b) => TIER_ORDER[b.bestTier] - TIER_ORDER[a.bestTier] || b.picks.length - a.picks.length)

            const bestTierScore = Math.max(...sides.map(s => s.maxTierScore))

            return {
                sides,
                totalPicks: cellPicks.length,
                isSplit: sides.length > 1,
                bestTierScore
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

    // Get best tier score from a cell
    const getBestTierScore = (cell: CellData | null): number => {
        if (!cell) return 0
        return cell.bestTierScore || 0
    }

    // Sort: LIVE games at BOTTOM, then by best tier (highest first), then by game time
    return rows.sort((a, b) => {
        const now = Date.now()
        const aTime = a.gameTime ? new Date(a.gameTime).getTime() : Infinity
        const bTime = b.gameTime ? new Date(b.gameTime).getTime() : Infinity
        const aIsLive = aTime < now
        const bIsLive = bTime < now

        // LIVE games go to bottom
        if (aIsLive && !bIsLive) return 1
        if (!aIsLive && bIsLive) return -1

        // For non-live games, sort by best tier score (highest first)
        const aBestTier = Math.max(getBestTierScore(a.spread), getBestTierScore(a.total))
        const bBestTier = Math.max(getBestTierScore(b.spread), getBestTierScore(b.total))
        if (aBestTier !== bBestTier) {
            return bBestTier - aBestTier // Higher tier score first
        }

        // Within same tier, sort by time (earliest first for upcoming, most recent first for live)
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
    teamStats,
    team,
    showHover = true
}: {
    capper: string
    size?: 'sm' | 'md'
    stats?: CapperStats
    teamStats?: { wins: number; losses: number; netUnits: number } | null
    team?: string | null
    showHover?: boolean
}) {
    const config = getCapperConfig(capper)
    const sizeClasses = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'
    const isFeatured = FEATURED_CAPPERS[capper?.toUpperCase()]

    // Prefer team-specific stats if available
    const displayStats = teamStats || (stats ? { wins: stats.wins, losses: stats.losses, netUnits: stats.net_units } : null)
    const isTeamSpecific = !!teamStats

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

            {/* Hover Card - shows BELOW to prevent cutoff at top of cells */}
            {showHover && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover/badge:opacity-100 pointer-events-none z-[100] transition-all duration-200 scale-95 group-hover/badge:scale-100">
                    <div className={`bg-gradient-to-br ${config.gradient} rounded-lg px-3 py-2 shadow-xl border border-white/20 min-w-[130px]`}>
                        {/* Arrow pointing up */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white/20"></div>
                        <div className="text-white font-bold text-xs mb-1 text-center truncate max-w-[110px]">{capper}</div>
                        {displayStats ? (
                            <div className="space-y-0.5">
                                {/* Show team-specific label if available */}
                                {isTeamSpecific && team && (
                                    <div className="text-[9px] text-amber-300 text-center mb-1 font-medium">
                                        📊 {team} picks
                                    </div>
                                )}
                                <div className="flex justify-between text-[10px] gap-2">
                                    <span className="text-white/70">Record</span>
                                    <span className="text-white font-semibold">{displayStats.wins}-{displayStats.losses}</span>
                                </div>
                                <div className="flex justify-between text-[10px] gap-2">
                                    <span className="text-white/70">Units</span>
                                    <span className={`font-semibold ${displayStats.netUnits >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                        {displayStats.netUnits >= 0 ? '+' : ''}{displayStats.netUnits.toFixed(1)}u
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-white/60 text-center">No stats</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Heavy Agreement badge for 4+ capper consensus
function HeavyAgreementBadge({ capperCount, combinedRecord }: { capperCount: number; combinedRecord?: { wins: number; losses: number; netUnits: number } }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full shadow-lg shadow-amber-500/30 animate-pulse">
                <span className="text-[9px] font-black text-amber-900 uppercase tracking-wide">🔥 Heavy Agreement</span>
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

// Import shared TierSquare component
import { TierSquare } from '@/components/ui/tier-square'

// Get adaptive square size based on pick count
function getSquareSize(pickCount: number): 'sm' | 'md' | 'lg' {
    if (pickCount > 8) return 'sm'
    if (pickCount > 4) return 'md'
    return 'lg'
}

// Cell content component with tier squares
function PickCell({
    cell,
    picks,
    onPickClick,
    capperStats,
}: {
    cell: CellData | null
    picks: Pick[]
    onPickClick: (pick: Pick) => void
    capperStats: Record<string, CapperStats>
}) {
    if (!cell) {
        return (
            <div className="flex items-center justify-center h-full min-h-[80px]">
                <span className="text-slate-600 text-sm">—</span>
            </div>
        )
    }

    const totalPicksInCell = cell.sides.reduce((sum, s) => sum + s.picks.length, 0)
    const squareSize = getSquareSize(totalPicksInCell)
    const bestSideRarity = getRarityStyleFromTier(cell.sides[0]?.bestTier || 'Common')

    // Split picks - show side by side battle visualization
    if (cell.isSplit) {
        return (
            <div className="relative">
                <div
                    className="flex rounded-lg border overflow-hidden min-h-[100px]"
                    style={{
                        borderColor: `${bestSideRarity.borderColor}40`,
                        background: 'linear-gradient(135deg, rgba(30,30,45,0.8), rgba(20,20,35,0.9))'
                    }}
                >
                    {cell.sides.slice(0, 2).map((side, idx) => {
                        const sideRarity = getRarityStyleFromTier(side.bestTier)
                        const isLeading = idx === 0
                        const tierCounts = countTiers(side.picks)

                        return (
                            <div
                                key={idx}
                                className={`flex-1 p-3 flex flex-col ${idx === 0 ? 'border-r border-slate-700/50' : ''}`}
                                style={{
                                    background: isLeading
                                        ? `linear-gradient(135deg, ${sideRarity.borderColor}10, transparent)`
                                        : 'transparent'
                                }}
                            >
                                {/* Selection label */}
                                <div className={`text-xs font-bold mb-2 ${isLeading ? 'text-white' : 'text-slate-400'}`}>
                                    {side.selection}
                                </div>

                                {/* Tier squares grid */}
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {side.picks.map((p, i) => {
                                        const pick = picks.find(pk => pk.id === p.pickId)
                                        const stats = capperStats[p.capper.toUpperCase()]
                                        return (
                                            <TierSquare
                                                key={i}
                                                tier={p.tier}
                                                size={squareSize}
                                                onClick={() => pick && onPickClick(pick)}
                                                capperName={p.capper}
                                                selection={p.selection}
                                                units={p.units}
                                                isSystemPick={p.isSystemPick}
                                                capperRecord={stats ? { wins: stats.wins, losses: stats.losses, netUnits: stats.net_units } : undefined}
                                            />
                                        )
                                    })}
                                </div>

                                {/* Tier summary */}
                                <div className="mt-auto">
                                    <TierSummary counts={tierCounts} compact />
                                </div>
                            </div>
                        )
                    })}
                </div>
                {/* Split badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10">
                    <span className="text-[8px] font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded-full border border-amber-500/40 uppercase tracking-wider shadow-lg">
                        ⚔️ Split
                    </span>
                </div>
            </div>
        )
    }

    // Consensus - all picks on same side
    const side = cell.sides[0]
    const sideRarity = getRarityStyleFromTier(side.bestTier)
    const tierCounts = countTiers(side.picks)
    const isLock = side.picks.length >= 4

    return (
        <div
            className="rounded-lg p-3 border transition-all"
            style={{
                borderColor: isLock ? '#F59E0B' : `${sideRarity.borderColor}50`,
                background: isLock
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(30,30,45,0.9))'
                    : `linear-gradient(135deg, ${sideRarity.borderColor}10, rgba(20,20,35,0.9))`,
                boxShadow: isLock ? '0 0 15px rgba(245,158,11,0.2)' : `0 0 10px ${sideRarity.glowColor}`
            }}
        >
            {/* Lock badge */}
            {isLock && (
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black text-amber-900 bg-gradient-to-r from-amber-400 to-yellow-400 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                        🔥 {side.picks.length}x Agreement
                    </span>
                </div>
            )}

            {/* Selection */}
            <div className="text-sm font-bold text-white mb-2">
                {side.selection}
            </div>

            {/* Tier squares grid */}
            <div className="flex flex-wrap gap-1 mb-2">
                {side.picks.map((p, i) => {
                    const pick = picks.find(pk => pk.id === p.pickId)
                    const stats = capperStats[p.capper.toUpperCase()]
                    return (
                        <TierSquare
                            key={i}
                            tier={p.tier}
                            size={squareSize}
                            onClick={() => pick && onPickClick(pick)}
                            capperName={p.capper}
                            selection={p.selection}
                            units={p.units}
                            isSystemPick={p.isSystemPick}
                            capperRecord={stats ? { wins: stats.wins, losses: stats.losses, netUnits: stats.net_units } : undefined}
                        />
                    )
                })}
            </div>

            {/* Tier summary */}
            <TierSummary counts={tierCounts} />
        </div>
    )
}

// Count tiers in picks
function countTiers(picks: PickData[]): Record<RarityTier, number> {
    const counts: Record<RarityTier, number> = {
        'Legendary': 0, 'Elite': 0, 'Rare': 0, 'Uncommon': 0, 'Common': 0
    }
    picks.forEach(p => {
        counts[p.tier] = (counts[p.tier] || 0) + 1
    })
    return counts
}

// Tier summary component
function TierSummary({ counts, compact = false }: { counts: Record<RarityTier, number>, compact?: boolean }) {
    const tiers: RarityTier[] = ['Legendary', 'Elite', 'Rare', 'Uncommon', 'Common']
    const activeTiers = tiers.filter(t => counts[t] > 0)

    if (activeTiers.length === 0) return null

    return (
        <div className={`flex items-center gap-1 ${compact ? 'flex-wrap' : ''}`}>
            {activeTiers.map(tier => {
                const rarity = getRarityStyleFromTier(tier)
                return (
                    <span
                        key={tier}
                        className={`text-[9px] font-bold px-1 py-0.5 rounded ${compact ? '' : 'px-1.5'}`}
                        style={{
                            color: rarity.borderColor,
                            background: `${rarity.borderColor}20`,
                            border: `1px solid ${rarity.borderColor}40`
                        }}
                    >
                        {rarity.icon}{counts[tier]}
                    </span>
                )
            })}
        </div>
    )
}


// Type for team-specific stats: { [capperId]: { [team]: { wins, losses, netUnits } } }
type TeamStatsMap = Record<string, Record<string, { wins: number; losses: number; netUnits: number }>>

export function PickGrid() {
    const [picks, setPicks] = useState<Pick[]>([])
    const [gameRows, setGameRows] = useState<GameRow[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
    const [selectedCapper, setSelectedCapper] = useState<string | undefined>(undefined)
    const [capperStats, setCapperStats] = useState<Record<string, CapperStats>>({})
    const [teamStats, setTeamStats] = useState<TeamStatsMap>({})
    const [activeFilter, setActiveFilter] = useState<FilterType>('all')

    useEffect(() => {
        fetchPicks()
        fetchCapperStats()
        fetchTeamStats()
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
            const response = await fetch('/api/leaderboard?period=all')
            const data = await response.json()
            if (data.success && data.data) {
                const statsMap: Record<string, CapperStats> = {}
                data.data.forEach((entry: any) => {
                    // API returns 'id' and 'name', map to CapperStats format
                    const capperId = (entry.id || entry.capper || '').toUpperCase()
                    statsMap[capperId] = {
                        capper: capperId,
                        display_name: entry.name || entry.display_name || capperId,
                        wins: entry.wins || 0,
                        losses: entry.losses || 0,
                        pushes: entry.pushes || 0,
                        net_units: entry.netUnits ?? entry.net_units ?? 0,
                        roi: entry.roi || 0,
                        win_rate: entry.winRate ?? entry.win_rate ?? 0
                    }
                })
                console.log('[PickGrid] Loaded capper stats:', Object.keys(statsMap))
                setCapperStats(statsMap)
            }
        } catch (error) {
            console.error('Error fetching capper stats:', error)
        }
    }

    async function fetchTeamStats() {
        try {
            const response = await fetch('/api/cappers/team-stats')
            const data = await response.json()
            if (data.success && data.data) {
                setTeamStats(data.data)
                console.log('[PickGrid] Loaded team-specific stats for cappers:', Object.keys(data.data).length)
            }
        } catch (error) {
            console.error('Error fetching team stats:', error)
        }
    }

    // Helper to get team-specific stats for a capper
    const getTeamSpecificStats = (capper: string, team: string | null) => {
        if (!team) return null
        const capperTeams = teamStats[capper.toUpperCase()]
        if (!capperTeams) return null
        return capperTeams[team.toUpperCase()] || null
    }

    // Extract team from selection (e.g., "HOU -11.5" -> "HOU", "Over 235.5" -> null)
    const extractTeamFromSelection = (selection: string): string | null => {
        if (!selection) return null
        const upper = selection.trim().toUpperCase()
        // Check if it's a TOTAL (Over/Under) - no team
        if (upper.startsWith('OVER') || upper.startsWith('UNDER')) return null
        // Extract team abbreviation (first 2-3 letters before space)
        const match = upper.match(/^([A-Z]{2,3})\s/)
        return match ? match[1] : null
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

    // Count picks by tier
    const tierCounts = useMemo(() => {
        const counts: Record<RarityTier, number> = {
            'Legendary': 0, 'Elite': 0, 'Rare': 0, 'Uncommon': 0, 'Common': 0
        }
        picks.forEach(p => {
            const tier = getTierFromPick(p)
            counts[tier] = (counts[tier] || 0) + 1
        })
        return counts
    }, [picks])

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
        <TooltipProvider delayDuration={100}>
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
                                    Today's picks organized by game • Click tier squares for pick details
                                </p>
                            </div>

                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-2 mb-4">
                            {[
                                { id: 'all' as FilterType, label: 'All', count: totalGames, icon: Filter },
                                { id: 'locks' as FilterType, label: 'Agreement', count: lockCount, icon: Flame },
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

                        {/* Stats bar with tier legend */}
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-6 text-sm">
                                <span className="text-slate-400">
                                    <span className="text-white font-bold">{totalGames}</span> games
                                </span>
                                <span className="text-slate-400">
                                    <span className="text-cyan-400 font-bold">{totalPicks}</span> picks
                                </span>
                                {lockCount > 0 && (
                                    <span className="text-slate-400">
                                        <span className="text-amber-400 font-bold">{lockCount}</span> 🔥 agreement
                                    </span>
                                )}
                                {splitGames > 0 && (
                                    <span className="text-slate-400">
                                        <span className="text-amber-400 font-bold">{splitGames}</span> ⚔️ splits
                                    </span>
                                )}
                            </div>

                            {/* Tier Legend */}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Tiers:</span>
                                {(['Legendary', 'Elite', 'Rare', 'Uncommon', 'Common'] as RarityTier[]).map(tier => {
                                    const rarity = getRarityStyleFromTier(tier)
                                    const count = tierCounts[tier]
                                    if (count === 0) return null
                                    return (
                                        <div key={tier} className="flex items-center gap-1">
                                            <div
                                                className="w-4 h-4 rounded"
                                                style={{
                                                    background: `linear-gradient(135deg, ${rarity.borderColor}40, ${rarity.borderColor}20)`,
                                                    border: `2px solid ${rarity.borderColor}`,
                                                    boxShadow: `0 0 6px ${rarity.glowColor}`
                                                }}
                                            />
                                            <span
                                                className="text-[10px] font-bold"
                                                style={{ color: rarity.borderColor }}
                                            >
                                                {rarity.icon}{count}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid Table - Fixed height with scroll */}
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
                        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                            {/* Sticky header */}
                            <div className="bg-slate-800/80 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-700">
                                <div className="grid grid-cols-[200px_1fr_1fr]">
                                    <div className="py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        Matchup
                                    </div>
                                    <div className="py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
                                        📊 Spread
                                    </div>
                                    <div className="py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider text-center">
                                        🎯 Total
                                    </div>
                                </div>
                            </div>
                            {/* Scrollable body - max height with scroll */}
                            <div className="max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-hidden">
                                {filteredRows.map((row, idx) => {
                                    const countdown = getCountdown(row.gameTime)
                                    const isLive = countdown === 'LIVE'
                                    const minutesUntil = getMinutesUntilGame(row.gameTime)
                                    const isUrgent = minutesUntil > 0 && minutesUntil <= 60
                                    const hasLock = isLock(row.spread) || isLock(row.total)
                                    // Get best tier for row highlight
                                    const getBestTier = (cell: CellData | null): RarityTier => {
                                        if (!cell || cell.sides.length === 0) return 'Common'
                                        return cell.sides[0].bestTier
                                    }
                                    const rowBestTier = TIER_ORDER[getBestTier(row.spread)] > TIER_ORDER[getBestTier(row.total)]
                                        ? getBestTier(row.spread)
                                        : getBestTier(row.total)
                                    const rowRarity = getRarityStyleFromTier(rowBestTier)

                                    return (
                                        <div
                                            key={row.gameKey}
                                            className={`
                                            grid grid-cols-[200px_1fr_1fr] border-b border-slate-800/50 transition-colors
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
                                            style={{
                                                borderLeft: rowBestTier !== 'Common' ? `3px solid ${rowRarity.borderColor}40` : undefined
                                            }}
                                        >
                                            {/* Matchup Cell */}
                                            <div className="py-5 px-5">
                                                <div className="flex items-center gap-2">
                                                    {hasLock && (
                                                        <span className="text-amber-400">🔥</span>
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
                                                {/* Best tier badge */}
                                                {rowBestTier !== 'Common' && (
                                                    <div
                                                        className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                        style={{
                                                            color: rowRarity.borderColor,
                                                            background: `${rowRarity.borderColor}20`,
                                                            border: `1px solid ${rowRarity.borderColor}40`
                                                        }}
                                                    >
                                                        {rowRarity.icon} {rowBestTier}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Spread Cell */}
                                            <div className="py-5 px-4">
                                                <PickCell
                                                    cell={row.spread}
                                                    picks={picks}
                                                    onPickClick={handlePickClick}
                                                    capperStats={capperStats}
                                                />
                                            </div>

                                            {/* Total Cell */}
                                            <div className="py-5 px-4">
                                                <PickCell
                                                    cell={row.total}
                                                    picks={picks}
                                                    onPickClick={handlePickClick}
                                                    capperStats={capperStats}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
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
        </TooltipProvider>
    )
}