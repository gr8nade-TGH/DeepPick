"use client"
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { getFactorMeta } from '@/lib/cappers/shiva-v1/factor-registry'

// Manual pick insight data structure
interface ManualInsight {
  capper?: string
  pickType?: 'SPREAD' | 'TOTAL'
  selection?: string
  units?: number
  betTypeRecord?: {
    wins: number
    losses: number
    pushes: number
    total: number
    winPct: number
    netUnits: number
  }
  streak?: { type: 'W' | 'L' | 'none'; count: number }
  matchupRecord?: {
    wins: number
    losses: number
    pushes: number
    total: number
    winPct: number
    netUnits: number
  } | null
  lastMatchupPick?: {
    selection: string
    result: 'won' | 'lost' | 'push'
    date: string
    netUnits: number
  } | null
  spread?: {
    teamRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    lastTeamPick?: { selection: string; result: string; date: string; netUnits: number } | null
    homeRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    awayRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    favoriteRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    underdogRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
  }
  totals?: {
    overRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    underRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    teamGamesRecord?: { wins: number; losses: number; pushes: number; total: number; winPct: number; netUnits: number }
    lastTeamGamePick?: { selection: string; result: string; date: string; netUnits: number } | null
  }
  generatedAt?: string
}

export interface InsightCardProps {
  capper: string
  capperIconUrl?: string
  sport: 'NBA' | 'MLB' | 'NFL'
  gameId: string
  pickId?: string | null  // Only present for generated picks (not PASS)
  generatedAt: string
  is_system_pick?: boolean  // True for generated picks, false for manual picks
  manual_insight?: ManualInsight  // Capper stats for manual picks
  matchup: {
    away: string | { name: string; abbreviation: string }
    home: string | { name: string; abbreviation: string }
    spreadText: string
    totalText: string
    gameDateLocal: string
  }
  pick: {
    type: 'SPREAD' | 'MONEYLINE' | 'TOTAL' | 'RUN_LINE'
    selection: string
    units: number
    confidence: number
    edgeRaw?: number
    edgePct?: number
    confScore?: number
    locked_odds?: {
      total_line?: number
      spread_team?: string
      spread_line?: number
      ml_home?: number
      ml_away?: number
    } | null
    locked_at?: string | null
  }
  predictedScore: {
    away: number
    home: number
    winner: string
  }
  writeups: {
    prediction: string
    gamePrediction: string
    bold?: string
  }
  bold_predictions?: {
    predictions: Array<{
      player: string
      team: string
      prediction: string
      reasoning: string
      confidence: string
    }>
    summary: string
  } | null
  injury_summary?: {
    findings: Array<{
      team: string
      player: string
      status: string
      impact: number
    }>
    total_impact: number
    summary: string
  } | null
  factors: Array<{
    key: string
    label: string
    icon: string
    overScore: number
    underScore: number
    weightAppliedPct: number
    rationale?: string
  }>
  market: {
    conf7: number
    confAdj: number
    confFinal: number
    dominant: 'side' | 'total'
  }
  results?: {
    status: 'pending' | 'win' | 'loss' | 'push'
    finalScore?: { away: number; home: number }
    postMortem?: string
    factorAccuracy?: Array<{
      factor_key: string
      factor_name: string
      contribution: number
      was_correct: boolean
      accuracy_score: number
      impact: 'high' | 'medium' | 'low'
      reasoning: string
    }>
    tuningSuggestions?: Array<{
      factor_key: string
      current_weight: number
      suggested_weight: number
      reasoning: string
      confidence: number
    }>
    overallAccuracy?: number
  }
  // NEW: Tier grading inputs (for comprehensive tier calculation)
  tierGradeInputs?: {
    teamRecord?: { wins: number; losses: number; netUnits: number }
    last7DaysRecord?: { wins: number; losses: number; netUnits: number }
  }
  // NEW: Pre-calculated tier (if already computed and stored)
  computedTier?: {
    tier: RarityTier
    tierScore: number
    bonuses: { units: number; teamRecord: number; hotStreak: number }
  }
  onClose: () => void
}

// =====================================================
// COMPREHENSIVE TIER GRADING SYSTEM
// Re-export from shared lib for backwards compatibility
// =====================================================
import {
  calculateTierGrade,
  getRarityFromConfidence,
  getRarityStyleFromTier,
  getRarityTierFromConfidence,
  type RarityTier,
  type RarityStyle,
  type TierGradeInput,
  type TierGradeResult
} from '@/lib/tier-grading'

// Re-export for backwards compatibility
export { calculateTierGrade, getRarityFromConfidence, getRarityStyleFromTier, getRarityTierFromConfidence }
export type { RarityTier, RarityStyle, TierGradeInput, TierGradeResult }

/**
 * Legacy function for backward compatibility - returns RarityStyle for display
 * Use calculateTierGrade() for new implementations
 */
export function getRarityStyleFromConfidence(confidence: number): RarityStyle {
  // Simple confidence-only grading (legacy)
  if (confidence >= 85) {
    return getRarityStyleFromTier('Legendary')
  } else if (confidence >= 75) {
    return getRarityStyleFromTier('Epic')
  } else if (confidence >= 65) {
    return getRarityStyleFromTier('Rare')
  } else if (confidence >= 55) {
    return getRarityStyleFromTier('Uncommon')
  } else {
    return getRarityStyleFromTier('Common')
  }
}

