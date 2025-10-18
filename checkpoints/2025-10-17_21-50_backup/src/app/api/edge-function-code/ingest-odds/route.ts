import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const functionPath = join(process.cwd(), 'edge-functions/ingest-odds/index.ts')
    const code = readFileSync(functionPath, 'utf-8')
    
    return new NextResponse(code, {
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read function code' },
      { status: 500 }
    )
  }
}
