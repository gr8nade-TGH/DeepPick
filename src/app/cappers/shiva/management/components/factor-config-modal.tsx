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
  const [selectedFactorDetails, setSelectedFactorDetails] = useState<string | null>(null)
  
  // State to manage which Logic & Examples sections are expanded
  const [expandedLogic, setExpandedLogic] = useState<Set<string>>(new Set())
  
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

  // Detailed factor descriptions for the eye icon popup
  const getFactorDetails = (key: string) => {
    const detailsMap: Record<string, { features: string[]; examples: string[]; registry: string[] }> = {
      paceIndex: {
        features: [
          "🏃‍♂️ Pace Calculation: Expected game pace based on both teams' pace interaction",
          "📊 Formula: expPace = (awayPace + homePace)/2, signal = tanh((expPace - leaguePace)/8)",
          "⚖️ Smart Scaling: Uses tanh for smooth saturation, caps at ±16+ possessions",
          "🎯 Single Positive Score: Over OR Under, never both (prevents cancellation)",
          "📈 Max Points: 2.0 (up from 1.5) for more significant impact"
        ],
        examples: [
          "Scenario 1: High Pace Game",
          "• Possessions: +12 vs league average",
          "• Signal: +0.91",
          "• Result: +1.82 Over Score (Very High confidence for Over)",
          "",
          "Scenario 2: Slow Pace Game", 
          "• Possessions: -8 vs league average",
          "• Signal: -0.76",
          "• Result: +1.52 Under Score (High confidence for Under)"
        ],
        registry: [
          "Weight: 30% (up from 20%)",
          "Max Points: 2.0 (up from 1.5)",
          "Scope: matchup (covers both teams)",
          "Data Sources: nba-stats-api, manual",
          "Supported: NBA Totals only"
        ]
      },
      offForm: {
        features: [
          "🔥 Offensive Efficiency: Combined team offensive rating vs league average",
          "📊 Formula: combinedORtg = (homeORtg + awayORtg)/2, advantage = combinedORtg - leagueORtg",
          "⚖️ Smart Scaling: Uses tanh(advantage/10) for smooth saturation",
          "🎯 Single Positive Score: Over OR Under, never both (prevents cancellation)",
          "📈 Max Points: 2.0 (up from 1.0) for more significant impact"
        ],
        examples: [
          "Scenario 1: High-Powered Offense",
          "• Combined ORtg: 120 (10 points above league)",
          "• Signal: +0.76",
          "• Result: +1.52 Over Score (High confidence for Over)",
          "",
          "Scenario 2: Struggling Offense",
          "• Combined ORtg: 100 (10 points below league)",
          "• Signal: -0.76", 
          "• Result: +1.52 Under Score (High confidence for Under)"
        ],
        registry: [
          "Weight: 30% (up from 20%)",
          "Max Points: 2.0 (up from 1.0)",
          "Scope: matchup (covers both teams)",
          "Data Sources: nba-stats-api, manual",
          "Supported: NBA Totals only"
        ]
      },
      defErosion: {
        features: [
          "🛡️ Dual Input Sources: 70% defensive rating + 30% injury impact",
          "📊 Formula: totalErosion = 0.7×drtgDelta + 0.3×injuryImpact×10",
          "⚖️ Smart Scaling: Uses tanh(totalErosion/8), caps at ±20 DRtg points",
          "🎯 Single Positive Score: Poor defense → Over, Strong defense → Under",
          "📈 Max Points: 2.0 (up from 1.0) for more significant impact"
        ],
        examples: [
          "Scenario 1: Poor Defense + Injuries",
          "• DRtg: 120 (10 points worse than league)",
          "• Injuries: -0.5 impact",
          "• Result: +1.20 Over Score (High confidence for Over)",
          "",
          "Scenario 2: Strong Defense + Healthy",
          "• DRtg: 100 (10 points better than league)",
          "• Injuries: +0.5 impact (healthy key players)",
          "• Result: +1.20 Under Score (High confidence for Under)"
        ],
        registry: [
          "Weight: 30% (up from 20%)",
          "Max Points: 2.0 (up from 1.0)",
          "Scope: matchup (covers both teams)",
          "Data Sources: nba-stats-api, llm, manual",
          "Supported: NBA Totals only"
        ]
      },
      edgeVsMarket: {
        features: [
          "⚖️ Market Edge Calculation: Compares predicted total vs market line",
          "📊 Formula: edgePts = predictedTotal - marketTotalLine, signal = clamp(edgePts/10, -1, +1)",
          "⚖️ Smart Scaling: Uses clamp(edgePts/10) for linear scaling with ±10 point cap",
          "🎯 Single Positive Score: Positive edge → Over, Negative edge → Under",
          "📈 Max Points: 3.0 (up from 2.0) for maximum impact",
          "🔒 Final Step: Applied after all other factors for final confidence adjustment"
        ],
        examples: [
          "Scenario 1: Strong Over Edge",
          "• Predicted Total: 235, Market Line: 225",
          "• Edge Points: +10",
          "• Signal: +1.0",
          "• Result: +3.0 Over Score (Maximum confidence for Over)",
          "",
          "Scenario 2: Moderate Under Edge",
          "• Predicted Total: 220, Market Line: 225",
          "• Edge Points: -5",
          "• Signal: -0.50",
          "• Result: +1.5 Under Score (Moderate confidence for Under)"
        ],
        registry: [
          "Weight: 100% (Fixed - Final Step)",
          "Max Points: 3.0 (up from 2.0)",
          "Scope: global (applies to all sports/bet types)",
          "Data Sources: manual (calculated from other factors)",
          "Supported: All Totals predictions"
        ]
      }
    }
    return detailsMap[key] || { features: [], examples: [], registry: [] }
  }

  // Factor logic definitions for the Logic Drawer
  const getFactorLogic = (key: string) => {
    const logicMap: Record<string, { metric: string; formula: string; examples: string[] }> = {
      paceIndex: {
        metric: "Expected game pace based on both teams' recent pace (last 10 games)",
        formula: "expPace = (awayPace + homePace)/2, signal = tanh((expPace - leaguePace)/8), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0",
        examples: [
          "| Expected Pace | League Pace | Delta | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|---------------|-------------|-------|--------|------------|-------------|------------|---------------|",
          "| 108.0         | 100.1       | +7.9  | +0.70  | +1.40      | 0.0         | High       | Fast teams    |",
          "| 105.0         | 100.1       | +4.9  | +0.55  | +1.10      | 0.0         | Moderate   | Above avg     |",
          "| 102.0         | 100.1       | +1.9  | +0.24  | +0.48      | 0.0         | Low        | Slightly fast |",
          "| 100.1         | 100.1       | 0.0   | 0.0    | 0.0        | 0.0         | Neutral    | League avg    |",
          "| 98.0          | 100.1       | -2.1  | -0.26  | 0.0        | +0.52       | Low        | Slightly slow |",
          "| 95.0          | 100.1       | -5.1  | -0.56  | 0.0        | +1.12       | Moderate   | Below avg     |",
          "| 92.0          | 100.1       | -8.1  | -0.78  | 0.0        | +1.56       | High       | Slow teams    |",
          "",
          "*Metric: Expected game pace based on both teams' recent pace (last 10 games)*",
          "*Formula: expPace = (awayPace + homePace)/2, signal = tanh((expPace - leaguePace)/8), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0*"
        ]
      },
      offForm: {
        metric: "Combined team offensive efficiency vs league average (last 10 games)",
        formula: "combinedORtg = (homeORtg + awayORtg)/2, advantage = combinedORtg - leagueORtg, signal = tanh(advantage/10), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0",
        examples: [
          "| Combined ORtg | League ORtg | Advantage | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|---------------|-------------|-----------|--------|------------|-------------|------------|---------------|",
          "| 125.0         | 110.0       | +15.0     | +0.91  | +1.82      | 0.0         | High       | Hot offenses  |",
          "| 120.0         | 110.0       | +10.0     | +0.76  | +1.52      | 0.0         | High       | Above avg     |",
          "| 115.0         | 110.0       | +5.0      | +0.46  | +0.92      | 0.0         | Moderate   | Slightly hot  |",
          "| 112.0         | 110.0       | +2.0      | +0.20  | +0.40      | 0.0         | Low        | Mildly hot    |",
          "| 110.0         | 110.0       | 0.0       | 0.0    | 0.0        | 0.0         | Neutral    | League avg    |",
          "| 108.0         | 110.0       | -2.0      | -0.20  | 0.0        | +0.40       | Low        | Mildly cold   |",
          "| 105.0         | 110.0       | -5.0      | -0.46  | 0.0        | +0.92       | Moderate   | Slightly cold |",
          "| 100.0         | 110.0       | -10.0     | -0.76  | 0.0        | +1.52       | High       | Below avg     |",
          "| 95.0          | 110.0       | -15.0     | -0.91  | 0.0        | +1.82       | High       | Cold offenses  |",
          "",
          "*Metric: Combined team offensive efficiency vs league average (last 10 games)*",
          "*Formula: combinedORtg = (homeORtg + awayORtg)/2, advantage = combinedORtg - leagueORtg, signal = tanh(advantage/10), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0*"
        ]
      },
      defErosion: {
        metric: "Combined defensive rating decline + injury impact (season + AI analysis)",
        formula: "combinedDRtg = (homeDRtg + awayDRtg)/2, drtgDelta = combinedDRtg - leagueDRtg, totalErosion = 0.7×drtgDelta + 0.3×injuryImpact×10, signal = tanh(totalErosion/8), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0",
        examples: [
          "| Combined DRtg | League DRtg | DRtg Delta | Injury Impact | Total Erosion | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|---------------|-------------|------------|---------------|---------------|--------|------------|-------------|------------|---------------|",
          "| 120.0         | 110.0       | +10.0      | -0.5          | +5.5          | +0.60  | +1.20      | 0.0         | High       | Weak defense + injuries |",
          "| 115.0         | 110.0       | +5.0       | -0.2          | +2.9          | +0.35  | +0.70      | 0.0         | Moderate   | Below avg + minor injuries |",
          "| 112.0         | 110.0       | +2.0       | 0.0           | +1.4          | +0.17  | +0.34      | 0.0         | Low        | Slightly weak |",
          "| 110.0         | 110.0       | 0.0        | 0.0           | 0.0           | 0.0    | 0.0        | 0.0         | Neutral    | League avg |",
          "| 108.0         | 110.0       | -2.0       | 0.0           | -1.4          | -0.17  | 0.0        | +0.34       | Low        | Slightly strong |",
          "| 105.0         | 110.0       | -5.0       | +0.2          | -2.9          | -0.35  | 0.0        | +0.70       | Moderate   | Above avg + healthy |",
          "| 100.0         | 110.0       | -10.0      | +0.5          | -5.5          | -0.60  | 0.0        | +1.20       | High       | Strong defense + healthy |",
          "| 95.0          | 110.0       | -15.0      | +0.8          | -8.1          | -0.85  | 0.0        | +1.70       | Very High  | Elite defense + very healthy |",
          "",
          "*Metric: Combined defensive rating decline + injury impact (season + AI analysis)*",
          "*Formula: combinedDRtg = (homeDRtg + awayDRtg)/2, drtgDelta = combinedDRtg - leagueDRtg, totalErosion = 0.7×drtgDelta + 0.3×injuryImpact×10, signal = tanh(totalErosion/8), if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0*"
        ]
      },
      edgeVsMarket: {
        metric: "Final confidence adjustment based on predicted vs market line for totals",
        formula: "edgePts = predictedTotal - marketTotalLine, signal = clamp(edgePts/10, -1, +1), if signal > 0: overScore = |signal| × 3.0, underScore = 0; else: overScore = 0, underScore = |signal| × 3.0",
        examples: [
          "| Edge Points | Signal | Over Score | Under Score | Confidence | Market Context |",
          "|-------------|--------|------------|-------------|------------|----------------|",
          "| +10+        | +1.0   | +3.0       | 0.0         | Maximum    | Strong Over    |",
          "| +7          | +0.70  | +2.10      | 0.0         | High       | Clear Over     |",
          "| +5          | +0.50  | +1.50      | 0.0         | Moderate   | Moderate Over  |",
          "| +2          | +0.20  | +0.60      | 0.0         | Low        | Slight Over    |",
          "| 0           | 0.0    | 0.0        | 0.0         | Neutral    | Perfect Line   |",
          "| -2          | -0.20  | 0.0        | +0.60       | Low        | Slight Under   |",
          "| -5          | -0.50  | 0.0        | +1.50       | Moderate   | Moderate Under |",
          "| -7          | -0.70  | 0.0        | +2.10       | High       | Clear Under    |",
          "| -10+        | -1.0   | 0.0        | +3.0        | Maximum    | Strong Under   |",
          "",
          "*Metric: Final confidence adjustment based on predicted vs market line for totals*",
          "*Formula: edgePts = predictedTotal - marketTotalLine, signal = clamp(edgePts/10, -1, +1), if signal > 0: overScore = |signal| × 3.0, underScore = 0; else: overScore = 0, underScore = |signal| × 3.0*"
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
      injuryAvailability: {
        metric: "AI analysis of key player injuries and availability impact on scoring",
        formula: "AI analyzes injuries → awayImpact (-10 to +10) + homeImpact (-10 to +10) → totalImpact = (awayImpact + homeImpact)/2 → signal = clamp(totalImpact/10, -1, +1) → if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0",
        examples: [
          "| Away Impact | Home Impact | Total Impact | Signal | Over Score | Under Score | Confidence | Example Scenario |",
          "|-------------|-------------|--------------|--------|------------|-------------|------------|------------------|",
          "| -8          | -6          | -7.0         | -0.70  | 0.0        | +1.40       | High       | Both teams missing key scorers |",
          "| -5          | -3          | -4.0         | -0.40  | 0.0        | +0.80       | Moderate   | One team missing star player |",
          "| -2          | -1          | -1.5         | -0.15  | 0.0        | +0.30       | Low        | Minor injuries affecting depth |",
          "| 0           | 0           | 0.0          | 0.0    | 0.0        | 0.0         | Neutral    | No significant injuries |",
          "| +2          | +1          | +1.5         | +0.15  | +0.30      | 0.0         | Low        | Minor defensive injuries |",
          "| +5          | +3          | +4.0         | +0.40  | +0.80      | 0.0         | Moderate   | One team missing key defender |",
          "| +8          | +6          | +7.0         | +0.70  | +1.40      | 0.0         | High       | Both teams missing key defenders |",
          "| +10         | +8          | +9.0         | +0.90  | +1.80      | 0.0         | Very High  | Multiple defensive injuries |",
          "",
          "*Metric: AI analysis of key player injuries and availability impact on scoring*",
          "*Formula: AI analyzes injuries → awayImpact (-10 to +10) + homeImpact (-10 to +10) → totalImpact = (awayImpact + homeImpact)/2 → signal = clamp(totalImpact/10, -1, +1) → if signal > 0: overScore = |signal| × 2.0, underScore = 0; else: overScore = 0, underScore = |signal| × 2.0*"
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
        
        // Use the full registry to get all available factors
        const registry = data.registry || {}
        const loadedFactors = data.profile.factors || []
        
        // Convert registry to FactorConfig array, merging with saved factors
        const allFactors: FactorConfig[] = Object.entries(registry).map(([key, meta]: [string, any]) => {
          // Find saved factor config for this key
          const savedFactor = loadedFactors.find((f: any) => f.key === key)
          
          return {
            key,
            name: meta.name,
            description: meta.description,
            enabled: savedFactor?.enabled ?? (key === 'edgeVsMarket'), // Edge vs Market enabled by default
            weight: key === 'edgeVsMarket' ? 100 : (savedFactor?.weight ?? meta.defaultWeight), // Edge vs Market always 100%
            dataSource: savedFactor?.dataSource ?? meta.defaultDataSource ?? (key === 'injuryAvailability' ? 'llm' : 'nba-stats-api'),
            maxPoints: meta.maxPoints,
            sport: meta.supportedSports?.[0] || 'NBA',
            betType: meta.supportedBetTypes?.[0] || 'TOTAL',
            scope: meta.scope,
            icon: meta.icon,
            shortName: meta.shortName
          }
        })
        
        let factorsToSet: FactorConfig[]
        
        // Use the registry-based factors
        factorsToSet = allFactors
        
        console.log('[FactorConfigModal] Loaded factors:', {
          registryCount: Object.keys(registry).length,
          loadedFactorsCount: loadedFactors.length,
          allFactorsCount: allFactors.length,
          factorsToSet: factorsToSet.map(f => ({ key: f.key, name: f.name, enabled: f.enabled, weight: f.weight }))
        })
        
        setFactors(factorsToSet)
      } catch (error) {
        console.error('Error loading factor config:', error)
        // Set default factors with proper weights on error
        setFactors([
          // Edge vs Market - Totals (locked, doesn't count toward weight budget) - FIRST
          { 
            key: 'edgeVsMarket', 
            name: 'Edge vs Market - Totals', 
            description: 'Final confidence adjustment based on predicted vs market line for totals',
            enabled: true, 
            weight: 100, // Always 100% (fixed)
            dataSource: 'manual',
            maxPoints: 3.0,
            sport: 'NBA',
            betType: 'TOTAL',
            scope: 'global',
            icon: '📊',
            shortName: 'Edge'
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
      alert('Weights must sum to exactly 150% before saving')
      return
    }
    
    setSaving(true)
    try {
      const response = await fetch('/api/factors/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capperId,
          sport: sport as string,
          betType: betType as string,
          name: profile?.name || `${capperId} ${sport} ${betType} Profile`,
          description: profile?.description || `Custom factor configuration for ${capperId} ${sport} ${betType}`,
          factors: factors.map(factor => ({
            ...factor,
            sport: sport as string,
            betType: betType as string
          }))
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
                onClick={() => {
                  const debugInfo = {
                    timestamp: new Date().toISOString(),
                    capperId,
                    sport,
                    betType,
                    profile: profile ? {
                      id: profile.id,
                      name: profile.name,
                      description: profile.description,
                      isActive: profile.isActive,
                      isDefault: profile.isDefault
                    } : null,
                    factors: factors.map(f => ({
                      key: f.key,
                      name: f.name,
                      enabled: f.enabled,
                      weight: f.weight,
                      dataSource: f.dataSource,
                      maxPoints: f.maxPoints,
                      sport: f.sport,
                      betType: f.betType,
                      scope: f.scope,
                      icon: f.icon,
                      shortName: f.shortName
                    })),
                    weightDebug: {
                      weightFactors: weightFactors.map(f => ({ key: f.key, weight: f.weight })),
                      rawTotalWeight,
                      totalWeight,
                      remainingWeight,
                      isWeightValid
                    },
                    environment: {
                      nodeEnv: process.env.NODE_ENV,
                      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
                      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
                    }
                  }
                  
                  const debugText = JSON.stringify(debugInfo, null, 2)
                  navigator.clipboard.writeText(debugText).then(() => {
                    alert('Debug report copied to clipboard!')
                  }).catch(() => {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea')
                    textArea.value = debugText
                    document.body.appendChild(textArea)
                    textArea.select()
                    document.execCommand('copy')
                    document.body.removeChild(textArea)
                    alert('Debug report copied to clipboard!')
                  })
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition text-sm"
              >
                📋 Copy Debug Report
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
                              <button
                                onClick={() => setSelectedFactorDetails(factor.key)}
                                className="text-gray-400 hover:text-blue-400 transition-colors ml-1"
                                title="View detailed factor information"
                              >
                                👁️
                              </button>
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
                                  <option value="system">System</option>
                                  <option value="manual">Manual Entry</option>
                                </select>
                              </div>
                            </div>
                            
                            {/* Factor Logic Drawer */}
                            <div className="p-3 bg-gray-900 rounded border border-gray-600">
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedLogic)
                                  if (expandedLogic.has(factor.key)) {
                                    newExpanded.delete(factor.key)
                                  } else {
                                    newExpanded.add(factor.key)
                                  }
                                  setExpandedLogic(newExpanded)
                                }}
                                className="flex items-center justify-between w-full text-xs font-medium text-gray-300 mb-3 hover:text-white transition-colors"
                              >
                                <span>🧮 Logic & Examples</span>
                                <span className="text-gray-500">
                                  {expandedLogic.has(factor.key) ? '▼' : '▶'}
                                </span>
                              </button>
                              
                              {expandedLogic.has(factor.key) && (
                                <div className="space-y-3">
                                  {/* Full-width Examples Table */}
                                  <div className="overflow-x-auto">
                                    <div className="text-xs text-gray-400 mb-2">
                                      <strong>Scoring Examples:</strong>
                                    </div>
                                    <div className="space-y-1">
                                      {(() => {
                                        const examples = getFactorLogic(factor.key).examples
                                        console.log(`[Logic & Examples] Factor: ${factor.key}, Examples:`, examples)
                                        const tableRows = examples.filter(line => line.startsWith('|') && !line.includes('---'))
                                        const headerRow = examples.find(line => line.startsWith('|') && line.includes('---'))
                                        const metricLine = examples.find(line => line.startsWith('*Metric:'))
                                        const formulaLine = examples.find(line => line.startsWith('*Formula:'))
                                        
                                        console.log(`[Logic & Examples] Table rows:`, tableRows)
                                        
                                        if (tableRows.length > 0) {
                                          const headers = tableRows[0].split('|').slice(1, -1).map(h => h.trim())
                                          
                                          return (
                                            <>
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-xs border-collapse">
                                                  <thead>
                                                    <tr className="border-b border-gray-600">
                                                      {headers.map((header, i) => (
                                                        <th key={i} className="text-left py-2 px-2 text-gray-300 font-medium">
                                                          {header}
                                                        </th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {tableRows.slice(1).map((row, i) => {
                                                      const cells = row.split('|').slice(1, -1).map(c => c.trim())
                                                      return (
                                                        <tr key={i} className="border-b border-gray-700">
                                                          {cells.map((cell, j) => {
                                                            // Check if this is Over Score or Under Score column and has a + number
                                                            const isScoreColumn = headers[j]?.includes('Score') && cell.startsWith('+')
                                                            return (
                                                              <td key={j} className={`py-2 px-2 ${isScoreColumn ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
                                                                {cell}
                                                              </td>
                                                            )
                                                          })}
                                                        </tr>
                                                      )
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                              {metricLine && (
                                                <div className="text-xs text-gray-500 italic mt-3">
                                                  {metricLine.replace(/\*/g, '')}
                                                </div>
                                              )}
                                              {formulaLine && (
                                                <div className="text-xs text-gray-500 italic mt-1">
                                                  {formulaLine.replace(/\*/g, '')}
                                                </div>
                                              )}
                                            </>
                                          )
                                        }
                                        
                                        // Fallback to original format if no table structure found
                                        return examples.map((example, i) => (
                                          <div key={i} className={`text-xs leading-relaxed ${
                                            example.startsWith('|') 
                                              ? 'text-gray-300 font-mono' 
                                              : example.startsWith('*') && example.endsWith('*')
                                              ? 'text-gray-500 italic mt-2'
                                              : example === ''
                                              ? 'h-1'
                                              : 'text-gray-400'
                                          }`}>
                                            {example.replace(/\*/g, '')}
                                          </div>
                                        ))
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Dynamic Max Points Badge */}
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Max ± Points</div>
                        <div className="text-white font-mono">
                          {factor.key === 'edgeVsMarket' ? '3.0' : factor.maxPoints.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {factor.key === 'edgeVsMarket' 
                            ? 'Fixed (Final Step)' 
                            : `Max ${factor.maxPoints.toFixed(1)} points`
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

      {/* Detailed Factor Information Popup */}
      {selectedFactorDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">
                  {factors.find(f => f.key === selectedFactorDetails)?.name} Details
                </h2>
                <button
                  onClick={() => setSelectedFactorDetails(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {(() => {
                const details = getFactorDetails(selectedFactorDetails)
                return (
                  <div className="space-y-6">
                    {/* Key Features */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">🔧 Key Features</h3>
                      <div className="space-y-2">
                        {details.features.map((feature, i) => (
                          <div key={i} className="text-sm text-gray-300 leading-relaxed">
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Impact Examples */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">📈 Impact Examples</h3>
                      <div className="space-y-2">
                        {details.examples.map((example, i) => (
                          <div key={i} className={`text-sm leading-relaxed ${
                            example.startsWith('Scenario') 
                              ? 'text-blue-300 font-medium' 
                              : example.startsWith('•')
                              ? 'text-gray-300 ml-4'
                              : example === ''
                              ? 'h-2'
                              : 'text-gray-400'
                          }`}>
                            {example}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Registry Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">⚙️ Registry Configuration</h3>
                      <div className="space-y-1">
                        {details.registry.map((info, i) => (
                          <div key={i} className="text-sm text-gray-300">
                            {info}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

