/**
 * DEEP Types
 * 
 * Type definitions for the DEEP consensus meta-capper system.
 * DEEP aggregates picks from multiple cappers and analyzes factor confluence.
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
  capperNetUnits: number  // Capper's overall unit record
  // NEW: Tier and factor data for DEEP analysis
  tierScore?: number      // Pick's tier score (0-10+)
  tier?: string           // Pick's tier: 'Legendary', 'Elite', 'Rare', 'Uncommon', 'Common'
  topFactors?: FactorContribution[]  // Top factors that drove this pick
}

export interface FactorContribution {
  key: string             // Factor key (e.g., 'pace_differential', 'rest_advantage')
  name: string            // Human-readable name
  normalizedValue: number // Contribution to the pick (-3 to +3 range typically)
  weight: number          // Factor weight used
}

export interface ConsensusGroup {
  gameId: string
  pickType: string        // 'total' or 'spread'
  side: string            // 'OVER', 'UNDER', or team abbrev
  line?: number           // The line (for display)
  agreeing: CapperPick[]  // Cappers agreeing on this side
  disagreeing: CapperPick[] // Cappers on opposite side
}

export interface FactorConfluence {
  factorKey: string
  factorName: string
  agreeingCappers: string[]     // Names of cappers whose top factor is this
  totalMentions: number         // How many cappers have this in top 3
  avgContribution: number       // Average contribution across agreeing cappers
  alignmentScore: number        // 0-1 score for how aligned cappers are on this factor
}

export interface CounterThesisAnalysis {
  disagreeingCapper: string
  tier: string
  tierScore: number
  topFactor: FactorContribution | null
  counterStrength: 'STRONG' | 'MODERATE' | 'WEAK'
  reason: string
}

export interface ConflictAnalysis {
  hasConflict: boolean
  agreementCount: number
  disagreementCount: number
  canGeneratePick: boolean
  reason?: string
}

export interface DeepDecision {
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
    tierScore?: number
    tier?: string
    topFactor?: string
  }[]
  // NEW: DEEP-specific analysis
  factorConfluence: FactorConfluence[]
  counterThesis: CounterThesisAnalysis | null
  tierWeightedScore: number     // Tier-weighted confidence
}

export interface DeepResult {
  gameId: string
  pickType: string
  selection: string       // e.g., 'OVER 225.5', 'LAL -4.5'
  units: number
  confidence: number
  contributingCappers: string[]
  reasoning: string
  // NEW: DEEP-specific data
  factorConfluence: FactorConfluence[]
  counterThesis: CounterThesisAnalysis | null
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

// Tier weight multipliers for DEEP consensus weighting
export const TIER_WEIGHTS: Record<string, number> = {
  'Legendary': 5,
  'Elite': 4,
  'Rare': 3,
  'Uncommon': 2,
  'Common': 1
}

export function getTierWeight(tier?: string): number {
  return TIER_WEIGHTS[tier || 'Common'] || 1
}

