import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('🔍 Testing simple-ingest issues...')
    
    // Test 1: Check if upsert_game_smart function exists
    const { data: functions, error: funcError } = await getSupabaseAdmin()
      .rpc('execute_sql', {
        sql_query: `
          SELECT routine_name, routine_type 
          FROM information_schema.routines 
          WHERE routine_name = 'upsert_game_smart'
        `
      })
    
    console.log('📊 Function check:', { functions, funcError })
    
    // Test 2: Check THE_ODDS_API_KEY
    const apiKey = process.env.THE_ODDS_API_KEY
    console.log('🔑 API Key exists:', !!apiKey)
    console.log('🔑 API Key length:', apiKey?.length || 0)
    
    // Test 3: Try a simple Odds API call
    if (apiKey) {
      try {
        const response = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`)
        console.log('🌐 Odds API response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('📈 NBA events found:', data.length)
          console.log('📈 First event sample:', data[0] ? {
            id: data[0].id,
            home_team: data[0].home_team,
            away_team: data[0].away_team,
            commence_time: data[0].commence_time,
            bookmakers_count: data[0].bookmakers?.length || 0
          } : 'No events')
        } else {
          const errorText = await response.text()
          console.log('❌ Odds API error:', errorText)
        }
      } catch (apiError) {
        console.log('❌ Odds API fetch error:', apiError)
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        functionExists: functions && functions.length > 0,
        functionError: funcError?.message,
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey?.length || 0
      }
    })
    
  } catch (error) {
    console.error('❌ Debug test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
