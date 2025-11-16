/**
 * Battle Timer Utility
 * 
 * Calculates countdown timers for different battle states
 */

export type BattleStatus = 
  | 'scheduled'
  | 'q1_pending'
  | 'q1_complete'
  | 'q2_pending'
  | 'q2_complete'
  | 'halftime'
  | 'q3_pending'
  | 'q3_complete'
  | 'q4_pending'
  | 'q4_complete'
  | 'final'
  | 'complete'

export interface TimerState {
  status: BattleStatus
  message: string
  countdown: number | null // seconds remaining
  countdownDisplay: string | null // formatted time (e.g., "2:45")
  isActive: boolean // true if game is in progress
  isPending: boolean // true if waiting for quarter to complete
}

/**
 * Calculate timer state for a battle
 */
export function calculateTimerState(
  status: BattleStatus,
  gameStartTime: string | null,
  q1EndTime: string | null,
  q2EndTime: string | null,
  halftimeEndTime: string | null,
  q3EndTime: string | null,
  q4EndTime: string | null
): TimerState {
  const now = new Date()

  switch (status) {
    case 'scheduled':
      if (!gameStartTime) {
        return {
          status,
          message: 'Game Scheduled',
          countdown: null,
          countdownDisplay: null,
          isActive: false,
          isPending: false
        }
      }

      const gameStart = new Date(gameStartTime)
      const secondsUntilStart = Math.max(0, Math.floor((gameStart.getTime() - now.getTime()) / 1000))

      return {
        status,
        message: 'Game Starts In',
        countdown: secondsUntilStart,
        countdownDisplay: formatTime(secondsUntilStart),
        isActive: false,
        isPending: false
      }

    case 'q1_pending':
      if (!q1EndTime) {
        return {
          status,
          message: 'Q1 In Progress',
          countdown: null,
          countdownDisplay: null,
          isActive: true,
          isPending: true
        }
      }

      const q1End = new Date(q1EndTime)
      const secondsUntilQ1 = Math.max(0, Math.floor((q1End.getTime() - now.getTime()) / 1000))

      return {
        status,
        message: 'Q1 Ends In',
        countdown: secondsUntilQ1,
        countdownDisplay: formatTime(secondsUntilQ1),
        isActive: true,
        isPending: true
      }

    case 'q1_complete':
      return {
        status,
        message: 'Q1 Complete - Simulating...',
        countdown: null,
        countdownDisplay: null,
        isActive: true,
        isPending: false
      }

    case 'q2_pending':
      if (!q2EndTime) {
        return {
          status,
          message: 'Q2 In Progress',
          countdown: null,
          countdownDisplay: null,
          isActive: true,
          isPending: true
        }
      }

      const q2End = new Date(q2EndTime)
      const secondsUntilQ2 = Math.max(0, Math.floor((q2End.getTime() - now.getTime()) / 1000))

      return {
        status,
        message: 'Q2 Ends In',
        countdown: secondsUntilQ2,
        countdownDisplay: formatTime(secondsUntilQ2),
        isActive: true,
        isPending: true
      }

    case 'q2_complete':
      return {
        status,
        message: 'Q2 Complete - Simulating...',
        countdown: null,
        countdownDisplay: null,
        isActive: true,
        isPending: false
      }

    case 'halftime':
      if (!halftimeEndTime) {
        return {
          status,
          message: 'Halftime',
          countdown: null,
          countdownDisplay: null,
          isActive: false,
          isPending: false
        }
      }

      const halftimeEnd = new Date(halftimeEndTime)
      const secondsUntilHalftime = Math.max(0, Math.floor((halftimeEnd.getTime() - now.getTime()) / 1000))

      return {
        status,
        message: 'Halftime - Q3 Starts In',
        countdown: secondsUntilHalftime,
        countdownDisplay: formatTime(secondsUntilHalftime),
        isActive: false,
        isPending: false
      }

    case 'q3_pending':
      if (!q3EndTime) {
        return {
          status,
          message: 'Q3 In Progress',
          countdown: null,
          countdownDisplay: null,
          isActive: true,
          isPending: true
        }
      }

      const q3End = new Date(q3EndTime)
      const secondsUntilQ3 = Math.max(0, Math.floor((q3End.getTime() - now.getTime()) / 1000))

      return {
        status,
        message: 'Q3 Ends In',
        countdown: secondsUntilQ3,
        countdownDisplay: formatTime(secondsUntilQ3),
        isActive: true,
        isPending: true
      }

    case 'q3_complete':
      return {
        status,
        message: 'Q3 Complete - Simulating...',
        countdown: null,
        countdownDisplay: null,
        isActive: true,
        isPending: false
      }

    case 'q4_pending':
      if (!q4EndTime) {
        return {
          status,
          message: 'Q4 In Progress',
          countdown: null,
          countdownDisplay: null,
          isActive: true,
          isPending: true
        }
      }

      const q4End = new Date(q4EndTime)
      const secondsUntilQ4 = Math.max(0, Math.floor((q4End.getTime() - now.getTime()) / 1000))

      return {
        status,
        message: 'Q4 Ends In',
        countdown: secondsUntilQ4,
        countdownDisplay: formatTime(secondsUntilQ4),
        isActive: true,
        isPending: true
      }

    case 'q4_complete':
      return {
        status,
        message: 'Q4 Complete - Final Blow!',
        countdown: null,
        countdownDisplay: null,
        isActive: true,
        isPending: false
      }

    case 'final':
      return {
        status,
        message: 'Game Final - Calculating Winner...',
        countdown: null,
        countdownDisplay: null,
        isActive: false,
        isPending: false
      }

    case 'complete':
      return {
        status,
        message: 'Battle Complete',
        countdown: null,
        countdownDisplay: null,
        isActive: false,
        isPending: false
      }

    default:
      return {
        status,
        message: 'Unknown Status',
        countdown: null,
        countdownDisplay: null,
        isActive: false,
        isPending: false
      }
  }
}

/**
 * Format seconds into MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '0:00'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: BattleStatus): string {
  switch (status) {
    case 'scheduled':
      return 'text-gray-400'
    case 'q1_pending':
    case 'q2_pending':
    case 'q3_pending':
    case 'q4_pending':
      return 'text-yellow-400'
    case 'q1_complete':
    case 'q2_complete':
    case 'q3_complete':
    case 'q4_complete':
      return 'text-green-400'
    case 'halftime':
      return 'text-blue-400'
    case 'final':
      return 'text-purple-400'
    case 'complete':
      return 'text-gray-500'
    default:
      return 'text-gray-400'
  }
}

/**
 * Get status emoji for UI
 */
export function getStatusEmoji(status: BattleStatus): string {
  switch (status) {
    case 'scheduled':
      return '⏰'
    case 'q1_pending':
    case 'q2_pending':
    case 'q3_pending':
    case 'q4_pending':
      return '⚔️'
    case 'q1_complete':
    case 'q2_complete':
    case 'q3_complete':
    case 'q4_complete':
      return '✨'
    case 'halftime':
      return '☕'
    case 'final':
      return '🏆'
    case 'complete':
      return '✅'
    default:
      return '❓'
  }
}

