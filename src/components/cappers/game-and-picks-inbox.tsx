import React, { useState, useEffect } from 'react'
import { capper_type } from '@/lib/database.types'
import { PickInsightModal } from '@/components/dashboard/pick-insight-modal'

interface GameInboxProps {
  capper: capper_type
  betType: 'TOTAL' | 'SPREAD' | 'MONEYLINE'
  onGameSelect?: (game: any) => void
  selectedGameId?: string
  selectedGame?: any
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
  insight_card_data?: any // Optional insight card data
}

export function GameInbox({ capper, betType, onGameSelect, selectedGameId, selectedGame }: GameInboxProps) {
  const [availableGames, setAvailableGames] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAvailableGames = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use the new scanner API to get available games
      const response = await fetch('/api/shiva/step1-scanner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sport: 'NBA',
          betType: betType,
          limit: 10
        }),
      })

      const data = await response.json()

      if (data.success && data.selected_game) {
        // If a game was selected, wrap it in an array
        setAvailableGames([data.selected_game])
      } else {
        // No games available
        setAvailableGames([])
      }
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
                className={`p-2 rounded cursor-pointer transition-colors ${selectedGameId === game.game_id
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
                <div className="text-xs text-gray-500 mt-1">
                  Game ID: {game.game_id}
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
  const [showInsightModal, setShowInsightModal] = useState<boolean>(false)
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)

  const fetchGeneratedPicks = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch real picks from the database
      const response = await fetch(`/api/picks?capper=${capper}&limit=20`)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      if (data.success) {
        if (!data.picks || data.picks.length === 0) {
          setError(`No picks found for ${capper}. Try generating some picks first.`)
          setGeneratedPicks([])
          return
        }
        // Transform database picks to GeneratedPick format
        const transformedPicks: GeneratedPick[] = data.picks.map((pick: any) => ({
          id: pick.id,
          game_id: pick.game_id,
          home_team: pick.game?.home_team?.name || 'Unknown',
          away_team: pick.game?.away_team?.name || 'Unknown',
          pick_type: pick.pick_type?.toUpperCase() || 'UNKNOWN',
          selection: `${pick.pick_type?.toUpperCase()} ${pick.selection || ''}`,
          units: pick.units || 0,
          confidence: pick.confidence || 0,
          created_at: pick.created_at,
          status: pick.status,
          insight_card_data: pick.insight_card_data
        }))

        setGeneratedPicks(transformedPicks)
      } else {
        // Fallback to empty array if no picks found
        setGeneratedPicks([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch picks from database')
      console.error('Error fetching generated picks:', err)
      // Set empty array on error
      setGeneratedPicks([])
    } finally {
      setLoading(false)
    }
  }

  const handleInsightClick = (pick: GeneratedPick) => {
    setSelectedPickId(pick.id)
    setShowInsightModal(true)
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
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs font-semibold text-white">
                        {pick.away_team} @ {pick.home_team}
                      </div>
                      <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded uppercase font-bold">
                        {capper}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300">
                      {pick.selection} • {pick.units}u • {pick.confidence}/5
                    </div>
                    <div className="text-xs text-gray-400">
                      Pick ID: {pick.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      Game ID: {pick.game_id} • {new Date(pick.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleInsightClick(pick)}
                    className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors"
                    title="View Insight Card"
                  >
                    INSIGHT
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {generatedPicks.length} picks generated by {capper}
      </div>

      {/* Insight Modal - Using PickInsightModal */}
      {showInsightModal && selectedPickId && (
        <PickInsightModal
          pickId={selectedPickId}
          onClose={() => {
            setShowInsightModal(false)
            setSelectedPickId(null)
          }}
        />
      )}
    </div>
  )
}

export function GameAndPicksInbox({ capper, betType, onGameSelect, selectedGameId, selectedGame }: GameInboxProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GameInbox
        capper={capper}
        betType={betType}
        onGameSelect={onGameSelect}
        selectedGameId={selectedGameId}
        selectedGame={selectedGame}
      />
      <GeneratedPicksInbox capper={capper} />
    </div>
  )
}
