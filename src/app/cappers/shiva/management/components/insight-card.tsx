"use client"
import { useState } from 'react'

// Factor icon mapping (from spec)
const FACTOR_ICONS: Record<string, string> = {
  seasonNet: '📈',
  recentNet: '🔥',
  h2hPpg: '🤝',
  matchupORtgDRtg: '🎯',
  threePoint: '🏀',
  newsEdge: '🏥',
  homeEdge: '🏠',
}

const FACTOR_LABELS: Record<string, string> = {
  seasonNet: 'Season Net',
  recentNet: 'Recent 10',
  h2hPpg: 'H2H',
  matchupORtgDRtg: 'ORtg/DRtg',
  threePoint: '3PT',
  newsEdge: 'News',
  homeEdge: 'Home',
}

const FACTOR_TOOLTIPS: Record<string, string> = {
  seasonNet: 'Season Net Rating: Team Net Rating (ORtg-DRtg) differential. Core strength signal.',
  recentNet: 'Recent Form: Net Rating over last 10 games. Momentum indicator.',
  h2hPpg: 'Head-to-Head PPG: Season PPG by each team vs this opponent. Style/fit history.',
  matchupORtgDRtg: 'Off/Def Rating Differential: Offensive vs Defensive rating mismatch. Matchup quality.',
  threePoint: '3-Point Environment: 3PA rate / 3P% / opponent 3PA context. Variance lever.',
  newsEdge: 'News/Injury Edge: Injury/availability impact within last 48-72h. Capped at ±3 per 100.',
  homeEdge: 'Home Court Edge: Generic home advantage adjustment. Default +1.5 per 100.',
}

