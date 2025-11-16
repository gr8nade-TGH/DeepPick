'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BattleCard } from '@/components/battle-bets/BattleCard'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

interface Battle {
  id: string
  status: string
  left_capper_id: string
  right_capper_id: string
  left_team: string
  right_team: string
  left_hp: number
  right_hp: number
  game?: any
  left_capper?: any
  right_capper?: any
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function CapperBattleGridPage() {
  const params = useParams()
  const router = useRouter()
  const capperId = params.capperId as string

  const [battles, setBattles] = useState<Battle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 4,
    total: 0,
    totalPages: 0
  })
  const [capperName, setCapperName] = useState<string>('')

  // Fetch battles
  const fetchBattles = async (page: number = 1) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/battle-bets/capper/${capperId}?page=${page}&limit=4`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch battles')
      }

      setBattles(data.battles || [])
      setPagination(data.pagination)

      // Get capper name from first battle
      if (data.battles && data.battles.length > 0) {
        const battle = data.battles[0]
        const isLeftCapper = battle.left_capper_id === capperId
        const capperData = isLeftCapper ? battle.left_capper : battle.right_capper
        setCapperName(capperData?.displayName || capperId.toUpperCase())
      }
    } catch (err) {
      console.error('Error fetching battles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load battles')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchBattles(1)
  }, [capperId])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBattles(pagination.page)
    }, 30000)

    return () => clearInterval(interval)
  }, [pagination.page, capperId])

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      fetchBattles(pagination.page - 1)
    }
  }

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      fetchBattles(pagination.page + 1)
    }
  }

  if (loading && battles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            <p className="mt-4 text-gray-400">Loading battles...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <p className="text-red-400 text-lg">{error}</p>
            <Button
              onClick={() => fetchBattles(pagination.page)}
              className="mt-4 bg-purple-600 hover:bg-purple-700"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {capperName}'s Battle Grid
              </h1>
              <p className="text-gray-400">
                {pagination.total} {pagination.total === 1 ? 'battle' : 'battles'} found
              </p>
            </div>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-4">
              <Button
                onClick={handlePrevPage}
                disabled={pagination.page === 1}
                variant="outline"
                className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                onClick={handleNextPage}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
                className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Battle Grid */}
      {battles.length === 0 ? (
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-gray-400 text-lg">No battles found for this capper</p>
          <p className="text-gray-500 text-sm mt-2">
            Battles will appear here when this capper has opposing SPREAD picks
          </p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {battles.map((battle) => (
            <BattleCard key={battle.id} battle={battle} />
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto mt-6 text-center text-gray-400 text-sm">
        <p>Battles update automatically every 30 seconds</p>
        <p className="mt-1">Quarter stats sync every 10 minutes via MySportsFeeds</p>
      </div>
    </div>
  )
}

