'use client'

/**
 * Factor Configuration Modal
 * Allows users to configure which factors are used and their settings
 */

import { useState, useEffect } from 'react'
import { FactorConfig, CapperProfile, DataSource } from '@/types/factor-config'

interface FactorConfigModalProps {
  isOpen: boolean
  onClose: () => void
  capperId: string
  sport: string
  betType: string
  onSave: (profile: CapperProfile) => void
}

export function FactorConfigModal({
  isOpen,
  onClose,
  capperId,
  sport,
  betType,
  onSave
}: FactorConfigModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<CapperProfile | null>(null)
  const [factors, setFactors] = useState<FactorConfig[]>([])
  
  // Calculate weight budget
  const totalWeight = factors.filter(f => f.enabled).reduce((sum, f) => sum + f.weight, 0)
  const remainingWeight = 100 - totalWeight
  const isWeightValid = totalWeight === 100
  
  // Factor logic definitions for the Logic Drawer
  const getFactorLogic = (key: string) => {
    const logicMap: Record<string, { metric: string; formula: string; examples: string[] }> = {
      paceIndex: {
        metric: "Expected pace vs league average",
        formula: "s = clamp((expPace - leaguePace) / 6, -1, +1)",
        examples: [
          "+6 pace → s=+1 → 100% positive",
          "+3 pace → s=+0.5 → 50% positive", 
          "-3 pace → s=-0.5 → 50% negative"
        ]
      },
      offForm: {
        metric: "Offensive form vs opponent defense",
        formula: "s = clamp((teamORtg + oppDRtg - 2×leagueORtg) / 10, -1, +1)",
        examples: [
          "+10 ORtg → s=+1 → 100% positive",
          "+5 ORtg → s=+0.5 → 50% positive",
          "-5 ORtg → s=-0.5 → 50% negative"
        ]
      },
      defErosion: {
        metric: "Defensive erosion + injury impact",
        formula: "s = clamp(0.7×DRtgDelta + 0.3×injuryImpact, -1, +1)",
        examples: [
          "Strong defense + no injuries → s=+1 → 100% positive",
          "Weak defense + injuries → s=-1 → 100% negative",
          "Mixed signals → s=0 → neutral"
        ]
      },
      threeEnv: {
        metric: "3-point environment & volatility",
        formula: "s = clamp((team3PAR + opp3PAR - 2×league3PAR) / 0.08, -1, +1)",
        examples: [
          "+8% 3PAR → s=+1 → 100% positive",
          "+4% 3PAR → s=+0.5 → 50% positive",
          "-4% 3PAR → s=-0.5 → 50% negative"
        ]
      },
      whistleEnv: {
        metric: "Free throw rate environment",
        formula: "s = clamp((teamFTr + oppFTr - 2×leagueFTr) / 0.06, -1, +1)",
        examples: [
          "+6% FTr → s=+1 → 100% positive",
          "+3% FTr → s=+0.5 → 50% positive",
          "-3% FTr → s=-0.5 → 50% negative"
        ]
      }
    }
    return logicMap[key] || { metric: "Unknown", formula: "Unknown", examples: [] }
  }
  
  // Load factor configuration
  useEffect(() => {
    if (!isOpen) return
    
    const loadConfig = async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/factors/config?capperId=${capperId}&sport=${sport}&betType=${betType}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to load factor configuration')
        }
        
        const data = await response.json()
        setProfile(data.profile)
        
        // Ensure factors have proper default weights if not loaded
        const loadedFactors = data.profile.factors || []
        if (loadedFactors.length === 0) {
          // Set default factors with equal weights (20% each = 100% total)
          setFactors([
            { 
              key: 'paceIndex', 
              name: 'Pace Index', 
              description: 'Expected game pace vs league average',
              enabled: true, 
              weight: 20, 
              dataSource: 'nba-stats-api',
              maxPoints: 1.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'matchup',
              icon: '⏱️',
              shortName: 'Pace'
            },
            { 
              key: 'offForm', 
              name: 'Offensive Form', 
              description: 'Recent offensive efficiency vs opponent defense',
              enabled: true, 
              weight: 20, 
              dataSource: 'nba-stats-api',
              maxPoints: 1.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'matchup',
              icon: '🔥',
              shortName: 'ORtg Form'
            },
            { 
              key: 'defErosion', 
              name: 'Defensive Erosion', 
              description: 'Defensive rating decline + injury impact',
              enabled: true, 
              weight: 20, 
              dataSource: 'nba-stats-api',
              maxPoints: 1.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'team',
              icon: '🛡️',
              shortName: 'DRtg/Avail'
            },
            { 
              key: 'threeEnv', 
              name: '3P Environment', 
              description: '3-point environment & volatility',
              enabled: true, 
              weight: 20, 
              dataSource: 'nba-stats-api',
              maxPoints: 1.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'matchup',
              icon: '🏹',
              shortName: '3P Env'
            },
            { 
              key: 'whistleEnv', 
              name: 'FT Environment', 
              description: 'Free throw rate environment',
              enabled: true, 
              weight: 20, 
              dataSource: 'nba-stats-api',
              maxPoints: 1.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'matchup',
              icon: '⛹️‍♂️',
              shortName: 'FT Env'
            },
          ])
        } else {
          setFactors(loadedFactors)
        }
      } catch (error) {
        console.error('Error loading factor config:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadConfig()
  }, [isOpen, capperId, sport, betType])
  
  // Toggle factor enabled/disabled
  const toggleFactor = (key: string) => {
    setFactors(prev =>
      prev.map(f => {
        if (f.key === key) {
          const newEnabled = !f.enabled
          return { 
            ...f, 
            enabled: newEnabled,
            weight: newEnabled ? f.weight : 0 // Set weight to 0 when disabled
          }
        }
        return f
      })
    )
  }
  
  // Update factor weight
  const updateWeight = (key: string, weight: number) => {
    setFactors(prev => {
      // Calculate total weight of OTHER enabled factors
      const otherEnabledWeight = prev
        .filter(f => f.enabled && f.key !== key)
        .reduce((sum, f) => sum + f.weight, 0)
      
      // Calculate max weight this factor can have (can't exceed remaining budget)
      const maxAllowed = 100 - otherEnabledWeight
      
      // Clamp weight to valid range
      const newWeight = Math.max(0, Math.min(maxAllowed, weight))
      
      return prev.map(f =>
        f.key === key ? { ...f, weight: newWeight } : f
      )
    })
  }
  
  // Update factor data source
  const updateDataSource = (key: string, dataSource: DataSource) => {
    setFactors(prev =>
      prev.map(f =>
        f.key === key ? { ...f, dataSource } : f
      )
    )
  }
  
  // Save factor configuration
  const handleSave = async () => {
    if (!isWeightValid) {
      alert('Weights must sum to exactly 100% before saving')
      return
    }
    
    setSaving(true)
    try {
      const response = await fetch('/api/factors/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capperId,
          sport,
          betType,
          profile: {
            ...profile,
            factors: factors
          }
        })
      })
      
      if (response.ok) {
        console.log('Factor configuration saved successfully')
        onSave({ ...profile, factors }) // Notify parent component with full profile
        onClose() // Close modal
      } else {
        throw new Error('Failed to save factor configuration')
      }
    } catch (error) {
      console.error('Error saving factor config:', error)
      alert('Failed to save configuration. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-xl font-bold text-white">Configure Factors</h2>
              <p className="text-sm text-gray-400 mt-1">
                {capperId} • {sport} • {betType}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
            >
              ✕
            </button>
          </div>
          
          {/* Weight Budget Display */}
          <div className={`p-3 rounded border ${
            isWeightValid 
              ? 'bg-green-500/10 border-green-500/30' 
              : remainingWeight > 0
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-white">
                  Weight Budget: {totalWeight}% / 100%
                </div>
                <div className={`text-xs mt-1 ${
                  isWeightValid 
                    ? 'text-green-400' 
                    : remainingWeight > 0
                      ? 'text-blue-400'
                      : 'text-red-400'
                }`}>
                  {isWeightValid 
                    ? '✓ Perfect! All weight allocated.' 
                    : remainingWeight > 0
                      ? `${remainingWeight}% remaining to allocate`
                      : `Over budget by ${Math.abs(remainingWeight)}%`
                  }
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-48">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      isWeightValid 
                        ? 'bg-green-500' 
                        : totalWeight > 100
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(totalWeight, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-gray-400 mt-4">Loading configuration...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {factors.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No factors available for {sport} {betType}
                </div>
              ) : (
                factors.map(factor => (
                  <div
                    key={factor.key}
                    className={`border rounded-lg p-4 transition ${
                      factor.enabled
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-gray-700 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => toggleFactor(factor.key)}
                        className={`mt-1 w-12 h-6 rounded-full transition ${
                          factor.enabled ? 'bg-blue-600' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 bg-white rounded-full transition transform ${
                            factor.enabled ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      
                      {/* Factor Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{factor.icon}</span>
                          <div>
                            <h3 className="text-white font-medium">{factor.name}</h3>
                            <p className="text-sm text-gray-400">{factor.description}</p>
                          </div>
                        </div>
                        
                        {factor.enabled && (
                          <div className="mt-4 space-y-4">
                            {/* Weight and Data Source */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* Weight Slider */}
                              <div>
                                <label className="block text-xs text-gray-400 mb-2">
                                  Weight: {factor.weight}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={factor.weight}
                                  onChange={e => updateWeight(factor.key, parseInt(e.target.value))}
                                  className="w-full"
                                />
                              </div>
                              
                              {/* Data Source Selector */}
                              <div>
                                <label className="block text-xs text-gray-400 mb-2">
                                  Data Source
                                </label>
                                <select
                                  value={factor.dataSource}
                                  onChange={e => updateDataSource(factor.key, e.target.value as DataSource)}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                >
                                  <option value="nba-stats-api">NBA Stats API</option>
                                  <option value="statmuse">StatMuse (deprecated)</option>
                                  <option value="llm">LLM (AI)</option>
                                  <option value="news-api">News API</option>
                                  <option value="manual">Manual Entry</option>
                                </select>
                              </div>
                            </div>
                            
                            {/* Factor Logic Drawer */}
                            <div className="p-3 bg-gray-900 rounded border border-gray-600">
                              <div className="text-xs font-medium text-gray-300 mb-2">
                                🧮 Logic & Examples
                              </div>
                              
                              {/* Metric Definition */}
                              <div className="text-xs text-gray-400 mb-2">
                                <strong>Metric:</strong> {getFactorLogic(factor.key).metric}
                              </div>
                              
                              {/* Cap/Scaling Formula */}
                              <div className="text-xs text-gray-400 mb-2">
                                <strong>Formula:</strong> {getFactorLogic(factor.key).formula}
                              </div>
                              
                              {/* Examples */}
                              <div className="text-xs text-gray-400">
                                <strong>Examples:</strong>
                                <ul className="mt-1 space-y-1">
                                  {getFactorLogic(factor.key).examples.map((example, i) => (
                                    <li key={i} className="text-gray-500">
                                      {example}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Dynamic Max Points Badge */}
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Max ± Points</div>
                        <div className="text-white font-mono">
                          {((factor.maxPoints * factor.weight) / 100 * 5).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          ({factor.weight}% of {factor.maxPoints.toFixed(1)} × 5)
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {factors.filter(f => f.enabled).length} of {factors.length} factors enabled
            {!isWeightValid && (
              <span className="ml-3 text-yellow-500">
                ⚠ Weights must sum to 100%
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isWeightValid}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

