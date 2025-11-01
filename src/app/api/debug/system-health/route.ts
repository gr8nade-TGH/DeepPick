import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getNBASeason } from '@/lib/data-sources/season-utils'

/**
 * COMPREHENSIVE SYSTEM HEALTH CHECK
 * 
 * This endpoint checks EVERYTHING to diagnose why picks aren't being generated
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: [],
    warnings: [],
    summary: ''
  }

  const supabase = getSupabaseAdmin()

  // ============================================================================
  // CHECK 1: Environment Variables
  // ============================================================================
  console.log('[HEALTH] Checking environment variables...')
  results.checks.env_vars = {
    DISABLE_SHIVA_CRON: process.env.DISABLE_SHIVA_CRON || 'not set',
    MYSPORTSFEEDS_API_KEY: process.env.MYSPORTSFEEDS_API_KEY ? 'SET' : 'MISSING',
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING'
  }

  if (process.env.DISABLE_SHIVA_CRON === 'true') {
    results.errors.push('CRITICAL: DISABLE_SHIVA_CRON is set to true - cron is disabled!')
  }

  if (!process.env.MYSPORTSFEEDS_API_KEY) {
    results.errors.push('CRITICAL: MYSPORTSFEEDS_API_KEY is missing!')
  }

  // ============================================================================
  // CHECK 2: Capper Profiles
  // ============================================================================
  console.log('[HEALTH] Checking capper profiles...')
  const { data: profiles, error: profileError } = await supabase
    .from('capper_profiles')
    .select('*')
    .eq('capper_id', 'shiva')
    .eq('sport', 'NBA')
    .eq('bet_type', 'TOTAL')

  results.checks.capper_profiles = {
    total_count: profiles?.length || 0,
    profiles: profiles || [],
    error: profileError?.message || null
  }

  const activeProfiles = profiles?.filter(p => p.is_active) || []
  const defaultProfiles = profiles?.filter(p => p.is_active && p.is_default) || []

  if (!profiles || profiles.length === 0) {
    results.errors.push('CRITICAL: No SHIVA NBA TOTAL profiles found in database!')
  } else if (activeProfiles.length === 0) {
    results.errors.push('CRITICAL: No active SHIVA NBA TOTAL profiles found!')
  } else if (defaultProfiles.length === 0) {
    results.errors.push('CRITICAL: No default SHIVA NBA TOTAL profile found! Set is_default=true on one profile.')
  } else if (defaultProfiles.length > 1) {
    results.warnings.push(`WARNING: Multiple default profiles found (${defaultProfiles.length}). Only one should have is_default=true.`)
  }

  // Check if default profile has factors configured
  if (defaultProfiles.length > 0) {
    const defaultProfile = defaultProfiles[0]
    if (!defaultProfile.factors || defaultProfile.factors.length === 0) {
      results.errors.push('CRITICAL: Default profile has no factors configured!')
    } else {
      const enabledFactors = defaultProfile.factors.filter((f: any) => f.enabled)
      if (enabledFactors.length === 0) {
        results.errors.push('CRITICAL: Default profile has no enabled factors!')
      } else {
        results.checks.capper_profiles.enabled_factors = enabledFactors.map((f: any) => ({
          key: f.key,
          weight: f.weight
        }))
      }
    }
  }

  // ============================================================================
  // CHECK 3: MySportsFeeds API
  // ============================================================================
  console.log('[HEALTH] Checking MySportsFeeds API...')
  const season = getNBASeason()
  results.checks.mysportsfeeds = {
    season: season.season,
    api_key_present: !!process.env.MYSPORTSFEEDS_API_KEY
  }

  // Try to fetch today's games
  try {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')
    const url = `https://api.mysportsfeeds.com/v2.1/pull/nba/${season.season}/date/${dateStr}/games.json`
    
    const authHeader = process.env.MYSPORTSFEEDS_API_KEY 
      ? `Basic ${Buffer.from(`${process.env.MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`).toString('base64')}`
      : null

    if (!authHeader) {
      results.errors.push('CRITICAL: Cannot test MySportsFeeds API - no API key!')
    } else {
      const response = await fetch(url, {
        headers: {
          'Authorization': authHeader,
          'Accept-Encoding': 'gzip'
        }
      })

      results.checks.mysportsfeeds.test_request = {
        url,
        status: response.status,
        ok: response.ok
      }

      if (!response.ok) {
        const text = await response.text()
        results.errors.push(`MySportsFeeds API error: ${response.status} - ${text.substring(0, 200)}`)
      } else {
        const data = await response.json()
        results.checks.mysportsfeeds.games_found = data.games?.length || 0
        if (data.games?.length === 0) {
          results.warnings.push('WARNING: MySportsFeeds returned 0 games for today. This might be normal if no games are scheduled.')
        }
      }
    }
  } catch (error: any) {
    results.errors.push(`MySportsFeeds API test failed: ${error.message}`)
  }

  // ============================================================================
  // CHECK 4: Database - Games Table
  // ============================================================================
  console.log('[HEALTH] Checking games table...')
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'nba')
    .in('status', ['scheduled', 'live'])
    .gte('game_date', new Date().toISOString().split('T')[0])
    .order('game_date', { ascending: true })
    .limit(10)

  results.checks.games_table = {
    upcoming_games_count: games?.length || 0,
    error: gamesError?.message || null,
    sample_games: games?.slice(0, 3).map(g => ({
      id: g.id,
      matchup: `${g.away_team?.abbreviation || '???'} @ ${g.home_team?.abbreviation || '???'}`,
      date: g.game_date,
      status: g.status
    })) || []
  }

  if (!games || games.length === 0) {
    results.warnings.push('WARNING: No upcoming NBA games found in database. Run sync-mysportsfeeds-odds cron to populate.')
  }

  // ============================================================================
  // CHECK 5: Database - Runs Table
  // ============================================================================
  console.log('[HEALTH] Checking runs table...')
  const { data: runs, error: runsError } = await supabase
    .from('runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  results.checks.runs_table = {
    total_recent_runs: runs?.length || 0,
    error: runsError?.message || null,
    latest_run: runs?.[0] ? {
      run_id: runs[0].run_id,
      created_at: runs[0].created_at,
      state: runs[0].state
    } : null
  }

  // ============================================================================
  // CHECK 6: Database - Cooldowns Table
  // ============================================================================
  console.log('[HEALTH] Checking cooldowns table...')
  const { data: cooldowns, error: cooldownsError } = await supabase
    .from('pick_generation_cooldowns')
    .select('*')
    .eq('capper', 'shiva')
    .order('created_at', { ascending: false })
    .limit(5)

  const activeCooldowns = cooldowns?.filter(c => new Date(c.cooldown_until) > new Date()) || []

  results.checks.cooldowns_table = {
    total_cooldowns: cooldowns?.length || 0,
    active_cooldowns: activeCooldowns.length,
    error: cooldownsError?.message || null,
    latest_cooldown: cooldowns?.[0] ? {
      game_id: cooldowns[0].game_id,
      result: cooldowns[0].result,
      cooldown_until: cooldowns[0].cooldown_until,
      is_active: new Date(cooldowns[0].cooldown_until) > new Date()
    } : null
  }

  // ============================================================================
  // CHECK 7: Test Step 1 Scanner
  // ============================================================================
  console.log('[HEALTH] Testing Step 1 Scanner...')
  try {
    const scannerResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'https://').replace('.supabase.co', '')}/api/shiva/step1-scanner?sport=NBA&betType=TOTAL`, {
      method: 'GET'
    })

    results.checks.step1_scanner = {
      status: scannerResponse.status,
      ok: scannerResponse.ok
    }

    if (scannerResponse.ok) {
      const scannerData = await scannerResponse.json()
      results.checks.step1_scanner.eligible_games = scannerData.eligibleGames?.length || 0
      results.checks.step1_scanner.selected_game = scannerData.selectedGame ? {
        id: scannerData.selectedGame.id,
        matchup: scannerData.selectedGame.matchup
      } : null

      if (scannerData.eligibleGames?.length === 0) {
        results.warnings.push('WARNING: Step 1 Scanner found 0 eligible games. All games may be in cooldown or already have picks.')
      }
    } else {
      const errorText = await scannerResponse.text()
      results.errors.push(`Step 1 Scanner failed: ${scannerResponse.status} - ${errorText.substring(0, 200)}`)
    }
  } catch (error: any) {
    results.errors.push(`Step 1 Scanner test failed: ${error.message}`)
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  if (results.errors.length === 0 && results.warnings.length === 0) {
    results.summary = '✅ ALL CHECKS PASSED - System appears healthy'
  } else if (results.errors.length > 0) {
    results.summary = `❌ ${results.errors.length} CRITICAL ERROR(S) FOUND - System is broken`
  } else {
    results.summary = `⚠️ ${results.warnings.length} WARNING(S) FOUND - System may have issues`
  }

  console.log('[HEALTH] Check complete:', results.summary)

  return NextResponse.json(results, { 
    status: results.errors.length > 0 ? 500 : 200 
  })
}

