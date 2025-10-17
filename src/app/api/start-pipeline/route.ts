import { NextResponse } from 'next/server'
import { OddsIngestionService } from '@/lib/data-pipeline/odds-ingestion'

export async function POST() {
  try {
    console.log('🚀 Starting odds data pipeline...')
    
    const ingestionService = OddsIngestionService.getInstance()
    await ingestionService.startIngestion()
    
    return NextResponse.json({
      success: true,
      message: 'Odds data pipeline started successfully',
      refresh_interval: '5 minutes'
    })
    
  } catch (error) {
    console.error('❌ Error starting pipeline:', error)
    return NextResponse.json({ 
      error: 'Failed to start pipeline',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    console.log('⏹️ Stopping odds data pipeline...')
    
    const ingestionService = OddsIngestionService.getInstance()
    ingestionService.stopIngestion()
    
    return NextResponse.json({
      success: true,
      message: 'Odds data pipeline stopped successfully'
    })
    
  } catch (error) {
    console.error('❌ Error stopping pipeline:', error)
    return NextResponse.json({ 
      error: 'Failed to stop pipeline',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
