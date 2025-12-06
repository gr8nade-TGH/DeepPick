import { NextRequest, NextResponse } from 'next/server'
import { getInterpreterAnalysis, InterpreterRequest } from '@/lib/ai-insights/grok-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const interpreterRequest: InterpreterRequest = {
      awayTeam: body.awayTeam,
      homeTeam: body.homeTeam,
      spread: body.spread,
      total: body.total,
      gameDate: body.gameDate || new Date().toISOString().split('T')[0],
      betType: body.betType || 'SPREAD'
    }

    const result = await getInterpreterAnalysis(interpreterRequest)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Test Interpreter API] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

