/**
 * Game Time Validation Utility
 * Prevents cappers from making picks on games that have already started
 * or are starting too soon (within buffer time)
 */

export interface GameTimeValidation {
  isValid: boolean
  reason?: string
  minutesUntilStart?: number
  gameStartTime?: Date
}

/**
 * Validates if a game is eligible for pick creation
 * @param game - Game object with game_date, game_time, or game_start_timestamp
 * @param bufferMinutes - Minimum minutes before game start (default: 15)
 * @returns Validation result with reason if invalid
 */
export function validateGameTiming(
  game: any,
  bufferMinutes: number = 15
): GameTimeValidation {
  try {
    // Try to get game start time from multiple possible fields
    let gameStartTime: Date | null = null

    // Priority 1: Use game_start_timestamp if available (most accurate)
    if (game.game_start_timestamp) {
      gameStartTime = new Date(game.game_start_timestamp)
    }
    // Priority 2: Construct from game_date and game_time
    else if (game.game_date && game.game_time) {
      gameStartTime = new Date(`${game.game_date}T${game.game_time}`)
    }
    // Priority 3: Check game_snapshot (for picks with snapshot data)
    else if (game.game_snapshot?.game_date && game.game_snapshot?.game_time) {
      gameStartTime = new Date(`${game.game_snapshot.game_date}T${game.game_snapshot.game_time}`)
    }

    if (!gameStartTime || isNaN(gameStartTime.getTime())) {
      return {
        isValid: false,
        reason: 'Game start time not available or invalid'
      }
    }

    const now = new Date()
    const minutesUntilStart = (gameStartTime.getTime() - now.getTime()) / (1000 * 60)

    // Game has already started
    if (minutesUntilStart < 0) {
      return {
        isValid: false,
        reason: `Game already started ${Math.abs(Math.round(minutesUntilStart))} minutes ago`,
        minutesUntilStart,
        gameStartTime
      }
    }

    // Game is starting too soon (within buffer)
    if (minutesUntilStart < bufferMinutes) {
      return {
        isValid: false,
        reason: `Game starting in ${Math.round(minutesUntilStart)} minutes (< ${bufferMinutes} min buffer)`,
        minutesUntilStart,
        gameStartTime
      }
    }

    // Game is valid for pick creation
    return {
      isValid: true,
      minutesUntilStart,
      gameStartTime
    }

  } catch (error) {
    return {
      isValid: false,
      reason: `Error validating game time: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Filters an array of games to only include those eligible for picks
 * @param games - Array of game objects
 * @param bufferMinutes - Minimum minutes before game start
 * @returns Filtered array of valid games
 */
export function filterEligibleGames(
  games: any[],
  bufferMinutes: number = 15
): any[] {
  return games.filter(game => {
    const validation = validateGameTiming(game, bufferMinutes)
    return validation.isValid
  })
}

/**
 * Logs game timing validation for debugging
 * @param gameName - Name/description of the game
 * @param validation - Validation result
 * @param log - Log array to append to
 */
export function logGameValidation(
  gameName: string,
  validation: GameTimeValidation,
  log: string[]
): void {
  if (!validation.isValid) {
    log.push(`⏰ SKIP ${gameName}: ${validation.reason}`)
  } else if (validation.minutesUntilStart !== undefined) {
    const hours = Math.floor(validation.minutesUntilStart / 60)
    const mins = Math.round(validation.minutesUntilStart % 60)
    log.push(`✓ ${gameName}: Valid (starts in ${hours}h ${mins}m)`)
  }
}

