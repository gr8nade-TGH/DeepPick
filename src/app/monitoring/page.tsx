'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Link from 'next/link'
import { 
  Activity, 
  Database, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  BarChart3,
  Zap,
  Home,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  FileText,
  Copy,
  CheckCheck,
  XCircle
} from 'lucide-react'

interface ApiCall {
  id: string
  api_provider: string
  endpoint: string
  method: string
  request_timestamp: string
  response_status: number
  response_time_ms: number
  events_received: number
  bookmakers_received: string[]
  sports_received: string[]
  success: boolean
  error_message?: string
  triggered_by: string
}

interface QuotaTracking {
  api_provider: string
  period_type: string
  total_calls: number
  successful_calls: number
  failed_calls: number
  total_events_received: number
  quota_remaining: number
  quota_used_percentage: number
  last_updated: string
}

interface GameChangeDetail {
  gameId: string
  matchup: string
  sport: string
  action: 'added' | 'updated' | 'skipped'
  bookmakersBefore?: string[]
  bookmakersAfter: string[]
  oddsChangesSummary?: {
    moneylineChanged: boolean
    spreadChanged: boolean
    totalChanged: boolean
    largestSwing?: number
  }
  beforeSnapshot?: any
  afterSnapshot?: any
  warnings?: string[]
}

interface IngestionLog {
  id: string
  games_added: number
  games_updated: number
  games_skipped: number
  odds_history_records_created: number
  games_missing_odds: number
  incomplete_records: number
  sport_breakdown: Record<string, number>
  bookmaker_breakdown: Record<string, number>
  processing_time_ms: number
  success: boolean
  created_at: string
  game_details?: GameChangeDetail[] // NEW: Detailed per-game changes
}

