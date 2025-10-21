"use client"
import { useState, useEffect } from 'react'

export interface FactorConfig {
  key: string
  enabled: boolean
  weight: number
  name: string
  description: string
  dataSource: string
}

export interface FactorControlsProps {
  factors: FactorConfig[]
  onFactorsChange: (factors: FactorConfig[]) => void
  onRunClick: () => void
}

export function FactorControls(props: FactorControlsProps) {
  const [factors, setFactors] = useState<FactorConfig[]>(props.factors)
  const [showDetails, setShowDetails] = useState<string | null>(null)

  // Update local state when props change
  useEffect(() => {
    setFactors(props.factors)
  }, [props.factors])

  // Calculate weights sum
  const weightsSum = factors
    .filter(f => f.enabled)
    .reduce((sum, f) => sum + f.weight, 0)
  
  const isValidWeights = Math.abs(weightsSum - 0.70) < 0.005

  const handleToggle = (key: string) => {
    const updated = factors.map(f =>
      f.key === key ? { ...f, enabled: !f.enabled } : f
    )
    setFactors(updated)
    props.onFactorsChange(updated)
  }

  const handleWeightChange = (key: string, newWeight: number) => {
    const updated = factors.map(f =>
      f.key === key ? { ...f, weight: newWeight } : f
    )
    setFactors(updated)
    props.onFactorsChange(updated)
  }

  return (
    <div className="border border-gray-700 rounded p-4 bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-white">Step 0: Factor Configuration</h3>
        <div className={`text-xs px-2 py-1 rounded font-bold ${
          isValidWeights ? 'bg-green-800 text-green-200 border border-green-600' : 'bg-yellow-800 text-yellow-200 border border-yellow-600'
        }`}>
          Weights sum: {weightsSum.toFixed(3)} {isValidWeights ? '✓' : '⚠'}
        </div>
      </div>

      <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
        {factors.map((factor) => (
          <div key={factor.key} className="bg-gray-800 rounded p-3 border border-gray-600">
            <div className="flex items-start gap-2 mb-2">
              <input
                type="checkbox"
                checked={factor.enabled}
                onChange={() => handleToggle(factor.key)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{factor.name}</span>
                  <button
                    onClick={() => setShowDetails(showDetails === factor.key ? null : factor.key)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                    title="Show details"
                  >
                    ⓘ details
                  </button>
                </div>
                
                {/* Details Popover */}
                {showDetails === factor.key && (
                  <div className="mt-2 p-2 bg-blue-900 rounded text-xs border border-blue-700">
                    <p className="font-bold text-blue-200">Description:</p>
                    <p className="mb-2 text-white">{factor.description}</p>
                    <p className="font-bold text-blue-200">Data Source:</p>
                    <p className="text-white">{factor.dataSource}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Weight Control */}
            {factor.enabled && (
              <div className="ml-6">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.001"
                    value={factor.weight}
                    onChange={(e) => handleWeightChange(factor.key, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    max="0.5"
                    step="0.001"
                    value={factor.weight}
                    onChange={(e) => handleWeightChange(factor.key, parseFloat(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-600 rounded text-xs text-right bg-gray-900 text-white"
                  />
                  <span className="text-xs text-white font-bold w-12">
                    {(factor.weight * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Validation Warning */}
      {!isValidWeights && (
        <div className="mb-3 p-2 bg-yellow-900 border border-yellow-600 rounded text-xs text-yellow-200 font-bold">
          ⚠ Weights sum should be ~0.70 (±0.005). Current: {weightsSum.toFixed(3)}
        </div>
      )}

      {/* Run Button */}
      <button
        onClick={props.onRunClick}
        disabled={!isValidWeights}
        className={`w-full py-2 rounded font-semibold text-sm ${
          isValidWeights
            ? 'bg-blue-600 text-white hover:bg-blue-700 border-2 border-blue-800'
            : 'bg-gray-400 text-gray-700 cursor-not-allowed border-2 border-gray-500'
        }`}
      >
        Run with these settings
      </button>
    </div>
  )
}

