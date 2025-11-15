"use client"
import { useState } from 'react'
import { getFactorMeta } from '@/lib/cappers/shiva-v1/factor-registry'

export interface InsightCardProps {
  capper: string
  capperIconUrl?: string
  sport: 'NBA' | 'MLB' | 'NFL'
  gameId: string
  pickId?: string | null  // Only present for generated picks (not PASS)
  generatedAt: string
  is_system_pick?: boolean  // True for generated picks, false for manual picks
  matchup: {
    away: string
    home: string
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

export function InsightCard(props: InsightCardProps) {
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null)

  // Early return if no data
  if (!props || !props.factors) {
    return (
      <div className="border rounded-lg shadow-lg bg-white max-w-4xl mx-auto p-4">
        <div className="text-gray-500">No card data available</div>
      </div>
    )
  }

  console.debug('InsightCard props', { props })

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
        {/* Professional Header with Dynamic Capper Branding */}
        <div className={`bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-6 rounded-t-2xl border-b-2 border-${branding.color}-500/40`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 bg-gradient-to-br ${branding.gradient} rounded-full flex items-center justify-center border-2 border-${branding.color}-400 shadow-lg`}>
                <span className="text-3xl">{branding.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-${branding.color}-400 to-${branding.color === 'cyan' ? 'blue' : branding.color}-400`}>{capperName}'S PICK</h1>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${props.is_system_pick !== false
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-600 text-white'
                    }`}>
                    {props.is_system_pick !== false ? 'GENERATED' : 'MANUAL'}
                  </span>
                </div>
                <div className={`text-${branding.color}-300 text-sm font-semibold`}>Professional Sports Analytics</div>
              </div>
            </div>
            <button
              onClick={props.onClose}
              className={`text-slate-400 hover:text-${branding.color}-400 text-3xl font-bold transition-colors`}
            >
              ×
            </button>
          </div>
        </div>

        {/* Matchup Line */}
        <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-cyan-500/20">
          <div className="text-center">
            <div className="text-xl font-bold text-white mb-2">
              {props.matchup?.spreadText || 'AWAY +spread @ HOME -spread'}
            </div>
            <div className="text-cyan-300 font-medium">
              {props.matchup?.totalText || 'O/U {total_line}'}
            </div>
          </div>
        </div>

        {/* Bet Banner - Professional & Clean */}
        <div className="p-8 bg-gradient-to-r from-cyan-900 via-blue-900 to-cyan-900 border-y-2 border-cyan-400/50 shadow-xl relative overflow-hidden">
          {/* Subtle animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent animate-pulse"></div>

          <div className="text-center relative z-10">
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300 mb-3 drop-shadow-lg tracking-tight">
              {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
            </div>
            {/* Show locked line based on pick type */}
            {safePick.type === 'TOTAL' && (safePick as any).locked_odds?.total_line && (
              <div className="text-cyan-200 text-lg font-semibold flex items-center justify-center gap-2">
                <span className="text-2xl">🔒</span>
                <span>Locked O/U {(safePick as any).locked_odds.total_line}</span>
              </div>
            )}
            {safePick.type === 'SPREAD' && (safePick as any).locked_odds?.spread_line && (
              <div className="text-cyan-200 text-lg font-semibold flex items-center justify-center gap-2">
                <span className="text-2xl">🔒</span>
                <span>Locked ATS {(safePick as any).locked_odds.spread_line > 0 ? '+' : ''}{(safePick as any).locked_odds.spread_line}</span>
              </div>
            )}
          </div>
        </div>

        {/* Confidence Score Bar - Professional Design */}
        <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-cyan-500/20">
          <div className="text-center">
            <div className="text-sm text-cyan-300 font-semibold mb-3">Edge Score: {Math.min(safeMarket.confFinal, 10).toFixed(1)} / 10.0</div>

            {/* Edge Score Bar with Unit Markers */}
            <div className="relative mx-auto max-w-lg">
              {/* Background bar */}
              <div className="relative h-5 bg-slate-900/50 rounded-full overflow-hidden border border-cyan-500/30">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-cyan-400 transition-all duration-500 shadow-lg"
                  style={{ width: `${Math.min((safeMarket.confFinal / 10) * 100, 100)}%` }}
                />
              </div>

              {/* Unit markers */}
              <div className="relative h-7 mt-2">
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
                      <div className={`text-xs font-bold ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
                        {units}U
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-sm text-cyan-200 mt-3 font-medium">
              {safeMarket.confFinal >= 9 ? '🔥🔥 MAXIMUM EDGE (5 Units)' :
                safeMarket.confFinal >= 8 ? '🔥 HIGH EDGE (4 Units)' :
                  safeMarket.confFinal >= 7 ? '⚡ STRONG EDGE (3 Units)' :
                    safeMarket.confFinal >= 6 ? '✅ MODERATE EDGE (2 Units)' :
                      safeMarket.confFinal >= 5 ? '⚠️ LOW EDGE (1 Unit)' : '❌ VERY LOW EDGE'}
            </div>
          </div>
        </div>

