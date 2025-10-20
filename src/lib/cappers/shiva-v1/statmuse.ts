// Server-side StatMuse proxy adapter (templated queries only)
export interface StatMuseQuery {
  team: string
  opponent?: string
  kind:
    | 'net_rating_season'
    | 'off_rating_season'
    | 'def_rating_season'
    | 'net_rating_last10'
    | 'ppg_vs_opponent'
    | 'pace_season'
    | 'three_pa_per_game'
    | 'three_pct'
    | 'opp_three_pa_per_game'
}

export async function fetchStatMuse(query: StatMuseQuery): Promise<unknown> {
  // Stub: implement via backend proxy with caching and rate limiting
  throw new Error('Not implemented')
}


