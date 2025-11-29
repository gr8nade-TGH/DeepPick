'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { toast } from '@/hooks/use-toast'

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
  picksPlacedCount: number  // Increments when picks are placed - triggers refetch
  notifyPicksPlaced: () => void  // Called after successful pick placement
}

const BettingSlipContext = createContext<BettingSlipContextType | undefined>(undefined)

export function BettingSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([])
  const [picksPlacedCount, setPicksPlacedCount] = useState(0)

  const notifyPicksPlaced = () => {
    setPicksPlacedCount(prev => prev + 1)
  }

  const addSelection = (selection: BetSelection) => {
    // Check if already in slip
    if (selections.find(s => s.id === selection.id)) {
      toast({
        title: "Already in Bet Slip",
        description: "This selection is already in your bet slip!",
        variant: "warning",
      })
      return
    }

    // Check if conflicting selection exists (same game, different side)
    const conflictingSelection = selections.find(s => s.gameId === selection.gameId)
    if (conflictingSelection) {
      toast({
        title: "Conflicting Selection",
        description: "You already have a selection for this game. Remove it first.",
        variant: "warning",
      })
      return
    }

    setSelections([...selections, selection])

    // Show success toast
    toast({
      title: "✅ Added to Bet Slip",
      description: `${selection.team} ${selection.line}`,
      variant: "success",
    })
  }

  const removeSelection = (id: string) => {
    const removed = selections.find(s => s.id === id)
    setSelections(selections.filter(s => s.id !== id))

    if (removed) {
      toast({
        title: "Removed from Bet Slip",
        description: `${removed.team} ${removed.line}`,
        variant: "info",
      })
    }
  }

  const clearSelections = () => {
    const count = selections.length
    setSelections([])

    if (count > 0) {
      toast({
        title: "Bet Slip Cleared",
        description: `Removed ${count} selection${count > 1 ? 's' : ''}`,
        variant: "info",
      })
    }
  }

  const hasSelection = (gameId: string) => {
    return selections.some(s => s.gameId === gameId)
  }

  return (
    <BettingSlipContext.Provider value={{ selections, addSelection, removeSelection, clearSelections, hasSelection, picksPlacedCount, notifyPicksPlaced }}>
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

