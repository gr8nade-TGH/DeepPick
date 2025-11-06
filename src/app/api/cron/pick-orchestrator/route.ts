/**
 * Pick Orchestrator Cron Job
 * 
 * Unified cron job that replaces individual capper cron jobs.
 * Runs every 2 minutes and checks capper_execution_schedules for due executions.
 * 
 * Benefits:
 * - Single cron job instead of N×M (cappers × bet types)
 * - Add new cappers by inserting database row (no code changes)
 * - Enable/disable cappers without deployment
 * - Adjust intervals without touching vercel.json
 * - Single lock prevents all conflicts
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max execution time
export const runtime = 'nodejs'

interface ExecutionSchedule {
  id: string
  capper_id: string
  sport: string
  bet_type: string
  enabled: boolean
  interval_minutes: number
  priority: number
  last_execution_at: string | null
  next_execution_at: string | null
  last_execution_status: string | null
  total_executions: number
  successful_executions: number
  failed_executions: number
}

export async function GET(request: Request) {
  const executionTime = new Date().toISOString()
  console.log(`\n🎯 [ORCHESTRATOR] ========== EXECUTION START: ${executionTime} ==========`)

  const supabase = getSupabaseAdmin()

  try {
    // Step 1: Acquire global orchestrator lock
    console.log('[ORCHESTRATOR] Step 1: Acquiring global lock...')

    const lockKey = 'pick_orchestrator_lock'
    const lockTimeout = 5 * 60 * 1000 // 5 minutes

    const { data: existingLock } = await supabase
      .from('system_locks')
      .select('*')
      .eq('lock_key', lockKey)
      .single()

    if (existingLock) {
      const lockAge = Date.now() - new Date(existingLock.locked_at).getTime()

      if (lockAge < lockTimeout) {
        console.log(`[ORCHESTRATOR] ⏸️  Lock held by another process (age: ${Math.round(lockAge / 1000)}s)`)
        return NextResponse.json({
          success: false,
          message: 'Orchestrator already running',
          lockAge: Math.round(lockAge / 1000)
        })
      }

      // Stale lock - delete it
      console.log(`[ORCHESTRATOR] ⚠️  Stale lock detected (age: ${Math.round(lockAge / 1000)}s) - removing`)
      await supabase
        .from('system_locks')
        .delete()
        .eq('lock_key', lockKey)
    }

    // Acquire lock
    const now = new Date()
    const expiresAt = new Date(now.getTime() + lockTimeout)

    const { error: lockError } = await supabase
      .from('system_locks')
      .insert({
        lock_key: lockKey,
        locked_by: 'pick-orchestrator',
        locked_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })

    if (lockError) {
      console.error('[ORCHESTRATOR] ❌ Failed to acquire lock:', lockError)
      return NextResponse.json({
        success: false,
        error: 'Failed to acquire lock',
        details: lockError.message
      }, { status: 409 })
    }

    console.log('[ORCHESTRATOR] ✅ Lock acquired')

    // Step 2: Find due schedules
    console.log('[ORCHESTRATOR] Step 2: Finding due schedules...')

    const nowISO = new Date().toISOString()

    const { data: dueSchedules, error: scheduleError } = await supabase
      .from('capper_execution_schedules')
      .select('*')
      .eq('enabled', true)
      .or(`next_execution_at.is.null,next_execution_at.lte.${nowISO}`)
      .order('priority', { ascending: false }) // Higher priority first
      .order('next_execution_at', { ascending: true }) // Oldest due first

    if (scheduleError) {
      console.error('[ORCHESTRATOR] ❌ Error fetching schedules:', scheduleError)
      throw scheduleError
    }

    console.log(`[ORCHESTRATOR] Found ${dueSchedules?.length || 0} due schedules`)

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('[ORCHESTRATOR] ✅ No schedules due - releasing lock')

      await supabase
        .from('system_locks')
        .delete()
        .eq('lock_key', lockKey)

      return NextResponse.json({
        success: true,
        message: 'No schedules due',
        executedCount: 0,
        timestamp: executionTime
      })
    }

    // Step 3: Execute each due schedule
    console.log('[ORCHESTRATOR] Step 3: Executing due schedules...')

    const results = []

    for (const schedule of dueSchedules as ExecutionSchedule[]) {
      console.log(`\n[ORCHESTRATOR] 🎯 Executing: ${schedule.capper_id} ${schedule.sport} ${schedule.bet_type}`)
      console.log(`[ORCHESTRATOR]    Priority: ${schedule.priority}, Interval: ${schedule.interval_minutes}min`)

      const executionStart = Date.now()

      try {
        // Call the appropriate pick generation endpoint
        const result = await executePick(schedule)

        const executionDuration = Date.now() - executionStart

        // Update schedule with success
        await supabase
          .from('capper_execution_schedules')
          .update({
            last_execution_at: new Date().toISOString(),
            last_execution_status: 'success',
            last_execution_error: null,
            total_executions: schedule.total_executions + 1,
            successful_executions: schedule.successful_executions + 1
          })
          .eq('id', schedule.id)

        console.log(`[ORCHESTRATOR] ✅ Success (${executionDuration}ms):`, result)

        results.push({
          schedule: `${schedule.capper_id} ${schedule.sport} ${schedule.bet_type}`,
          status: 'success',
          duration_ms: executionDuration,
          result
        })

      } catch (error) {
        const executionDuration = Date.now() - executionStart
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[ORCHESTRATOR] ❌ Failed (${executionDuration}ms):`, errorMessage)

        // Update schedule with failure
        await supabase
          .from('capper_execution_schedules')
          .update({
            last_execution_at: new Date().toISOString(),
            last_execution_status: 'failure',
            last_execution_error: errorMessage,
            total_executions: schedule.total_executions + 1,
            failed_executions: schedule.failed_executions + 1
          })
          .eq('id', schedule.id)

        results.push({
          schedule: `${schedule.capper_id} ${schedule.sport} ${schedule.bet_type}`,
          status: 'failure',
          duration_ms: executionDuration,
          error: errorMessage
        })
      }
    }

    // Step 4: Release lock
    console.log('[ORCHESTRATOR] Step 4: Releasing lock...')

    await supabase
      .from('system_locks')
      .delete()
      .eq('lock_key', lockKey)

    console.log('[ORCHESTRATOR] ✅ Lock released')

    console.log(`\n🎯 [ORCHESTRATOR] ========== EXECUTION COMPLETE ==========`)
    console.log(`[ORCHESTRATOR] Executed: ${results.length} schedules`)
    console.log(`[ORCHESTRATOR] Success: ${results.filter(r => r.status === 'success').length}`)
    console.log(`[ORCHESTRATOR] Failed: ${results.filter(r => r.status === 'failure').length}`)

    return NextResponse.json({
      success: true,
      executedCount: results.length,
      results,
      timestamp: executionTime
    })

  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Unexpected error:', error)

    // Release lock on error
    try {
      await supabase
        .from('system_locks')
        .delete()
        .eq('lock_key', 'pick_orchestrator_lock')
      console.log('🎯 [ORCHESTRATOR] ✅ Lock released (error path)')
    } catch (lockErr) {
      console.error('🎯 [ORCHESTRATOR] Error releasing lock on error:', lockErr)
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: executionTime
    }, { status: 500 })
  }
}

/**
 * Execute pick generation for a specific schedule
 */
async function executePick(schedule: ExecutionSchedule): Promise<any> {
  // Route to existing cron endpoints
  // In Phase 3, this will use the unified /api/cappers/generate-pick endpoint

  if (schedule.capper_id === 'shiva') {
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    // Route to existing SHIVA cron endpoints based on bet type
    const endpoint = schedule.bet_type === 'SPREAD'
      ? `${baseUrl}/api/cron/shiva-auto-picks-spread`
      : `${baseUrl}/api/cron/shiva-auto-picks`

    console.log(`[ORCHESTRATOR] Calling: ${endpoint}`)

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'User-Agent': 'DeepPick-Orchestrator/1.0'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Pick generation failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  throw new Error(`Unknown capper: ${schedule.capper_id}`)
}

// Also allow POST for manual triggers
export async function POST(request: Request) {
  return GET(request)
}

