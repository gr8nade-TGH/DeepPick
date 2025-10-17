import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('🔍 Testing Supabase connection...')
    
    // Test 1: Check if we can connect
    const { data: testData, error: testError } = await supabase
      .from('games')
      .select('count')
      .limit(1)

    if (testError) {
      return NextResponse.json({
        success: false,
        error: `Database connection failed: ${testError.message}`,
        details: testError
      })
    }

    // Test 2: Try to insert a simple test record
    const testGame = {
      id: crypto.randomUUID(),
      sport: 'nfl',
      league: 'Test League',
      home_team: { name: 'Test Home', abbreviation: 'TH' },
      away_team: { name: 'Test Away', abbreviation: 'TA' },
      game_date: '2025-10-18',
      game_time: '12:00:00',
      status: 'scheduled',
      odds: { test: 'data' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: insertError } = await supabase
      .from('games')
      .upsert(testGame, { onConflict: 'id' })

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Database insert failed: ${insertError.message}`,
        details: insertError,
        testGame
      })
    }

    // Test 3: Try to read it back
    const { data: readData, error: readError } = await supabase
      .from('games')
      .select('*')
      .eq('id', testGame.id)

    if (readError) {
      return NextResponse.json({
        success: false,
        error: `Database read failed: ${readError.message}`,
        details: readError
      })
    }

    // Clean up test record
    await supabase
      .from('games')
      .delete()
      .eq('id', testGame.id)

    return NextResponse.json({
      success: true,
      message: 'Database connection and operations working',
      testGame,
      readData: readData?.[0]
    })

  } catch (error) {
    console.error('❌ Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    })
  }
}
