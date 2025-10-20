import { z } from 'zod'
import type { Step3FactorsDTO } from '../types'

export const Step3Input = z.object({
  runId: z.string().uuid(),
  aiProvider: z.enum(['perplexity', 'openai']).default('perplexity').optional(),
})

export type Step3Input = z.infer<typeof Step3Input>

export interface FactorRecord {
  factorNo: 1 | 2 | 3 | 4 | 5
  rawValues: unknown
  parsedValues: Record<string, number>
  normalizedValue: number
  weightApplied: number
  capsApplied: boolean
  capReason?: string
}

export interface Step3Output {
  factors: FactorRecord[]
}

export async function runStep3Factors(input: Step3Input): Promise<Step3Output> {
  // Stub: StatMuse pulls (F1-F4) + news (F5); normalize per-100; apply caps
  throw new Error('Not implemented')
}


