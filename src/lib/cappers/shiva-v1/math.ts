// Deterministic math and constants for SHIVA v1

export const LEAGUE_AVG_ORtg = 114
export const HOME_EDGE_PER_100 = 1.5
export const H2H_CAP_PER_100 = 6
export const NEWS_EDGE_CAP_PER_100 = 3
export const SIDE_NORM_DENOM = 6
export const TOTAL_NORM_DENOM = 12
export const MARKET_ADJ_SCALE = 1.2

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function harmonicMean(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0
  return 2 / (1 / a + 1 / b)
}

export function mapSpreadToConf7(spreadPred: number): number {
  const raw = Math.min(Math.abs(spreadPred) / SIDE_NORM_DENOM, 1)
  return 1 + 4 * raw
}

export function chooseMarketDominant(sideNorm: number, totalNorm: number): 'side' | 'total' {
  return Math.abs(sideNorm) >= Math.abs(totalNorm) ? 'side' : 'total'
}


