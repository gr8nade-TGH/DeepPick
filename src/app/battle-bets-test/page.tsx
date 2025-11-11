'use client'

import { useEffect } from 'react'

export default function BattleBetsTestPage() {
  useEffect(() => {
    // Redirect to the standalone battle-bets game
    window.location.href = '/battle-bets-game/index.html'
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-xl">Loading Battle Bets Game...</p>
      </div>
    </div>
  )
}

