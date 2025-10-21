"use client"
import { useMemo, useState, useEffect } from 'react'
import { InsightCard } from './insight-card'

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

// Factor metadata for UI display
const FACTOR_METADATA: Record<string, { label: string; icon: string; description: string }> = {
  seasonNet: { label: 'Season Net Rating', icon: '📊', description: 'Team Net Rating differential' },
  recentNet: { label: 'Recent Form', icon: '📈', description: 'Last 10 games momentum' },
  matchupORtgDRtg: { label: 'Off/Def Mismatch', icon: '⚔️', description: 'Offensive vs defensive rating' },
  h2hPpg: { label: 'Head-to-Head', icon: '🤝', description: 'Season PPG vs opponent' },
  newsEdge: { label: 'News/Injury', icon: '📰', description: 'Injury/availability impact' },
  homeEdge: { label: 'Home Court', icon: '🏠', description: 'Home advantage adjustment' },
  threePoint: { label: '3-Point Edge', icon: '🎯', description: '3PA/3P% environment' },
}

// Helper functions
function isEnabledInProfile(factorKey: string, profile: any): boolean {
  if (!profile?.weights) return true
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
  return weightKey ? (profile.weights[weightKey] ?? 0) > 0 : true
}

function getWeightPct(factorKey: string, profile: any): number {
  if (!profile?.weights) return 0.1
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
  return weightKey ? (profile.weights[weightKey] ?? 0) : 0.1
}

function formatSpread(odds: any): number {
  if (!odds?.spread_line) return 0
  return Number(odds.spread_line)
}

function assembleInsightCard({ runCtx, step4, step5, step6, step3, snapshot }: any) {
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

  // Factors → row items (enabled only), sorted by |weighted contribution|
  const factorRows = (step3?.json?.factors ?? [])
    .filter((f: any) => isEnabledInProfile(f.key, runCtx?.effectiveProfile))
    .map((f: any) => {
      const weightPct = getWeightPct(f.key, runCtx?.effectiveProfile)
      const weighted = Number(f.normalized_value ?? 0) * weightPct
      const metadata = FACTOR_METADATA[f.key] || { label: f.name || f.key, icon: 'ℹ️', description: 'Factor' }
      
      // For delta factors, split symmetrically
      const awayContribution = weighted > 0 ? weighted : -weighted
      const homeContribution = weighted > 0 ? -weighted : weighted
      
      return {
        key: f.key,
        name: metadata.label,
        contributionAway: awayContribution,
        contributionHome: homeContribution,
        weight: weightPct,
        rationale: f.notes || metadata.description
      }
    })
    .sort((a: any, b: any) => {
      const absA = Math.abs(a.contributionHome - a.contributionAway)
      const absB = Math.abs(b.contributionHome - b.contributionAway)
      return absB - absA
    })

  return {
    matchup: `${g.away || 'Away'} @ ${g.home || 'Home'}`,
    homeTeam: g.home || 'Home',
    awayTeam: g.away || 'Away',
    capper: 'SHIVA',
    sport: 'NBA',
    pick: pick ? {
      type: pick.pick_type,
      selection: pick.selection,
      units: Number(pick.units ?? 0),
      confidence: Number(pick.confidence ?? confFinal),
      spread: pick.spread,
      total: pick.total
    } : { type: 'UNKNOWN', selection: 'N/A', units: 0, confidence: confFinal },
    predictedScore,
    factors: factorRows,
    marketMismatch: {
      conf7,
      confMarketAdj: confAdj,
      confFinal,
      dominant: step5?.json?.dominant || 'side',
      edgeSide: Number(step5?.json?.edge_side ?? 0),
      edgeTotal: Number(step5?.json?.edge_total ?? 0)
    },
    isDryRun: true
  }
}

export interface SHIVAWizardProps {
  effectiveProfile?: any
  selectedGame?: any
  mode?: 'dry-run' | 'write'
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
        const oddsData = props.selectedGame?.odds || (await import('@/../fixtures/shiva-v1/step2-odds-snapshot.json')).default.snapshot
        
        const r = await postJson('/api/shiva/odds/snapshot', {
          run_id: runId,
          snapshot: oddsData
        }, 'ui-demo-snap')
        if (r.json?.snapshot_id) setSnapId(r.json.snapshot_id)
        setLog(r)
        setStepLogs(prev => ({ ...prev, 2: r }))
      } else if (current === 3) {
        const fx = (await import('@/../fixtures/shiva-v1/step3-factors.json')).default
        const r = await postJson('/api/shiva/factors/step3', { ...fx, run_id: runId }, 'ui-demo-step3')
        setLog(r)
        setStepLogs(prev => ({ ...prev, 3: r }))
      } else if (current === 4) {
        const fx = (await import('@/../fixtures/shiva-v1/step4-prediction.json')).default
        const r = await postJson('/api/shiva/factors/step4', { ...fx, run_id: runId }, 'ui-demo-step4')
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
        const fx = (await import('@/../fixtures/shiva-v1/step6-pick.json')).default
        const r = await postJson('/api/shiva/pick/generate', { ...fx, run_id: runId }, 'ui-demo-step6')
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
          <h4 className="text-sm font-semibold mb-2 text-white">Step Responses:</h4>
          <div className="border border-gray-600 rounded p-2 text-xs bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-1 text-white">Step</th>
                  <th className="text-left p-1 text-white">Status</th>
                  <th className="text-left p-1 text-white">Dry Run</th>
                  <th className="text-left p-1 text-white">Response</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stepLogs).map(([stepNum, response]: [string, any]) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {step === 8 && log?.json && (
        <div className="mt-3">
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm font-bold"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(log.json, null, 2))
              alert('Debug report copied to clipboard!')
            }}
          >
            📋 Copy Debug Report
          </button>
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button 
          className="px-3 py-1 border-2 border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 font-semibold"
          onClick={() => setStep(Math.max(1, step - 1))}
        >
          Back
        </button>
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


