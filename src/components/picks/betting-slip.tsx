'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface BetSelection {
  id: string
  gameId: string
  team: string
  betType: 'spread' | 'total' | 'moneyline'
  line: string // e.g., "-4.5", "O 229.5", "ML"
  odds: number
  homeTeam: string
  awayTeam: string
  gameTime: string
}

interface BettingSlipProps {
  selections: BetSelection[]
  onRemove: (id: string) => void
  onClear: () => void
  onPlaceBets: (stakes: { [id: string]: number }) => Promise<void>
  capperId: string
}

export function BettingSlip({ selections, onRemove, onClear, onPlaceBets, capperId }: BettingSlipProps) {
  const [activeTab, setActiveTab] = useState<'slip' | 'open'>('slip')
  const [stakes, setStakes] = useState<{ [id: string]: number }>({})
  const [isPlacing, setIsPlacing] = useState(false)

  // Initialize stakes with default 1.0 units
  const getStake = (id: string) => stakes[id] || 1.0

  const setStake = (id: string, value: number) => {
    setStakes(prev => ({ ...prev, [id]: value }))
  }

  // Calculate potential winnings for a single bet
  const calculateWin = (odds: number, stake: number): number => {
    if (odds > 0) {
      // Positive odds: (odds / 100) * stake
      return (odds / 100) * stake
    } else {
      // Negative odds: (100 / abs(odds)) * stake
      return (100 / Math.abs(odds)) * stake
    }
  }

  // Calculate totals
  const totalStake = selections.reduce((sum, sel) => sum + getStake(sel.id), 0)
  const totalWinnings = selections.reduce((sum, sel) => {
    const stake = getStake(sel.id)
    const win = calculateWin(sel.odds, stake)
    return sum + win
  }, 0)

  const handlePlaceBets = async () => {
    setIsPlacing(true)
    try {
      await onPlaceBets(stakes)
    } finally {
      setIsPlacing(false)
    }
  }

  return (
    <div className="fixed right-6 top-24 w-[400px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50">
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
          {selections.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-600 rounded-full">
              {selections.length}
            </span>
          )}
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
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[600px] overflow-y-auto">
        {activeTab === 'slip' && (
          <div>
            {selections.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-sm">Your bet slip is empty</p>
                <p className="text-xs mt-2">Click on odds to add selections</p>
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
                            onClick={() => onRemove(selection.id)}
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Stake and Win */}
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Risk</label>
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={stake}
                              onChange={(e) => setStake(selection.id, parseFloat(e.target.value) || 0)}
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

                        {/* Cash Out Available */}
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                          <span>Cash Out</span>
                          <span className="text-white">available</span>
                          <span className="text-slate-500">ⓘ</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Clear All */}
                <div className="px-4 py-2 border-b border-slate-700">
                  <button
                    onClick={onClear}
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
                    <span className="text-white font-semibold">{totalStake.toFixed(2)} units</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Possible Winnings:</span>
                    <span className="text-white font-semibold">{totalWinnings.toFixed(2)} units</span>
                  </div>
                </div>

                {/* Place Bets Button */}
                <div className="p-4">
                  <Button
                    onClick={handlePlaceBets}
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
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm">No open bets</p>
            <p className="text-xs mt-2">Your active bets will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

