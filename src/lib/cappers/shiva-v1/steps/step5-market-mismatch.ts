import { z } from 'zod'
import type { Step5MarketDTO } from '../types'

export const Step5Input = z.object({
  runId: z.string().uuid(),
})

export type Step5Input = z.infer<typeof Step5Input>

export interface Step5Output {
  confMarketAdj: number
  confFinal: number
  dominant: 'side' | 'total'
}

export async function runStep5MarketMismatch(input: Step5Input): Promise<Step5Output> {
  // Stub: compute side/total edges from active snapshot; apply 1.2 adjustment; clamp to [1,5]
  throw new Error('Not implemented')
}


