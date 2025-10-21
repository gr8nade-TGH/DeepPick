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
    <div className="border rounded-lg shadow-lg bg-white max-w-4xl mx-auto">
      {/* Header Block */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-lg">
              {props.capperIconUrl ? (
                <img src={props.capperIconUrl} alt={props.capper} className="w-6 h-6" />
              ) : (
                '❄️' // Ice elemental icon for SHIVA
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {props.capper || 'SHIVA'}'S PICK
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <div>GAME DATE: {formatLocalDate(props.matchup?.gameDateLocal || props.generatedAt)}</div>
            <div>GAME ID: {props.gameId || '#'}</div>
            <div>PICK GENERATED: {formatLocalTime(props.generatedAt)}</div>
          </div>
        </div>
      </div>

      {/* Matchup Line */}
      <div className="p-4 border-b bg-gray-50">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">
            {props.matchup?.spreadText || 'AWAY +spread @ HOME -spread'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {props.matchup?.totalText || 'O/U {total_line}'}
          </div>
        </div>
      </div>

      {/* Bet Banner */}
      <div className="p-4 border-b">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
          </div>
          <div className="text-sm text-gray-600">
            {props.capper || 'SHIVA'} • {props.sport || 'NBA'} • {safePick.type}
          </div>
        </div>
      </div>

      {/* AI Writeups */}
      {props.writeups && (
        <div className="p-4 border-b space-y-3">
          {props.writeups.prediction && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">AI PREDICTION WRITEUP</div>
              <p className="text-sm text-gray-700">{props.writeups.prediction}</p>
            </div>
          )}
          
          {props.writeups.gamePrediction && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">AI GAME PREDICTION (SCORE AND VICTOR)</div>
              <p className="text-sm font-semibold text-gray-900">{props.writeups.gamePrediction}</p>
            </div>
          )}
          
          {props.writeups.bold && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <div className="text-xs font-semibold text-yellow-700 uppercase mb-1">AI BOLD PREDICTION</div>
              <p className="text-sm font-bold text-yellow-900">{props.writeups.bold}</p>
            </div>
          )}
        </div>
      )}

      {/* Confidence Factors Table */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700">CONFIDENCE FACTORS:</div>
          {sortedFactors.length > 0 && (
            <div className="text-xs px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 rounded-full border border-purple-200 font-semibold">
              🏆 Dominant: {sortedFactors[0].label}
            </div>
          )}
        </div>
        
        {/* Header Row with tiny labels */}
        <div className="grid grid-cols-[40px_1fr_1fr] gap-2 mb-2 text-xs font-semibold text-gray-600">
          <div className="text-center">FACTOR ICONS</div>
          <div className="text-center border-r border-gray-300">
            <div className="text-xs text-gray-400 mb-1">{props.matchup?.away?.split(' ').pop() || 'AWAY'}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">{props.matchup?.home?.split(' ').pop() || 'HOME'}</div>
          </div>
        </div>

        {/* Factor Rows (Sorted by absolute impact) */}
        <div className="space-y-1">
          {sortedFactors.map((factor) => {
            const icon = factor.icon || FACTOR_ICONS[factor.key] || 'ℹ️'
            const tooltip = FACTOR_TOOLTIPS[factor.key] || factor.rationale || 'Factor'
            
            return (
              <div
                key={factor.key}
                className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center py-1 border-b border-gray-100 hover:bg-gray-50"
                onMouseEnter={() => setHoveredFactor(factor.key)}
                onMouseLeave={() => setHoveredFactor(null)}
              >
                {/* Icon with tooltip */}
                <div className="text-center text-lg relative">
                  <span title={tooltip}>{icon}</span>
                  {hoveredFactor === factor.key && (
                    <div className="absolute left-full ml-2 top-0 z-20 w-64 bg-gray-900 text-white text-xs p-2 rounded shadow-lg">
                      {tooltip}
                    </div>
                  )}
                </div>

                {/* Away Contribution */}
                <div className="flex items-center gap-2 border-r border-gray-300 pr-2">
                  <div className="flex-1 text-right">
                    <span className={`text-sm font-mono ${factor.awayContribution > 0 ? 'text-green-600' : factor.awayContribution < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {factor.awayContribution > 0 ? '+' : ''}{factor.awayContribution.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${factor.awayContribution > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(factor.awayContribution) / 6 * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Home Contribution */}
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${factor.homeContribution > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(factor.homeContribution) / 6 * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-mono ${factor.homeContribution > 0 ? 'text-green-600' : factor.homeContribution < 0 ? 'text-red-600' : 'text-gray-500'}`}>
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
      <div className="p-4 border-b bg-gray-50">
        <div className="grid grid-cols-4 gap-4 text-center text-sm mb-3">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">CONF7</div>
            <div className="font-mono font-bold">{safeMarket.conf7.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">MARKET ADJ</div>
            <div className={`font-mono font-bold ${safeMarket.confAdj > 0 ? 'text-green-600' : safeMarket.confAdj < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {safeMarket.confAdj > 0 ? '+' : ''}{safeMarket.confAdj.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">CONF FINAL</div>
            <div className="font-mono font-bold text-blue-600 text-lg">
              {safeMarket.confFinal.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">DOMINANT EDGE</div>
            <div className="font-semibold">{safeMarket.dominant.toUpperCase()}</div>
          </div>
        </div>
        
        {/* Market Influence Mini-Bar (±30% scale) */}
        <div className="mt-2">
          <div className="text-xs text-gray-500 text-center mb-1">
            Market Influence (max ±30%)
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400" />
            
            {/* Market adjustment bar */}
            <div
              className={`absolute top-0 bottom-0 ${safeMarket.confAdj > 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{
                left: safeMarket.confAdj >= 0 ? '50%' : `${50 + (safeMarket.confAdj / 1.2) * 50}%`,
                width: `${Math.abs(safeMarket.confAdj / 1.2) * 50}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>-30%</span>
            <span>0</span>
            <span>+30%</span>
          </div>
        </div>
      </div>

      {/* Confidence Score Footer */}
      <div className="p-4 border-b bg-blue-50">
        <div className="text-center">
          <div className="text-sm text-gray-600">Confidence Score = {safeMarket.confFinal.toFixed(1)} / 5.0</div>
          <div className="mt-2">
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                style={{ width: `${Math.min(100, Math.max(0, (safeMarket.confFinal / 5.0) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS Section */}
      <div className="p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">RESULTS</div>
        {props.results ? (
          <div className={`p-3 rounded ${
            props.results.status === 'win' ? 'bg-green-50 border border-green-200' :
            props.results.status === 'loss' ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-lg font-bold ${
                props.results.status === 'win' ? 'text-green-700' :
                props.results.status === 'loss' ? 'text-red-700' :
                'text-yellow-700'
              }`}>
                {props.results.status.toUpperCase()}
              </span>
            </div>
            {props.results.finalScore && (
              <div className="text-sm text-gray-700 mb-2">
                Final: {props.results.finalScore.away} - {props.results.finalScore.home}
              </div>
            )}
            {props.results.postMortem && (
              <div className="text-xs text-gray-600">
                {props.results.postMortem}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            Game has not yet started yet, check back to see the outcome and our assessment of what we did right or wrong in predicting this matchup!
          </div>
        )}
      </div>
    </div>
  )
}