        {/* AI Writeups - Game Prediction and Bold Predictions (Professional Analysis moved below) */}
        {props.writeups && (
          <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20 space-y-4">
            {props.writeups.gamePrediction && (
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-xl p-5 border border-cyan-500/20 shadow-lg">
                <div className="text-xs font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                  <span>🎯</span>
                  <span>{safePick.type === 'SPREAD' ? 'Spread Projection' : 'Score Projection'}</span>
                </div>
                <p className="text-cyan-100 text-sm font-medium mb-3">{props.writeups.gamePrediction}</p>
                {/* ONLY show predicted score for TOTAL picks - SPREAD picks don't need score projection */}
                {safePick.type === 'TOTAL' && (
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-4 mt-3 border border-cyan-500/30">
                    <div className="text-center">
                      <div className="text-xs text-cyan-300 font-semibold mb-2">PREDICTED FINAL SCORE</div>
                      <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
                        {props.matchup?.away || 'Away'} {safePredictedScore.away} - {safePredictedScore.home} {props.matchup?.home || 'Home'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI BOLD PREDICTIONS - Show if available */}
            {props.bold_predictions && props.bold_predictions.predictions && props.bold_predictions.predictions.length > 0 ? (
              <div className="space-y-4">
                {/* Section Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">AI Bold Predictions</h3>
                </div>

                {/* Summary */}
                {props.bold_predictions.summary && (
                  <p className="text-slate-300 text-sm leading-relaxed">{props.bold_predictions.summary}</p>
                )}

                {/* Individual Predictions - Clean Cards */}
                <div className="space-y-3">
                  {props.bold_predictions.predictions.map((pred, index) => (
                    <div key={index} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
                      {/* Player + Confidence Badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-sm font-bold text-white">
                            {pred.player}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">
                            {pred.team}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold flex-shrink-0 ${pred.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          pred.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          }`}>
                          {pred.confidence}
                        </span>
                      </div>

                      {/* The Prediction - HERO */}
                      <div className="text-base font-bold text-cyan-300 mb-2">
                        {pred.prediction}
                      </div>

                      {/* Reasoning */}
                      <p className="text-xs text-slate-400 leading-relaxed">{pred.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Fallback: Show "Coming Soon" only if no bold predictions available */
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-2">🎯 AI BOLD PREDICTIONS</div>
                <div className="text-center py-2">
                  <p className="text-slate-400 text-sm">No bold predictions available for this pick</p>
                  <p className="text-slate-500 text-xs mt-1">Bold predictions are generated for manual wizard picks only</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Injury Summary - Professional Design */}
        {props.injury_summary && (
          <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
            <div className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
              <span>🏥</span>
              <span>INJURY SUMMARY</span>
            </div>
            <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 rounded-lg p-4 border border-cyan-500/20">
              <p className="text-white text-sm leading-relaxed">{props.injury_summary.summary}</p>
              {props.injury_summary.findings && props.injury_summary.findings.length > 0 && (
                <div className="mt-3 space-y-2">
                  {props.injury_summary.findings.map((finding, index) => (
                    <div key={index} className="text-xs text-cyan-200 bg-slate-800/50 rounded px-3 py-2">
                      <span className="font-semibold">{finding.team}:</span> {finding.player} - {finding.status} <span className="text-cyan-400">(Impact: {finding.impact})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confidence Factors Table - Professional Design */}
        <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
          <div className="flex items-center justify-between mb-6">
            <div className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <span className="text-xl">📈</span>
              <span>EDGE FACTORS</span>
            </div>
            {sortedFactors.length > 0 && (
              <div className="text-xs px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg border border-cyan-500/30 font-semibold">
                🏆 Dominant: {sortedFactors[0].label}
              </div>
            )}
          </div>

          {/* Factor Rows - Clean & Spacious */}
          <div className="space-y-2">
            {sortedFactors.map((factor) => {
              const factorMeta = getFactorMeta(factor.key)
              const icon = factorMeta?.icon || 'ℹ️'
              const shortName = factorMeta?.shortName || factor.label || factor.key
              const tooltip = factorMeta?.description || factor.rationale || 'Factor'

              // Calculate Over/Under direction from factor scores
              const netContribution = (factor.overScore || 0) - (factor.underScore || 0)
              const isOver = factor.overScore > 0
              const isUnder = factor.underScore > 0
              const isNeutral = Math.abs(netContribution) < 0.01

              return (
                <div
                  key={factor.key}
                  className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600 transition-all group"
                  onMouseEnter={() => setHoveredFactor(factor.key)}
                  onMouseLeave={() => setHoveredFactor(null)}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon - Larger */}
                    <div className="text-2xl flex-shrink-0 relative">
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

                    {/* Direction Label + Bar + Value */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Direction Label */}
                      <span className={`text-xs font-bold uppercase w-16 text-right ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-500'
                        }`}>
                        {isOver ? 'OVER' : isUnder ? 'UNDER' : 'NEUTRAL'}
                      </span>

                      {/* Progress Bar */}
                      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isOver ? 'bg-green-500' : isUnder ? 'bg-red-500' : 'bg-slate-500'}`}
                          style={{
                            width: `${Math.min(Math.abs(netContribution) / 2 * 100, 100)}%`,
                            marginLeft: isOver ? '0%' : isUnder ? `${100 - Math.min(Math.abs(netContribution) / 2 * 100, 100)}%` : '50%'
                          }}
                        />
                      </div>

                      {/* Value */}
                      <span className={`text-sm font-mono font-bold w-12 ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-500'
                        }`}>
                        {isOver ? `+${factor.overScore.toFixed(1)}` : isUnder ? `+${factor.underScore.toFixed(1)}` : '0.0'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Market Summary Strip - Enhanced */}
        <div className="p-6 bg-slate-800 border-b border-slate-700">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
              <div className="text-xs text-slate-400 uppercase mb-1.5 font-semibold">CONF7</div>
              <div className="text-2xl font-mono font-bold text-white">{safeMarket.conf7.toFixed(2)}</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
              <div className="text-xs text-slate-400 uppercase mb-1.5 font-semibold">MARKET ADJ</div>
              <div className={`text-2xl font-mono font-bold ${safeMarket.confAdj > 0 ? 'text-green-400' : safeMarket.confAdj < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {safeMarket.confAdj > 0 ? '+' : ''}{safeMarket.confAdj.toFixed(2)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-lg p-3 border-2 border-cyan-500/40">
              <div className="text-xs text-cyan-300 uppercase mb-1.5 font-bold">CONF FINAL</div>
              <div className="text-2xl font-mono font-bold text-white">
                {safeMarket.confFinal.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
              <div className="text-xs text-slate-400 uppercase mb-1.5 font-semibold">DOMINANT EDGE</div>
              <div className="text-base font-bold text-white">
                {safePick.type === 'TOTAL' ? (safePick.selection?.includes('OVER') ? 'OVER' : 'UNDER') : safeMarket.dominant.toUpperCase()}
              </div>
            </div>
          </div>

          {/* CHANGE 2: Market Influence slider removed - data still calculated in backend */}
        </div>

        {/* Edge Bar */}
        {props.pick.edgeRaw !== undefined && props.pick.edgePct !== undefined && (
          <div className="p-4 bg-slate-800 border-b border-slate-700">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-sm font-bold text-slate-300">EDGE</span>
                <span className={`text-lg font-bold ${props.pick.edgePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {props.pick.edgePct >= 0 ? '+' : ''}{props.pick.edgePct.toFixed(1)}%
                </span>
                <div className="relative w-32 h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${props.pick.edgePct >= 0 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                    style={{ width: `${Math.min(Math.abs(props.pick.edgePct) * 10, 100)}%` }}
                  />
                </div>
                <span className="text-sm text-slate-300">
                  {props.pick.edgeRaw.toFixed(1)} pts
                </span>
              </div>
              <div className="text-xs text-slate-400" title="Model edge vs market implied probability">
                Model edge vs market implied probability
              </div>
            </div>
          </div>
        )}

        {/* INJURY SUMMARY Section */}
        {props.injury_summary && props.injury_summary.findings.length > 0 && (
          <div className="p-4 bg-slate-800 border-b border-slate-700">
            <div className="text-center">
              <div className="text-sm font-semibold text-white mb-3">🏥 INJURY REPORT</div>
              <div className="text-xs text-slate-300 mb-3">
                {props.injury_summary.summary}
              </div>
              <div className="space-y-2">
                {props.injury_summary.findings.map((finding, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{finding.team}</span>
                      <span className="text-xs text-slate-300">{finding.player}</span>
                      <span className={`text-xs px-2 py-1 rounded ${finding.status === 'out' ? 'bg-red-600 text-white' :
                        finding.status === 'doubtful' ? 'bg-orange-600 text-white' :
                          finding.status === 'questionable' ? 'bg-yellow-600 text-black' :
                            'bg-green-600 text-white'
                        }`}>
                        {finding.status.toUpperCase()}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${finding.impact > 0 ? 'text-red-400' :
                      finding.impact < 0 ? 'text-green-400' : 'text-slate-400'
                      }`}>
                      {finding.impact > 0 ? '+' : ''}{finding.impact.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Total Impact: <span className={`font-bold ${props.injury_summary.total_impact > 0 ? 'text-red-400' :
                  props.injury_summary.total_impact < 0 ? 'text-green-400' : 'text-slate-400'
                  }`}>
                  {props.injury_summary.total_impact > 0 ? '+' : ''}{props.injury_summary.total_impact.toFixed(1)} points
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Professional Analysis - Moved here to be right above RESULTS */}
        {props.writeups && props.writeups.prediction && (
          <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20">
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-xl p-5 border border-cyan-500/20 shadow-lg">
              <div className="text-xs font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                <span>📊</span>
                <span>Professional Analysis</span>
              </div>
              <div className="text-white text-base leading-relaxed font-medium whitespace-pre-wrap">{props.writeups.prediction}</div>
            </div>
          </div>
        )}

        {/* RESULTS Section - Redesigned */}
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-t border-cyan-500/20">
          {props.results && props.results.status !== 'pending' ? (
            <div className="space-y-6">
              {/* Result Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-bold ${props.results.status === 'win' ? 'text-green-400' :
                    props.results.status === 'loss' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                    {props.results.status === 'win' ? '✅ WIN' :
                      props.results.status === 'loss' ? '❌ LOSS' : '🤝 PUSH'}
                  </div>
                  {props.results.finalScore && (
                    <div className="text-lg text-slate-300 font-semibold">
                      {props.results.finalScore.away} - {props.results.finalScore.home}
                    </div>
                  )}
                </div>
                {props.results.overallAccuracy !== undefined && (
                  <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Model Accuracy</div>
                    <div className={`text-2xl font-bold ${props.results.overallAccuracy >= 0.8 ? 'text-green-400' :
                      props.results.overallAccuracy >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                      {(props.results.overallAccuracy * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>

              {/* AI Post-Mortem Analysis */}
              {props.results.postMortem && (
                <div className="bg-slate-800/50 rounded-lg p-5 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🧠</span>
                    <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wide">AI Post-Mortem Analysis</h3>
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
                Game has not started yet. Check back to see the outcome and our AI's assessment of what we did right or wrong in predicting this matchup!
              </div>
            </div>
          )}
        </div>

        {/* Footer with Metadata */}
        <div className="p-4 bg-slate-900 border-t border-slate-700">
          {/* Metadata */}
          <div className="text-center text-slate-400 text-[10px] space-y-0.5 mb-3">
            <div>
              {safePick.type === 'SPREAD'
                ? '🎯 NBA Spread Model v1 — Advanced Statistical Analysis'
                : '🎯 NBA Totals Model v1 — Advanced Statistical Analysis'
              }
            </div>
            <div className="flex items-center justify-center gap-3">
              <span>GAME DATE: {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</span>
              <span>•</span>
              <span>PICK GENERATED: {formatLocalTime(props.generatedAt)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={props.onClose}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
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
              className="px-6 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
            >
              📋 Copy Card JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}