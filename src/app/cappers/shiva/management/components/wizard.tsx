"use client"
import { useMemo, useState } from 'react'

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

  async function handleStepClick(current: number) {
    try {
      if (current === 1) {
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
      } else if (current === 8) {
        // Debug Report - collect all step responses
        console.log('Generating debug report for step 8, stepLogs:', stepLogs)
        const debugReport = {
          timestamp: new Date().toISOString(),
          runId,
          snapId,
          effectiveProfile: props.effectiveProfile || null, // Include the profile snapshot used
          environment: {
            SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
            SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
            SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
          },
          stepResponses: stepLogs,
          currentLog: log, // Include the current step's response
          summary: {
            totalSteps: Object.keys(stepLogs).length,
            successfulSteps: Object.values(stepLogs).filter((r: any) => r.status >= 200 && r.status < 300).length,
            errorSteps: Object.values(stepLogs).filter((r: any) => r.status >= 400).length,
            dryRunSteps: Object.values(stepLogs).filter((r: any) => r.dryRun === true).length,
          },
          debugInfo: {
            stepLogsKeys: Object.keys(stepLogs),
            stepLogsValues: Object.values(stepLogs),
            stepLogsEmpty: Object.keys(stepLogs).length === 0,
          }
        }
        console.log('Debug report generated:', debugReport)
        setLog({ status: 200, json: debugReport, dryRun: false })
        setStepLogs(prev => ({ ...prev, 8: debugReport }))
      }
    } catch (e) {
      setLog({ status: 0, json: { error: { message: (e as Error).message } } })
    }
  }
  return (
    <div>
      <DryRunBanner />
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-white text-lg">Pick Generator Wizard</div>
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

      {step === 8 && log?.json && (
        <div className="mt-3">
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
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
        <button className="px-3 py-1 border-2 border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 font-semibold" onClick={() => setStep(Math.max(1, step - 1))}>Back</button>
        <button className="px-3 py-1 border-2 border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 font-semibold" onClick={async () => { await handleStepClick(step); setStep(Math.min(8, step + 1)) }}>Next</button>
      </div>
    </div>
  )
}


