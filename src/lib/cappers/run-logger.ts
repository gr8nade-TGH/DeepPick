/**
 * Algorithm Run Logger
 * 
 * Logs every algorithm execution for debugging and monitoring
 */

import { supabaseAdmin } from '@/lib/supabase/server'

export interface AlgorithmRunLog {
  id?: string
  capper: string
  triggerType: 'manual' | 'cron' | 'api'
  startedAt: string
  completedAt?: string
  durationMs?: number
  status: 'running' | 'success' | 'error' | 'no_games' | 'no_picks'
  gamesAnalyzed: number
  picksGenerated: number
  picksSkipped: number
  errorMessage?: string
  errorStack?: string
  summary?: {
    gamesWithOdds: number
    gamesWithoutOdds: number
    existingPicksFound: number
    passedGames: Array<{
      game: string
      reason: string
    }>
    generatedPicks: Array<{
      game: string
      pickType: string
      confidence: number
      selection: string
    }>
    skippedGames: Array<{
      game: string
      reason: string
      existingPickType: string
    }>
    errors: string[]
  }
}

/**
 * Start a new algorithm run log
 */
export async function startRunLog(
  capper: string,
  triggerType: 'manual' | 'cron' | 'api'
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('algorithm_runs')
    .insert({
      capper,
      trigger_type: triggerType,
      started_at: new Date().toISOString(),
      status: 'running',
      games_analyzed: 0,
      picks_generated: 0,
      picks_skipped: 0,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error starting run log:', error)
    throw error
  }

  return data.id
}

/**
 * Update run log with success
 */
export async function completeRunLog(
  runId: string,
  data: {
    gamesAnalyzed: number
    picksGenerated: number
    picksSkipped: number
    summary: AlgorithmRunLog['summary']
  }
): Promise<void> {
  const completedAt = new Date().toISOString()
  
  const { error } = await supabaseAdmin
    .from('algorithm_runs')
    .update({
      completed_at: completedAt,
      status: data.picksGenerated > 0 ? 'success' : 'no_picks',
      games_analyzed: data.gamesAnalyzed,
      picks_generated: data.picksGenerated,
      picks_skipped: data.picksSkipped,
      summary: data.summary,
    })
    .eq('id', runId)

  if (error) {
    console.error('Error completing run log:', error)
  }
}

/**
 * Update run log with error
 */
export async function errorRunLog(
  runId: string,
  error: Error | string
): Promise<void> {
  const completedAt = new Date().toISOString()
  const errorMessage = error instanceof Error ? error.message : error
  const errorStack = error instanceof Error ? error.stack : undefined

  await supabaseAdmin
    .from('algorithm_runs')
    .update({
      completed_at: completedAt,
      status: 'error',
      error_message: errorMessage,
      error_stack: errorStack,
    })
    .eq('id', runId)
}

/**
 * Update run log when no games available
 */
export async function noGamesRunLog(runId: string): Promise<void> {
  const completedAt = new Date().toISOString()

  await supabaseAdmin
    .from('algorithm_runs')
    .update({
      completed_at: completedAt,
      status: 'no_games',
      games_analyzed: 0,
      picks_generated: 0,
      picks_skipped: 0,
    })
    .eq('id', runId)
}

/**
 * Get recent run logs for a capper
 */
export async function getRecentRunLogs(
  capper: string,
  limit: number = 50
): Promise<AlgorithmRunLog[]> {
  const { data, error } = await supabaseAdmin
    .from('algorithm_runs')
    .select('*')
    .eq('capper', capper)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching run logs:', error)
    return []
  }

  return (data || []).map(row => ({
    id: row.id,
    capper: row.capper,
    triggerType: row.trigger_type,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    status: row.status,
    gamesAnalyzed: row.games_analyzed,
    picksGenerated: row.picks_generated,
    picksSkipped: row.picks_skipped,
    errorMessage: row.error_message,
    errorStack: row.error_stack,
    summary: row.summary,
  }))
}

/**
 * Calculate duration and update
 */
export async function calculateDuration(runId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('algorithm_runs')
    .select('started_at, completed_at')
    .eq('id', runId)
    .single()

  if (error || !data || !data.completed_at) return

  const duration = new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()

  await supabaseAdmin
    .from('algorithm_runs')
    .update({ duration_ms: duration })
    .eq('id', runId)
}

