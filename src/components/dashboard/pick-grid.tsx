'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Flame, Users, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { useAuth } from '@/contexts/auth-context'

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
        home_team: any
        away_team: any
        game_date: string
        game_time: string
        game_start_timestamp?: string
    }
    games?: {
        status: string
        game_start_timestamp?: string
    }
}

interface ConsensusPick {
    key: string
    selection: string
    pick_type: string
    matchup: string
    gameTime: string
    cappers: { name: string; units: number; confidence: number; pickId: string }[]
    totalUnits: number
    avgConfidence: number
    heatLevel: number
    representativePick: Pick
}

function getCountdown(gameDate: string | undefined): string {
    if (!gameDate) return ''
    const now = new Date()
    const game = new Date(gameDate)
    const diff = game.getTime() - now.getTime()
    if (diff < 0) return 'LIVE'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

function getCapperColor(capper: string): string {
    const colors: Record<string, string> = {
        'SHIVA': 'bg-purple-600',
        'IFRIT': 'bg-orange-600',
        'TITAN': 'bg-slate-500',
        'THIEF': 'bg-violet-600',
        'SENTINEL': 'bg-blue-600',
        'PICKSMITH': 'bg-amber-500',
        'NEXUS': 'bg-pink-600',
        'CERBERUS': 'bg-red-600',
    }
    return colors[capper?.toUpperCase()] || 'bg-cyan-600'
}

function normalizeSelection(selection: string, pickType: string): string {
    if (pickType === 'TOTAL') {
        const match = selection.match(/(OVER|UNDER)\s*([\d.]+)/i)
        if (match) return `${match[1].toUpperCase()} ${match[2]}`
    }
    if (pickType === 'SPREAD') {
        const match = selection.match(/([A-Z]{2,3}|[A-Za-z]+)\s*([+-][\d.]+)/i)
        if (match) return `${match[1].toUpperCase()} ${match[2]}`
    }
    return selection.toUpperCase()
}

function groupPicksByConsensus(picks: Pick[]): ConsensusPick[] {
    const groups = new Map<string, Pick[]>()

    picks.forEach(pick => {
        const homeTeam = pick.game_snapshot?.home_team?.abbreviation || pick.game_snapshot?.home_team?.name || ''
        const awayTeam = pick.game_snapshot?.away_team?.abbreviation || pick.game_snapshot?.away_team?.name || ''
        const matchupKey = `${awayTeam}_${homeTeam}`.toUpperCase()
        const normalizedSelection = normalizeSelection(pick.selection, pick.pick_type)
        const key = `${matchupKey}_${pick.pick_type}_${normalizedSelection}`

        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(pick)
    })

    const consensusPicks: ConsensusPick[] = []

    groups.forEach((picks, key) => {
        const firstPick = picks[0]
        const homeTeam = firstPick.game_snapshot?.home_team
        const awayTeam = firstPick.game_snapshot?.away_team
        const matchup = `${awayTeam?.name || awayTeam?.abbreviation || 'Away'} @ ${homeTeam?.name || homeTeam?.abbreviation || 'Home'}`
        const gameTime = firstPick.game_snapshot?.game_start_timestamp || firstPick.games?.game_start_timestamp || ''

        const cappers = picks.map(p => ({
            name: p.capper || 'Unknown',
            units: p.units,
            confidence: p.confidence || 0,
            pickId: p.id
        }))

        const totalUnits = cappers.reduce((sum, c) => sum + c.units, 0)
        const avgConfidence = cappers.reduce((sum, c) => sum + c.confidence, 0) / cappers.length
        const heatLevel = Math.min(5, cappers.length)

        consensusPicks.push({
            key,
            selection: firstPick.selection,
            pick_type: firstPick.pick_type,
            matchup,
            gameTime,
            cappers,
            totalUnits,
            avgConfidence,
            heatLevel,
            representativePick: firstPick
        })
    })

    return consensusPicks.sort((a, b) => {
        if (b.heatLevel !== a.heatLevel) return b.heatLevel - a.heatLevel
        return b.avgConfidence - a.avgConfidence
    })
}

function HeatFlames({ level }: { level: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Flame
                    key={i}
                    className={`w-4 h-4 ${i <= level
                        ? level >= 4 ? 'text-red-500 fill-red-500'
                            : level >= 3 ? 'text-orange-500 fill-orange-500'
                                : level >= 2 ? 'text-yellow-500 fill-yellow-500'
                                    : 'text-slate-500 fill-slate-500'
                        : 'text-slate-700'
                        }`}
                />
            ))}
        </div>
    )
}


