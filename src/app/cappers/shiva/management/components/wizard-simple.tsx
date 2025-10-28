// Simplified Step 2 execution for debugging
export async function executeStep2Simple(stepLogs: any, runId: string, postJson: any) {
  console.log('[Step 2] Starting SIMPLE Step 2 execution...')
  
  try {
    // Get game data from Step 1
    const step1Game = stepLogs[1]?.json?.selected_game
    if (!step1Game) {
      throw new Error('No game data from Step 1')
    }
    
    console.log('[Step 2] Processing odds from Step 1 game:', step1Game.home_team?.name, 'vs', step1Game.away_team?.name)
    
    // Calculate simple averages from Step 1 odds data
    let totalLine = 232.5
    let spreadLine = 0
    let mlHome = -110
    let mlAway = -110
    let avgOverOdds = -110
    let avgUnderOdds = -110
    
    if (step1Game.odds && typeof step1Game.odds === 'object') {
      const sportsbooks = Object.keys(step1Game.odds)
      console.log('[Step 2] Found', sportsbooks.length, 'sportsbooks')
      
      if (sportsbooks.length > 0) {
        // Calculate total line average
        const totals = sportsbooks
          .map(book => step1Game.odds[book]?.total?.line)
          .filter(val => val !== undefined && val !== null)
        
        if (totals.length > 0) {
          totalLine = Math.round(totals.reduce((sum, val) => sum + val, 0) / totals.length * 2) / 2
        }
        
        // Calculate average over/under odds
        const overOdds = sportsbooks
          .map(book => step1Game.odds[book]?.total?.over)
          .filter(val => val !== undefined && val !== null)
        const underOdds = sportsbooks
          .map(book => step1Game.odds[book]?.total?.under)
          .filter(val => val !== undefined && val !== null)
        avgOverOdds = overOdds.length > 0 ? Math.round(overOdds.reduce((sum, val) => sum + val, 0) / overOdds.length) : -110
        avgUnderOdds = underOdds.length > 0 ? Math.round(underOdds.reduce((sum, val) => sum + val, 0) / underOdds.length) : -110
        
        // Calculate spread line average
        const spreads = sportsbooks
          .map(book => step1Game.odds[book]?.spread?.line)
          .filter(val => val !== undefined && val !== null)
        
        if (spreads.length > 0) {
          spreadLine = Math.round(spreads.reduce((sum, val) => sum + val, 0) / spreads.length * 2) / 2
        }
        
        // Calculate moneyline averages
        const homeMLs = sportsbooks
          .map(book => step1Game.odds[book]?.moneyline?.home)
          .filter(val => val !== undefined && val !== null)
        
        const awayMLs = sportsbooks
          .map(book => step1Game.odds[book]?.moneyline?.away)
          .filter(val => val !== undefined && val !== null)
        
        if (homeMLs.length > 0) {
          mlHome = Math.round(homeMLs.reduce((sum, val) => sum + val, 0) / homeMLs.length)
        }
        
        if (awayMLs.length > 0) {
          mlAway = Math.round(awayMLs.reduce((sum, val) => sum + val, 0) / awayMLs.length)
        }
      }
    }
    
    console.log('[Step 2] Calculated averages:', {
      totalLine,
      spreadLine,
      mlHome,
      mlAway
    })
    
    // Create simple snapshot data
    const snapshotData = {
      game_id: step1Game.id,
      sport: 'NBA' as const,
      home_team: step1Game.home_team?.name || 'Home Team',
      away_team: step1Game.away_team?.name || 'Away Team',
      start_time_utc: step1Game.game_time ? new Date(step1Game.game_time).toISOString() : new Date().toISOString(),
      captured_at_utc: new Date().toISOString(),
      books_considered: Object.keys(step1Game.odds || {}).length,
      moneyline: {
        home_avg: mlHome,
        away_avg: mlAway
      },
      spread: {
        fav_team: step1Game.home_team?.name || 'Home Team',
        line: spreadLine,
        odds: -110
      },
      total: {
        line: totalLine,
        over_odds: avgOverOdds,
        under_odds: avgUnderOdds
      },
      raw_payload: step1Game.odds
    }
    
    console.log('[Step 2] Calling odds snapshot API...')
    
    const step2IdempotencyKey = `ui-demo-snap-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const response = await postJson('/api/shiva/odds/snapshot', {
      run_id: runId,
      snapshot: snapshotData
    }, step2IdempotencyKey)
    
    console.log('[Step 2] API response:', response)
    
    return {
      success: true,
      response,
      snapshotId: response.json?.snapshot_id
    }
    
  } catch (error) {
    console.error('[Step 2] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
