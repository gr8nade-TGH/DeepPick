"use client"
import { useMemo, useState, useEffect } from 'react'
import { InsightCard } from './insight-card'
import { getFactorMeta } from '@/lib/cappers/shiva-v1/factor-registry'

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
  if (!profile?.weights) return true // Default enabled if no profile
  // Check if factor is enabled in profile (simplified - assume all enabled for now)
  return true
}

function getWeightPct(factorKey: string, profile: any): number {
  if (!profile?.weights) return 0.1 // Default weight
  // Map factor keys to profile weights
  const weightMap: Record<string, string> = {
    seasonNet: 'f1_net_rating',
    recentNet: 'f2_recent_form',
    h2hPpg: 'f3_h2h_matchup',
    matchupORtgDRtg: 'f4_ortg_diff',
    newsEdge: 'f5_news_injury',
    homeEdge: 'f6_home_court',
    threePoint: 'f7_three_point',
  }
  const weightKey = weightMap[factorKey]
  return weightKey ? (profile.weights[weightKey] || 0) : 0.1
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

function assembleInsightCard({ runCtx, step4, step5, step6, step3, step2 }: any) {
  const g = runCtx?.game || {}
  const pick = step6?.json?.pick || null
  const conf7 = Number(step4?.json?.predictions?.conf7_score ?? 0)
  const confAdj = Number(step5?.json?.conf_market_adj ?? 0)
  const confFinal = Number(step5?.json?.conf_final ?? conf7 + confAdj)

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
      const line = Math.abs(spreadLine).toFixed(1)
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

  const factorRows = (step3?.json?.factors ?? [])
    .filter((f: any) => isEnabledInProfile(f.key, runCtx?.effectiveProfile))
    .map((f: any) => {
      const pv = f.parsed_values_json ?? {}
      const meta = getFactorMeta(f.key)
      const weightPct = getWeightPct(f.key, runCtx?.effectiveProfile)

      return {
        key: f.key,
        label: meta?.shortName || f.name || f.key,
        icon: meta?.icon || 'ℹ️',
        awayContribution: Number(pv.awayContribution ?? 0),
        homeContribution: Number(pv.homeContribution ?? 0),
        weightAppliedPct: Math.round(((weightPct ?? 0) * 100)),
        rationale: f.notes ?? meta?.description ?? '',
        z: Number(f.normalized_value ?? 0),
        points: Number(pv.points ?? 0),
      }
    })
    .sort((a: any, b: any) => {
      const absA = Math.abs(a.awayContribution - a.homeContribution)
      const absB = Math.abs(b.awayContribution - b.homeContribution)
      return absB - absA
    })

  console.debug('[card:factor.rows]', factorRows)

  // Debug hooks (dev only)
  console.debug('[card.odds.used]', odds)
  console.debug('[card.factor.rows]', factorRows.map((r: any) => ({ key: r.key, away: r.awayContribution, home: r.homeContribution })))

  return {
    capper: 'SHIVA',
    capperIconUrl: undefined, // Placeholder for now
    sport: 'NBA' as const,
    gameId: g.game_id || 'unknown',
    generatedAt: new Date().toISOString(),
    matchup: {
      away: awayTeam,
      home: homeTeam,
      spreadText,
      totalText,
      gameDateLocal: g.start_time_utc || new Date().toISOString(),
    },
    pick: pick ? {
      type: (pick.pick_type || 'UNKNOWN') as 'SPREAD' | 'MONEYLINE' | 'TOTAL' | 'RUN_LINE',
      selection: pick.selection || 'N/A',
      units: Number(pick.units ?? 0),
      confidence: Number(pick.confidence ?? confFinal),
      locked_odds: pick.locked_odds || null,
      locked_at: pick.locked_at || null,
    } : { 
      type: 'UNKNOWN' as const, 
      selection: 'N/A', 
      units: 0, 
      confidence: confFinal,
      locked_odds: null,
      locked_at: null,
    },
    predictedScore,
    writeups: {
      prediction: generatePredictionWriteup(pick, predictedScore, totalLine, confFinal, factorRows, awayTeam, homeTeam),
      gamePrediction: `${predictedScore.winner} ${Math.max(predictedScore.home, predictedScore.away)}–${Math.min(predictedScore.home, predictedScore.away)}`,
      bold: generateBoldPrediction(pick, predictedScore, factorRows),
    },
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
  }
}

export interface SHIVAWizardProps {
  effectiveProfile?: any
  selectedGame?: any
  mode?: 'dry-run' | 'write'
  betType?: 'SPREAD' | 'MONEYLINE' | 'TOTAL'
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

  // Auto-generate debug report when reaching Step 8
  useEffect(() => {
    if (step === 8 && Object.keys(stepLogs).length > 0) {
      console.log('Auto-generating debug report for step 8, stepLogs:', stepLogs)
      console.log('stepLogs keys:', Object.keys(stepLogs))
      console.log('effectiveProfileSnapshot:', effectiveProfileSnapshot)
      
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
        stepLogsRaw: stepLogs, // Include raw step logs for debugging
      }
      console.log('Debug report generated (comprehensive):', debugReport)
      setLog({ status: 200, json: debugReport, dryRun: false })
    }
  }, [step, stepLogs, effectiveProfileSnapshot, runId, snapId, props.effectiveProfile])

  async function handleStepClick(current: number) {
    try {
      if (current === 1) {
        // Snapshot effectiveProfile on first step
        if (props.effectiveProfile) {
          setEffectiveProfileSnapshot(props.effectiveProfile)
        }
        
        // Generate run_id BEFORE POST (if not already set)
        let generatedRunId = runId
        if (!generatedRunId) {
          // Use crypto.randomUUID() if available, otherwise fallback
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            generatedRunId = crypto.randomUUID()
          } else {
            // Fallback UUID v4 generator
            generatedRunId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.random() * 16 | 0
              const v = c === 'x' ? r : (r & 0x3 | 0x8)
              return v.toString(16)
            })
          }
          console.debug('[Step 1] Generated run_id:', generatedRunId)
          setRunId(generatedRunId)
        }
        
        // Use selected game or fallback to demo game
        const gameData = props.selectedGame || {
          game_id: 'nba_2025_10_21_okc_hou',
          home: 'Oklahoma City Thunder',
          away: 'Houston Rockets',
          start_time_utc: '2025-10-21T01:30:00Z',
        }
        
        console.debug('[Step 1] POST body:', {
          run_id: generatedRunId,
          game: gameData,
          effectiveProfile: props.effectiveProfile
        })
        
        const r = await postJson('/api/shiva/runs', {
          run_id: generatedRunId, // Include run_id in POST body
          game: {
            game_id: gameData.game_id || 'nba_2025_10_21_okc_hou',
            home: gameData.home || 'Oklahoma City Thunder',
            away: gameData.away || 'Houston Rockets',
            start_time_utc: gameData.start_time_utc || '2025-10-21T01:30:00Z'
          },
          effectiveProfile: props.effectiveProfile
        }, 'ui-demo-run')
        
        console.debug('[Step 1] Response:', r)
        setLog(r)
        setStepLogs(prev => ({ ...prev, 1: r }))
        } else if (current === 2) {
          // Use selected game odds or fallback to fixture
          const gameData = props.selectedGame || {
            game_id: 'nba_2025_10_21_okc_hou',
            home: 'Oklahoma City Thunder',
            away: 'Houston Rockets',
            start_time_utc: '2025-10-21T01:30:00Z',
            odds: {
              ml_home: -110,
              ml_away: -110,
              spread_team: 'Oklahoma City Thunder',
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
          
          const r = await postJson('/api/shiva/odds/snapshot', {
            run_id: runId,
            snapshot: snapshotData
          }, 'ui-demo-snap')
          if (r.json?.snapshot_id) setSnapId(r.json.snapshot_id)
          setLog(r)
          setStepLogs(prev => ({ ...prev, 2: r }))
      } else if (current === 3) {
        // Real API call for Step 3 - NBA Totals factors
        // Note: For NBA TOTAL, the API will compute factors via computeTotalsFactors()
        // The results object is required by schema but will be replaced by computed factors
        const step3Body = {
          run_id: runId,
          inputs: {
            teams: {
              away: 'Houston Rockets',
              home: 'Oklahoma City Thunder'
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
        const r = await postJson('/api/shiva/factors/step3', step3Body, 'ui-demo-step3')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 3: r }))
      } else if (current === 4) {
        const fx = (await import('@/../fixtures/shiva-v1/step4-prediction.json')).default
        const step4Body = {
          ...fx,
          run_id: runId,
          results: {
            ...fx.results,
            meta: {
              ...fx.results.meta,
              conf_source: props.betType === 'TOTAL' ? 'nba_totals_v1' : 'legacy_v1'
            }
          }
        }
        const r = await postJson('/api/shiva/factors/step4', step4Body, 'ui-demo-step4')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 4: r }))
      } else if (current === 5) {
        const fx = (await import('@/../fixtures/shiva-v1/step5-market.json')).default
        const body = { ...fx, run_id: runId }
        if (snapId) body.inputs.active_snapshot_id = snapId
        const r = await postJson('/api/shiva/factors/step5', body as any, 'ui-demo-step5')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 5: r }))
      } else if (current === 6) {
        // Real API call for Step 6 - Pick generation with locked odds
        const step6Body = {
          run_id: runId,
          inputs: {
            conf_final: 2.72, // From Step 5
            edge_dominant: 'total',
            total_data: {
              total_pred: 230.1, // From Step 4
              market_total: 226.5 // From Step 2 snapshot
            }
          },
          results: {
            decision: {
              pick_type: 'TOTAL',
              pick_side: 'OVER',
              line: 227.5,
              units: 1,
              reason: 'NBA Totals model projects 230.1 vs market 226.5'
            },
            persistence: {
              picks_row: {
                id: `pick_${runId.slice(-8)}`,
                run_id: runId,
                sport: 'NBA',
                matchup: 'Houston Rockets @ Oklahoma City Thunder',
                confidence: 2.72,
                units: 1,
                pick_type: 'TOTAL',
                selection: 'OVER 227.5',
                created_at_utc: new Date().toISOString()
              }
            },
            locked_odds: {
              total_line: 226.5,
              spread_team: 'Oklahoma City Thunder',
              spread_line: -7.5,
              ml_home: -302,
              ml_away: 242
            }
          }
        }
        const r = await postJson('/api/shiva/pick/generate', step6Body, 'ui-demo-step6')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 6: r }))
      } else if (current === 7) {
        const fx = (await import('@/../fixtures/shiva-v1/step7-insight-card.json')).default
        const r = await postJson('/api/shiva/insight-card', { ...fx, run_id: runId }, 'ui-demo-step7')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 7: r }))
        
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
      } else if (current === 8) {
        // Debug Report - build comprehensive structure
        console.log('Generating debug report for step 8, stepLogs:', stepLogs)
        console.log('stepLogs keys:', Object.keys(stepLogs))
        console.log('effectiveProfileSnapshot:', effectiveProfileSnapshot)
        
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

      {/* Step Logs Table - Moved to top for better visibility */}
      {Object.keys(stepLogs).length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white">Step Responses:</h4>
            {/* Copy Debug Report Button - Always visible when there are step logs */}
            {Object.keys(stepLogs).length > 0 && (
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
                    stepLogsRaw: stepLogs,
                  }
                  navigator.clipboard.writeText(JSON.stringify(debugReport, null, 2))
                  alert('Debug report copied to clipboard!')
                }}
              >
                📋 Copy Debug Report
              </button>
            )}
          </div>
          <div className="border border-gray-600 rounded p-2 text-xs bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-1 text-white">Step</th>
                  <th className="text-left p-1 text-white">Status</th>
                  <th className="text-left p-1 text-white">AI Used</th>
                  <th className="text-left p-1 text-white">Dry Run</th>
                  <th className="text-left p-1 text-white">Response</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stepLogs).map(([stepNum, response]: [string, any]) => {
                  const step = parseInt(stepNum)
                  const usesAI = step === 3 || step === 4 || step === 7 // Steps that use AI
                  const aiProvider = step === 3 ? 'Perplexity' : step === 4 ? 'OpenAI' : step === 7 ? 'OpenAI' : null
                  
                  return (
                    <tr key={stepNum} className="border-b border-gray-700">
                      <td className="p-1 text-white">{stepNum}</td>
                      <td className="p-1">
                        <span className={`px-1 rounded text-xs ${
                          response.status >= 200 && response.status < 300 ? 'bg-green-600 text-white' :
                          response.status >= 400 ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                        }`}>
                          {response.status}
                        </span>
                      </td>
                      <td className="p-1">
                        {usesAI ? (
                          <span className="px-1 rounded text-xs bg-purple-600 text-white">
                            🤖 {aiProvider}
                          </span>
                        ) : (
                          <span className="px-1 rounded text-xs bg-gray-600 text-white">
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-1">
                        <span className={`px-1 rounded text-xs ${
                          response.dryRun ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
                        }`}>
                          {response.dryRun ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="p-1 font-mono text-xs max-w-xs truncate text-gray-300">
                        {response.json ? JSON.stringify(response.json).substring(0, 50) + '...' : 'No data'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation Buttons - Moved to stay at top */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          {step <= 8 && (
            <div className="text-sm text-white">
              <div className="font-bold">
                {step === 1 && "Step 1: Run Intake"}
                {step === 2 && "Step 2: Odds Snapshot"}
                {step === 3 && "Step 3: Factor Analysis"}
                {step === 4 && "Step 4: AI Predictions"}
                {step === 5 && "Step 5: Market Analysis"}
                {step === 6 && "Step 6: Pick Generation"}
                {step === 7 && "Step 7: Insight Card"}
                {step === 8 && "Step 8: Debug Report"}
              </div>
              <div className="text-xs text-gray-300 mt-1">
                {step === 1 && "Create run and validate game data"}
                {step === 2 && "Capture current odds snapshot"}
                {step === 3 && "Fetch and analyze confidence factors"}
                {step === 4 && "Generate AI-powered predictions"}
                {step === 5 && "Calculate market mismatch and adjustments"}
                {step === 6 && "Generate final pick with units"}
                {step === 7 && "Create insight card with factor breakdown"}
                {step === 8 && "Generate comprehensive debug report"}
              </div>
            </div>
          )}
        </div>
        <button 
          className={`px-3 py-1 border-2 border-gray-600 rounded font-semibold ${
            step >= 8 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
          onClick={async () => {
            if (step >= 8) return // Clamp at Step 8
            await handleStepClick(step)
            setStep(Math.min(8, step + 1))
          }}
          disabled={step >= 8}
          aria-disabled={step >= 8}
        >
          Next
        </button>
      </div>

      <div className="border rounded p-3 text-xs font-mono whitespace-pre-wrap bg-gray-900 text-white">
        {log ? JSON.stringify(log, null, 2) : 
         step === 8 ? 'Click Next to generate debug report with all step responses.' :
         'Click Next to start (Step 1 creates run).'}
      </div>
      
      {/* Debug info */}
      <div className="mt-2 text-xs text-gray-300 font-semibold">
        Current step: {step}, Step logs count: {Object.keys(stepLogs).length}
      </div>

      {/* Insight Card Button (Primary CTA after Step 7) */}
      {step >= 7 && hasInsight && (
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
              <InsightCard {...insightCardData} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


