import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

async function archiveGamesHandler() {
  try {
    console.log('🗄️ Starting game archival process...')
    
    const now = new Date()
    
    // Find games that should be archived:
    // 1. Final games that completed > 2 hours ago
    // 2. Live games that started > 5 hours ago
    const { data: gamesToArchive, error: fetchError } = await getSupabaseAdmin()
      .from('games')
      .select('*')
      .or('status.eq.final,status.eq.live')
    
    if (fetchError) {
      throw new Error(`Error fetching games: ${fetchError.message}`)
    }

    if (!gamesToArchive || gamesToArchive.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games to archive',
        archivedCount: 0
      })
    }

    const toArchive = gamesToArchive.filter(game => {
      const gameDateTime = new Date(`${game.game_date}T${game.game_time}`)
      const timeSinceStart = now.getTime() - gameDateTime.getTime()
      const hoursSinceStart = timeSinceStart / (1000 * 60 * 60)
      
      if (game.status === 'final') {
        // Archive final games after 2 hours
        return hoursSinceStart > 2
      } else if (game.status === 'live') {
        // Archive live games after 5 hours (assume they're done)
        return hoursSinceStart > 5
      }
      
      return false
    })

    if (toArchive.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games ready for archival',
        archivedCount: 0
      })
    }

    console.log(`📦 Found ${toArchive.length} games to archive`)

    let archivedCount = 0
    let errors: string[] = []

    for (const game of toArchive) {
      try {
        // Insert into games_history
        const { error: insertError } = await getSupabaseAdmin()
          .from('games_history')
          .insert({
            id: game.id,
            sport: game.sport,
            league: game.league,
            home_team: game.home_team,
            away_team: game.away_team,
            game_date: game.game_date,
            game_time: game.game_time,
            status: game.status,
            final_score: game.final_score,
            venue: game.venue,
            odds: game.odds,
            created_at: game.created_at,
            updated_at: game.updated_at,
            completed_at: game.completed_at || now.toISOString(),
            archived_at: now.toISOString()
          })

        if (insertError) {
          errors.push(`Failed to archive game ${game.id}: ${insertError.message}`)
          continue
        }

        // Delete from games table
        const { error: deleteError } = await getSupabaseAdmin()
          .from('games')
          .delete()
          .eq('id', game.id)

        if (deleteError) {
          errors.push(`Failed to delete game ${game.id}: ${deleteError.message}`)
          continue
        }

        archivedCount++
        console.log(`✅ Archived game: ${game.away_team.name} @ ${game.home_team.name}`)
      } catch (err) {
        errors.push(`Exception archiving game ${game.id}: ${err}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Archived ${archivedCount} games`,
      archivedCount,
      totalFound: toArchive.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Support both GET (Vercel Cron) and POST (manual trigger)
export async function GET() {
  return archiveGamesHandler()
}

export async function POST() {
  return archiveGamesHandler()
}

