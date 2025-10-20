import { z } from 'zod'
import { ensureApiEnabled, ensureWritesEnabled, jsonError, jsonOk } from '@/lib/api/shiva-v1/route-helpers'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const StateSchema = z.object({ state: z.enum(['COMPLETE', 'VOIDED']) }).strict()

export async function PATCH(request: Request, { params }: { params: { run_id: string } }) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const writeErr = ensureWritesEnabled()
  if (writeErr) return writeErr

  const body = await request.json().catch(() => null)
  const parse = StateSchema.safeParse(body)
  if (!parse.success) return jsonError('INVALID_BODY', 'Invalid request body', 400, { issues: parse.error.issues })

  const admin = getSupabaseAdmin()
  const res = await admin.from('runs').update({ state: parse.data.state }).eq('run_id', params.run_id).select('run_id, state').single()
  if (res.error) return jsonError('DB_ERROR', res.error.message, 500)
  return jsonOk({ run_id: res.data.run_id, state: res.data.state })
}


