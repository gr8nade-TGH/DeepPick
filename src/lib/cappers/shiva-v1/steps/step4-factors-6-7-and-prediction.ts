import { z } from 'zod'
import type { Step4PredictionDTO } from '../types'

export const Step4Input = z.object({
  runId: z.string().uuid(),
  aiProvider: z.enum(['perplexity', 'openai']).optional(),
})

export type Step4Input = z.infer<typeof Step4Input>

export interface Step4Output {
  conf7: number
  spreadPred: number
  totalPred: number
  ptsA: number
  ptsB: number
}

export async function runStep4Prediction(input: Step4Input): Promise<Step4Output> {
  // Stub: compute F6-F7 + pace, delta, spread/total, scores, Conf7
  throw new Error('Not implemented')
}


