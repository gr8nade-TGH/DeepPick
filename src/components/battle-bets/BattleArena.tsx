'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { BattleCard } from './BattleCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Battle {
  id: string
  game_id: string
  left_capper_id: string
  right_capper_id: string
  left_team: string
  right_team: string
  spread: number
  status: string
  current_quarter: number
  left_hp: number
  right_hp: number
  left_score: number
  right_score: number
  game: any
  left_capper: any
  right_capper: any
}

interface BattleArenaProps {
  initialPage?: number
}

export function BattleArena({ initialPage = 1 }: BattleArenaProps) {
  const { user } = useAuth()
  const [battles, setBattles] = useState<Battle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Fetch ALL active battles (not filtered by user)
  useEffect(() => {
    async function fetchBattles() {
      try {
        setLoading(true)
        setError(null)

        // Fetch ALL active battles (no capperId filter)
        const response = await fetch(`/api/battle-bets/active?page=${page}&limit=4`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch battles')
        }

        setBattles(data.battles || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)
      } catch (err) {
        console.error('[Battle Arena] Error fetching battles:', err)
        setError(err instanceof Error ? err.message : 'Failed to load battles')
      } finally {
        setLoading(false)
      }
    }

    fetchBattles()
  }, [page])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Silently refresh without showing loading state
      fetch(`/api/battle-bets/active?page=${page}&limit=4`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setBattles(data.battles || [])
            setTotalPages(data.pagination?.totalPages || 1)
            setTotal(data.pagination?.total || 0)
          }
        })
        .catch(err => console.error('[Battle Arena] Auto-refresh error:', err))
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [page])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Battle Arena...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">⚠️ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (battles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <p className="text-white text-xl mb-2">⚔️ No Active Battles</p>
          <p className="text-gray-400">Battles will appear here when cappers make opposing picks</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">⚔️ My Battle Arena</h1>
            <p className="text-gray-300">
              {total === 0 ? 'No active battles' : `${total} Active ${total === 1 ? 'Battle' : 'Battles'}`}
              {totalPages > 1 && ` • Page ${page} of ${totalPages}`}
            </p>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white px-4">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Battle Grid (Vertical Stack - 4 battles) */}
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {battles.map((battle) => (
          <BattleCard key={battle.id} battle={battle} />
        ))}
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto mt-6 text-center text-gray-400 text-sm">
        <p>Battles update automatically every 30 seconds</p>
        <p className="mt-1">Quarter stats sync every 10 minutes via MySportsFeeds</p>
      </div>
    </div>
  )
}

