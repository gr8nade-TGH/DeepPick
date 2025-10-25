'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { RefreshCw } from 'lucide-react'

interface OddsHistory {
  id: string
  game_id: string
  odds: any
  captured_at: string
}

interface OddsChartProps {
  gameId: string
  sportsbooks: string[]
  homeTeam?: string
  awayTeam?: string
}

// Consistent colors for each sportsbook
const SPORTSBOOK_COLORS: Record<string, string> = {
  'draftkings': '#53D337', // DraftKings green
  'fanduel': '#1E88E5', // FanDuel blue
  'williamhill_us': '#C41E3A', // William Hill/Caesars red
  'betmgm': '#F1C400', // BetMGM gold
  'pointsbet': '#FF6B35', // PointsBet orange
  'betrivers': '#4A90E2', // BetRivers blue
  'unibet_us': '#00FF85', // Unibet green
  'wynnbet': '#DC143C', // WynnBet crimson
}

export function OddsChart({ gameId, sportsbooks, homeTeam, awayTeam }: OddsChartProps) {
  const [history, setHistory] = useState<OddsHistory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/odds-history?gameId=${gameId}`)
      const data = await response.json()
      
      if (data.success) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching odds history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [gameId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
        <div className="text-center">
          <p>No odds history yet</p>
          <p className="mt-1">Data will appear after refresh</p>
        </div>
      </div>
    )
  }

  // Determine smart time interval based on data points
  const getTimeInterval = (dataPointCount: number) => {
    if (dataPointCount <= 12) return 5 // Show all if <= 12 points (5 min intervals for 1 hour)
    if (dataPointCount <= 24) return 2 // Every other point
    if (dataPointCount <= 48) return 4 // Every 4th point (20 min intervals)
    return 6 // Every 6th point (30 min intervals)
  }

  // Transform history data for the chart
  // We'll track home team moneyline odds over time
  const chartData = history.map((record, index) => {
    const capturedTime = new Date(record.captured_at)
    const dataPoint: any = {
      time: capturedTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      fullTime: capturedTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }),
      timestamp: capturedTime.getTime(),
      index: index,
    }

    // Add each sportsbook's odds
    sportsbooks.forEach((bookmaker) => {
      const odds = record.odds[bookmaker]
      if (homeTeam && odds?.moneyline?.[homeTeam]) {
        dataPoint[bookmaker] = odds.moneyline[homeTeam]
      }
    })

    return dataPoint
  })

  const interval = getTimeInterval(chartData.length)

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10, fill: '#888' }}
            stroke="#333"
            interval={interval}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: '#888' }}
            stroke="#333"
            domain={['dataMin - 20', 'dataMax + 20']}
            reversed={true}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelStyle={{ color: '#888' }}
            labelFormatter={(value, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullTime
              }
              return value
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '10px' }}
            iconType="line"
          />
          {sportsbooks.map((bookmaker) => {
            const displayName = bookmaker === 'williamhill_us' ? 'CAESARS' : bookmaker.replace('_', ' ').toUpperCase()
            return (
              <Line
                key={bookmaker}
                type="monotone"
                dataKey={bookmaker}
                stroke={SPORTSBOOK_COLORS[bookmaker] || '#888'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={displayName}
                connectNulls
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

