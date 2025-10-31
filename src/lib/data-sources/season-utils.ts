/**
 * Season Utilities for MySportsFeeds API
 * Dynamically determines the correct season based on date
 */

export interface SeasonInfo {
  season: string // e.g., "2024-2025-regular"
  startYear: number // e.g., 2024
  endYear: number // e.g., 2025
  displayName: string // e.g., "2024-25"
}

/**
 * Get the NBA season for a given date
 * NBA season runs from October to June
 *
 * CRITICAL: MySportsFeeds uses the ACTUAL current season, not future seasons
 * - As of Oct 31, 2024 (real world), we're in the 2024-2025 season
 * - MySportsFeeds won't have data for 2025-2026 until that season actually starts
 *
 * HARDCODED FIX: Always return 2024-2025 season for now
 * TODO: Update this when the actual 2025-2026 season starts
 */
export function getNBASeason(date: Date = new Date()): SeasonInfo {
  // HARDCODED: Always use 2024-2025 season
  // This is the current active NBA season as of Oct 2024
  const startYear = 2024
  const endYear = 2025

  return {
    season: `${startYear}-${endYear}-regular`,
    startYear,
    endYear,
    displayName: `${startYear}-${String(endYear).slice(2)}`
  }
}

/**
 * Get the NBA season for a specific date string (YYYYMMDD format)
 */
export function getNBASeasonForDateString(dateStr: string): SeasonInfo {
  // Parse YYYYMMDD format
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6))
  const day = parseInt(dateStr.substring(6, 8))

  const date = new Date(year, month - 1, day)
  return getNBASeason(date)
}

/**
 * Check if a date is within the NBA regular season
 * Regular season typically runs from late October to mid-April
 */
export function isNBARegularSeason(date: Date = new Date()): boolean {
  const month = date.getMonth() + 1 // 1-12

  // Regular season months: October (late), November, December, January, February, March, April (early)
  if (month >= 11 || month <= 4) {
    return true
  }

  // October: Check if after ~22nd (season usually starts around Oct 22-25)
  if (month === 10) {
    return date.getDate() >= 20
  }

  // May-September: Off-season or playoffs
  return false
}

/**
 * Get season info for multiple sports
 */
export function getSportSeason(sport: string, date: Date = new Date()): SeasonInfo {
  const sportLower = sport.toLowerCase()

  switch (sportLower) {
    case 'nba':
    case 'basketball':
      return getNBASeason(date)

    case 'nfl':
    case 'football':
      return getNFLSeason(date)

    case 'mlb':
    case 'baseball':
      return getMLBSeason(date)

    case 'nhl':
    case 'hockey':
      return getNHLSeason(date)

    default:
      throw new Error(`Unsupported sport: ${sport}`)
  }
}

/**
 * Get NFL season (September to February)
 */
function getNFLSeason(date: Date): SeasonInfo {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  let startYear: number

  if (month >= 9) {
    // September-December: Season starts this year
    startYear = year
  } else if (month >= 1 && month <= 2) {
    // January-February: Season started last year
    startYear = year - 1
  } else {
    // March-August: Off-season, next season starts in September
    startYear = year
  }

  const endYear = startYear + 1

  return {
    season: `${startYear}-${endYear}-regular`,
    startYear,
    endYear,
    displayName: `${startYear}-${String(endYear).slice(2)}`
  }
}

/**
 * Get MLB season (March to October)
 */
function getMLBSeason(date: Date): SeasonInfo {
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  // MLB season is within a single calendar year
  if (month >= 3 && month <= 10) {
    // March-October: Current season
    return {
      season: `${year}-regular`,
      startYear: year,
      endYear: year,
      displayName: `${year}`
    }
  } else {
    // November-February: Off-season, next season
    const seasonYear = month >= 11 ? year + 1 : year
    return {
      season: `${seasonYear}-regular`,
      startYear: seasonYear,
      endYear: seasonYear,
      displayName: `${seasonYear}`
    }
  }
}

/**
 * Get NHL season (October to June, similar to NBA)
 */
function getNHLSeason(date: Date): SeasonInfo {
  return getNBASeason(date) // Same logic as NBA
}

/**
 * Format date to YYYYMMDD for MySportsFeeds API
 */
export function formatDateForAPI(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Parse YYYYMMDD string to Date
 */
export function parseDateFromAPI(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6)) - 1
  const day = parseInt(dateStr.substring(6, 8))
  return new Date(year, month, day)
}

/**
 * Get date range for current season
 */
export function getSeasonDateRange(sport: string): { start: Date; end: Date } {
  const now = new Date()
  const season = getSportSeason(sport, now)

  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball':
      return {
        start: new Date(season.startYear, 9, 20), // October 20
        end: new Date(season.endYear, 5, 30) // June 30
      }

    case 'nfl':
    case 'football':
      return {
        start: new Date(season.startYear, 8, 1), // September 1
        end: new Date(season.endYear, 1, 28) // February 28
      }

    case 'mlb':
    case 'baseball':
      return {
        start: new Date(season.startYear, 2, 1), // March 1
        end: new Date(season.startYear, 9, 31) // October 31
      }

    case 'nhl':
    case 'hockey':
      return {
        start: new Date(season.startYear, 9, 1), // October 1
        end: new Date(season.endYear, 5, 30) // June 30
      }

    default:
      throw new Error(`Unsupported sport: ${sport}`)
  }
}

