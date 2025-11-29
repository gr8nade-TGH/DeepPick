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
  onClose: () => void
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
  'DEEPPICK': { icon: '🎯', color: 'blue', gradient: 'from-blue-600 to-cyan-700' }
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

// Stat Block component for manual picks
function StatBlock({ label, value, subValue, positive, icon }: {
  label: string
  value: string
  subValue?: string
  positive?: boolean | null
  icon?: string
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50 text-center">
      <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className={`text-lg font-bold ${positive === true ? 'text-emerald-400' :
        positive === false ? 'text-red-400' :
          'text-white'
        }`}>
        {value}
      </div>
      {subValue && (
        <div className={`text-xs font-medium ${positive === true ? 'text-emerald-300' :
          positive === false ? 'text-red-300' :
            'text-slate-400'
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
      <div className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border-2 border-${branding.color}-500/30 max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>

        {/* ===== COMPACT HEADER ===== */}
        <div className={`bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 rounded-t-2xl border-b-2 border-${branding.color}-500/40`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${branding.gradient} rounded-full flex items-center justify-center border-2 border-${branding.color}-400 shadow-lg`}>
                <span className="text-2xl">{isManualPick ? '👤' : branding.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white">{capperName}'S PICK</h1>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isManualPick
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
                    }`}>
                    {isManualPick ? 'HUMAN CAPPER' : 'AI GENERATED'}
                  </span>
                </div>
                <div className="text-slate-400 text-xs font-medium">
                  {isManualPick ? 'Manual Selection' : 'Professional Sports Analytics'}
                </div>
              </div>
            </div>
            <button
              onClick={props.onClose}
              className={`text-slate-400 hover:text-${branding.color}-400 text-2xl font-bold transition-colors`}
            >
              ×
            </button>
          </div>
        </div>

        {/* ===== THE PICK - HERO SECTION ===== */}
        <div className={`p-6 bg-gradient-to-r ${isManualPick ? 'from-emerald-900 via-teal-900 to-emerald-900 border-b-2 border-emerald-400/50' : 'from-cyan-900 via-blue-900 to-cyan-900 border-b-2 border-cyan-400/50'} shadow-xl relative overflow-hidden`}>
          <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${isManualPick ? 'via-emerald-400/5' : 'via-cyan-400/5'} to-transparent animate-pulse`}></div>

          <div className="text-center relative z-10">
            {/* THE PICK */}
            <div className={`text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${isManualPick ? 'from-emerald-300 to-teal-300' : 'from-cyan-300 to-blue-300'} mb-2 drop-shadow-lg tracking-tight`}>
              {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
            </div>

            {/* Matchup - properly extract team names */}
            {(() => {
              const away = props.matchup?.away
              const home = props.matchup?.home
              const awayName = typeof away === 'object' ? (away?.abbreviation || away?.name || 'Away') : (away || 'Away')
              const homeName = typeof home === 'object' ? (home?.abbreviation || home?.name || 'Home') : (home || 'Home')
              return (
                <div className="text-lg font-bold text-white mb-1">
                  {awayName} @ {homeName}
                </div>
              )
            })()}

            {/* Game Date & Time */}
            <div className={`flex items-center justify-center gap-3 ${isManualPick ? 'text-emerald-200' : 'text-cyan-200'} text-sm font-semibold`}>
              <span>🗓️ {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</span>
              <span>•</span>
              <span>🕐 {formatLocalTime(props.matchup?.gameDateLocal || props.generatedAt)}</span>
            </div>

            {/* Show locked line based on pick type - only for AI picks */}
            {!isManualPick && safePick.type === 'TOTAL' && (safePick as any).locked_odds?.total_line && (
              <div className="text-cyan-200 text-sm font-semibold flex items-center justify-center gap-2 mt-2">
                <span className="text-lg">🔒</span>
                <span>Locked O/U {(safePick as any).locked_odds.total_line}</span>
              </div>
            )}
            {!isManualPick && safePick.type === 'SPREAD' && (safePick as any).locked_odds?.spread_line && (
              <div className="text-cyan-200 text-sm font-semibold flex items-center justify-center gap-2 mt-2">
                <span className="text-lg">🔒</span>
                <span>Locked ATS {(safePick as any).locked_odds.spread_line > 0 ? '+' : ''}{(safePick as any).locked_odds.spread_line}</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== MANUAL PICK: CAPPER STATS SECTION ===== */}
        {isManualPick ? (
          <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-emerald-500/20">
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📊</span>
              <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">Capper Stats</h3>
            </div>

            {manualInsight?.betTypeRecord && manualInsight.betTypeRecord.total > 0 ? (
              <>
                {/* Main Stats Grid */}
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

                {/* Last Pick on This Team */}
                {(manualInsight.lastMatchupPick || manualInsight.totals?.lastTeamGamePick || manualInsight.spread?.lastTeamPick) && (
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 uppercase mb-1">Last Pick on This Team</div>
                    {(() => {
                      const lastPick = manualInsight.lastMatchupPick || manualInsight.totals?.lastTeamGamePick || manualInsight.spread?.lastTeamPick
                      if (!lastPick) return null
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-medium">{lastPick.selection}</span>
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
          <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-cyan-500/20">
            <div className="text-center">
              <div className="text-xs text-cyan-300 font-semibold mb-2">Edge Score: {Math.min(safeMarket.confFinal, 10).toFixed(1)} / 10.0</div>

              {/* Edge Score Bar with Unit Markers */}
              <div className="relative mx-auto max-w-md">
                {/* Background bar */}
                <div className="relative h-4 bg-slate-900/50 rounded-full overflow-hidden border border-cyan-500/30">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-cyan-400 transition-all duration-500 shadow-lg"
                    style={{ width: `${Math.min((safeMarket.confFinal / 10) * 100, 100)}%` }}
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
                        <div className={`text-[10px] font-bold ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
                          {units}U
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="text-xs text-cyan-200 mt-2 font-medium">
                {safeMarket.confFinal >= 9 ? '🔥🔥 MAXIMUM EDGE (5 Units)' :
                  safeMarket.confFinal >= 8 ? '🔥 HIGH EDGE (4 Units)' :
                    safeMarket.confFinal >= 7 ? '⚡ STRONG EDGE (3 Units)' :
                      safeMarket.confFinal >= 6 ? '✅ MODERATE EDGE (2 Units)' :
                        safeMarket.confFinal >= 5 ? '⚠️ LOW EDGE (1 Unit)' : '❌ VERY LOW EDGE'}
              </div>
            </div>
          </div>
        )}

        {/* ===== KEY FACTORS - TOP 3 ONLY (AI picks only) ===== */}
        {!isManualPick && (
          <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                <span className="text-lg">📈</span>
                <span>KEY FACTORS</span>
              </div>
              {sortedFactors.length > 0 && (
                <div className="text-[10px] px-2 py-1 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/30 font-semibold">
                  🏆 Dominant: {sortedFactors[0].label}
                </div>
              )}
            </div>

            {/* Top 3 Factors Only - Compact */}
            <div className="space-y-2">
              {sortedFactors.slice(0, 3).map((factor) => {
                const factorMeta = getFactorMeta(factor.key)
                const icon = factorMeta?.icon || 'ℹ️'
                const shortName = factorMeta?.shortName || factor.label || factor.key
                const tooltip = factorMeta?.description || factor.rationale || 'Factor'

                const isOver = factor.overScore > 0
                const isUnder = factor.underScore > 0

                return (
                  <div
                    key={factor.key}
                    className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-all group"
                    onMouseEnter={() => setHoveredFactor(factor.key)}
                    onMouseLeave={() => setHoveredFactor(null)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className="text-xl flex-shrink-0 relative">
                        <span title={tooltip}>{icon}</span>
                        {hoveredFactor === factor.key && (
                          <div className="absolute left-full ml-3 top-0 z-20 w-64 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-600">
                            {tooltip}
                          </div>
                        )}
                      </div>

                      {/* Factor Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white">
                          {shortName}
                        </div>
                      </div>

                      {/* Direction Label + Value - SPREAD shows AWAY/HOME, TOTAL shows OVER/UNDER */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold uppercase w-14 text-right ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-500'}`}>
                          {safePick.type === 'SPREAD'
                            ? (isOver ? 'AWAY' : isUnder ? 'HOME' : 'NEUTRAL')
                            : (isOver ? 'OVER' : isUnder ? 'UNDER' : 'NEUTRAL')}
                        </span>
                        <span className={`text-sm font-mono font-bold w-10 ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-500'}`}>
                          {isOver ? `+${factor.overScore.toFixed(1)}` : isUnder ? `+${factor.underScore.toFixed(1)}` : '0.0'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== QUICK SUMMARY - Game Prediction (AI picks only) ===== */}
        {!isManualPick && props.writeups && props.writeups.gamePrediction && (
          <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-lg p-4 border border-cyan-500/20">
              <div className="text-[10px] font-bold text-cyan-400 uppercase mb-2 flex items-center gap-2">
                <span>🎯</span>
                <span>{safePick.type === 'SPREAD' ? 'Spread Projection' : 'Score Projection'}</span>
              </div>
              <p className="text-cyan-100 text-sm font-medium">{props.writeups.gamePrediction}</p>
              {/* ONLY show predicted score for TOTAL picks */}
              {safePick.type === 'TOTAL' && (
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-3 mt-2 border border-cyan-500/30">
                  <div className="text-center">
                    <div className="text-[10px] text-cyan-300 font-semibold mb-1">PREDICTED FINAL SCORE</div>
                    <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
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
          <div className="p-4 bg-slate-800 border-b border-slate-700">
            <button
              onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all duration-200 text-sm"
            >
              {showAdvancedDetails ? (
                <>
                  <ChevronUp className="w-5 h-5" />
                  <span>HIDE ADVANCED DETAILS</span>
                  <ChevronUp className="w-5 h-5" />
                </>
              ) : (
                <>
                  <ChevronDown className="w-5 h-5" />
                  <span>SHOW ADVANCED DETAILS</span>
                  <ChevronDown className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ===== ADVANCED DETAILS SECTION (COLLAPSIBLE - AI picks only) ===== */}
        {!isManualPick && showAdvancedDetails && (
          <div className="border-b border-slate-700">
            {/* AI Writeups - Bold Predictions */}
            {props.bold_predictions && props.bold_predictions.predictions && props.bold_predictions.predictions.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
                <div className="space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                    <span className="text-base">🎯</span>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Bold Picks</h3>
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
                        <div className="text-sm font-bold text-cyan-300 mb-1">
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
              <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
                <div className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
                  <span>🏥</span>
                  <span>INJURY SUMMARY</span>
                </div>
                <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 rounded-lg p-3 border border-cyan-500/20">
                  <p className="text-white text-sm leading-relaxed">{props.injury_summary.summary}</p>
                  {props.injury_summary.findings && props.injury_summary.findings.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {props.injury_summary.findings.map((finding, index) => (
                        <div key={index} className="text-xs text-cyan-200 bg-slate-800/50 rounded px-2 py-1.5">
                          <span className="font-semibold">{finding.team}:</span> {finding.player} - {finding.status} <span className="text-cyan-400">(Impact: {finding.impact})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ALL Confidence Factors - Detailed */}
            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                  <span className="text-lg">📈</span>
                  <span>ALL EDGE FACTORS</span>
                </div>
                {sortedFactors.length > 0 && (
                  <div className="text-[10px] px-2 py-1 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/30 font-semibold">
                    🏆 Dominant: {sortedFactors[0].label}
                  </div>
                )}
              </div>

              {/* Factor Rows - Compact */}
              <div className="space-y-2">
                {sortedFactors.map((factor) => {
                  const factorMeta = getFactorMeta(factor.key)
                  const icon = factorMeta?.icon || 'ℹ️'
                  const shortName = factorMeta?.shortName || factor.label || factor.key
                  const tooltip = factorMeta?.description || factor.rationale || 'Factor'

                  const netContribution = (factor.overScore || 0) - (factor.underScore || 0)
                  const isOver = factor.overScore > 0
                  const isUnder = factor.underScore > 0

                  return (
                    <div
                      key={factor.key}
                      className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition-all group"
                      onMouseEnter={() => setHoveredFactor(factor.key)}
                      onMouseLeave={() => setHoveredFactor(null)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="text-xl flex-shrink-0 relative">
                          <span title={tooltip}>{icon}</span>
                          {hoveredFactor === factor.key && (
                            <div className="absolute left-full ml-3 top-0 z-20 w-64 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-600">
                              {tooltip}
                            </div>
                          )}
                        </div>

                        {/* Factor Name */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white">
                            {shortName}
                          </div>
                        </div>

                        {/* Direction Label + Value - SPREAD shows AWAY/HOME, TOTAL shows OVER/UNDER */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-bold uppercase w-14 text-right ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-500'}`}>
                            {safePick.type === 'SPREAD'
                              ? (isOver ? 'AWAY' : isUnder ? 'HOME' : 'NEUTRAL')
                              : (isOver ? 'OVER' : isUnder ? 'UNDER' : 'NEUTRAL')}
                          </span>
                          <span className={`text-sm font-mono font-bold w-10 ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-500'}`}>
                            {isOver ? `+${factor.overScore.toFixed(1)}` : isUnder ? `+${factor.underScore.toFixed(1)}` : '0.0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Market Summary - Compact */}
            <div className="p-4 bg-slate-800 border-b border-slate-700">
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
                <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-lg p-2 border-2 border-cyan-500/40">
                  <div className="text-[10px] text-cyan-300 uppercase mb-1 font-bold">CONF FINAL</div>
                  <div className="text-lg font-mono font-bold text-white">
                    {safeMarket.confFinal.toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase mb-1 font-semibold">DOMINANT</div>
                  <div className="text-sm font-bold text-white">
                    {safePick.type === 'TOTAL' ? (safePick.selection?.includes('OVER') ? 'OVER' : 'UNDER') : safeMarket.dominant.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

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
              <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
                <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-lg p-4 border border-cyan-500/20">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase mb-2 flex items-center gap-2">
                    <span>📊</span>
                    <span>Professional Analysis</span>
                  </div>
                  <div className="text-white text-sm leading-relaxed font-medium whitespace-pre-wrap">{props.writeups.prediction}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESULTS Section - Compact */}
        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 border-t border-cyan-500/20">
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
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🧠</span>
                    <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">AI Post-Mortem Analysis</h3>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {props.results.postMortem}
                  </div>
                </div>
              )}

              {/* Factor Accuracy Breakdown */}
              {props.results.factorAccuracy && props.results.factorAccuracy.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">📊</span>
                    <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wide">Factor Accuracy</h3>
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

        {/* Footer - Compact */}
        <div className="p-3 bg-slate-900 border-t border-slate-700">
          {/* Metadata - Moved to small footer */}
          <div className="text-center text-slate-500 text-[9px] mb-2">
            <div className="flex items-center justify-center gap-2">
              {isManualPick ? (
                <>
                  <span>👤 {capperName}</span>
                  <span>•</span>
                  <span>Pick Placed: {formatLocalTime(props.generatedAt)}</span>
                </>
              ) : (
                <>
                  <span>{safePick.type === 'SPREAD' ? '🎯 NBA Spread Model v1' : '🎯 NBA Totals Model v1'}</span>
                  <span>•</span>
                  <span>Pick Generated: {formatLocalTime(props.generatedAt)}</span>
                </>
              )}
            </div>
          </div>

          {/* Buttons - Compact */}
          <div className="flex justify-center gap-3">
            <button
              onClick={props.onClose}
              className="px-5 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                const cardData = {
                  capper: props.capper,
                  sport: props.sport,
                  gameId: props.gameId,
                  generatedAt: props.generatedAt,
                  matchup: props.matchup,
                  pick: props.pick,
                  predictedScore: props.predictedScore,
                  writeups: props.writeups,
                  factors: props.factors,
                  market: props.market,
                  results: props.results,
                }
                navigator.clipboard.writeText(JSON.stringify(cardData, null, 2))
                alert('Insight Card JSON copied to clipboard!')
              }}
              className="px-5 py-1.5 bg-slate-600 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
            >
              📋 Copy JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}