export interface InsightCardProps {
  capper: string
  capperIconUrl?: string
  sport: 'NBA' | 'MLB' | 'NFL'
  gameId: string
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
  factors: Array<{
    key: string
    label: string
    icon: string
    awayContribution: number
    homeContribution: number
    weightAppliedPct: number
    rationale?: string
  }>
  market: { 
    conf7: number
    confAdj: number
    confFinal: number
    dominant: 'side' | 'total'
  }
  state: { 
    dryRun: boolean
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
    awayContribution: Number(f.awayContribution ?? 0),
    homeContribution: Number(f.homeContribution ?? 0),
    weightAppliedPct: Number(f.weightAppliedPct ?? 0),
    rationale: f.rationale || 'No rationale provided',
  }))

  // Sort factors by absolute contribution (sum of home + away impact)
  const sortedFactors = [...safeFactors].sort((a, b) => {
    const absA = Math.abs((a.awayContribution ?? 0) + (a.homeContribution ?? 0))
    const absB = Math.abs((b.awayContribution ?? 0) + (b.homeContribution ?? 0))
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-2xl shadow-2xl border-2 border-cyan-400 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* ICO-Style Header */}
        <div className="bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 p-6 rounded-t-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 transform -skew-x-12"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white border-opacity-30">
                <span className="text-3xl">❄️</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-wide">{props.capper || 'SHIVA'}'S PICK</h1>
                <div className="text-cyan-100 text-lg font-medium">AI-Powered Prediction Engine</div>
                <div className="text-cyan-200 text-sm">Blockchain-Grade Analytics</div>
              </div>
            </div>
            <div className="text-right text-white">
              <div className="text-sm text-cyan-100 mb-1 font-medium">GAME DATE: {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</div>
              <div className="text-sm text-cyan-100 mb-1 font-medium">GAME ID: {props.gameId || '#'}</div>
              <div className="text-sm text-cyan-100 font-medium">PICK GENERATED: {formatLocalTime(props.generatedAt)}</div>
            </div>
          </div>
        </div>

        {/* Matchup Line */}
        <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-cyan-400 border-opacity-30">
          <div className="text-center">
            <div className="text-xl font-bold text-white mb-2">
              {props.matchup?.spreadText || 'AWAY +spread @ HOME -spread'}
            </div>
            <div className="text-lg text-cyan-200 font-medium">
              {props.matchup?.totalText || 'O/U {total_line}'}
            </div>
          </div>
        </div>

        {/* Bet Banner */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-cyan-600 border-b border-cyan-400 border-opacity-30">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-3 tracking-wide">
              {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
            </div>
            <div className="text-lg text-emerald-100 font-medium">
              {props.capper || 'SHIVA'} • {props.sport || 'NBA'} • {safePick.type}
            </div>
          </div>
        </div>

        {/* AI Writeups */}
        {props.writeups && (
          <div className="p-6 bg-gradient-to-r from-slate-800 to-blue-900 border-b border-cyan-400 border-opacity-30 space-y-4">
            {props.writeups.prediction && (
              <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-sm font-bold text-cyan-300 uppercase mb-2 tracking-wide">🤖 AI PREDICTION WRITEUP</div>
                <p className="text-white text-base leading-relaxed">{props.writeups.prediction}</p>
              </div>
            )}
            
            {props.writeups.gamePrediction && (
              <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-sm font-bold text-cyan-300 uppercase mb-2 tracking-wide">🎯 AI GAME PREDICTION (SCORE AND VICTOR)</div>
                <p className="text-white text-lg font-bold">{props.writeups.gamePrediction}</p>
              </div>
            )}
            
            {props.writeups.bold && (
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg p-4 border border-yellow-400">
                <div className="text-sm font-bold text-yellow-900 uppercase mb-2 tracking-wide">⚡ AI BOLD PREDICTION</div>
                <p className="text-yellow-900 text-base font-bold">{props.writeups.bold}</p>
              </div>
            )}
          </div>
        )}

        {/* Confidence Factors Table */}
        <div className="p-6 bg-gradient-to-r from-slate-800 to-purple-900 border-b border-cyan-400 border-opacity-30">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-bold text-white tracking-wide">CONFIDENCE FACTORS:</div>
            {sortedFactors.length > 0 && (
              <div className="text-sm px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full border border-purple-300 font-bold">
                🏆 Dominant: {sortedFactors[0].label}
              </div>
            )}
          </div>
          
          {/* Header Row with tiny labels */}
          <div className="grid grid-cols-[50px_1fr_1fr] gap-3 mb-3 text-sm font-bold text-cyan-300">
            <div className="text-center">FACTOR ICONS</div>
            <div className="text-center border-r border-cyan-400 border-opacity-50 pr-3">
              <div className="text-xs text-cyan-200 mb-1">{props.matchup?.away?.split(' ').pop() || 'AWAY'}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-cyan-200 mb-1">{props.matchup?.home?.split(' ').pop() || 'HOME'}</div>
            </div>
          </div>

          {/* Factor Rows (Sorted by absolute impact) */}
          <div className="space-y-2">
            {sortedFactors.map((factor) => {
              const icon = factor.icon || FACTOR_ICONS[factor.key] || 'ℹ️'
              const tooltip = FACTOR_TOOLTIPS[factor.key] || factor.rationale || 'Factor'
              
              return (
                <div
                  key={factor.key}
                  className="grid grid-cols-[50px_1fr_1fr] gap-3 items-center py-3 bg-white bg-opacity-5 rounded-lg hover:bg-opacity-10 transition-all duration-200 border border-cyan-400 border-opacity-20"
                  onMouseEnter={() => setHoveredFactor(factor.key)}
                  onMouseLeave={() => setHoveredFactor(null)}
                >
                  {/* Icon with tooltip */}
                  <div className="text-center text-xl relative">
                    <span title={tooltip} className="drop-shadow-lg">{icon}</span>
                    {hoveredFactor === factor.key && (
                      <div className="absolute left-full ml-3 top-0 z-20 w-72 bg-slate-900 text-white text-sm p-3 rounded-lg shadow-xl border border-cyan-400">
                        {tooltip}
                      </div>
                    )}
                  </div>

                  {/* Away Contribution */}
                  <div className="flex items-center gap-3 border-r border-cyan-400 border-opacity-30 pr-3">
                    <div className="flex-1 text-right">
                      <span className={`text-base font-mono font-bold ${factor.awayContribution > 0 ? 'text-emerald-400' : factor.awayContribution < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {factor.awayContribution > 0 ? '+' : ''}{factor.awayContribution.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                      <div
                        className={`h-full ${factor.awayContribution > 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                        style={{ width: `${Math.min(Math.abs(factor.awayContribution) / 6 * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Home Contribution */}
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                      <div
                        className={`h-full ${factor.homeContribution > 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                        style={{ width: `${Math.min(Math.abs(factor.homeContribution) / 6 * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`text-base font-mono font-bold ${factor.homeContribution > 0 ? 'text-emerald-400' : factor.homeContribution < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {factor.homeContribution > 0 ? '+' : ''}{factor.homeContribution.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
      </div>

        {/* Market Summary Strip */}
        <div className="p-6 bg-gradient-to-r from-slate-800 to-indigo-900 border-b border-cyan-400 border-opacity-30">
          <div className="grid grid-cols-4 gap-6 text-center mb-4">
            <div className="bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-xs text-cyan-300 uppercase mb-2 tracking-wide font-bold">CONF7</div>
              <div className="text-xl font-mono font-bold text-white">{safeMarket.conf7.toFixed(2)}</div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-xs text-cyan-300 uppercase mb-2 tracking-wide font-bold">MARKET ADJ</div>
              <div className={`text-xl font-mono font-bold ${safeMarket.confAdj > 0 ? 'text-emerald-400' : safeMarket.confAdj < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {safeMarket.confAdj > 0 ? '+' : ''}{safeMarket.confAdj.toFixed(2)}
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-3 border border-blue-400">
              <div className="text-xs text-blue-100 uppercase mb-2 tracking-wide font-bold">CONF FINAL</div>
              <div className="text-2xl font-mono font-bold text-white">
                {safeMarket.confFinal.toFixed(2)}
              </div>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-xs text-cyan-300 uppercase mb-2 tracking-wide font-bold">DOMINANT EDGE</div>
              <div className="text-lg font-bold text-white">{safeMarket.dominant.toUpperCase()}</div>
            </div>
          </div>
          
          {/* Market Influence Mini-Bar (±30% scale) */}
          <div className="mt-4">
            <div className="text-sm text-cyan-300 text-center mb-2 font-medium">
              Market Influence (max ±30%)
            </div>
            <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400" />
              
              {/* Market adjustment bar */}
              <div
                className={`absolute top-0 bottom-0 ${safeMarket.confAdj > 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                style={{
                  left: safeMarket.confAdj >= 0 ? '50%' : `${50 + (safeMarket.confAdj / 1.2) * 50}%`,
                  width: `${Math.abs(safeMarket.confAdj / 1.2) * 50}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-cyan-300 mt-2 font-medium">
              <span>-30%</span>
              <span>0</span>
              <span>+30%</span>
            </div>
          </div>
        </div>

        {/* Confidence Score Footer */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 border-b border-cyan-400 border-opacity-30">
          <div className="text-center">
            <div className="text-lg text-blue-100 mb-3 font-medium">Confidence Score = {safeMarket.confFinal.toFixed(1)} / 5.0</div>
            <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden border border-slate-600 mx-auto max-w-md">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500"
                style={{ width: `${Math.min((safeMarket.confFinal / 5) * 100, 100)}%` }}
              />
            </div>
            <div className="text-sm text-blue-200 mt-2 font-medium">
              {safeMarket.confFinal >= 4 ? '🔥 HIGH CONFIDENCE' : 
               safeMarket.confFinal >= 3 ? '⚡ MODERATE CONFIDENCE' : 
               safeMarket.confFinal >= 2 ? '⚠️ LOW CONFIDENCE' : '❌ VERY LOW CONFIDENCE'}
            </div>
          </div>
        </div>

        {/* RESULTS Section */}
        <div className="p-6 bg-gradient-to-r from-slate-800 to-gray-900">
          <div className="text-center">
            <div className="text-lg font-bold text-white mb-4">RESULTS</div>
            {props.results ? (
              <div className={`p-4 rounded-lg border-2 ${
                props.results.status === 'win' ? 'bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400' :
                props.results.status === 'loss' ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-400' :
                'bg-gradient-to-r from-yellow-500 to-orange-500 border-yellow-400'
              }`}>
                <div className="text-xl font-bold text-white mb-2">
                  {props.results.status === 'win' ? '✅ WIN' : 
                   props.results.status === 'loss' ? '❌ LOSS' : '🤝 PUSH'}
                </div>
                {props.results.finalScore && (
                  <div className="text-lg text-white mb-2">
                    Final: {props.results.finalScore.away} - {props.results.finalScore.home}
                  </div>
                )}
                {props.results.postMortem && (
                  <div className="text-sm text-white opacity-90">
                    {props.results.postMortem}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-lg text-yellow-400 font-medium">
                Game has not yet started yet, check back to see the outcome and our assessment of what we did right or wrong in predicting this matchup!
              </div>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-b-2xl">
          <div className="flex justify-center gap-4">
            <button
              onClick={props.onClose}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold hover:from-red-700 hover:to-red-800 transition-all duration-200 border border-red-500"
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
                  state: props.state,
                  results: props.results,
                }
                navigator.clipboard.writeText(JSON.stringify(cardData, null, 2))
                alert('Insight Card JSON copied to clipboard!')
              }}
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-bold hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 border border-cyan-400"
            >
              📋 Copy Card JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}