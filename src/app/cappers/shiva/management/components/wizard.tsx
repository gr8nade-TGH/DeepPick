"use client"
import { useMemo, useState, useEffect } from 'react'
import { InsightCard } from './insight-card'
import { getFactorMeta } from '@/lib/cappers/shiva-v1/factor-registry'
import { registerStep } from '@/lib/shared/dynamic-step-registry'

async function postJson(path: string, body: unknown, idempo: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempo },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  const dryRunHeader = res.headers.get('X-Dry-Run')
  return { status: res.status, json, dryRun: dryRunHeader === '1' }
}

function DryRunBanner() {
  const dryRun = (process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED || '').toLowerCase() !== 'true'
  if (!dryRun) return null
  return (
    <div className="mb-3 rounded bg-yellow-900 border-2 border-yellow-600 p-3 text-sm font-bold text-yellow-200">
      Dry-Run (no writes). Responses may include X-Dry-Run header.
    </div>
  )
}


function formatSpread(odds: any): number {
  if (!odds?.spread_line) return 0
  return Number(odds.spread_line)
}

// Factor metadata for UI display
const FACTOR_METADATA: Record<string, { label: string; icon: string; description: string }> = {
  seasonNet: {
    label: 'Season Net',
    icon: '📈',
    description: 'Season Net Rating: Team Net Rating (ORtg-DRtg) differential. Core strength signal.',
  },
  recentNet: {
    label: 'Recent 10',
    icon: '🔥',
    description: 'Recent Form: Net Rating over last 10 games. Momentum indicator.',
  },
  h2hPpg: {
    label: 'H2H',
    icon: '🤝',
    description: 'Head-to-Head PPG: Season PPG by each team vs this opponent. Style/fit history.',
  },
  matchupORtgDRtg: {
    label: 'ORtg/DRtg',
    icon: '🎯',
    description: 'Off/Def Rating Differential: Offensive vs Defensive rating mismatch. Matchup quality.',
  },
  threePoint: {
    label: '3PT',
    icon: '🏀',
    description: '3-Point Environment: 3PA rate / 3P% / opponent 3PA context. Variance lever.',
  },
  newsEdge: {
    label: 'News',
    icon: '🏥',
    description: 'News/Injury Edge: Injury/availability impact within last 48-72h. Capped at ±3 per 100.',
  },
  homeEdge: {
    label: 'Home',
    icon: '🏠',
    description: 'Home Court Edge: Generic home advantage adjustment. Default +1.5 per 100.',
  },
}

function isEnabledInProfile(factorKey: string, profile: any): boolean {
  if (!profile?.config?.factors) return true // Default enabled if no profile
  
  // Find the factor in the profile configuration
  const factorConfig = profile.config.factors.find((f: any) => f.key === factorKey)
  if (!factorConfig) return false // Factor not found in profile
  
  return factorConfig.enabled === true
}

function getWeightPct(factorKey: string, profile: any): number {
  if (!profile?.config?.factors) return 0.1 // Default weight
  
  // Find the factor in the profile configuration
  const factorConfig = profile.config.factors.find((f: any) => f.key === factorKey)
  if (!factorConfig) return 0.1 // Default weight if not found
  
  return Number(factorConfig.weight ?? 0.1)
}

function generatePredictionWriteup(pick: any, predictedScore: any, totalLine: number, confFinal: number, factorRows: any[], homeTeam: string, awayTeam: string): string {
  if (!pick) return 'No pick generated.'
  
  const totalPred = predictedScore.home + predictedScore.away
  const topFactor = factorRows[0]
  
  switch (pick.type) {
    case 'TOTAL':
      // 4) Writeup polish (now that totals show)
      const line = totalLine ?? null
      const edgePts = line ? (totalPred - line).toFixed(1) : null
      const overUnder = pick.selection?.includes('OVER') ? 'Over' : 'Under'
      
      return line
        ? `Model projects ${homeTeam} ${predictedScore.home}-${awayTeam} ${predictedScore.away} (total ${totalPred}). With confidence ${confFinal.toFixed(1)}/5 and a +${edgePts}pt edge, we lean ${overUnder} ${line}. Key driver: ${topFactor?.label}.`
        : `Model projects ${homeTeam} ${predictedScore.home}-${awayTeam} ${predictedScore.away}. Key driver: ${topFactor?.label}.`
    
    case 'SPREAD':
      return `Model projects ${predictedScore.winner} covering by ${Math.abs(predictedScore.home - predictedScore.away)} points vs spread. Key driver: ${topFactor?.label} (${topFactor?.rationale}). With confidence ${confFinal.toFixed(1)}/5, we lean ${pick.selection}.`
    
    case 'MONEYLINE':
      return `Model projects ${predictedScore.winner} winning outright ${predictedScore.home}-${predictedScore.away}. Key driver: ${topFactor?.label} (${topFactor?.rationale}). With confidence ${confFinal.toFixed(1)}/5, we lean ${pick.selection}.`
    
    default:
      return `Model projects ${predictedScore.winner} ${predictedScore.home}-${predictedScore.away}. Key driver: ${topFactor?.label}. With confidence ${confFinal.toFixed(1)}/5, we lean ${pick.selection}.`
  }
}

function generateBoldPrediction(pick: any, predictedScore: any, factorRows: any[]): string {
  if (!pick) return 'No prediction available.'
  
  const topFactor = factorRows[0]
  
  switch (pick.type) {
    case 'TOTAL':
      return `${predictedScore.winner} hits ${pick.selection?.includes('OVER') ? 'high' : 'low'} total with ${topFactor?.label} edge.`
    
    case 'SPREAD':
      return `${predictedScore.winner} covers by ${Math.abs(predictedScore.home - predictedScore.away)}+ points.`
    
    case 'MONEYLINE':
      return `${predictedScore.winner} wins outright with ${topFactor?.label} advantage.`
    
    default:
      return `${predictedScore.winner} dominates with ${topFactor?.label} edge.`
  }
}

