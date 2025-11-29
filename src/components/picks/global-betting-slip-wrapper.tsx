'use client'

import { useAuth } from '@/contexts/auth-context'
import { GlobalBettingSlip } from './global-betting-slip'

export function GlobalBettingSlipWrapper() {
  const { user, profile } = useAuth()

  // Only show betting slip for logged-in cappers and admins
  if (!user || !profile) return null

  const isCapper = profile.role === 'capper' || profile.role === 'admin'
  if (!isCapper) return null

  // Use full_name as capper ID (not user.id which is a UUID)
  // Fall back to 'manual' if no name is set
  const capperName = profile.full_name || 'manual'

  return <GlobalBettingSlip capperId={capperName} isCapper={isCapper} />
}

