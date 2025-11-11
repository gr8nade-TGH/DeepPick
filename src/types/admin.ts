/**
 * Admin Panel Type Definitions
 * Centralized type definitions for admin features
 */

export type UserRole = 'free' | 'capper' | 'admin'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  username: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
  email_confirmed_at: string | null
}

export interface UserStats {
  total_picks: number
  wins: number
  losses: number
  pushes: number
  net_units: number
  win_rate: number
  roi: number
  last_pick_at: string | null
}

export interface UserWithStats extends UserProfile {
  stats: UserStats
}

export interface AdminUserFilters {
  role?: UserRole | 'all'
  search?: string
  sortBy?: 'created_at' | 'total_picks' | 'net_units' | 'email'
  sortOrder?: 'asc' | 'desc'
}

export interface RoleChangeRequest {
  userId: string
  newRole: UserRole
  reason?: string
}

export interface RoleChangeResponse {
  success: boolean
  user?: UserProfile
  error?: string
}

/**
 * Public User Profile Types
 */

export interface PublicUserProfile {
  id: string
  email: string
  full_name: string | null
  username: string | null
  role: UserRole
  avatar_url: string | null
  bio: string | null
  twitter_url: string | null
  instagram_url: string | null
  created_at: string
}

export interface PickTypeStats {
  picks: number
  wins: number
  losses: number
  netUnits: number
  winRate: number
}

export interface UserProfileStats {
  total_picks: number
  pending_picks: number
  wins: number
  losses: number
  pushes: number
  net_units: number
  win_rate: number
  roi: number
  current_streak: number
  current_streak_type: 'win' | 'loss' | null
  longest_win_streak: number
  longest_loss_streak: number
  by_pick_type: {
    total: PickTypeStats
    spread: PickTypeStats
    moneyline: PickTypeStats
  }
}

export interface UserPick {
  id: string
  game_id: string | null
  capper: string
  pick_type: string
  selection: string
  odds: number
  units: number
  confidence: number
  status: string
  net_units: number | null
  created_at: string
  graded_at: string | null
  is_system_pick: boolean
  game_snapshot: any
  result: any
  results_analysis: string | null
}

export interface UserProfileData {
  profile: PublicUserProfile
  stats: UserProfileStats
  picks: UserPick[]
  last_updated: string
}

