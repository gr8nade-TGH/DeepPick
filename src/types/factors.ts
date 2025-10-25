/**
 * Factor System Types
 * 
 * Defines the core types for the factor tagging and computation system.
 * Supports filtering factors by sport, bet type, and scope.
 */

export type BetType = 'TOTAL' | 'SPREAD/MONEYLINE';
export type Sport = 'NBA' | 'NFL' | 'MLB' | 'NHL';
export type Scope = 'GLOBAL' | 'SPORT' | 'LEAGUE';

export interface FactorMeta {
  key: string;
  name: string;
  shortName: string;      // label next to the icon
  icon: string;           // emoji or icon key
  description?: string;   // tooltip description
  appliesTo: { 
    sports: Sport[] | '*'; 
    betTypes: BetType[] | '*'; 
    scope: Scope 
  };
  maxPoints: number;      // cap of absolute contribution in points
  defaultWeight: number;  // contributes to confidence (your ~0.70 target)
  defaultDataSource?: string; // default data source for the factor
}

export interface FactorComputation {
  factor_no: number;
  key: string;
  name: string;
  normalized_value: number;
  raw_values_json: Record<string, any>;
  parsed_values_json: Record<string, any>;
  caps_applied: boolean;
  cap_reason?: string | null;
  notes?: string;
}

export interface FactorFilter {
  sport: Sport;
  betType: BetType;
}

export interface FactorVersion {
  version: string;
  factors: FactorMeta[];
  totalWeight: number;
}

// Helper type for factor filtering
export type FactorApplicable = FactorMeta & {
  isApplicable: (filter: FactorFilter) => boolean;
};

// Utility functions
export function isFactorApplicable(factor: FactorMeta, filter: FactorFilter): boolean {
  const sportMatch = factor.appliesTo.sports === '*' || (Array.isArray(factor.appliesTo.sports) && factor.appliesTo.sports.includes(filter.sport));
  const betTypeMatch = factor.appliesTo.betTypes === '*' || (Array.isArray(factor.appliesTo.betTypes) && factor.appliesTo.betTypes.includes(filter.betType));
  return sportMatch && betTypeMatch;
}

export function filterFactorsByContext(factors: FactorMeta[], filter: FactorFilter): FactorMeta[] {
  return factors.filter(factor => isFactorApplicable(factor, filter));
}

export function calculateTotalWeight(factors: FactorMeta[]): number {
  return factors.reduce((sum, factor) => sum + factor.defaultWeight, 0);
}

export function normalizeWeights(factors: FactorMeta[], targetWeight: number = 0.70): FactorMeta[] {
  const currentTotal = calculateTotalWeight(factors);
  const scaleFactor = targetWeight / currentTotal;
  
  return factors.map(factor => ({
    ...factor,
    defaultWeight: factor.defaultWeight * scaleFactor
  }));
}
