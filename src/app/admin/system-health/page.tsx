'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NavBar } from '@/components/navigation/nav-bar'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  Lock,
  TrendingUp,
  TrendingDown,
  Play,
  Pause
} from 'lucide-react'

interface SystemHealthData {
  success: boolean
  timestamp: string
  orchestrator: {
    isRunning: boolean
    lastRun: string | null
    lockedBy: string | null
    expiresAt: string | null
  }
  cappers: Array<{
    capper_id: string
    sport: string
    bet_type: string
    enabled: boolean
    interval_minutes: number
    priority: number
    last_execution_at: string | null
    next_execution_at: string | null
    last_status: string | null
    last_error: string | null
    total_executions: number
    successful_executions: number
    failed_executions: number
    success_rate: number
    is_due: boolean
    minutes_until_next: number | null
  }>
  recent_executions: Array<{
    run_id: string
    created_at: string
    capper: string
    bet_type: string
    matchup: string
    selection: string
    confidence: number
    state: string
  }>
  locks: Array<{
    lock_key: string
    locked_by: string
    locked_at: string
    expires_at: string
    is_active: boolean
    is_expired: boolean
    age_minutes: number
  }>
  alerts: Array<{
    type: string
    severity: string
    message: string
    capper?: string
    created_at: string
  }>
  summary: {
    total_cappers: number
    enabled_cappers: number
    total_executions: number
    successful_executions: number
    failed_executions: number
    overall_success_rate: number
    active_locks: number
    stale_locks: number
    active_alerts: number
  }
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    fetchHealthData()
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchHealthData, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/admin/system-health')
      const result = await response.json()
      if (result.success) {
        setData(result)
        setLastRefresh(new Date())
      }
    } catch (error) {
      console.error('[SystemHealth] Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins === 1) return '1 minute ago'
    if (diffMins < 60) return `${diffMins} minutes ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return '1 hour ago'
    return `${diffHours} hours ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading system health...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400">Failed to load system health data</p>
          <Button onClick={fetchHealthData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="p-6 space-y-6 bg-gradient-to-br from-gray-900 via-black to-gray-950 text-white min-h-screen font-mono">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-green-400 tracking-wider">SYSTEM HEALTH</h1>
          <p className="text-sm text-gray-400 mt-1">
            Last updated: {formatTime(lastRefresh.toISOString())}
            <span className="ml-2 text-gray-500">• Auto-refresh: 10s</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={fetchHealthData}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <NavBar />
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Executions</p>
                <p className="text-3xl font-bold text-white">{data.summary.total_executions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Success Rate</p>
                <p className="text-3xl font-bold text-green-400">{data.summary.overall_success_rate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Cappers</p>
                <p className="text-3xl font-bold text-white">{data.summary.enabled_cappers}/{data.summary.total_cappers}</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Alerts</p>
                <p className="text-3xl font-bold text-red-400">{data.summary.active_alerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orchestrator Status */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-400" />
            Orchestrator Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Status</p>
              <Badge variant={data.orchestrator.isRunning ? "default" : "secondary"}>
                {data.orchestrator.isRunning ? (
                  <><Play className="w-3 h-3 mr-1" /> Running</>
                ) : (
                  <><Pause className="w-3 h-3 mr-1" /> Idle</>
                )}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Last Run</p>
              <p className="text-sm text-white">{formatRelativeTime(data.orchestrator.lastRun)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Locked By</p>
              <p className="text-sm text-white">{data.orchestrator.lockedBy || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Lock Expires</p>
              <p className="text-sm text-white">{formatTime(data.orchestrator.expiresAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <Card className="bg-slate-900/50 border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({data.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${alert.severity === 'error'
                      ? 'bg-red-900/20 border-red-800'
                      : 'bg-yellow-900/20 border-yellow-800'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alert.severity === 'error' ? 'destructive' : 'secondary'}>
                          {alert.type}
                        </Badge>
                        {alert.capper && (
                          <span className="text-xs text-gray-400">{alert.capper}</span>
                        )}
                      </div>
                      <p className="text-sm text-white">{alert.message}</p>
                    </div>
                    <span className="text-xs text-gray-500">{formatRelativeTime(alert.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capper Execution Stats */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Capper Execution Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Capper</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Sport</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Bet Type</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Status</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Interval</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Next Run</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Executions</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Success Rate</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Last Status</th>
                </tr>
              </thead>
              <tbody>
                {data.cappers.map((capper, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-white">{capper.capper_id}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-300">{capper.sport}</td>
                    <td className="py-3 px-3">
                      <Badge variant="outline">{capper.bet_type}</Badge>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {capper.enabled ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Pause className="w-3 h-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-300">
                      {capper.interval_minutes}m
                    </td>
                    <td className="py-3 px-3 text-center">
                      {capper.is_due ? (
                        <Badge variant="default" className="bg-yellow-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Due Now
                        </Badge>
                      ) : capper.minutes_until_next !== null ? (
                        <span className="text-gray-300">{capper.minutes_until_next}m</span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="text-white">
                        {capper.total_executions}
                        <div className="text-xs text-gray-500">
                          {capper.successful_executions}✓ {capper.failed_executions}✗
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-semibold ${capper.success_rate >= 80 ? 'text-green-400' :
                          capper.success_rate >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                        }`}>
                        {capper.success_rate}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {capper.last_status === 'success' ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Success
                        </Badge>
                      ) : capper.last_status === 'failed' ? (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Executions */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Recent Executions (Last 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Time</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Capper</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Bet Type</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Matchup</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Selection</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Confidence</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">State</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_executions.map((execution, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-3 text-gray-300">
                      {formatTime(execution.created_at)}
                      <div className="text-xs text-gray-500">
                        {formatRelativeTime(execution.created_at)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-white uppercase">{execution.capper}</span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline">{execution.bet_type}</Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-300">{execution.matchup}</td>
                    <td className="py-3 px-3 text-white">{execution.selection || 'N/A'}</td>
                    <td className="py-3 px-3 text-center">
                      {execution.confidence ? (
                        <span className={`font-semibold ${execution.confidence >= 8 ? 'text-green-400' :
                            execution.confidence >= 6 ? 'text-yellow-400' :
                              'text-gray-400'
                          }`}>
                          {execution.confidence.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={
                        execution.state === 'completed' ? 'default' :
                          execution.state === 'failed' ? 'destructive' :
                            'secondary'
                      }>
                        {execution.state}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* System Locks */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-purple-400" />
            System Locks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Lock Key</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Locked By</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Locked At</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-semibold">Expires At</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Age</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.locks.map((lock, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-mono text-white">{lock.lock_key}</td>
                    <td className="py-3 px-3 text-gray-300">{lock.locked_by}</td>
                    <td className="py-3 px-3 text-gray-300">{formatTime(lock.locked_at)}</td>
                    <td className="py-3 px-3 text-gray-300">{formatTime(lock.expires_at)}</td>
                    <td className="py-3 px-3 text-center text-gray-300">{lock.age_minutes}m</td>
                    <td className="py-3 px-3 text-center">
                      {lock.is_active ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : lock.is_expired && lock.age_minutes > 10 ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Stale
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Expired</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

