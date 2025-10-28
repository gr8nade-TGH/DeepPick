/**
 * Test MySportsFeeds API Connection
 * GET /api/test/mysportsfeeds
 */

import { NextResponse } from 'next/server'

const MYSPORTSFEEDS_API_KEY = process.env.MYSPORTSFEEDS_API_KEY

export async function GET(request: Request) {
  try {
    // Get yesterday's date in YYYYMMDD format
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '')
    
    console.log(`[MySportsFeeds Test] Testing with date: ${dateStr}...`)
    
    // Test basic auth
    const credentials = `${MYSPORTSFEEDS_API_KEY}:MYSPORTSFEEDS`
    const encoded = Buffer.from(credentials).toString('base64')
    
    // Try to fetch team game logs
    const url = `https://api.mysportsfeeds.com/v2.1/pull/nba/latest/date/${dateStr}/team_gamelogs.json?team=BOS`
    
    console.log(`[MySportsFeeds Test] Fetching: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${encoded}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[MySportsFeeds Test] API Error (${response.status}):`, errorText)
      
      return NextResponse.json({
        success: false,
        status: response.status,
        error: errorText,
        url,
        timestamp: new Date().toISOString()
      }, { status: response.status })
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'MySportsFeeds API connection successful!',
      testDate: dateStr,
      sampleData: data,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[MySportsFeeds Test] Error:', errorMessage)
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
