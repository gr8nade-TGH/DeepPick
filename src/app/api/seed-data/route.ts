import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

// POST /api/seed-data - Add sample data for testing
export async function POST() {
  try {
    const mockUserId = '00000000-0000-0000-0000-000000000000'

    // Create a mock user
    const { error: userError } = await supabase
      .from('users')
      .insert([{
        id: mockUserId,
        email: 'demo@deeppick.com',
        username: 'demo_user',
        subscription_tier: 'premium'
      }])
      .select()

    if (userError) {
      console.log('User creation error (may already exist):', userError.message)
    }

    // Create sample teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .insert([
        { name: 'Kansas City Chiefs', abbreviation: 'KC', city: 'Kansas City', sport: 'nfl', conference: 'AFC', division: 'West' },
        { name: 'Denver Broncos', abbreviation: 'DEN', city: 'Denver', sport: 'nfl', conference: 'AFC', division: 'West' },
        { name: 'Los Angeles Lakers', abbreviation: 'LAL', city: 'Los Angeles', sport: 'nba', conference: 'Western', division: 'Pacific' },
        { name: 'Golden State Warriors', abbreviation: 'GSW', city: 'San Francisco', sport: 'nba', conference: 'Western', division: 'Pacific' }
      ])
      .select()

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 })
    }

    // Create sample games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .insert([
        {
          sport: 'nfl',
          league: 'NFL',
          home_team: { name: 'Kansas City Chiefs', abbreviation: 'KC' },
          away_team: { name: 'Denver Broncos', abbreviation: 'DEN' },
          game_date: '2025-01-19',
          game_time: '20:00:00',
          status: 'final',
          venue: 'Arrowhead Stadium',
          odds: { moneyline: { home: -150, away: 130 }, spread: { home: -3.5, away: 3.5 } }
        },
        {
          sport: 'nba',
          league: 'NBA',
          home_team: { name: 'Los Angeles Lakers', abbreviation: 'LAL' },
          away_team: { name: 'Golden State Warriors', abbreviation: 'GSW' },
          game_date: '2025-01-20',
          game_time: '22:00:00',
          status: 'final',
          venue: 'Crypto.com Arena',
          odds: { moneyline: { home: -110, away: -110 }, spread: { home: -1.5, away: 1.5 } }
        }
      ])
      .select()

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 })
    }

    // Create sample picks
    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .insert([
        {
          user_id: mockUserId,
          game_id: games?.[0]?.id,
          sport: 'nfl',
          bet_type: 'spread',
          selection: 'Chiefs -3.5 vs Broncos',
          odds: -110,
          confidence: 'high',
          units: 2.5,
          potential_payout: 2.27,
          status: 'won',
          reasoning: 'Strong 2H rebound — defense sealed the cover',
          data_points: ['defense_rating: 85', 'home_advantage: 3.2']
        },
        {
          user_id: mockUserId,
          game_id: games?.[1]?.id,
          sport: 'nba',
          bet_type: 'moneyline',
          selection: 'Lakers ML vs Warriors',
          odds: -110,
          confidence: 'medium',
          units: 3.0,
          potential_payout: 2.73,
          status: 'lost',
          reasoning: 'LeBron sat late — rebounding issues hurt',
          data_points: ['lebron_minutes: 28', 'rebound_differential: -8']
        }
      ])
      .select()

    if (picksError) {
      return NextResponse.json({ error: picksError.message }, { status: 500 })
    }

    // Create pick results
    if (picks && picks.length > 0) {
      const { error: resultsError } = await supabase
        .from('pick_results')
        .insert([
          {
            pick_id: picks[0].id,
            outcome: 'won',
            actual_result: 'Chiefs won 28-17',
            units_won: 2.27,
            units_lost: 0,
            net_units: 2.27,
            notes: 'Covered by 7.5 points'
          },
          {
            pick_id: picks[1].id,
            outcome: 'lost',
            actual_result: 'Warriors won 115-108',
            units_won: 0,
            units_lost: 3.0,
            net_units: -3.0,
            notes: 'LeBron injury affected performance'
          }
        ])

      if (resultsError) {
        console.log('Results creation error:', resultsError.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      data: {
        teams: teams?.length || 0,
        games: games?.length || 0,
        picks: picks?.length || 0
      }
    })

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to seed data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
