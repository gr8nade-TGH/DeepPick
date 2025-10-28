/**
 * Test MySportsFeeds Game Logs API
 * GET /api/test/gamelogs?team=BOS
 */

import { NextResponse } from 'next/server'

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY
const MYSPORTSFEEDS_BASE_URL = 'https://api.mysportsfeeds.com/v2.1/pull/nba'

function getAuthHeader(): string {
  if (!MYSPORTSFEEDS_API_KEY) {
    throw new Error('MYSPORTSFEEDS_API_KEY environment variable not set')
  }
  
  const credentials = `${MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`
  const encoded = Buffer.from(credentials).toString('base64')
  
  return `Basic ${encoded}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const team = searchParams.get('team') || 'BOS'
    
    // Get today's date in YYYYMMDD format
    const today = new Date()
    const dateStr = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0')
    
    const url = `${MYSPORTSFEEDS_BASE_URL}/latest/date/${dateStr}/team_gamelogs.json?team=${team}`
    
    console.log(`[Game Logs Test] Fetching from: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(),
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Game Logs Test] API Error (${response.status}):`, errorText)
      return NextResponse.json({
        success: false,
        error: `API returned ${response.status}`,
        errorText: errorText.substring(0, 500)
      }, { status: response.status })
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      team,
      date: dateStr,
      url,
      responseKeys: Object.keys(data),
      gameLogCount: data.gamelogs?.length || 0,
      sampleGameLog: data.gamelogs?.[0] || null,
      fullResponse: data
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Game Logs Test] Error:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

