/**
 * NBA Totals Factor Registry
 * 
 * Defines the 5 NBA totals factors that real bettors use:
 * F1) Matchup Pace Index - How fast both teams will play tonight
 * F2) Offensive Form vs Opponent - Are offenses hot?
 * F3) Defensive Erosion - Are key defenders out or playing hurt?
 * F4) 3-Point Environment & Volatility - Combined 3PA rate and variance
 * F5) Free-Throw/Whistle Environment - FT rate and foul propensity
 */

import { FactorMeta, BetType, Sport, Scope } from '@/types/factors';

// NBA Totals Factors (5 factors)
export const NBA_TOTALS_FACTORS: FactorMeta[] = [
  {
    key: 'paceIndex',
    name: 'Matchup Pace Index',
    shortName: 'Pace',
    icon: '⏱️',
    description: 'Expected pace based on season + last-10 games. Higher pace = more possessions = higher totals.',
    appliesTo: {
      sports: ['NBA'],
      betTypes: ['TOTAL'],
      scope: 'LEAGUE'
    },
    maxPoints: 0.6,
    defaultWeight: 0.20
  },
  {
    key: 'offForm',
    name: 'Offensive Form vs Opp',
    shortName: 'ORtg Form',
    icon: '🔥',
    description: 'Recent offensive efficiency adjusted for opponent defense. Hot offenses = higher totals.',
    appliesTo: {
      sports: ['NBA'],
      betTypes: ['TOTAL'],
      scope: 'LEAGUE'
    },
    maxPoints: 0.6,
    defaultWeight: 0.18
  },
  {
    key: 'defErosion',
    name: 'Defensive Erosion',
    shortName: 'DRtg/Avail',
    icon: '🛡️',
    description: 'Defensive decline from injuries/availability. Weaker defense = higher totals.',
    appliesTo: {
      sports: ['NBA'],
      betTypes: ['TOTAL'],
      scope: 'GLOBAL'
    },
    maxPoints: 0.5,
    defaultWeight: 0.14
  },
  {
    key: 'threeEnv',
    name: '3PT Environment',
    shortName: '3P Env',
    icon: '🏹',
    description: '3PA rate + shooting variance. More 3s + hot shooting = higher totals.',
    appliesTo: {
      sports: ['NBA'],
      betTypes: ['TOTAL'],
      scope: 'LEAGUE'
    },
    maxPoints: 0.4,
    defaultWeight: 0.10
  },
  {
    key: 'whistleEnv',
    name: 'FT/Whistle Env',
    shortName: 'FT Env',
    icon: '⛹️‍♂️',
    description: 'Free throw rate environment. More FTs = more points + clock stops.',
    appliesTo: {
      sports: ['NBA'],
      betTypes: ['TOTAL'],
      scope: 'LEAGUE'
    },
    maxPoints: 0.3,
    defaultWeight: 0.08
  }
];

// Global factors (apply to all sports/bet types)
export const GLOBAL_FACTORS: FactorMeta[] = [
  {
    key: 'edgeVsMarket',
    name: 'Edge vs Market - Totals',
    shortName: 'Edge',
    icon: '📊',
    description: 'Predicted total vs market line. Positive edge favors Over, negative favors Under.',
    appliesTo: {
      sports: '*',
      betTypes: ['TOTAL'],
      scope: 'GLOBAL'
    },
    maxPoints: 3.0,
    defaultWeight: 0.15
  }
];

// Injury factors (apply to totals across all sports)
export const INJURY_FACTORS: FactorMeta[] = [
  {
    key: 'injuryAvailability',
    name: 'Key Injuries & Availability - Totals',
    shortName: 'Injuries',
    icon: '🏥',
    description: 'AI analysis of key player injuries and availability. Considers impact on scoring, team performance, and game flow.',
    appliesTo: {
      sports: ['NBA', 'NFL', 'MLB'],
      betTypes: ['TOTAL'],
      scope: 'GLOBAL'
    },
    maxPoints: 3.0,
    defaultWeight: 0.12
  }
];

// Combined registry
export const FACTOR_REGISTRY: FactorMeta[] = [
  ...NBA_TOTALS_FACTORS,
  ...GLOBAL_FACTORS,
  ...INJURY_FACTORS
];

