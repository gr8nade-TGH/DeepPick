"use client"

export interface InsightCardProps {
  matchup: string
  capper: string
  sport: string
  pick: {
    type: string
    selection: string
    units: number
    confidence: number
  }
  predictedScore: {
    home: number
    away: number
  }
  factors: Array<{
    name: string
    contribution: number
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
}

export function InsightCard(props: InsightCardProps) {
  // Sort factors by absolute contribution (highest impact first)
  const sortedFactors = [...props.factors].sort((a, b) => 
    Math.abs(b.contribution) - Math.abs(a.contribution)
  )

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b pb-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{props.matchup}</h3>
            <div className="text-xs text-gray-500">
              {props.capper} • {props.sport}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {props.pick.type} {props.pick.selection}
            </div>
            <div className="text-sm text-gray-600">
              {props.pick.units}U • Conf: {props.pick.confidence.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Prediction */}
      <div className="bg-gray-50 rounded p-3 mb-3">
        <div className="text-xs font-semibold text-gray-600 mb-1">Predicted Score</div>
        <div className="text-lg font-mono">
          {props.predictedScore.home} - {props.predictedScore.away}
        </div>
      </div>

      {/* Factors (Only Enabled Ones) */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">Factor Contributions</div>
        <div className="space-y-2">
          {sortedFactors.map((factor, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{factor.name}</span>
                  <span className="text-xs text-gray-500">
                    {(factor.weight * 100).toFixed(1)}% weight
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{factor.rationale}</div>
              </div>
              <div className="flex items-center gap-2">
                {/* Contribution Bar */}
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      factor.contribution > 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(Math.abs(factor.contribution) / 6 * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className={`text-sm font-mono w-12 text-right ${
                  factor.contribution > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {factor.contribution > 0 ? '+' : ''}{factor.contribution.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Mismatch Summary */}
      <div className="border-t pt-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">Market Analysis</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">Conf7</div>
            <div className="font-mono">{props.marketMismatch.conf7.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Market Adj</div>
            <div className="font-mono">
              {props.marketMismatch.confMarketAdj > 0 ? '+' : ''}
              {props.marketMismatch.confMarketAdj.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Final</div>
            <div className="font-mono font-bold">{props.marketMismatch.confFinal.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          Dominant edge: <span className="font-semibold">{props.marketMismatch.dominant}</span>
          {' '}(Side: {props.marketMismatch.edgeSide.toFixed(1)}pts, Total: {props.marketMismatch.edgeTotal.toFixed(1)}pts)
        </div>
      </div>
    </div>
  )
}

