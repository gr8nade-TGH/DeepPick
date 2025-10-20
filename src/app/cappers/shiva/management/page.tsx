"use client"
import { useMemo } from 'react'
import { env } from '@/lib/env'
import { SHIVAManagementInbox } from './components/inbox'
import { SHIVAWizard } from './components/wizard'

export default function ShivaManagementPage() {
  const uiEnabled = (process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED || '').toLowerCase() === 'true'
  if (!uiEnabled) {
    return <div className="p-6">SHIVA v1 UI is disabled.</div>
  }
  return (
    <div className="p-4 grid grid-cols-12 gap-4">
      <div className="col-span-5 border rounded p-3">
        <SHIVAManagementInbox />
      </div>
      <div className="col-span-7 border rounded p-3">
        <SHIVAWizard />
      </div>
    </div>
  )
}


