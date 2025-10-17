import { Suspense } from 'react'
import { Dashboard } from '@/components/dashboard'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// Deep Pick - Data-driven sports predictions
// Updated for deployment - triggering Vercel build
export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<LoadingSpinner />}>
        <Dashboard />
      </Suspense>
    </main>
  )
}
