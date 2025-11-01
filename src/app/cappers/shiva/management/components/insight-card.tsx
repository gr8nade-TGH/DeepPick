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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Subtle Tech Header */}
        <div className="bg-slate-800 p-6 rounded-t-xl border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600">
                <span className="text-2xl">❄️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{props.capper || 'SHIVA'}'S PICK</h1>
                <div className="text-slate-300 text-sm">AI-Powered Prediction Engine</div>
              </div>
            </div>
            <div className="text-right text-slate-300 text-sm">
              <div className="mb-1">GAME DATE: {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</div>
              <div className="mb-1">GAME ID: {props.gameId || '#'}</div>
              {props.pickId && <div className="mb-1">PICK ID: {props.pickId}</div>}
              <div>PICK GENERATED: {formatLocalTime(props.generatedAt)}</div>
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <div className="px-6 py-2 bg-slate-800 border-b border-slate-700">
          <div className="text-sm text-slate-300">
            NBA Totals Model v1 — 5 factors weighted for Over/Under prediction
          </div>
        </div>

        {/* Matchup Line */}
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <div className="text-center">
            <div className="text-lg font-bold text-white mb-1">
              {props.matchup?.spreadText || 'AWAY +spread @ HOME -spread'}
            </div>
            <div className="text-slate-300">
              {props.matchup?.totalText || 'O/U {total_line}'}
            </div>
          </div>
        </div>

        {/* Bet Banner - LIT UP AND PRONOUNCED */}
        <div className="p-8 bg-gradient-to-r from-green-900 via-emerald-800 to-green-900 border-4 border-green-400 border-b border-slate-600 shadow-2xl relative overflow-hidden">
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>

          <div className="text-center relative z-10">
            <div className="text-5xl font-black text-white mb-4 drop-shadow-2xl tracking-wide">
              {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
            </div>
            {(safePick as any).locked_odds?.total_line && (
              <div className="text-green-200 text-lg mb-3 font-bold">
                🔒 Locked at {(safePick as any).locked_odds.total_line}
              </div>
            )}
            <div className="text-green-100 text-lg font-bold">
              {props.capper || 'SHIVA'} • {props.sport || 'NBA'} • {safePick.type} • {safePick.confidence.toFixed(1)}% Confidence
            </div>
          </div>
        </div>

        {/* AI Writeups */}
        {props.writeups && (
          <div className="p-4 bg-slate-800 border-b border-slate-700 space-y-3">
            {props.writeups.prediction && (
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-300 uppercase mb-2">PREDICTION WRITEUP</div>
                <p className="text-white text-sm leading-relaxed">{props.writeups.prediction}</p>
              </div>
            )}

            {props.writeups.gamePrediction && (
              <div className="bg-slate-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-300 uppercase mb-2">GAME PREDICTION (SCORE AND VICTOR)</div>
                <p className="text-white text-base font-semibold mb-2">{props.writeups.gamePrediction}</p>
                {/* Clear predicted score display */}
                <div className="bg-slate-600 rounded p-2 mt-2">
                  <div className="text-center">
                    <div className="text-sm text-slate-300 mb-1">PREDICTED FINAL SCORE</div>
                    <div className="text-lg font-bold text-white">
                      {props.matchup?.away || 'Away'} {safePredictedScore.away} - {safePredictedScore.home} {props.matchup?.home || 'Home'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {props.bold_predictions && props.bold_predictions.predictions && props.bold_predictions.predictions.length > 0 ? (
              <div className="bg-amber-900 border border-amber-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-300 uppercase mb-2">AI BOLD PREDICTIONS</div>
                <div className="space-y-3">
                  {props.bold_predictions.predictions.map((pred, index) => (
                    <div key={index} className="bg-amber-800 rounded p-2">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-amber-100 font-semibold text-sm">{pred.player}</span>
                        <span className="text-amber-300 text-xs px-2 py-1 rounded bg-amber-700">
                          {pred.confidence}
                        </span>
                      </div>
                      <p className="text-amber-200 text-sm font-medium mb-1">{pred.prediction}</p>
                      <p className="text-amber-300 text-xs">{pred.reasoning}</p>
                    </div>
                  ))}
                  {props.bold_predictions.summary && (
                    <div className="text-amber-100 text-sm font-medium mt-2 p-2 bg-amber-800 rounded">
                      {props.bold_predictions.summary}
                    </div>
                  )}
                </div>
              </div>
            ) : props.writeups.bold ? (
              <div className="bg-amber-900 border border-amber-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-300 uppercase mb-2">AI BOLD PREDICTION</div>
                <p className="text-amber-100 text-sm font-semibold">{props.writeups.bold}</p>
              </div>
            ) : (
              <div className="bg-amber-900 border border-amber-700 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-300 uppercase mb-2">AI BOLD PREDICTIONS</div>
                <p className="text-amber-100 text-sm">No prediction available.</p>
              </div>
            )}
          </div>
        )}

        {/* Injury Summary */}
        {props.injury_summary && (
          <div className="p-4 bg-slate-800 border-b border-slate-700">
            <div className="text-sm font-semibold text-white mb-2">INJURY SUMMARY</div>
            <div className="bg-slate-700 rounded p-3">
              <p className="text-slate-300 text-sm">{props.injury_summary.summary}</p>
              {props.injury_summary.findings && props.injury_summary.findings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {props.injury_summary.findings.map((finding, index) => (
                    <div key={index} className="text-xs text-slate-400">
                      {finding.team}: {finding.player} - {finding.status} (Impact: {finding.impact})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confidence Factors Table - OVER/UNDER DIRECTION */}
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">EDGE FACTORS:</div>
            {sortedFactors.length > 0 && (
              <div className="text-xs px-3 py-1 bg-slate-600 text-slate-200 rounded-full border border-slate-500">
                🏆 Dominant: {sortedFactors[0].label}
              </div>
            )}
          </div>

          {/* Header Row - Over/Under Direction */}
          <div className="grid grid-cols-[50px_1fr_1fr] gap-3 mb-3 text-xs font-semibold text-slate-400">
            <div className="text-center">FACTOR ICONS</div>
            <div className="text-center">FACTOR NAME</div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">OVER / UNDER</div>
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
                  className="grid grid-cols-[50px_1fr_1fr] gap-3 items-center py-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors border border-slate-600"
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

          {/* Market Influence Mini-Bar (±30% scale) */}
          <div className="mt-3">
            <div className="text-xs text-slate-400 text-center mb-2">
              Market Influence (max ±30%)
            </div>
            <div className="relative h-2 bg-slate-600 rounded-full overflow-hidden">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500" />

              {/* Market adjustment bar */}
              <div
                className={`absolute top-0 bottom-0 ${safeMarket.confAdj > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{
                  left: safeMarket.confAdj >= 0 ? '50%' : `${50 + (safeMarket.confAdj / 1.2) * 50}%`,
                  width: `${Math.abs(safeMarket.confAdj / 1.2) * 50}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>-30%</span>
              <span>0</span>
              <span>+30%</span>
            </div>
          </div>
        </div>

        {/* Confidence Score Footer */}
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <div className="text-center">
            <div className="text-sm text-slate-300 mb-2">Edge Score = {Math.min(safeMarket.confFinal, 10).toFixed(1)} / 10.0</div>
            <div className="relative h-3 bg-slate-600 rounded-full overflow-hidden mx-auto max-w-xs">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                style={{ width: `${Math.min((safeMarket.confFinal / 10) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {safeMarket.confFinal >= 8 ? '🔥 HIGH EDGE' :
                safeMarket.confFinal >= 6 ? '⚡ MODERATE EDGE' :
                  safeMarket.confFinal >= 4 ? '⚠️ LOW EDGE' : '❌ VERY LOW EDGE'}
            </div>
          </div>
        </div>

        {/* Edge Bar */}
        {props.pick.edgeRaw !== undefined && props.pick.edgePct !== undefined && (
          <div className="p-4 bg-slate-800 border-b border-slate-700">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-sm font-bold text-slate-300">EDGE</span>
                <span className={`text-lg font-bold ${props.pick.edgeRaw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {props.pick.edgeRaw >= 0 ? '+' : ''}{(props.pick.edgeRaw * 100).toFixed(1)}%
                </span>
                <div className="relative w-32 h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${props.pick.edgeRaw >= 0 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                    style={{ width: `${Math.min(Math.abs(props.pick.edgeRaw) * 200, 100)}%` }}
                  />
                </div>
                <span className="text-sm text-slate-300">
                  {(props.pick.edgePct * 100).toFixed(0)}%
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
            {props.results ? (
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
                Game has not yet started yet, check back to see the outcome and our assessment of what we did right or wrong in predicting this matchup!
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