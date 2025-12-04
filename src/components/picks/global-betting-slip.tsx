'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBettingSlip } from '@/contexts/betting-slip-context'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'
import { getRarityTierFromConfidence, getRarityStyleFromTier, type RarityTier } from '@/lib/tier-grading'

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
  capper?: string
  games?: {
    away_team: { name: string; abbreviation: string }
    home_team: { name: string; abbreviation: string }
    game_start_timestamp: string
  }
  game_snapshot?: {
    tier_grade?: {
      tier?: string
      tierScore?: number
    }
  }
  insight_card_snapshot?: {
    metadata?: {
      is_manual_pick?: boolean
    }
  }
}

interface GlobalBettingSlipProps {
  capperId: string
  isCapper: boolean
}

// Get tier from stored tier_grade or fallback to confidence calculation
const getTierFromPick = (pick: Pick): RarityTier => {
  if (pick.game_snapshot?.tier_grade?.tier) {
    return pick.game_snapshot.tier_grade.tier as RarityTier
  }
  const confidence = parseFloat(pick.confidence) || 50
  return getRarityTierFromConfidence(confidence)
}

export function GlobalBettingSlip({ capperId, isCapper }: GlobalBettingSlipProps) {
  const router = useRouter()
  const { selections, removeSelection, clearSelections, notifyPicksPlaced } = useBettingSlip()
  const [activeTab, setActiveTab] = useState<'slip' | 'open'>('slip')
  const [isExpanded, setIsExpanded] = useState(false)
  const [openPicks, setOpenPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(false)
  const [stakes, setStakes] = useState<{ [id: string]: number }>({})
  const [isPlacing, setIsPlacing] = useState(false)
  const [prevSelectionCount, setPrevSelectionCount] = useState(0)
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
  const [selectedCapper, setSelectedCapper] = useState<string | undefined>(undefined)

  // Don't show if not a capper
  if (!isCapper) return null

  // Auto-expand when selections are added
  useEffect(() => {
    if (selections.length > prevSelectionCount && selections.length > 0) {
      setIsExpanded(true)
      setActiveTab('slip')
    }
    setPrevSelectionCount(selections.length)
  }, [selections.length])

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
        // Notify that picks were placed so make-picks page can refresh
        notifyPicksPlaced()
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
            className="bg-gradient-to-t from-emerald-700 to-emerald-600 border-t border-l border-r border-emerald-500 rounded-t-lg px-4 py-3 text-sm font-bold text-white hover:from-emerald-600 hover:to-emerald-500 transition-all shadow-lg relative"
          >
            BET SLIP
            {selections.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                {selections.length}
              </span>
            )}
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
                {/* Active Battles Button */}
                <div className="p-4 border-b border-slate-700">
                  <Button
                    onClick={() => router.push('/battle-arena-v2/index.html')}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold gap-2"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    ACTIVE BATTLES
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
                    {openPicks.map((pick) => {
                      // Detect truly manual picks via metadata flag
                      const isManualPick = pick.insight_card_snapshot?.metadata?.is_manual_pick === true
                      // Get tier styling
                      const tier = getTierFromPick(pick)
                      const rarity = getRarityStyleFromTier(tier)
                      const tierScore = pick.game_snapshot?.tier_grade?.tierScore || parseFloat(pick.confidence) || 0

                      return (
                        <div
                          key={pick.id}
                          className="p-4 hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setSelectedPickId(pick.id)
                            setSelectedCapper(pick.capper)
                          }}
                        >
                          <div className="flex gap-3">
                            {/* Rarity Square - smaller like pick history grid */}
                            <div
                              className="w-7 h-7 rounded flex-shrink-0 relative transition-transform group-hover:scale-110"
                              style={{
                                background: `linear-gradient(135deg, rgba(34, 211, 238, 0.85), rgba(6, 182, 212, 0.85))`,
                                border: `2px solid ${rarity.borderColor}`,
                                boxShadow: `0 0 8px ${rarity.glowColor}, 0 0 12px rgba(34, 211, 238, 0.3)`
                              }}
                            >
                              {/* Source indicator dot */}
                              <span
                                className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isManualPick ? 'bg-green-400' : 'bg-purple-400'}`}
                                style={{ boxShadow: isManualPick ? '0 0 3px rgba(74,222,128,0.8)' : '0 0 3px rgba(192,132,252,0.8)' }}
                              />
                            </div>

                            {/* Pick Details */}
                            <div className="flex-1 min-w-0">
                              {/* Top row: Tier badge + units */}
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{
                                    background: `${rarity.borderColor}30`,
                                    color: rarity.textColor.replace('text-', '').includes('-')
                                      ? undefined
                                      : rarity.borderColor,
                                    borderLeft: `2px solid ${rarity.borderColor}`
                                  }}
                                >
                                  {rarity.icon} {tier.toUpperCase()}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {pick.units}u
                                </span>
                              </div>

                              {/* Game matchup */}
                              {pick.games && (
                                <div className="text-xs text-slate-300 mb-0.5">
                                  {pick.games.away_team.abbreviation} @ {pick.games.home_team.abbreviation}
                                </div>
                              )}

                              {/* Selection */}
                              <div className="text-sm text-white font-semibold truncate">
                                {pick.selection}
                              </div>

                              {/* Game time */}
                              {pick.games && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {formatGameDateTime(pick.games.game_start_timestamp)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pick Insight Modal */}
      {selectedPickId && (
        <PickInsightModal
          pickId={selectedPickId}
          capper={selectedCapper}
          onClose={() => {
            setSelectedPickId(null)
            setSelectedCapper(undefined)
          }}
        />
      )}
    </>
  )
}

