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
  getSelection: (gameId: string, betType: 'spread' | 'total' | 'moneyline') => BetSelection | undefined
  isInSlip: (selectionId: string) => boolean
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
    // Check if already in slip - if so, remove it (toggle behavior)
    if (selections.find(s => s.id === selection.id)) {
      setSelections(selections.filter(s => s.id !== selection.id))
      toast({
        title: "Removed from Bet Slip",
        description: `${selection.team} ${selection.line}`,
        variant: "info",
      })
      return
    }

    // Check if conflicting selection exists (same game, same bet type but different side)
    // Auto-remove the conflicting selection and add the new one
    const conflictingSelection = selections.find(
      s => s.gameId === selection.gameId && s.betType === selection.betType
    )

    let newSelections = selections
    if (conflictingSelection) {
      // Remove the conflicting selection
      newSelections = selections.filter(s => s.id !== conflictingSelection.id)
    }

    setSelections([...newSelections, selection])

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

  const getSelection = (gameId: string, betType: 'spread' | 'total' | 'moneyline') => {
    return selections.find(s => s.gameId === gameId && s.betType === betType)
  }

  const isInSlip = (selectionId: string) => {
    return selections.some(s => s.id === selectionId)
  }

  return (
    <BettingSlipContext.Provider value={{ selections, addSelection, removeSelection, clearSelections, hasSelection, getSelection, isInSlip, picksPlacedCount, notifyPicksPlaced }}>
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

