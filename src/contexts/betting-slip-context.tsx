'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface BetSelection {
  id: string
  gameId: string
  team: string
  betType: 'spread' | 'total' | 'moneyline'
  line: string
  odds: number
  homeTeam: string
  awayTeam: string
  gameTime: string
}

interface BettingSlipContextType {
  selections: BetSelection[]
  addSelection: (selection: BetSelection) => void
  removeSelection: (id: string) => void
  clearSelections: () => void
  hasSelection: (gameId: string) => boolean
}

const BettingSlipContext = createContext<BettingSlipContextType | undefined>(undefined)

export function BettingSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([])

  const addSelection = (selection: BetSelection) => {
    // Check if already in slip
    if (selections.find(s => s.id === selection.id)) {
      alert('This selection is already in your bet slip!')
      return
    }

    // Check if conflicting selection exists (same game, different side)
    const conflictingSelection = selections.find(s => s.gameId === selection.gameId)
    if (conflictingSelection) {
      alert('You already have a selection for this game. Remove it first.')
      return
    }

    setSelections([...selections, selection])
  }

  const removeSelection = (id: string) => {
    setSelections(selections.filter(s => s.id !== id))
  }

  const clearSelections = () => {
    setSelections([])
  }

  const hasSelection = (gameId: string) => {
    return selections.some(s => s.gameId === gameId)
  }

  return (
    <BettingSlipContext.Provider value={{ selections, addSelection, removeSelection, clearSelections, hasSelection }}>
      {children}
    </BettingSlipContext.Provider>
  )
}

export function useBettingSlip() {
  const context = useContext(BettingSlipContext)
  if (context === undefined) {
    throw new Error('useBettingSlip must be used within a BettingSlipProvider')
  }
  return context
}

