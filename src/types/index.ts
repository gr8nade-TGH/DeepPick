// Core application types
export interface User {
  id: string
  email: string
  username?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  preferences: UserPreferences
  subscription_tier: 'free' | 'premium' | 'pro'
  units_per_bet: number
  total_units_bet: number
  total_units_won: number
  total_units_lost: number
  win_rate: number
  roi: number
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'auto'
  notifications: {
    email: boolean
    push: boolean
    new_picks: boolean
    results: boolean
  }
  betting_preferences: {
    sports: Sport[]
    bet_types: BetType[]
    risk_tolerance: 'low' | 'medium' | 'high'
    max_units_per_bet: number
  }
}

// Sports and betting types
export type Sport = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaaf' | 'ncaab' | 'soccer' | 'tennis' | 'golf'
export type BetType = 'moneyline' | 'spread' | 'total' | 'player_prop' | 'team_prop' | 'futures'
export type PickStatus = 'pending' | 'active' | 'won' | 'lost' | 'pushed' | 'cancelled'
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high'

export interface Game {
  id: string
  sport: Sport
  league: string
  home_team: Team
  away_team: Team
  game_date: string
  game_time: string
  status: 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled'
  venue: string
  weather?: WeatherData
  odds: GameOdds
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  abbreviation: string
  logo_url?: string
  city: string
  conference?: string
  division?: string
}

export interface GameOdds {
  moneyline: {
    home: number
    away: number
  }
  spread: {
    home: number
    away: number
    home_line: number
    away_line: number
  }
  total: {
    over: number
    under: number
    line: number
  }
  last_updated: string
}

export interface WeatherData {
  temperature: number
  condition: string
  wind_speed: number
  wind_direction: number
  humidity: number
  precipitation_chance: number
}

// Pick and prediction types
export interface Pick {
  id: string
  user_id: string
  game_id: string
  sport: Sport
  bet_type: BetType
  selection: string
  odds: number
  confidence: ConfidenceLevel
  units: number
  potential_payout: number
  status: PickStatus
  reasoning: string
  data_points: DataPoint[]
  created_at: string
  updated_at: string
  graded_at?: string
  result?: PickResult
}

export interface PickResult {
  id: string
  pick_id: string
  outcome: 'won' | 'lost' | 'pushed'
  actual_result: string
  units_won: number
  units_lost: number
  net_units: number
  graded_at: string
  notes?: string
}

export interface DataPoint {
  id: string
  pick_id: string
  metric: string
  value: number
  weight: number
  source: string
  created_at: string
}

// Performance and analytics
export interface PerformanceMetrics {
  user_id: string
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time'
  total_picks: number
  wins: number
  losses: number
  pushes: number
  win_rate: number
  units_bet: number
  units_won: number
  units_lost: number
  net_units: number
  roi: number
  longest_win_streak: number
  longest_loss_streak: number
  current_streak: number
  current_streak_type: 'win' | 'loss'
  average_odds: number
  best_performing_sport: Sport
  best_performing_bet_type: BetType
  created_at: string
  updated_at: string
}

// API and external data
export interface SportsDataAPI {
  name: string
  base_url: string
  api_key: string
  rate_limit: number
  endpoints: {
    games: string
    odds: string
    results: string
    players: string
    teams: string
  }
}

export interface ExternalPick {
  id: string
  platform: 'draftkings' | 'prizepicks' | 'underdog' | 'superdraft'
  sport: Sport
  type: 'pick6' | 'powerplay' | 'pickem' | 'battle'
  selections: PickSelection[]
  total_odds: number
  created_at: string
  expires_at: string
}

export interface PickSelection {
  player_name: string
  team: string
  stat: string
  line: number
  over_under: 'over' | 'under'
  odds: number
}

// UI and component types
export interface ChartData {
  date: string
  units: number
  cumulative_units: number
  picks: number
  win_rate: number
}

export interface NotificationData {
  id: string
  user_id: string
  type: 'pick_created' | 'pick_graded' | 'streak_achievement' | 'milestone' | 'system'
  title: string
  message: string
  read: boolean
  created_at: string
  action_url?: string
}

// Form types
export interface CreatePickForm {
  game_id: string
  bet_type: BetType
  selection: string
  odds: number
  confidence: ConfidenceLevel
  units: number
  reasoning: string
}

export interface UserSettingsForm {
  username: string
  units_per_bet: number
  notifications: UserPreferences['notifications']
  betting_preferences: UserPreferences['betting_preferences']
}

// API response types
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
}

// Environment types
export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test'
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SPORTS_DATA_API_KEY: string
  REDIS_URL: string
  SENTRY_DSN?: string
}