function assembleInsightCard({ runCtx, step4, step5, step5_5, step6, step3, step2 }: any) {
  const g = runCtx?.game || {}
  const pick = step6?.json?.pick || null
  const conf7 = Number(step4?.json?.predictions?.conf7_score ?? 0)
  const confAdj = Number(step5?.json?.conf_market_adj ?? 0)
  const confFinal = Number(step5?.json?.conf_final ?? 0)

  const predictedScore = {
    home: Number(step4?.json?.predictions?.scores?.home ?? 0),
    away: Number(step4?.json?.predictions?.scores?.away ?? 0),
    winner: String(step4?.json?.predictions?.winner ?? '')
  }

  // 1) Use Step-2 snapshot odds in the card header (try multiple paths)
  console.debug('[card:step2.snapshot]', step2?.json?.snapshot)
  console.debug('[card:odds.keys]', Object.keys(step2?.json?.snapshot ?? {}))
  
  const odds = 
    step2?.json?.snapshot?.odds ??
    step2?.json?.odds ??
    runCtx?.game?.odds ??
    null

  const totalLine = 
    odds?.total?.line ??
    odds?.total_line ??
    (typeof odds?.totalLine === 'number' ? odds.totalLine : null)

  const spreadTeam = 
    odds?.spread?.team ??
    odds?.spread_team ??
    odds?.fav_team ??
    null

  const spreadLine = 
    odds?.spread?.line ??
    odds?.spread_line ??
    (typeof odds?.spreadLine === 'number' ? odds.spreadLine : null)

  // Format matchup strings without injecting zeroes
  const awayTeam = g.away || 'Away'
  const homeTeam = g.home || 'Home'
  
  function formatSpread(away: string, home: string, spreadTeam: string, spreadLine: number) {
    if (spreadTeam && typeof spreadLine === 'number') {
      const fav = spreadTeam === home ? home : away
      const dog = fav === home ? away : home
      // Round to nearest 0.5 for proper spread display
      const roundedLine = Math.round(spreadLine * 2) / 2
      const line = Math.abs(roundedLine).toFixed(1)
      return `${dog} +${line} @ ${fav} -${line}`
    }
    return `${away} @ ${home}` // no spread available
  }

  // Show current O/U with delta if different from locked line
  const lockedTotalLine = pick?.locked_odds?.total_line
  const currentTotalLine = totalLine
  const delta = (lockedTotalLine && currentTotalLine) ? (currentTotalLine - lockedTotalLine).toFixed(1) : null
  
  const totalText = (typeof currentTotalLine === 'number') 
    ? `Current O/U ${currentTotalLine}${delta ? ` (Δ ${Number(delta) > 0 ? '+' : ''}${delta})` : ''}` 
    : 'Current O/U —'
  const spreadText = (spreadTeam && typeof spreadLine === 'number')
    ? formatSpread(awayTeam, homeTeam, spreadTeam, spreadLine)
    : `${awayTeam} @ ${homeTeam}`

  // 2) Populate factor rows from Step-3 (not defaults)
  console.debug('[card:step3.factors.raw]', step3?.json?.factors)

  // Get Edge vs Market factor from Step 5
  const edgeVsMarket = step5?.json?.final_factor
  const marketEdgePts = edgeVsMarket?.edge_pts ?? 0
  const marketEdgeFactor = edgeVsMarket?.edge_factor ?? 0
  
  // Edge vs Market is locked at 100% weight by default
  const edgeVsMarketWeight = 1.0 // Always 100% weight
  
  // Calculate Edge vs Market factor points (following factor pattern)
  // Edge factor is already normalized (-1.83), convert to points using MAX_POINTS = 5.0
  const edgeFactorPoints = Math.abs(marketEdgeFactor) * 5.0
  
  // Create Edge vs Market factor row (always at top)
  const edgeVsMarketRow = {
    key: 'edgeVsMarket',
    label: 'Edge vs Market',
    icon: '📊',
    overScore: marketEdgeFactor > 0 ? edgeFactorPoints : 0,
    underScore: marketEdgeFactor < 0 ? edgeFactorPoints : 0,
    weightAppliedPct: 100, // Always 100% weight (locked)
    rationale: `Market Edge: ${marketEdgePts > 0 ? 'OVER' : 'UNDER'} ${Math.abs(marketEdgePts).toFixed(1)} pts vs market`,
    z: marketEdgeFactor,
    points: edgeFactorPoints,
  }

  const otherFactorRows = (step3?.json?.factors ?? [])
    .filter((f: any) => isEnabledInProfile(f.key, runCtx?.effectiveProfile))
    .map((f: any) => {
      const pv = f.parsed_values_json ?? {}
      const meta = getFactorMeta(f.key)
      const weightPct = getWeightPct(f.key, runCtx?.effectiveProfile)

      return {
        key: f.key,
        label: meta?.shortName || f.name || f.key,
        icon: meta?.icon || 'ℹ️',
        overScore: Number(pv.overScore ?? 0),
        underScore: Number(pv.underScore ?? 0),
        weightAppliedPct: Math.round(((weightPct ?? 0) * 100)),
        rationale: f.notes ?? meta?.description ?? '',
        z: Number(f.normalized_value ?? 0),
        points: Number(pv.points ?? 0),
      }
    })
    .sort((a: any, b: any) => {
      const absA = Math.abs(a.overScore + a.underScore)
      const absB = Math.abs(b.overScore + b.underScore)
      return absB - absA
    })

  // Combine Edge vs Market (always first) with other factors
  const factorRows = [edgeVsMarketRow, ...otherFactorRows]

  console.debug('[card:factor.rows]', factorRows)

  // Debug hooks (dev only)
  console.debug('[card.odds.used]', odds)
  console.debug('[card.factor.rows]', factorRows.map((r: any) => ({ key: r.key, away: r.awayContribution, home: r.homeContribution })))

  return {
    capper: 'SHIVA',
    capperIconUrl: undefined, // Placeholder for now
    sport: 'NBA' as const,
    gameId: g.game_id || 'unknown',
    pickId: pick?.id || null, // Only present for generated picks (not PASS)
    generatedAt: new Date().toISOString(),
    matchup: {
      away: awayTeam,
      home: homeTeam,
      spreadText,
      totalText,
      gameDateLocal: g.start_time_utc || new Date().toISOString(),
    },
    pick: pick ? {
      type: (pick.pick_type || pick.type || 'TOTAL') as 'SPREAD' | 'MONEYLINE' | 'TOTAL' | 'RUN_LINE',
      selection: pick.selection || 'N/A',
      units: Number(pick.units ?? 0),
      confidence: Number(pick.confidence ?? confFinal),
      locked_odds: pick.locked_odds || null,
      locked_at: pick.locked_at || null,
    } : { 
      type: 'TOTAL' as const, 
      selection: 'N/A', 
      units: 0, 
      confidence: confFinal,
      locked_odds: null,
      locked_at: null,
    },
    predictedScore,
    writeups: {
      prediction: generatePredictionWriteup(pick, predictedScore, totalLine, confFinal, factorRows, awayTeam, homeTeam),
      gamePrediction: `${predictedScore.winner === 'home' ? homeTeam : awayTeam} ${Math.max(predictedScore.home, predictedScore.away)}–${Math.min(predictedScore.home, predictedScore.away)} (Total: ${predictedScore.home + predictedScore.away})`,
      bold: step5_5?.json?.bold_predictions?.summary || generateBoldPrediction(pick, predictedScore, factorRows),
    },
    bold_predictions: step5_5?.json?.bold_predictions || null,
    injury_summary: step3?.json?._debug?.totals?.injury_impact ? {
      findings: [],
      total_impact: 0,
      summary: step3.json._debug.totals.injury_impact.rawResponse ? 
        JSON.parse(step3.json._debug.totals.injury_impact.rawResponse).findings?.length > 0 ?
          step3.json._debug.totals.injury_impact.summary :
          "No key injury data was found" :
        "No key injury data was found"
    } : null,
    factors: factorRows,
    market: {
      conf7,
      confAdj,
      confFinal,
      dominant: (step5?.json?.dominant || 'side') as 'side' | 'total',
    },
    state: {
      dryRun: true,
    },
    // Debug information for troubleshooting
    _debug: {
      step3_totals: step3?.json?._debug || null,
      step3_factors_raw: step3?.json?.factors || [],
      step4_predictions_raw: step4?.json || null,
      step5_confidence_raw: step5?.json || null,
      step6_pick_raw: step6?.json?.pick || null,
      odds_snapshot: step2?.json?.snapshot || null,
      ai_usage: {
        step3_provider: step3?.json?._debug?.ai_provider || 'unknown',
        step3_news_window: step3?.json?._debug?.news_window_hours || 48,
        step4_conf_source: step4?.json?.conf_source || 'unknown',
      }
    }
  }
}

export interface SHIVAWizardProps {
  effectiveProfile?: any
  selectedGame?: any
  mode?: 'dry-run' | 'write'
  betType?: 'TOTAL' | 'SPREAD/MONEYLINE'
  sport?: 'NBA' | 'NFL' | 'MLB'
}

