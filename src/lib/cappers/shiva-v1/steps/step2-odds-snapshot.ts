import { z } from 'zod'
import type { OddsSnapshotDTO } from '../types'

export const Step2SnapshotInput = z.object({
  runId: z.string().uuid(),
})

export type Step2SnapshotInput = z.infer<typeof Step2SnapshotInput>

export interface Step2SnapshotOutput {
  snapshotId: string
  createdAt: string
}

export async function runStep2OddsSnapshot(input: Step2SnapshotInput): Promise<Step2SnapshotOutput> {
  // Stub: fetch odds from internal API, persist snapshot, enforce single active per run
  throw new Error('Not implemented')
}


