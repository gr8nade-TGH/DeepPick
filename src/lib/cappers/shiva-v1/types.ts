// DTOs for SHIVA v1 Steps 2–7 based on provided payload skeletons

export interface OddsSnapshotDTO {
  run_id: string
  snapshot: {
    game_id: string
    sport: 'NBA'
    home_team: string
    away_team: string
    start_time_utc: string
    captured_at_utc: string
    books_considered: number
    moneyline: { home_avg: number; away_avg: number }
    spread: { fav_team: string; line: number; odds: number }
    total: { line: number; over_odds: number; under_odds: number }
    raw_payload: unknown
  }
}

export interface Step3FactorsDTO {
  run_id: string
  inputs: {
    teams: { home: string; away: string }
    ai_provider: 'perplexity' | 'openai'
    news_window_hours: number
  }
  results: {
    factors: Array<{
      factor_no: 1 | 2 | 3 | 4 | 5
      name: string
      weight_total_pct: number
      raw_values_json: unknown
      parsed_values_json: Record<string, unknown>
      normalized_value: number
      caps_applied: boolean
      cap_reason: string | null
      notes?: string | null
    }>
    meta: {
      provider_latency_ms?: { statmuse?: number; web_search?: number }
      ai_provider: 'perplexity' | 'openai'
    }
  }
}

export interface Step4PredictionDTO {
  run_id: string
  inputs: {
    ai_provider: 'openai' | 'perplexity'
    home_team: string
    away_team: string
  }
  results: {
    factors: Array<{
      factor_no: 6 | 7
      name: string
      weight_total_pct: number
      raw_values_json: unknown
      parsed_values_json: Record<string, unknown>
      normalized_value: number
      caps_applied: boolean
      cap_reason: string | null
    }>
    pace_and_predictions: {
      statmuse_pace: { okc_query?: string; hou_query?: string; okc_pace: number; hou_pace: number }
      pace_exp: number
      delta_100: string | number
      delta_100_value: number
      spread_pred_points: number
      league_avg_ortg: number
      ortg_hat: Record<string, number>
      total_pred_points: number
      scores: { home_pts: number; away_pts: number }
      winner: string
      conf7_score: string | number
      conf7_score_value: number
    }
    meta: { ai_provider: 'openai' | 'perplexity' }
  }
}

export interface Step5MarketDTO {
  run_id: string
  inputs: {
    active_snapshot_id: string
    spread_pred_points: number
    total_pred_points: number
    pick_side_team: string
    snapshot: { spread: { fav_team: string; line: number }; total: { line: number } }
    conf7_score: number
  }
  results: {
    market_edge: {
      edge_side_points: number
      edge_side_norm: number
      edge_total_points: number
      edge_total_norm: number
      dominant: 'side' | 'total'
      conf_market_adj: string | number
      conf_market_adj_value: number
    }
    confidence: { conf7: number; conf_final: number }
    meta?: { note?: string }
  }
}

export interface Step6PickDTO {
  run_id: string
  inputs: {
    conf_final: number
    edge_dominant: 'side' | 'total'
    side_data?: { pick_team: string; spread_pred: number; market_spread: number }
    total_data?: { total_pred: number; market_total: number }
  }
  results: {
    decision: {
      pick_type: 'SPREAD' | 'MONEYLINE' | 'TOTAL'
      pick_side: 'HOME' | 'AWAY' | 'OVER' | 'UNDER' | string
      line: number
      units: number
      reason: string
    }
    persistence: {
      picks_row: {
        id: string
        run_id: string
        sport: 'NBA'
        matchup: string
        confidence: number
        units: number
        pick_type: 'SPREAD' | 'MONEYLINE' | 'TOTAL'
        selection: string
        created_at_utc: string
      }
    }
  }
}

export interface Step7InsightCardDTO {
  run_id: string
  inputs: {
    final_pick: {
      pick_type: 'SPREAD' | 'MONEYLINE' | 'TOTAL'
      selection: string
      units: number
      pred_score: { home: number; away: number }
      conf_final: number
    }
  }
  card: {
    header: { capper: 'SHIVA'; league: 'NBA'; matchup: string; start_time_local: string; units: number }
    prediction: { primary: string; secondary: string; score_projection: string }
    factors: Array<Record<string, unknown>>
    audit: { conf7: number; conf_market_adj: number; conf_final: number; odds_snapshot_id: string; active_snapshot: boolean }
  }
}


