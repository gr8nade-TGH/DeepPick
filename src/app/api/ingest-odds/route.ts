import { NextResponse } from 'next/server'
import { OddsIngestionService } from '@/lib/data-pipeline/odds-ingestion'

export async function POST() {
  try {
    console.log('🔄 Manual odds ingestion triggered...')
    
    const ingestionService = OddsIngestionService.getInstance()
    
    // Trigger a single ingestion cycle
    await ingestionService['ingestOddsData']()
    
    return NextResponse.json({
      success: true,
      message: 'Odds ingestion completed successfully'
    })
    
  } catch (error) {
    console.error('❌ Error in manual odds ingestion:', error)
    return NextResponse.json({ 
      error: 'Failed to ingest odds data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
