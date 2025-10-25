import { ensureApiEnabled, jsonError, jsonOk } from '@/lib/api/shiva-v1/route-helpers'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: { run_id: string } }) {
  const apiErr = ensureApiEnabled()
  if (apiErr) return apiErr
  const runId = params.run_id
  const admin = getSupabaseAdmin()

  const run = await admin.from('runs').select('*').eq('run_id', runId).maybeSingle()
  if (!run.data) return jsonError('NOT_FOUND', 'Run not found', 404)

  const snapshot = await admin.from('odds_snapshots').select('*').eq('run_id', runId).eq('is_active', true).maybeSingle()
  const factors = await admin.rpc('noop') // placeholder; will query latest per factor via SQL or app logic

  return jsonOk({ run: run.data, active_snapshot: snapshot.data || null, latest_factors: [] })
}


