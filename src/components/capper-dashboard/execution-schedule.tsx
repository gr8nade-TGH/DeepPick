'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Play, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Run {
  id: string
  run_id: string
  status: string
  created_at: string
  completed_at: string | null
  error_message: string | null
  picks_generated: number
}

interface ExecutionScheduleProps {
  capperId: string
  intervalMinutes: number
  isActive: boolean
}

export function ExecutionSchedule({ capperId, intervalMinutes, isActive }: ExecutionScheduleProps) {
  const { toast } = useToast()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [nextExecution, setNextExecution] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [capperId])

  useEffect(() => {
    calculateNextExecution()
  }, [runs, intervalMinutes])

  const fetchRuns = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/runs?capper_id=${capperId}&limit=5`)
      const data = await response.json()
      if (data.success) {
        setRuns(data.runs || [])
      }
    } catch (error) {
      console.error('Failed to fetch runs:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateNextExecution = () => {
    if (runs.length === 0 || !isActive) {
      setNextExecution(null)
      return
    }

    const lastRun = runs[0]
    const lastRunTime = new Date(lastRun.created_at)
    const next = new Date(lastRunTime.getTime() + intervalMinutes * 60 * 1000)
    setNextExecution(next)
  }

  const handleManualTrigger = async () => {
    try {
      setTriggering(true)

      const response = await fetch(`/api/cappers/generate-pick?capperId=${capperId}&sport=NBA&betType=TOTAL`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger pick generation')
      }

      // Check if a pick was actually generated
      if (data.success && data.result?.decision === 'PICK') {
        toast({
          title: '✅ Pick Generated!',
          description: `${data.result.pick.selection} (${data.result.pick.units}U @ ${data.result.pick.confidence.toFixed(1)}% confidence)`,
        })
      } else if (data.success && data.result?.decision === 'PASS') {
        // Pipeline decided to PASS on the game
        toast({
          title: '⚠️ No Pick Generated',
          description: `Analyzed game but confidence too low (${data.result.confidence?.toFixed(1)}%). Thresholds not met.`,
          variant: 'default'
        })
      } else if (data.success && data.message === 'No eligible games found') {
        // No games available to analyze
        toast({
          title: 'ℹ️ No Games Available',
          description: 'All upcoming games are either: already picked, in cooldown, excluded teams, or too close to start time.',
          variant: 'default'
        })
      } else if (data.success && data.message === 'Another instance is already running') {
        // Lock held by another process
        toast({
          title: '⏳ Already Running',
          description: 'Another pick generation is in progress. Please wait a moment and try again.',
          variant: 'default'
        })
      } else {
        // Generic success but no pick
        toast({
          title: 'ℹ️ Analysis Complete',
          description: data.message || 'No picks generated at this time',
          variant: 'default'
        })
      }

      // Refresh runs after a short delay
      setTimeout(() => {
        fetchRuns()
      }, 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to trigger pick generation',
        variant: 'destructive'
      })
    } finally {
      setTriggering(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      case 'running':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      default:
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    }
  }

  const getCountdown = () => {
    if (!nextExecution || !isActive) return null

    const diff = nextExecution.getTime() - currentTime.getTime()
    if (diff < 0) return 'Running soon...'

    const minutes = Math.floor(diff / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Execution Schedule
        </CardTitle>
        <Button
          onClick={handleManualTrigger}
          disabled={triggering || !isActive}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {triggering ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Triggering...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Now
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Execution */}
        {isActive && nextExecution && (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Next Execution</p>
                <p className="text-white font-medium">
                  {nextExecution.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400 mb-1">Countdown</p>
                <p className="text-cyan-400 font-mono font-medium">{getCountdown()}</p>
              </div>
            </div>
          </div>
        )}

        {!isActive && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-yellow-400 text-sm">
              Automatic execution is paused. Resume your capper to enable scheduled runs.
            </p>
          </div>
        )}

        {/* Recent Runs */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Runs</h4>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-700/50 rounded animate-pulse"></div>
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No runs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getStatusColor(run.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(run.status)}
                        {run.status.toUpperCase()}
                      </span>
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {new Date(run.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {run.picks_generated > 0 ? (
                        <span className="text-emerald-400">{run.picks_generated} picks generated</span>
                      ) : (
                        'No picks generated'
                      )}
                    </span>
                    {run.completed_at && (
                      <span className="text-slate-500 text-xs">
                        {Math.round((new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                  {run.error_message && (
                    <p className="text-red-400 text-xs mt-2 truncate">{run.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

