/**
 * NBA Team Name Mappings
 * Maps between abbreviations and full team names for MySportsFeeds integration
 */

export interface TeamInfo {
  full: string
  abbrev: string
  city: string
}

export const NBA_TEAMS: Record<string, TeamInfo> = {
  'ATL': { full: 'Atlanta Hawks', abbrev: 'ATL', city: 'Atlanta' },
  'BOS': { full: 'Boston Celtics', abbrev: 'BOS', city: 'Boston' },
  'BKN': { full: 'Brooklyn Nets', abbrev: 'BKN', city: 'Brooklyn' },
  'CHA': { full: 'Charlotte Hornets', abbrev: 'CHA', city: 'Charlotte' },
  'CHI': { full: 'Chicago Bulls', abbrev: 'CHI', city: 'Chicago' },
  'CLE': { full: 'Cleveland Cavaliers', abbrev: 'CLE', city: 'Cleveland' },
  'DAL': { full: 'Dallas Mavericks', abbrev: 'DAL', city: 'Dallas' },
  'DEN': { full: 'Denver Nuggets', abbrev: 'DEN', city: 'Denver' },
  'DET': { full: 'Detroit Pistons', abbrev: 'DET', city: 'Detroit' },
  'GSW': { full: 'Golden State Warriors', abbrev: 'GSW', city: 'Golden State' },
  'GS': { full: 'Golden State Warriors', abbrev: 'GSW', city: 'Golden State' }, // Alternate
  'HOU': { full: 'Houston Rockets', abbrev: 'HOU', city: 'Houston' },
  'IND': { full: 'Indiana Pacers', abbrev: 'IND', city: 'Indiana' },
  'LAC': { full: 'Los Angeles Clippers', abbrev: 'LAC', city: 'Los Angeles' },
  'LAL': { full: 'Los Angeles Lakers', abbrev: 'LAL', city: 'Los Angeles' },
  'MEM': { full: 'Memphis Grizzlies', abbrev: 'MEM', city: 'Memphis' },
  'MIA': { full: 'Miami Heat', abbrev: 'MIA', city: 'Miami' },
  'MIL': { full: 'Milwaukee Bucks', abbrev: 'MIL', city: 'Milwaukee' },
  'MIN': { full: 'Minnesota Timberwolves', abbrev: 'MIN', city: 'Minnesota' },
  'NOP': { full: 'New Orleans Pelicans', abbrev: 'NOP', city: 'New Orleans' },
  'NO': { full: 'New Orleans Pelicans', abbrev: 'NOP', city: 'New Orleans' }, // Alternate
  'NYK': { full: 'New York Knicks', abbrev: 'NYK', city: 'New York' },
  'NY': { full: 'New York Knicks', abbrev: 'NYK', city: 'New York' }, // Alternate
  'OKC': { full: 'Oklahoma City Thunder', abbrev: 'OKC', city: 'Oklahoma City' },
  'ORL': { full: 'Orlando Magic', abbrev: 'ORL', city: 'Orlando' },
  'PHI': { full: 'Philadelphia 76ers', abbrev: 'PHI', city: 'Philadelphia' },
  'PHX': { full: 'Phoenix Suns', abbrev: 'PHX', city: 'Phoenix' },
  'POR': { full: 'Portland Trail Blazers', abbrev: 'POR', city: 'Portland' },
  'SAC': { full: 'Sacramento Kings', abbrev: 'SAC', city: 'Sacramento' },
  'SAS': { full: 'San Antonio Spurs', abbrev: 'SAS', city: 'San Antonio' },
  'SA': { full: 'San Antonio Spurs', abbrev: 'SAS', city: 'San Antonio' }, // Alternate
  'TOR': { full: 'Toronto Raptors', abbrev: 'TOR', city: 'Toronto' },
  'UTA': { full: 'Utah Jazz', abbrev: 'UTA', city: 'Utah' },
  'WAS': { full: 'Washington Wizards', abbrev: 'WAS', city: 'Washington' }
}

/**
 * Resolve team name from abbreviation or full name
 * Returns both full name and abbreviation
 */
export function resolveTeamName(input: string): TeamInfo {
  if (!input) {
    throw new Error('Team name input is required')
  }

  // Try abbreviation lookup (case-insensitive)
  const upper = input.toUpperCase().trim()
  if (NBA_TEAMS[upper]) {
    return NBA_TEAMS[upper]
  }
  
  // Try full name lookup (case-insensitive)
  const entry = Object.values(NBA_TEAMS).find(t => 
    t.full.toLowerCase() === input.toLowerCase().trim()
  )
  if (entry) {
    return entry
  }
  
  // Try partial match on city or team name
  const partialMatch = Object.values(NBA_TEAMS).find(t =>
    t.full.toLowerCase().includes(input.toLowerCase().trim()) ||
    t.city.toLowerCase().includes(input.toLowerCase().trim())
  )
  if (partialMatch) {
    return partialMatch
  }
  
  // If no match found, throw error instead of returning fallback
  throw new Error(`Unknown NBA team: "${input}". Please use a valid team abbreviation or full name.`)
}

/**
 * Get team abbreviation from any input format
 */
export function getTeamAbbrev(input: string): string {
  return resolveTeamName(input).abbrev
}

/**
 * Get full team name from any input format
 */
export function getTeamFullName(input: string): string {
  return resolveTeamName(input).full
}

/**
 * Validate if a team abbreviation exists
 */
export function isValidTeamAbbrev(abbrev: string): boolean {
  return NBA_TEAMS[abbrev.toUpperCase()] !== undefined
}

/**
 * Get all team abbreviations
 */
export function getAllTeamAbbrevs(): string[] {
  return Object.keys(NBA_TEAMS).filter(key => key.length === 3) // Filter out alternates
}

/**
 * Get all team full names
 */
export function getAllTeamNames(): string[] {
  const seen = new Set<string>()
  return Object.values(NBA_TEAMS)
    .filter(team => {
      if (seen.has(team.full)) return false
      seen.add(team.full)
      return true
    })
    .map(team => team.full)
}

