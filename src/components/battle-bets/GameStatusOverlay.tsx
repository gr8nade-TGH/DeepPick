'use client'

import { useEffect, useState } from 'react'
import { 
  calculateTimerState, 
  getStatusColor, 
  getStatusEmoji,
  type BattleStatus 
} from '@/lib/battle-bets/BattleTimer'

interface GameStatusOverlayProps {
  status: BattleStatus
  gameStartTime: string | null
  q1EndTime: string | null
  q2EndTime: string | null
  halftimeEndTime: string | null
  q3EndTime: string | null
  q4EndTime: string | null
  winner?: string | null
  leftCapperName?: string
  rightCapperName?: string
}

export function GameStatusOverlay({
  status,
  gameStartTime,
  q1EndTime,
  q2EndTime,
  halftimeEndTime,
  q3EndTime,
  q4EndTime,
  winner,
  leftCapperName,
  rightCapperName
}: GameStatusOverlayProps) {
  const [timerState, setTimerState] = useState(() =>
    calculateTimerState(status, gameStartTime, q1EndTime, q2EndTime, halftimeEndTime, q3EndTime, q4EndTime)
  )

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newState = calculateTimerState(
        status,
        gameStartTime,
        q1EndTime,
        q2EndTime,
        halftimeEndTime,
        q3EndTime,
        q4EndTime
      )
      setTimerState(newState)
    }, 1000)

    return () => clearInterval(interval)
  }, [status, gameStartTime, q1EndTime, q2EndTime, halftimeEndTime, q3EndTime, q4EndTime])

  // Don't show overlay if game is in progress and not pending
  if (timerState.isActive && !timerState.isPending && status !== 'q1_complete' && status !== 'q2_complete' && status !== 'q3_complete' && status !== 'q4_complete') {
    return null
  }

  // Show overlay for: scheduled, pending quarters, quarter complete, halftime, final, complete
  const shouldShowOverlay = 
    status === 'scheduled' ||
    timerState.isPending ||
    status === 'q1_complete' ||
    status === 'q2_complete' ||
    status === 'q3_complete' ||
    status === 'q4_complete' ||
    status === 'halftime' ||
    status === 'final' ||
    status === 'complete'

  if (!shouldShowOverlay) {
    return null
  }

  const emoji = getStatusEmoji(status)
  const colorClass = getStatusColor(status)

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10 animate-fade-in">
      <div className="text-center px-6 py-8 max-w-md">
        {/* Emoji */}
        <div className="text-6xl mb-4 animate-pulse">
          {emoji}
        </div>

        {/* Status Message */}
        <h2 className={`text-3xl font-bold mb-2 ${colorClass}`}>
          {timerState.message}
        </h2>

        {/* Countdown Timer */}
        {timerState.countdownDisplay && (
          <div className="text-5xl font-mono font-bold text-white mb-4 animate-pulse">
            {timerState.countdownDisplay}
          </div>
        )}

        {/* Winner Announcement */}
        {status === 'complete' && winner && (
          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/50">
            <p className="text-yellow-400 text-sm mb-1">🏆 WINNER 🏆</p>
            <p className="text-white text-2xl font-bold">
              {winner === 'left' ? leftCapperName : rightCapperName}
            </p>
          </div>
        )}

        {/* Status-specific messages */}
        {status === 'scheduled' && (
          <p className="text-gray-400 text-sm mt-4">
            Battle will begin when the game starts
          </p>
        )}

        {status === 'q1_complete' && (
          <div className="mt-4">
            <p className="text-green-400 text-sm mb-2">Quarter 1 stats received!</p>
            <p className="text-gray-400 text-xs">Calculating damage...</p>
          </div>
        )}

        {status === 'q2_complete' && (
          <div className="mt-4">
            <p className="text-green-400 text-sm mb-2">Quarter 2 stats received!</p>
            <p className="text-gray-400 text-xs">Calculating damage...</p>
          </div>
        )}

        {status === 'halftime' && (
          <div className="mt-4">
            <p className="text-blue-400 text-sm mb-2">Halftime Break</p>
            <p className="text-gray-400 text-xs">Cappers regroup for the second half</p>
          </div>
        )}

        {status === 'q3_complete' && (
          <div className="mt-4">
            <p className="text-green-400 text-sm mb-2">Quarter 3 stats received!</p>
            <p className="text-gray-400 text-xs">Calculating damage...</p>
          </div>
        )}

        {status === 'q4_complete' && (
          <div className="mt-4">
            <p className="text-purple-400 text-sm mb-2">🔥 FINAL QUARTER COMPLETE! 🔥</p>
            <p className="text-gray-400 text-xs">Preparing final blow...</p>
          </div>
        )}

        {status === 'final' && (
          <div className="mt-4">
            <p className="text-purple-400 text-sm mb-2">Game has ended</p>
            <p className="text-gray-400 text-xs">Determining battle outcome...</p>
          </div>
        )}

        {/* Pulsing indicator for pending states */}
        {timerState.isPending && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping delay-75"></div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping delay-150"></div>
          </div>
        )}
      </div>
    </div>
  )
}

