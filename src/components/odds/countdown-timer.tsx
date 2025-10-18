'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertCircle } from 'lucide-react'

interface CountdownTimerProps {
  gameDate: string
  gameTime: string
}

export function CountdownTimer({ gameDate, gameTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const gameDateTime = new Date(`${gameDate}T${gameTime}`)
      const now = new Date()
      const diff = gameDateTime.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Game Started')
        setIsUrgent(false)
        return
      }

      // Check if within 3 hours (3 * 60 * 60 * 1000 ms)
      const threeHoursInMs = 3 * 60 * 60 * 1000
      setIsUrgent(diff <= threeHoursInMs)

      // Calculate time components
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`)
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [gameDate, gameTime])

  return (
    <div 
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm transition-all ${
        isUrgent 
          ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' 
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
      }`}
    >
      {isUrgent ? (
        <AlertCircle className="w-4 h-4" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      <span>{timeLeft}</span>
    </div>
  )
}

