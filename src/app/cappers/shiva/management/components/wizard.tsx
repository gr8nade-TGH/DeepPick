"use client"
import { useMemo, useState } from 'react'
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

  async function handleStepClick(current: number) {
    try {
      if (current === 1) {
        // Snapshot effectiveProfile on first step
        if (props.effectiveProfile) {
          setEffectiveProfileSnapshot(props.effectiveProfile)
        }
        
        // Use selected game or fallback to demo game
        const gameData = props.selectedGame || {
          id: 'nba_2025_10_21_okc_hou',
          home_team: 'Oklahoma City Thunder',
          away_team: 'Houston Rockets',
          start_time: '2025-10-21T01:30:00Z',
        }
        
        const r = await postJson('/api/shiva/runs', {
          game_id: gameData.id || 'nba_2025_10_21_okc_hou',
          sport: 'NBA',
          capper: 'SHIVA',
          home_team: gameData.home_team || 'Oklahoma City Thunder',
          away_team: gameData.away_team || 'Houston Rockets',
          start_time_utc: gameData.start_time || '2025-10-21T01:30:00Z'
        }, 'ui-demo-run')
        if (r.json?.run_id) setRunId(r.json.run_id)
        setLog(r)
        setStepLogs(prev => ({ ...prev, 1: r }))
      } else if (current === 2) {
        const r = await postJson('/api/shiva/odds/snapshot', {
          run_id: runId,
          snapshot: (await import('@/../fixtures/shiva-v1/step2-odds-snapshot.json')).default.snapshot
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
        
        // Light up Insight pill when insight_card_id is present
        if (r.json?.insight_card_id) {
          setHasInsight(true)
          // Store insight card data for rendering (use card from response or fixture)
          if (r.json?.card) {
            setInsightCardData(r.json.card)
          } else {
            // Fallback to fixture card if API doesn't return it
            setInsightCardData(fx.card)
          }
        }
      } else if (current === 8) {
        // Debug Report - build flat structure (NO recursion)
        console.log('Generating debug report for step 8, stepLogs:', stepLogs)
        
        // Build flat steps array (only 1-7, exclude 8)
        const stepsArray = Object.entries(stepLogs)
          .filter(([stepNum]) => parseInt(stepNum) < 8) // Exclude step 8
          .map(([stepNum, response]: [string, any]) => ({
            step: parseInt(stepNum),
            status: response.status,
            dryRun: response.dryRun,
            latencyMs: response.latencyMs || 0,
            // Only include top-level response keys, no nested objects
            hasResponse: !!response.json,
          }))
        
        const debugReport = {
          timestamp: new Date().toISOString(),
          runId,
          snapId,
          effectiveProfile: effectiveProfileSnapshot || props.effectiveProfile || null, // Use snapshot
          environment: {
            SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
            SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
            SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
          },
          steps: stepsArray, // Flat array, no nested objects
          summary: {
            totalSteps: stepsArray.length,
            successfulSteps: stepsArray.filter((s) => s.status >= 200 && s.status < 300).length,
            errorSteps: stepsArray.filter((s) => s.status >= 400).length,
            dryRunSteps: stepsArray.filter((s) => s.dryRun === true).length,
          },
        }
        console.log('Debug report generated (flat):', debugReport)
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
              onClick={() => setShowInsightCard(true)}
              className="px-3 py-1 bg-green-700 text-white rounded-full text-xs font-bold hover:bg-green-600 border-2 border-green-500 animate-pulse"
              title="Open Insight Card"
            >
              👁️ Insight
            </button>
          )}
        </div>
        <div className="text-sm text-white font-bold">Step {step} / 8</div>
      </div>
      <div className="border rounded p-3 text-xs font-mono whitespace-pre-wrap bg-gray-900 text-white">
        {log ? JSON.stringify(log, null, 2) : 
         step === 8 ? 'Click Next to generate debug report with all step responses.' :
         'Click Next to start (Step 1 creates run).'}
      </div>
      
      {/* Debug info */}
      <div className="mt-2 text-xs text-gray-800 font-semibold">
        Current step: {step}, Step logs count: {Object.keys(stepLogs).length}
      </div>
      {/* Step Logs Table */}
      {Object.keys(stepLogs).length > 0 && (
        <div className="mt-3">
          <h4 className="text-sm font-semibold mb-2">Step Responses:</h4>
          <div className="border rounded p-2 text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-1">Step</th>
                  <th className="text-left p-1">Status</th>
                  <th className="text-left p-1">Dry Run</th>
                  <th className="text-left p-1">Response</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stepLogs).map(([stepNum, response]: [string, any]) => (
                  <tr key={stepNum} className="border-b">
                    <td className="p-1">{stepNum}</td>
                    <td className="p-1">
                      <span className={`px-1 rounded text-xs ${
                        response.status >= 200 && response.status < 300 ? 'bg-green-100 text-green-800' :
                        response.status >= 400 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {response.status}
                      </span>
                    </td>
                    <td className="p-1">
                      <span className={`px-1 rounded text-xs ${
                        response.dryRun ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {response.dryRun ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="p-1 font-mono text-xs max-w-xs truncate">
                      {response.json ? JSON.stringify(response.json).substring(0, 50) + '...' : 'No data'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insight Card Button (Primary CTA after Step 7) */}
      {step >= 7 && hasInsight && (
        <div className="mt-3 p-3 bg-green-900 border-2 border-green-600 rounded">
          <div className="flex items-center justify-between">
            <div className="text-white font-bold">
              ✅ Insight Card Ready ({insightCardData?.pick?.units || 0}u on {insightCardData?.pick?.selection || 'N/A'})
            </div>
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-500 border-2 border-green-400"
              onClick={() => setShowInsightCard(true)}
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


