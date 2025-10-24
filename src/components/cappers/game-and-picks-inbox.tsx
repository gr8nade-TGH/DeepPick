import React, { useState, useEffect } from 'react'
import { pickGenerationService } from '@/lib/services/pick-generation-service'
import { capper_type } from '@/lib/database.types'

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
  const [showInsightCard, setShowInsightCard] = useState<boolean>(false)
  const [selectedPickInsight, setSelectedPickInsight] = useState<any>(null)

  const fetchGeneratedPicks = async () => {
    setLoading(true)
    setError(null)
    try {
      // This would fetch from the picks table
      // For now, we'll use mock data
      const mockPicks: GeneratedPick[] = [
        {
          id: `shiva_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          game_id: 'nba_2025_10_24_den_gsw',
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
          id: `shiva_${Date.now() - 3600000}_${Math.random().toString(36).substring(2, 8)}`,
          game_id: 'nba_2025_10_24_lal_bos',
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

  const handleInsightClick = async (pick: GeneratedPick) => {
    try {
      // Fetch insight card data for this pick
      const response = await fetch(`/api/shiva/insight-card/${pick.id}`)
      if (response.ok) {
        const insightData = await response.json()
        setSelectedPickInsight(insightData)
        setShowInsightCard(true)
      } else {
        // Fallback: create mock insight data
        const mockInsight = {
          pick_id: pick.id,
          game_id: pick.game_id,
          matchup: `${pick.away_team} @ ${pick.home_team}`,
          pick_type: pick.pick_type,
          selection: pick.selection,
          units: pick.units,
          confidence: pick.confidence,
          created_at: pick.created_at,
          factors: [
            { name: 'Edge vs Market', points: 2.5, rationale: 'Market edge analysis' },
            { name: 'Pace Index', points: 1.8, rationale: 'Team pace differential' },
            { name: 'Offensive Form', points: 1.2, rationale: 'Recent offensive performance' }
          ],
          prediction: `${pick.home_team} 115-${pick.away_team} 118 (Total: 233)`,
          reasoning: `Model projects ${pick.selection} with ${pick.confidence}/5 confidence based on market edge and team factors.`
        }
        setSelectedPickInsight(mockInsight)
        setShowInsightCard(true)
      }
    } catch (err) {
      console.error('Failed to fetch insight card:', err)
      // Still show mock data as fallback
      const mockInsight = {
        pick_id: pick.id,
        game_id: pick.game_id,
        matchup: `${pick.away_team} @ ${pick.home_team}`,
        pick_type: pick.pick_type,
        selection: pick.selection,
        units: pick.units,
        confidence: pick.confidence,
        created_at: pick.created_at,
        factors: [
          { name: 'Edge vs Market', points: 2.5, rationale: 'Market edge analysis' },
          { name: 'Pace Index', points: 1.8, rationale: 'Team pace differential' },
          { name: 'Offensive Form', points: 1.2, rationale: 'Recent offensive performance' }
        ],
        prediction: `${pick.home_team} 115-${pick.away_team} 118 (Total: 233)`,
        reasoning: `Model projects ${pick.selection} with ${pick.confidence}/5 confidence based on market edge and team factors.`
      }
      setSelectedPickInsight(mockInsight)
      setShowInsightCard(true)
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
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
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

      {/* Insight Card Modal */}
      {showInsightCard && selectedPickInsight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            {/* Close Button */}
            <button
              onClick={() => setShowInsightCard(false)}
              className="absolute top-4 right-4 bg-gray-800 text-white px-3 py-1 rounded font-bold hover:bg-gray-700 z-10"
            >
              ✕ Close
            </button>
            
            {/* Insight Card Content */}
            <div className="p-6 mt-8">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {selectedPickInsight.matchup}
                </h2>
                <div className="text-sm text-gray-600">
                  Pick ID: {selectedPickInsight.pick_id} • Game ID: {selectedPickInsight.game_id}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pick Details */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-3">Pick Details</h3>
                  <div className="space-y-2">
                    <div><strong>Selection:</strong> {selectedPickInsight.selection}</div>
                    <div><strong>Units:</strong> {selectedPickInsight.units}u</div>
                    <div><strong>Confidence:</strong> {selectedPickInsight.confidence}/5</div>
                    <div><strong>Type:</strong> {selectedPickInsight.pick_type}</div>
                    <div><strong>Created:</strong> {new Date(selectedPickInsight.created_at).toLocaleString()}</div>
                  </div>
                </div>

                {/* Factors */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-3">Edge Factors</h3>
                  <div className="space-y-2">
                    {selectedPickInsight.factors?.map((factor: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{factor.name}</span>
                        <span className="text-sm font-semibold text-blue-600">+{factor.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prediction & Reasoning */}
              <div className="mt-6 space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-2">Game Prediction</h3>
                  <div className="text-lg font-semibold text-blue-800">
                    {selectedPickInsight.prediction}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-2">Reasoning</h3>
                  <div className="text-gray-700">
                    {selectedPickInsight.reasoning}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