export function PickGrid() {
    const { user } = useAuth()
    const [picks, setPicks] = useState<Pick[]>([])
    const [consensusPicks, setConsensusPicks] = useState<ConsensusPick[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPick, setSelectedPick] = useState<Pick | null>(null)
    const [showInsight, setShowInsight] = useState(false)
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

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
                setConsensusPicks(groupPicksByConsensus(filtered))
            }
        } catch (error) {
            console.error('Error fetching picks:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleExpand = (key: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Activity className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white mb-2">🔥 Consensus Heat Map</h1>
                <p className="text-slate-400">
                    Picks grouped by consensus. More flames = more cappers agree.
                </p>
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-slate-500" /> 1 capper
                    </span>
                    <span className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-yellow-500 fill-yellow-500" /> 2 cappers
                    </span>
                    <span className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500 fill-orange-500" /> 3+ cappers
                    </span>
                    <span className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-red-500 fill-red-500" /> 4+ cappers
                    </span>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-white">{picks.length}</div>
                        <div className="text-xs text-slate-400">Total Picks</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-cyan-400">{consensusPicks.length}</div>
                        <div className="text-xs text-slate-400">Unique Picks</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-400">
                            {consensusPicks.filter(p => p.heatLevel >= 3).length}
                        </div>
                        <div className="text-xs text-slate-400">Hot Consensus (3+)</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-400">
                            {consensusPicks.filter(p => p.heatLevel >= 4).length}
                        </div>
                        <div className="text-xs text-slate-400">🔥 On Fire (4+)</div>
                    </CardContent>
                </Card>
            </div>

            {/* Consensus Pick Grid */}
            {consensusPicks.length === 0 ? (
                <div className="text-center py-20">
                    <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No picks available</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {consensusPicks.map(cp => {
                        const isExpanded = expandedCards.has(cp.key)
                        const countdown = getCountdown(cp.gameTime)

                        return (
                            <Card
                                key={cp.key}
                                className={`bg-gradient-to-br from-slate-900 to-slate-800 border transition-all duration-200 hover:scale-[1.02] ${cp.heatLevel >= 4 ? 'border-red-500/50 shadow-lg shadow-red-500/20'
                                        : cp.heatLevel >= 3 ? 'border-orange-500/50 shadow-lg shadow-orange-500/20'
                                            : cp.heatLevel >= 2 ? 'border-yellow-500/30'
                                                : 'border-slate-700'
                                    }`}
                            >
                                <CardContent className="p-4">
                                    {/* Top: Heat + Countdown */}
                                    <div className="flex items-center justify-between mb-3">
                                        <HeatFlames level={cp.heatLevel} />
                                        {countdown && (
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${countdown === 'LIVE' ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300'
                                                }`}>
                                                <Clock className="w-3 h-3 inline mr-1" />
                                                {countdown}
                                            </span>
                                        )}
                                    </div>

                                    {/* Selection - HERO */}
                                    <div className="text-xl font-black text-white mb-2 leading-tight">
                                        {cp.selection}
                                    </div>

                                    {/* Matchup + Type */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-sm text-slate-400">{cp.matchup}</span>
                                        <Badge variant="outline" className="text-[10px] border-slate-600">
                                            {cp.pick_type}
                                        </Badge>
                                    </div>

                                    {/* Consensus Summary */}
                                    <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg mb-3">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-cyan-400" />
                                            <span className="text-sm font-semibold text-white">
                                                {cp.cappers.length} {cp.cappers.length === 1 ? 'Capper' : 'Cappers'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="text-slate-400">
                                                Total: <span className="text-green-400 font-bold">{cp.totalUnits}u</span>
                                            </span>
                                            <span className="text-slate-400">
                                                Avg: <span className="text-cyan-400 font-bold">{cp.avgConfidence.toFixed(1)}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Capper Pills */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {cp.cappers.slice(0, isExpanded ? undefined : 4).map((capper, i) => (
                                            <span
                                                key={i}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getCapperColor(capper.name)}`}
                                            >
                                                {capper.name}
                                            </span>
                                        ))}
                                        {!isExpanded && cp.cappers.length > 4 && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-700">
                                                +{cp.cappers.length - 4} more
                                            </span>
                                        )}
                                    </div>

                                    {/* Expand/Collapse */}
                                    {cp.cappers.length > 1 && (
                                        <button
                                            onClick={() => toggleExpand(cp.key)}
                                            className="w-full text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 py-1"
                                        >
                                            {isExpanded ? (
                                                <>Hide Details <ChevronUp className="w-3 h-3" /></>
                                            ) : (
                                                <>Show Details <ChevronDown className="w-3 h-3" /></>
                                            )}
                                        </button>
                                    )}

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                                            {cp.cappers.map((capper, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5 cursor-pointer hover:bg-slate-700/50"
                                                    onClick={() => {
                                                        const pick = picks.find(p => p.id === capper.pickId)
                                                        if (pick) {
                                                            setSelectedPick(pick)
                                                            setShowInsight(true)
                                                        }
                                                    }}
                                                >
                                                    <span className={`px-2 py-0.5 rounded font-bold text-white ${getCapperColor(capper.name)}`}>
                                                        {capper.name}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-green-400">{capper.units}u</span>
                                                        <span className="text-cyan-400">{capper.confidence.toFixed(1)}</span>
                                                        <TrendingUp className="w-3 h-3 text-slate-500" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Insight Modal */}
            {selectedPick && (
                <PickInsightModal
                    pick={selectedPick}
                    isOpen={showInsight}
                    onClose={() => {
                        setShowInsight(false)
                        setSelectedPick(null)
                    }}
                    capper={selectedPick.capper}
                />
            )}
        </div>
    )
}