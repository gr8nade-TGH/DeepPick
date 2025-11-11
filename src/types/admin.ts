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

