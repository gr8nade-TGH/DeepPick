import { z } from 'zod'
import type { Step6PickDTO } from '../types'

export const Step6Input = z.object({
  runId: z.string().uuid(),
})

export type Step6Input = z.infer<typeof Step6Input>

export interface Step6Output {
  decision: 'pass' | 'pick'
  units: number
  pickType?: 'spread' | 'moneyline' | 'total_over' | 'total_under'
}

export async function runStep6PickGenerator(input: Step6Input): Promise<Step6Output> {
  // Stub: map Conf_final to units; apply fav/dog ML heuristics; persist to picks with run_id
  throw new Error('Not implemented')
}


