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

  // Helper function to check if a factor is an Edge vs Market factor
  const isEdgeFactor = (key: string) => key === 'edgeVsMarket' || key === 'edgeVsMarketSpread'

  // Calculate weight budget (with proper rounding to avoid floating point precision issues)
  // Edge vs Market doesn't count toward weight budget
  const weightFactors = factors.filter(f => f.enabled && !isEdgeFactor(f.key))
  const rawTotalWeight = weightFactors.reduce((sum, f) => sum + f.weight, 0)
  const totalWeight = Math.round(rawTotalWeight * 100) / 100
  const remainingWeight = Math.round((250 - totalWeight) * 100) / 100
  const isWeightValid = Math.abs(remainingWeight) < 0.01 || Math.abs(totalWeight - 250) < 0.01

  // Debug logging
  // console.log('[Weight Debug]', {
  //   weightFactors: weightFactors.map(f => ({ key: f.key, weight: f.weight })),
  //   rawTotalWeight,
  //   totalWeight,
  //   remainingWeight,
  //   isWeightValid
  // })

  // Force exact 250% if very close (within 0.01%)
  const displayTotalWeight = Math.abs(totalWeight - 250) < 0.01 ? 250 : totalWeight
  const displayRemainingWeight = Math.abs(remainingWeight) < 0.01 ? 0 : remainingWeight

  // Get factor eligibility tags
  const getFactorTags = (factor: FactorConfig) => {
    const tags = []

    // Edge vs Market factors are special - only show Global
    if (isEdgeFactor(factor.key)) {
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
    // Get the detailed logic from getFactorLogic
    const logic = getFactorLogic(key)

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
          "Data Sources: mysportsfeeds, system",
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
          "Data Sources: mysportsfeeds, system",
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
          "Data Sources: mysportsfeeds, perplexity, system",
          "Supported: NBA Totals only"
        ]
      },
      edgeVsMarket: {
        features: [
          "⚖️ Market Edge Calculation: Compares team-specific predicted total vs market line",
          "🏀 Team-Specific Baseline: P = 0.5×(pace_home + pace_away), PPP_home = 1.10 + 0.5×(ORtg_home-110)/100 - 0.5×(DRtg_away-110)/100",
          "📊 Formula: total_base = P × (PPP_home + PPP_away), predicted_total = total_base + Σ(factor_points)",
          "⚖️ Edge Calculation: edgePts = predictedTotal - marketTotalLine, signal = clamp(edgePts/3, -2, +2)",
          "🎯 Single Positive Score: Positive edge → Over, Negative edge → Under",
          "📈 Max Points: 5.0 for maximum impact on final prediction",
          "🔒 Final Step: Applied after all other factors for final confidence adjustment"
        ],
        examples: [
          "Scenario 1: Strong Over Edge (Phoenix vs Sacramento)",
          "• Team Baseline: P=101.0, PPP_home=1.143, PPP_away=1.103 → total_base=226.8",
          "• Factor Adjustments: +4.5 points (pace+offense+defense+3P+FT+injuries)",
          "• Predicted Total: 226.8 + 4.5 = 231.3, Market Line: 227.0",
          "• Edge Points: +4.3, Signal: +1.43, Result: +7.15 Over Score",
          "",
          "Scenario 2: Moderate Under Edge (Slow teams)",
          "• Team Baseline: P=95.0, PPP_home=1.05, PPP_away=1.08 → total_base=202.4",
          "• Factor Adjustments: -2.0 points (slow pace, poor offense)",
          "• Predicted Total: 202.4 - 2.0 = 200.4, Market Line: 205.0",
          "• Edge Points: -4.6, Signal: -1.53, Result: +7.65 Under Score",
          "",
          "Scenario 3: Perfect Line (Balanced teams)",
          "• Team Baseline: P=100.1, PPP_home=1.10, PPP_away=1.10 → total_base=220.2",
          "• Factor Adjustments: +0.8 points (minimal adjustments)",
          "• Predicted Total: 220.2 + 0.8 = 221.0, Market Line: 221.0",
          "• Edge Points: 0.0, Signal: 0.0, Result: 0.0 (No edge)"
        ],
        registry: [
          "Weight: 100% (Fixed - Final Step)",
          "Max Points: 5.0 (maximum impact on prediction)",
          "Scope: global (applies to all sports/bet types)",
          "Data Sources: calculated (team pace + efficiency + factor adjustments)",
          "Supported: All Totals predictions with team-specific baselines"
        ]
      },
      edgeVsMarketSpread: {
        features: [
          "⚖️ Market Edge Calculation: Compares predicted margin vs market spread",
          "🏀 Predicted Margin: Based on Net Rating Differential and factor adjustments",
          "📊 Formula: predicted_margin = Σ(spread_factor_points), edge = predicted_margin - market_spread",
          "⚖️ Edge Calculation: signal = clamp(edge/3, -2, +2)",
          "🎯 Directional Score: Positive edge → Away team, Negative edge → Home team",
          "📈 Max Points: 5.0 for maximum impact on final prediction",
          "🔒 Final Step: Applied after all other factors for final confidence adjustment"
        ],
        examples: [
          "Scenario 1: Strong Away Edge (Underdog value)",
          "• Predicted Margin: Away +2.5, Market Spread: Away +7.0",
          "• Edge: +4.5 (away team undervalued), Signal: +1.5",
          "• Result: +7.5 Away Score (bet on away team)",
          "",
          "Scenario 2: Strong Home Edge (Favorite value)",
          "• Predicted Margin: Home -8.0, Market Spread: Home -4.0",
          "• Edge: -4.0 (home team undervalued), Signal: -1.33",
          "• Result: +6.65 Home Score (bet on home team)",
          "",
          "Scenario 3: Perfect Line (No edge)",
          "• Predicted Margin: Away +3.0, Market Spread: Away +3.0",
          "• Edge: 0.0, Signal: 0.0",
          "• Result: 0.0 (No edge, pass)"
        ],
        registry: [
          "Weight: 100% (Fixed - Final Step)",
          "Max Points: 5.0 (maximum impact on prediction)",
          "Scope: global (applies to all sports/bet types)",
          "Data Sources: calculated (net rating + spread factors + market spread)",
          "Supported: All Spread/Moneyline predictions"
        ]
      },
      turnoverDiff: {
        features: [
          "🏀 Turnover Differential: Ball security vs defensive pressure",
          "📊 Formula: differential = homeTOV - awayTOV, pointImpact = differential × 1.1",
          "⚖️ Smart Scaling: Uses tanh for smooth saturation, caps at ±5 TOV differential",
          "🎯 Directional Scoring: Away OR Home, never both (prevents cancellation)",
          "📈 Max Points: 5.0 (significant ATS impact)"
        ],
        examples: [
          "Scenario 1: Away has ball security advantage",
          "• Away TOV: 12.0/game, Home TOV: 16.0/game",
          "• Differential: +4.0 (home commits more), Point Impact: +4.4",
          "• Signal: +0.63, Result: +3.15 Away Score",
          "",
          "Scenario 2: Home has defensive pressure advantage",
          "• Away TOV: 17.0/game, Home TOV: 12.0/game",
          "• Differential: -5.0 (away commits more), Point Impact: -5.5",
          "• Signal: -0.74, Result: +3.70 Home Score",
          "",
          "Scenario 3: Even ball security",
          "• Away TOV: 14.0/game, Home TOV: 14.0/game",
          "• Differential: 0.0, Point Impact: 0.0",
          "• Signal: 0.0, Result: 0.0 (Neutral)"
        ],
        registry: [
          "Weight: 25% (Default - Adjustable)",
          "Max Points: 5.0 (significant ATS impact)",
          "Scope: NBA SPREAD only",
          "Data Sources: MySportsFeeds (team_gamelogs, last 10 games)",
          "Supported: NBA Spread predictions"
        ]
      },
      shootingEfficiencyMomentum: {
        features: [
          "🎯 Shooting Efficiency: eFG% (70%) + FTr (30%) composite score",
          "📈 Clutch Momentum: Last 3 games vs last 10 games ORtg trend",
          "⚖️ Smart Weighting: Efficiency 60% + Momentum 40%",
          "🔥 Trend Detection: Identifies teams heating up or cooling down",
          "📊 Max Points: 5.0 (significant ATS impact)"
        ],
        examples: [
          "Scenario 1: Away hot shooting + heating up",
          "• Away: eFG% 58%, FTr 28%, ORtg L3: 118, L10: 112",
          "• Home: eFG% 52%, FTr 24%, ORtg L3: 108, L10: 110",
          "• Shooting Diff: +0.052, Momentum: +3.6%",
          "• Signal: +0.68, Result: +3.40 Away Score",
          "",
          "Scenario 2: Home efficient + stable, Away cooling",
          "• Away: eFG% 50%, FTr 22%, ORtg L3: 105, L10: 112",
          "• Home: eFG% 56%, FTr 26%, ORtg L3: 115, L10: 114",
          "• Shooting Diff: -0.044, Momentum: -7.1%",
          "• Signal: -0.72, Result: +3.60 Home Score",
          "",
          "Scenario 3: Even efficiency, no momentum",
          "• Away: eFG% 54%, FTr 24%, ORtg L3: 110, L10: 110",
          "• Home: eFG% 54%, FTr 24%, ORtg L3: 110, L10: 110",
          "• Shooting Diff: 0.0, Momentum: 0.0%",
          "• Signal: 0.0, Result: 0.0 (Neutral)"
        ],
        registry: [
          "Weight: 20% (Default - Adjustable)",
          "Max Points: 5.0 (significant ATS impact)",
          "Scope: NBA SPREAD only",
          "Data Sources: MySportsFeeds (team_gamelogs, last 3 & 10 games)",
          "Supported: NBA Spread predictions"
        ]
      },
      reboundingDiff: {
        features: [
          "🏀 Rebounding Differential: Board control advantage",
          "📊 Formula: OREB advantage * 1.1 + total reb diff * 0.3, signal = tanh(weighted / 6)",
          "⚖️ Smart Scaling: OREB worth more (second chance points)",
          "🎯 Directional Scoring: Team with better rebounding gets edge",
          "📈 Max Points: 5.0 (moderate ATS impact)"
        ],
        examples: [
          "Scenario 1: Strong rebounding team",
          "• Away OREB: 12, DREB: 35, Home OREB: 8, DREB: 32",
          "• OREB Advantage: +4, Total Reb Diff: +7",
          "• Signal: +0.72, Result: +3.60 Away Score",
          "",
          "Scenario 2: Home team dominates boards",
          "• Away OREB: 7, DREB: 30, Home OREB: 14, DREB: 38",
          "• OREB Advantage: -7, Total Reb Diff: -15",
          "• Signal: -0.91, Result: +4.55 Home Score"
        ],
        registry: [
          "Weight: 20% (Default - Adjustable)",
          "Max Points: 5.0 (moderate ATS impact)",
          "Scope: NBA SPREAD only",
          "Data Sources: MySportsFeeds (team_gamelogs, rebounds)",
          "Supported: NBA Spread predictions"
        ]
      },
      defensivePressure: {
        features: [
          "🛡️ Defensive Pressure: Disruption through steals and blocks",
          "📊 Formula: steals * 1.5 + blocks * 0.8, signal = tanh(diff / 4)",
          "⚖️ Smart Scaling: Steals worth more (transition opportunities)",
          "🎯 Directional Scoring: More disruptive defense gets edge",
          "📈 Max Points: 5.0 (moderate ATS impact)"
        ],
        examples: [
          "Scenario 1: High pressure defense",
          "• Away STL: 9, BLK: 5, Home STL: 6, BLK: 4",
          "• Away Disruption: 17.5, Home Disruption: 12.2",
          "• Signal: +0.82, Result: +4.10 Away Score"
        ],
        registry: [
          "Weight: 15% (Default - Adjustable)",
          "Max Points: 5.0 (moderate ATS impact)",
          "Scope: NBA SPREAD only",
          "Data Sources: MySportsFeeds (team_gamelogs, defense)",
          "Supported: NBA Spread predictions"
        ]
      },
      assistEfficiency: {
        features: [
          "🎯 Assist Efficiency: Ball movement and team chemistry",
          "📊 Formula: AST/TOV ratio comparison, signal = tanh(diff / 0.5)",
          "⚖️ Smart Scaling: High AST/TOV = smart decisions = better shots",
          "🎯 Directional Scoring: Better ball movement gets edge",
          "📈 Max Points: 5.0 (moderate ATS impact)"
        ],
        examples: [
          "Scenario 1: Elite ball movement",
          "• Away AST: 28, TOV: 12 (2.33 ratio), Home AST: 22, TOV: 15 (1.47 ratio)",
          "• AST/TOV Diff: +0.86",
          "• Signal: +0.93, Result: +4.65 Away Score"
        ],
        registry: [
          "Weight: 15% (Default - Adjustable)",
          "Max Points: 5.0 (moderate ATS impact)",
          "Scope: NBA SPREAD only",
          "Data Sources: MySportsFeeds (team_gamelogs, offense)",
          "Supported: NBA Spread predictions"
        ]
      },
      restAdvantage: {
        features: [
          "😴 Rest Advantage: Fatigue impact on scoring",
          "📊 Formula: restDiff = awayRestDays - homeRestDays, fatigueScore based on B2B detection",
          "⚖️ Smart Scaling: Uses tanh for smooth saturation, caps at ±3 days differential",
          "🎯 Directional Scoring: Fatigued teams score less, well-rested teams score more",
          "📈 Max Points: 5.0 (significant impact on totals)"
        ],
        examples: [
          "Scenario 1: Both teams on back-to-back",
          "• Away Rest: 0 days (B2B), Home Rest: 0 days (B2B)",
          "• Both teams fatigued → Strong Under signal",
          "• Signal: -0.80, Result: +4.0 Under Score",
          "",
          "Scenario 2: Well-rested vs fatigued",
          "• Away Rest: 3 days, Home Rest: 0 days (B2B)",
          "• Home team fatigued → Moderate Under lean",
          "• Signal: -0.40, Result: +2.0 Under Score"
        ],
        registry: [
          "Weight: 15% (Default - Adjustable)",
          "Max Points: 5.0 (significant impact on totals)",
          "Scope: NBA TOTALS only",
          "Data Sources: MySportsFeeds (team_gamelogs, game dates)",
          "Supported: NBA Totals predictions"
        ]
      },
      momentumIndex: {
        features: [
          "📈 Momentum Index: Team momentum based on streak and recent record",
          "📊 Formula: momentum = (streak × 0.6) + (last10WinPct × 0.4), signal = tanh(momentumDiff / 5)",
          "⚖️ Smart Scaling: Uses tanh for smooth saturation, caps at ±10 momentum differential",
          "🎯 Directional Scoring: Hot teams cover spreads, cold teams fail to cover",
          "📈 Max Points: 5.0 (significant ATS impact)"
        ],
        examples: [
          "Scenario 1: Hot team vs cold team",
          "• Away: 5-game win streak (8-2 L10), Home: 3-game losing streak (3-7 L10)",
          "• Momentum Diff: +6.0 (away favored)",
          "• Signal: +0.76, Result: +3.80 Away Score",
          "",
          "Scenario 2: Both teams neutral",
          "• Away: 1-game win streak (5-5 L10), Home: 1-game win streak (5-5 L10)",
          "• Momentum Diff: 0.0 (neutral)",
          "• Signal: 0.0, Result: No edge"
        ],
        registry: [
          "Weight: 15% (Default - Adjustable)",
          "Max Points: 5.0 (significant ATS impact)",
          "Scope: NBA SPREAD only",
          "Data Sources: MySportsFeeds (team_gamelogs, streak and last 10 record)",
          "Supported: NBA Spread predictions"
        ]
      }
    }
    return detailsMap[key] || { features: [], examples: [], registry: [] }
  }

  // Calculate effective max points based on weight
  const getEffectiveMaxPoints = (factor: FactorConfig) => {
    if (isEdgeFactor(factor.key)) {
      return 5.0 // Edge vs Market factors are always at 100% weight
    }
    return (factor.maxPoints * factor.weight) / 100
  }

  // Factor logic definitions for the Logic Drawer
  const getFactorLogic = (key: string) => {
    console.log(`[getFactorLogic] Looking for key: ${key}`)
    const logicMap: Record<string, { metric: string; formula: string; examples: string[] }> = {
      paceIndex: {
        metric: "Expected game pace based on both teams' recent pace (last 10 games)",
        formula: "expPace = (awayPace + homePace)/2, signal = tanh((expPace - leaguePace)/8), if signal > 0: overScore = |signal| × maxPoints, underScore = 0; else: overScore = 0, underScore = |signal| × maxPoints",
        examples: [
          "| Expected Pace | League Pace | Delta | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|---------------|-------------|-------|--------|------------|-------------|------------|---------------|",
          "| 107.5         | 99.5        | +8.0  | +0.76  | +3.80      | 0.0         | High       | Fast teams (IND, ATL)    |",
          "| 104.5         | 99.5        | +5.0  | +0.56  | +2.80      | 0.0         | Moderate   | Above avg (SAC, MIL)     |",
          "| 102.0         | 99.5        | +2.5  | +0.30  | +1.50      | 0.0         | Low        | Slightly fast |",
          "| 99.5          | 99.5        | 0.0   | 0.0    | 0.0        | 0.0         | Neutral    | League avg    |",
          "| 97.0          | 99.5        | -2.5  | -0.30  | 0.0        | +1.50       | Low        | Slightly slow |",
          "| 94.5          | 99.5        | -5.0  | -0.56  | 0.0        | +2.80       | Moderate   | Below avg (ORL, CLE)     |",
          "| 91.5          | 99.5        | -8.0  | -0.76  | 0.0        | +3.80       | High       | Slow teams    |",
          "",
          "*Metric: Expected game pace based on both teams' recent pace (last 10 games)*",
          "*Formula: expPace = (awayPace + homePace)/2, signal = tanh((expPace - leaguePace)/8), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*",
          "*2024-25 NBA League Average Pace: 99.5*"
        ]
      },
      offForm: {
        metric: "Combined team offensive efficiency vs league average (last 10 games)",
        formula: "combinedORtg = (homeORtg + awayORtg)/2, advantage = combinedORtg - leagueORtg, signal = tanh(advantage/10), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
        examples: [
          "| Combined ORtg | League ORtg | Advantage | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|---------------|-------------|-----------|--------|------------|-------------|------------|---------------|",
          "| 124.5         | 114.5       | +10.0     | +0.76  | +3.80      | 0.0         | High       | Hot offenses (BOS, OKC)  |",
          "| 119.5         | 114.5       | +5.0      | +0.46  | +2.30      | 0.0         | Moderate   | Above avg (NYK, CLE)     |",
          "| 117.0         | 114.5       | +2.5      | +0.24  | +1.20      | 0.0         | Low        | Slightly hot  |",
          "| 114.5         | 114.5       | 0.0       | 0.0    | 0.0        | 0.0         | Neutral    | League avg    |",
          "| 112.0         | 114.5       | -2.5      | -0.24  | 0.0        | +1.20       | Low        | Slightly cold |",
          "| 109.5         | 114.5       | -5.0      | -0.46  | 0.0        | +2.30       | Moderate   | Below avg (WAS, POR)     |",
          "| 104.5         | 114.5       | -10.0     | -0.76  | 0.0        | +3.80       | High       | Cold offenses (UTA, DET) |",
          "",
          "*Metric: Combined team offensive efficiency vs league average (last 10 games)*",
          "*Formula: combinedORtg = (homeORtg + awayORtg)/2, advantage = combinedORtg - leagueORtg, signal = tanh(advantage/10), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*",
          "*2024-25 NBA League Average ORtg: 114.5*"
        ]
      },
      defErosion: {
        metric: "Combined defensive rating decline + injury impact (season + AI analysis)",
        formula: "combinedDRtg = (homeDRtg + awayDRtg)/2, drtgDelta = combinedDRtg - leagueDRtg, totalErosion = 0.7×drtgDelta + 0.3×injuryImpact×10, signal = tanh(totalErosion/8), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
        examples: [
          "| Combined DRtg | League DRtg | DRtg Delta | Injury Impact | Total Erosion | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|---------------|-------------|------------|---------------|---------------|--------|------------|-------------|------------|---------------|",
          "| 122.5         | 114.5       | +8.0       | -0.5          | +4.1          | +0.47  | +2.35      | 0.0         | Moderate   | Weak defense + injuries (WAS, POR) |",
          "| 119.5         | 114.5       | +5.0       | -0.2          | +2.9          | +0.35  | +1.75      | 0.0         | Moderate   | Below avg + minor injuries |",
          "| 117.0         | 114.5       | +2.5       | 0.0           | +1.75         | +0.21  | +1.05      | 0.0         | Low        | Slightly weak |",
          "| 114.5         | 114.5       | 0.0        | 0.0           | 0.0           | 0.0    | 0.0        | 0.0         | Neutral    | League avg |",
          "| 112.0         | 114.5       | -2.5       | 0.0           | -1.75         | -0.21  | 0.0        | +1.05       | Low        | Slightly strong |",
          "| 109.5         | 114.5       | -5.0       | +0.2          | -2.9          | -0.35  | 0.0        | +1.75       | Moderate   | Above avg + healthy (OKC, BOS) |",
          "| 106.5         | 114.5       | -8.0       | +0.5          | -4.1          | -0.47  | 0.0        | +2.35       | Moderate   | Strong defense + healthy (CLE, MIN) |",
          "",
          "*Metric: Combined defensive rating decline + injury impact (season + AI analysis)*",
          "*Formula: combinedDRtg = (homeDRtg + awayDRtg)/2, drtgDelta = combinedDRtg - leagueDRtg, totalErosion = 0.7×drtgDelta + 0.3×injuryImpact×10, signal = tanh(totalErosion/8), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*",
          "*2024-25 NBA League Average DRtg: 114.5*"
        ]
      },
      edgeVsMarket: {
        metric: "Final confidence adjustment based on team-specific predicted total vs market line",
        formula: "P = 0.5×(pace_home + pace_away), PPP_home = 1.10 + 0.5×(ORtg_home-110)/100 - 0.5×(DRtg_away-110)/100, PPP_away = 1.10 + 0.5×(ORtg_away-110)/100 - 0.5×(DRtg_home-110)/100, total_base = P × (PPP_home + PPP_away), predicted_total = total_base + Σ(factor_points), edgePts = predictedTotal - marketTotalLine, signal = clamp(edgePts/3, -2, +2), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
        examples: [
          "| Team Baseline | Factor Adj | Predicted | Market | Edge | Signal | Over Score | Under Score | Confidence | Example |",
          "|---------------|------------|-----------|--------|------|--------|------------|-------------|------------|---------|",
          "| 226.8 (fast)  | +4.5       | 231.3     | 227.0  | +4.3 | +1.43  | +7.15      | 0.0         | High      | High-scoring teams |",
          "| 220.2 (avg)   | +2.0       | 222.2     | 225.0  | -2.8 | -0.93  | 0.0        | +4.65       | Moderate  | Balanced teams |",
          "| 202.4 (slow)  | -2.0       | 200.4     | 205.0  | -4.6 | -1.53  | 0.0        | +7.65       | High      | Slow teams |",
          "| 215.5 (def)   | +1.5       | 217.0     | 217.0  | 0.0  | 0.0    | 0.0        | 0.0         | Neutral   | Perfect line |",
          "| 240.1 (hot)   | +6.0       | 246.1     | 240.0  | +6.1 | +2.0   | +10.0      | 0.0         | Maximum   | Hot offenses |",
          "| 195.8 (cold)  | -3.5       | 192.3     | 200.0  | -7.7 | -2.0   | 0.0        | +10.0       | Maximum   | Cold offenses |",
          "| 230.5 (3P)    | +3.2       | 233.7     | 228.0  | +5.7 | +1.9   | +9.5       | 0.0         | High      | High 3P volume |",
          "| 210.3 (FT)    | +1.8       | 212.1     | 215.0  | -2.9 | -0.97  | 0.0        | +4.85       | Moderate  | Low FT teams |",
          "",
          "🏀 **Team-Specific Baseline Calculation:**",
          "• P = 0.5 × (pace_home + pace_away) - Expected possessions",
          "• PPP_home = 1.10 + 0.5×(ORtg_home-110)/100 - 0.5×(DRtg_away-110)/100",
          "• PPP_away = 1.10 + 0.5×(ORtg_away-110)/100 - 0.5×(DRtg_home-110)/100",
          "• total_base = P × (PPP_home + PPP_away)",
          "",
          "📊 **Factor Integration:**",
          "• predicted_total = total_base + Σ(factor_signal × 5.0 × weight%)",
          "• edgePts = predicted_total - market_total_line",
          "• signal = clamp(edgePts/3, -2, +2)",
          "",
          "*Metric: Final confidence adjustment based on team-specific predicted total vs market line*",
          "*Formula: P = 0.5×(pace_home + pace_away), PPP_home = 1.10 + 0.5×(ORtg_home-110)/100 - 0.5×(DRtg_away-110)/100, PPP_away = 1.10 + 0.5×(ORtg_away-110)/100 - 0.5×(DRtg_home-110)/100, total_base = P × (PPP_home + PPP_away), predicted_total = total_base + Σ(factor_points), edgePts = predictedTotal - marketTotalLine, signal = clamp(edgePts/3, -2, +2), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*"
        ]
      },
      edgeVsMarketSpread: {
        metric: "Final confidence adjustment based on predicted margin vs market spread",
        formula: "predicted_margin = Σ(spread_factor_points), edge = predicted_margin - market_spread, signal = clamp(edge/3, -2, +2), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0",
        examples: [
          "| Predicted Margin | Market Spread | Edge | Signal | Away Score | Home Score | Confidence | Example |",
          "|------------------|---------------|------|--------|------------|------------|------------|---------|",
          "| Away +2.5        | Away +7.0     | +4.5 | +1.5   | +7.5       | 0.0        | High       | Underdog value |",
          "| Home -8.0        | Home -4.0     | -4.0 | -1.33  | 0.0        | +6.65      | High       | Favorite value |",
          "| Away +3.0        | Away +3.0     | 0.0  | 0.0    | 0.0        | 0.0        | Neutral    | Perfect line |",
          "| Home -12.0       | Home -6.0     | -6.0 | -2.0   | 0.0        | +10.0      | Maximum    | Strong favorite |",
          "| Away +10.0       | Away +4.0     | +6.0 | +2.0   | +10.0      | 0.0        | Maximum    | Strong underdog |",
          "",
          "🏀 **Predicted Margin Calculation:**",
          "• predicted_margin = Σ(spread_factor_signal × 5.0 × weight%)",
          "• Positive margin = Away team favored",
          "• Negative margin = Home team favored",
          "",
          "📊 **Edge Calculation:**",
          "• edge = predicted_margin - market_spread",
          "• Positive edge = Away team undervalued (bet away)",
          "• Negative edge = Home team undervalued (bet home)",
          "• signal = clamp(edge/3, -2, +2)",
          "",
          "*Metric: Final confidence adjustment based on predicted margin vs market spread*",
          "*Formula: predicted_margin = Σ(spread_factor_points), edge = predicted_margin - market_spread, signal = clamp(edge/3, -2, +2), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0*"
        ]
      },
      threeEnv: {
        metric: "3-point environment & volatility based on attempt rate and shooting variance",
        formula: "envRate = (home3PAR + away3PAR)/2, rateDelta = envRate - league3PAR, shootingVariance = |home3Pct - away3Pct|, hotShootingFactor = max(0, shootingVariance - leagueVariance), combinedSignal = (2×rateDelta) + (hotShootingFactor×10), signal = tanh(combinedSignal/0.1), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
        examples: [
          "| Home 3PAR | Away 3PAR | Env Rate | League 3PAR | Rate Delta | Shooting Var | Hot Factor | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|-----------|-----------|----------|-------------|------------|--------------|------------|--------|------------|-------------|------------|---------------|",
          "| 0.45      | 0.43      | 0.44     | 0.39        | +0.05      | 0.08         | 0.03       | +0.85  | +4.25      | 0.0         | High       | High-volume 3P teams |",
          "| 0.42      | 0.40      | 0.41     | 0.39        | +0.02      | 0.05         | 0.00       | +0.46  | +2.30      | 0.0         | Moderate   | Above avg 3P teams |",
          "| 0.40      | 0.38      | 0.39     | 0.39        | 0.00       | 0.03         | 0.00       | 0.00   | 0.0        | 0.0         | Neutral    | League avg 3P teams |",
          "| 0.35      | 0.33      | 0.34     | 0.39        | -0.05      | 0.02         | 0.00       | -0.85  | 0.0        | +4.25       | High       | Low-volume 3P teams |",
          "| 0.32      | 0.30      | 0.31     | 0.39        | -0.08      | 0.01         | 0.00       | -1.00  | 0.0        | +5.00       | Maximum    | Very low 3P teams |",
          "",
          "*Metric: 3-point environment based on attempt rate and shooting variance*",
          "*Formula: envRate = (home3PAR + away3PAR)/2, rateDelta = envRate - league3PAR, shootingVariance = |home3Pct - away3Pct|, hotShootingFactor = max(0, shootingVariance - leagueVariance), combinedSignal = (2×rateDelta) + (hotShootingFactor×10), signal = tanh(combinedSignal/0.1), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*"
        ]
      },
      whistleEnv: {
        metric: "Free throw rate environment based on team FT attempt rates",
        formula: "ftrEnv = (homeFTr + awayFTr)/2, ftrDelta = ftrEnv - leagueFTr, signal = tanh(ftrDelta/0.06), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
        examples: [
          "| Home FTr | Away FTr | FT Env | League FTr | FT Delta | Signal | Over Score | Under Score | Confidence | Example Teams |",
          "|----------|----------|--------|------------|----------|--------|------------|-------------|------------|---------------|",
          "| 0.28     | 0.26     | 0.27   | 0.22       | +0.05    | +0.76  | +3.80      | 0.0         | High       | High FT rate teams |",
          "| 0.25     | 0.23     | 0.24   | 0.22       | +0.02    | +0.33  | +1.65      | 0.0         | Moderate   | Above avg FT teams |",
          "| 0.22     | 0.20     | 0.21   | 0.22       | -0.01    | -0.17  | 0.0        | +0.85       | Low        | Slightly below avg |",
          "| 0.20     | 0.18     | 0.19   | 0.22       | -0.03    | -0.46  | 0.0        | +2.30       | Moderate   | Below avg FT teams |",
          "| 0.18     | 0.16     | 0.17   | 0.22       | -0.05    | -0.76  | 0.0        | +3.80       | High       | Low FT rate teams |",
          "| 0.15     | 0.13     | 0.14   | 0.22       | -0.08    | -1.00  | 0.0        | +5.00       | Maximum    | Very low FT teams |",
          "",
          "*Metric: Free throw rate environment based on team FT attempt rates*",
          "*Formula: ftrEnv = (homeFTr + awayFTr)/2, ftrDelta = ftrEnv - leagueFTr, signal = tanh(ftrDelta/0.06), if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*"
        ]
      },
      injuryAvailability: {
        metric: "AI analysis of key player injuries and availability impact on scoring",
        formula: "AI analyzes injuries → awayImpact (-10 to +10) + homeImpact (-10 to +10) → totalImpact = (awayImpact + homeImpact)/2 → signal = clamp(totalImpact/10, -1, +1) → if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
        examples: [
          "| Away Impact | Home Impact | Total Impact | Signal | Over Score | Under Score | Confidence | Example Scenario |",
          "|-------------|-------------|--------------|--------|------------|-------------|------------|------------------|",
          "| -8          | -6          | -7.0         | -0.70  | 0.0        | +3.50       | High       | Both teams missing key scorers |",
          "| -5          | -3          | -4.0         | -0.40  | 0.0        | +2.00       | Moderate   | One team missing star player |",
          "| -2          | -1          | -1.5         | -0.15  | 0.0        | +0.75       | Low        | Minor injuries affecting depth |",
          "| 0           | 0           | 0.0          | 0.0    | 0.0        | 0.0         | Neutral    | No significant injuries |",
          "| +2          | +1          | +1.5         | +0.15  | +0.75      | 0.0         | Low        | Minor defensive injuries |",
          "| +5          | +3          | +4.0         | +0.40  | +2.00      | 0.0         | Moderate   | One team missing key defender |",
          "| +8          | +6          | +7.0         | +0.70  | +3.50      | 0.0         | High       | Both teams missing key defenders |",
          "| +10         | +8          | +9.0         | +0.90  | +4.50      | 0.0         | Very High  | Multiple defensive injuries |",
          "",
          "*Metric: AI analysis of key player injuries and availability impact on scoring*",
          "*Formula: AI analyzes injuries → awayImpact (-10 to +10) + homeImpact (-10 to +10) → totalImpact = (awayImpact + homeImpact)/2 → signal = clamp(totalImpact/10, -1, +1) → if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0*",
          "",
          "🤖 **AI PROMPT USED:**",
          "```",
          "Analyze the following injury data for a NBA game between [Away Team] and [Home Team] on [Game Date].",
          "",
          "Injury Data: [Recent injury findings from news API]",
          "",
          "Please provide a JSON response with this exact structure:",
          "{",
          "  \"awayImpact\": -10 to +10 (negative = hurts scoring, positive = helps scoring),",
          "  \"homeImpact\": -10 to +10 (negative = hurts scoring, positive = helps scoring),",
          "  \"keyInjuries\": [\"list of key player injuries affecting the game\"],",
          "  \"reasoning\": \"brief explanation of how injuries affect scoring potential\"",
          "}",
          "",
          "Consider:",
          "1. Are key offensive players out? (star players, top scorers, playmakers)",
          "2. Are key defensive players out? (elite defenders, rim protectors)",
          "3. How long have they been out? (recent vs long-term)",
          "4. How has the team performed without them? (scoring trends)",
          "5. Are there multiple injuries creating depth issues?",
          "6. Do injuries affect pace of play? (injured players often slow down games)",
          "7. Are there any \"questionable\" players that might not be 100%?",
          "",
          "For TOTALS betting, focus on scoring impact:",
          "- Missing star offensive players = lower totals (negative impact)",
          "- Missing key defensive players = higher totals (positive impact)",
          "- Multiple injuries = compound effect",
          "- Recent injuries = more impact than long-term ones",
          "- Depth issues = affects bench scoring",
          "",
          "Return ONLY the JSON, no other text.",
          "```"
        ]
      },
      // ========================================
      // SPREAD FACTORS (S1-S5)
      // ========================================
      netRatingDiff: {
        metric: "Net Rating Differential (Offensive Rating - Defensive Rating) adjusted for opponent",
        formula: "awayNetRating = awayORtg - awayDRtg, homeNetRating = homeORtg - homeDRtg, differential = awayNetRating - homeNetRating, expectedMargin = (differential/100) × pace, signal = tanh(expectedMargin/8), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0",
        examples: [
          "| Away NetRtg | Home NetRtg | Differential | Pace | Expected Margin | Signal | Away Score | Home Score | Confidence | Example Teams |",
          "|-------------|-------------|--------------|------|-----------------|--------|------------|------------|------------|---------------|",
          "| +8.3        | -8.7        | +17.0        | 100  | +17.0           | +0.95  | +4.75      | 0.0        | High       | Bucks vs Pistons |",
          "| +5.2        | -3.1        | +8.3         | 98   | +8.1            | +0.78  | +3.90      | 0.0        | High       | Strong vs weak |",
          "| +3.0        | +1.0        | +2.0         | 102  | +2.0            | +0.24  | +1.20      | 0.0        | Low        | Slight edge |",
          "| 0.0         | 0.0         | 0.0          | 100  | 0.0             | 0.0    | 0.0        | 0.0        | Neutral    | Even matchup |",
          "| -2.0        | +3.0        | -5.0         | 98   | -4.9            | -0.53  | 0.0        | +2.65      | Moderate   | Home advantage |",
          "| -5.5        | +6.2        | -11.7        | 100  | -11.7           | -0.91  | 0.0        | +4.55      | High       | Strong home team |",
          "",
          "🏀 **Net Rating Calculation:**",
          "• OffRtg = (points / possessions) × 100",
          "• DefRtg = (oppPoints / possessions) × 100",
          "• NetRtg = OffRtg - DefRtg",
          "",
          "📊 **Expected Margin:**",
          "• differential = awayNetRtg - homeNetRtg",
          "• expectedMargin = (differential / 100) × pace",
          "• Positive margin = Away team favored",
          "• Negative margin = Home team favored",
          "",
          "*Metric: Net Rating Differential (Offensive Rating - Defensive Rating) adjusted for opponent*",
          "*Formula: awayNetRating = awayORtg - awayDRtg, homeNetRating = homeORtg - homeDRtg, differential = awayNetRating - homeNetRating, expectedMargin = (differential/100) × pace, signal = tanh(expectedMargin/8), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0*"
        ]
      },
      atsMomentum: {
        metric: "Recent ATS performance (last 10 games) - covers vs losses",
        formula: "Calculate ATS record for last 10 games, assign momentum score: 70%+ = +3.0, 60%+ = +1.5, 50% = 0.0, 40%- = -1.5, 30%- = -3.0, differential = awayMomentum - homeMomentum, signal = tanh(differential/3), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0",
        examples: [
          "| Away ATS (L10) | Away Momentum | Home ATS (L10) | Home Momentum | Differential | Signal | Away Score | Home Score | Confidence | Example |",
          "|----------------|---------------|----------------|---------------|--------------|--------|------------|------------|------------|---------|",
          "| 7-3 (70%)      | +3.0          | 4-6 (40%)      | -1.5          | +4.5         | +0.91  | +4.55      | 0.0        | High       | Heat vs Celtics |",
          "| 6-4 (60%)      | +1.5          | 5-5 (50%)      | 0.0           | +1.5         | +0.46  | +2.30      | 0.0        | Moderate   | Above avg vs neutral |",
          "| 5-5 (50%)      | 0.0           | 5-5 (50%)      | 0.0           | 0.0          | 0.0    | 0.0        | 0.0        | Neutral    | Both neutral |",
          "| 4-6 (40%)      | -1.5          | 6-4 (60%)      | +1.5          | -3.0         | -0.76  | 0.0        | +3.80      | High       | Home momentum |",
          "| 3-7 (30%)      | -3.0          | 7-3 (70%)      | +3.0          | -6.0         | -0.95  | 0.0        | +4.75      | High       | Strong home momentum |",
          "",
          "🎯 **ATS Momentum Scoring:**",
          "• 7-3 or better (70%+) = +3.0 points",
          "• 6-4 (60%+) = +1.5 points",
          "• 5-5 (50%) = 0.0 points (neutral)",
          "• 4-6 (40%-) = -1.5 points",
          "• 3-7 or worse (30%-) = -3.0 points",
          "",
          "📊 **Why This Works:**",
          "• Public overreaction to recent winners (moneyline), not ATS",
          "• Oddsmakers lag in adjusting to ATS trends",
          "• Teams on ATS hot streaks often undervalued",
          "",
          "*Metric: Recent ATS performance (last 10 games) - covers vs losses*",
          "*Formula: Calculate ATS record for last 10 games, assign momentum score: 70%+ = +3.0, 60%+ = +1.5, 50% = 0.0, 40%- = -1.5, 30%- = -3.0, differential = awayMomentum - homeMomentum, signal = tanh(differential/3), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0*"
        ]
      },
      homeCourtAdv: {
        metric: "Home court advantage adjusted for venue strength (actual HCA vs league average)",
        formula: "homeWinRate = homeWins / homeGames, roadWinRate = roadWins / roadGames, actualHCA = (homeWinRate - roadWinRate) × 30, leagueAvgHCA = 3.0, hcaEdge = actualHCA - leagueAvgHCA, signal = tanh(hcaEdge/4), homeScore = |signal| × 5.0, awayScore = 0",
        examples: [
          "| Home Win% | Road Win% | Win% Diff | Actual HCA | League Avg | HCA Edge | Signal | Away Score | Home Score | Confidence | Example |",
          "|-----------|-----------|-----------|------------|------------|----------|--------|------------|------------|------------|---------|",
          "| 68.3%     | 43.9%     | +24.4%    | +7.3       | 3.0        | +4.3     | +0.85  | 0.0        | +4.25      | High       | Nuggets (altitude) |",
          "| 62.0%     | 48.0%     | +14.0%    | +4.2       | 3.0        | +1.2     | +0.29  | 0.0        | +1.45      | Low        | Above avg HCA |",
          "| 55.0%     | 45.0%     | +10.0%    | +3.0       | 3.0        | 0.0      | 0.0    | 0.0        | 0.0        | Neutral    | League avg HCA |",
          "| 52.0%     | 48.0%     | +4.0%     | +1.2       | 3.0        | -1.8     | -0.42  | +2.10      | 0.0        | Moderate   | Weak HCA |",
          "| 48.0%     | 52.0%     | -4.0%     | -1.2       | 3.0        | -4.2     | -0.85  | +4.25      | 0.0        | High       | Road team better |",
          "",
          "🏀 **Home Court Advantage Calculation:**",
          "• actualHCA = (homeWinRate - roadWinRate) × 30",
          "• leagueAvgHCA = 3.0 points (NBA standard)",
          "• hcaEdge = actualHCA - leagueAvgHCA",
          "",
          "📊 **Elite HCA Examples:**",
          "• Denver Nuggets: 7.3 pts (altitude advantage)",
          "• Utah Jazz: 6.5 pts (altitude + crowd)",
          "• Portland Trail Blazers: 5.8 pts (loud arena)",
          "",
          "📊 **Weak HCA Examples:**",
          "• Brooklyn Nets: 1.5 pts (shared arena)",
          "• LA Clippers: 1.8 pts (shared arena)",
          "",
          "*Metric: Home court advantage adjusted for venue strength (actual HCA vs league average)*",
          "*Formula: homeWinRate = homeWins / homeGames, roadWinRate = roadWins / roadGames, actualHCA = (homeWinRate - roadWinRate) × 30, leagueAvgHCA = 3.0, hcaEdge = actualHCA - leagueAvgHCA, signal = tanh(hcaEdge/4), homeScore = |signal| × 5.0, awayScore = 0*"
        ]
      },
      fourFactorsDiff: {
        metric: "Dean Oliver's Four Factors efficiency differential (eFG%, TOV%, OREB%, FTR)",
        formula: "rating = (0.50×eFG%) - (0.30×TOV%) + (0.15×OREB%) + (0.05×FTR), differential = awayRating - homeRating, expectedMargin = differential × 120, signal = tanh(expectedMargin/8), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0",
        examples: [
          "| Away Rating | Home Rating | Differential | Expected Margin | Signal | Away Score | Home Score | Confidence | Example |",
          "|-------------|-------------|--------------|-----------------|--------|------------|------------|------------|---------|",
          "| 0.2926      | 0.2756      | +0.0170      | +2.04           | +0.25  | +1.25      | 0.0        | Low        | Warriors vs Kings |",
          "| 0.3100      | 0.2800      | +0.0300      | +3.60           | +0.42  | +2.10      | 0.0        | Moderate   | Elite vs average |",
          "| 0.2900      | 0.2900      | 0.0000       | 0.00            | 0.0    | 0.0        | 0.0        | Neutral    | Even efficiency |",
          "| 0.2700      | 0.2950      | -0.0250      | -3.00           | -0.35  | 0.0        | +1.75      | Moderate   | Home efficiency edge |",
          "| 0.2600      | 0.3050      | -0.0450      | -5.40           | -0.59  | 0.0        | +2.95      | High       | Strong home efficiency |",
          "",
          "🏀 **Four Factors Calculation:**",
          "• eFG% = (fgMade + 0.5×fg3Made) / fgAtt",
          "• TOV% = turnovers / possessions",
          "• OREB% = offReb / (offReb + oppDefReb)",
          "• FTR = ftAtt / fgAtt",
          "",
          "📊 **Four Factors Rating:**",
          "• rating = (0.50×eFG%) - (0.30×TOV%) + (0.15×OREB%) + (0.05×FTR)",
          "• Weights based on Dean Oliver's research",
          "• 95% correlation to team wins",
          "",
          "📊 **Expected Margin:**",
          "• differential = awayRating - homeRating",
          "• expectedMargin = differential × 120",
          "• Rule of thumb: 0.01 differential ≈ 1.2 points",
          "",
          "*Metric: Dean Oliver's Four Factors efficiency differential (eFG%, TOV%, OREB%, FTR)*",
          "*Formula: rating = (0.50×eFG%) - (0.30×TOV%) + (0.15×OREB%) + (0.05×FTR), differential = awayRating - homeRating, expectedMargin = differential × 120, signal = tanh(expectedMargin/8), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0*"
        ]
      },
      turnoverDiff: {
        metric: "Ball security and defensive pressure (turnovers forced vs committed)",
        formula: "differential = homeTOV - awayTOV, expectedPointImpact = differential × 1.1, signal = tanh(expectedPointImpact/5.0), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0",
        examples: [
          "| Away TOV | Home TOV | Differential | Point Impact | Signal | Away Score | Home Score | Confidence | Example |",
          "|----------|----------|--------------|--------------|--------|------------|------------|------------|---------|",
          "| 12.0     | 16.0     | +4.0         | +4.4         | +0.63  | +3.15      | 0.0        | High       | Away forces more TOV |",
          "| 13.5     | 15.5     | +2.0         | +2.2         | +0.37  | +1.85      | 0.0        | Moderate   | Away slight edge |",
          "| 14.0     | 14.0     | 0.0          | 0.0          | 0.0    | 0.0        | 0.0        | Neutral    | Even ball security |",
          "| 15.0     | 13.0     | -2.0         | -2.2         | -0.37  | 0.0        | +1.85      | Moderate   | Home slight edge |",
          "| 17.0     | 12.0     | -5.0         | -5.5         | -0.74  | 0.0        | +3.70      | High       | Home forces more TOV |",
          "",
          "🏀 **Turnover Impact:**",
          "• Each turnover = extra possession ≈ 1.1 points",
          "• Based on league average ORtg × possession value",
          "• Teams with +3 TOV differential cover spread ~58% of time",
          "",
          "📊 **Calculation:**",
          "• Positive differential = Home commits more TOV (Away advantage)",
          "• Negative differential = Away commits more TOV (Home advantage)",
          "• Point Impact = Differential × 1.1 points per turnover",
          "",
          "🎯 **ATS Predictive Value:**",
          "• Turnover differential in close games is highly predictive",
          "• Ball security = fewer wasted possessions",
          "• Defensive pressure = creating extra possessions",
          "",
          "*Metric: Average turnovers per game (last 10 games) - ball security vs defensive pressure*",
          "*Formula: differential = homeTOV - awayTOV, expectedPointImpact = differential × 1.1, signal = tanh(expectedPointImpact/5.0), if signal > 0: awayScore = |signal| × 5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal| × 5.0*"
        ]
      },
      shootingEfficiencyMomentum: {
        metric: "Shooting efficiency (eFG% + FTr) combined with recent performance momentum (last 3 vs last 10 games)",
        formula: "awayShoot = (awayEfg×0.7)+(awayFtr×0.3), homeShoot = (homeEfg×0.7)+(homeFtr×0.3), shootDiff = awayShoot-homeShoot, awayMom = (awayORtg3-awayORtg10)/awayORtg10, homeMom = (homeORtg3-homeORtg10)/homeORtg10, momDiff = awayMom-homeMom, effSignal = shootDiff×100, momSignal = momDiff×50, combined = (effSignal×0.6)+(momSignal×0.4), signal = tanh(combined/6), if signal > 0: awayScore = |signal|×5.0, homeScore = 0; else: awayScore = 0, homeScore = |signal|×5.0",
        examples: [
          "| Away eFG% | Away FTr | Away ORtg L3 | Away ORtg L10 | Home eFG% | Home FTr | Home ORtg L3 | Home ORtg L10 | Shoot Diff | Mom Diff | Signal | Away Score | Home Score | Trend | Example |",
          "|-----------|----------|--------------|---------------|-----------|----------|--------------|---------------|------------|----------|--------|------------|------------|-------|---------|",
          "| 58.0%     | 28.0%    | 118.0        | 112.0         | 52.0%     | 24.0%    | 108.0        | 110.0         | +0.052     | +3.6%    | +0.68  | +3.40      | 0.0        | 🔥 Hot | Away heating up |",
          "| 50.0%     | 22.0%    | 105.0        | 112.0         | 56.0%     | 26.0%    | 115.0        | 114.0         | -0.044     | -7.1%    | -0.72  | 0.0        | +3.60      | ❄️ Cold | Away cooling down |",
          "| 54.0%     | 24.0%    | 110.0        | 110.0         | 54.0%     | 24.0%    | 110.0        | 110.0         | 0.0        | 0.0%     | 0.0    | 0.0        | 0.0        | ⚖️ Even | Perfect balance |",
          "| 60.0%     | 30.0%    | 122.0        | 115.0         | 48.0%     | 20.0%    | 102.0        | 108.0         | +0.084     | +6.6%    | +0.89  | +4.45      | 0.0        | 🔥🔥 | Away dominant |",
          "| 46.0%     | 18.0%    | 98.0         | 108.0         | 58.0%     | 28.0%    | 120.0        | 116.0         | -0.090     | -12.7%   | -0.92  | 0.0        | +4.60      | 🔥🔥 | Home surging |",
          "| 55.0%     | 25.0%    | 114.0        | 110.0         | 53.0%     | 23.0%    | 106.0        | 110.0         | +0.022     | +7.3%    | +0.52  | +2.60      | 0.0        | 🔥 | Away trending up |",
          "| 52.0%     | 24.0%    | 106.0        | 110.0         | 56.0%     | 26.0%    | 116.0        | 112.0         | -0.034     | -7.1%    | -0.62  | 0.0        | +3.10      | 🔥 | Home trending up |",
          "| 57.0%     | 27.0%    | 110.0        | 115.0         | 54.0%     | 24.0%    | 110.0        | 110.0         | +0.029     | -4.3%    | +0.08  | +0.40      | 0.0        | ⚖️ | Mixed signals |",
          "| 53.0%     | 23.0%    | 108.0        | 110.0         | 55.0%     | 25.0%    | 112.0        | 110.0         | -0.020     | -3.6%    | -0.28  | 0.0        | +1.40      | ⚖️ | Slight home edge |",
          "| 59.0%     | 29.0%    | 120.0        | 112.0         | 51.0%     | 22.0%    | 108.0        | 110.0         | +0.067     | +5.4%    | +0.81  | +4.05      | 0.0        | 🔥 | Away hot streak |",
          "| 48.0%     | 20.0%    | 100.0        | 110.0         | 57.0%     | 27.0%    | 118.0        | 114.0         | -0.075     | -12.4%   | -0.87  | 0.0        | +4.35      | 🔥 | Home hot streak |",
          "| 54.5%     | 24.5%    | 111.0        | 110.0         | 54.0%     | 24.0%    | 109.0        | 110.0         | +0.005     | +1.8%    | +0.18  | +0.90      | 0.0        | ⚖️ | Minimal edge |",
          "| 56.0%     | 26.0%    | 108.0        | 112.0         | 55.0%     | 25.0%    | 112.0        | 110.0         | +0.010     | -5.4%    | -0.22  | 0.0        | +1.10      | ❄️ | Away cooling |",
          "| 61.0%     | 31.0%    | 125.0        | 118.0         | 50.0%     | 21.0%    | 105.0        | 108.0         | +0.093     | +5.1%    | +0.93  | +4.65      | 0.0        | 🔥🔥 | Away elite |",
          "| 47.0%     | 19.0%    | 96.0         | 106.0         | 59.0%     | 29.0%    | 122.0        | 116.0         | -0.096     | -14.6%   | -0.95  | 0.0        | +4.75      | 🔥🔥 | Home elite |",
          "| 55.5%     | 25.5%    | 112.0        | 110.0         | 54.5%     | 24.5%    | 108.0        | 110.0         | +0.010     | +0.0%    | +0.10  | +0.50      | 0.0        | ⚖️ | Slight away edge |",
          "| 53.5%     | 23.5%    | 108.0        | 110.0         | 55.5%     | 25.5%    | 112.0        | 110.0         | -0.020     | -3.6%    | -0.28  | 0.0        | +1.40      | ⚖️ | Slight home edge |",
          "| 58.5%     | 28.5%    | 116.0        | 112.0         | 52.5%     | 23.5%    | 106.0        | 110.0         | +0.055     | +0.0%    | +0.55  | +2.75      | 0.0        | 🔥 | Away efficient |",
          "| 51.5%     | 22.5%    | 104.0        | 110.0         | 57.5%     | 27.5%    | 114.0        | 112.0         | -0.055     | -7.3%    | -0.66  | 0.0        | +3.30      | 🔥 | Home efficient |",
          "| 60.5%     | 30.5%    | 121.0        | 114.0         | 49.5%     | 21.5%    | 103.0        | 108.0         | +0.087     | +1.5%    | +0.88  | +4.40      | 0.0        | 🔥 | Away strong |",
          "| 49.5%     | 21.5%    | 102.0        | 108.0         | 58.5%     | 28.5%    | 119.0        | 114.0         | -0.081     | -10.0%   | -0.85  | 0.0        | +4.25      | 🔥 | Home strong |",
          "| 54.0%     | 24.0%    | 110.0        | 110.0         | 54.0%     | 24.0%    | 110.0        | 110.0         | 0.0        | 0.0%     | 0.0    | 0.0        | 0.0        | ⚖️ | Dead even |",
          "| 56.5%     | 26.5%    | 113.0        | 110.0         | 53.5%     | 23.5%    | 107.0        | 110.0         | +0.029     | +0.0%    | +0.29  | +1.45      | 0.0        | ⚖️ | Slight away |",
          "| 52.5%     | 23.5%    | 107.0        | 110.0         | 56.5%     | 26.5%    | 113.0        | 110.0         | -0.034     | -5.5%    | -0.48  | 0.0        | +2.40      | ⚖️ | Slight home |",
          "| 59.5%     | 29.5%    | 119.0        | 113.0         | 51.5%     | 22.5%    | 106.0        | 109.0         | +0.074     | +2.4%    | +0.78  | +3.90      | 0.0        | 🔥 | Away advantage |",
          "",
          "🎯 **Shooting Efficiency Impact:**",
          "• eFG% = (FGM + 0.5 × 3PM) / FGA (accounts for 3-point value)",
          "• FTr = FTA / FGA (ability to get to the free throw line)",
          "• Composite = (eFG% × 70%) + (FTr × 30%)",
          "",
          "📈 **Momentum Detection:**",
          "• Compares last 3 games ORtg vs last 10 games ORtg",
          "• Positive momentum = team heating up (recent > average)",
          "• Negative momentum = team cooling down (recent < average)",
          "• Momentum differential amplifies or dampens efficiency edge",
          "",
          "🔥 **Why It Works:**",
          "• Shooting efficiency = scoring quality (not just quantity)",
          "• Momentum = recent form matters more than season averages",
          "• Teams heating up with good shooting beat spreads consistently",
          "",
          "*Metric: Shooting efficiency (eFG% + FTr) + momentum (L3 vs L10 ORtg)*",
          "*Formula: Efficiency 60% + Momentum 40%, tanh scaling for saturation*"
        ]
      },
      reboundingDiff: {
        metric: "Rebounding differential - board control advantage through OREB and DREB",
        formula: "weightedDiff = (awayOREBadv × 1.1) + (totalRebDiff × 0.3), signal = tanh(weightedDiff / 6)",
        examples: [
          "| Away OREB | Away DREB | Home OREB | Home DREB | Signal | Away Score | Home Score |",
          "|-----------|-----------|-----------|-----------|--------|------------|------------|",
          "| 12        | 35        | 8         | 32        | +0.72  | +3.60      | 0.0        |",
          "| 7         | 30        | 14        | 38        | -0.91  | 0.0        | +4.55      |",
          "",
          "🏀 **Rebounding Theory:**",
          "• Offensive rebounds = second chance points (worth more)",
          "• Defensive rebounds = ending opponent possessions",
          "• Board control directly impacts scoring margin",
          "",
          "📊 **Calculation:**",
          "• OREB advantage weighted 1.1x (more valuable)",
          "• Total reb diff weighted 0.3x (supporting signal)",
          "",
          "*Metric: Offensive and defensive rebounds per game*",
          "*Formula: weightedDiff = (OREBadv × 1.1) + (totalRebDiff × 0.3)*"
        ]
      },
      defensivePressure: {
        metric: "Defensive disruption through steals and blocks",
        formula: "disruption = (steals × 1.5) + (blocks × 0.8), signal = tanh(diff / 4)",
        examples: [
          "| Away STL | Away BLK | Home STL | Home BLK | Signal | Away Score | Home Score |",
          "|----------|----------|----------|----------|--------|------------|------------|",
          "| 9        | 5        | 6        | 4        | +0.82  | +4.10      | 0.0        |",
          "| 5        | 3        | 10       | 6        | -0.88  | 0.0        | +4.40      |",
          "",
          "🛡️ **Defensive Pressure Theory:**",
          "• Steals lead to fast break points (weighted 1.5x)",
          "• Blocks end possessions but ball may stay with offense (weighted 0.8x)",
          "",
          "*Metric: Steals and blocks per game*",
          "*Formula: disruption = (STL × 1.5) + (BLK × 0.8)*"
        ]
      },
      assistEfficiency: {
        metric: "Ball movement quality measured by AST/TOV ratio",
        formula: "astTovRatio = assists / turnovers, signal = tanh(diff / 0.5)",
        examples: [
          "| Away AST | Away TOV | Home AST | Home TOV | Signal | Away Score | Home Score |",
          "|----------|----------|----------|----------|--------|------------|------------|",
          "| 28       | 12       | 22       | 15       | +0.93  | +4.65      | 0.0        |",
          "| 20       | 16       | 26       | 11       | -0.87  | 0.0        | +4.35      |",
          "",
          "🎯 **Assist Efficiency Theory:**",
          "• High AST/TOV = smart decisions = better shot quality",
          "• ISO-heavy teams (low AST) struggle under pressure",
          "",
          "*Metric: Assists and turnovers per game*",
          "*Formula: AST/TOV ratio comparison*"
        ]
      },
      restAdvantage: {
        metric: "Rest differential between teams - back-to-backs cause fatigue and lower scoring",
        formula: "restDiff = awayRestDays - homeRestDays, fatigueScore = (awayB2B ? -2 : 0) + (homeB2B ? -2 : 0), signal = tanh((restDiff + fatigueScore) / 3)",
        examples: [
          "| Away Rest | Home Rest | Away B2B | Home B2B | Signal | Over Score | Under Score |",
          "|-----------|-----------|----------|----------|--------|------------|-------------|",
          "| 0 (B2B)   | 0 (B2B)   | Yes      | Yes      | -0.80  | 0.0        | +4.0        |",
          "| 3         | 0 (B2B)   | No       | Yes      | -0.40  | 0.0        | +2.0        |",
          "| 2         | 2         | No       | No       | 0.0    | 0.0        | 0.0         |",
          "| 0 (B2B)   | 3         | Yes      | No       | -0.60  | 0.0        | +3.0        |",
          "",
          "😴 **Rest Advantage Theory:**",
          "• Back-to-back games cause significant fatigue",
          "• Fatigued teams score less efficiently",
          "• Both teams fatigued = strong Under signal"
        ]
      },
      momentumIndex: {
        metric: "Team momentum based on win streak and last 10 record",
        formula: "momentum = (streak × 0.6) + (last10WinPct × 0.4), momentumDiff = awayMomentum - homeMomentum, signal = tanh(momentumDiff / 5)",
        examples: [
          "| Away Streak | Away L10 | Home Streak | Home L10 | Signal | Away Score | Home Score |",
          "|-------------|----------|-------------|----------|--------|------------|------------|",
          "| +5 (W)      | 8-2      | -3 (L)      | 3-7      | +0.76  | +3.80      | 0.0        |",
          "| +2 (W)      | 6-4      | +1 (W)      | 5-5      | +0.20  | +1.00      | 0.0        |",
          "| +1 (W)      | 5-5      | +1 (W)      | 5-5      | 0.0    | 0.0        | 0.0        |",
          "| -2 (L)      | 4-6      | +4 (W)      | 7-3      | -0.60  | 0.0        | +3.00      |",
          "",
          "📈 **Momentum Theory:**",
          "• Hot teams tend to cover spreads",
          "• Cold teams tend to fail to cover",
          "• Streak weighted 60%, Last 10 weighted 40%"
        ]
      }
    }
    const result = logicMap[key] || { metric: "Unknown", formula: "Unknown", examples: [] }
    console.log(`[getFactorLogic] Result for ${key}:`, result)
    return result
  }

  // Normalize factor weights to ensure they sum to 100%
  const normalizeFactorWeights = (factors: FactorConfig[]): FactorConfig[] => {
    // Edge vs Market doesn't count toward weight budget
    const weightFactors = factors.filter(f => !isEdgeFactor(f.key))
    const enabledFactors = weightFactors.filter(f => f.enabled)
    const disabledFactors = weightFactors.filter(f => !f.enabled)

    if (enabledFactors.length === 0) {
      // If no factors enabled, enable all with equal weights (excluding Edge vs Market)
      return factors.map(f => {
        if (isEdgeFactor(f.key)) {
          return { ...f, enabled: true, weight: 100 } // Edge vs Market factors are always 100%
        }
        return { ...f, enabled: true, weight: 100 / weightFactors.length }
      })
    }

    // Calculate total weight of enabled factors (excluding Edge vs Market)
    const totalWeight = enabledFactors.reduce((sum, f) => sum + f.weight, 0)

    if (totalWeight === 0) {
      // If all enabled factors have 0 weight, distribute equally
      const equalWeight = 250 / enabledFactors.length
      return factors.map(f => {
        if (isEdgeFactor(f.key)) {
          return { ...f, enabled: true, weight: 100 } // Edge vs Market factors are always 100%
        }
        return f.enabled ? { ...f, weight: equalWeight } : { ...f, weight: 0 }
      })
    }

    // Normalize enabled factors to sum to 250% (excluding Edge vs Market)
    const normalizedFactors = factors.map(f => {
      if (isEdgeFactor(f.key)) {
        return { ...f, enabled: true, weight: 100 } // Edge vs Market factors are always 100%
      }
      if (f.enabled) {
        const normalizedWeight = (f.weight / totalWeight) * 250
        // Round to 2 decimal places to avoid floating point precision issues
        const roundedWeight = Math.round(normalizedWeight * 100) / 100
        return { ...f, weight: roundedWeight }
      } else {
        return { ...f, weight: 0 }
      }
    })

    // Final adjustment to ensure exact 250% total
    const finalFactors = [...normalizedFactors]
    const finalTotal = finalFactors
      .filter(f => f.enabled && !isEdgeFactor(f.key))
      .reduce((sum, f) => sum + f.weight, 0)

    if (Math.abs(finalTotal - 250) > 0.01) {
      // Adjust the first enabled factor to make it exactly 250%
      const firstEnabled = finalFactors.find(f => f.enabled && !isEdgeFactor(f.key))
      if (firstEnabled) {
        const adjustment = 250 - finalTotal
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
        console.log('[FactorConfigModal] Loading config for:', { capperId, sport, betType })

        const response = await fetch(
          `/api/factors/config?capperId=${capperId}&sport=${sport}&betType=${betType}`
        )

        console.log('[FactorConfigModal] API response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[FactorConfigModal] API error:', { status: response.status, error: errorText })
          throw new Error(`Failed to load factor configuration: ${response.status}`)
        }

        const data = await response.json()
        console.log('[FactorConfigModal] API response data:', data)

        setProfile(data.profile)

        // Use the full registry to get all available factors
        const registry = data.registry || {}
        console.log('[FactorConfigModal] Registry keys:', Object.keys(registry))

        const loadedFactors = data.profile.factors || []
        console.log('[FactorConfigModal] Loaded factors:', loadedFactors)
        console.log('[FactorConfigModal] Loaded factor keys:', loadedFactors.map((f: any) => f.key))

        // Convert registry to FactorConfig array, merging with saved factors
        const allFactors: FactorConfig[] = Object.entries(registry).map(([key, meta]: [string, any]) => {
          // Find saved factor config for this key
          const savedFactor = loadedFactors.find((f: any) => f.key === key)

          const isEdge = isEdgeFactor(key)
          console.log(`[FactorConfigModal] Processing factor ${key}:`, {
            hasSavedFactor: !!savedFactor,
            savedEnabled: savedFactor?.enabled,
            savedWeight: savedFactor?.weight,
            willUseEnabled: savedFactor?.enabled ?? isEdge,
            willUseWeight: isEdge ? 100 : (savedFactor?.weight ?? meta.defaultWeight)
          })

          return {
            key,
            name: meta.name,
            description: meta.description,
            enabled: savedFactor?.enabled ?? isEdge, // Edge vs Market factors enabled by default
            weight: isEdge ? 100 : (savedFactor?.weight ?? meta.defaultWeight), // Edge vs Market factors always 100%
            dataSource: meta.defaultDataSource ?? 'mysportsfeeds', // Always use registry's data source (hardcoded, not user-configurable)
            maxPoints: meta.maxPoints,
            sport: Array.isArray(meta.appliesTo.sports) ? meta.appliesTo.sports[0] : 'NBA',
            betType: Array.isArray(meta.appliesTo.betTypes) ? meta.appliesTo.betTypes[0] : 'TOTAL',
            scope: meta.appliesTo.scope,
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

        // Debug the getFactorLogic function
        factorsToSet.forEach(factor => {
          const logic = getFactorLogic(factor.key)
          console.log(`[FactorConfigModal] Factor ${factor.key} logic:`, logic)
          console.log(`[FactorConfigModal] Factor ${factor.key} examples:`, logic.examples)
          console.log(`[FactorConfigModal] Factor ${factor.key} metric:`, logic.metric)
          console.log(`[FactorConfigModal] Factor ${factor.key} formula:`, logic.formula)
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
            dataSource: 'system',
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
            dataSource: 'mysportsfeeds',
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
            dataSource: 'mysportsfeeds',
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
            dataSource: 'mysportsfeeds',
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
            dataSource: 'mysportsfeeds',
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
            dataSource: 'mysportsfeeds',
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
      // Don't allow Edge vs Market factors to be adjusted
      if (isEdgeFactor(key)) return prev

      // Calculate total weight of OTHER enabled factors (excluding Edge vs Market)
      const otherEnabledWeight = prev
        .filter(f => f.enabled && f.key !== key && !isEdgeFactor(f.key))
        .reduce((sum, f) => sum + f.weight, 0)

      // Calculate max weight this factor can have (can't exceed remaining budget)
      const maxAllowed = Math.max(0, 250 - otherEnabledWeight)

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
      alert('Weights must sum to exactly 250% before saving')
      return
    }

    setSaving(true)
    try {
      const payload = {
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
      }

      console.log('[FactorConfigModal] Saving config with payload:', {
        capperId: payload.capperId,
        sport: payload.sport,
        betType: payload.betType,
        factorsCount: payload.factors.length,
        factors: payload.factors.map(f => ({ key: f.key, enabled: f.enabled, weight: f.weight }))
      })

      const response = await fetch('/api/factors/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const responseData = await response.json()
        console.log('[FactorConfigModal] Save response:', responseData)
        console.log('[FactorConfigModal] Saved profile factors count:', responseData.profile?.factors?.length)
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
        const errorData = await response.json()
        console.error('[FactorConfigModal] Save error:', errorData)
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
                  const enabledFactors = factors.filter(f => f.enabled && !isEdgeFactor(f.key))
                  const equalWeight = 250 / enabledFactors.length

                  setFactors(prev => prev.map(f => {
                    if (isEdgeFactor(f.key)) return f
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
          <div className={`p-3 rounded border ${isWeightValid
            ? 'bg-green-500/10 border-green-500/30'
            : remainingWeight > 0
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-red-500/10 border-red-500/30'
            }`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-white">
                  Weight Budget: {displayTotalWeight}% / 250%
                </div>
                <div className={`text-xs mt-1 ${isWeightValid
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
                    className={`h-full transition-all ${isWeightValid
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
                    // Edge vs Market factors always come first
                    if (isEdgeFactor(a.key)) return -1
                    if (isEdgeFactor(b.key)) return 1
                    return 0
                  })
                  .map(factor => (
                    <div
                      key={factor.key}
                      className={`border rounded-lg p-4 transition ${factor.enabled
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-gray-700 bg-gray-800/30'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => !isEdgeFactor(factor.key) && toggleFactor(factor.key)}
                          disabled={isEdgeFactor(factor.key)}
                          className={`mt-1 w-12 h-6 rounded-full transition ${factor.enabled ? 'bg-blue-600' : 'bg-gray-600'
                            } ${isEdgeFactor(factor.key) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`w-5 h-5 bg-white rounded-full transition transform ${factor.enabled ? 'translate-x-6' : 'translate-x-0.5'
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
                                    Weight: {isEdgeFactor(factor.key) ? '100% (Fixed)' : `${factor.weight}%`}
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max={isEdgeFactor(factor.key) ? 0 : 100}
                                    value={factor.weight}
                                    onChange={e => !isEdgeFactor(factor.key) && updateWeight(factor.key, parseInt(e.target.value))}
                                    disabled={isEdgeFactor(factor.key)}
                                    className={`w-full ${isEdgeFactor(factor.key) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                  />
                                </div>

                                {/* Data Source (Read-Only) */}
                                <div>
                                  <label className="block text-xs text-gray-400 mb-2">
                                    Data Source
                                  </label>
                                  <div className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-300 text-sm">
                                    {factor.dataSource === 'mysportsfeeds' && '📊 MySportsFeeds'}
                                    {factor.dataSource === 'system' && '⚙️ System'}
                                    {factor.dataSource === 'perplexity' && '🤖 Perplexity'}
                                    {factor.dataSource === 'openai' && '🧠 OpenAI'}
                                  </div>
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
                                            <div key={i} className={`text-xs leading-relaxed ${example.startsWith('|')
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
                            {getEffectiveMaxPoints(factor).toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {isEdgeFactor(factor.key)
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
                const logic = getFactorLogic(selectedFactorDetails)
                return (
                  <div className="space-y-6">
                    {/* Metric Description */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">📊 Metric Description</h3>
                      <div className="text-sm text-gray-300 leading-relaxed">
                        {logic.metric}
                      </div>
                    </div>

                    {/* Formula */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">🧮 Formula</h3>
                      <div className="text-sm text-gray-300 leading-relaxed font-mono bg-gray-800 p-3 rounded">
                        {logic.formula}
                      </div>
                    </div>

                    {/* Logic & Examples Table */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">📈 Logic & Examples</h3>
                      <div className="space-y-2">
                        {logic.examples.map((example, i) => (
                          <div key={i} className={`text-sm leading-relaxed ${example.startsWith('|')
                            ? 'text-gray-300 font-mono'
                            : example.startsWith('*') && example.endsWith('*')
                              ? 'text-blue-300 italic'
                              : example.startsWith('🤖')
                                ? 'text-green-300 font-bold'
                                : example.startsWith('```')
                                  ? 'text-yellow-300 font-mono bg-gray-800 p-2 rounded'
                                  : example === ''
                                    ? 'h-2'
                                    : 'text-gray-400'
                            }`}>
                            {example}
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