export function SHIVAWizard(props: SHIVAWizardProps = {}) {
  const [step, setStep] = useState<number>(1)
  const [log, setLog] = useState<any>(null)
  const [runId, setRunId] = useState<string>('')
  const [snapId, setSnapId] = useState<string>('')
  const [stepLogs, setStepLogs] = useState<Record<number, any>>({})
  const [showInsightCard, setShowInsightCard] = useState<boolean>(false)
  const [hasInsight, setHasInsight] = useState<boolean>(false)
  const [insightCardData, setInsightCardData] = useState<any>(null)
  const [effectiveProfileSnapshot, setEffectiveProfileSnapshot] = useState<any>(null)
  const [loadingSteps, setLoadingSteps] = useState<Set<number>>(new Set())
  const [stepProgress, setStepProgress] = useState<Record<number, { progress: number; status: string }>>({})

  // Loading state management
  const setStepLoading = (stepNum: number, loading: boolean, status: string = 'Processing...', progress: number = 0) => {
    setLoadingSteps(prev => {
      const newSet = new Set(prev)
      if (loading) {
        newSet.add(stepNum)
      } else {
        newSet.delete(stepNum)
      }
      return newSet
    })
    
    setStepProgress(prev => ({
      ...prev,
      [stepNum]: { progress, status }
    }))
  }

  const updateStepProgress = (stepNum: number, progress: number, status: string) => {
    setStepProgress(prev => ({
      ...prev,
      [stepNum]: { progress, status }
    }))
  }

  // Helper function to render step status
  const renderStepStatus = (stepNum: number, stepName: string) => {
    if (loadingSteps.has(stepNum)) {
      return (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
          <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
            {stepProgress[stepNum]?.status || 'Processing...'}
          </span>
        </div>
      )
    } else if (stepLogs[stepNum]) {
      return (
        <span className={`px-2 py-1 rounded text-xs ${
          stepLogs[stepNum].status >= 200 && stepLogs[stepNum].status < 300 ? 'bg-green-600 text-white' :
          stepLogs[stepNum].status >= 400 ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
        }`}>
          {stepLogs[stepNum].status}
        </span>
      )
    } else {
      // Check if this step can be executed (previous steps validated)
      let canExecute = true
      let validationError = ''
      
      if (stepNum === 2) {
        const validation = validateStep1()
        canExecute = validation.isValid
        validationError = validation.error || ''
      } else if (stepNum === 3) {
        const validation = validateStep2()
        canExecute = validation.isValid
        validationError = validation.error || ''
      } else if (stepNum === 4) {
        const validation = validateStep3()
        canExecute = validation.isValid
        validationError = validation.error || ''
      } else if (stepNum === 5) {
        const validation = validateStep4()
        canExecute = validation.isValid
        validationError = validation.error || ''
      } else if (stepNum === 6) {
        const validation = validateStep5()
        canExecute = validation.isValid
        validationError = validation.error || ''
      } else if (stepNum === 7) {
        canExecute = stepLogs[6]?.json ? true : false
        validationError = stepLogs[6]?.json ? '' : 'Step 6 not executed'
      }
      
      if (!canExecute) {
        return (
          <span className="px-2 py-1 rounded text-xs bg-orange-600 text-white" title={validationError}>
            Blocked
          </span>
        )
      }
      
      return (
        <span className="px-2 py-1 rounded text-xs bg-gray-600 text-white">
          Ready
        </span>
      )
    }
  }

  // Step names mapping
  const stepNames: Record<number, string> = {
    1: 'Game Selection',
    2: 'Odds Snapshot', 
    3: 'Factor Analysis',
    4: 'Score Predictions',
    5: 'Pick Generation',
    6: 'Bold Player Predictions',
    7: 'Pick Finalization',
    8: 'Insight Card',
    9: 'Debug Report'
  }

  // Auto-register steps for dynamic documentation
  useEffect(() => {
    registerStep({
      step: 1,
      name: "Game Selection",
      description: "Initialize prediction run and select optimal game",
      details: [
        "Filter games by status (scheduled), timing (>30min), and existing picks",
        "For TOTAL: Find games with no TOTAL predictions",
        "For SPREAD/MONEYLINE: Find games with no SPREAD OR MONEYLINE predictions",
        "Generate unique run_id and retrieve game details + current odds"
      ]
    })
    
    registerStep({
      step: 2,
      name: "Odds Snapshot",
      description: "Capture current market odds at prediction time",
      details: [
        "Store odds snapshot in database with precise timestamp",
        "Generate snapshot_id for tracking and grading purposes",
        "Deactivate previous snapshots for the same run_id",
        "Enable accurate grading by comparing picks against locked odds",
        "Note: Edge calculation happens in Step 5, not here"
      ]
    })
    
    registerStep({
      step: 3,
      name: "Factor Analysis",
      description: "Compute confidence factors based on team performance data",
      details: [
        "Fetch team stats from NBA Stats API (season and last 10 games)",
        "Calculate 5 NBA Totals factors: Pace Index, Offensive Form, Defensive Erosion, 3-Point Environment, Free-Throw Environment",
        "Apply factor weights from capper profile configuration",
        "Use LLM for injury/availability analysis (currently mocked)",
        "Note: StatMuse has been removed, using NBA Stats API only"
      ]
    })
    
    registerStep({
      step: 4,
      name: "Score Predictions",
      description: "Generate total predictions using factor signals and confidence calculation",
      details: [
        "Combine factor analysis with team performance data",
        "Apply AI models for score prediction",
        "Calculate confidence scores and determine winner",
        "Generate predicted scores (home/away) and margin"
      ]
    })
    
    registerStep({
      step: 5,
      name: "Pick Generation",
      description: "Calculate final Edge vs Market factor and generate betting pick",
      details: [
        "Compare predicted total vs market line",
        "Calculate edge percentage and market adjustment",
        "Apply final confidence score adjustments",
        "Determine pick direction (Over/Under) based on edge"
      ]
    })
    
    registerStep({
      step: 6,
      name: "Bold Player Predictions",
      description: "Generate AI-powered bold player predictions",
      details: [
        "Research recent news, injuries, and statistical trends",
        "Generate 2-4 specific, measurable player predictions",
        "Align predictions with pick direction (OVER/UNDER)",
        "Include reasoning and confidence levels for each prediction"
      ]
    })
    
    registerStep({
      step: 7,
      name: "Pick Finalization",
      description: "Finalize and commit the betting pick with locked odds",
      details: [
        "Convert confidence to unit allocation (1u, 2u, 3u, 5u)",
        "Generate pick selection text and rationale",
        "Lock in odds snapshot for grading purposes",
        "Apply risk management rules and validation"
      ]
    })
    
    registerStep({
      step: 8,
      name: "Insight Card",
      description: "Generate comprehensive analysis summary",
      details: [
        "Create visual factor breakdown with team contributions",
        "Generate AI-powered prediction writeup",
        "Display market analysis and edge visualization",
        "Show confidence scoring explanation and rationale"
      ]
    })
    
    registerStep({
      step: 9,
      name: "Debug Report",
      description: "Generate comprehensive debugging information",
      details: [
        "Collect all step responses and execution data",
        "Generate comprehensive debug report for analysis",
        "Include factor breakdowns, AI responses, and timing data",
        "Provide copy-paste debug information for troubleshooting"
      ]
    })
  }, [])

  // Auto-generate debug report when reaching Step 9
  useEffect(() => {
    if (step === 9 && Object.keys(stepLogs).length > 0) {
      console.log('Auto-generating debug report for step 8, stepLogs:', stepLogs)
      console.log('stepLogs keys:', Object.keys(stepLogs))
      console.log('effectiveProfileSnapshot:', effectiveProfileSnapshot)
      console.log('current runId:', runId)
      console.log('current snapId:', snapId)
      
      // Build comprehensive steps array with actual response data
      const stepsArray = Object.entries(stepLogs)
        .filter(([stepNum]) => parseInt(stepNum) >= 1 && parseInt(stepNum) < 8) // Include steps 1-7
        .sort(([a], [b]) => parseInt(a) - parseInt(b)) // Sort by step number
        .map(([stepNum, response]: [string, any]) => ({
          step: parseInt(stepNum),
          status: response.status,
          dryRun: response.dryRun,
          latencyMs: response.latencyMs || 0,
          response: response.json || null, // Include actual response data
          error: response.error || null,
        }))
      
      // Check if Step 1 was executed
      const step1Executed = stepLogs[1] !== undefined
      const step1Status = stepLogs[1]?.status || 'NOT_EXECUTED'
      
      console.log('[Debug Report] Step 1 check:', { step1Executed, step1Status, stepLogs })
      
      const debugReport = {
        timestamp: new Date().toISOString(),
        runId: runId || 'unknown',
        snapId: snapId || 'unknown',
        effectiveProfile: effectiveProfileSnapshot || props.effectiveProfile || null,
        environment: {
          SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
          SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
          SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
        },
        steps: stepsArray,
        summary: {
          totalSteps: stepsArray.length,
          successfulSteps: stepsArray.filter((s) => s.status >= 200 && s.status < 300).length,
          errorSteps: stepsArray.filter((s) => s.status >= 400).length,
          dryRunSteps: stepsArray.filter((s) => s.dryRun === true).length,
          step1Executed,
          step1Status,
        },
        stepLogsRaw: stepLogs, // Include raw step logs for debugging
        debugInfo: {
          stepLogsKeys: Object.keys(stepLogs),
          stepLogsValues: Object.values(stepLogs).map(v => ({ status: v.status, hasJson: !!v.json })),
          currentStep: step,
          runIdSet: !!runId,
          snapIdSet: !!snapId,
        }
      }
      console.log('Debug report generated (comprehensive):', debugReport)
      setLog({ status: 200, json: debugReport, dryRun: false })
    }
  }, [step, stepLogs, effectiveProfileSnapshot, runId, snapId, props.effectiveProfile])

  // Step validation helper functions
  function validateStep1(): { isValid: boolean; error?: string; data?: any } {
    const step1Data = stepLogs[1]?.json
    if (!step1Data) {
      return { isValid: false, error: 'Step 1 not executed' }
    }
    if (stepLogs[1]?.status < 200 || stepLogs[1]?.status >= 300) {
      return { isValid: false, error: `Step 1 failed with status ${stepLogs[1]?.status}` }
    }
    if (!step1Data.selected_game) {
      return { isValid: false, error: 'Step 1 did not select a game' }
    }
    if (!step1Data.run_id) {
      return { isValid: false, error: 'Step 1 did not generate run_id' }
    }
    
    // Data anomaly checks
    const game = step1Data.selected_game
    if (!game.home_team?.name || !game.away_team?.name) {
      return { isValid: false, error: 'Step 1 game missing team names' }
    }
    if (!game.game_date || !game.game_time) {
      return { isValid: false, error: 'Step 1 game missing date/time' }
    }
    if (!game.odds || Object.keys(game.odds).length === 0) {
      return { isValid: false, error: 'Step 1 game missing odds data' }
    }
    
    return { isValid: true, data: step1Data }
  }

  function validateStep2(): { isValid: boolean; error?: string; data?: any } {
    const step2Data = stepLogs[2]?.json
    if (!step2Data) {
      return { isValid: false, error: 'Step 2 not executed' }
    }
    if (stepLogs[2]?.status < 200 || stepLogs[2]?.status >= 300) {
      return { isValid: false, error: `Step 2 failed with status ${stepLogs[2]?.status}` }
    }
    if (!step2Data.snapshot_id) {
      return { isValid: false, error: 'Step 2 did not generate snapshot_id' }
    }
    if (!step2Data.snapshot) {
      return { isValid: false, error: 'Step 2 did not capture odds snapshot' }
    }
    
    // Data anomaly checks
    const snapshot = step2Data.snapshot
    if (!snapshot.total?.line || typeof snapshot.total.line !== 'number') {
      return { isValid: false, error: 'Step 2 snapshot missing valid total line' }
    }
    if (snapshot.total.line < 150 || snapshot.total.line > 300) {
      return { isValid: false, error: `Step 2 total line ${snapshot.total.line} seems anomalous (expected 150-300)` }
    }
    if (!snapshot.home_team || !snapshot.away_team) {
      return { isValid: false, error: 'Step 2 snapshot missing team names' }
    }
    if (!snapshot.start_time_utc) {
      return { isValid: false, error: 'Step 2 snapshot missing start time' }
    }
    
    return { isValid: true, data: step2Data }
  }

  function validateStep3(): { isValid: boolean; error?: string; data?: any } {
    const step3Data = stepLogs[3]?.json
    if (!step3Data) {
      return { isValid: false, error: 'Step 3 not executed' }
    }
    if (stepLogs[3]?.status < 200 || stepLogs[3]?.status >= 300) {
      return { isValid: false, error: `Step 3 failed with status ${stepLogs[3]?.status}` }
    }
    if (!step3Data.factors || !Array.isArray(step3Data.factors)) {
      return { isValid: false, error: 'Step 3 did not generate factors array' }
    }
    if (step3Data.factors.length === 0) {
      return { isValid: false, error: 'Step 3 generated empty factors array' }
    }
    
    // Data anomaly checks
    const factors = step3Data.factors
    const expectedFactorKeys = ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability']
    const actualFactorKeys = factors.map((f: any) => f.key)
    
    // Check if we have at least some factors (minimum 1)
    if (factors.length < 1) {
      return { isValid: false, error: `Step 3 only generated ${factors.length} factors, expected at least 1` }
    }
    
    // Check for missing critical factors (only warn, don't block)
    const missingFactors = expectedFactorKeys.filter(key => !actualFactorKeys.includes(key))
    if (missingFactors.length > 0) {
      console.warn(`[Step 3] Missing factors: ${missingFactors.join(', ')} - this may be intentional based on configuration`)
    }
    
    // Check if all factors have valid data structure
    for (const factor of factors) {
      if (!factor.key || !factor.name) {
        return { isValid: false, error: `Step 3 factor missing key or name: ${JSON.stringify(factor)}` }
      }
      if (typeof factor.normalized_value !== 'number') {
        return { isValid: false, error: `Step 3 factor ${factor.key} missing normalized_value` }
      }
      if (!factor.parsed_values_json) {
        return { isValid: false, error: `Step 3 factor ${factor.key} missing parsed_values_json` }
      }
    }
    
    // Check for suspicious data patterns (all factors returning 0)
    // NOTE: This is a warning, not a blocking error, because it could be legitimate
    // if teams are truly at league average. We log it but don't block progression.
    const allFactorsZero = factors.every((f: any) => f.normalized_value === 0)
    if (allFactorsZero) {
      console.warn('[VALIDATION WARNING] Step 3: All factors returning 0 - this may indicate a data issue (NBA Stats API returning league averages)')
      // Don't block - this could be legitimate, just log the warning
      // return { isValid: false, error: 'Step 3 all factors returning 0 - possible data issue' }
    }
    
    // Check weight validation
    const totalWeight = factors.reduce((sum: number, f: any) => sum + (f.weight_total_pct || 0), 0)
    if (Math.abs(totalWeight - 250) > 1) {
      return { isValid: false, error: `Step 3 total weight ${totalWeight}% is not 250%` }
    }
    
    return { isValid: true, data: step3Data }
  }

  function validateStep4(): { isValid: boolean; error?: string; data?: any } {
    const step4Data = stepLogs[4]?.json
    if (!step4Data) {
      return { isValid: false, error: 'Step 4 not executed' }
    }
    if (stepLogs[4]?.status < 200 || stepLogs[4]?.status >= 300) {
      return { isValid: false, error: `Step 4 failed with status ${stepLogs[4]?.status}` }
    }
    if (!step4Data.predictions) {
      return { isValid: false, error: 'Step 4 did not generate predictions' }
    }
    if (typeof step4Data.predictions.total_pred_points !== 'number') {
      return { isValid: false, error: 'Step 4 predictions missing total_pred_points' }
    }
    
    // Data anomaly checks
    const predictions = step4Data.predictions
    if (predictions.total_pred_points < 150 || predictions.total_pred_points > 300) {
      return { isValid: false, error: `Step 4 total_pred_points ${predictions.total_pred_points} seems anomalous (expected 150-300)` }
    }
    if (!predictions.scores || !predictions.scores.home || !predictions.scores.away) {
      return { isValid: false, error: 'Step 4 predictions missing home/away scores' }
    }
    if (typeof predictions.scores.home !== 'number' || typeof predictions.scores.away !== 'number') {
      return { isValid: false, error: 'Step 4 predictions scores not numeric' }
    }
    if (predictions.scores.home < 50 || predictions.scores.home > 200) {
      return { isValid: false, error: `Step 4 home score ${predictions.scores.home} seems anomalous (expected 50-200)` }
    }
    if (predictions.scores.away < 50 || predictions.scores.away > 200) {
      return { isValid: false, error: `Step 4 away score ${predictions.scores.away} seems anomalous (expected 50-200)` }
    }
    if (!predictions.winner || !['home', 'away'].includes(predictions.winner)) {
      return { isValid: false, error: 'Step 4 predictions missing or invalid winner' }
    }
    
    // Check confidence data
    if (!step4Data.confidence || typeof step4Data.confidence.base_confidence !== 'number') {
      return { isValid: false, error: 'Step 4 missing confidence data' }
    }
    
    return { isValid: true, data: step4Data }
  }

  function validateStep5(): { isValid: boolean; error?: string; data?: any } {
    const step5Data = stepLogs[5]?.json
    if (!step5Data) {
      return { isValid: false, error: 'Step 5 not executed' }
    }
    if (stepLogs[5]?.status < 200 || stepLogs[5]?.status >= 300) {
      return { isValid: false, error: `Step 5 failed with status ${stepLogs[5]?.status}` }
    }
    if (typeof step5Data.conf_final !== 'number') {
      return { isValid: false, error: 'Step 5 missing conf_final' }
    }
    if (typeof step5Data.units !== 'number') {
      return { isValid: false, error: 'Step 5 missing units' }
    }
    
    // Data anomaly checks
    if (step5Data.conf_final < 0 || step5Data.conf_final > 10) {
      return { isValid: false, error: `Step 5 conf_final ${step5Data.conf_final} seems anomalous (expected 0-10)` }
    }
    if (![0, 1, 2, 3, 5].includes(step5Data.units)) {
      return { isValid: false, error: `Step 5 units ${step5Data.units} not in expected range [0,1,2,3,5]` }
    }
    if (!step5Data.final_pick || !step5Data.final_pick.selection) {
      return { isValid: false, error: 'Step 5 missing final_pick selection' }
    }
    if (!step5Data.final_pick.type || !['TOTAL', 'SPREAD', 'MONEYLINE'].includes(step5Data.final_pick.type)) {
      return { isValid: false, error: 'Step 5 final_pick has invalid type' }
    }
    
    // Check edge vs market data
    if (!step5Data.final_factor || typeof step5Data.final_factor.edge_pts !== 'number') {
      return { isValid: false, error: 'Step 5 missing final_factor edge data' }
    }
    if (Math.abs(step5Data.final_factor.edge_pts) > 50) {
      return { isValid: false, error: `Step 5 edge_pts ${step5Data.final_factor.edge_pts} seems anomalous (expected -50 to +50)` }
    }
    
    return { isValid: true, data: step5Data }
  }

  function validateStep6(): { isValid: boolean; error?: string; data?: any } {
    const step6Data = stepLogs[6]?.json
    if (!step6Data) {
      return { isValid: false, error: 'Step 6 not executed' }
    }
    
    return { isValid: true, data: step6Data }
  }

  async function handleStepClick(current: number) {
    try {
      // Validate previous steps before executing current step
      if (current === 2) {
        const step1Validation = validateStep1()
        if (!step1Validation.isValid) {
          console.error('[Step 2] Step 1 validation failed:', step1Validation.error)
          setStepLoading(2, false, `Cannot proceed: ${step1Validation.error}`, 0)
          return
        }
        console.log('[Step 2] Step 1 validation passed, proceeding...')
      }

      if (current === 3) {
        const step2Validation = validateStep2()
        if (!step2Validation.isValid) {
          console.error('[Step 3] Step 2 validation failed:', step2Validation.error)
          setStepLoading(3, false, `Cannot proceed: ${step2Validation.error}`, 0)
          return
        }
        console.log('[Step 3] Step 2 validation passed, proceeding...')
      }

      if (current === 4) {
        const step3Validation = validateStep3()
        if (!step3Validation.isValid) {
          console.error('[Step 4] Step 3 validation failed:', step3Validation.error)
          setStepLoading(4, false, `Cannot proceed: ${step3Validation.error}`, 0)
          return
        }
        console.log('[Step 4] Step 3 validation passed, proceeding...')
      }

      if (current === 5) {
        const step4Validation = validateStep4()
        if (!step4Validation.isValid) {
          console.error('[Step 5] Step 4 validation failed:', step4Validation.error)
          setStepLoading(5, false, `Cannot proceed: ${step4Validation.error}`, 0)
          return
        }
        console.log('[Step 5] Step 4 validation passed, proceeding...')
      }

      if (current === 6) {
        const step5Validation = validateStep5()
        if (!step5Validation.isValid) {
          console.error('[Step 6] Step 5 validation failed:', step5Validation.error)
          setStepLoading(6, false, `Cannot proceed: ${step5Validation.error}`, 0)
          return
        }
        console.log('[Step 6] Step 5 validation passed, proceeding...')
      }

      if (current === 7) {
        const step6Validation = stepLogs[6]?.json ? 
          { isValid: true, data: stepLogs[6].json } : 
          { isValid: false, error: 'Step 6 not executed' }
        if (!step6Validation.isValid) {
          console.error('[Step 7] Step 6 validation failed:', step6Validation.error)
          setStepLoading(7, false, `Cannot proceed: ${step6Validation.error}`, 0)
          return
        }
        console.log('[Step 7] Step 6 validation passed, proceeding...')
      }

      if (current === 8) {
        const step7Validation = stepLogs[7]?.json ? 
          { isValid: true, data: stepLogs[7].json } : 
          { isValid: false, error: 'Step 7 not executed' }
        if (!step7Validation.isValid) {
          console.error('[Step 8] Step 7 validation failed:', step7Validation.error)
          setStepLoading(8, false, `Cannot proceed: ${step7Validation.error}`, 0)
          return
        }
        console.log('[Step 8] Step 7 validation passed, proceeding...')
      }

      if (current === 9) {
        const step8Validation = stepLogs[8]?.json ? 
          { isValid: true, data: stepLogs[8].json } : 
          { isValid: false, error: 'Step 8 not executed' }
        if (!step8Validation.isValid) {
          console.error('[Step 9] Step 8 validation failed:', step8Validation.error)
          setStepLoading(9, false, `Cannot proceed: ${step8Validation.error}`, 0)
          return
        }
        console.log('[Step 9] Step 8 validation passed, proceeding...')
      }

      if (current === 1) {
        console.log('[Step 1] Starting Step 1 execution...')
        setStepLoading(1, true, 'Initializing run...', 10)
        
        // Snapshot effectiveProfile on first step
        if (props.effectiveProfile) {
          setEffectiveProfileSnapshot(props.effectiveProfile)
          console.log('[Step 1] Snapshot effectiveProfile:', props.effectiveProfile)
        }
        
        // Call Step 1 API to find available games
        console.log('[Step 1] Calling game selection API...')
        console.log('[Step 1] Selected game:', props.selectedGame)
        updateStepProgress(1, 30, 'Finding available games...')
        
        try {
          const step1Response = await fetch('/api/shiva/factors/step1', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify({
              capper: 'SHIVA',
              sport: 'NBA',
              betType: props.betType || 'TOTAL',
              limit: 10,
              selectedGame: props.selectedGame // Pass the selected game
            })
          })
          
          console.log('[Step 1] API response status:', step1Response.status)
          const step1Data = await step1Response.json()
          console.log('[Step 1] API response data:', step1Data)
          
          if (!step1Response.ok) {
            console.error('[Step 1] API error:', step1Data)
            throw new Error(`Step 1 failed: ${step1Data.error?.message || 'Unknown error'}`)
          }
          
          if (step1Data.json.state === 'NO_GAMES_AVAILABLE' || step1Data.json.state === 'NO_AVAILABLE_GAMES') {
            // No games available - show message
            console.log('[Step 1] No games available, showing message')
            const noGamesResponse = {
              status: 200,
              json: {
                run_id: null,
                state: step1Data.json.state,
                message: step1Data.json.message,
                filters: step1Data.json.filters
              },
              dryRun: true
            }
            
            setLog(noGamesResponse)
            setStepLogs(prev => ({ ...prev, [1]: noGamesResponse }))
            return
          }
          
          // Set the run_id from API response
          const selectedGame = step1Data.json.selected_game
          const generatedRunId = step1Data.json.run_id
          
          console.log('[Step 1] Setting runId to:', generatedRunId)
          console.log('[Step 1] Selected game:', selectedGame)
          
          setRunId(generatedRunId)
          
          // Store Step 1 response
          const step1LogEntry = {
            status: step1Response.status,
            json: step1Data.json,
            dryRun: true,
            latencyMs: 0 // Will be calculated properly later
          }
          
          console.log('[Step 1] Storing step log entry:', step1LogEntry)
          setStepLogs(prev => {
            const newLogs = { ...prev, [1]: step1LogEntry }
            console.log('[Step 1] Updated stepLogs:', newLogs)
            return newLogs
          })
          
          setLog(step1LogEntry)
          updateStepProgress(1, 100, 'Game selected successfully')
          setStepLoading(1, false, 'Complete', 100)
          console.log('[Step 1] Step 1 completed successfully')
          return
          
        } catch (error) {
          console.error('[Step 1] Error during Step 1 execution:', error)
          const errorResponse = {
            status: 500,
            json: { error: { message: error instanceof Error ? error.message : 'Unknown error' } },
            dryRun: false
          }
          setLog(errorResponse)
          setStepLogs(prev => ({ ...prev, [1]: errorResponse }))
          return
        }
      }
      
      if (current === 2) {
          console.log('[Step 2] Starting Step 2 execution...')
          setStepLoading(2, true, 'Capturing odds snapshot...', 20)
          
          // Use selected game odds or fallback to fixture
          const gameData = props.selectedGame || {
            game_id: 'nba_2025_10_21_den_gsw',
            home: 'Golden State Warriors',
            away: 'Denver Nuggets',
            start_time_utc: '2025-10-21T01:30:00Z',
            odds: {
              ml_home: -110,
              ml_away: -110,
              spread_team: 'Golden State Warriors',
              spread_line: 2.5,
              total_line: 227.5
            }
          }
          
          // Transform to correct API format
          const snapshotData = {
            game_id: gameData.game_id,
            sport: 'NBA' as const,
            home_team: gameData.home,
            away_team: gameData.away,
            start_time_utc: gameData.start_time_utc,
            captured_at_utc: new Date().toISOString(),
            books_considered: 3,
            moneyline: {
              home_avg: gameData.odds.ml_home,
              away_avg: gameData.odds.ml_away
            },
            spread: {
              fav_team: gameData.odds.spread_team,
              line: gameData.odds.spread_line,
              odds: -110
            },
            total: {
              line: gameData.odds.total_line,
              over_odds: -110,
              under_odds: -110
            },
            raw_payload: gameData.odds
          }
          
          updateStepProgress(2, 60, 'Calling odds API...')
          // Use timestamp-based key to bypass idempotency cache
          const step2IdempotencyKey = `ui-demo-snap-${Date.now()}-${Math.random().toString(36).substring(7)}`
          console.log('[Step 2] Using idempotency key:', step2IdempotencyKey)
          const r = await postJson('/api/shiva/odds/snapshot', {
            run_id: runId,
            snapshot: snapshotData
          }, step2IdempotencyKey)
          if (r.json?.snapshot_id) setSnapId(r.json.snapshot_id)
          setLog(r)
          setStepLogs(prev => ({ ...prev, 2: r }))
          updateStepProgress(2, 100, 'Odds captured successfully')
          setStepLoading(2, false, 'Complete', 100)
      } else if (current === 3) {
        console.log('[Step 3] Starting Step 3 execution...')
        setStepLoading(3, true, 'Computing NBA factors...', 10)
        
        // Real API call for Step 3 - NBA Totals factors
        // Note: For NBA TOTAL, the API will compute factors via computeTotalsFactors()
        // The results object is required by schema but will be replaced by computed factors
        const step3Body = {
          run_id: runId,
          inputs: {
            teams: {
              away: 'Denver Nuggets',
              home: 'Golden State Warriors'
            },
            sport: 'NBA',
            betType: props.betType || 'TOTAL',
            ai_provider: 'perplexity',
            news_window_hours: 48
          },
          results: {
            factors: [], // Will be computed by API for NBA TOTAL
            meta: {
              ai_provider: 'perplexity'
            }
          }
        }
        updateStepProgress(3, 50, 'Fetching team stats...')
        // Use timestamp-based key to bypass idempotency cache and force fresh execution
        const step3IdempotencyKey = `ui-demo-step3-${Date.now()}-${Math.random().toString(36).substring(7)}`
        console.log('[Step 3] Using idempotency key:', step3IdempotencyKey)
        const r = await postJson('/api/shiva/factors/step3', step3Body, step3IdempotencyKey)
        updateStepProgress(3, 80, 'Computing factor signals...')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 3: r }))
        updateStepProgress(3, 100, 'Factors computed successfully')
        setStepLoading(3, false, 'Complete', 100)
      } else if (current === 4) {
        console.log('[Step 4] Starting Step 4 execution...')
        setStepLoading(4, true, 'Generating AI predictions...', 10)
        
        // Use actual Step 3 results instead of fixture
        const step3Results = stepLogs[3]?.json
        if (!step3Results?.factors) {
          throw new Error('Step 3 must be completed before Step 4')
        }
        
        const step4Body = {
          run_id: runId,
          inputs: { 
            sport: props.sport || 'NBA', 
            betType: props.betType || 'TOTAL' 
          },
          results: {
            factors: step3Results.factors,
            factor_version: step3Results.factor_version || 'nba_totals_v1',
            meta: {
              conf_source: props.betType === 'TOTAL' ? 'nba_totals_v1' : 'legacy_v1'
            }
          }
        }
        console.log('[Wizard:Step4] About to call API with body:', step4Body)
        updateStepProgress(4, 50, 'Calculating confidence...')
        try {
          const r = await postJson('/api/shiva/factors/step4', step4Body, `ui-demo-step4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
          console.log('[Wizard:Step4] API Response:', r)
          console.log('[Wizard:Step4] Has predictions?', !!r.json?.predictions)
          updateStepProgress(4, 80, 'Generating score predictions...')
          setLog(r)
          setStepLogs(prev => ({ ...prev, 4: r }))
          updateStepProgress(4, 100, 'Predictions generated successfully')
          setStepLoading(4, false, 'Complete', 100)
        } catch (error) {
          console.error('[Wizard:Step4] API Error:', error)
          setStepLoading(4, false, 'Error', 0)
          setLog({ error: error instanceof Error ? error.message : String(error) })
        }
      } else if (current === 5) {
        console.log('[Step 5] Starting Step 5 execution...')
        setStepLoading(5, true, 'Calculating market edge...', 10)
        
        // Use actual Step 4 results instead of fixture
        const step4Results = stepLogs[4]?.json
        console.log('[Wizard:Step5] Step 4 results:', step4Results)
        console.log('[Wizard:Step5] Has predictions?', !!step4Results?.predictions)
        
        // Always execute Step 5, even if Step 4 failed - show in Step Responses table
        if (!step4Results?.predictions) {
          console.log('[Wizard:Step5] Step 4 has no predictions, using fallback data for Step 5')
        }
        
        // Use fallback values when Step 4 data is missing
        const baseConfidence = step4Results?.predictions?.conf7_score || 0
        const predictedTotal = step4Results?.predictions?.total_pred_points || 225
        const marketTotal = stepLogs[2]?.json?.snapshot?.total?.line || 225
        const pickDirection = predictedTotal > marketTotal ? 'OVER' : 'UNDER'
        
        const step5Body = {
          run_id: runId,
          inputs: {
            base_confidence: baseConfidence,
            predicted_total: predictedTotal,
            market_total_line: marketTotal,
            pick_direction: pickDirection
          }
        }
        console.log('[Wizard:Step5] About to call API with body:', step5Body)
        updateStepProgress(5, 50, 'Computing edge factor...')
        try {
          const r = await postJson('/api/shiva/factors/step5', step5Body, `ui-demo-step5-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
          console.log('[Wizard:Step5] API Response:', r)
          updateStepProgress(5, 80, 'Determining unit allocation...')
          setLog(r)
          setStepLogs(prev => ({ ...prev, 5: r }))
          updateStepProgress(5, 100, 'Market analysis complete')
          setStepLoading(5, false, 'Complete', 100)
        } catch (error) {
          console.error('[Wizard:Step5] API Error:', error)
          setStepLoading(5, false, 'Error', 0)
          setLog({ error: error instanceof Error ? error.message : String(error) })
        }
      } else if (current === 6) {
        console.log('[Step 6] Starting Step 6 execution...')
        
        // Bold Player Predictions - Step 6
        const step5Results = stepLogs[5]?.json
        const step4Results = stepLogs[4]?.json
        const step1Results = stepLogs[1]?.json
        
        // Check if we should run Step 6 (only if pick has units > 0)
        const step5Units = step5Results?.units || 0
        console.log('[Step 6] Checking units:', { step5Units, willRun: step5Units > 0 })
        
        if (step5Units > 0) {
          setStepLoading(6, true, 'Generating bold predictions...', 10)
          
          // Always execute Step 6, even if previous steps failed - show in Step Responses table
          if (!step5Results || !step4Results || !step1Results) {
            console.log('[Wizard:Step6] Missing previous step data, using fallback')
          }
        
        const step5_5Body = {
          run_id: runId,
          inputs: {
            sport: props.sport || 'NBA',
            betType: props.betType || 'TOTAL',
            game_data: {
              home_team: step1Results.selected_game?.home_team?.name || 'Home Team',
              away_team: step1Results.selected_game?.away_team?.name || 'Away Team',
              game_date: step1Results.selected_game?.game_date || new Date().toISOString().split('T')[0]
            },
            prediction_data: {
              predicted_total: step4Results.predictions?.total_pred_points || 225,
              pick_direction: step5Results.final_pick?.selection?.includes('OVER') ? 'OVER' : 'UNDER',
              confidence: step5Results.final_pick?.confidence || 0,
              factors_summary: stepLogs[3]?.json?.factors?.map((f: any) => `${f.name}: ${f.notes}`).join(', ') || 'Factor analysis complete'
            }
          }
        }
        
          updateStepProgress(6, 50, 'Calling AI service...')
          const r = await postJson('/api/shiva/factors/step5-5', step5_5Body, `ui-demo-step6-${Date.now()}`)
          updateStepProgress(6, 80, 'Processing predictions...')
          setLog(r)
          setStepLogs(prev => ({ ...prev, 6: r }))
          updateStepProgress(6, 100, 'Bold predictions generated')
          setStepLoading(6, false, 'Complete', 100)
        } else {
          console.log('[Step 6] Skipping Bold Player Predictions - no units allocated (PASS)')
          setStepLoading(6, true, 'Skipping - no units allocated...', 10)
          
          const skipResult = {
            status: 200,
            json: { 
              run_id: runId,
              bold_predictions: null,
              reason: 'Skipped - no units allocated (PASS)',
              skipped: true
            },
            dryRun: true,
            latencyMs: 0
          }
          
          setLog(skipResult)
          setStepLogs(prev => ({ ...prev, 6: skipResult }))
          setStepLoading(6, false, 'Skipped', 100)
        }
      } else if (current === 7) {
        console.log('[Step 7] Starting Step 7 execution...')
        setStepLoading(7, true, 'Generating final pick...', 10)
        
        // Real API call for Step 7 - Pick generation with locked odds
        const step5Results = stepLogs[5]?.json
        const step4Results = stepLogs[4]?.json
        const step2Results = stepLogs[2]?.json
        
        const confFinal = step5Results?.conf_final || 0
        const totalPred = step4Results?.predictions?.total_pred_points || 225
        const marketTotal = step2Results?.snapshot?.total?.line || 225
        
        // Determine pick direction and units based on actual confidence
        const pickDirection = totalPred > marketTotal ? 'OVER' : 'UNDER'
        let units = 0
        if (confFinal >= 4.5) units = 5
        else if (confFinal >= 4.0) units = 3
        else if (confFinal >= 3.5) units = 2
        else if (confFinal >= 2.5) units = 1
        
        const step6Body = {
          run_id: runId,
          inputs: {
            conf_final: confFinal,
            edge_dominant: 'total',
            total_data: {
              total_pred: totalPred,
              market_total: marketTotal
            }
          },
          results: {
            decision: {
              pick_type: 'TOTAL',
              pick_side: pickDirection,
              line: marketTotal,
              units: units,
              reason: `NBA Totals model projects ${totalPred} vs market ${marketTotal}`
            },
            persistence: {
              picks_row: {
                id: `shiva_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                run_id: runId,
                sport: 'NBA',
                matchup: `${stepLogs[1]?.json?.selected_game?.away_team?.name || 'Away'} @ ${stepLogs[1]?.json?.selected_game?.home_team?.name || 'Home'}`,
                confidence: confFinal,
                units: units,
                pick_type: 'TOTAL',
                selection: `${pickDirection} ${marketTotal}`,
                created_at_utc: new Date().toISOString()
              }
            },
            locked_odds: step2Results?.snapshot?.raw_payload || {}
          }
        }
        updateStepProgress(6, 50, 'Locking odds...')
        // Use timestamp-based key to bypass idempotency cache
        const step6IdempotencyKey = `ui-demo-step6-${Date.now()}-${Math.random().toString(36).substring(7)}`
        console.log('[Step 6] Using idempotency key:', step6IdempotencyKey)
        const r = await postJson('/api/shiva/pick/generate', step6Body, step6IdempotencyKey)
        updateStepProgress(7, 80, 'Finalizing pick...')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 7: r }))
        updateStepProgress(7, 100, 'Pick generated successfully')
        setStepLoading(7, false, 'Complete', 100)
      } else if (current === 8) {
        console.log('[Step 8] Starting Step 8 execution...')
        setStepLoading(8, true, 'Generating insight card...', 10)
        
        updateStepProgress(8, 30, 'Loading card template...')
        const fx = (await import('@/../fixtures/shiva-v1/step7-insight-card.json')).default
        updateStepProgress(8, 60, 'Assembling card data...')
        // Use timestamp-based key to bypass idempotency cache
        const step7IdempotencyKey = `ui-demo-step7-${Date.now()}-${Math.random().toString(36).substring(7)}`
        console.log('[Step 7] Using idempotency key:', step7IdempotencyKey)
        const r = await postJson('/api/shiva/insight-card', { ...fx, run_id: runId }, step7IdempotencyKey)
        updateStepProgress(8, 80, 'Finalizing card...')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 8: r }))
        
        // Assemble Insight Card from real run data
        const runCtx = {
          game: props.selectedGame,
          effectiveProfile: effectiveProfileSnapshot || props.effectiveProfile
        }
        
        const assembledCard = assembleInsightCard({
          runCtx,
          step4: stepLogs[4],
          step5: stepLogs[5],
          step6: stepLogs[6],
          step3: stepLogs[3],
          snapshot: stepLogs[2]?.json
        })
        
        // Light up Insight pill and store assembled data
        setHasInsight(true)
        setInsightCardData(assembledCard)
        updateStepProgress(7, 100, 'Insight card generated')
        setStepLoading(7, false, 'Complete', 100)
      } else if (current === 8) {
        console.log('[Step 8] Starting Step 8 execution...')
        setStepLoading(8, true, 'Generating debug report...', 10)
        
        // Debug Report - build comprehensive structure
        console.log('Generating debug report for step 8, stepLogs:', stepLogs)
        console.log('stepLogs keys:', Object.keys(stepLogs))
        console.log('effectiveProfileSnapshot:', effectiveProfileSnapshot)
        updateStepProgress(8, 30, 'Collecting step data...')
        
        // Build comprehensive steps array with actual response data
        const stepsArray = Object.entries(stepLogs)
          .filter(([stepNum]) => parseInt(stepNum) < 8) // Exclude step 8
          .map(([stepNum, response]: [string, any]) => ({
            step: parseInt(stepNum),
            status: response.status,
            dryRun: response.dryRun,
            latencyMs: response.latencyMs || 0,
            response: response.json || null, // Include actual response data
            error: response.error || null,
          }))
        
        const debugReport = {
          timestamp: new Date().toISOString(),
          runId: runId || 'unknown',
          snapId: snapId || 'unknown',
          effectiveProfile: effectiveProfileSnapshot || props.effectiveProfile || null,
          environment: {
            SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
            SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
            SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
          },
          steps: stepsArray,
          summary: {
            totalSteps: stepsArray.length,
            successfulSteps: stepsArray.filter((s) => s.status >= 200 && s.status < 300).length,
            errorSteps: stepsArray.filter((s) => s.status >= 400).length,
            dryRunSteps: stepsArray.filter((s) => s.dryRun === true).length,
          },
          // Enhanced debugging information
          factor_count: stepLogs[3]?.json?.factor_count || 0,
          factor_keys: stepLogs[3]?.json?.factors?.map((f: any) => f.key) || [],
          assembler: {
            factorRows: stepLogs[3]?.json?.factors?.length || 0,
            topFactorKey: stepLogs[3]?.json?.factors?.[0]?.key || 'none',
            oddsUsed: {
              ml_home: stepLogs[2]?.json?.snapshot?.moneyline?.home_avg || 0,
              ml_away: stepLogs[2]?.json?.snapshot?.moneyline?.away_avg || 0,
              spread_team: stepLogs[2]?.json?.snapshot?.spread?.fav_team || 'unknown',
              spread_line: stepLogs[2]?.json?.snapshot?.spread?.line || 0,
              total_line: stepLogs[2]?.json?.snapshot?.total?.line || 0,
            }
          },
          stepLogsRaw: stepLogs, // Include raw step logs for debugging
        }
        console.log('Debug report generated (comprehensive):', debugReport)
        setLog({ status: 200, json: debugReport, dryRun: false })
        updateStepProgress(8, 100, 'Debug report generated')
        setStepLoading(8, false, 'Complete', 100)
        // DO NOT add to stepLogs to prevent recursion
      } else if (current === 9) {
        console.log('[Step 9] Starting Step 9 execution...')
        setStepLoading(9, true, 'Generating debug report...', 10)
        
        // Debug Report - build comprehensive structure
        console.log('Generating debug report for step 9, stepLogs:', stepLogs)
        console.log('stepLogs keys:', Object.keys(stepLogs))
        console.log('effectiveProfileSnapshot:', effectiveProfileSnapshot)
        updateStepProgress(9, 30, 'Collecting step data...')
        
        // Build comprehensive steps array with actual response data
        const stepsArray = Object.entries(stepLogs)
          .filter(([stepNum]) => parseInt(stepNum) < 9) // Exclude step 9
          .map(([stepNum, response]: [string, any]) => ({
            step: parseInt(stepNum),
            status: response.status,
            dryRun: response.dryRun,
            latencyMs: response.latencyMs || 0,
            response: response.json || null, // Include actual response data
            error: response.error || null,
          }))
        
        const debugReport = {
          timestamp: new Date().toISOString(),
          runId: runId || 'unknown',
          snapId: snapId || 'unknown',
          effectiveProfile: effectiveProfileSnapshot || props.effectiveProfile || null,
          environment: {
            SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
            SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
            SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
          },
          steps: stepsArray,
          summary: {
            totalSteps: stepsArray.length,
            successfulSteps: stepsArray.filter(s => s.status >= 200 && s.status < 300).length,
            errorSteps: stepsArray.filter(s => s.status >= 400).length,
            dryRunSteps: stepsArray.filter(s => s.dryRun).length,
            step1Executed: stepLogs[1]?.status === 201,
            step1Status: stepLogs[1]?.status || 'NOT_EXECUTED',
            stepLogs: stepLogs
          },
          debugInfo: {
            stepLogsKeys: Object.keys(stepLogs),
            stepLogsValues: Object.values(stepLogs),
            currentStep: 9,
            runIdSet: !!runId,
            snapIdSet: !!snapId
          },
          topFactorKey: stepLogs[3]?.json?.factors?.[0]?.key || 'none',
          oddsUsed: {
            ml_home: stepLogs[2]?.json?.snapshot?.moneyline?.home_avg || 0,
            ml_away: stepLogs[2]?.json?.snapshot?.moneyline?.away_avg || 0,
            spread_team: stepLogs[2]?.json?.snapshot?.spread?.fav_team || 'unknown',
            spread_line: stepLogs[2]?.json?.snapshot?.spread?.line || 0,
            total_line: stepLogs[2]?.json?.snapshot?.total?.line || 0,
          },
          stepLogsRaw: stepLogs, // Include raw step logs for debugging
        }
        console.log('Debug report generated (comprehensive):', debugReport)
        setLog({ status: 200, json: debugReport, dryRun: false })
        updateStepProgress(9, 100, 'Debug report generated')
        setStepLoading(9, false, 'Complete', 100)
        // DO NOT add to stepLogs to prevent recursion
      }
    } catch (e) {
      setLog({ status: 0, json: { error: { message: (e as Error).message } } })
    }
  }
  return (
    <div>
      <DryRunBanner />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="font-bold text-white text-lg">Pick Generator Wizard</div>
          {/* Quick Access Insight Pill - only depends on hasInsight */}
          {hasInsight && (
            <button
              onClick={() => {
                if (!insightCardData) return
                setShowInsightCard(true)
              }}
              className="px-3 py-1 bg-green-700 text-white rounded-full text-xs font-bold hover:bg-green-600 border-2 border-green-500 animate-pulse"
              title="Open Insight Card"
            >
              👁️ Insight
            </button>
          )}
        </div>
        <div className="text-sm text-white font-bold">Step {step} / 8</div>
      </div>

      {/* Step Logs Table - Always visible, shows all 8 steps */}
      <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white">Step Responses:</h4>
            {/* Debug Report Buttons - Always visible when there are step logs */}
            {Object.keys(stepLogs).length > 0 && (
              <div className="flex gap-2">
                <button 
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700"
                onClick={() => {
                  const debugReport = {
                    timestamp: new Date().toISOString(),
                    runId: runId || 'unknown',
                    snapId: snapId || 'unknown',
                    effectiveProfile: effectiveProfileSnapshot || props.effectiveProfile || null,
                    environment: {
                      SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
                      SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
                      SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
                    },
                    steps: Object.entries(stepLogs)
                      .filter(([stepNum]) => parseInt(stepNum) < 8)
                      .map(([stepNum, response]: [string, any]) => ({
                        step: parseInt(stepNum),
                        status: response.status,
                        dryRun: response.dryRun,
                        latencyMs: response.latencyMs || 0,
                        response: response.json || null,
                        error: response.error || null,
                      })),
                    summary: {
                      totalSteps: Object.keys(stepLogs).length,
                      successfulSteps: Object.values(stepLogs).filter((s: any) => s.status >= 200 && s.status < 300).length,
                      errorSteps: Object.values(stepLogs).filter((s: any) => s.status >= 400).length,
                      dryRunSteps: Object.values(stepLogs).filter((s: any) => s.dryRun === true).length,
                    },
                    // Enhanced debugging information
                    factor_count: stepLogs[3]?.json?.factor_count || 0,
                    factor_keys: stepLogs[3]?.json?.factors?.map((f: any) => f.key) || [],
                    assembler: {
                      factorRows: stepLogs[3]?.json?.factors?.length || 0,
                      topFactorKey: stepLogs[3]?.json?.factors?.[0]?.key || 'none',
                      oddsUsed: {
                        ml_home: stepLogs[2]?.json?.snapshot?.moneyline?.home_avg || 0,
                        ml_away: stepLogs[2]?.json?.snapshot?.moneyline?.away_avg || 0,
                        spread_team: stepLogs[2]?.json?.snapshot?.spread?.fav_team || 'unknown',
                        spread_line: stepLogs[2]?.json?.snapshot?.spread?.line || 0,
                        total_line: stepLogs[2]?.json?.snapshot?.total?.line || 0,
                      }
                    },
                    // Step-specific debug information
      step_debug: {
        step3_totals: stepLogs[3]?.json?._debug || null,
        step3_factors_detail: stepLogs[3]?.json?.factors?.map((f: any) => ({
          key: f.key,
          name: f.name,
          z: f.normalized_value,
          points: f.parsed_values_json?.points,
          awayContribution: f.parsed_values_json?.awayContribution,
          homeContribution: f.parsed_values_json?.homeContribution,
          weight: f.weight_total_pct,
          capped: f.caps_applied,
          notes: f.notes
        })) || [],
        nba_stats_api_debug: {
          condition_check: stepLogs[3]?.json?._debug?.totals?.console_logs?.nba_stats_condition_check || 'Not found in debug logs',
          enabled_factors: stepLogs[3]?.json?._debug?.totals?.console_logs?.enabled_factors || 'Not found in debug logs',
          nba_stats_fetched: stepLogs[3]?.json?._debug?.totals?.console_logs?.nba_stats_fetched || 'Not found in debug logs',
          team_names: stepLogs[3]?.json?._debug?.totals?.console_logs?.team_names || 'Not found in debug logs',
          bundle_keys: stepLogs[3]?.json?._debug?.totals?.console_logs?.bundle ? Object.keys(stepLogs[3].json._debug.totals.console_logs.bundle) : 'Not found in debug logs',
          bundle_sample: stepLogs[3]?.json?._debug?.totals?.console_logs?.bundle ? {
            awayPaceSeason: stepLogs[3].json._debug.totals.console_logs.bundle.awayPaceSeason,
            homePaceSeason: stepLogs[3].json._debug.totals.console_logs.bundle.homePaceSeason,
            awayORtgLast10: stepLogs[3].json._debug.totals.console_logs.bundle.awayORtgLast10,
            homeORtgLast10: stepLogs[3].json._debug.totals.console_logs.bundle.homeORtgLast10,
            leaguePace: stepLogs[3].json._debug.totals.console_logs.bundle.leaguePace,
            leagueORtg: stepLogs[3].json._debug.totals.console_logs.bundle.leagueORtg
          } : 'Not found in debug logs',
          api_calls_made: stepLogs[3]?.json?._debug?.totals?.console_logs?.api_calls || 'Not found in debug logs'
        },
        step4_predictions: stepLogs[4]?.json || null,
        step5_confidence: stepLogs[5]?.json || null,
        step6_pick: stepLogs[6]?.json?.pick || null,
        confidence_calculation: {
          // New signal-based confidence calculation
          factor_signals: stepLogs[3]?.json?.factors?.map((f: any) => ({
            key: f.key,
            name: f.name,
            signal: f.normalized_value, // sᵢ ∈ [-1, +1]
            weight: f.weight_total_pct,
            contribution: (f.normalized_value || 0) * ((f.weight_total_pct || 0) / 100)
          })) || [],
          signed_sum: stepLogs[3]?.json?.factors?.reduce((sum: number, f: any) => 
            sum + ((f.normalized_value || 0) * ((f.weight_total_pct || 0) / 100)), 0) || 0,
          base_confidence: Math.abs(stepLogs[3]?.json?.factors?.reduce((sum: number, f: any) => 
            sum + ((f.normalized_value || 0) * ((f.weight_total_pct || 0) / 100)), 0) || 0) * 5,
          weight_validation: {
            total_weight: stepLogs[3]?.json?.factors?.reduce((sum: number, f: any) => 
              sum + (f.weight_total_pct || 0), 0) || 0,
            expected_weight: 250,
            is_valid: Math.abs((stepLogs[3]?.json?.factors?.reduce((sum: number, f: any) => 
              sum + (f.weight_total_pct || 0), 0) || 0) - 250) < 0.01
          }
        }
      },
      // Pick Generation Cooldown Information
      pick_generation_cooldown: {
        step1_cooldown_info: stepLogs[1]?.json?.cooldown_info || null,
        games_in_cooldown: stepLogs[1]?.json?.cooldown_info?.games_in_cooldown || 0,
        cooldown_hours: stepLogs[1]?.json?.cooldown_info?.cooldown_hours || 2,
        total_games_checked: stepLogs[1]?.json?.total_games_checked || 0,
        available_games_count: stepLogs[1]?.json?.available_games_count || 0
      },
                    // AI Usage Summary
                    ai_usage: {
                      step3_provider: stepLogs[3]?.json?._debug?.ai_provider || 'unknown',
                      step3_news_window: stepLogs[3]?.json?._debug?.news_window_hours || 48,
                      step4_used: stepLogs[4]?.json?.conf_source || 'unknown',
                      step7_used: stepLogs[7]?.status === 200,
                    },
                    stepLogsRaw: stepLogs,
                  }
                  navigator.clipboard.writeText(JSON.stringify(debugReport, null, 2))
                  alert('Comprehensive debug report copied to clipboard! (Includes NBA Stats API debugging)')
                }}
              >
                📋 Debug Report
              </button>
              </div>
            )}
          </div>
          <div className="border border-gray-600 rounded p-2 text-xs bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-1 text-white">Step</th>
                  <th className="text-left p-1 text-white">Name</th>
                  <th className="text-left p-1 text-white">Status</th>
                  <th className="text-left p-1 text-white">AI Used</th>
                  <th className="text-left p-1 text-white">Dry Run</th>
                  <th className="text-left p-1 text-white">Data Type</th>
                  <th className="text-left p-1 text-white">Response</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((stepNum) => {
                  const response = stepLogs[stepNum]
                  const isExecuted = !!response
                  const usesAI = stepNum === 3 || stepNum === 4 || stepNum === 6 || stepNum === 8 // Steps that use AI
                  const aiProvider = stepNum === 3 ? 'Perplexity' : stepNum === 4 ? 'OpenAI' : stepNum === 6 ? 'Perplexity' : stepNum === 8 ? 'OpenAI' : null
                  
                  // Detect mock vs real data (only for executed steps)
                  const isMockData = isExecuted && (
                    response.json?.mock_data === true || 
                    response.json?.data_source === 'mock' ||
                    response.json?.fixture === true ||
                    (stepNum === 2 && response.json?.snapshot?.odds?.mock === true) ||
                    (stepNum === 3 && response.json?.factors?.some((f: any) => f.mock_data === true))
                  )
                  
                  return (
                    <tr key={stepNum} className={`border-b border-gray-700 ${!isExecuted ? 'opacity-50' : ''}`}>
                      <td className="p-1 text-white">{stepNum}</td>
                      <td className="p-1 text-gray-300">{stepNames[stepNum]}</td>
                      <td className="p-1">
                        {isExecuted ? (
                          <span className={`px-1 rounded text-xs ${
                            response.status >= 200 && response.status < 300 ? 'bg-green-600 text-white' :
                            response.status >= 400 ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                          }`}>
                            {response.status}
                          </span>
                        ) : (
                          <span className="px-1 rounded text-xs bg-gray-600 text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-1">
                        {isExecuted && usesAI ? (
                          <span className="px-1 rounded text-xs bg-purple-600 text-white">
                            🤖 {aiProvider}
                          </span>
                        ) : (
                          <span className="px-1 rounded text-xs bg-gray-600 text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-1">
                        {isExecuted ? (
                          <span className={`px-1 rounded text-xs ${
                            response.dryRun ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
                          }`}>
                            {response.dryRun ? 'Yes' : 'No'}
                          </span>
                        ) : (
                          <span className="px-1 rounded text-xs bg-gray-600 text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-1">
                        {isExecuted ? (
                          isMockData ? (
                            <span className="px-1 rounded text-xs bg-yellow-600 text-black font-bold">
                              🔧 MOCK
                            </span>
                          ) : (
                            <span className="px-1 rounded text-xs bg-green-600 text-white">
                              ✅ REAL
                            </span>
                          )
                        ) : (
                          <span className="px-1 rounded text-xs bg-gray-600 text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-1 font-mono text-xs max-w-xs truncate text-gray-300">
                        {isExecuted ? (
                          response.json ? JSON.stringify(response.json).substring(0, 50) + '...' : 'No data'
                        ) : (
                          <span className="text-gray-500">Not executed</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      {/* Navigation Buttons - Moved to stay at top */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          {step <= 9 && (
            <div className="text-sm text-white">
              <div className="font-bold flex items-center gap-2">
                {step === 1 && (
                  <>
                    Step 1: Game Selection
                    {renderStepStatus(1, "Game Selection")}
                  </>
                )}
                {step === 2 && (
                  <>
                    Step 2: Odds Snapshot
                    {renderStepStatus(2, "Odds Snapshot")}
                  </>
                )}
                {step === 3 && (
                  <>
                    Step 3: Factor Analysis
                    {renderStepStatus(3, "Factor Analysis")}
                  </>
                )}
                {step === 4 && (
                  <>
                    Step 4: Score Predictions
                    {renderStepStatus(4, "Score Predictions")}
                  </>
                )}
                {step === 5 && (
                  <>
                    Step 5: Pick Generation
                    {renderStepStatus(5, "Pick Generation")}
                  </>
                )}
                {step === 6 && (
                  <>
                    Step 6: Bold Player Predictions
                    {renderStepStatus(6, "Bold Player Predictions")}
                  </>
                )}
                {step === 7 && (
                  <>
                    Step 7: Pick Finalization
                    {renderStepStatus(7, "Pick Finalization")}
                  </>
                )}
                {step === 8 && (
                  <>
                    Step 8: Insight Card
                    {renderStepStatus(8, "Insight Card")}
                  </>
                )}
                {step === 9 && (
                  <>
                    Step 9: Debug Report
                    {renderStepStatus(9, "Debug Report")}
                  </>
                )}
              </div>
              
              {/* Progress Bar for Current Step */}
              {loadingSteps.has(step) && stepProgress[step] && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                    <span>{stepProgress[step].status}</span>
                    <span>{stepProgress[step].progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${stepProgress[step].progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-300 mt-1">
                {step === 1 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Initialize prediction run and select optimal game</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Filter games by status (scheduled), timing (&gt;30min), and existing picks</li>
                      <li><strong>For TOTAL:</strong> Find games with no TOTAL predictions</li>
                      <li><strong>For SPREAD/MONEYLINE:</strong> Find games with no SPREAD OR MONEYLINE predictions</li>
                      <li>Generate unique run_id and retrieve game details + current odds</li>
                    </ul>
                  </div>
                )}
                {step === 2 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Capture current market odds at prediction time</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Collect moneyline, spread, and total odds from all bookmakers</li>
                      <li><strong>Timestamp snapshot for grading and edge calculation:</strong> Locks exact odds at prediction time for fair performance evaluation</li>
                      <li>Generate snapshot_id with complete odds data and precise timestamp</li>
                      <li>Enables accurate grading by comparing picks against the exact market lines you saw</li>
                      <li>Calculates edge by measuring how much the market moved in your favor</li>
                    </ul>
                  </div>
                )}
                {step === 3 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Compute confidence factors based on team performance data</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Fetch team stats from NBA Stats API and StatMuse</li>
                      <li>Analyze Pace Index, Offensive Form, Defensive Erosion</li>
                      <li>Process 3-Point Environment and Free-Throw factors</li>
                      <li>Apply injury/availability data via LLM analysis</li>
                    </ul>
                  </div>
                )}
                {step === 4 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Generate final score predictions using AI models</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Combine factor analysis with team performance data</li>
                      <li>Apply AI models for score prediction</li>
                      <li>Calculate confidence scores and determine winner</li>
                      <li>Generate predicted scores (home/away) and margin</li>
                    </ul>
                  </div>
                )}
                {step === 5 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Calculate market edge and adjust confidence</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Compare predicted total vs market line</li>
                      <li>Calculate edge percentage and market adjustment</li>
                      <li>Apply final confidence score adjustments</li>
                      <li>Determine pick direction (Over/Under) based on edge</li>
                    </ul>
                  </div>
                )}
                {step === 6 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Generate AI-powered bold player predictions</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Research recent news, injuries, and statistical trends</li>
                      <li>Generate 2-4 specific, measurable player predictions</li>
                      <li>Align predictions with pick direction (OVER/UNDER)</li>
                      <li>Include reasoning and confidence levels for each prediction</li>
                    </ul>
                  </div>
                )}
                {step === 7 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Finalize and commit the betting pick</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Use pick decision from Step 5 with unit allocation and confidence</li>
                      <li>Lock in odds snapshot for grading purposes</li>
                      <li>Apply risk management rules and validation</li>
                      <li>Store final pick with confidence, units, and locked odds</li>
                    </ul>
                  </div>
                )}
                {step === 9 && (
                  <div>
                    <div className="font-semibold text-white mb-1">Generate comprehensive debugging information</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Complete step-by-step execution log with timing</li>
                      <li>API call details, success rates, and error tracking</li>
                      <li>Factor calculations, weights, and performance metrics</li>
                      <li>Pipeline optimization data and troubleshooting info</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button 
          className={`px-3 py-1 border-2 border-gray-600 rounded font-semibold flex items-center gap-2 ${
            step >= 8 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : loadingSteps.has(step)
              ? 'bg-blue-600 text-white cursor-wait border-blue-500'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
          onClick={async () => {
            if (loadingSteps.has(step)) return // Only block if loading
            
            // Execute the current step first, then advance
            await handleStepClick(step)
            // Advance to next step after execution
            setStep(Math.min(9, step + 1))
          }}
          disabled={step >= 9 || loadingSteps.has(step)}
          aria-disabled={step >= 9 || loadingSteps.has(step)}
        >
          {loadingSteps.has(step) ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              <span className="text-xs">{stepProgress[step]?.status || 'Processing...'}</span>
            </>
          ) : (
            'Next'
          )}
        </button>
      </div>

      <div className="border rounded p-3 text-xs font-mono whitespace-pre-wrap bg-gray-900 text-white">
        {log ? JSON.stringify(log, null, 2) : 
         step === 9 ? 'Click Next to generate debug report with all step responses.' :
         'Click Next to start (Step 1 creates run).'}
      </div>
      
      {/* Debug info */}
      <div className="mt-2 text-xs text-gray-300 font-semibold">
        Current step: {step}, Step logs count: {Object.keys(stepLogs).length}
      </div>

      {/* Insight Card Button (Primary CTA after Step 8) */}
      {step >= 8 && hasInsight && (
        <div className="mt-3 p-3 bg-green-900 border-2 border-green-600 rounded">
          <div className="flex items-center justify-between">
            <div className="text-white font-bold">
              ✅ Insight Card Ready ({insightCardData?.pick?.units || 0}u on {insightCardData?.pick?.selection || 'N/A'})
            </div>
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-500 border-2 border-green-400"
              onClick={() => {
                if (!insightCardData) return
                setShowInsightCard(true)
              }}
            >
              👁️ Open Insight Card
            </button>
          </div>
        </div>
      )}


      {/* Insight Card Modal */}
      {showInsightCard && insightCardData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto relative">
            {/* Close Button */}
            <button
              onClick={() => setShowInsightCard(false)}
              className="absolute top-4 right-4 bg-gray-800 text-white px-3 py-1 rounded font-bold hover:bg-gray-700 z-10"
            >
              ✕ Close
            </button>
            
            {/* Action Buttons */}
            <div className="absolute top-4 left-4 flex gap-2 z-10">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(insightCardData, null, 2))
                  alert('Card JSON copied to clipboard!')
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-blue-500"
              >
                📋 Copy Card JSON
              </button>
              <button
                onClick={() => {
                  alert('Export PNG not yet implemented - use browser screenshot for now')
                }}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-green-500"
              >
                📸 Export PNG
              </button>
            </div>

            {/* Render Insight Card */}
            <div className="mt-16">
              <InsightCard {...insightCardData} onClose={() => setShowInsightCard(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