// Separate component for each log entry to properly use hooks
function IngestionLogEntry({ log }: { log: IngestionLog }) {
  const [expanded, setExpanded] = useState(false)
  const gameDetails = log.game_details as any[] | undefined

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Summary Header */}
      <div 
        className="p-4 bg-gray-800/50 cursor-pointer hover:bg-gray-800/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {new Date(log.created_at).toLocaleString()}
            </span>
            <Badge className={log.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
              {log.success ? 'Success' : 'Failed'}
            </Badge>
          </div>
          <button className="text-gray-400 hover:text-white">
            {expanded ? '▼' : '▶'} {gameDetails ? `${gameDetails.length} games` : 'Details'}
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Added</p>
            <p className="text-green-400 font-semibold">+{log.games_added}</p>
          </div>
          <div>
            <p className="text-gray-500">Updated</p>
            <p className="text-blue-400 font-semibold">~{log.games_updated}</p>
          </div>
          <div>
            <p className="text-gray-500">Odds Records</p>
            <p className="text-purple-400 font-semibold">{log.odds_history_records_created}</p>
          </div>
          <div>
            <p className="text-gray-500">Processing Time</p>
            <p className="text-gray-400">{log.processing_time_ms}ms</p>
          </div>
        </div>
        
        {log.sport_breakdown && (
          <div className="mt-3 flex gap-2">
            {Object.entries(log.sport_breakdown).map(([sport, count]) => (
              <Badge key={sport} variant="outline" className="text-xs">
                {sport.toUpperCase()}: {count}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && gameDetails && gameDetails.length > 0 && (
        <div className="p-4 bg-gray-900/50 border-t border-gray-700 space-y-3">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Game-by-Game Details</h4>
          {gameDetails.map((game: any, idx: number) => (
            <div key={idx} className="p-3 bg-gray-800/30 rounded border border-gray-700/50">
              {/* Game Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {game.sport?.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-medium text-white">{game.matchup}</span>
                </div>
                <Badge className={
                  game.action === 'added' ? 'bg-green-500/20 text-green-400' :
                  game.action === 'updated' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }>
                  {game.action}
                </Badge>
              </div>

              {/* Bookmaker Presence */}
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Bookmakers:</p>
                <div className="flex gap-1 flex-wrap">
                  {game.bookmakersAfter?.map((book: string) => (
                    <Badge key={book} variant="outline" className="text-xs">
                      {book === 'williamhill_us' ? 'Caesars' : book}
                    </Badge>
                  ))}
                  {game.bookmakersBefore && game.bookmakersBefore.length !== game.bookmakersAfter?.length && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                      ⚠️ Count changed: {game.bookmakersBefore.length} → {game.bookmakersAfter?.length}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Odds Changes Summary */}
              {game.oddsChangesSummary && (
                <div className="text-xs space-y-1">
                  {game.oddsChangesSummary.moneylineChanged && (
                    <p className="text-blue-400">💰 Moneyline changed</p>
                  )}
                  {game.oddsChangesSummary.spreadChanged && (
                    <p className="text-purple-400">📊 Spread changed</p>
                  )}
                  {game.oddsChangesSummary.totalChanged && (
                    <p className="text-green-400">🎯 Total changed</p>
                  )}
                  {game.oddsChangesSummary.largestSwing && game.oddsChangesSummary.largestSwing > 100 && (
                    <p className="text-red-400 font-semibold">
                      ⚠️ Large swing detected: {game.oddsChangesSummary.largestSwing} points
                    </p>
                  )}
                </div>
              )}

              {/* Warnings */}
              {game.warnings && game.warnings.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  {game.warnings.map((warning: string, wIdx: number) => (
                    <p key={wIdx} className="text-xs text-yellow-400">⚠️ {warning}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Details Available */}
      {expanded && (!gameDetails || gameDetails.length === 0) && (
        <div className="p-4 bg-gray-900/50 border-t border-gray-700 text-center text-gray-500 text-sm">
          No detailed game data available for this ingestion.
          <br />
          <span className="text-xs">This feature was added recently - new ingestions will include details.</span>
        </div>
      )}
    </div>
  )
}

export default function MonitoringPage() {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([])
  const [dailyQuota, setDailyQuota] = useState<QuotaTracking | null>(null)
  const [monthlyQuota, setMonthlyQuota] = useState<QuotaTracking | null>(null)
  const [ingestionLogs, setIngestionLogs] = useState<IngestionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Debug Report State
  const [showDebugModal, setShowDebugModal] = useState(false)
  const [debugReport, setDebugReport] = useState<string>('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchMonitoringData()
  }, [])

  const fetchMonitoringData = async () => {
    setLoading(true)
    try {
      const [callsRes, quotaRes, logsRes] = await Promise.all([
        fetch('/api/monitoring/api-calls?limit=50'),
        fetch('/api/monitoring/quota'),
        fetch('/api/monitoring/ingestion-logs?limit=20')
      ])

      const callsData = await callsRes.json()
      const quotaData = await quotaRes.json()
      const logsData = await logsRes.json()

      if (callsData.success) setApiCalls(callsData.data)
      if (quotaData.success) {
        setDailyQuota(quotaData.data.daily)
        setMonthlyQuota(quotaData.data.monthly)
      }
      if (logsData.success) setIngestionLogs(logsData.data)
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateDebugReport = async () => {
    setGeneratingReport(true)
    setCopied(false)
    
    try {
      // Run data quality checks
      const checks = {
        totalCalls: apiCalls.length,
        successRate: apiCalls.length > 0 ? (apiCalls.filter(c => c.success).length / apiCalls.length * 100).toFixed(1) : 0,
        avgResponseTime: apiCalls.length > 0 ? (apiCalls.reduce((sum, c) => sum + c.response_time_ms, 0) / apiCalls.length).toFixed(0) : 0,
        totalIngestions: ingestionLogs.length,
        ingestionSuccessRate: ingestionLogs.length > 0 ? (ingestionLogs.filter(l => l.success).length / ingestionLogs.length * 100).toFixed(1) : 0,
      }
      
      // Analyze bookmaker reliability
      const bookmakerStats: Record<string, { appearances: number, totalGames: number }> = {}
      ingestionLogs.forEach(log => {
        const gameDetails = log.game_details as any[] | undefined
        if (gameDetails) {
          gameDetails.forEach(game => {
            game.bookmakersAfter?.forEach((book: string) => {
              if (!bookmakerStats[book]) bookmakerStats[book] = { appearances: 0, totalGames: 0 }
              bookmakerStats[book].appearances++
            })
            bookmakerStats[game.sport] = bookmakerStats[game.sport] || { appearances: 0, totalGames: 0 }
            bookmakerStats[game.sport].totalGames++
          })
        }
      })
      
      // Detect anomalies
      const anomalies: string[] = []
      const recentLogs = ingestionLogs.slice(0, 5)
      recentLogs.forEach(log => {
        const gameDetails = log.game_details as any[] | undefined
        if (gameDetails) {
          gameDetails.forEach(game => {
            if (game.oddsChangesSummary?.largestSwing && game.oddsChangesSummary.largestSwing > 200) {
              anomalies.push(`⚠️ ${game.matchup}: ${game.oddsChangesSummary.largestSwing}pt swing`)
            }
            if (game.bookmakersAfter && game.bookmakersAfter.length < 2) {
              anomalies.push(`⚠️ ${game.matchup}: Only ${game.bookmakersAfter.length} bookmaker(s)`)
            }
            if (game.warnings && game.warnings.length > 0) {
              game.warnings.forEach((w: string) => anomalies.push(`⚠️ ${game.matchup}: ${w}`))
            }
          })
        }
      })
      
      // Calculate sport coverage
      const sportCoverage: Record<string, { games: number, avgBookmakers: number }> = {}
      recentLogs.forEach(log => {
        const gameDetails = log.game_details as any[] | undefined
        if (gameDetails) {
          gameDetails.forEach(game => {
            if (!sportCoverage[game.sport]) {
              sportCoverage[game.sport] = { games: 0, avgBookmakers: 0 }
            }
            sportCoverage[game.sport].games++
            sportCoverage[game.sport].avgBookmakers += game.bookmakersAfter?.length || 0
          })
        }
      })
      Object.keys(sportCoverage).forEach(sport => {
        if (sportCoverage[sport].games > 0) {
          sportCoverage[sport].avgBookmakers = Math.round(sportCoverage[sport].avgBookmakers / sportCoverage[sport].games)
        }
      })
      
      // Generate formatted report
      const report = `
═══════════════════════════════════════════════════════════
🔍 DEEPPICK DATA FEED DEBUG REPORT
═══════════════════════════════════════════════════════════
Generated: ${new Date().toLocaleString()}

📊 OVERALL HEALTH CHECK
──────────────────────────────────────────────────────────
✓ API Calls (Last 50):        ${checks.totalCalls}
✓ Success Rate:               ${checks.successRate}%
✓ Avg Response Time:          ${checks.avgResponseTime}ms
✓ Data Ingestions (Last 20):  ${checks.totalIngestions}
✓ Ingestion Success Rate:     ${checks.ingestionSuccessRate}%

📡 API QUOTA STATUS
──────────────────────────────────────────────────────────
Daily Quota:
  • Used: ${dailyQuota?.quota_used_percentage || 0}%
  • Remaining: ${dailyQuota?.quota_remaining || 0}
  • Total Calls: ${dailyQuota?.total_calls || 0}
  • Events Received: ${dailyQuota?.total_events_received || 0}

Monthly Quota:
  • Used: ${monthlyQuota?.quota_used_percentage || 0}%
  • Remaining: ${monthlyQuota?.quota_remaining || 0}

🏈 SPORT COVERAGE (Last 5 Ingestions)
──────────────────────────────────────────────────────────
${Object.entries(sportCoverage).map(([sport, data]) => 
  `${sport.toUpperCase()}: ${data.games} games, avg ${data.avgBookmakers} bookmakers/game`
).join('\n')}

📚 BOOKMAKER RELIABILITY
──────────────────────────────────────────────────────────
${Object.entries(bookmakerStats)
  .filter(([key]) => !['nfl', 'nba', 'mlb'].includes(key))
  .sort((a, b) => b[1].appearances - a[1].appearances)
  .map(([book, stats]) => `${book}: ${stats.appearances} appearances`)
  .join('\n') || 'No bookmaker data available'}

⚠️ ANOMALIES DETECTED (Last 5 Ingestions)
──────────────────────────────────────────────────────────
${anomalies.length > 0 ? anomalies.slice(0, 10).join('\n') : '✓ No anomalies detected'}
${anomalies.length > 10 ? `\n... and ${anomalies.length - 10} more` : ''}

📋 RECENT API CALLS (Last 10)
──────────────────────────────────────────────────────────
${apiCalls.slice(0, 10).map(call => 
  `${new Date(call.request_timestamp).toLocaleTimeString()} | ${call.endpoint} | ${call.response_status} | ${call.events_received} events | ${call.response_time_ms}ms`
).join('\n')}

📥 RECENT INGESTIONS (Last 5)
──────────────────────────────────────────────────────────
${ingestionLogs.slice(0, 5).map(log => 
  `${new Date(log.created_at).toLocaleTimeString()} | +${log.games_added} added, ~${log.games_updated} updated | ${log.odds_history_records_created} odds records | ${log.processing_time_ms}ms`
).join('\n')}

🔧 RECOMMENDED ACTIONS
──────────────────────────────────────────────────────────
${anomalies.length > 5 ? '⚠️ HIGH ANOMALY COUNT: Review game matching logic' : '✓ Anomaly count normal'}
${parseFloat(checks.successRate as string) < 95 ? '⚠️ LOW SUCCESS RATE: Check API connectivity' : '✓ Success rate healthy'}
${parseFloat(checks.avgResponseTime as string) > 200 ? '⚠️ SLOW RESPONSES: API may be under load' : '✓ Response times normal'}
${(dailyQuota?.quota_used_percentage || 0) > 80 ? '⚠️ QUOTA WARNING: Approaching daily limit' : '✓ Quota usage healthy'}

═══════════════════════════════════════════════════════════
📋 Copy this report and paste to Cursor for troubleshooting
═══════════════════════════════════════════════════════════
      `.trim()
      
      setDebugReport(report)
      setShowDebugModal(true)
    } catch (error) {
      console.error('Error generating debug report:', error)
      setDebugReport('Error generating report. Please try again.')
      setShowDebugModal(true)
    } finally {
      setGeneratingReport(false)
    }
  }
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(debugReport)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-400' : 'text-red-400'
  }

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 70) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                API MONITORING
              </h1>
              <p className="text-gray-400 text-lg">Real-time data ingestion & usage tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={generateDebugReport} 
              disabled={generatingReport}
              className="gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              <FileText className={`w-4 h-4 ${generatingReport ? 'animate-pulse' : ''}`} />
              {generatingReport ? 'Generating...' : 'Debug Report'}
            </Button>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <Home className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
            <Button onClick={fetchMonitoringData} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-effect border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Today's Calls</p>
                  <p className="text-3xl font-bold text-blue-400">
                    {dailyQuota?.total_calls || 0}
                  </p>
                </div>
                <Server className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Success Rate</p>
                  <p className="text-3xl font-bold text-green-400">
                    {dailyQuota ? Math.round((dailyQuota.successful_calls / dailyQuota.total_calls) * 100) : 0}%
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Events Received</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {dailyQuota?.total_events_received || 0}
                  </p>
                </div>
                <Database className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Quota Remaining</p>
                  <p className={`text-3xl font-bold ${getQuotaColor(monthlyQuota?.quota_used_percentage || 0)}`}>
                    {monthlyQuota?.quota_remaining || '?'}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="api-calls">API Calls</TabsTrigger>
            <TabsTrigger value="ingestion">Ingestion Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Quota Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-effect border-blue-500/30">
                <CardHeader>
                  <CardTitle className="text-blue-400 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Daily Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dailyQuota ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Calls</span>
                        <span className="text-2xl font-bold text-white">{dailyQuota.total_calls}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Successful</span>
                        <span className="text-lg font-semibold text-green-400">{dailyQuota.successful_calls}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Failed</span>
                        <span className="text-lg font-semibold text-red-400">{dailyQuota.failed_calls}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Events Received</span>
                        <span className="text-lg font-semibold text-purple-400">{dailyQuota.total_events_received}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500">No data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-effect border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-purple-400 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Monthly Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {monthlyQuota ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Calls</span>
                        <span className="text-2xl font-bold text-white">{monthlyQuota.total_calls}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Quota Remaining</span>
                        <span className={`text-lg font-semibold ${getQuotaColor(monthlyQuota.quota_used_percentage)}`}>
                          {monthlyQuota.quota_remaining}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Usage</span>
                        <span className={`text-lg font-semibold ${getQuotaColor(monthlyQuota.quota_used_percentage)}`}>
                          {monthlyQuota.quota_used_percentage?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            monthlyQuota.quota_used_percentage >= 90 ? 'bg-red-500' :
                            monthlyQuota.quota_used_percentage >= 70 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(monthlyQuota.quota_used_percentage, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500">No data yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="glass-effect border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-300 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {apiCalls.slice(0, 10).map((call) => (
                    <div key={call.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {call.success ? (
                          <Wifi className="w-5 h-5 text-green-400" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-white">{call.endpoint}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(call.request_timestamp).toLocaleString()} • {call.triggered_by}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={call.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                          {call.response_status}
                        </Badge>
                        <span className="text-sm text-gray-400">{call.events_received} events</span>
                        <span className="text-xs text-gray-500">{call.response_time_ms}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Calls Tab */}
          <TabsContent value="api-calls">
            <Card className="glass-effect border-gray-700">
              <CardHeader>
                <CardTitle>All API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-3">Timestamp</th>
                        <th className="text-left p-3">Endpoint</th>
                        <th className="text-center p-3">Status</th>
                        <th className="text-center p-3">Events</th>
                        <th className="text-center p-3">Time</th>
                        <th className="text-left p-3">Triggered By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiCalls.map((call) => (
                        <tr key={call.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="p-3 text-gray-400">
                            {new Date(call.request_timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-xs">{call.endpoint}</td>
                          <td className="p-3 text-center">
                            <Badge className={call.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                              {call.response_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-center text-purple-400">{call.events_received}</td>
                          <td className="p-3 text-center text-gray-400">{call.response_time_ms}ms</td>
                          <td className="p-3">
                            <Badge variant="outline">{call.triggered_by}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ingestion Logs Tab - ENHANCED */}
          <TabsContent value="ingestion">
            <Card className="glass-effect border-gray-700">
              <CardHeader>
                <CardTitle>Data Ingestion Logs</CardTitle>
                <p className="text-sm text-gray-400 mt-2">Detailed game-by-game tracking with bookmaker presence and odds changes</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ingestionLogs.map((log) => (
                    <IngestionLogEntry key={log.id} log={log} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Debug Report Modal */}
        {showDebugModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-blue-900/30">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-purple-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Debug Report</h2>
                    <p className="text-sm text-gray-400">Comprehensive data feed analysis</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDebugModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                <pre className="bg-gray-950 border border-gray-800 rounded-lg p-6 text-sm text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto">
                  {debugReport}
                </pre>
              </div>
              
              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-700 flex items-center justify-between bg-gray-900/50">
                <div className="text-sm text-gray-400">
                  <p>💡 Copy this report and paste it into Cursor chat for AI-powered troubleshooting</p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setShowDebugModal(false)} 
                    variant="outline"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={copyToClipboard}
                    className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    {copied ? (
                      <>
                        <CheckCheck className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

