'use client'

import { useAuth } from '@/contexts/auth-context'
import { GlobalBettingSlip } from './global-betting-slip'

export function GlobalBettingSlipWrapper() {
  const { user, profile } = useAuth()

  // Only show betting slip for logged-in cappers and admins
  if (!user || !profile) return null

  const isCapper = profile.role === 'capper' || profile.role === 'admin'
  if (!isCapper) return null

  return <GlobalBettingSlip capperId={user.id} isCapper={isCapper} />
}

