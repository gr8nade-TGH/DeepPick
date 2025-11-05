'use client'

import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ProfessionalDashboard } from './dashboard/professional-dashboard'

export function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProfessionalDashboard />
    </Suspense>
  )
}