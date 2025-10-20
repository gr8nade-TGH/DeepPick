import { z } from 'zod'
import { Game, Sport } from '@/lib/dto/game'

export const Step1IntakeInput = z.object({
  gameId: z.string().uuid(),
  sport: z.literal('NBA'),
  capper: z.literal('SHIVA'),
})

export type Step1IntakeInput = z.infer<typeof Step1IntakeInput>

export interface Step1IntakeOutput {
  runId: string
  state: 'IN-PROGRESS' | 'COMPLETE' | 'NEW'
}

export async function runStep1Intake(input: Step1IntakeInput): Promise<Step1IntakeOutput> {
  // Stub: to be implemented with Supabase insert + dedup check by (game_id, capper)
  throw new Error('Not implemented')
}


