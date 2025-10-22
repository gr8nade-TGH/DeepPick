import { logEvent, LogEvent } from './logger'

export const createRequestId = (): string => crypto.randomUUID()

export interface TracingContext {
  request_id?: string
  run_id?: string
  capper?: string
  game_id?: string
  route?: string
}

export async function withStep<T>(
  ctx: TracingContext,
  step: string,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now()
  
  // Log step start
  await logEvent({
    level: 'info',
    source: 'pipeline',
    step,
    status: 'STARTED',
    ...ctx,
  })

  try {
    const result = await fn()
    const duration = Date.now() - started
    
    // Log step success
    await logEvent({
      level: 'info',
      source: 'pipeline',
      step,
      status: 'SUCCESS',
      duration_ms: duration,
      ...ctx,
    })

    return result
  } catch (error: any) {
    const duration = Date.now() - started
    
    // Log step failure
    await logEvent({
      level: 'error',
      source: 'pipeline',
      step,
      status: 'FAILED',
      duration_ms: duration,
      code: error.code || 'UNHANDLED',
      details: {
        message: error.message,
        stack: error.stack,
      },
      ...ctx,
    })

    throw error
  }
}

export async function withApiCall<T>(
  ctx: TracingContext,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now()
  
  try {
    const result = await fn()
    const duration = Date.now() - started
    
    await logEvent({
      level: 'info',
      source: 'api',
      duration_ms: duration,
      http_status: 200,
      ...ctx,
    })

    return result
  } catch (error: any) {
    const duration = Date.now() - started
    
    await logEvent({
      level: 'error',
      source: 'api',
      duration_ms: duration,
      http_status: error.status || 500,
      code: error.code || 'UNHANDLED',
      details: {
        message: error.message,
        stack: error.stack,
      },
      ...ctx,
    })

    throw error
  }
}
