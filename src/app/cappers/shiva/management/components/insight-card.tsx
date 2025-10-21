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
  matchup: string
  homeTeam: string
  awayTeam: string
  capper: string
  sport: string
  pick: {
    type: string
    selection: string
    units: number
    confidence: number
    spread?: number
    total?: number
  }
  predictedScore: {
    home: number
    away: number
  }
  factors: Array<{
    key: string
    name: string
    contributionHome: number
    contributionAway: number
    weight: number
    rationale: string
  }>
  marketMismatch: {
    dominant: 'side' | 'total'
    edgeSide: number
    edgeTotal: number
    conf7: number
    confMarketAdj: number
    confFinal: number
  }
  aiWriteup?: {
    prediction?: string
    gamePrediction?: string
    boldPrediction?: string
  }
  isDryRun?: boolean
  pickResult?: {
    result: 'win' | 'loss' | 'push'
    unitsDelta: number
    finalScore: { home: number; away: number }
    explanation: string
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
    contributionHome: Number(f.contributionHome ?? 0),
    contributionAway: Number(f.contributionAway ?? 0),
    weight: Number(f.weight ?? 0),
    rationale: f.rationale || 'No rationale provided',
  }))

  // Sort factors by absolute contribution (sum of home + away impact)
  const sortedFactors = [...safeFactors].sort((a, b) => {
    const absA = Math.abs((a.contributionHome ?? 0) - (a.contributionAway ?? 0))
    const absB = Math.abs((b.contributionHome ?? 0) - (b.contributionAway ?? 0))
    return absB - absA
  })

  // Safe defaults for required fields
  const safePick = {
    type: props.pick?.type || 'UNKNOWN',
    selection: props.pick?.selection || 'N/A',
    units: Number(props.pick?.units ?? 0),
    confidence: Number(props.pick?.confidence ?? 0),
    spread: props.pick?.spread,
    total: props.pick?.total,
  }

  const safePredictedScore = {
    home: Number(props.predictedScore?.home ?? 0),
    away: Number(props.predictedScore?.away ?? 0),
  }

  const safeMarketMismatch = {
    dominant: props.marketMismatch?.dominant || 'side',
    edgeSide: Number(props.marketMismatch?.edgeSide ?? 0),
    edgeTotal: Number(props.marketMismatch?.edgeTotal ?? 0),
    conf7: Number(props.marketMismatch?.conf7 ?? 0),
    confMarketAdj: Math.max(-1.2, Math.min(1.2, Number(props.marketMismatch?.confMarketAdj ?? 0))),
    confFinal: Number(props.marketMismatch?.confFinal ?? 0),
  }

  return (
    <div className="border rounded-lg shadow-lg bg-white max-w-4xl mx-auto">
      {/* Header Line */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">
            {props.awayTeam || 'Away'} {safePick.spread && safePick.spread > 0 ? `+${safePick.spread}` : ''} @ {props.homeTeam || 'Home'} {safePick.spread && safePick.spread < 0 ? safePick.spread : ''}
          </div>
          <div className="text-sm">
            O/U {safePick.total || '—'}
          </div>
        </div>
      </div>

      {/* Dry-Run Chip */}
      {props.isDryRun && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          🧪 Dry-Run (no writes)
        </div>
      )}

      {/* Bet Banner */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900">
            {safePick.units} {safePick.units === 1 ? 'UNIT' : 'UNITS'} on {safePick.selection}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {props.capper || 'SHIVA'} • {props.sport || 'NBA'} • {safePick.type}
          </div>
        </div>
      </div>

      {/* AI Writeups */}
      {props.aiWriteup && (
        <div className="p-4 border-b space-y-3">
          {props.aiWriteup.prediction && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Prediction Summary</div>
              <p className="text-sm text-gray-700">{props.aiWriteup.prediction}</p>
            </div>
          )}
          
          {props.aiWriteup.gamePrediction && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Game Prediction (Score & Victor)</div>
              <p className="text-sm font-semibold text-gray-900">{props.aiWriteup.gamePrediction}</p>
            </div>
          )}
          
          {props.aiWriteup.boldPrediction && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <div className="text-xs font-semibold text-yellow-700 uppercase mb-1">Bold Prediction</div>
              <p className="text-sm font-bold text-yellow-900">{props.aiWriteup.boldPrediction}</p>
            </div>
          )}
        </div>
      )}

      {/* Predicted Score */}
      <div className="p-4 border-b bg-gray-50">
        <div className="text-center">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Predicted Score</div>
          <div className="text-3xl font-mono font-bold text-gray-900">
            {safePredictedScore.away} - {safePredictedScore.home}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {props.awayTeam || 'Away'} @ {props.homeTeam || 'Home'}
          </div>
        </div>
      </div>

      {/* Confidence Factors Grid (Two-Column Layout) */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-700">Confidence Factors</div>
          {sortedFactors.length > 0 && (
            <div className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
              Dominant: {sortedFactors[0].name}
            </div>
          )}
        </div>
        
        {/* Header Row */}
        <div className="grid grid-cols-[40px_1fr_1fr] gap-2 mb-2 text-xs font-semibold text-gray-600">
          <div></div>
          <div className="text-center">{props.awayTeam}</div>
          <div className="text-center">{props.homeTeam}</div>
        </div>

        {/* Factor Rows (Sorted by absolute impact) */}
        <div className="space-y-2">
          {sortedFactors.map((factor) => {
            const icon = FACTOR_ICONS[factor.key] || 'ℹ️'
            const tooltip = FACTOR_TOOLTIPS[factor.key] || factor.name || 'Factor'
            const differential = (factor.contributionHome ?? 0) - (factor.contributionAway ?? 0)
            
            return (
              <div
                key={factor.key}
                className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center py-2 border-b border-gray-100 hover:bg-gray-50"
                onMouseEnter={() => setHoveredFactor(factor.key)}
                onMouseLeave={() => setHoveredFactor(null)}
              >
                {/* Icon with tooltip */}
                <div className="text-center text-xl relative">
                  <span title={tooltip}>{icon}</span>
                  {hoveredFactor === factor.key && (
                    <div className="absolute left-full ml-2 top-0 z-20 w-64 bg-gray-900 text-white text-xs p-2 rounded shadow-lg">
                      {tooltip}
                    </div>
                  )}
                </div>

                {/* Away Contribution */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-right">
                    <span className={`text-sm font-mono ${
                      factor.contributionAway > 0 ? 'text-green-600' :
                      factor.contributionAway < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {factor.contributionAway > 0 ? '+' : ''}{factor.contributionAway.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${factor.contributionAway > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(factor.contributionAway) / 6 * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Home Contribution */}
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${factor.contributionHome > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(factor.contributionHome) / 6 * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-mono ${
                      factor.contributionHome > 0 ? 'text-green-600' :
                      factor.contributionHome < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {factor.contributionHome > 0 ? '+' : ''}{factor.contributionHome.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Factor Notes */}
        <div className="mt-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Weight applied:</span>
            <span>{(safeFactors.reduce((sum, f) => sum + (f.weight ?? 0), 0) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Market Summary Strip */}
      <div className="p-4 border-b bg-gray-50">
        <div className="grid grid-cols-4 gap-4 text-center text-sm mb-3">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Conf7</div>
            <div className="font-mono font-bold">{safeMarketMismatch.conf7.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Market Adj</div>
            <div className={`font-mono font-bold ${
              safeMarketMismatch.confMarketAdj > 0 ? 'text-green-600' : 
              safeMarketMismatch.confMarketAdj < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {safeMarketMismatch.confMarketAdj > 0 ? '+' : ''}
              {safeMarketMismatch.confMarketAdj.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Conf Final</div>
            <div className="font-mono font-bold text-blue-600 text-lg">
              {safeMarketMismatch.confFinal.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Dominant Edge</div>
            <div className="font-semibold">{safeMarketMismatch.dominant.toUpperCase()}</div>
            <div className="text-xs text-gray-600">
              Side: {safeMarketMismatch.edgeSide.toFixed(1)}pts
              <br />
              Total: {safeMarketMismatch.edgeTotal.toFixed(1)}pts
            </div>
          </div>
        </div>
        
        {/* Market Influence Mini-Bar (±30% scale) */}
        <div className="mt-2">
          <div className="text-xs text-gray-500 text-center mb-1">
            Market Influence (max ±30%)
          </div>
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-400" />
            
            {/* Market adjustment bar */}
            <div
              className={`absolute top-0 bottom-0 ${
                safeMarketMismatch.confMarketAdj > 0 ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{
                left: safeMarketMismatch.confMarketAdj >= 0 ? '50%' : 
                      `${50 + (safeMarketMismatch.confMarketAdj / 1.2) * 50}%`,
                width: `${Math.abs(safeMarketMismatch.confMarketAdj / 1.2) * 50}%`,
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
          <div className="text-sm text-gray-600">Confidence Score</div>
          <div className="text-3xl font-bold text-blue-600">
            {safeMarketMismatch.confFinal.toFixed(2)} / 5.0
          </div>
          <div className="mt-2">
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                style={{ width: `${Math.min(100, Math.max(0, (safeMarketMismatch.confFinal / 5.0) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS Section (Placeholder for Pick Grading) */}
      {props.pickResult && (
        <div className="p-4 border-b">
          <div className="text-sm font-semibold text-gray-700 mb-3">RESULTS</div>
          <div className={`p-3 rounded ${
            props.pickResult.result === 'win' ? 'bg-green-50 border border-green-200' :
            props.pickResult.result === 'loss' ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-lg font-bold ${
                props.pickResult.result === 'win' ? 'text-green-700' :
                props.pickResult.result === 'loss' ? 'text-red-700' :
                'text-yellow-700'
              }`}>
                {props.pickResult.result.toUpperCase()}
              </span>
              <span className={`text-lg font-mono font-bold ${
                props.pickResult.unitsDelta > 0 ? 'text-green-700' :
                props.pickResult.unitsDelta < 0 ? 'text-red-700' :
                'text-gray-700'
              }`}>
                {props.pickResult.unitsDelta > 0 ? '+' : ''}{props.pickResult.unitsDelta}u
              </span>
            </div>
            <div className="text-sm text-gray-700 mb-2">
              Final: {props.pickResult.finalScore.away} - {props.pickResult.finalScore.home}
            </div>
            <div className="text-xs text-gray-600">
              {props.pickResult.explanation}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
