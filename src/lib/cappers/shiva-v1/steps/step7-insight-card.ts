import { z } from 'zod'
import type { Step7InsightCardDTO } from '../types'

export const Step7Input = z.object({
  runId: z.string().uuid(),
})

export type Step7Input = z.infer<typeof Step7Input>

export interface Step7Output {
  rendered: Record<string, unknown>
}

export async function runStep7InsightCard(input: Step7Input): Promise<Step7Output> {
  // Stub: assemble numeric, concise card with badges/mini bars; persist rendered_json
  throw new Error('Not implemented')
}


