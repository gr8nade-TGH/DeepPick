'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Pick {
  id: string
  game_id: string
  pick_type: string
  selection: string
  odds: number
  units: number
  confidence: string
  status: string
  is_system_pick: boolean
  created_at: string
  games?: {
    away_team: { name: string; abbreviation: string }
    home_team: { name: string; abbreviation: string }
    game_start_timestamp: string
  }
}

interface GlobalBettingSlipProps {
  capperId: string
  isCapper: boolean
}

export function GlobalBettingSlip({ capperId, isCapper }: GlobalBettingSlipProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'slip' | 'open'>('slip')
  const [isExpanded, setIsExpanded] = useState(false)
  const [openPicks, setOpenPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(false)

  // Don't show if not a capper
  if (!isCapper) return null

  useEffect(() => {
    if (activeTab === 'open') {
      fetchOpenPicks()
    }
  }, [activeTab])

  const fetchOpenPicks = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/picks?capper=${capperId}&status=pending`)
      const data = await response.json()
      if (data.success) {
        setOpenPicks(data.picks || [])
      }
    } catch (error) {
      console.error('Error fetching open picks:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatGameDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    return `${dateStr} ${timeStr}`
  }

  return (
    <>
      {/* Collapsed Tabs - Always visible at bottom right */}
      {!isExpanded && (
        <div className="fixed bottom-6 right-6 flex gap-2 z-50">
          <button
            onClick={() => {
              setActiveTab('slip')
              setIsExpanded(true)
            }}
            className="bg-slate-900 border border-slate-700 rounded-t-lg px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-lg"
          >
            BET SLIP
          </button>
          <button
            onClick={() => {
              setActiveTab('open')
              setIsExpanded(true)
            }}
            className="bg-slate-900 border border-slate-700 rounded-t-lg px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-lg"
          >
            OPEN BETS
          </button>
        </div>
      )}

      {/* Expanded Slip */}
      {isExpanded && (
        <div className="fixed bottom-0 right-6 w-[400px] bg-slate-900 border border-slate-700 rounded-t-lg shadow-2xl z-50 max-h-[80vh] flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('slip')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors relative ${
                activeTab === 'slip'
                  ? 'text-white bg-slate-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              BET SLIP
            </button>
            <button
              onClick={() => setActiveTab('open')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
                activeTab === 'open'
                  ? 'text-white bg-slate-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              OPEN BETS
              {openPicks.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-600 rounded-full">
                  {openPicks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'slip' && (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400 mb-4">Your bet slip is empty</p>
                <Button
                  onClick={() => router.push('/make-picks')}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  Make Picks
                </Button>
              </div>
            )}

            {activeTab === 'open' && (
              <div>
                {/* Battle Grid Button */}
                <div className="p-4 border-b border-slate-700">
                  <Button
                    onClick={() => router.push('/battle-grid')}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold gap-2"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    BATTLE GRID
                  </Button>
                </div>

                {/* Open Picks List */}
                {loading ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-sm">Loading picks...</p>
                  </div>
                ) : openPicks.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p className="text-sm">No open bets</p>
                    <p className="text-xs mt-2">Your active picks will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {openPicks.map((pick) => (
                      <div key={pick.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                        {/* Pick Type Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            pick.is_system_pick 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-green-600 text-white'
                          }`}>
                            {pick.is_system_pick ? 'GENERATED' : 'MANUAL'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {pick.units} units
                          </span>
                        </div>

                        {/* Game Info */}
                        {pick.games && (
                          <div className="text-sm text-white font-semibold mb-1">
                            {pick.games.away_team.abbreviation} @ {pick.games.home_team.abbreviation}
                          </div>
                        )}

                        {/* Pick Details */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white font-semibold">{pick.selection}</span>
                            <span className="text-xs text-slate-400 ml-2">
                              {pick.pick_type}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {pick.odds > 0 ? '+' : ''}{pick.odds}
                          </span>
                        </div>

                        {/* Game Time */}
                        {pick.games && (
                          <div className="text-xs text-slate-500 mt-2">
                            {formatGameDateTime(pick.games.game_start_timestamp)}
                          </div>
                        )}

                        {/* Confidence */}
                        {pick.confidence && (
                          <div className="text-xs text-slate-400 mt-1">
                            Confidence: {parseFloat(pick.confidence).toFixed(1)}/10
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