// StatMuse Query Helpers for NBA Totals
export const StatMuseQueries = {
  // Pace queries
  pace: (team: string, last10 = false) => 
    last10 ? `${team} pace last 10 games this season` : `${team} pace this season`,
  
  leaguePace: () => 'league average pace this season',
  
  // Offensive/Defensive rating queries
  ortgLast10: (team: string) => `${team} offensive rating last 10 games this season`,
  drtgSeason: (team: string) => `${team} defensive rating this season`,
  ortgVenue: (team: string, venue: 'home' | 'away') => 
    `${team} offensive rating ${venue === 'home' ? 'at home' : 'on the road'} this season`,
  
  // 3-Point environment queries
  threePAR: (team: string) => `${team} 3 point attempt rate this season`,
  oppThreePAR: (team: string) => `${team} opponent 3 point attempt rate this season`,
  threePctLast10: (team: string) => `${team} 3pt percentage last 10 games this season`,
  
  // Free throw environment queries
  ftr: (team: string) => `${team} free throw rate this season`,
  oppFtr: (team: string) => `${team} opponent free throw rate this season`,
  fouls: (team: string) => `${team} personal fouls per game this season`,
  
  // Rest/fatigue queries
  restRecord: (team: string, days: number) => 
    `${team} record on ${days} days rest this season`
};

// League constants for NBA
export const NBA_CONSTANTS = {
  LEAGUE_PACE: 100.0,        // Approximate league average pace
  LEAGUE_ORTG: 110.0,        // League average offensive rating
  LEAGUE_DRTG: 110.0,        // League average defensive rating
  LEAGUE_3PAR: 0.39,         // League average 3-point attempt rate
  LEAGUE_FTR: 0.220,         // League average free throw rate
  LEAGUE_3P_STDEV: 0.05      // Approximate league 3P% standard deviation
};

// Factor computation helpers
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeToPoints(value: number, maxPoints: number): number {
  return clamp(value, -1, 1) * maxPoints;
}

export function splitPointsEvenly(points: number): { away: number; home: number } {
  return {
    away: points / 2,
    home: points / 2
  };
}

// Factor metadata lookup
export function getFactorMeta(key: string): FactorMeta | undefined {
  return FACTOR_REGISTRY.find(factor => factor.key === key);
}

export function getFactorsBySport(sport: Sport): FactorMeta[] {
  return FACTOR_REGISTRY.filter(factor => 
    factor.appliesTo.sports === '*' || (Array.isArray(factor.appliesTo.sports) && factor.appliesTo.sports.includes(sport))
  );
}

export function getFactorsByBetType(betType: BetType): FactorMeta[] {
  return FACTOR_REGISTRY.filter(factor => 
    factor.appliesTo.betTypes === '*' || (Array.isArray(factor.appliesTo.betTypes) && factor.appliesTo.betTypes.includes(betType))
  );
}

export function getFactorsByContext(sport: Sport, betType: BetType): FactorMeta[] {
  console.log('[getFactorsByContext] Input:', { sport, betType });
  
  const result = FACTOR_REGISTRY.filter(factor => {
    const sportMatch = factor.appliesTo.sports === '*' || (Array.isArray(factor.appliesTo.sports) && factor.appliesTo.sports.includes(sport));
    
    // Handle bet type matching
    let betTypeMatch = false;
    if (factor.appliesTo.betTypes === '*') {
      betTypeMatch = true;
    } else if (Array.isArray(factor.appliesTo.betTypes)) {
      if (betType === 'SPREAD/MONEYLINE') {
        // For SPREAD/MONEYLINE, match if factor applies to either SPREAD or MONEYLINE
        betTypeMatch = factor.appliesTo.betTypes.includes('SPREAD' as any) || factor.appliesTo.betTypes.includes('MONEYLINE' as any);
      } else {
        // For TOTAL, match if factor applies to TOTAL
        betTypeMatch = factor.appliesTo.betTypes.includes(betType as any);
      }
    }
    
    const matches = sportMatch && betTypeMatch;
    console.log(`[getFactorsByContext] Factor ${factor.key}:`, {
      sportMatch,
      betTypeMatch,
      factorBetTypes: factor.appliesTo.betTypes,
      requestedBetType: betType,
      matches
    });
    
    return matches;
  });
  
  // Debug logging
  console.log('[getFactorsByContext] Result:', {
    sport,
    betType,
    totalFactors: FACTOR_REGISTRY.length,
    matchingFactors: result.length,
    factorKeys: result.map(f => f.key),
    allFactorBetTypes: FACTOR_REGISTRY.map(f => ({ key: f.key, betTypes: f.appliesTo.betTypes }))
  });
  
  return result;
}