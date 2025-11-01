"use client"
import { useEffect, useState } from 'react'
import { InsightCard, InsightCardProps } from '@/app/cappers/shiva/management/components/insight-card'
import { X } from 'lucide-react'

interface PickInsightModalProps {
  pickId: string
  onClose: () => void
}

export function PickInsightModal({ pickId, onClose }: PickInsightModalProps) {
  const [insightData, setInsightData] = useState<InsightCardProps | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInsightCard() {
      try {
        setLoading(true)
        setError(null)
        
        console.log('[PickInsightModal] Fetching insight card for pick:', pickId)
        
        const response = await fetch(`/api/shiva/insight-card/${pickId}`)
        
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
  }, [pickId])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors shadow-lg"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <p className="text-gray-600 font-semibold">Loading insight card...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-12 text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Failed to Load Insight Card</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Insight Card */}
        {insightData && !loading && !error && (
          <div className="mt-16">
            <InsightCard {...insightData} onClose={onClose} />
          </div>
        )}
      </div>
    </div>
  )
}

