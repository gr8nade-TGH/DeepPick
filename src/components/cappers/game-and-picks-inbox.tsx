import React, { useState, useEffect } from 'react'
import { pickGenerationService } from '@/lib/services/pick-generation-service'
import { capper_type } from '@/lib/database.types'

interface GameInboxProps {
  capper: capper_type
  betType: 'TOTAL' | 'SPREAD' | 'MONEYLINE'
  onGameSelect?: (game: any) => void
  selectedGameId?: string
}

interface GeneratedPick {
  id: string
  game_id: string
  home_team: string
  away_team: string
  pick_type: string
  selection: string
  units: number
  confidence: number
  created_at: string
  status: string
}

export function GameInbox({ capper, betType, onGameSelect, selectedGameId }: GameInboxProps) {
  const [availableGames, setAvailableGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAvailableGames = async () => {
    setLoading(true)
    setError(null)
    try {
      const games = await pickGenerationService.getAvailableGames(capper, betType, 2, 10)
      setAvailableGames(games)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAvailableGames()
  }, [capper, betType])

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm">🎮 Game Inbox</h3>
        <button
          onClick={fetchAvailableGames}
          disabled={loading}
          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>
      
      <div className="h-48 overflow-y-auto border border-gray-600 rounded">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading games...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-400">{error}</div>
        ) : availableGames.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            No games available for {capper} {betType} picks
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {availableGames.map((game) => (
              <div
                key={game.game_id}
                onClick={() => onGameSelect?.(game)}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  selectedGameId === game.game_id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                <div className="text-xs font-semibold">
                  {game.away_team} @ {game.home_team}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(game.game_time).toLocaleString()} • O/U: {game.total_line}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-400">
        Showing {availableGames.length} available games for {capper} {betType} picks
      </div>
    </div>
  )
}

export function GeneratedPicksInbox({ capper }: { capper: capper_type }) {
  const [generatedPicks, setGeneratedPicks] = useState<GeneratedPick[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGeneratedPicks = async () => {
    setLoading(true)
    setError(null)
    try {
      // This would fetch from the picks table
      // For now, we'll use mock data
      const mockPicks: GeneratedPick[] = [
        {
          id: 'pick_001',
          game_id: 'game_001',
          home_team: 'Golden State Warriors',
          away_team: 'Denver Nuggets',
          pick_type: 'TOTAL',
          selection: 'OVER 233.5',
          units: 2,
          confidence: 3.5,
          created_at: new Date().toISOString(),
          status: 'pending'
        },
        {
          id: 'pick_002',
          game_id: 'game_002',
          home_team: 'Lakers',
          away_team: 'Celtics',
          pick_type: 'TOTAL',
          selection: 'UNDER 225.0',
          units: 1,
          confidence: 2.8,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          status: 'pending'
        }
      ]
      setGeneratedPicks(mockPicks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch picks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGeneratedPicks()
  }, [capper])

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm">📋 Generated Picks</h3>
        <button
          onClick={fetchGeneratedPicks}
          disabled={loading}
          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-500 disabled:opacity-50"
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </div>
      
      <div className="h-48 overflow-y-auto border border-gray-600 rounded">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading picks...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-400">{error}</div>
        ) : generatedPicks.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            No picks generated yet for {capper}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {generatedPicks.map((pick) => (
              <div
                key={pick.id}
                className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <div className="text-xs font-semibold text-white">
                  {pick.away_team} @ {pick.home_team}
                </div>
                <div className="text-xs text-gray-300">
                  {pick.selection} • {pick.units}u • {pick.confidence}/5
                </div>
                <div className="text-xs text-gray-400">
                  ID: {pick.id} • {new Date(pick.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-400">
        {generatedPicks.length} picks generated by {capper}
      </div>
    </div>
  )
}

export function GameAndPicksInbox({ capper, betType, onGameSelect, selectedGameId }: GameInboxProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GameInbox 
        capper={capper} 
        betType={betType} 
        onGameSelect={onGameSelect}
        selectedGameId={selectedGameId}
      />
      <GeneratedPicksInbox capper={capper} />
    </div>
  )
}
