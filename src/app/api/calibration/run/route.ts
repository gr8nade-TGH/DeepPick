/**
 * Calibration Run API
 * Trigger model calibration analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { runCalibration, getCalibrationStats } from '@/lib/cappers/shiva-v1/calibration'
import { z } from 'zod'

const CalibrationRequestSchema = z.object({
  model_version: z.string().default('nba_totals_v1'),
  sample_size: z.number().min(20).max(1000).default(100),
  min_conf_score: z.number().min(0).max(5).default(1.0)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model_version, sample_size, min_conf_score } = CalibrationRequestSchema.parse(body)
    
    // Run calibration
    const result = await runCalibration(model_version, sample_size, min_conf_score)
    
    // Get updated stats
    const stats = await getCalibrationStats(model_version)
    
    return NextResponse.json({
      success: true,
      calibration: result,
      stats
    })
    
  } catch (error) {
    console.error('[Calibration] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modelVersion = searchParams.get('model_version') || 'nba_totals_v1'
    
    const stats = await getCalibrationStats(modelVersion)
    
    return NextResponse.json({
      success: true,
      stats
    })
    
  } catch (error) {
    console.error('[Calibration] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
