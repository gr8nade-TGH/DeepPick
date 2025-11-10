'use client'

import { GlobalBettingSlip } from './global-betting-slip'

export function GlobalBettingSlipWrapper() {
  // TODO: Get actual user/capper info from auth context
  // For now, hardcode as capper for testing
  const isCapper = true
  const capperId = 'shiva'

  return <GlobalBettingSlip capperId={capperId} isCapper={isCapper} />
}

