/**
 * Defense Dots Calculation for Battle Bets
 * 
 * Formula: +3 units = 1 defense dot
 * Min: 1 dot (even if negative units)
 * Max: 10 dots per stat row
 * 
 * Defense dots are distributed across 5 stat rows:
 * - POINTS
 * - REB (Rebounds)
 * - AST (Assists)
 * - BLK (Blocks)
 * - 3PT (Three-pointers)
 */

export interface DefenseDotDistribution {
  points: number
  reb: number
  ast: number
  blk: number
  threes: number
  total: number
}

export interface CapperTeamRecord {
  teamId: string
  units: number
  wins: number
  losses: number
  pushes: number
}

/**
 * Calculate total defense dots for a capper based on their net units with a team
 * 
 * @param netUnits - Net units won/lost with this team (can be negative)
 * @returns Total defense dots (1-10)
 */
export function calculateTotalDefenseDots(netUnits: number): number {
  // Formula: net units / 3, rounded down
  const dots = Math.floor(netUnits / 3)
  
  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, dots))
}

/**
 * Distribute defense dots across 5 stat rows
 * 
 * Distribution strategy:
 * - POINTS gets the most (40% of total)
 * - REB and AST get equal amounts (20% each)
 * - BLK and 3PT get equal amounts (10% each)
 * 
 * @param totalDots - Total defense dots to distribute (1-10)
 * @returns Distribution across 5 stat rows
 */
export function distributeDefenseDots(totalDots: number): DefenseDotDistribution {
  // Ensure totalDots is within valid range
  const validTotal = Math.max(1, Math.min(10, totalDots))
  
  // Distribution percentages
  const pointsPercent = 0.4  // 40%
  const rebPercent = 0.2     // 20%
  const astPercent = 0.2     // 20%
  const blkPercent = 0.1     // 10%
  const threesPercent = 0.1  // 10%
  
  // Calculate dots per stat (rounded down)
  let points = Math.floor(validTotal * pointsPercent)
  let reb = Math.floor(validTotal * rebPercent)
  let ast = Math.floor(validTotal * astPercent)
  let blk = Math.floor(validTotal * blkPercent)
  let threes = Math.floor(validTotal * threesPercent)
  
  // Ensure each stat has at least 1 dot if total >= 5
  if (validTotal >= 5) {
    points = Math.max(1, points)
    reb = Math.max(1, reb)
    ast = Math.max(1, ast)
    blk = Math.max(1, blk)
    threes = Math.max(1, threes)
  }
  
  // Calculate remainder and distribute to POINTS (most important stat)
  const distributed = points + reb + ast + blk + threes
  const remainder = validTotal - distributed
  points += remainder
  
  return {
    points,
    reb,
    ast,
    blk,
    threes,
    total: validTotal
  }
}

/**
 * Get capper's defense dot distribution for a specific team
 * 
 * @param capperId - Capper ID (e.g., 'shiva', 'ifrit')
 * @param teamAbbr - Team abbreviation (e.g., 'LAL', 'MEM')
 * @param teamRecords - Array of capper's team records
 * @returns Defense dot distribution
 */
export function getCapperDefenseDots(
  capperId: string,
  teamAbbr: string,
  teamRecords: CapperTeamRecord[]
): DefenseDotDistribution {
  // Find team record
  const teamRecord = teamRecords.find(r => 
    r.teamId.toLowerCase() === teamAbbr.toLowerCase()
  )
  
  // If no record found, return minimum (1 dot in each stat)
  if (!teamRecord) {
    return distributeDefenseDots(5) // 5 dots = 1 per stat
  }
  
  // Calculate total dots based on net units
  const totalDots = calculateTotalDefenseDots(teamRecord.units)
  
  // Distribute across stats
  return distributeDefenseDots(totalDots)
}

/**
 * Calculate defense dots from database picks
 * 
 * @param picks - Array of picks for a capper with a specific team
 * @returns Total defense dots
 */
export function calculateDefenseDotsFromPicks(picks: Array<{ net_units: number | null }>): number {
  const netUnits = picks.reduce((sum, pick) => sum + (pick.net_units || 0), 0)
  return calculateTotalDefenseDots(netUnits)
}

/**
 * Example usage:
 * 
 * const netUnits = 24 // Capper has +24 units with LAL
 * const totalDots = calculateTotalDefenseDots(netUnits) // 8 dots
 * const distribution = distributeDefenseDots(totalDots)
 * 
 * Result:
 * {
 *   points: 4,  // 40% of 8 = 3.2 → 3, plus remainder
 *   reb: 2,     // 20% of 8 = 1.6 → 1
 *   ast: 2,     // 20% of 8 = 1.6 → 1
 *   blk: 1,     // 10% of 8 = 0.8 → 0
 *   threes: 1,  // 10% of 8 = 0.8 → 0
 *   total: 8
 * }
 */

