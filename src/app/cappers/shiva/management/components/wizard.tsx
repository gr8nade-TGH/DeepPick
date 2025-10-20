"use client"
import { useMemo, useState } from 'react'

async function postJson(path: string, body: unknown, idempo: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempo },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, dryRun: res.headers.get('X-Dry-Run') === '1' }
}

function DryRunBanner() {
  const dryRun = (process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED || '').toLowerCase() !== 'true'
  if (!dryRun) return null
  return (
    <div className="mb-3 rounded bg-yellow-50 border border-yellow-200 p-2 text-sm">
      Dry-Run (no writes). Responses may include X-Dry-Run header.
    </div>
  )
}

export function SHIVAWizard() {
  const [step, setStep] = useState<number>(1)
  const [log, setLog] = useState<any>(null)
  const [runId, setRunId] = useState<string>('')
  const [snapId, setSnapId] = useState<string>('')
  const [stepLogs, setStepLogs] = useState<Record<number, any>>({})

  async function handleStepClick(current: number) {
    try {
      if (current === 1) {
        const r = await postJson('/api/shiva/runs', {
          game_id: 'nba_2025_10_21_okc_hou', sport: 'NBA', capper: 'SHIVA',
          home_team: 'Oklahoma City Thunder', away_team: 'Houston Rockets', start_time_utc: '2025-10-21T01:30:00Z'
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
        const debugReport = {
          timestamp: new Date().toISOString(),
          runId,
          snapId,
          environment: {
            SHIVA_V1_API_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED,
            SHIVA_V1_UI_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED,
            SHIVA_V1_WRITE_ENABLED: process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED,
          },
          stepResponses: stepLogs,
          summary: {
            totalSteps: Object.keys(stepLogs).length,
            successfulSteps: Object.values(stepLogs).filter((r: any) => r.status >= 200 && r.status < 300).length,
            errorSteps: Object.values(stepLogs).filter((r: any) => r.status >= 400).length,
            dryRunSteps: Object.values(stepLogs).filter((r: any) => r.dryRun === true).length,
          }
        }
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
        <div className="font-semibold">Pick Generator Wizard</div>
        <div className="text-xs text-gray-500">Step {step} / 8</div>
      </div>
      <div className="border rounded p-3 text-xs font-mono whitespace-pre-wrap">
        {log ? JSON.stringify(log, null, 2) : 
         step === 8 ? 'Click Next to generate debug report with all step responses.' :
         'Click Next to start (Step 1 creates run).'}
      </div>
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
        <button className="px-3 py-1 border rounded" onClick={() => setStep(Math.max(1, step - 1))}>Back</button>
        <button className="px-3 py-1 border rounded" onClick={async () => { await handleStepClick(step); setStep(Math.min(8, step + 1)) }}>Next</button>
      </div>
    </div>
  )
}


