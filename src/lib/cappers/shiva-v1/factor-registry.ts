/**
 * SHIVA v1 Factor Registry
 * Pluggable factor system for extensibility
 */

import type { CapperProfile } from './profile'

export interface FactorPlugin {
  factor_no: 1 | 2 | 3 | 4 | 5 | 6 | 7
  name: string
  description: string
  
  // Calculate the factor value (per 100 possessions)
  calculate: (inputs: FactorInputs) => Promise<FactorResult>
}

export interface FactorInputs {
  homeTeam: string
  awayTeam: string
  profile: CapperProfile
  context?: any // Additional context (stats, news, etc.)
}

export interface FactorResult {
  value: number // Normalized value (per 100)
  raw: unknown // Raw data used for calculation
  parsed: Record<string, unknown> // Parsed intermediate values
  capped: boolean
  capReason: string | null
  notes?: string | null
}

/**
 * SHIVA v1 Factor Registry
 * Maps factor numbers to calculation plugins
 */
export const shivaFactorRegistry: FactorPlugin[] = [
  {
    factor_no: 1,
    name: 'Net Rating Differential',
    description: 'Season-long net rating differential (home - away)',
    calculate: async (inputs) => {
      // Placeholder - actual implementation would call StatMuse
      return {
        value: 0,
        raw: {},
        parsed: {},
        capped: false,
        capReason: null,
      }
    },
  },
  {
    factor_no: 2,
    name: 'Recent Form (Last 10 Games)',
    description: 'Net rating differential over last 10 games',
    calculate: async (inputs) => {
      return {
        value: 0,
        raw: {},
        parsed: {},
        capped: false,
        capReason: null,
      }
    },
  },
  {
    factor_no: 3,
    name: 'Head-to-Head Matchup',
    description: 'PPG differential in head-to-head games this season',
    calculate: async (inputs) => {
      return {
        value: 0,
        raw: {},
        parsed: {},
        capped: false,
        capReason: null,
      }
    },
  },
  {
    factor_no: 4,
    name: 'Offensive Rating Differential',
    description: 'ORtg differential (home - away)',
    calculate: async (inputs) => {
      return {
        value: 0,
        raw: {},
        parsed: {},
        capped: false,
        capReason: null,
      }
    },
  },
  {
    factor_no: 5,
    name: 'News/Injury Edge',
    description: 'Impact of injuries and news on game edge',
    calculate: async (inputs) => {
      return {
        value: 0,
        raw: {},
        parsed: {},
        capped: false,
        capReason: null,
      }
    },
  },
  {
    factor_no: 6,
    name: 'Home Court Advantage',
    description: 'Fixed home court edge per 100 possessions',
    calculate: async (inputs) => {
      return {
        value: inputs.profile.constants.home_edge_per100,
        raw: { home_team: inputs.homeTeam },
        parsed: { home_edge_100: inputs.profile.constants.home_edge_per100 },
        capped: false,
        capReason: null,
      }
    },
  },
  {
    factor_no: 7,
    name: '3-Point Environment',
    description: '3PT attempt and efficiency differentials',
    calculate: async (inputs) => {
      return {
        value: 0,
        raw: {},
        parsed: {},
        capped: false,
        capReason: null,
      }
    },
  },
]

/**
 * Get factor plugin by number
 */
export function getFactorPlugin(factorNo: number): FactorPlugin | undefined {
  return shivaFactorRegistry.find(f => f.factor_no === factorNo)
}

/**
 * Calculate delta per 100 using profile weights and factor values
 */
export function calculateDelta100FromProfile(
  factorValues: number[],
  profile: CapperProfile
): number {
  const weights = [
    profile.weights.f1_net_rating,
    profile.weights.f2_recent_form,
    profile.weights.f3_h2h_matchup,
    profile.weights.f4_ortg_diff,
    profile.weights.f5_news_injury,
    profile.weights.f6_home_court,
    profile.weights.f7_three_point,
  ]

  return factorValues.reduce((sum, val, idx) => sum + val * weights[idx], 0)
}

