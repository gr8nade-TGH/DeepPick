/**
 * Battle Timer Utility
 *
 * Calculates countdown timers for different battle states
 *
 * Status Flow:
 * SCHEDULED → Q1_IN_PROGRESS → Q1_BATTLE → Q2_IN_PROGRESS → Q2_BATTLE →
 * HALFTIME → Q3_IN_PROGRESS → Q3_BATTLE → Q4_IN_PROGRESS → Q4_BATTLE →
 * [OT1_IN_PROGRESS → OT1_BATTLE → ...] → GAME_OVER
 */

export type BattleStatus =
  // Pre-game
  | 'SCHEDULED'
  // Quarter 1
  | 'Q1_IN_PROGRESS'
  | 'Q1_BATTLE'
  // Quarter 2
  | 'Q2_IN_PROGRESS'
  | 'Q2_BATTLE'
  // Halftime
  | 'HALFTIME'
  // Quarter 3
  | 'Q3_IN_PROGRESS'
  | 'Q3_BATTLE'
  // Quarter 4
  | 'Q4_IN_PROGRESS'
  | 'Q4_BATTLE'
  // Overtime periods
  | 'OT1_IN_PROGRESS'
  | 'OT1_BATTLE'
  | 'OT2_IN_PROGRESS'
  | 'OT2_BATTLE'
  | 'OT3_IN_PROGRESS'
  | 'OT3_BATTLE'
  | 'OT4_IN_PROGRESS'
  | 'OT4_BATTLE'
  // Final
  | 'GAME_OVER'

export interface TimerState {
  status: BattleStatus
  message: string
  countdown: number | null // seconds remaining
  countdownDisplay: string | null // formatted time (e.g., "2:45")
  isActive: boolean // true if game is in progress
  isPending: boolean // true if waiting for quarter to complete
  isBattle: boolean // true when battle animation should play
}

/**
 * Helper to create timer state
 */
function createTimerState(
  status: BattleStatus,
  message: string,
  countdown: number | null,
  isActive: boolean,
  isPending: boolean,
  isBattle: boolean
): TimerState {
  return {
    status,
    message,
    countdown,
    countdownDisplay: countdown !== null ? formatTime(countdown) : null,
    isActive,
    isPending,
    isBattle
  }
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

  // Helper to calculate seconds until a target time
  const secondsUntil = (time: string | null): number | null => {
    if (!time) return null
    return Math.max(0, Math.floor((new Date(time).getTime() - now.getTime()) / 1000))
  }

  switch (status) {
    // Pre-game
    case 'SCHEDULED': {
      const seconds = secondsUntil(gameStartTime)
      return createTimerState(status, seconds !== null ? 'Game Starts In' : 'Game Scheduled', seconds, false, false, false)
    }

    // Quarter 1
    case 'Q1_IN_PROGRESS': {
      const seconds = secondsUntil(q1EndTime)
      return createTimerState(status, 'Q1 In Progress', seconds, true, true, false)
    }
    case 'Q1_BATTLE':
      return createTimerState(status, 'Q1 Battle', null, true, false, true)

    // Quarter 2
    case 'Q2_IN_PROGRESS': {
      const seconds = secondsUntil(q2EndTime)
      return createTimerState(status, 'Q2 In Progress', seconds, true, true, false)
    }
    case 'Q2_BATTLE':
      return createTimerState(status, 'Q2 Battle', null, true, false, true)

    // Halftime
    case 'HALFTIME': {
      const seconds = secondsUntil(halftimeEndTime)
      return createTimerState(status, seconds !== null ? 'Halftime - Q3 Starts In' : 'Halftime', seconds, false, false, false)
    }

    // Quarter 3
    case 'Q3_IN_PROGRESS': {
      const seconds = secondsUntil(q3EndTime)
      return createTimerState(status, 'Q3 In Progress', seconds, true, true, false)
    }
    case 'Q3_BATTLE':
      return createTimerState(status, 'Q3 Battle', null, true, false, true)

    // Quarter 4
    case 'Q4_IN_PROGRESS': {
      const seconds = secondsUntil(q4EndTime)
      return createTimerState(status, 'Q4 In Progress', seconds, true, true, false)
    }
    case 'Q4_BATTLE':
      return createTimerState(status, 'Q4 Battle', null, true, false, true)

    // Overtime periods (no countdown times tracked yet)
    case 'OT1_IN_PROGRESS':
      return createTimerState(status, 'OT1 In Progress', null, true, true, false)
    case 'OT1_BATTLE':
      return createTimerState(status, 'OT1 Battle', null, true, false, true)
    case 'OT2_IN_PROGRESS':
      return createTimerState(status, 'OT2 In Progress', null, true, true, false)
    case 'OT2_BATTLE':
      return createTimerState(status, 'OT2 Battle', null, true, false, true)
    case 'OT3_IN_PROGRESS':
      return createTimerState(status, 'OT3 In Progress', null, true, true, false)
    case 'OT3_BATTLE':
      return createTimerState(status, 'OT3 Battle', null, true, false, true)
    case 'OT4_IN_PROGRESS':
      return createTimerState(status, 'OT4 In Progress', null, true, true, false)
    case 'OT4_BATTLE':
      return createTimerState(status, 'OT4 Battle', null, true, false, true)

    // Game Over
    case 'GAME_OVER':
      return createTimerState(status, 'Game Over', null, false, false, false)

    default:
      return createTimerState(status, 'Unknown Status', null, false, false, false)
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
    case 'SCHEDULED':
      return 'text-gray-400'
    case 'Q1_IN_PROGRESS':
    case 'Q2_IN_PROGRESS':
    case 'Q3_IN_PROGRESS':
    case 'Q4_IN_PROGRESS':
    case 'OT1_IN_PROGRESS':
    case 'OT2_IN_PROGRESS':
    case 'OT3_IN_PROGRESS':
    case 'OT4_IN_PROGRESS':
      return 'text-yellow-400'
    case 'Q1_BATTLE':
    case 'Q2_BATTLE':
    case 'Q3_BATTLE':
    case 'Q4_BATTLE':
    case 'OT1_BATTLE':
    case 'OT2_BATTLE':
    case 'OT3_BATTLE':
    case 'OT4_BATTLE':
      return 'text-green-400'
    case 'HALFTIME':
      return 'text-blue-400'
    case 'GAME_OVER':
      return 'text-purple-400'
    default:
      return 'text-gray-400'
  }
}

