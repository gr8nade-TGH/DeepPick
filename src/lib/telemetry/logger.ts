import { getSupabase } from '@/lib/supabase/server'

export type LogLevel = 'info' | 'warn' | 'error'
export type LogSource = 'api' | 'pipeline' | 'db' | 'external'
export type LogStatus = 'STARTED' | 'SUCCESS' | 'FAILED'

export interface LogEvent {
  level: LogLevel
  source: LogSource
  route?: string
  request_id?: string
  run_id?: string
  step?: string
  capper?: string
  status?: LogStatus
  code?: string
  http_status?: number
  duration_ms?: number
  details?: Record<string, unknown>
}

export async function logEvent(event: LogEvent): Promise<void> {
  try {
    // 1) Console in dev
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${event.level.toUpperCase()}] ${JSON.stringify(event)}`)
    }

    // 2) Persist to Supabase
    const supabase = getSupabase()
    await supabase.from('event_log').insert({
      ts: new Date().toISOString(),
      ...event,
    })

    // 3) Optional: Sentry integration could go here
    // if (event.level === 'error') {
    //   Sentry.captureException(new Error(event.details?.message as string), {
    //     tags: {
    //       source: event.source,
    //       route: event.route,
    //       capper: event.capper,
    //       step: event.step,
    //     },
    //     extra: event.details,
    //   })
    // }
  } catch (error) {
    // Don't let logging errors break the main flow
    console.error('Failed to log event:', error)
  }
}

// Convenience functions
export async function logInfo(event: Omit<LogEvent, 'level'>) {
  return logEvent({ ...event, level: 'info' })
}

export async function logWarn(event: Omit<LogEvent, 'level'>) {
  return logEvent({ ...event, level: 'warn' })
}

export async function logError(event: Omit<LogEvent, 'level'>) {
  return logEvent({ ...event, level: 'error' })
}
