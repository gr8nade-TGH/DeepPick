'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Home } from 'lucide-react'

export default function TestPickPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const placeMilwaukeePick = async () => {
    setLoading(true)
    try {
      // First, find the MIL @ LAD game
      const gamesResponse = await fetch('/api/odds?sport=mlb')
      const gamesData = await gamesResponse.json()
      
      if (!gamesData.success || !gamesData.data) {
        setResult({ error: 'Failed to fetch games' })
        return
      }

      // Find MIL @ LAD game
      const milGame = gamesData.data.find((g: any) => 
        (g.away_team.name.includes('Milwaukee') || g.away_team.name.includes('Brewers')) &&
        (g.home_team.name.includes('Los Angeles') || g.home_team.name.includes('Dodgers'))
      )

      if (!milGame) {
        setResult({ error: 'MIL @ LAD game not found' })
        return
      }

      console.log('Found game:', milGame)

      // Calculate average odds for Milwaukee
      const milOdds: number[] = []
      milGame.sportsbooks?.forEach((book: string) => {
        const odds = milGame.odds[book]
        const awayTeam = milGame.away_team?.name
        if (odds?.moneyline?.[awayTeam]) {
          milOdds.push(odds.moneyline[awayTeam])
        }
      })

      const avgOdds = milOdds.length > 0 
        ? Math.round(milOdds.reduce((a, b) => a + b, 0) / milOdds.length)
        : 567 // fallback

      console.log('Average MIL odds:', avgOdds)

      // Place the pick
      const pickResponse = await fetch('/api/place-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: milGame.id,
          pick_type: 'moneyline',
          selection: milGame.away_team.name,
          odds: avgOdds,
          units: 1.0,
          is_system_pick: true,
          confidence: 75.0,
          reasoning: 'Test pick for MIL @ LAD game',
          algorithm_version: 'manual-test-v1'
        })
      })

      const pickData = await pickResponse.json()
      setResult(pickData)
    } catch (error) {
      setResult({ error: String(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neon-blue/30 hover:bg-neon-blue/10 transition-all text-neon-blue hover:border-neon-blue"
          >
            <Home className="w-4 h-4" />
            <span className="font-semibold">Dashboard</span>
          </Link>
          
          <h1 className="text-4xl font-bold text-gradient bg-gradient-to-r from-neon-blue via-neon-purple to-neon-green bg-clip-text text-transparent">
            Test Pick Placement
          </h1>
          
          <div className="w-[120px]" />
        </div>

        <Card className="glass-effect">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4">Place Test Pick</h2>
            <p className="text-muted-foreground mb-6">
              This will place a 1 unit bet on Milwaukee Brewers moneyline at average odds
            </p>

            <Button
              onClick={placeMilwaukeePick}
              disabled={loading}
              className="bg-neon-green hover:bg-neon-green/80 text-black font-bold"
            >
              {loading ? 'Placing Pick...' : 'Place MIL +567 (1 Unit)'}
            </Button>

            {result && (
              <div className="mt-6 p-4 rounded-lg bg-black/50 border border-white/10">
                <h3 className="font-bold mb-2">Result:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-effect">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold mb-4">What This Does:</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>✅ Finds the MIL @ LAD game in the database</li>
              <li>✅ Calculates average odds across all sportsbooks</li>
              <li>✅ Places a 1 unit moneyline pick on Milwaukee</li>
              <li>✅ Marks it as a system pick</li>
              <li>✅ Stores game snapshot at time of pick</li>
              <li>✅ Will auto-grade when final score is fetched</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