/**
 * Get status emoji for UI
 */
export function getStatusEmoji(status: BattleStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return '⏰'
    case 'Q1_IN_PROGRESS':
    case 'Q2_IN_PROGRESS':
    case 'Q3_IN_PROGRESS':
    case 'Q4_IN_PROGRESS':
    case 'OT1_IN_PROGRESS':
    case 'OT2_IN_PROGRESS':
    case 'OT3_IN_PROGRESS':
    case 'OT4_IN_PROGRESS':
      return '⚔️'
    case 'Q1_BATTLE':
    case 'Q2_BATTLE':
    case 'Q3_BATTLE':
    case 'Q4_BATTLE':
    case 'OT1_BATTLE':
    case 'OT2_BATTLE':
    case 'OT3_BATTLE':
    case 'OT4_BATTLE':
      return '✨'
    case 'HALFTIME':
      return '⭐'
    case 'GAME_OVER':
      return '🏆'
    default:
      return '❓'
  }
}

/**
 * Get display text for status (what shows in the UI badge)
 */
export function getStatusDisplayText(status: BattleStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return 'SCHEDULED'
    case 'Q1_IN_PROGRESS':
      return 'Q1 IN-PROGRESS'
    case 'Q1_BATTLE':
      return 'Q1 BATTLE'
    case 'Q2_IN_PROGRESS':
      return 'Q2 IN-PROGRESS'
    case 'Q2_BATTLE':
      return 'Q2 BATTLE'
    case 'HALFTIME':
      return 'HALFTIME'
    case 'Q3_IN_PROGRESS':
      return 'Q3 IN-PROGRESS'
    case 'Q3_BATTLE':
      return 'Q3 BATTLE'
    case 'Q4_IN_PROGRESS':
      return 'Q4 IN-PROGRESS'
    case 'Q4_BATTLE':
      return 'Q4 BATTLE'
    case 'OT1_IN_PROGRESS':
      return 'OT1 IN-PROGRESS'
    case 'OT1_BATTLE':
      return 'OT1 BATTLE'
    case 'OT2_IN_PROGRESS':
      return 'OT2 IN-PROGRESS'
    case 'OT2_BATTLE':
      return 'OT2 BATTLE'
    case 'OT3_IN_PROGRESS':
      return 'OT3 IN-PROGRESS'
    case 'OT3_BATTLE':
      return 'OT3 BATTLE'
    case 'OT4_IN_PROGRESS':
      return 'OT4 IN-PROGRESS'
    case 'OT4_BATTLE':
      return 'OT4 BATTLE'
    case 'GAME_OVER':
      return 'GAME OVER'
    default:
      return status
  }
}

