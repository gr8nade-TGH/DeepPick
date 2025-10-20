"use client"
import { useMemo, useState } from 'react'

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
  return (
    <div>
      <DryRunBanner />
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Pick Generator Wizard</div>
        <div className="text-xs text-gray-500">Step {step} / 7</div>
      </div>
      <div className="border rounded p-3 text-sm text-gray-600">
        Wizard scaffolding ready. Implement step forms and API calls.
      </div>
      <div className="flex gap-2 mt-3">
        <button className="px-3 py-1 border rounded" onClick={() => setStep(Math.max(1, step - 1))}>Back</button>
        <button className="px-3 py-1 border rounded" onClick={() => setStep(Math.min(7, step + 1))}>Next</button>
      </div>
    </div>
  )
}


