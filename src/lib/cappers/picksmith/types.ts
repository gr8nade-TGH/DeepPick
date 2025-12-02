/**
 * PICKSMITH Types
 * 
 * Type definitions for the consensus meta-capper system.
 */

export interface EligibleCapper {
  id: string           // capper_id (lowercase)
  name: string         // display_name
  netUnits: number     // Overall NBA unit record (must be > 0 to be eligible)
  winRate: number      // Win rate percentage
  totalPicks: number   // Total picks made
}

export interface CapperPick {
  id: string              // Pick ID
  capperId: string        // Capper who made the pick
  capperName: string      // Display name
  gameId: string          // Game ID
  pickType: string        // 'total', 'spread', 'moneyline'
  selection: string       // e.g., 'OVER 225.5', 'LAL -4.5'
  units: number           // Units bet (1-5)
  confidence: number      // Confidence score
  side: string            // Normalized side: 'OVER', 'UNDER', or team abbreviation
  line?: number           // The spread/total line
  capperNetUnits: number  // Capper's overall unit record (for weighting)
}

export interface ConsensusGroup {
  gameId: string
  pickType: string        // 'total' or 'spread'
  side: string            // 'OVER', 'UNDER', or team abbrev
  line?: number           // The line (for display)
  agreeing: CapperPick[]  // Cappers agreeing on this side
  disagreeing: CapperPick[] // Cappers on opposite side
}

export interface ConflictAnalysis {
  hasConflict: boolean
  agreementCount: number
  disagreementCount: number
  canGeneratePick: boolean
  reason?: string
}

export interface PicksmithDecision {
  shouldGenerate: boolean
  reason: string
  consensus: ConsensusGroup
  calculatedUnits: number
  calculatedConfidence: number
  contributingCappers: {
    id: string
    name: string
    units: number
    netUnits: number
  }[]
}

export interface PicksmithResult {
  gameId: string
  pickType: string
  selection: string       // e.g., 'OVER 225.5', 'LAL -4.5'
  units: number
  confidence: number
  contributingCappers: string[]
  reasoning: string
}

export interface TeamData {
  name?: string
  abbreviation?: string
  city?: string
}

export interface GameConsensusOpportunity {
  gameId: string
  homeTeam: string        // Abbreviation (for selection formatting)
  awayTeam: string        // Abbreviation (for selection formatting)
  homeTeamFull: TeamData  // Full team data (for game_snapshot)
  awayTeamFull: TeamData  // Full team data (for game_snapshot)
  gameTime: string
  hoursUntilStart: number
  totals?: {
    over: ConsensusGroup | null
    under: ConsensusGroup | null
  }
  spread?: {
    home: ConsensusGroup | null
    away: ConsensusGroup | null
  }
}

