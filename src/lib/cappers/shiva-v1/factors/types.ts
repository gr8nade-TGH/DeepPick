/**
 * NBA Totals Factor Types
 * 
 * Shared types for NBA totals factor computation
 */

export interface RunCtx {
  game_id: string
  away: string
  home: string
  sport: 'NBA'
  betType: 'TOTAL'
  leagueAverages: {
    pace: number
    ORtg: number
    DRtg: number
    threePAR: number
    FTr: number
    threePstdev: number
  }
  factorWeights?: Record<string, number> // weight percentages (0-100)
}

export interface StatMuseBundle {
  // Team pace data
  awayPaceSeason: number
  awayPaceLast10: number
  homePaceSeason: number
  homePaceLast10: number
  
  // Team scoring averages (last 5 games)
  awayPointsPerGame: number
  homePointsPerGame: number
  
  // Offensive/Defensive ratings
  awayORtgLast10: number
  homeORtgLast10: number
  awayDRtgSeason: number
  homeDRtgSeason: number
  
  // 3-Point environment
  away3PAR: number
  home3PAR: number
  awayOpp3PAR: number
  homeOpp3PAR: number
  away3Pct: number
  home3Pct: number
  away3PctLast10: number
  home3PctLast10: number
  
  // Free throw environment
  awayFTr: number
  homeFTr: number
  awayOppFTr: number
  homeOppFTr: number
  
  // League anchors
  leaguePace: number
  leagueORtg: number
  leagueDRtg: number
  league3PAR: number
  league3Pct: number
  leagueFTr: number
  league3Pstdev: number
}

export interface InjuryImpact {
  defenseImpactA: number // -1 to +1
  defenseImpactB: number // -1 to +1
  summary: string
  rawResponse: string
}

export interface FactorComputationResult {
  factors: any[]
  factor_version: string
  totals_debug: {
    league_anchors: {
      pace: number
      ORtg: number
      DRtg: number
      threePAR: number
      FTr: number
      threePstdev: number
    }
    injury_impact: InjuryImpact
    factor_keys: string[]
    console_logs: {
      branch_used: { sport: string; betType: string }
      bundle: StatMuseBundle
      rows_z_points: Array<{ key: string; z: number; pts: number }>
    }
    nba_stats_api_debug: {
      condition_check: {
        enabledFactorKeys: string[]
        shouldFetchNBAStats: boolean
        paceIndex: boolean
        offForm: boolean
        defErosion: boolean
        threeEnv: boolean
        whistleEnv: boolean
      }
      enabled_factors: string[]
      nba_stats_fetched: boolean
      team_names: { away: string; home: string }
      bundle_keys: string[]
      bundle_sample: {
        awayPaceSeason: number
        homePaceSeason: number
        awayORtgLast10: number
        homeORtgLast10: number
        leaguePace: number
        leagueORtg: number
      }
      api_calls_made: boolean
    }
  }
}
