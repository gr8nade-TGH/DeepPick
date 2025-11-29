'use client'

import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { PickGrid } from '@/components/dashboard/pick-grid'

export default function PickGridPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Suspense fallback={<LoadingSpinner />}>
        <PickGrid />
      </Suspense>
    </main>
  )
}

