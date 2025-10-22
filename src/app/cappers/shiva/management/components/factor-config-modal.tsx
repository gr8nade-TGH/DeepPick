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
  
  // Calculate weight budget (with proper rounding to avoid floating point precision issues)
  // Edge vs Market doesn't count toward weight budget
  const weightFactors = factors.filter(f => f.enabled && f.key !== 'edgeVsMarket')
  const rawTotalWeight = weightFactors.reduce((sum, f) => sum + f.weight, 0)
  const totalWeight = Math.round(rawTotalWeight * 100) / 100
  const remainingWeight = Math.round((150 - totalWeight) * 100) / 100
  const isWeightValid = Math.abs(remainingWeight) < 0.01 || Math.abs(totalWeight - 150) < 0.01
  
  // Debug logging
  console.log('[Weight Debug]', {
    weightFactors: weightFactors.map(f => ({ key: f.key, weight: f.weight })),
    rawTotalWeight,
    totalWeight,
    remainingWeight,
    isWeightValid
  })
  
  // Force exact 150% if very close (within 0.01%)
  const displayTotalWeight = Math.abs(totalWeight - 150) < 0.01 ? 150 : totalWeight
  const displayRemainingWeight = Math.abs(remainingWeight) < 0.01 ? 0 : remainingWeight
  
  // Get factor eligibility tags
  const getFactorTags = (factor: FactorConfig) => {
    const tags = []
    
    // Edge vs Market is special - only show Global
    if (factor.key === 'edgeVsMarket') {
      return ['Global']
    }
    
    // Sport tags
    if (factor.sport === 'NBA') tags.push('NBA')
    if (factor.sport === 'NFL') tags.push('NFL')
    if (factor.sport === 'MLB') tags.push('MLB')
    
    // Bet type tags
    if (factor.betType === 'TOTAL') tags.push('O/U')
    if (factor.betType === 'SPREAD') tags.push('SPREAD')
    if (factor.betType === 'MONEYLINE') tags.push('ML')
    
    // Scope tags
    if (factor.scope === 'global') tags.push('Global')
    if (factor.scope === 'matchup') tags.push('Matchup')
    if (factor.scope === 'team') tags.push('Team')
    
    return tags
  }

  // Factor logic definitions for the Logic Drawer
  const getFactorLogic = (key: string) => {
    const logicMap: Record<string, { metric: string; formula: string; examples: string[] }> = {
      paceIndex: {
        metric: "Expected game pace based on both teams' pace interaction",
        formula: "expPace = (awayPace + homePace)/2, signal = tanh((expPace - leaguePace)/8), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0",
        examples: [
          "+16+ possessions → Over: +2.0, Under: 0.0 (Full Over confidence)",
          "+8 possessions → Over: +1.52, Under: 0.0 (High Over confidence)",
          "+5 possessions → Over: +1.10, Under: 0.0 (Moderate Over confidence)",
          "0 possessions → Over: 0.0, Under: 0.0 (Neutral pace)",
          "-5 possessions → Over: 0.0, Under: +1.10 (Moderate Under confidence)",
          "-8 possessions → Over: 0.0, Under: +1.52 (High Under confidence)",
          "-16+ possessions → Over: 0.0, Under: +2.0 (Full Under confidence)"
        ]
      },
      offForm: {
        metric: "Combined team offensive efficiency vs league average",
        formula: "combinedORtg = (homeORtg + awayORtg)/2, advantage = combinedORtg - leagueORtg, signal = tanh(advantage/10), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0",
        examples: [
          "+10 ORtg advantage → Over: +1.52, Under: 0.0 (High Over confidence)",
          "+5 ORtg advantage → Over: +0.76, Under: 0.0 (Moderate Over confidence)",
          "0 ORtg advantage → Over: 0.0, Under: 0.0 (Neutral offense)",
          "-5 ORtg advantage → Over: 0.0, Under: +0.76 (Moderate Under confidence)",
          "-10 ORtg advantage → Over: 0.0, Under: +1.52 (High Under confidence)"
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
      },
      
      edgeVsMarket: {
        metric: "Final confidence adjustment based on predicted vs market line",
        formula: "Edge factor = clamp((predicted - market) / 10, -1, 1)",
        examples: [
          "Predicted 225, Market 220: +0.5 edge (favor Over)",
          "Predicted 220, Market 225: -0.5 edge (favor Under)",
          "Predicted = Market: 0.0 edge (neutral)"
        ]
      }
    }
    return logicMap[key] || { metric: "Unknown", formula: "Unknown", examples: [] }
  }
  
  // Normalize factor weights to ensure they sum to 100%
  const normalizeFactorWeights = (factors: FactorConfig[]): FactorConfig[] => {
    // Edge vs Market doesn't count toward weight budget
    const weightFactors = factors.filter(f => f.key !== 'edgeVsMarket')
    const enabledFactors = weightFactors.filter(f => f.enabled)
    const disabledFactors = weightFactors.filter(f => !f.enabled)
    
    if (enabledFactors.length === 0) {
      // If no factors enabled, enable all with equal weights (excluding Edge vs Market)
      return factors.map(f => {
        if (f.key === 'edgeVsMarket') {
          return { ...f, enabled: true, weight: 100 } // Edge vs Market is always 100%
        }
        return { ...f, enabled: true, weight: 100 / weightFactors.length }
      })
    }
    
    // Calculate total weight of enabled factors (excluding Edge vs Market)
    const totalWeight = enabledFactors.reduce((sum, f) => sum + f.weight, 0)
    
    if (totalWeight === 0) {
      // If all enabled factors have 0 weight, distribute equally
      const equalWeight = 150 / enabledFactors.length
      return factors.map(f => {
        if (f.key === 'edgeVsMarket') {
          return { ...f, enabled: true, weight: 100 } // Edge vs Market is always 100%
        }
        return f.enabled ? { ...f, weight: equalWeight } : { ...f, weight: 0 }
      })
    }
    
    // Normalize enabled factors to sum to 150% (excluding Edge vs Market)
    const normalizedFactors = factors.map(f => {
      if (f.key === 'edgeVsMarket') {
        return { ...f, enabled: true, weight: 100 } // Edge vs Market is always 100%
      }
      if (f.enabled) {
        const normalizedWeight = (f.weight / totalWeight) * 150
        // Round to 2 decimal places to avoid floating point precision issues
        const roundedWeight = Math.round(normalizedWeight * 100) / 100
        return { ...f, weight: roundedWeight }
      } else {
        return { ...f, weight: 0 }
      }
    })
    
    // Final adjustment to ensure exact 150% total
    const finalFactors = [...normalizedFactors]
    const finalTotal = finalFactors
      .filter(f => f.enabled && f.key !== 'edgeVsMarket')
      .reduce((sum, f) => sum + f.weight, 0)

    if (Math.abs(finalTotal - 150) > 0.01) {
      // Adjust the first enabled factor to make it exactly 150%
      const firstEnabled = finalFactors.find(f => f.enabled && f.key !== 'edgeVsMarket')
      if (firstEnabled) {
        const adjustment = 150 - finalTotal
        firstEnabled.weight = Math.round((firstEnabled.weight + adjustment) * 100) / 100
      }
    }
    
    return finalFactors
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
        
        // Ensure factors have proper default weights
        const loadedFactors = data.profile.factors || []
        let factorsToSet: FactorConfig[]
        
        if (loadedFactors.length === 0) {
          // Set default factors with equal weights (30% each = 150% total)
          // Edge vs Market is always included but doesn't count toward weight budget
          factorsToSet = [
            // Edge vs Market - Totals (locked, doesn't count toward weight budget)
            { 
              key: 'edgeVsMarket', 
              name: 'Edge vs Market - Totals', 
              description: 'Final confidence adjustment based on predicted vs market line for totals',
              enabled: true, 
              weight: 100, // Always 100% (fixed)
              dataSource: 'manual',
              maxPoints: 2.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'global',
              icon: '⚖️',
              shortName: 'Edge vs Market'
            },
            { 
              key: 'paceIndex', 
              name: 'Pace Index', 
              description: 'Expected game pace vs league average',
              enabled: true, 
              weight: 30, 
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
              weight: 30, 
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
              weight: 30, 
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
              weight: 30, 
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
              weight: 30, 
              dataSource: 'nba-stats-api',
              maxPoints: 1.0,
              sport: 'NBA',
              betType: 'TOTAL',
              scope: 'matchup',
              icon: '⛹️‍♂️',
              shortName: 'FT Env'
            },
          ]
        } else {
          // Normalize existing factors to ensure weights sum to 100%
          factorsToSet = normalizeFactorWeights(loadedFactors)
          
          // If normalization resulted in some factors having 0 weight, redistribute
          const totalWeight = factorsToSet
            .filter(f => f.enabled && f.key !== 'edgeVsMarket')
            .reduce((sum, f) => sum + f.weight, 0)
          
          if (totalWeight < 135) { // If total is too low, redistribute equally
            const enabledFactors = factorsToSet.filter(f => f.enabled && f.key !== 'edgeVsMarket')
            const equalWeight = 150 / enabledFactors.length
            
            factorsToSet = factorsToSet.map(f => {
              if (f.key === 'edgeVsMarket') return f
              return f.enabled ? { ...f, weight: equalWeight } : f
            })
          }
        }
        
        setFactors(factorsToSet)
      } catch (error) {
        console.error('Error loading factor config:', error)
        // Set default factors with proper weights on error
        setFactors([
          // Edge vs Market - Totals (locked, doesn't count toward weight budget)
          { 
            key: 'edgeVsMarket', 
            name: 'Edge vs Market - Totals', 
            description: 'Final confidence adjustment based on predicted vs market line for totals',
            enabled: true, 
            weight: 100, // Always 100% (fixed)
            dataSource: 'manual',
            maxPoints: 2.0,
            sport: 'NBA',
            betType: 'TOTAL',
            scope: 'global',
            icon: '⚖️',
            shortName: 'Edge vs Market'
          },
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
      // Don't allow Edge vs Market to be adjusted
      if (key === 'edgeVsMarket') return prev
      
      // Calculate total weight of OTHER enabled factors (excluding Edge vs Market)
      const otherEnabledWeight = prev
        .filter(f => f.enabled && f.key !== key && f.key !== 'edgeVsMarket')
        .reduce((sum, f) => sum + f.weight, 0)
      
      // Calculate max weight this factor can have (can't exceed remaining budget)
      const maxAllowed = Math.max(0, 150 - otherEnabledWeight)
      
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
        // Create a complete profile with all required fields
        const completeProfile: CapperProfile = {
          id: profile?.id || `${capperId}-${sport}-${betType}`,
          capperId,
          sport,
          betType,
          name: profile?.name || `${capperId} ${sport} ${betType}`,
          description: profile?.description || `Factor configuration for ${capperId} ${sport} ${betType}`,
          factors,
          createdAt: profile?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: profile?.isActive ?? true,
          isDefault: profile?.isDefault ?? false
        }
        onSave(completeProfile) // Notify parent component with full profile
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
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const enabledFactors = factors.filter(f => f.enabled && f.key !== 'edgeVsMarket')
                  const equalWeight = 150 / enabledFactors.length
                  
                  setFactors(prev => prev.map(f => {
                    if (f.key === 'edgeVsMarket') return f
                    return f.enabled ? { ...f, weight: equalWeight } : f
                  }))
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition"
              >
                Reset to Equal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !isWeightValid}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
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
                  Weight Budget: {displayTotalWeight}% / 150%
                </div>
                <div className={`text-xs mt-1 ${
                  isWeightValid 
                    ? 'text-green-400' 
                    : displayRemainingWeight > 0
                      ? 'text-blue-400'
                      : 'text-red-400'
                }`}>
                  {isWeightValid 
                    ? '✓ Perfect! All weight allocated.' 
                    : displayRemainingWeight > 0
                      ? `${displayRemainingWeight}% remaining to allocate`
                      : `Over budget by ${Math.abs(displayRemainingWeight)}%`
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
                        : displayTotalWeight > 100
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(displayTotalWeight, 100)}%` }}
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
                factors
                  .sort((a, b) => {
                    // Edge vs Market always comes first
                    if (a.key === 'edgeVsMarket') return -1
                    if (b.key === 'edgeVsMarket') return 1
                    return 0
                  })
                  .map(factor => (
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
                        onClick={() => factor.key !== 'edgeVsMarket' && toggleFactor(factor.key)}
                        disabled={factor.key === 'edgeVsMarket'}
                        className={`mt-1 w-12 h-6 rounded-full transition ${
                          factor.enabled ? 'bg-blue-600' : 'bg-gray-600'
                        } ${factor.key === 'edgeVsMarket' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-white font-medium">{factor.name}</h3>
                              {/* Factor Tags */}
                              <div className="flex gap-1">
                                {getFactorTags(factor).map((tag, i) => (
                                  <span 
                                    key={i}
                                    className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
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
                                  Weight: {factor.key === 'edgeVsMarket' ? '100% (Fixed)' : `${factor.weight}%`}
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max={factor.key === 'edgeVsMarket' ? 0 : 100}
                                  value={factor.weight}
                                  onChange={e => factor.key !== 'edgeVsMarket' && updateWeight(factor.key, parseInt(e.target.value))}
                                  disabled={factor.key === 'edgeVsMarket'}
                                  className={`w-full ${factor.key === 'edgeVsMarket' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                              <div className="text-xs font-medium text-gray-300 mb-3">
                                🧮 Logic & Examples
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                {/* Left Column - Logic */}
                                <div>
                                  <div className="text-xs text-gray-400 mb-2">
                                    <strong>Metric:</strong><br/>
                                    <span className="text-gray-500">{getFactorLogic(factor.key).metric}</span>
                                  </div>
                                  
                                  <div className="text-xs text-gray-400">
                                    <strong>Formula:</strong><br/>
                                    <span className="text-gray-500 font-mono">{getFactorLogic(factor.key).formula}</span>
                                  </div>
                                </div>
                                
                                {/* Right Column - Examples */}
                                <div>
                                  <div className="text-xs text-gray-400 mb-2">
                                    <strong>Examples:</strong>
                                  </div>
                                  <ul className="space-y-1">
                                    {getFactorLogic(factor.key).examples.map((example, i) => (
                                      <li key={i} className="text-gray-500 text-xs">
                                        {example}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Dynamic Max Points Badge */}
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Max ± Points</div>
                        <div className="text-white font-mono">
                          {factor.key === 'edgeVsMarket' ? '2.0' : ((factor.maxPoints * factor.weight) / 100 * 5).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {factor.key === 'edgeVsMarket' 
                            ? 'Fixed (Final Step)' 
                            : `(${factor.weight}% of ${factor.maxPoints.toFixed(1)} × 5)`
                          }
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
        </div>
      </div>
    </div>
  )
}