// Capper branding configuration - Known cappers with custom branding
const KNOWN_CAPPER_BRANDING: Record<string, { icon: string; color: string; gradient: string }> = {
  'SHIVA': { icon: '🔱', color: 'cyan', gradient: 'from-blue-600 to-cyan-700' },
  'IFRIT': { icon: '🔥', color: 'orange', gradient: 'from-orange-600 to-red-700' },
  'SENTINEL': { icon: '🛡️', color: 'blue', gradient: 'from-blue-600 to-indigo-700' },
  'NEXUS': { icon: '🔷', color: 'purple', gradient: 'from-purple-600 to-pink-700' },
  'BLITZ': { icon: '⚡', color: 'yellow', gradient: 'from-yellow-600 to-orange-700' },
  'TITAN': { icon: '🏔️', color: 'gray', gradient: 'from-gray-600 to-slate-700' },
  'THIEF': { icon: '🎭', color: 'violet', gradient: 'from-violet-600 to-purple-700' },
  'CERBERUS': { icon: '🐺', color: 'red', gradient: 'from-red-600 to-orange-700' },
  'DEEPPICK': { icon: '🎯', color: 'blue', gradient: 'from-blue-600 to-cyan-700' },
  'PICKSMITH': { icon: '⚒️', color: 'amber', gradient: 'from-amber-500 to-orange-600' },
  'GR8NADE': { icon: '💎', color: 'lime', gradient: 'from-lime-500 to-green-600' },
  'MARSHAL-HARRIS': { icon: '🎖️', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' }
}

// Dynamic branding generator for new/unknown cappers
function getCapperBranding(capperName: string): { icon: string; color: string; gradient: string } {
  const upperName = capperName.toUpperCase()

  // Return known branding if available
  if (KNOWN_CAPPER_BRANDING[upperName]) {
    return KNOWN_CAPPER_BRANDING[upperName]
  }

  // Generate dynamic branding for new cappers based on name hash
  const colorPalettes = [
    { color: 'emerald', gradient: 'from-emerald-600 to-green-700', icon: '💎' },
    { color: 'violet', gradient: 'from-violet-600 to-purple-700', icon: '⚡' },
    { color: 'amber', gradient: 'from-amber-600 to-yellow-700', icon: '⭐' },
    { color: 'rose', gradient: 'from-rose-600 to-pink-700', icon: '🌟' },
    { color: 'indigo', gradient: 'from-indigo-600 to-blue-700', icon: '🎲' },
    { color: 'teal', gradient: 'from-teal-600 to-cyan-700', icon: '🎯' },
    { color: 'fuchsia', gradient: 'from-fuchsia-600 to-pink-700', icon: '✨' },
    { color: 'lime', gradient: 'from-lime-600 to-green-700', icon: '🍀' }
  ]

  // Simple hash function to consistently assign colors based on capper name
  const hash = upperName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const paletteIndex = hash % colorPalettes.length

  return colorPalettes[paletteIndex]
}

// Stat Block component for manual picks - PICKSMITH style
function StatBlock({ label, value, subValue, positive, icon }: {
  label: string
  value: string
  subValue?: string
  positive?: boolean | null
  icon?: string
}) {
  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 text-center hover:border-slate-600 transition-all">
      <div className="text-2xl font-black mb-1">
        <span className={`${positive === true ? 'text-emerald-400' :
          positive === false ? 'text-red-400' :
            'text-white'
          }`}>
          {value}
        </span>
      </div>
      <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      {subValue && (
        <div className={`text-[10px] font-medium mt-0.5 ${positive === true ? 'text-emerald-300' :
          positive === false ? 'text-red-300' :
            'text-slate-500'
          }`}>
          {subValue}
        </div>
      )}
    </div>
  )
}

// Format record with color-coded units
function formatRecord(record: { wins: number; losses: number; pushes?: number; netUnits?: number } | undefined | null) {
  if (!record || record.wins + record.losses === 0) return { text: 'No picks', units: null }
  const text = record.pushes && record.pushes > 0
    ? `${record.wins}-${record.losses}-${record.pushes}`
    : `${record.wins}-${record.losses}`
  const units = record.netUnits !== undefined ? record.netUnits : null
  return { text, units }
}

