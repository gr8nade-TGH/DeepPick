import { z } from 'zod'

// User validation schemas
export const userPreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'auto']).default('dark'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    new_picks: z.boolean().default(true),
    results: z.boolean().default(true),
  }),
  betting_preferences: z.object({
    sports: z.array(z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf'])),
    bet_types: z.array(z.enum(['moneyline', 'spread', 'total', 'player_prop', 'team_prop', 'futures'])),
    risk_tolerance: z.enum(['low', 'medium', 'high']).default('medium'),
    max_units_per_bet: z.number().min(0.1).max(100).default(5),
  }),
})

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').optional(),
  units_per_bet: z.number().min(0.1).max(100).default(1),
  preferences: userPreferencesSchema.optional(),
})

export const updateUserSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  units_per_bet: z.number().min(0.1).max(100).optional(),
  preferences: userPreferencesSchema.optional(),
})

// Pick validation schemas
export const createPickSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  bet_type: z.enum(['moneyline', 'spread', 'total', 'player_prop', 'team_prop', 'futures']),
  selection: z.string().min(1, 'Selection is required').max(500, 'Selection must be less than 500 characters'),
  odds: z.number().min(-1000).max(1000, 'Invalid odds range'),
  confidence: z.enum(['low', 'medium', 'high', 'very_high']),
  units: z.number().min(0.1, 'Minimum 0.1 units').max(100, 'Maximum 100 units'),
  reasoning: z.string().min(10, 'Reasoning must be at least 10 characters').max(1000, 'Reasoning must be less than 1000 characters'),
})

export const updatePickSchema = z.object({
  selection: z.string().min(1).max(500).optional(),
  odds: z.number().min(-1000).max(1000).optional(),
  confidence: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  units: z.number().min(0.1).max(100).optional(),
  reasoning: z.string().min(10).max(1000).optional(),
})

// Game validation schemas
export const createGameSchema = z.object({
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf']),
  league: z.string().min(1, 'League is required'),
  home_team: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    abbreviation: z.string().min(1),
    city: z.string().min(1),
  }),
  away_team: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    abbreviation: z.string().min(1),
    city: z.string().min(1),
  }),
  game_date: z.string().datetime('Invalid date format'),
  game_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  venue: z.string().min(1, 'Venue is required'),
  weather: z.object({
    temperature: z.number(),
    condition: z.string(),
    wind_speed: z.number(),
    wind_direction: z.number(),
    humidity: z.number(),
    precipitation_chance: z.number(),
  }).optional(),
  odds: z.object({
    moneyline: z.object({
      home: z.number(),
      away: z.number(),
    }),
    spread: z.object({
      home: z.number(),
      away: z.number(),
      home_line: z.number(),
      away_line: z.number(),
    }),
    total: z.object({
      over: z.number(),
      under: z.number(),
      line: z.number(),
    }),
  }),
})

// Team validation schemas
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  abbreviation: z.string().min(2, 'Abbreviation must be at least 2 characters').max(5, 'Abbreviation must be less than 5 characters'),
  city: z.string().min(1, 'City is required'),
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf']),
  logo_url: z.string().url('Invalid logo URL').optional(),
  conference: z.string().optional(),
  division: z.string().optional(),
})

// Pick result validation schemas
export const createPickResultSchema = z.object({
  pick_id: z.string().uuid('Invalid pick ID'),
  outcome: z.enum(['won', 'lost', 'pushed']),
  actual_result: z.string().min(1, 'Actual result is required'),
  units_won: z.number().min(0).default(0),
  units_lost: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
})

// Performance metrics validation schemas
export const performanceMetricsSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'all_time']),
  total_picks: z.number().min(0).default(0),
  wins: z.number().min(0).default(0),
  losses: z.number().min(0).default(0),
  pushes: z.number().min(0).default(0),
  units_bet: z.number().min(0).default(0),
  units_won: z.number().min(0).default(0),
  units_lost: z.number().min(0).default(0),
})

// Notification validation schemas
export const createNotificationSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  type: z.enum(['pick_created', 'pick_graded', 'streak_achievement', 'milestone', 'system']),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  message: z.string().min(1, 'Message is required').max(500, 'Message must be less than 500 characters'),
  action_url: z.string().url('Invalid action URL').optional(),
})

// API query validation schemas
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
})

export const pickFiltersSchema = z.object({
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf']).optional(),
  bet_type: z.enum(['moneyline', 'spread', 'total', 'player_prop', 'team_prop', 'futures']).optional(),
  status: z.enum(['pending', 'active', 'won', 'lost', 'pushed', 'cancelled']).optional(),
  confidence: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
})

export const gameFiltersSchema = z.object({
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf']).optional(),
  status: z.enum(['scheduled', 'live', 'final', 'postponed', 'cancelled']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  team_id: z.string().uuid().optional(),
})

// Search validation schemas
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Search query must be less than 100 characters'),
  type: z.enum(['picks', 'games', 'teams', 'all']).default('all'),
})

// External API validation schemas
export const externalPickSchema = z.object({
  platform: z.enum(['draftkings', 'prizepicks', 'underdog', 'superdraft']),
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf']),
  type: z.enum(['pick6', 'powerplay', 'pickem', 'battle']),
  selections: z.array(z.object({
    player_name: z.string().min(1),
    team: z.string().min(1),
    stat: z.string().min(1),
    line: z.number(),
    over_under: z.enum(['over', 'under']),
    odds: z.number(),
  })).min(1),
  total_odds: z.number().min(1),
  expires_at: z.string().datetime(),
})

// Form validation schemas
export const loginFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const settingsFormSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  units_per_bet: z.number().min(0.1).max(100),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    new_picks: z.boolean(),
    results: z.boolean(),
  }),
  betting_preferences: z.object({
    sports: z.array(z.enum(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab', 'soccer', 'tennis', 'golf'])),
    bet_types: z.array(z.enum(['moneyline', 'spread', 'total', 'player_prop', 'team_prop', 'futures'])),
    risk_tolerance: z.enum(['low', 'medium', 'high']),
    max_units_per_bet: z.number().min(0.1).max(100),
  }),
})

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreatePickInput = z.infer<typeof createPickSchema>
export type UpdatePickInput = z.infer<typeof updatePickSchema>
export type CreateGameInput = z.infer<typeof createGameSchema>
export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type CreatePickResultInput = z.infer<typeof createPickResultSchema>
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>
export type PickFilters = z.infer<typeof pickFiltersSchema>
export type GameFilters = z.infer<typeof gameFiltersSchema>
export type SearchInput = z.infer<typeof searchSchema>
export type ExternalPickInput = z.infer<typeof externalPickSchema>
export type LoginFormInput = z.infer<typeof loginFormSchema>
export type RegisterFormInput = z.infer<typeof registerFormSchema>
export type SettingsFormInput = z.infer<typeof settingsFormSchema>
