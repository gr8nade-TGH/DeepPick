import { env } from '@/lib/env'

export function ensureApiEnabled(): Response | null {
  const enabled = (env.SHIVA_V1_API_ENABLED || '').toLowerCase() === 'true'
  if (!enabled) {
    return jsonError('FEATURE_DISABLED', 'SHIVA v1 API is disabled', 403)
  }
  return null
}

export function ensureWritesEnabled(): Response | null {
  const enabled = (env.SHIVA_V1_WRITE_ENABLED || '').toLowerCase() === 'true'
  if (!enabled) {
    return jsonError('WRITES_DISABLED', 'Writes are disabled (read-only mode)', 409)
  }
  return null
}

export function jsonError(code: string, message: string, status = 400, details: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ error: { code, message, details } }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function requireIdempotencyKey(request: Request): string | Response {
  const key = request.headers.get('Idempotency-Key')
  if (!key) {
    return jsonError('MISSING_IDEMPOTENCY_KEY', 'Header Idempotency-Key is required', 400)
  }
  return key
}


