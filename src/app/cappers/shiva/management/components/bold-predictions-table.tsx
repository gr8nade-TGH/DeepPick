"use client"
import { useState, useEffect } from 'react'

interface BoldPrediction {
  player: string
  team: string
  prediction: string
  reasoning: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface BoldPredictionsEntry {
  run_id: string
  created_at: string
  matchup: string
  capper: string
  bet_type: string
  selection: string
  bold_predictions: {
    predictions: BoldPrediction[]
    summary: string
  } | null
}

export function BoldPredictionsTable() {
  const [entries, setEntries] = useState<BoldPredictionsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchBoldPredictions()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBoldPredictions, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchBoldPredictions = async () => {
    try {
      const response = await fetch('/api/shiva/bold-predictions-log')
      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries || [])
      }
    } catch (error) {
      console.error('[BoldPredictionsTable] Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (runId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(runId)) {
        newSet.delete(runId)
      } else {
        newSet.add(runId)
      }
      return newSet
    })
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getConfidenceColor = (confidence: string) => {
    if (confidence === 'HIGH') return 'text-green-400'
    if (confidence === 'MEDIUM') return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getConfidenceBadge = (confidence: string) => {
    if (confidence === 'HIGH') return 'bg-green-900 text-green-200'
    if (confidence === 'MEDIUM') return 'bg-yellow-900 text-yellow-200'
    return 'bg-orange-900 text-orange-200'
  }

  if (loading) {
    return (
      <div className="border border-gray-700 rounded p-4 bg-gray-900">
        <div className="text-gray-400 text-sm">Loading bold predictions...</div>
      </div>
    )
  }

  return (
    <div className="border border-gray-700 rounded bg-gray-900 flex flex-col max-h-[400px]">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <h2 className="text-sm font-bold text-white">Bold Predictions</h2>
              <p className="text-[10px] text-gray-400">AI player predictions</p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {entries.length} total
          </div>
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="p-4 text-gray-400 text-sm">
          No bold predictions yet. Generate picks to see AI player predictions.
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="text-left py-2 px-3 text-gray-400 font-bold">Time</th>
                <th className="text-left py-2 px-3 text-gray-400 font-bold">Capper</th>
                <th className="text-left py-2 px-3 text-gray-400 font-bold">Game</th>
                <th className="text-left py-2 px-3 text-gray-400 font-bold">Type</th>
                <th className="text-left py-2 px-3 text-gray-400 font-bold">Pick</th>
                <th className="text-left py-2 px-3 text-gray-400 font-bold">Predictions</th>
                <th className="text-left py-2 px-3 text-gray-400 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isExpanded = expandedEntries.has(entry.run_id)
                const predictionCount = entry.bold_predictions?.predictions?.length || 0

                return (
                  <>
                    {/* Main Row */}
                    <tr
                      key={idx}
                      className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer"
                      onClick={() => toggleExpand(entry.run_id)}
                    >
                      <td className="py-2 px-3 text-gray-300 text-xs">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-purple-900 to-pink-900 text-purple-200">
                          {entry.capper}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-300 text-xs">
                        {entry.matchup}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${entry.bet_type === 'total'
                            ? 'bg-blue-900 text-blue-200'
                            : 'bg-purple-900 text-purple-200'
                          }`}>
                          {entry.bet_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-300 font-medium text-xs">
                        {entry.selection}
                      </td>
                      <td className="py-2 px-3 text-cyan-400 font-bold">
                        {predictionCount} prediction{predictionCount !== 1 ? 's' : ''}
                      </td>
                      <td className="py-2 px-3 text-gray-400 text-xs">
                        {isExpanded ? '▼' : '▶'}
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {isExpanded && entry.bold_predictions && (
                      <tr>
                        <td colSpan={7} className="bg-gray-950 p-4">
                          <div className="space-y-4">
                            {/* Summary */}
                            {entry.bold_predictions.summary && (
                              <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-3">
                                <div className="text-xs font-bold text-purple-400 uppercase mb-2">
                                  📊 Summary
                                </div>
                                <div className="text-sm text-gray-300">
                                  {entry.bold_predictions.summary}
                                </div>
                              </div>
                            )}

                            {/* Predictions Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {entry.bold_predictions.predictions.map((pred, predIdx) => (
                                <div
                                  key={predIdx}
                                  className="bg-gray-900 border border-cyan-500/30 rounded-lg p-3 hover:border-cyan-500/50 transition-colors"
                                >
                                  {/* Player Header */}
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <div className="font-bold text-white text-sm">
                                        {pred.player}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {pred.team}
                                      </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getConfidenceBadge(pred.confidence)}`}>
                                      {pred.confidence}
                                    </span>
                                  </div>

                                  {/* Prediction */}
                                  <div className="mb-2">
                                    <div className="text-xs font-bold text-cyan-400 uppercase mb-1">
                                      Prediction
                                    </div>
                                    <div className="text-sm text-white font-medium">
                                      {pred.prediction}
                                    </div>
                                  </div>

                                  {/* Reasoning */}
                                  <div>
                                    <div className="text-xs font-bold text-gray-400 uppercase mb-1">
                                      Reasoning
                                    </div>
                                    <div className="text-xs text-gray-300 leading-relaxed">
                                      {pred.reasoning}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

