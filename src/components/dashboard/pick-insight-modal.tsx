"use client"
import { useEffect, useState } from 'react'
import { InsightCard, InsightCardProps, getRarityFromConfidence } from '@/app/cappers/shiva/management/components/insight-card'
import { X } from 'lucide-react'

interface PickInsightModalProps {
  pickId: string
  capper?: string  // Optional: route to correct API based on capper
  onClose: () => void
}

export function PickInsightModal({ pickId, capper, onClose }: PickInsightModalProps) {
  const [insightData, setInsightData] = useState<InsightCardProps | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInsightCard() {
      try {
        setLoading(true)
        setError(null)

        console.log('[PickInsightModal] Fetching insight card for pick:', pickId, 'capper:', capper)

        // Route to correct API based on capper
        const apiPath = capper?.toLowerCase() === 'picksmith'
          ? `/api/picksmith/insight-card/${pickId}`
          : `/api/shiva/insight-card/${pickId}`

        const response = await fetch(apiPath)

        if (!response.ok) {
          throw new Error(`Failed to fetch insight card: ${response.statusText}`)
        }

        const result = await response.json()

        if (!result.success || !result.data) {
          throw new Error('Invalid insight card data received')
        }

        console.log('[PickInsightModal] Insight card data received:', result.data)

        setInsightData(result.data)
      } catch (err) {
        console.error('[PickInsightModal] Error fetching insight card:', err)
        setError(err instanceof Error ? err.message : 'Failed to load insight card')
      } finally {
        setLoading(false)
      }
    }

    fetchInsightCard()
  }, [pickId, capper])

  // Get rarity for loading/error states (confidence is nested inside pick object)
  const rarity = getRarityFromConfidence(insightData?.pick?.confidence || 65)

  return (
    <>
      {/* Loading State - Diablo style */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="rounded-lg p-8 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(15,15,25,0.98) 0%, rgba(10,10,18,0.99) 100%)',
              border: '2px solid #3B82F6',
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
            }}
          >
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <p className="text-slate-300 font-semibold">Loading insight card...</p>
          </div>
        </div>
      )}

      {/* Error State - Diablo style */}
      {error && !loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="rounded-lg p-8 text-center max-w-md"
            style={{
              background: 'linear-gradient(135deg, rgba(25,15,15,0.98) 0%, rgba(18,10,10,0.99) 100%)',
              border: '2px solid #EF4444',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)'
            }}
          >
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-red-400 mb-2">Failed to Load</h3>
            <p className="text-slate-400 mb-4 text-sm">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Insight Card - The InsightCard component handles its own modal backdrop */}
      {insightData && !loading && !error && (
        <InsightCard {...insightData} onClose={onClose} />
      )}
    </>
  )
}

