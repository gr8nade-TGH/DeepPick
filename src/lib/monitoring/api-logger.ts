import { getSupabaseAdmin } from '@/lib/supabase/server'

export interface ApiCallLog {
  apiProvider: string
  endpoint: string
  method?: string
  requestParams?: any
  responseStatus?: number
  responseTimeMs?: number
  responseSizeBytes?: number
  eventsReceived?: number
  bookmakersReceived?: string[]
  sportsReceived?: string[]
  dataSnapshot?: any
  apiCallsRemaining?: number
  apiCallsUsed?: number
  success: boolean
  errorMessage?: string
  errorDetails?: any
  triggeredBy?: string
  notes?: string
}

export interface GameChangeDetail {
  gameId: string
  matchup: string
  sport: string
  action: 'added' | 'updated' | 'skipped'
  bookmakersBefore?: string[]
  bookmakersAfter: string[]
  oddsChangesSummary?: {
    moneylineChanged: boolean
    spreadChanged: boolean
    totalChanged: boolean
    largestSwing?: number
  }
  beforeSnapshot?: any
  afterSnapshot?: any
  warnings?: string[]
}

export interface IngestionLog {
  apiCallId?: string
  gamesAdded?: number
  gamesUpdated?: number
  gamesSkipped?: number
  oddsHistoryRecordsCreated?: number
  gamesMissingOdds?: number
  gamesMissingTeams?: number
  incompleteRecords?: number
  sportBreakdown?: Record<string, number>
  bookmakerBreakdown?: Record<string, number>
  processingTimeMs?: number
  success: boolean
  errorMessage?: string
  warnings?: string[]
  gameDetails?: GameChangeDetail[] // NEW: Detailed per-game changes
}

/**
 * Log an API call to the monitoring system
 */
export async function logApiCall(log: ApiCallLog): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('api_calls')
      .insert({
        api_provider: log.apiProvider,
        endpoint: log.endpoint,
        method: log.method || 'GET',
        request_params: log.requestParams,
        response_status: log.responseStatus,
        response_time_ms: log.responseTimeMs,
        response_size_bytes: log.responseSizeBytes,
        events_received: log.eventsReceived,
        bookmakers_received: log.bookmakersReceived,
        sports_received: log.sportsReceived,
        data_snapshot: log.dataSnapshot,
        api_calls_remaining: log.apiCallsRemaining,
        api_calls_used: log.apiCallsUsed,
        success: log.success,
        error_message: log.errorMessage,
        error_details: log.errorDetails,
        triggered_by: log.triggeredBy || 'unknown',
        notes: log.notes,
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ [API-LOGGER] Failed to log API call:', error)
      return null
    }

    console.log(`📊 [API-LOGGER] Logged API call: ${log.apiProvider}${log.endpoint} (${log.success ? 'success' : 'failed'})`)
    return data.id
  } catch (error) {
    console.error('❌ [API-LOGGER] Error logging API call:', error)
    return null
  }
}

/**
 * Log data ingestion results
 */
export async function logIngestion(log: IngestionLog): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from('data_ingestion_logs')
      .insert({
        api_call_id: log.apiCallId,
        games_added: log.gamesAdded || 0,
        games_updated: log.gamesUpdated || 0,
        games_skipped: log.gamesSkipped || 0,
        odds_history_records_created: log.oddsHistoryRecordsCreated || 0,
        games_missing_odds: log.gamesMissingOdds || 0,
        games_missing_teams: log.gamesMissingTeams || 0,
        incomplete_records: log.incompleteRecords || 0,
        sport_breakdown: log.sportBreakdown,
        bookmaker_breakdown: log.bookmakerBreakdown,
        processing_time_ms: log.processingTimeMs,
        success: log.success,
        error_message: log.errorMessage,
        warnings: log.warnings,
        game_details: log.gameDetails, // NEW: Store detailed changes
      })

    if (error) {
      console.error('❌ [API-LOGGER] Failed to log ingestion:', error)
      return
    }

    console.log(`📊 [API-LOGGER] Logged ingestion: +${log.gamesAdded} games, ~${log.gamesUpdated} updated, ${log.gameDetails?.length || 0} details`)
  } catch (error) {
    console.error('❌ [API-LOGGER] Error logging ingestion:', error)
  }
}

/**
 * Get API usage summary
 */
export async function getApiUsageSummary(provider: string, periodType: 'daily' | 'monthly' = 'daily') {
  try {
    const periodStart = periodType === 'daily' 
      ? new Date().toISOString().split('T')[0]
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const { data, error } = await getSupabaseAdmin()
      .from('api_quota_tracking')
      .select('*')
      .eq('api_provider', provider)
      .eq('period_type', periodType)
      .eq('period_start', periodStart)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ [API-LOGGER] Failed to get usage summary:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('❌ [API-LOGGER] Error getting usage summary:', error)
    return null
  }
}

/**
 * Get recent API calls
 */
export async function getRecentApiCalls(provider?: string, limit: number = 50) {
  try {
    let query = getSupabaseAdmin()
      .from('api_calls')
      .select('*')
      .order('request_timestamp', { ascending: false })
      .limit(limit)

    if (provider) {
      query = query.eq('api_provider', provider)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ [API-LOGGER] Failed to get recent calls:', error)
      return []
    }

    return data
  } catch (error) {
    console.error('❌ [API-LOGGER] Error getting recent calls:', error)
    return []
  }
}

/**
 * Calculate data quality score (0-100)
 */
export function calculateDataQualityScore(ingestionLog: IngestionLog): number {
  const total = (ingestionLog.gamesAdded || 0) + (ingestionLog.gamesUpdated || 0)
  if (total === 0) return 0

  const incomplete = ingestionLog.incompleteRecords || 0
  const missingOdds = ingestionLog.gamesMissingOdds || 0
  const missingTeams = ingestionLog.gamesMissingTeams || 0

  const issues = incomplete + missingOdds + missingTeams
  const qualityScore = Math.max(0, 100 - (issues / total * 100))

  return Math.round(qualityScore)
}

