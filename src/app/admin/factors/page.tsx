'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Gauge,
  Target,
  Zap,
  Copy,
  Check,
  Sparkles,
  Plus,
  Brain
} from 'lucide-react'
import { StatBrowser } from './components/stat-browser'
import { FactorStrategist } from './components/factor-strategist'
import { PendingFactorsPanel } from './components/pending-factors-panel'

interface FactorSample {
  runId: string
  createdAt: string
  matchup: string
  signal: number
  awayScore: number
  homeScore: number
}

interface FactorStats {
  key: string
  name: string
  betType: 'TOTAL' | 'SPREAD'
  totalRuns: number
  lastRun: string | null
  avgSignal: number
  avgAwayScore: number
  avgHomeScore: number
  zeroCount: number
  healthStatus: 'healthy' | 'warning' | 'error'
  recentSamples: FactorSample[]
}

interface HealthData {
  success: boolean
  timestamp: string
  totalRuns: number
  factors: FactorStats[]
}

export default function FactorDashboardPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set())
  const [statBrowserOpen, setStatBrowserOpen] = useState(false)
  const [strategistOpen, setStrategistOpen] = useState(false)

  const handleSelectStat = (stat: any, category: string) => {
    console.log('Selected stat for new factor:', stat, 'from category:', category)
    // For now, just log - we'll implement factor creation in the next phase
    alert(`Coming soon: Create factor from "${stat.name}" stat\n\nThis will add the stat to the factor registry and make it available for all cappers.`)
  }

  const handleCreateFactorFromAI = (factor: any, betType: string) => {
    console.log('Factor saved as pending:', factor.key, 'for', betType)
    // Factor is now saved to pending_factors table - no alert needed
    // The FactorStrategist component handles the UI state
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/factors/health')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const toggleExpand = (key: string) => {
    const newSet = new Set(expandedFactors)
    if (newSet.has(key)) newSet.delete(key)
    else newSet.add(key)
    setExpandedFactors(newSet)
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />
      default: return <Activity className="w-5 h-5 text-slate-400" />
    }
  }

  const getHealthBadge = (status: string) => {
    const colors = {
      healthy: 'bg-green-500/20 text-green-400 border-green-500/50',
      warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      error: 'bg-red-500/20 text-red-400 border-red-500/50'
    }
    return colors[status as keyof typeof colors] || 'bg-slate-500/20 text-slate-400'
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const now = Date.now()
    const diff = now - d.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const totalFactors = data?.factors.filter(f => f.betType === 'TOTAL') || []
  const spreadFactors = data?.factors.filter(f => f.betType === 'SPREAD') || []

  const healthyCounts = {
    total: totalFactors.filter(f => f.healthStatus === 'healthy').length,
    spread: spreadFactors.filter(f => f.healthStatus === 'healthy').length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Gauge className="w-8 h-8 text-cyan-400" />
              Factor Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Monitor factor health and performance</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setStrategistOpen(true)}
              className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              <Brain className="w-4 h-4" />
              AI Strategist
            </Button>
            <Button
              onClick={() => setStatBrowserOpen(true)}
              className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            >
              <Sparkles className="w-4 h-4" />
              Factor Maker
            </Button>
            <Button onClick={fetchData} disabled={loading} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stat Browser Modal */}
        <StatBrowser
          open={statBrowserOpen}
          onClose={() => setStatBrowserOpen(false)}
          onSelectStat={handleSelectStat}
        />

        {/* AI Factor Strategist Modal */}
        <FactorStrategist
          open={strategistOpen}
          onClose={() => setStrategistOpen(false)}
          onCreateFactor={handleCreateFactorFromAI}
        />

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Runs (7d)</p>
                  <p className="text-3xl font-bold text-white">{data?.totalRuns || 0}</p>
                </div>
                <Activity className="w-10 h-10 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">TOTALS Factors</p>
                  <p className="text-3xl font-bold text-white">
                    <span className="text-green-400">{healthyCounts.total}</span>
                    <span className="text-slate-500">/{totalFactors.length}</span>
                  </p>
                </div>
                <Target className="w-10 h-10 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">SPREAD Factors</p>
                  <p className="text-3xl font-bold text-white">
                    <span className="text-green-400">{healthyCounts.spread}</span>
                    <span className="text-slate-500">/{spreadFactors.length}</span>
                  </p>
                </div>
                <Zap className="w-10 h-10 text-orange-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Factors Panel */}
        <div className="mb-8">
          <PendingFactorsPanel />
        </div>

        {/* TOTALS Factors */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            TOTALS Factors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {totalFactors.map(factor => (
              <FactorCard
                key={factor.key}
                factor={factor}
                expanded={expandedFactors.has(factor.key)}
                onToggle={() => toggleExpand(factor.key)}
                getHealthIcon={getHealthIcon}
                getHealthBadge={getHealthBadge}
                formatTime={formatTime}
              />
            ))}
          </div>
        </div>

        {/* SPREAD Factors */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-400" />
            SPREAD Factors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spreadFactors.map(factor => (
              <FactorCard
                key={factor.key}
                factor={factor}
                expanded={expandedFactors.has(factor.key)}
                onToggle={() => toggleExpand(factor.key)}
                getHealthIcon={getHealthIcon}
                getHealthBadge={getHealthBadge}
                formatTime={formatTime}
              />
            ))}
          </div>
        </div>

        {/* Last Updated */}
        {data && (
          <p className="text-center text-slate-500 text-sm">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}

// Factor Card Component
function FactorCard({
  factor,
  expanded,
  onToggle,
  getHealthIcon,
  getHealthBadge,
  formatTime
}: {
  factor: FactorStats
  expanded: boolean
  onToggle: () => void
  getHealthIcon: (status: string) => React.ReactNode
  getHealthBadge: (status: string) => string
  formatTime: (iso: string | null) => string
}) {
  const [copied, setCopied] = useState(false)

  const copyDebugInfo = async () => {
    const debugInfo = `
## Factor Debug Info
**Generated:** ${new Date().toISOString()}

### Factor Details
- **Name:** ${factor.name}
- **Key:** ${factor.key}
- **Bet Type:** ${factor.betType}
- **Health Status:** ${factor.healthStatus}

### Statistics (Last 7 Days)
- **Total Runs:** ${factor.totalRuns}
- **Last Run:** ${factor.lastRun || 'Never'}
- **Avg Signal:** ${factor.avgSignal.toFixed(4)}
- **Avg ${factor.betType === 'TOTAL' ? 'Over' : 'Away'} Score:** ${factor.avgAwayScore.toFixed(4)}
- **Avg ${factor.betType === 'TOTAL' ? 'Under' : 'Home'} Score:** ${factor.avgHomeScore.toFixed(4)}
- **Zero Count:** ${factor.zeroCount} (${factor.totalRuns > 0 ? Math.round(factor.zeroCount / factor.totalRuns * 100) : 0}%)

### Recent Samples
${factor.recentSamples.length > 0 ? factor.recentSamples.map((s, i) => `
**Sample ${i + 1}:** ${s.matchup}
- Run ID: ${s.runId}
- Created: ${s.createdAt}
- Signal: ${s.signal.toFixed(4)}
- ${factor.betType === 'TOTAL' ? 'Over' : 'Away'} Score: ${s.awayScore.toFixed(4)}
- ${factor.betType === 'TOTAL' ? 'Under' : 'Home'} Score: ${s.homeScore.toFixed(4)}
`).join('\n') : 'No recent samples'}
`.trim()

    try {
      await navigator.clipboard.writeText(debugInfo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getHealthIcon(factor.healthStatus)}
            <CardTitle className="text-lg text-white">{factor.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyDebugInfo}
              className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300 hover:text-white"
              title="Copy Debug Info"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <Badge className={getHealthBadge(factor.healthStatus)}>
              {factor.healthStatus}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-mono">{factor.key}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Runs</p>
            <p className="text-white font-semibold">{factor.totalRuns}</p>
          </div>
          <div>
            <p className="text-slate-400">Last Run</p>
            <p className="text-white font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(factor.lastRun)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Avg Signal</p>
            <p className={`font-semibold flex items-center gap-1 ${factor.avgSignal > 0 ? 'text-green-400' : factor.avgSignal < 0 ? 'text-red-400' : 'text-slate-400'
              }`}>
              {factor.avgSignal > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {factor.avgSignal.toFixed(3)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Zero Rate</p>
            <p className={`font-semibold ${factor.totalRuns > 0 && factor.zeroCount / factor.totalRuns > 0.5 ? 'text-yellow-400' : 'text-white'
              }`}>
              {factor.totalRuns > 0 ? Math.round(factor.zeroCount / factor.totalRuns * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Expand/Collapse for samples */}
        <button
          onClick={onToggle}
          className="w-full mt-4 pt-3 border-t border-slate-700 flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide Samples' : 'Show Samples'}
        </button>

        {expanded && factor.recentSamples.length > 0 && (
          <div className="mt-3 space-y-2">
            {factor.recentSamples.map((sample, i) => (
              <div key={i} className="bg-slate-900/50 rounded p-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>{sample.matchup}</span>
                  <span>{formatTime(sample.createdAt)}</span>
                </div>
                <div className="flex gap-4 mt-1 text-slate-300">
                  <span>Signal: <span className={sample.signal > 0 ? 'text-green-400' : 'text-red-400'}>
                    {sample.signal.toFixed(3)}
                  </span></span>
                  <span>{factor.betType === 'TOTAL' ? 'Over' : 'Away'}: {sample.awayScore.toFixed(2)}</span>
                  <span>{factor.betType === 'TOTAL' ? 'Under' : 'Home'}: {sample.homeScore.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

