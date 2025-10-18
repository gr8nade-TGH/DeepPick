'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bug, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface AlgorithmLog {
  id: string
  triggerType: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  status: string
  gamesAnalyzed: number
  picksGenerated: number
  picksSkipped: number
  errorMessage?: string
  summary?: any
}

interface AlgorithmDebugLogsProps {
  capper: string
  capperName: string
}

export default function AlgorithmDebugLogs({ capper, capperName }: AlgorithmDebugLogsProps) {
  const [logs, setLogs] = useState<AlgorithmLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [capper])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/algorithm-logs?capper=${capper}&limit=20`)
      const data = await response.json()
      if (data.success) {
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'no_picks':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'no_games':
        return <AlertCircle className="w-5 h-5 text-gray-400" />
      default:
        return <Clock className="w-5 h-5 text-blue-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'no_picks':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'no_games':
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400'
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400'
    }
  }

  return (
    <Card className="glass-effect border-purple-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-purple-400" />
            <CardTitle className="text-white">Algorithm Run Logs</CardTitle>
          </div>
          <Button
            onClick={fetchLogs}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Every {capperName} run is logged here - see what happened, why picks were generated or passed, and debug any errors
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No algorithm runs yet</p>
            <p className="text-sm mt-1">Run the algorithm manually or wait for the automated cron (every 20 min)</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-4 rounded-lg border ${getStatusColor(log.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(log.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">
                          {log.status === 'success' ? '✅ Success' :
                           log.status === 'error' ? '❌ Error' :
                           log.status === 'no_picks' ? '⚠️ No Picks Generated' :
                           log.status === 'no_games' ? '📭 No Games Available' :
                           '🔄 Running'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {log.triggerType}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-300 space-y-1">
                        <div className="flex items-center gap-4">
                          <span>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(log.startedAt).toLocaleString()}
                          </span>
                          {log.durationMs && (
                            <span className="text-gray-400">
                              ({(log.durationMs / 1000).toFixed(2)}s)
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs">
                          <span>
                            📊 {log.gamesAnalyzed} games analyzed
                          </span>
                          <span className="text-green-400">
                            ✅ {log.picksGenerated} picks generated
                          </span>
                          {log.picksSkipped > 0 && (
                            <span className="text-yellow-400">
                              ⏭️ {log.picksSkipped} skipped (duplicates)
                            </span>
                          )}
                        </div>

                        {log.errorMessage && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                            <strong>Error:</strong> {log.errorMessage}
                          </div>
                        )}

                        {log.summary && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-purple-400 hover:text-purple-300">
                              View Details
                            </summary>
                            <div className="mt-2 p-3 bg-gray-800/50 rounded text-xs space-y-2">
                              {log.summary.gamesWithOdds !== undefined && (
                                <div>
                                  <strong>Games with odds:</strong> {log.summary.gamesWithOdds}
                                </div>
                              )}
                              {log.summary.gamesWithoutOdds > 0 && (
                                <div className="text-yellow-400">
                                  <strong>Games without odds:</strong> {log.summary.gamesWithoutOdds}
                                </div>
                              )}
                              {log.summary.existingPicksFound > 0 && (
                                <div>
                                  <strong>Existing picks found:</strong> {log.summary.existingPicksFound} games
                                </div>
                              )}
                              {log.summary.generatedPicks && log.summary.generatedPicks.length > 0 && (
                                <div>
                                  <strong>Generated Picks:</strong>
                                  <ul className="ml-4 mt-1 space-y-1">
                                    {log.summary.generatedPicks.map((pick: any, i: number) => (
                                      <li key={i} className="text-green-400">
                                        • {pick.selection} ({pick.confidence}% confidence)
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {log.summary.errors && log.summary.errors.length > 0 && (
                                <div className="text-red-400">
                                  <strong>Errors:</strong>
                                  <ul className="ml-4 mt-1 space-y-1">
                                    {log.summary.errors.map((err: string, i: number) => (
                                      <li key={i}>• {err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

