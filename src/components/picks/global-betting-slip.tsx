'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBettingSlip } from '@/contexts/betting-slip-context'

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
  const { selections, removeSelection, clearSelections } = useBettingSlip()
  const [activeTab, setActiveTab] = useState<'slip' | 'open'>('slip')
  const [isExpanded, setIsExpanded] = useState(false)
  const [openPicks, setOpenPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(false)
  const [stakes, setStakes] = useState<{ [id: string]: number }>({})
  const [isPlacing, setIsPlacing] = useState(false)

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

  // Get stake for a selection (default 1 unit, max 5 units)
  const getStake = (id: string) => stakes[id] || 1

  const setStake = (id: string, value: number) => {
    // Enforce max 5 units and integer values
    const clampedValue = Math.max(1, Math.min(5, Math.round(value)))
    setStakes(prev => ({ ...prev, [id]: clampedValue }))
  }

  // Calculate potential winnings for a single bet
  const calculateWin = (odds: number, stake: number): number => {
    if (odds > 0) {
      return (odds / 100) * stake
    } else {
      return (100 / Math.abs(odds)) * stake
    }
  }

  // Place all bets in the slip
  const placeBets = async () => {
    setIsPlacing(true)
    try {
      const picks = selections.map(sel => {
        const stake = getStake(sel.id)
        return {
          game_id: sel.gameId,
          capper: capperId,
          pick_type: sel.betType,
          selection: sel.betType === 'spread' ? `${sel.team} ${sel.line}` : sel.line,
          odds: sel.odds,
          units: stake,
          is_system_pick: false,
          confidence: null,
          reasoning: 'Manual pick',
          algorithm_version: null
        }
      })

      const results = await Promise.all(
        picks.map(pick =>
          fetch('/api/place-pick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pick)
          }).then(r => r.json())
        )
      )

      const failed = results.filter(r => !r.success)
      if (failed.length > 0) {
        alert(`Failed to place ${failed.length} pick(s). Check console for details.`)
        console.error('Failed picks:', failed)
      } else {
        alert(`Successfully placed ${results.length} pick(s)!`)
        clearSelections()
        setStakes({})
        // Switch to open bets tab to see the placed picks
        setActiveTab('open')
        fetchOpenPicks()
      }
    } catch (error) {
      console.error('Error placing bets:', error)
      alert('Error placing bets. Please try again.')
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <>
      {/* Collapsed Tabs - Always visible at bottom right */}
      {!isExpanded && (
        <div className="fixed bottom-0 right-6 flex gap-0 z-50">
          <button
            onClick={() => {
              setActiveTab('slip')
              setIsExpanded(true)
            }}
            className="bg-gradient-to-t from-emerald-700 to-emerald-600 border-t border-l border-r border-emerald-500 rounded-t-lg px-4 py-3 text-sm font-bold text-white hover:from-emerald-600 hover:to-emerald-500 transition-all shadow-lg"
          >
            BET SLIP
          </button>
          <button
            onClick={() => {
              setActiveTab('open')
              setIsExpanded(true)
            }}
            className="bg-gradient-to-t from-blue-700 to-blue-600 border-t border-l border-r border-blue-500 rounded-t-lg px-4 py-3 text-sm font-bold text-white hover:from-blue-600 hover:to-blue-500 transition-all shadow-lg"
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
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors relative ${activeTab === 'slip'
                ? 'text-white bg-slate-800'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              BET SLIP
            </button>
            <button
              onClick={() => setActiveTab('open')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${activeTab === 'open'
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
              <div>
                {selections.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-400 mb-4">Your bet slip is empty</p>
                    <Button
                      onClick={() => router.push('/make-picks')}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    >
                      Make Picks
                    </Button>
                  </div>
                ) : (
                  <div>
                    {/* Selections */}
                    <div className="divide-y divide-slate-700">
                      {selections.map((selection) => {
                        const stake = getStake(selection.id)
                        const win = calculateWin(selection.odds, stake)

                        return (
                          <div key={selection.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white">
                                    {selection.team}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {selection.line} ({selection.odds > 0 ? '+' : ''}{selection.odds})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {selection.betType === 'spread' ? 'Point Spread' :
                                    selection.betType === 'total' ? 'Total' : 'Moneyline'}
                                </div>
                              </div>
                              <button
                                onClick={() => removeSelection(selection.id)}
                                className="text-slate-400 hover:text-white transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Stake and Win */}
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Risk (1-5 units)</label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="5"
                                  step="1"
                                  value={stake}
                                  onChange={(e) => setStake(selection.id, parseFloat(e.target.value) || 1)}
                                  className="bg-slate-800 border-slate-600 text-white text-right h-9"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Win</label>
                                <div className="bg-slate-800 border border-slate-600 rounded-md px-3 h-9 flex items-center justify-end text-white">
                                  {win.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Clear All */}
                    <div className="px-4 py-2 border-b border-slate-700">
                      <button
                        onClick={clearSelections}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Clear all selections
                      </button>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-800 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Total Bets:</span>
                        <span className="text-white font-semibold">{selections.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Total Stake:</span>
                        <span className="text-white font-semibold">
                          {selections.reduce((sum, sel) => sum + getStake(sel.id), 0).toFixed(0)} units
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Possible Winnings:</span>
                        <span className="text-white font-semibold">
                          {selections.reduce((sum, sel) => {
                            const stake = getStake(sel.id)
                            const win = calculateWin(sel.odds, stake)
                            return sum + win
                          }, 0).toFixed(2)} units
                        </span>
                      </div>
                    </div>

                    {/* Place Bets Button */}
                    <div className="p-4">
                      <Button
                        onClick={placeBets}
                        disabled={isPlacing || selections.length === 0}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-sm uppercase tracking-wide"
                      >
                        {isPlacing ? 'PLACING BETS...' : 'PLACE BETS'}
                      </Button>
                    </div>
                  </div>
                )}
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
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${pick.is_system_pick
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

