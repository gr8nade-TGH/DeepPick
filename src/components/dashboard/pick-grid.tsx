'use client'

import { useState, useEffect } from 'react'
import { Activity, Clock, Zap } from 'lucide-react'
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

// Capper badge colors and initials
const CAPPER_CONFIG: Record<string, { color: string; initials: string }> = {
    'SHIVA': { color: 'bg-purple-500', initials: 'SH' },
    'IFRIT': { color: 'bg-orange-500', initials: 'IF' },
    'TITAN': { color: 'bg-cyan-500', initials: 'TI' },
    'THIEF': { color: 'bg-violet-500', initials: 'TH' },
    'SENTINEL': { color: 'bg-blue-500', initials: 'SE' },
    'PICKSMITH': { color: 'bg-amber-500', initials: 'PS' },
    'NEXUS': { color: 'bg-pink-500', initials: 'NX' },
    'CERBERUS': { color: 'bg-red-500', initials: 'CE' },
    'ATLAS': { color: 'bg-teal-500', initials: 'AT' },
    'ORACLE': { color: 'bg-emerald-500', initials: 'OR' },
    'GR8NADE': { color: 'bg-lime-500', initials: 'GR' },
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
}

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

// Get capper initials and color
function getCapperBadge(capper: string): { color: string; initials: string } {
    const upper = capper?.toUpperCase() || ''
    return CAPPER_CONFIG[upper] || { color: 'bg-slate-500', initials: capper?.slice(0, 2).toUpperCase() || '??' }
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

        rows.push({
            gameKey,
            matchup: `${data.awayTeam} @ ${data.homeTeam}`,
            gameTime: data.gameTime,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            spread: buildCell(spreadPicks),
            total: buildCell(totalPicks),
            moneyline: buildCell(mlPicks)
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

// Capper badge (circular with initials)
function CapperBadge({ capper, size = 'sm' }: { capper: string; size?: 'sm' | 'md' }) {
    const { color, initials } = getCapperBadge(capper)
    const sizeClasses = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'
    return (
        <span
            className={`${sizeClasses} ${color} rounded-full flex items-center justify-center font-bold text-white shadow-md cursor-pointer hover:scale-110 transition-transform`}
            title={capper}
        >
            {initials}
        </span>
    )
}

// Cell content component
function PickCell({
    cell,
    picks,
    onPickClick
}: {
    cell: CellData | null
    picks: Pick[]
    onPickClick: (pick: Pick) => void
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
        // For totals: "Over 231.5" or "Under 223.5"
        const totalMatch = sel.match(/(OVER|UNDER)\s*([\d.]+)/i)
        if (totalMatch) {
            return `${totalMatch[1].charAt(0).toUpperCase() + totalMatch[1].slice(1).toLowerCase()} ${totalMatch[2]}`
        }
        // For spreads: "LAL +3.5" or "BOS -4.5"
        return sel
    }

    // If split, show both sides
    if (cell.isSplit) {
        return (
            <div className="space-y-2">
                {cell.sides.map((side, idx) => {
                    const avgUnitsStr = side.avgUnits.toFixed(side.avgUnits % 1 === 0 ? 0 : 2)
                    const isWinning = idx === 0 // First side has more cappers
                    return (
                        <div key={idx} className="relative">
                            <div className={`
                                rounded-lg p-2.5 border transition-all duration-200
                                ${isWinning
                                    ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/50 border-slate-600/50'
                                    : 'bg-slate-900/30 border-slate-800/30 opacity-75'
                                }
                            `}>
                                {/* Capper badges */}
                                <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                                    {side.picks.slice(0, 4).map((p, i) => (
                                        <div key={i} onClick={() => {
                                            const pick = picks.find(pk => pk.id === p.pickId)
                                            if (pick) onPickClick(pick)
                                        }}>
                                            <CapperBadge capper={p.capper} />
                                        </div>
                                    ))}
                                    {side.picks.length > 4 && (
                                        <span className="text-[10px] text-slate-400">+{side.picks.length - 4}</span>
                                    )}
                                </div>
                                {/* Selection */}
                                <div className={`text-xs font-semibold leading-tight ${isWinning ? 'text-white' : 'text-slate-400'}`}>
                                    {formatSelection(side.selection)}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    ({avgUnitsStr}u)
                                </div>
                            </div>
                            {/* Heat dot for this side */}
                            <div className="absolute -top-1 -right-1">
                                <HeatDot level={side.heatLevel} />
                            </div>
                        </div>
                    )
                })}
                {/* Split indicator */}
                <div className="text-center">
                    <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider">⚡ Split</span>
                </div>
            </div>
        )
    }

    // Single consensus - all cappers agree
    const side = cell.sides[0]
    const avgUnitsStr = side.avgUnits.toFixed(side.avgUnits % 1 === 0 ? 0 : 2)

    return (
        <div className="relative group">
            {/* Cell background with gradient based on heat */}
            <div className={`
                rounded-lg p-3 border transition-all duration-200
                ${side.heatLevel >= 4 ? 'bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-500/40'
                    : side.heatLevel >= 3 ? 'bg-gradient-to-br from-orange-900/30 to-slate-800/50 border-orange-500/30'
                        : side.heatLevel >= 2 ? 'bg-gradient-to-br from-yellow-900/20 to-slate-800/50 border-yellow-500/20'
                            : 'bg-slate-800/50 border-slate-700/50'}
            `}>
                {/* Capper badges row */}
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {side.picks.slice(0, 5).map((p, i) => (
                        <div key={i} onClick={() => {
                            const pick = picks.find(pk => pk.id === p.pickId)
                            if (pick) onPickClick(pick)
                        }}>
                            <CapperBadge capper={p.capper} />
                        </div>
                    ))}
                    {side.picks.length > 5 && (
                        <span className="text-[10px] text-slate-400 font-medium">+{side.picks.length - 5}</span>
                    )}
                </div>

                {/* Pick selection */}
                <div className="text-sm font-semibold text-white leading-tight">
                    {formatSelection(side.selection)}
                </div>

                {/* Units info */}
                <div className="text-[11px] text-slate-400 mt-1">
                    ({avgUnitsStr}u avg)
                </div>
            </div>

            {/* Heat dot indicator (top right) */}
            <div className="absolute -top-1 -right-1">
                <HeatDot level={side.heatLevel} />
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

    useEffect(() => {
        fetchPicks()
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

    const handlePickClick = (pick: Pick) => {
        setSelectedPickId(pick.id)
        setSelectedCapper(pick.capper)
    }

    // Helper to get max heat level from a cell
    const getMaxHeat = (cell: CellData | null) => {
        if (!cell) return 0
        return Math.max(...cell.sides.map(s => s.heatLevel))
    }

    // Stats
    const totalPicks = picks.length
    const totalGames = gameRows.length
    const hotGames = gameRows.filter(g =>
        getMaxHeat(g.spread) >= 3 || getMaxHeat(g.total) >= 3
    ).length
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

    return (
        <div className="min-h-screen bg-slate-950 pb-12">
            {/* Header */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Zap className="w-8 h-8 text-cyan-400" />
                        <h1 className="text-2xl font-black text-white">Pick Grid</h1>
                    </div>
                    <p className="text-slate-400 text-sm">
                        Today's picks organized by game. More cappers = hotter consensus.
                    </p>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <HeatDot level={1} /> 1 capper
                        </span>
                        <span className="flex items-center gap-1.5">
                            <HeatDot level={2} /> 2 cappers
                        </span>
                        <span className="flex items-center gap-1.5">
                            <HeatDot level={3} /> 3 cappers
                        </span>
                        <span className="flex items-center gap-1.5">
                            <HeatDot level={4} /> 4+ cappers
                        </span>
                    </div>

                    {/* Stats bar */}
                    <div className="flex items-center gap-6 mt-4 text-sm">
                        <span className="text-slate-400">
                            <span className="text-white font-bold">{totalGames}</span> games
                        </span>
                        <span className="text-slate-400">
                            <span className="text-cyan-400 font-bold">{totalPicks}</span> picks
                        </span>
                        <span className="text-slate-400">
                            <span className="text-green-400 font-bold">{hotGames}</span> hot consensus
                        </span>
                        {splitGames > 0 && (
                            <span className="text-slate-400">
                                <span className="text-amber-400 font-bold">{splitGames}</span> split decisions
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid Table */}
            <div className="container mx-auto px-4 mt-6">
                {gameRows.length === 0 ? (
                    <div className="text-center py-20">
                        <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No picks available today</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                        <table className="w-full border-collapse table-fixed">
                            <thead>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                    <th className="text-left py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider w-[180px]">
                                        Matchup
                                    </th>
                                    <th className="text-center py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider w-[calc((100%-180px)/2)]">
                                        <span className="flex items-center justify-center gap-2">
                                            📊 Spread
                                        </span>
                                    </th>
                                    <th className="text-center py-4 px-5 text-xs font-bold text-slate-300 uppercase tracking-wider w-[calc((100%-180px)/2)]">
                                        <span className="flex items-center justify-center gap-2">
                                            🎯 Total
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {gameRows.map((row, idx) => {
                                    const countdown = getCountdown(row.gameTime)
                                    const isLive = countdown === 'LIVE'
                                    const hasSpread = !!row.spread
                                    const hasTotal = !!row.total

                                    return (
                                        <tr
                                            key={row.gameKey}
                                            className={`
                                                border-b border-slate-800/50 transition-colors
                                                ${isLive ? 'bg-red-950/20' : idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10'}
                                                hover:bg-slate-800/50
                                            `}
                                        >
                                            {/* Matchup Cell */}
                                            <td className="py-5 px-5 align-top">
                                                <div className="font-bold text-white text-sm">
                                                    {row.matchup}
                                                </div>
                                                {countdown && (
                                                    <div className={`text-xs mt-1.5 flex items-center gap-1.5 font-medium ${isLive
                                                        ? 'text-red-400 animate-pulse'
                                                        : 'text-slate-500'
                                                        }`}>
                                                        <Clock className="w-3 h-3" />
                                                        {isLive ? '🔴 LIVE' : countdown}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Spread Cell */}
                                            <td className="py-5 px-4 align-top">
                                                <PickCell
                                                    cell={row.spread}
                                                    picks={picks}
                                                    onPickClick={handlePickClick}
                                                />
                                            </td>

                                            {/* Total Cell */}
                                            <td className="py-5 px-4 align-top">
                                                <PickCell
                                                    cell={row.total}
                                                    picks={picks}
                                                    onPickClick={handlePickClick}
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