// =====================================================
// PICKSMITH CUSTOM INSIGHT CARD
// =====================================================
function PicksmithInsightCard({ props, consensus }: {
  props: InsightCardProps
  consensus?: {
    contributingCappers: Array<{ id: string; name: string; units: number; netUnits: number }>
    contributorPicks: Array<{ capper: string; selection: string; units: number; confidence: number }>
    consensusType: 'STRONG' | 'STANDARD'
  }
}) {
  const cappers = consensus?.contributingCappers || []
  const totalUnits = cappers.reduce((sum, c) => sum + c.units, 0)
  const avgUnits = cappers.length > 0 ? (totalUnits / cappers.length).toFixed(1) : '0'
  const totalRecord = cappers.reduce((sum, c) => sum + c.netUnits, 0)
  const consensusStrength = cappers.length >= 4 ? 'UNANIMOUS' : cappers.length >= 3 ? 'STRONG' : 'STANDARD'

  // Format team names
  const awayTeam = props.matchup?.away
  const homeTeam = props.matchup?.home
  const awayName = typeof awayTeam === 'object' ? awayTeam?.name : awayTeam
  const homeName = typeof homeTeam === 'object' ? homeTeam?.name : homeTeam
  const awayAbbr = typeof awayTeam === 'object' ? awayTeam?.abbreviation : awayTeam?.substring(0, 3)
  const homeAbbr = typeof homeTeam === 'object' ? homeTeam?.abbreviation : homeTeam?.substring(0, 3)

  const formatLocalDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'Unknown Date'
    }
  }

  const formatLocalTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return 'Unknown Time'
    }
  }

  // Get result info
  const status = props.results?.status || 'pending'
  const finalScore = props.results?.finalScore

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 rounded-2xl shadow-2xl border-2 border-amber-500/40 max-w-lg w-full max-h-[90vh] overflow-y-auto">

        {/* ===== PICKSMITH HEADER ===== */}
        <div className="bg-gradient-to-r from-amber-900/60 via-amber-800/40 to-amber-900/60 p-5 rounded-t-2xl border-b-2 border-amber-500/40 relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-400 via-transparent to-transparent"></div>
          </div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center border-2 border-amber-400 shadow-lg shadow-amber-500/30">
                <span className="text-3xl">⚒️</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-amber-100">PICKSMITH</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-amber-950">
                    CONSENSUS
                  </span>
                </div>
                <div className="text-amber-300/80 text-xs font-medium">
                  The Forge of Sharp Picks
                </div>
              </div>
            </div>
            <button
              onClick={props.onClose}
              className="text-amber-300 hover:text-white transition-colors p-2 hover:bg-amber-500/20 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ===== THE PICK - Hero Section ===== */}
        <div className="p-6 bg-gradient-to-b from-slate-800/80 to-slate-900/80 text-center border-b border-amber-500/20">
          <div className="text-4xl font-black text-white mb-2">
            {props.pick?.units || 0} UNITS on {props.pick?.selection}
          </div>
          <div className="text-amber-300 font-semibold text-sm mb-3">
            {awayAbbr} @ {homeAbbr}
          </div>
          <div className="text-slate-400 text-xs">
            📅 {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)} • ⏰ {formatLocalTime(props.matchup?.gameDateLocal || props.generatedAt)}
          </div>
        </div>

        {/* ===== CONSENSUS STRENGTH BADGE ===== */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-800/50 via-amber-900/20 to-slate-800/50 border-b border-amber-500/20">
          <div className="flex items-center justify-center gap-3">
            <div className={`
              px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2
              ${consensusStrength === 'UNANIMOUS' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                consensusStrength === 'STRONG' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                  'bg-slate-500/20 text-slate-300 border border-slate-500/40'}
            `}>
              {consensusStrength === 'UNANIMOUS' ? '🔥' : consensusStrength === 'STRONG' ? '⚡' : '✓'}
              <span>{consensusStrength} CONSENSUS</span>
              <span className="text-xs opacity-75">({cappers.length}v0)</span>
            </div>
          </div>
        </div>

        {/* ===== CONTRIBUTING CAPPERS GRID ===== */}
        <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-amber-500/20">
          <div className="text-xs font-bold text-amber-400 uppercase mb-4 flex items-center gap-2">
            <span>🎯</span>
            <span>CONTRIBUTING CAPPERS</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {cappers.map((capper, idx) => {
              const capperBranding = KNOWN_CAPPER_BRANDING[capper.name] || getCapperBranding(capper.name)
              return (
                <div
                  key={capper.id}
                  className={`bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-xl p-4 border border-slate-600/50 hover:border-${capperBranding.color}-500/50 transition-all hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${capperBranding.gradient} rounded-full flex items-center justify-center text-lg shadow-md`}>
                      {capperBranding.icon}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{capper.name}</div>
                      <div className={`text-xs ${capper.netUnits >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {capper.netUnits >= 0 ? '+' : ''}{capper.netUnits.toFixed(1)}u record
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400 text-xs">Bet Size</span>
                    <span className="text-amber-400 font-bold">{capper.units}u</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ===== CONSENSUS STATS ===== */}
        <div className="p-5 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-b border-amber-500/20">
          <div className="text-xs font-bold text-amber-400 uppercase mb-4 flex items-center gap-2">
            <span>📊</span>
            <span>CONSENSUS STATS</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/80 rounded-xl p-4 text-center border border-slate-700/50">
              <div className="text-2xl font-black text-white">{cappers.length}</div>
              <div className="text-xs text-slate-400 mt-1">Cappers Agree</div>
            </div>
            <div className="bg-slate-800/80 rounded-xl p-4 text-center border border-slate-700/50">
              <div className="text-2xl font-black text-amber-400">{avgUnits}u</div>
              <div className="text-xs text-slate-400 mt-1">Avg Bet Size</div>
            </div>
            <div className="bg-slate-800/80 rounded-xl p-4 text-center border border-slate-700/50">
              <div className={`text-2xl font-black ${totalRecord >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalRecord >= 0 ? '+' : ''}{totalRecord.toFixed(1)}u
              </div>
              <div className="text-xs text-slate-400 mt-1">Combined Record</div>
            </div>
          </div>
        </div>

        {/* ===== WHY THIS PICK ===== */}
        <div className="p-5 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-b border-amber-500/20">
          <div className="text-xs font-bold text-amber-400 uppercase mb-3 flex items-center gap-2">
            <span>💡</span>
            <span>WHY THIS PICK?</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
            <p className="text-slate-300 text-sm leading-relaxed">
              PICKSMITH identified <span className="text-amber-400 font-semibold">{consensusStrength.toLowerCase()} consensus</span> among {cappers.length} profitable system cappers.
              When multiple independent AI models with proven track records arrive at the same conclusion, it signals a <span className="text-amber-400 font-semibold">high-value opportunity</span>.
            </p>
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="text-slate-400 text-xs">
                Combined conviction: <span className="text-white font-semibold">{totalUnits}u</span> across all contributing cappers
              </p>
            </div>
          </div>
        </div>

        {/* ===== RESULT (if available) ===== */}
        {status !== 'pending' && (
          <div className={`p-5 ${status === 'win' ? 'bg-emerald-900/30' : status === 'loss' ? 'bg-red-900/30' : 'bg-yellow-900/30'} border-b border-amber-500/20`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-3xl ${status === 'win' ? 'text-emerald-400' : status === 'loss' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {status === 'win' ? '✅' : status === 'loss' ? '❌' : '🤝'}
                </div>
                <div>
                  <div className={`text-lg font-black ${status === 'win' ? 'text-emerald-400' : status === 'loss' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {status.toUpperCase()}
                  </div>
                  {finalScore && (
                    <div className="text-slate-400 text-sm">
                      Final: {finalScore.away} - {finalScore.home}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div className="p-4 bg-slate-900/80 rounded-b-2xl flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            Pick Generated: {formatLocalDate(props.generatedAt)} at {formatLocalTime(props.generatedAt)}
          </div>
          <button
            onClick={props.onClose}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function InsightCard(props: InsightCardProps) {
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null)
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false)

  // Early return if no data
  if (!props || !props.factors) {
    return (
      <div className="border rounded-lg shadow-lg bg-white max-w-4xl mx-auto p-4">
        <div className="text-gray-500">No card data available</div>
      </div>
    )
  }

  console.debug('InsightCard props', { props })

  // ===== PICKSMITH CUSTOM INSIGHT CARD =====
  const isPicksmith = (props.capper || '').toUpperCase() === 'PICKSMITH'
  const consensus = (props as any).consensus as {
    contributingCappers: Array<{ id: string; name: string; units: number; netUnits: number }>
    contributorPicks: Array<{ capper: string; selection: string; units: number; confidence: number }>
    consensusType: 'STRONG' | 'STANDARD'
  } | undefined

  if (isPicksmith) {
    return <PicksmithInsightCard props={props} consensus={consensus} />
  }

  // Check if this is a manual pick
  const isManualPick = props.is_system_pick === false
  const manualInsight = props.manual_insight

  // Get capper branding (dynamic for new cappers)
  const capperName = (props.capper || 'SHIVA').toUpperCase()
  const branding = getCapperBranding(capperName)

  // Safe defaults for all fields
  const safeFactors = (props.factors ?? []).map(f => ({
    ...f,
    overScore: Number(f.overScore ?? 0),
    underScore: Number(f.underScore ?? 0),
    weightAppliedPct: Number(f.weightAppliedPct ?? 0),
    rationale: f.rationale || 'No rationale provided',
  }))

  // Sort factors by absolute contribution (sum of over + under impact)
  const sortedFactors = [...safeFactors].sort((a, b) => {
    const absA = Math.abs((a.overScore ?? 0) + (a.underScore ?? 0))
    const absB = Math.abs((b.overScore ?? 0) + (b.underScore ?? 0))
    return absB - absA
  })

  // Safe defaults for required fields
  const safePick = {
    type: props.pick?.type || 'UNKNOWN',
    selection: props.pick?.selection || 'N/A',
    units: Number(props.pick?.units ?? 0),
    confidence: Number(props.pick?.confidence ?? 0),
  }

  // Calculate comprehensive tier grade (or use pre-computed if available)
  const tierGradeResult = props.computedTier || calculateTierGrade({
    baseConfidence: safePick.confidence,
    unitsRisked: safePick.units,
    teamRecord: props.tierGradeInputs?.teamRecord,
    last7DaysRecord: props.tierGradeInputs?.last7DaysRecord
  })

  // Get rarity styling from calculated tier
  const rarity = getRarityStyleFromTier(tierGradeResult.tier)

  const safePredictedScore = {
    away: Number(props.predictedScore?.away ?? 0),
    home: Number(props.predictedScore?.home ?? 0),
    winner: props.predictedScore?.winner || 'Unknown',
  }

  const safeMarket = {
    conf7: Number(props.market?.conf7 ?? 0),
    confAdj: Number(props.market?.confAdj ?? 0),
    confFinal: Number(props.market?.confFinal ?? 0),
    dominant: props.market?.dominant || 'side',
  }

  // Extract team abbreviations for SPREAD factor labels
  const awayTeam = props.matchup?.away
  const homeTeam = props.matchup?.home
  const awayAbbr = typeof awayTeam === 'object' ? (awayTeam?.abbreviation || 'AWAY') : 'AWAY'
  const homeAbbr = typeof homeTeam === 'object' ? (homeTeam?.abbreviation || 'HOME') : 'HOME'

  const formatLocalDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'Unknown Date'
    }
  }

  const formatLocalTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return 'Unknown Time'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* DIABLO-STYLE CARD WITH RARITY BORDER */}
      <div
        className={`bg-gradient-to-br ${rarity.bgGradient} rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto`}
        style={{
          border: `2px solid ${rarity.borderColor}`,
          boxShadow: `0 0 30px ${rarity.glowColor}, inset 0 0 60px rgba(0,0,0,0.5)`
        }}
      >
        {/* ===== ORNATE HEADER ===== */}
        <div
          className="p-5 rounded-t-lg relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(13,13,20,0.98) 100%)`,
            borderBottom: `1px solid ${rarity.borderColor}40`
          }}
        >
          {/* Animated glow effect */}
          <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at center, ${rarity.borderColor}40, transparent 70%)` }}></div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Capper Icon */}
              <div
                className={`w-14 h-14 bg-gradient-to-br ${branding.gradient} rounded-full flex items-center justify-center shadow-lg`}
                style={{ border: `2px solid ${rarity.borderColor}` }}
              >
                <span className="text-2xl">{isManualPick ? '👤' : branding.icon}</span>
              </div>
              <div>
                {/* Capper Name with Rarity Color */}
                <div className="flex items-center gap-2">
                  <h1 className={`text-xl font-black ${rarity.textColor}`} style={{ textShadow: `0 0 10px ${rarity.glowColor}` }}>
                    {capperName}
                  </h1>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${rarity.badgeBg} text-white`}>
                    {rarity.icon} {rarity.tier.toUpperCase()}
                  </span>
                </div>
                {/* Subtitle with tier score breakdown */}
                <div className="text-slate-400 text-xs font-medium flex items-center gap-1 flex-wrap">
                  <span>{isManualPick ? 'Human Capper' : 'AI Generated'}</span>
                  <span className="text-slate-600">•</span>
                  <span className={rarity.textColor}>Sharp Score {tierGradeResult.tierScore.toFixed(0)}</span>
                  {/* Show bonuses if any */}
                  {(tierGradeResult.bonuses.units > 0 || tierGradeResult.bonuses.teamRecord !== 0 || tierGradeResult.bonuses.hotStreak !== 0) && (
                    <span className="text-slate-500 text-[10px]">
                      ({safePick.confidence.toFixed(0)} base
                      {tierGradeResult.bonuses.units > 0 && <span className="text-green-400"> +{tierGradeResult.bonuses.units}u</span>}
                      {tierGradeResult.bonuses.teamRecord > 0 && <span className="text-blue-400"> +{tierGradeResult.bonuses.teamRecord}team</span>}
                      {tierGradeResult.bonuses.teamRecord < 0 && <span className="text-red-400"> {tierGradeResult.bonuses.teamRecord}team</span>}
                      {tierGradeResult.bonuses.hotStreak > 0 && <span className="text-amber-400"> +{tierGradeResult.bonuses.hotStreak}hot</span>}
                      {tierGradeResult.bonuses.hotStreak < 0 && <span className="text-red-400"> {tierGradeResult.bonuses.hotStreak}cold</span>})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={props.onClose}
              className="text-slate-400 hover:text-white text-xl font-bold transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ===== THE PICK - HERO SECTION ===== */}
        <div
          className="p-6 text-center relative"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,25,0.9) 0%, rgba(10,10,18,0.95) 100%)',
            borderBottom: `1px solid ${rarity.borderColor}30`
          }}
        >
          {/* THE PICK - Large and prominent */}
          <div
            className="text-4xl font-black text-white mb-2"
            style={{ textShadow: `0 0 20px ${rarity.glowColor}` }}
          >
            {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
          </div>

          {/* Matchup */}
          {(() => {
            const away = props.matchup?.away
            const home = props.matchup?.home
            const awayName = typeof away === 'object' ? (away?.abbreviation || away?.name || 'Away') : (away || 'Away')
            const homeName = typeof home === 'object' ? (home?.abbreviation || home?.name || 'Home') : (home || 'Home')
            return (
              <div className={`text-base font-semibold ${rarity.textColor} mb-2`}>
                {awayName} @ {homeName}
              </div>
            )
          })()}

          {/* Game Date & Time */}
          <div className="text-slate-400 text-xs flex items-center justify-center gap-2">
            <span>📅 {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</span>
            <span>•</span>
            <span>⏰ {formatLocalTime(props.matchup?.gameDateLocal || props.generatedAt)}</span>
          </div>

          {/* Locked line info (AI picks only) */}
          {!isManualPick && safePick.type === 'TOTAL' && (safePick as any).locked_odds?.total_line && (
            <div className={`${rarity.textColor} text-sm font-semibold flex items-center justify-center gap-2 mt-2`}>
              <span>🔒</span>
              <span>Locked O/U {(safePick as any).locked_odds.total_line}</span>
            </div>
          )}
          {!isManualPick && safePick.type === 'SPREAD' && (safePick as any).locked_odds?.spread_line && (
            <div className={`${rarity.textColor} text-sm font-semibold flex items-center justify-center gap-2 mt-2`}>
              <span>🔒</span>
              <span>Locked ATS {(safePick as any).locked_odds.spread_line > 0 ? '+' : ''}{(safePick as any).locked_odds.spread_line}</span>
            </div>
          )}
        </div>

        {/* ===== MANUAL PICK: CAPPER STATS SECTION - PICKSMITH STYLE ===== */}
        {isManualPick ? (
          <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900" style={{ borderBottom: `1px solid ${rarity.borderColor}20` }}>
            {/* Section Header - PICKSMITH style */}
            <div className={`text-xs font-bold ${rarity.textColor} uppercase mb-4 flex items-center gap-2`}>
              <span>📊</span>
              <span>Capper Stats</span>
            </div>

            {manualInsight?.betTypeRecord && manualInsight.betTypeRecord.total > 0 ? (
              <>
                {/* Main Stats Grid - PICKSMITH style */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {/* Overall Record */}
                  <StatBlock
                    label={`${safePick.type} Record`}
                    value={`${manualInsight.betTypeRecord.wins}-${manualInsight.betTypeRecord.losses}${manualInsight.betTypeRecord.pushes ? `-${manualInsight.betTypeRecord.pushes}` : ''}`}
                    subValue={`${manualInsight.betTypeRecord.winPct}% Win Rate`}
                    positive={manualInsight.betTypeRecord.winPct >= 50}
                    icon="🎯"
                  />

                  {/* Net Units */}
                  <StatBlock
                    label="Net Units"
                    value={`${manualInsight.betTypeRecord.netUnits > 0 ? '+' : ''}${manualInsight.betTypeRecord.netUnits.toFixed(1)}u`}
                    subValue={`${manualInsight.betTypeRecord.total} picks`}
                    positive={manualInsight.betTypeRecord.netUnits > 0}
                    icon="💰"
                  />

                  {/* Current Streak */}
                  <StatBlock
                    label="Streak"
                    value={manualInsight.streak?.count && manualInsight.streak.type !== 'none'
                      ? `${manualInsight.streak.count}${manualInsight.streak.type}`
                      : 'N/A'}
                    subValue={manualInsight.streak?.type === 'W' ? 'Winning' : manualInsight.streak?.type === 'L' ? 'Losing' : ''}
                    positive={manualInsight.streak?.type === 'W' ? true : manualInsight.streak?.type === 'L' ? false : null}
                    icon={manualInsight.streak?.type === 'W' ? '🔥' : manualInsight.streak?.type === 'L' ? '❄️' : '➖'}
                  />

                  {/* Matchup Record */}
                  {manualInsight.matchupRecord && manualInsight.matchupRecord.total > 0 ? (
                    <StatBlock
                      label="This Matchup"
                      value={`${manualInsight.matchupRecord.wins}-${manualInsight.matchupRecord.losses}`}
                      subValue={`${manualInsight.matchupRecord.winPct}%`}
                      positive={manualInsight.matchupRecord.winPct >= 50}
                      icon="⚔️"
                    />
                  ) : (
                    <StatBlock
                      label="This Matchup"
                      value="First Pick"
                      icon="🆕"
                    />
                  )}
                </div>

                {/* Bet Type Specific Stats */}
                {safePick.type === 'TOTAL' && manualInsight.totals && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <StatBlock
                      label="Over Picks"
                      value={manualInsight.totals.overRecord
                        ? `${manualInsight.totals.overRecord.wins}-${manualInsight.totals.overRecord.losses}`
                        : '0-0'}
                      subValue={manualInsight.totals.overRecord?.winPct ? `${manualInsight.totals.overRecord.winPct}%` : undefined}
                      positive={manualInsight.totals.overRecord?.winPct ? manualInsight.totals.overRecord.winPct >= 50 : null}
                      icon="⬆️"
                    />
                    <StatBlock
                      label="Under Picks"
                      value={manualInsight.totals.underRecord
                        ? `${manualInsight.totals.underRecord.wins}-${manualInsight.totals.underRecord.losses}`
                        : '0-0'}
                      subValue={manualInsight.totals.underRecord?.winPct ? `${manualInsight.totals.underRecord.winPct}%` : undefined}
                      positive={manualInsight.totals.underRecord?.winPct ? manualInsight.totals.underRecord.winPct >= 50 : null}
                      icon="⬇️"
                    />
                  </div>
                )}

                {safePick.type === 'SPREAD' && manualInsight.spread && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <StatBlock
                      label="Favorites"
                      value={manualInsight.spread.favoriteRecord
                        ? `${manualInsight.spread.favoriteRecord.wins}-${manualInsight.spread.favoriteRecord.losses}`
                        : '0-0'}
                      subValue={manualInsight.spread.favoriteRecord?.winPct ? `${manualInsight.spread.favoriteRecord.winPct}%` : undefined}
                      positive={manualInsight.spread.favoriteRecord?.winPct ? manualInsight.spread.favoriteRecord.winPct >= 50 : null}
                      icon="⭐"
                    />
                    <StatBlock
                      label="Underdogs"
                      value={manualInsight.spread.underdogRecord
                        ? `${manualInsight.spread.underdogRecord.wins}-${manualInsight.spread.underdogRecord.losses}`
                        : '0-0'}
                      subValue={manualInsight.spread.underdogRecord?.winPct ? `${manualInsight.spread.underdogRecord.winPct}%` : undefined}
                      positive={manualInsight.spread.underdogRecord?.winPct ? manualInsight.spread.underdogRecord.winPct >= 50 : null}
                      icon="🐕"
                    />
                  </div>
                )}

                {/* Last Pick on This Team - PICKSMITH style */}
                {(manualInsight.lastMatchupPick || manualInsight.totals?.lastTeamGamePick || manualInsight.spread?.lastTeamPick) && (
                  <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                    <div className={`text-[10px] font-bold ${rarity.textColor} uppercase mb-2 flex items-center gap-2`}>
                      <span>📋</span>
                      <span>Last Pick on This Team</span>
                    </div>
                    {(() => {
                      const lastPick = manualInsight.lastMatchupPick || manualInsight.totals?.lastTeamGamePick || manualInsight.spread?.lastTeamPick
                      if (!lastPick) return null
                      return (
                        <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                          <span className="text-sm text-white font-semibold">{lastPick.selection}</span>
                          <span className={`text-sm font-bold ${lastPick.result === 'won' ? 'text-emerald-400' : lastPick.result === 'lost' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {lastPick.result === 'won' ? '✅ WON' : lastPick.result === 'lost' ? '❌ LOST' : '🤝 PUSH'}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🆕</div>
                <div className="text-slate-300 font-medium">First {safePick.type} pick!</div>
                <div className="text-slate-500 text-sm">Historical stats will appear after this pick is graded.</div>
              </div>
            )}
          </div>
        ) : (
          /* ===== AI PICK: EDGE SCORE - COMPACT ===== */
          <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderBottom: `1px solid ${rarity.borderColor}20` }}>
            <div className="text-center">
              <div className={`text-xs ${rarity.textColor} font-semibold mb-2`}>Edge Score: {Math.min(safeMarket.confFinal, 10).toFixed(1)} / 10.0</div>

              {/* Edge Score Bar with Unit Markers */}
              <div className="relative mx-auto max-w-md">
                {/* Background bar */}
                <div className="relative h-4 bg-slate-900/50 rounded-full overflow-hidden" style={{ border: `1px solid ${rarity.borderColor}40` }}>
                  <div
                    className="h-full transition-all duration-500 shadow-lg"
                    style={{
                      width: `${Math.min((safeMarket.confFinal / 10) * 100, 100)}%`,
                      background: `linear-gradient(90deg, #ef4444 0%, #eab308 50%, ${rarity.borderColor} 100%)`
                    }}
                  />
                </div>

                {/* Unit markers */}
                <div className="relative h-5 mt-1">
                  {[5, 6, 7, 8, 9].map((threshold) => {
                    const position = (threshold / 10) * 100
                    const units = threshold < 6 ? 1 : threshold < 7 ? 2 : threshold < 8 ? 3 : threshold < 9 ? 4 : 5
                    const isActive = safeMarket.confFinal >= threshold

                    return (
                      <div
                        key={threshold}
                        className="absolute transform -translate-x-1/2"
                        style={{ left: `${position}%` }}
                      >
                        <div className={`text-[10px] font-bold`} style={{ color: isActive ? rarity.borderColor : '#475569' }}>
                          {units}U
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={`text-xs ${rarity.textColor} mt-2 font-medium`}>
                {safeMarket.confFinal >= 9 ? '🔥🔥 MAXIMUM EDGE (5 Units)' :
                  safeMarket.confFinal >= 8 ? '🔥 HIGH EDGE (4 Units)' :
                    safeMarket.confFinal >= 7 ? '⚡ STRONG EDGE (3 Units)' :
                      safeMarket.confFinal >= 6 ? '✅ MODERATE EDGE (2 Units)' :
                        safeMarket.confFinal >= 5 ? '⚠️ LOW EDGE (1 Unit)' : '❌ VERY LOW EDGE'}
              </div>
            </div>
          </div>
        )}

        {/* ===== CONFIDENCE BREAKDOWN - Market Stats (AI picks only) ===== */}
        {!isManualPick && (
          <div className="p-4 bg-slate-800" style={{ borderBottom: `1px solid ${rarity.borderColor}20` }}>
            <div className={`text-xs font-bold ${rarity.textColor} uppercase mb-3 flex items-center gap-2`}>
              <span>📊</span>
              <span>Confidence Breakdown</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-700/50">
                <div className="text-[10px] text-slate-400 uppercase mb-1 font-semibold">CONF7</div>
                <div className="text-lg font-mono font-bold text-white">{safeMarket.conf7.toFixed(2)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-700/50">
                <div className="text-[10px] text-slate-400 uppercase mb-1 font-semibold">MARKET ADJ</div>
                <div className={`text-lg font-mono font-bold ${safeMarket.confAdj > 0 ? 'text-green-400' : safeMarket.confAdj < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {safeMarket.confAdj > 0 ? '+' : ''}{safeMarket.confAdj.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg p-2" style={{ background: `linear-gradient(135deg, ${rarity.borderColor}20, ${rarity.borderColor}10)`, border: `2px solid ${rarity.borderColor}60` }}>
                <div className={`text-[10px] ${rarity.textColor} uppercase mb-1 font-bold`}>CONF FINAL</div>
                <div className="text-lg font-mono font-bold text-white">
                  {safeMarket.confFinal.toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-700/50">
                <div className="text-[10px] text-slate-400 uppercase mb-1 font-semibold">DOMINANT</div>
                <div className="text-sm font-bold text-white truncate">
                  {safePick.selection}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ALL FACTORS - Complete List (AI picks only) ===== */}
        {!isManualPick && (
          <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900" style={{ borderBottom: `1px solid ${rarity.borderColor}20` }}>
            <div className="flex items-center justify-between mb-4">
              <div className={`text-xs font-bold ${rarity.textColor} uppercase flex items-center gap-2`}>
                <span>🎯</span>
                <span>All Edge Factors ({sortedFactors.length})</span>
              </div>
              {sortedFactors.length > 0 && (
                <div className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 font-semibold">
                  🏆 {sortedFactors[0].label}
                </div>
              )}
            </div>

            {/* All Factors Grid */}
            <div className="grid grid-cols-2 gap-3">
              {sortedFactors.map((factor, idx) => {
                const factorMeta = getFactorMeta(factor.key)
                const icon = factorMeta?.icon || 'ℹ️'
                const shortName = factorMeta?.shortName || factor.label || factor.key
                const fullName = factorMeta?.name || factor.label || factor.key
                const description = factorMeta?.description || 'Factor analysis'

                const isOver = factor.overScore > 0
                const isUnder = factor.underScore > 0
                const score = isOver ? factor.overScore : isUnder ? factor.underScore : 0
                const direction = safePick.type === 'SPREAD'
                  ? (isOver ? awayAbbr : isUnder ? homeAbbr : 'NEUTRAL')
                  : (isOver ? 'OVER' : isUnder ? 'UNDER' : 'NEUTRAL')

                // Build detailed contribution explanation
                const contributionText = safePick.type === 'SPREAD'
                  ? isOver
                    ? `Favors ${awayAbbr} covering the spread (+${score.toFixed(2)} pts)`
                    : isUnder
                      ? `Favors ${homeAbbr} covering the spread (+${score.toFixed(2)} pts)`
                      : 'Neutral - no directional impact'
                  : isOver
                    ? `Pushing OVER the total (+${score.toFixed(2)} pts)`
                    : isUnder
                      ? `Pushing UNDER the total (+${score.toFixed(2)} pts)`
                      : 'Neutral - no directional impact'

                return (
                  <div
                    key={factor.key}
                    className="bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-xl p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all hover:scale-[1.02] relative"
                    onMouseEnter={() => setHoveredFactor(factor.key)}
                    onMouseLeave={() => setHoveredFactor(null)}
                  >
                    {/* Top driver badge */}
                    {idx === 0 && (
                      <div className="absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-amber-950">
                        🏆 TOP
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-sm shadow-md border border-slate-500/50 flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-xs truncate">{shortName}</div>
                        <div className={`text-[10px] ${isOver ? 'text-emerald-400' : isUnder ? 'text-red-400' : 'text-slate-400'}`}>
                          {direction} {score > 0 ? `+${score.toFixed(1)}` : '0.0'}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Tooltip on hover - positioned above to avoid overlap */}
                    {hoveredFactor === factor.key && (
                      <div
                        className="fixed z-[9999] bg-slate-900 text-white text-xs rounded-lg shadow-2xl border border-slate-500 max-w-[280px]"
                        style={{
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          pointerEvents: 'none'
                        }}
                      >
                        {/* Header */}
                        <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/50 rounded-t-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{icon}</span>
                            <span className="font-bold text-white">{fullName}</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-3 space-y-2">
                          {/* Description */}
                          <p className="text-slate-300 leading-relaxed">{description}</p>

                          {/* Contribution */}
                          <div className={`p-2 rounded-md ${isOver ? 'bg-emerald-900/30 border border-emerald-700/50' : isUnder ? 'bg-red-900/30 border border-red-700/50' : 'bg-slate-800/50 border border-slate-700/50'}`}>
                            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Contribution</div>
                            <div className={`font-semibold ${isOver ? 'text-emerald-400' : isUnder ? 'text-red-400' : 'text-slate-400'}`}>
                              {contributionText}
                            </div>
                          </div>

                          {/* Factor rationale if available */}
                          {factor.rationale && (
                            <div className="text-slate-400 text-[10px] italic border-t border-slate-700 pt-2 mt-2">
                              "{factor.rationale}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== QUICK SUMMARY - Game Prediction (AI picks only) ===== */}
        {!isManualPick && props.writeups && props.writeups.gamePrediction && (
          <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderBottom: `1px solid ${rarity.borderColor}20` }}>
            <div className="bg-slate-900/60 rounded-lg p-4" style={{ border: `1px solid ${rarity.borderColor}20` }}>
              <div className={`text-[10px] font-bold ${rarity.textColor} uppercase mb-2 flex items-center gap-2`}>
                <span>◆</span>
                <span>{safePick.type === 'SPREAD' ? 'Spread Projection' : 'Score Projection'}</span>
              </div>
              <p className="text-slate-200 text-sm font-medium">{props.writeups.gamePrediction}</p>
              {/* ONLY show predicted score for TOTAL picks */}
              {safePick.type === 'TOTAL' && (
                <div className="bg-slate-800/60 rounded-lg p-3 mt-2" style={{ border: `1px solid ${rarity.borderColor}30` }}>
                  <div className="text-center">
                    <div className={`text-[10px] ${rarity.textColor} font-semibold mb-1`}>PREDICTED FINAL SCORE</div>
                    <div className="text-xl font-black text-white">
                      {typeof props.matchup?.away === 'object' ? props.matchup.away.name : props.matchup?.away || 'Away'} {safePredictedScore.away} - {safePredictedScore.home} {typeof props.matchup?.home === 'object' ? props.matchup.home.name : props.matchup?.home || 'Home'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== COLLAPSIBLE ADVANCED DETAILS BUTTON (AI picks only) ===== */}
        {!isManualPick && (
          <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderBottom: `1px solid ${rarity.borderColor}20` }}>
            <button
              onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-white font-bold rounded-lg transition-all duration-200 text-sm hover:scale-[1.02]"
              style={{
                background: `linear-gradient(180deg, ${rarity.borderColor}40 0%, ${rarity.borderColor}20 100%)`,
                border: `1px solid ${rarity.borderColor}60`
              }}
            >
              {showAdvancedDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Hide Advanced Details</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Show Advanced Details</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ===== ADVANCED DETAILS SECTION (COLLAPSIBLE - AI picks only) ===== */}
        {!isManualPick && showAdvancedDetails && (
          <div style={{ borderBottom: `1px solid ${rarity.borderColor}20` }}>
            {/* AI Writeups - Bold Predictions */}
            {props.bold_predictions && props.bold_predictions.predictions && props.bold_predictions.predictions.length > 0 && (
              <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderBottom: `1px solid ${rarity.borderColor}15` }}>
                <div className="space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid rgba(100,100,120,0.3)' }}>
                    <span className={`text-sm ${rarity.textColor}`}>◆</span>
                    <h3 className={`text-xs font-bold ${rarity.textColor} uppercase tracking-wider`}>Bold Picks</h3>
                  </div>

                  {/* Summary */}
                  {props.bold_predictions.summary && (
                    <p className="text-slate-300 text-sm leading-relaxed">{props.bold_predictions.summary}</p>
                  )}

                  {/* Individual Predictions - Clean Cards */}
                  <div className="space-y-2">
                    {props.bold_predictions.predictions.map((pred, index) => (
                      <div key={index} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-colors">
                        {/* Player + Confidence Badge */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="text-sm font-bold text-white">
                              {pred.player}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                              {pred.team}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold flex-shrink-0 ${pred.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            pred.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                              'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            }`}>
                            {pred.confidence}
                          </span>
                        </div>

                        {/* The Prediction - HERO */}
                        <div className={`text-sm font-bold ${rarity.textColor} mb-1`}>
                          {pred.prediction}
                        </div>

                        {/* Reasoning */}
                        <p className="text-xs text-slate-400 leading-relaxed">{pred.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}



            {/* Injury Summary */}
            {props.injury_summary && (
              <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderBottom: `1px solid ${rarity.borderColor}15` }}>
                <div className={`text-xs font-bold ${rarity.textColor} mb-3 flex items-center gap-2 uppercase tracking-wider`}>
                  <span>◆</span>
                  <span>Injury Summary</span>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3" style={{ border: `1px solid ${rarity.borderColor}20` }}>
                  <p className="text-white text-sm leading-relaxed">{props.injury_summary.summary}</p>
                  {props.injury_summary.findings && props.injury_summary.findings.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {props.injury_summary.findings.map((finding, index) => (
                        <div key={index} className="text-xs text-slate-300 bg-slate-800/50 rounded px-2 py-1.5">
                          <span className="font-semibold">{finding.team}:</span> {finding.player} - {finding.status} <span className={rarity.textColor}>(Impact: {finding.impact})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edge Bar - Compact */}
            {props.pick.edgeRaw !== undefined && props.pick.edgePct !== undefined && (
              <div className="p-3 bg-slate-800 border-b border-slate-700">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-300">EDGE</span>
                    <span className={`text-base font-bold ${props.pick.edgePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {props.pick.edgePct >= 0 ? '+' : ''}{props.pick.edgePct.toFixed(1)}%
                    </span>
                    <div className="relative w-24 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${props.pick.edgePct >= 0 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                        style={{ width: `${Math.min(Math.abs(props.pick.edgePct) * 10, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-300">
                      {props.pick.edgeRaw.toFixed(1)} pts
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Model edge vs market implied probability
                  </div>
                </div>
              </div>
            )}



            {/* Professional Analysis - Compact */}
            {props.writeups && props.writeups.prediction && (
              <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderBottom: `1px solid ${rarity.borderColor}15` }}>
                <div className="bg-slate-900/60 rounded-lg p-4" style={{ border: `1px solid ${rarity.borderColor}20` }}>
                  <div className={`text-[10px] font-bold ${rarity.textColor} uppercase mb-2 flex items-center gap-2 tracking-wider`}>
                    <span>◆</span>
                    <span>Professional Analysis</span>
                  </div>
                  <div className="text-white text-sm leading-relaxed font-medium whitespace-pre-wrap">{props.writeups.prediction}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESULTS Section - Compact */}
        <div className="p-4" style={{ background: 'rgba(15,15,25,0.9)', borderTop: `1px solid ${rarity.borderColor}20` }}>
          {props.results && props.results.status !== 'pending' ? (
            <div className="space-y-4">
              {/* Result Header - Compact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-bold ${props.results.status === 'win' ? 'text-green-400' :
                    props.results.status === 'loss' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                    {props.results.status === 'win' ? '✅ WIN' :
                      props.results.status === 'loss' ? '❌ LOSS' : '🤝 PUSH'}
                  </div>
                  {props.results.finalScore && (
                    <div className="text-base text-slate-300 font-semibold">
                      {props.results.finalScore.away} - {props.results.finalScore.home}
                    </div>
                  )}
                </div>
                {props.results.overallAccuracy !== undefined && (
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Model Accuracy</div>
                    <div className={`text-xl font-bold ${props.results.overallAccuracy >= 0.8 ? 'text-green-400' :
                      props.results.overallAccuracy >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                      {(props.results.overallAccuracy * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>

              {/* AI Post-Mortem Analysis - Compact */}
              {props.results.postMortem && (
                <div className="bg-slate-800/50 rounded-lg p-4" style={{ border: `1px solid ${rarity.borderColor}20` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm ${rarity.textColor}`}>◆</span>
                    <h3 className={`text-xs font-bold ${rarity.textColor} uppercase tracking-wider`}>AI Post-Mortem Analysis</h3>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {props.results.postMortem}
                  </div>
                </div>
              )}

              {/* Factor Accuracy Breakdown */}
              {props.results.factorAccuracy && props.results.factorAccuracy.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-5" style={{ border: `1px solid ${rarity.borderColor}20` }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-sm ${rarity.textColor}`}>◆</span>
                    <h3 className={`text-xs font-bold ${rarity.textColor} uppercase tracking-wider`}>Factor Accuracy</h3>
                  </div>
                  <div className="space-y-3">
                    {props.results.factorAccuracy.map((factor, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                        <div className={`text-xl flex-shrink-0 ${factor.was_correct ? 'text-green-400' : 'text-red-400'}`}>
                          {factor.was_correct ? '✅' : '❌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-sm font-semibold text-white">{factor.factor_name}</div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${factor.impact === 'high' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                factor.impact === 'medium' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                  'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                                }`}>
                                {factor.impact.toUpperCase()}
                              </span>
                              <span className={`text-sm font-bold ${factor.accuracy_score >= 0.8 ? 'text-green-400' :
                                factor.accuracy_score >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                {(factor.accuracy_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 leading-relaxed">{factor.reasoning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tuning Suggestions */}
              {props.results.tuningSuggestions && props.results.tuningSuggestions.length > 0 && (
                <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 rounded-lg p-5 border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🎯</span>
                    <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide">Recommended Adjustments</h3>
                  </div>
                  <div className="space-y-3">
                    {props.results.tuningSuggestions.map((suggestion, index) => {
                      const changePercent = ((suggestion.suggested_weight - suggestion.current_weight) / suggestion.current_weight * 100)
                      const isIncrease = changePercent > 0
                      return (
                        <div key={index} className="p-3 bg-slate-900/50 rounded-lg border border-amber-500/20">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="text-sm font-semibold text-white">{suggestion.factor_key}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">
                                {suggestion.current_weight}% → {suggestion.suggested_weight}%
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${isIncrease ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                }`}>
                                {isIncrease ? '↑' : '↓'} {Math.abs(changePercent).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 leading-relaxed mb-2">{suggestion.reasoning}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-slate-500">Confidence:</div>
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                              <div
                                className={`h-full rounded-full ${suggestion.confidence >= 0.8 ? 'bg-green-500' :
                                  suggestion.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-orange-500'
                                  }`}
                                style={{ width: `${suggestion.confidence * 100}%` }}
                              />
                            </div>
                            <div className="text-xs font-semibold text-slate-300">
                              {(suggestion.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-amber-500/20">
                    <a
                      href="/cappers/shiva/management"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-2.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg transition-all duration-200 text-sm"
                    >
                      Apply in Configure Factors →
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-slate-400 text-sm leading-relaxed">
                {isManualPick
                  ? 'Game has not started yet. Check back after the game to see the result!'
                  : "Game has not started yet. Check back to see the outcome and our AI's assessment of what we did right or wrong in predicting this matchup!"}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Diablo style */}
        <div
          className="p-4 rounded-b-lg"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,25,0.95) 0%, rgba(10,10,18,1) 100%)',
            borderTop: `1px solid ${rarity.borderColor}30`
          }}
        >
          {/* Metadata */}
          <div className="text-center text-slate-500 text-[10px] mb-3">
            <div className="flex items-center justify-center gap-2">
              {isManualPick ? (
                <>
                  <span>👤 {capperName}</span>
                  <span className="text-slate-600">•</span>
                  <span>Pick Placed: {formatLocalTime(props.generatedAt)}</span>
                </>
              ) : (
                <>
                  <span>{safePick.type === 'SPREAD' ? '🎯 NBA Spread Model' : '🎯 NBA Totals Model'}</span>
                  <span className="text-slate-600">•</span>
                  <span>Generated: {formatLocalTime(props.generatedAt)}</span>
                </>
              )}
            </div>
          </div>

          {/* Close Button - styled with rarity */}
          <div className="flex justify-center">
            <button
              onClick={props.onClose}
              className="px-6 py-2 text-white rounded-lg text-sm font-bold transition-all hover:scale-105"
              style={{
                background: `linear-gradient(180deg, ${rarity.borderColor}80 0%, ${rarity.borderColor}60 100%)`,
                border: `1px solid ${rarity.borderColor}`,
                boxShadow: `0 0 10px ${rarity.glowColor}`
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}