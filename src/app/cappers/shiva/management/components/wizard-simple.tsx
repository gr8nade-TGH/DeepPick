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
    
    if (step1Game.odds && typeof step1Game.odds === 'object') {
      const sportsbooks = Object.keys(step1Game.odds)
      console.log('[Step 2] Found', sportsbooks.length, 'sportsbooks')
      
      if (sportsbooks.length > 0) {
        // Calculate total line average
        const totals = sportsbooks
          .map(book => step1Game.odds[book]?.total?.Over?.point)
          .filter(val => val !== undefined && val !== null)
        
        if (totals.length > 0) {
          totalLine = Math.round(totals.reduce((sum, val) => sum + val, 0) / totals.length * 2) / 2
        }
        
        // Calculate spread line average
        const spreads = sportsbooks
          .map(book => {
            const spread = step1Game.odds[book]?.spread
            if (spread && step1Game.home_team?.name && spread[step1Game.home_team.name]) {
              return spread[step1Game.home_team.name].point
            }
            return null
          })
          .filter(val => val !== null)
        
        if (spreads.length > 0) {
          spreadLine = Math.round(spreads.reduce((sum, val) => sum + val, 0) / spreads.length * 2) / 2
        }
        
        // Calculate moneyline averages
        const homeMLs = sportsbooks
          .map(book => step1Game.odds[book]?.moneyline?.[step1Game.home_team?.name])
          .filter(val => val !== undefined && val !== null)
        
        const awayMLs = sportsbooks
          .map(book => step1Game.odds[book]?.moneyline?.[step1Game.away_team?.name])
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
        over_odds: -110,
        under_odds: -110
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
      error: error.message
    }
  }
}
