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
  }
  onClose: () => void
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
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border-2 border-cyan-500/30 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* CHANGE 3: Professional Header with Navy/Teal Theme */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-6 rounded-t-2xl border-b-2 border-cyan-500/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-full flex items-center justify-center border-2 border-cyan-400 shadow-lg">
                <span className="text-3xl">❄️</span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">{props.capper || 'SHIVA'}'S PICK</h1>
                <div className="text-cyan-300 text-sm font-semibold">Professional Sports Analytics</div>
              </div>
            </div>
            <button
              onClick={props.onClose}
              className="text-slate-400 hover:text-cyan-400 text-3xl font-bold transition-colors"
            >
              ×
            </button>
          </div>
          <div className="mt-4 text-right text-slate-300 text-xs space-y-1">
            <div>GAME DATE: {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</div>
            <div>PICK GENERATED: {formatLocalTime(props.generatedAt)}</div>
          </div>
        </div>

        {/* Subtitle */}
        <div className="px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-cyan-500/20">
          <div className="text-sm text-cyan-300 font-medium">
            🎯 NBA Totals Model v1 — Advanced Statistical Analysis
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
            {(safePick as any).locked_odds?.total_line && (
              <div className="text-cyan-200 text-lg font-semibold flex items-center justify-center gap-2">
                <span className="text-2xl">🔒</span>
                <span>Locked at {(safePick as any).locked_odds.total_line}</span>
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
                {[5, 6, 7, 8, 9, 10].map((threshold) => {
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

        {/* AI Writeups - Professional Analyst Style */}
        {props.writeups && (
          <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-700 border-b border-cyan-500/20 space-y-4">
            {props.writeups.prediction && (
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-xl p-5 border border-cyan-500/20 shadow-lg">
                <div className="text-xs font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                  <span>📊</span>
                  <span>Professional Analysis</span>
                </div>
                <p className="text-white text-base leading-relaxed font-medium">{props.writeups.prediction}</p>
              </div>
            )}

            {props.writeups.gamePrediction && (
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-xl p-5 border border-cyan-500/20 shadow-lg">
                <div className="text-xs font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                  <span>🎯</span>
                  <span>Score Projection</span>
                </div>
                <p className="text-cyan-100 text-sm font-medium mb-3">{props.writeups.gamePrediction}</p>
                {/* Clear predicted score display */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-4 mt-3 border border-cyan-500/30">
                  <div className="text-center">
                    <div className="text-xs text-cyan-300 font-semibold mb-2">PREDICTED FINAL SCORE</div>
                    <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
                      {props.matchup?.away || 'Away'} {safePredictedScore.away} - {safePredictedScore.home} {props.matchup?.home || 'Home'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHANGE 1: Temporarily disabled - Coming Soon placeholder */}
            <div className="bg-gradient-to-br from-amber-900 to-amber-800 border border-amber-600 rounded-lg p-4">
              <div className="text-xs font-semibold text-amber-300 uppercase mb-2">🎯 AI BOLD PREDICTIONS</div>
              <div className="text-center py-3">
                <p className="text-amber-100 text-sm font-medium">Bold Player Predictions Coming Soon</p>
                <p className="text-amber-300 text-xs mt-1">Advanced AI-powered player performance predictions</p>
              </div>
            </div>
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
          <div className="flex items-center justify-between mb-4">
            <div className="text-base font-bold text-cyan-300 flex items-center gap-2">
              <span>📈</span>
              <span>EDGE FACTORS</span>
            </div>
            {sortedFactors.length > 0 && (
              <div className="text-xs px-4 py-2 bg-gradient-to-r from-cyan-900 to-blue-900 text-cyan-200 rounded-full border border-cyan-500/40 font-semibold">
                🏆 Dominant: {sortedFactors[0].label}
              </div>
            )}
          </div>

          {/* Header Row - Over/Under Direction */}
          <div className="grid grid-cols-[50px_1fr_1fr] gap-3 mb-3 text-xs font-bold text-cyan-400">
            <div className="text-center">ICON</div>
            <div className="text-center">FACTOR</div>
            <div className="text-center">
              <div className="text-xs text-cyan-300 mb-1">OVER / UNDER</div>
            </div>
          </div>

          {/* Factor Rows - Over/Under Direction */}
          <div className="space-y-1">
            {sortedFactors.map((factor) => {
              const factorMeta = getFactorMeta(factor.key)
              const icon = factorMeta?.icon || 'ℹ️'
              const shortName = factorMeta?.shortName || factor.label || factor.key
              const tooltip = factorMeta?.description || factor.rationale || 'Factor'

              // Calculate Over/Under direction from factor scores
              // For NBA Totals: overScore = points toward OVER, underScore = points toward UNDER
              const netContribution = (factor.overScore || 0) - (factor.underScore || 0)
              const isOver = factor.overScore > 0
              const isUnder = factor.underScore > 0
              const isNeutral = Math.abs(netContribution) < 0.01

              return (
                <div
                  key={factor.key}
                  className="grid grid-cols-[50px_1fr_1fr] gap-3 items-center py-3 bg-gradient-to-r from-slate-900/60 to-slate-800/60 rounded-lg hover:from-slate-800/80 hover:to-slate-700/80 transition-all border border-cyan-500/20 hover:border-cyan-500/40"
                  onMouseEnter={() => setHoveredFactor(factor.key)}
                  onMouseLeave={() => setHoveredFactor(null)}
                >
                  {/* Icon with tooltip */}
                  <div className="text-center text-lg relative">
                    <span title={tooltip}>{icon}</span>
                    {hoveredFactor === factor.key && (
                      <div className="absolute left-full ml-3 top-0 z-20 w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg border border-slate-600">
                        {tooltip}
                      </div>
                    )}
                  </div>

                  {/* Factor Name */}
                  <div className="text-sm font-bold text-white text-center">
                    {shortName}
                  </div>

                  {/* Over/Under Direction */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-right">
                      <span className={`text-sm font-mono ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-400'}`}>
                        {isOver ? 'OVER' : isUnder ? 'UNDER' : 'NEUTRAL'}
                      </span>
                    </div>
                    <div className="w-20 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${isOver ? 'bg-green-500' : isUnder ? 'bg-red-500' : 'bg-slate-500'}`}
                        style={{
                          width: `${Math.min(Math.abs(netContribution) / 2 * 100, 100)}%`,
                          marginLeft: isOver ? '0%' : isUnder ? `${100 - Math.min(Math.abs(netContribution) / 2 * 100, 100)}%` : '50%'
                        }}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`text-xs font-mono ${isOver ? 'text-green-400' : isUnder ? 'text-red-400' : 'text-slate-400'}`}>
                        {isOver ? `+${factor.overScore.toFixed(1)}` : isUnder ? `+${factor.underScore.toFixed(1)}` : '0.0'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Market Summary Strip */}
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <div className="grid grid-cols-4 gap-4 text-center mb-3">
            <div className="bg-slate-700 rounded p-2">
              <div className="text-xs text-slate-400 uppercase mb-1">CONF7</div>
              <div className="text-lg font-mono font-bold text-white">{safeMarket.conf7.toFixed(2)}</div>
            </div>
            <div className="bg-slate-700 rounded p-2">
              <div className="text-xs text-slate-400 uppercase mb-1">MARKET ADJ</div>
              <div className={`text-lg font-mono font-bold ${safeMarket.confAdj > 0 ? 'text-green-400' : safeMarket.confAdj < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {safeMarket.confAdj > 0 ? '+' : ''}{safeMarket.confAdj.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-600 rounded p-2 border border-slate-500">
              <div className="text-xs text-slate-300 uppercase mb-1">CONF FINAL</div>
              <div className="text-xl font-mono font-bold text-white">
                {safeMarket.confFinal.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700 rounded p-2">
              <div className="text-xs text-slate-400 uppercase mb-1">DOMINANT EDGE</div>
              <div className="text-sm font-bold text-white">
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

        {/* RESULTS Section */}
        <div className="p-4 bg-slate-800">
          <div className="text-center">
            <div className="text-sm font-semibold text-white mb-3">RESULTS</div>
            {props.results && props.results.status !== 'pending' ? (
              <div className={`p-3 rounded-lg border ${props.results.status === 'win' ? 'bg-green-900 border-green-700' :
                props.results.status === 'loss' ? 'bg-red-900 border-red-700' :
                  'bg-yellow-900 border-yellow-700'
                }`}>
                <div className="text-lg font-bold text-white mb-2">
                  {props.results.status === 'win' ? '✅ WIN' :
                    props.results.status === 'loss' ? '❌ LOSS' : '🤝 PUSH'}
                </div>
                {props.results.finalScore && (
                  <div className="text-sm text-white mb-2">
                    Final: {props.results.finalScore.away} - {props.results.finalScore.home}
                  </div>
                )}
                {props.results.postMortem && (
                  <div className="text-xs text-slate-300">
                    {props.results.postMortem}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                Game has not started yet. Check back to see the outcome and our assessment of what we did right or wrong in predicting this matchup!
              </div>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="p-4 bg-slate-900 rounded-b-xl">
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