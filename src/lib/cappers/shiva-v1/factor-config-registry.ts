/**
 * Factor Configuration Registry
 * Central registry of all available factors with their metadata
 */

import { FactorRegistry } from '@/types/factor-config'

export const FACTOR_REGISTRY: FactorRegistry = {
  // ========================================================================
  // NBA TOTALS FACTORS (F1-F5)
  // ========================================================================
  
  paceIndex: {
    name: 'Matchup Pace Index',
    description: 'Expected game pace vs league average',
    defaultWeight: 20,
    maxPoints: 2.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['TOTAL'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'matchup',
    icon: '⏱️',
    shortName: 'Pace'
  },
  
  offForm: {
    name: 'Offensive Form vs League',
    description: 'Combined team offensive efficiency vs league average',
    defaultWeight: 20,
    maxPoints: 2.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['TOTAL'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'matchup',
    icon: '🔥',
    shortName: 'Offense'
  },
  
  defErosion: {
    name: 'Defensive Erosion',
    description: 'Defensive rating decline + injury impact',
    defaultWeight: 30,
    maxPoints: 2.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['TOTAL'],
    availableDataSources: ['nba-stats-api', 'llm', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'matchup',
    icon: '🛡️',
    shortName: 'Defense'
  },
  
  threeEnv: {
    name: '3-Point Environment & Volatility',
    description: '3-point attempt rate and recent shooting variance',
    defaultWeight: 20,
    maxPoints: 1.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['TOTAL'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'matchup',
    icon: '🏹',
    shortName: '3P Env'
  },
  
  whistleEnv: {
    name: 'Free-Throw / Whistle Environment',
    description: 'Free throw rate environment for both teams',
    defaultWeight: 20,
    maxPoints: 1.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['TOTAL'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'matchup',
    icon: '⛹️‍♂️',
    shortName: 'FT Env'
  },
  
  // ========================================================================
  // NBA SPREAD FACTORS (Legacy - examples)
  // ========================================================================
  
  netRating: {
    name: 'Net Rating Differential',
    description: 'Offensive rating minus defensive rating differential',
    defaultWeight: 15,
    maxPoints: 1.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'matchup',
    icon: '📊',
    shortName: 'NetRtg'
  },
  
  homeCourtAdvantage: {
    name: 'Home Court Advantage',
    description: 'Historical home/away performance differential',
    defaultWeight: 10,
    maxPoints: 0.5,
    supportedSports: ['NBA', 'NFL', 'MLB'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'team',
    icon: '🏠',
    shortName: 'Home'
  },
  
  restAdvantage: {
    name: 'Rest Advantage',
    description: 'Days of rest differential between teams',
    defaultWeight: 8,
    maxPoints: 0.4,
    supportedSports: ['NBA', 'NFL'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE', 'TOTAL'],
    availableDataSources: ['manual'],
    defaultDataSource: 'manual',
    scope: 'matchup',
    icon: '😴',
    shortName: 'Rest'
  },
  
  // ========================================================================
  // GLOBAL FACTORS (All sports/bet types)
  // ========================================================================
  
  newsEdge: {
    name: 'News/Injury Edge',
    description: 'Injury/availability impact within last 48-72h. Capped at ±3 per 100 pre-aggregation.',
    defaultWeight: 7,
    maxPoints: 0.3,
    supportedSports: ['NBA', 'NFL', 'MLB'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE', 'TOTAL'],
    availableDataSources: ['llm', 'news-api', 'manual'],
    defaultDataSource: 'llm',
    scope: 'team',
    icon: '🏥',
    shortName: 'News/Injury'
  },
  
  injuries: {
    name: 'Key Injuries & Availability',
    description: 'Impact of missing key players',
    defaultWeight: 12,
    maxPoints: 0.8,
    supportedSports: ['NBA', 'NFL', 'MLB'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE', 'TOTAL'],
    availableDataSources: ['llm', 'news-api', 'manual'],
    defaultDataSource: 'llm',
    scope: 'team',
    icon: '🏥',
    shortName: 'Injuries'
  },
  
  momentum: {
    name: 'Recent Momentum',
    description: 'Last 5 games performance trend',
    defaultWeight: 10,
    maxPoints: 0.5,
    supportedSports: ['NBA', 'NFL', 'MLB'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE', 'TOTAL'],
    availableDataSources: ['nba-stats-api', 'manual'],
    defaultDataSource: 'nba-stats-api',
    scope: 'team',
    icon: '📈',
    shortName: 'Momentum'
  },
  
  weather: {
    name: 'Weather Conditions',
    description: 'Weather impact on outdoor games',
    defaultWeight: 8,
    maxPoints: 0.4,
    supportedSports: ['NFL', 'MLB'],
    supportedBetTypes: ['SPREAD', 'MONEYLINE', 'TOTAL'],
    availableDataSources: ['manual'],
    defaultDataSource: 'manual',
    scope: 'global',
    icon: '🌦️',
    shortName: 'Weather'
  },
  
  edgeVsMarket: {
    name: 'Edge vs Market - Totals',
    description: 'Final confidence adjustment based on predicted vs market line for totals',
    defaultWeight: 100, // Always 100% (fixed)
    maxPoints: 3.0,
    supportedSports: ['NBA'],
    supportedBetTypes: ['TOTAL'],
    availableDataSources: ['manual'],
    defaultDataSource: 'manual',
    scope: 'global',
    icon: '⚖️',
    shortName: 'Edge vs Market'
  }
}

/**
 * Get factors filtered by sport and bet type
 */
export function getAvailableFactors(sport: string, betType: string): string[] {
  return Object.keys(FACTOR_REGISTRY).filter(key => {
    const factor = FACTOR_REGISTRY[key]
    return (
      factor.supportedSports.includes(sport) &&
      factor.supportedBetTypes.includes(betType)
    )
  })
}

/**
 * Get default profile for a capper/sport/bet type combination
 */
export function getDefaultProfile(
  capperId: string,
  sport: string,
  betType: string
): any {
  const availableFactorKeys = getAvailableFactors(sport, betType)
  
  const factors = availableFactorKeys.map(key => {
    const factorDef = FACTOR_REGISTRY[key]
    return {
      key,
      name: factorDef.name,
      description: factorDef.description,
      enabled: true, // All enabled by default
      weight: factorDef.defaultWeight,
      dataSource: factorDef.defaultDataSource,
      maxPoints: factorDef.maxPoints,
      sport,
      betType,
      scope: factorDef.scope,
      icon: factorDef.icon,
      shortName: factorDef.shortName
    }
  })
  
  return {
    id: `${capperId}-${sport}-${betType}-default`.toLowerCase(),
    capperId,
    sport,
    betType,
    name: `${capperId} ${sport} ${betType} Default`,
    description: `Default factor configuration for ${capperId}`,
    factors,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
    isDefault: true
  }
}

