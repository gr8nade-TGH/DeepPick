import { NextRequest } from 'next/server'
import { getCapperProfile } from '@/lib/cappers/shiva-v1/profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cappers/profile?capper=SHIVA&sport=NBA
 * Returns active profile JSON, falls back to in-memory default
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  const searchParams = request.nextUrl.searchParams
  const capper = searchParams.get('capper')
  const sport = searchParams.get('sport') as 'NBA' | 'MLB' | 'NFL' | null

  if (!capper) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'MISSING_PARAM',
          message: 'Query param "capper" is required',
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const sportParam = sport || 'NBA'
  
  try {
    const profile = await getCapperProfile(capper, sportParam)
    
    if (!profile) {
      console.warn('[Profile:GET]', {
        capper,
        sport: sportParam,
        found: false,
        latencyMs: Date.now() - startTime,
      })
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: `No profile found for capper=${capper}, sport=${sportParam}`,
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Profile:GET]', {
      capper,
      sport: sportParam,
      version: profile.version,
      source: 'db_or_fallback',
      latencyMs: Date.now() - startTime,
    })

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Profile:GET]', {
      capper,
      sport: sportParam,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    })

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load profile',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

