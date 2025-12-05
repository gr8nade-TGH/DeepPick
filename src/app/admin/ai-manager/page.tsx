'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  RefreshCw,
  Target,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  Play,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import {
  TOTALS_ARCHETYPES,
  SPREAD_ARCHETYPES,
  type ArchetypeDefinition
} from '@/lib/ai-insights/archetype-definitions'

interface TestResult {
  archetypeId: string
  gameId: string
  pass1: { status: 'pending' | 'running' | 'complete' | 'error'; data?: any; error?: string }
  pass2: { status: 'pending' | 'running' | 'complete' | 'error'; data?: any; error?: string }
  pass3: { status: 'pending' | 'running' | 'complete' | 'error'; data?: any; error?: string }
  overall: { quality: number; status: 'verified' | 'flagged' | 'rejected' | 'pending' }
}

export default function AIManagerPage() {
  const [activeTab, setActiveTab] = useState('totals')
  const [expandedArchetypes, setExpandedArchetypes] = useState<Set<string>>(new Set())
  const [testingArchetype, setTestingArchetype] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [todaysGames, setTodaysGames] = useState<{ id: string; label: string }[]>([])
  const [selectedGame, setSelectedGame] = useState<string>('')

  useEffect(() => {
    // Fetch today's games for test dropdown
    fetchTodaysGames()
  }, [])

  const fetchTodaysGames = async () => {
    try {
      const res = await fetch('/api/games/today')
      const data = await res.json()
      if (data.games) {
        setTodaysGames(data.games.map((g: any) => ({
          id: g.game_id,
          label: `${g.away_team} @ ${g.home_team}`
        })))
        if (data.games.length > 0) {
          setSelectedGame(data.games[0].game_id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch games:', err)
      // Fallback sample games for testing
      setTodaysGames([
        { id: 'sample-1', label: 'LAL @ BOS' },
        { id: 'sample-2', label: 'GSW @ MIA' },
        { id: 'sample-3', label: 'DEN @ PHX' }
      ])
      setSelectedGame('sample-1')
    }
  }

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedArchetypes)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedArchetypes(newSet)
  }

  const runTest = async (archetype: ArchetypeDefinition) => {
    if (!selectedGame) return
    setTestingArchetype(archetype.id)

    // Initialize test result
    setTestResults(prev => ({
      ...prev,
      [archetype.id]: {
        archetypeId: archetype.id,
        gameId: selectedGame,
        pass1: { status: 'running' },
        pass2: { status: 'pending' },
        pass3: { status: 'pending' },
        overall: { quality: 0, status: 'pending' }
      }
    }))

    try {
      const res = await fetch('/api/admin/test-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archetypeId: archetype.id, gameId: selectedGame })
      })
      const data = await res.json()

      setTestResults(prev => ({
        ...prev,
        [archetype.id]: data.result
      }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [archetype.id]: {
          ...prev[archetype.id],
          pass1: { status: 'error', error: 'Failed to run test' },
          overall: { quality: 0, status: 'rejected' }
        }
      }))
    }

    setTestingArchetype(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-400" />
              AI Archetype Insights Manager
            </h1>
            <p className="text-slate-400 mt-1">Test and monitor 3-pass AI verification system</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              {todaysGames.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <Button onClick={fetchTodaysGames} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh Games
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard title="TOTALS Archetypes" value={TOTALS_ARCHETYPES.length} icon={Target} color="blue" />
          <SummaryCard title="SPREAD Archetypes" value={SPREAD_ARCHETYPES.length} icon={Zap} color="orange" />
          <SummaryCard title="Total Archetypes" value={TOTALS_ARCHETYPES.length + SPREAD_ARCHETYPES.length} icon={Brain} color="purple" />
          <SummaryCard title="Active Tests" value={testingArchetype ? 1 : 0} icon={Activity} color="green" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 mb-6">
            <TabsTrigger value="totals" className="gap-2">
              <Target className="w-4 h-4" /> TOTALS ({TOTALS_ARCHETYPES.length})
            </TabsTrigger>
            <TabsTrigger value="spread" className="gap-2">
              <Zap className="w-4 h-4" /> SPREAD ({SPREAD_ARCHETYPES.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="w-4 h-4" /> Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="totals">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {TOTALS_ARCHETYPES.map(archetype => (
                <ArchetypeCard
                  key={archetype.id}
                  archetype={archetype}
                  expanded={expandedArchetypes.has(archetype.id)}
                  onToggle={() => toggleExpand(archetype.id)}
                  onTest={() => runTest(archetype)}
                  testing={testingArchetype === archetype.id}
                  testResult={testResults[archetype.id]}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="spread">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SPREAD_ARCHETYPES.map(archetype => (
                <ArchetypeCard
                  key={archetype.id}
                  archetype={archetype}
                  expanded={expandedArchetypes.has(archetype.id)}
                  onToggle={() => toggleExpand(archetype.id)}
                  onTest={() => runTest(archetype)}
                  testing={testingArchetype === archetype.id}
                  testResult={testResults[archetype.id]}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="monitoring">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Quality Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">
                  Quality metrics and monitoring dashboard will be implemented in Phase 6.
                  This will show rejection rates, cost tracking, and performance metrics.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const colors = { blue: 'text-blue-400', orange: 'text-orange-400', purple: 'text-purple-400', green: 'text-green-400' }
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
          </div>
          <Icon className={`w-10 h-10 ${colors[color as keyof typeof colors]}/50`} />
        </div>
      </CardContent>
    </Card>
  )
}

interface ArchetypeCardProps {
  archetype: ArchetypeDefinition
  expanded: boolean
  onToggle: () => void
  onTest: () => void
  testing: boolean
  testResult?: TestResult
}

function ArchetypeCard({ archetype, expanded, onToggle, onTest, testing, testResult }: ArchetypeCardProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{archetype.icon}</span>
            <div>
              <CardTitle className="text-lg text-white">{archetype.name}</CardTitle>
              <p className="text-xs text-slate-500">{archetype.id}</p>
            </div>
          </div>
          <Badge className={archetype.betType === 'TOTAL'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
            : 'bg-orange-500/20 text-orange-400 border-orange-500/50'}>
            {archetype.betType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-slate-300 text-sm mb-4">{archetype.description}</p>

        {/* Factor Inputs */}
        <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Required Outputs</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-purple-400 font-mono font-bold">X</span>
              <span className="text-slate-300">= {archetype.factorInputs.X.name}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400 font-mono font-bold">Y</span>
              <span className="text-slate-300">= {archetype.factorInputs.Y.name}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400 font-mono font-bold">Z</span>
              <span className="text-slate-300">= {archetype.factorInputs.Z.name}</span>
            </div>
          </div>
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Test Results</p>
            <div className="space-y-2">
              <PassStatus label="Pass 1 (Researcher)" status={testResult.pass1.status} />
              <PassStatus label="Pass 2 (Auditor)" status={testResult.pass2.status} />
              <PassStatus label="Pass 3 (Judge)" status={testResult.pass3.status} />
              {testResult.overall.status !== 'pending' && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Quality Score</span>
                    <span className={`font-bold ${testResult.overall.quality >= 0.75 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {(testResult.overall.quality * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-400">Status</span>
                    <Badge className={
                      testResult.overall.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                        testResult.overall.status === 'flagged' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                    }>
                      {testResult.overall.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onToggle}
            variant="outline"
            size="sm"
            className="gap-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Hide Details' : 'View Details'}
          </Button>
          <Button
            onClick={onTest}
            disabled={testing}
            size="sm"
            className="gap-1 bg-purple-600 hover:bg-purple-500"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {testing ? 'Testing...' : 'Test Archetype'}
          </Button>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Philosophy</p>
              <p className="text-slate-300 text-sm">{archetype.philosophy}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Focus Factors</p>
              <div className="flex flex-wrap gap-1">
                {archetype.focusFactors.map(f => (
                  <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">X/Y/Z Ranges</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['X', 'Y', 'Z'] as const).map(key => (
                  <div key={key} className="bg-slate-900 rounded p-2">
                    <span className="text-purple-400 font-mono font-bold">{key}</span>
                    <p className="text-slate-400 mt-1">
                      [{archetype.factorInputs[key].range.min}, {archetype.factorInputs[key].range.max}]
                      {archetype.factorInputs[key].unit && <span className="text-slate-500"> {archetype.factorInputs[key].unit}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PassStatus({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      {status === 'pending' && <span className="text-slate-500">Pending</span>}
      {status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
      {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-400" />}
      {status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
    </div>
  )
}

