'use client'

import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { RealDashboard } from './dashboard/real-dashboard'

export function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RealDashboard />
    </Suspense>
  )
}