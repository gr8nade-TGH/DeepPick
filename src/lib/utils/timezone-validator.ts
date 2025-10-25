/**
 * Timezone and Game Start Validation
 * CRITICAL: Ensures picks are NEVER made after a game has started
 */

export interface GameTimeInfo {
  game_date: string // YYYY-MM-DD
  game_time: string // HH:MM:SS
  game_start_timestamp?: string // ISO string
}

export interface TimeValidationResult {
  isValid: boolean
  error?: string
  details: {
    currentTimeUTC: string
    gameStartUTC: string
    minutesUntilStart: number
    timezone: string
    hasStarted: boolean
    isTooSoon: boolean // < 5 minutes
  }
}

/**
 * Validate game timing to ensure pick can be made
 * @param gameInfo - Game date/time information
 * @param minMinutesBeforeStart - Minimum minutes before game start (default 5)
 */
export function validateGameTiming(
  gameInfo: GameTimeInfo,
  minMinutesBeforeStart: number = 5
): TimeValidationResult {
  try {
    const now = new Date()
    
    // Construct game start time
    let gameStartUTC: Date
    
    if (gameInfo.game_start_timestamp) {
      gameStartUTC = new Date(gameInfo.game_start_timestamp)
    } else if (gameInfo.game_date && gameInfo.game_time) {
      // Assume game_date and game_time are in UTC
      gameStartUTC = new Date(`${gameInfo.game_date}T${gameInfo.game_time}Z`)
    } else {
      return {
        isValid: false,
        error: 'Missing game date/time information',
        details: {
          currentTimeUTC: now.toISOString(),
          gameStartUTC: 'UNKNOWN',
          minutesUntilStart: 0,
          timezone: 'UTC',
          hasStarted: false,
          isTooSoon: false
        }
      }
    }
    
    // Check if date is valid
    if (isNaN(gameStartUTC.getTime())) {
      return {
        isValid: false,
        error: `Invalid game start time: ${gameInfo.game_date} ${gameInfo.game_time}`,
        details: {
          currentTimeUTC: now.toISOString(),
          gameStartUTC: 'INVALID',
          minutesUntilStart: 0,
          timezone: 'UTC',
          hasStarted: false,
          isTooSoon: false
        }
      }
    }
    
    // Calculate time difference
    const msUntilStart = gameStartUTC.getTime() - now.getTime()
    const minutesUntilStart = Math.floor(msUntilStart / (1000 * 60))
    
    // Check if game has started
    const hasStarted = msUntilStart <= 0
    if (hasStarted) {
      return {
        isValid: false,
        error: `Game has already started ${Math.abs(minutesUntilStart)} minutes ago`,
        details: {
          currentTimeUTC: now.toISOString(),
          gameStartUTC: gameStartUTC.toISOString(),
          minutesUntilStart,
          timezone: 'UTC',
          hasStarted: true,
          isTooSoon: false
        }
      }
    }
    
    // Check if game is too soon
    const isTooSoon = minutesUntilStart < minMinutesBeforeStart
    if (isTooSoon) {
      return {
        isValid: false,
        error: `Game starts in ${minutesUntilStart} minutes (minimum ${minMinutesBeforeStart} minutes required)`,
        details: {
          currentTimeUTC: now.toISOString(),
          gameStartUTC: gameStartUTC.toISOString(),
          minutesUntilStart,
          timezone: 'UTC',
          hasStarted: false,
          isTooSoon: true
        }
      }
    }
    
    // Game timing is valid
    return {
      isValid: true,
      details: {
        currentTimeUTC: now.toISOString(),
        gameStartUTC: gameStartUTC.toISOString(),
        minutesUntilStart,
        timezone: 'UTC',
        hasStarted: false,
        isTooSoon: false
      }
    }
    
  } catch (error) {
    return {
      isValid: false,
      error: `Unexpected error validating game timing: ${error}`,
      details: {
        currentTimeUTC: new Date().toISOString(),
        gameStartUTC: 'ERROR',
        minutesUntilStart: 0,
        timezone: 'UTC',
        hasStarted: false,
        isTooSoon: false
      }
    }
  }
}

/**
 * Format game time for display
 */
export function formatGameTime(gameInfo: GameTimeInfo): string {
  try {
    let gameStart: Date
    
    if (gameInfo.game_start_timestamp) {
      gameStart = new Date(gameInfo.game_start_timestamp)
    } else {
      gameStart = new Date(`${gameInfo.game_date}T${gameInfo.game_time}Z`)
    }
    
    return gameStart.toLocaleString('en-US', {
      timeZone: 'America/New_York', // ET
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  } catch {
    return 'Unknown'
  }
}
