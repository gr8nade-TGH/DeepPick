'use client'

import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { DeepPicksDashboard } from './dashboard/deep-picks-dashboard'

export function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DeepPicksDashboard />
    </Suspense>
  )
}