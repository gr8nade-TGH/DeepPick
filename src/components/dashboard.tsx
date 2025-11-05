'use client'

import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { NewMainDashboard } from './dashboard/new-main-dashboard'

export function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NewMainDashboard />
    </Suspense>
  )
}