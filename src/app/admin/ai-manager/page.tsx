'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  RefreshCw,
  Target,
  Zap,
  Activity,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react'
import {
  TOTALS_ARCHETYPES,
  SPREAD_ARCHETYPES,
  ALL_ARCHETYPES,
  type ArchetypeDefinition
} from '@/lib/ai-insights/archetype-definitions'

interface GrokResult {
  success: boolean
  sentiment?: {
    awaySentimentPct: number
    homeSentimentPct: number
    awayReasons: string[]
    homeReasons: string[]
    overallConfidence: string
    samplePosts: Array<{ text: string; likes: number; sentiment: string }>
    rawAnalysis: string
    awayTotalLikes: number
    homeTotalLikes: number
  }
  pulseScore?: {
    direction: string
    points: number
    teamName: string
    breakdown: {
      sentimentLean: number
      engagementLean: number
      rawLean: number
      confidenceMultiplier: number
    }
  }
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  meta?: { duration: string; timestamp: string }
}

interface GameInfo {
  id: string
  away_team: { name: string; abbreviation: string }
  home_team: { name: string; abbreviation: string }
  odds?: { spread?: { line: number }; total?: { line: number } }
}

export default function AIManagerPage() {
  const [activeTab, setActiveTab] = useState('pulse')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [todaysGames, setTodaysGames] = useState<GameInfo[]>([])
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [grokResult, setGrokResult] = useState<GrokResult | null>(null)
  const [grokLoading, setGrokLoading] = useState(false)
  const [betType, setBetType] = useState<'SPREAD' | 'TOTAL'>('SPREAD')

  useEffect(() => {
    fetchTodaysGames()
  }, [])

  const fetchTodaysGames = async () => {
    try {
      const res = await fetch('/api/games/today')
      const data = await res.json()
      if (data.games && data.games.length > 0) {
        setTodaysGames(data.games)
        setSelectedGame(data.games[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch games:', err)
    }
  }

  const selectedGameData = todaysGames.find(g => g.id === selectedGame)

  const runGrokTest = async () => {
    if (!selectedGameData) return
    setGrokLoading(true)
    setGrokResult(null)

    try {
      const spreadLine = selectedGameData.odds?.spread?.line || 0
      const body = {
        awayTeam: selectedGameData.away_team.name,
        homeTeam: selectedGameData.home_team.name,
        spread: { away: spreadLine, home: -spreadLine },
        total: selectedGameData.odds?.total?.line,
        gameDate: new Date().toISOString().split('T')[0],
        betType
      }

      const res = await fetch('/api/admin/test-grok-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      setGrokResult(data)
    } catch (err) {
      console.error('Grok test failed:', err)
    }
    setGrokLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-[1600px] mx-auto px-4 py-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-bold">AI Manager</h1>
            <Badge className="bg-purple-500/20 text-purple-400 text-xs">Internal</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{ALL_ARCHETYPES.length} archetypes</span>
            <span>•</span>
            <span>{todaysGames.length} games today</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 mb-4 h-8">
            <TabsTrigger value="pulse" className="text-xs h-7 px-3">
              <Activity className="w-3 h-3 mr-1" /> The Pulse (Grok)
            </TabsTrigger>
            <TabsTrigger value="archetypes" className="text-xs h-7 px-3">
              <Brain className="w-3 h-3 mr-1" /> Archetypes ({ALL_ARCHETYPES.length})
            </TabsTrigger>
            <TabsTrigger value="totals" className="text-xs h-7 px-3">
              <Target className="w-3 h-3 mr-1" /> TOTALS ({TOTALS_ARCHETYPES.length})
            </TabsTrigger>
            <TabsTrigger value="spread" className="text-xs h-7 px-3">
              <Zap className="w-3 h-3 mr-1" /> SPREAD ({SPREAD_ARCHETYPES.length})
            </TabsTrigger>
          </TabsList>

          {/* The Pulse - Grok Sentiment Testing */}
          <TabsContent value="pulse" className="mt-0">
            <div className="grid grid-cols-12 gap-4">
              {/* Left: Controls */}
              <div className="col-span-4 space-y-3">
                <div className="bg-slate-900 border border-slate-800 rounded p-3">
                  <h3 className="text-sm font-medium mb-2 text-purple-400">Test Grok Sentiment</h3>

                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Game</label>
                      <select
                        value={selectedGame}
                        onChange={(e) => setSelectedGame(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm"
                      >
                        {todaysGames.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.away_team.abbreviation} @ {g.home_team.abbreviation}
                            {g.odds?.spread?.line ? ` (${g.odds.spread.line > 0 ? '+' : ''}${g.odds.spread.line})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Bet Type</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBetType('SPREAD')}
                          className={`flex-1 px-2 py-1 text-xs rounded ${betType === 'SPREAD' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                        >
                          SPREAD
                        </button>
                        <button
                          onClick={() => setBetType('TOTAL')}
                          className={`flex-1 px-2 py-1 text-xs rounded ${betType === 'TOTAL' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                        >
                          TOTAL
                        </button>
                      </div>
                    </div>

                    {selectedGameData && (
                      <div className="text-xs bg-slate-800/50 rounded p-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Away:</span>
                          <span>{selectedGameData.away_team.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Home:</span>
                          <span>{selectedGameData.home_team.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Spread:</span>
                          <span>{selectedGameData.odds?.spread?.line ? `${selectedGameData.odds.spread.line > 0 ? '+' : ''}${selectedGameData.odds.spread.line}` : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total:</span>
                          <span>{selectedGameData.odds?.total?.line || 'N/A'}</span>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={runGrokTest}
                      disabled={grokLoading || !selectedGame}
                      className="w-full bg-purple-600 hover:bg-purple-500 h-8 text-sm"
                    >
                      {grokLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                      Run Grok Test
                    </Button>
                  </div>
                </div>

                {/* Formula Explanation */}
                <div className="bg-slate-900 border border-slate-800 rounded p-3">
                  <h3 className="text-sm font-medium mb-2 text-slate-400">Pulse Score Formula</h3>
                  <div className="text-xs text-slate-500 space-y-1 font-mono">
                    <p>sentimentLean = (away% - home%) / 100</p>
                    <p>engagementLean = (awayLikes - homeLikes) / total</p>
                    <p>rawLean = (sent * 0.6) + (eng * 0.4)</p>
                    <p>adjLean = rawLean * confidence</p>
                    <p className="text-purple-400">points = √|adjLean| * 5.0</p>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">Sqrt curve amplifies moderate signals</p>
                </div>
              </div>

              {/* Right: Results */}
              <div className="col-span-8">
                {grokResult ? (
                  <div className="space-y-3">
                    {/* Pulse Score Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-green-400">✓ Pulse Score Result</h3>
                        <span className="text-xs text-slate-500">{grokResult.meta?.duration}</span>
                      </div>

                      {grokResult.pulseScore && (
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-2xl font-bold text-purple-400">
                              {grokResult.pulseScore.points.toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-500">Points</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-lg font-bold text-white">
                              {grokResult.pulseScore.teamName}
                            </div>
                            <div className="text-xs text-slate-500">Direction</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-lg font-bold text-slate-300">
                              {(grokResult.pulseScore.breakdown.sentimentLean * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-500">Sent. Lean</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-lg font-bold text-slate-300">
                              {(grokResult.pulseScore.breakdown.engagementLean * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-500">Eng. Lean</div>
                          </div>
                        </div>
                      )}

                      {/* Breakdown Table */}
                      {grokResult.pulseScore && (
                        <table className="w-full text-xs">
                          <tbody>
                            <tr className="border-b border-slate-800">
                              <td className="py-1 text-slate-500">Raw Lean</td>
                              <td className="py-1 text-right font-mono">{grokResult.pulseScore.breakdown.rawLean.toFixed(3)}</td>
                            </tr>
                            <tr className="border-b border-slate-800">
                              <td className="py-1 text-slate-500">Confidence Multiplier</td>
                              <td className="py-1 text-right font-mono">{grokResult.pulseScore.breakdown.confidenceMultiplier}</td>
                            </tr>
                            <tr className="border-b border-slate-800">
                              <td className="py-1 text-slate-500">Tokens Used</td>
                              <td className="py-1 text-right font-mono">{grokResult.usage?.totalTokens}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Sentiment Details */}
                    {grokResult.sentiment && (
                      <div className="bg-slate-900 border border-slate-800 rounded p-3">
                        <h3 className="text-sm font-medium mb-2 text-slate-400">Sentiment Breakdown</h3>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">Away ({selectedGameData?.away_team.abbreviation})</span>
                              <span className="text-lg font-bold text-blue-400">{grokResult.sentiment.awaySentimentPct}%</span>
                            </div>
                            <div className="text-xs text-slate-500">{grokResult.sentiment.awayTotalLikes} likes</div>
                            <ul className="text-xs text-slate-400 mt-1 space-y-0.5">
                              {grokResult.sentiment.awayReasons.map((r, i) => (
                                <li key={i} className="truncate">• {r}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-slate-500">Home ({selectedGameData?.home_team.abbreviation})</span>
                              <span className="text-lg font-bold text-orange-400">{grokResult.sentiment.homeSentimentPct}%</span>
                            </div>
                            <div className="text-xs text-slate-500">{grokResult.sentiment.homeTotalLikes} likes</div>
                            <ul className="text-xs text-slate-400 mt-1 space-y-0.5">
                              {grokResult.sentiment.homeReasons.map((r, i) => (
                                <li key={i} className="truncate">• {r}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Sample Posts */}
                        <div className="border-t border-slate-800 pt-2">
                          <h4 className="text-xs text-slate-500 mb-1">Sample Posts</h4>
                          <div className="space-y-1">
                            {grokResult.sentiment.samplePosts.map((post, i) => (
                              <div key={i} className="text-xs bg-slate-800/30 rounded px-2 py-1 flex items-start gap-2">
                                <Badge className={`shrink-0 text-[10px] ${post.sentiment === 'away' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                  {post.sentiment}
                                </Badge>
                                <span className="text-slate-400 flex-1 line-clamp-2">{post.text}</span>
                                <span className="text-slate-600 shrink-0">❤️ {post.likes}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Raw Analysis */}
                        <div className="border-t border-slate-800 pt-2 mt-2">
                          <h4 className="text-xs text-slate-500 mb-1">Raw Analysis</h4>
                          <p className="text-xs text-slate-400">{grokResult.sentiment.rawAnalysis}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded p-8 text-center">
                    <Activity className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Select a game and run Grok test to see results</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* All Archetypes Table */}
          <TabsContent value="archetypes" className="mt-0">
            <ArchetypeTable archetypes={ALL_ARCHETYPES} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
          </TabsContent>

          {/* TOTALS Archetypes Table */}
          <TabsContent value="totals" className="mt-0">
            <ArchetypeTable archetypes={TOTALS_ARCHETYPES} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
          </TabsContent>

          {/* SPREAD Archetypes Table */}
          <TabsContent value="spread" className="mt-0">
            <ArchetypeTable archetypes={SPREAD_ARCHETYPES} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Compact Archetype Table Component
function ArchetypeTable({
  archetypes,
  expandedRow,
  setExpandedRow
}: {
  archetypes: ArchetypeDefinition[]
  expandedRow: string | null
  setExpandedRow: (id: string | null) => void
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/50">
          <tr className="text-left text-xs text-slate-500">
            <th className="p-2 w-8"></th>
            <th className="p-2 w-10">Icon</th>
            <th className="p-2">Name / ID</th>
            <th className="p-2 w-20">Type</th>
            <th className="p-2">Description</th>
            <th className="p-2">X Output</th>
            <th className="p-2">Y Output</th>
            <th className="p-2">Z Output</th>
            <th className="p-2 w-24">Focus</th>
          </tr>
        </thead>
        <tbody>
          {archetypes.map((a) => (
            <>
              <tr
                key={a.id}
                className={`border-t border-slate-800 hover:bg-slate-800/30 cursor-pointer ${expandedRow === a.id ? 'bg-slate-800/50' : ''}`}
                onClick={() => setExpandedRow(expandedRow === a.id ? null : a.id)}
              >
                <td className="p-2 text-center">
                  {expandedRow === a.id ? (
                    <ChevronUp className="w-3 h-3 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  )}
                </td>
                <td className="p-2 text-center text-lg">{a.icon}</td>
                <td className="p-2">
                  <div className="font-medium text-white">{a.name}</div>
                  <div className="text-xs text-slate-600 font-mono">{a.id}</div>
                </td>
                <td className="p-2">
                  <Badge className={`text-[10px] ${a.betType === 'TOTAL' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {a.betType}
                  </Badge>
                </td>
                <td className="p-2 text-slate-400 text-xs max-w-[200px] truncate">{a.description}</td>
                <td className="p-2">
                  <div className="text-xs">
                    <span className="text-purple-400 font-mono font-bold">X</span>
                    <span className="text-slate-500 ml-1">{a.factorInputs.X.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    [{a.factorInputs.X.range.min}, {a.factorInputs.X.range.max}]
                  </div>
                </td>
                <td className="p-2">
                  <div className="text-xs">
                    <span className="text-purple-400 font-mono font-bold">Y</span>
                    <span className="text-slate-500 ml-1">{a.factorInputs.Y.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    [{a.factorInputs.Y.range.min}, {a.factorInputs.Y.range.max}]
                  </div>
                </td>
                <td className="p-2">
                  <div className="text-xs">
                    <span className="text-purple-400 font-mono font-bold">Z</span>
                    <span className="text-slate-500 ml-1">{a.factorInputs.Z.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    [{a.factorInputs.Z.range.min}, {a.factorInputs.Z.range.max}]
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-0.5">
                    {a.focusFactors.slice(0, 2).map(f => (
                      <Badge key={f} variant="outline" className="text-[9px] px-1 py-0">{f}</Badge>
                    ))}
                    {a.focusFactors.length > 2 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">+{a.focusFactors.length - 2}</Badge>
                    )}
                  </div>
                </td>
              </tr>
              {expandedRow === a.id && (
                <tr key={`${a.id}-expanded`} className="bg-slate-800/30">
                  <td colSpan={9} className="p-3">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <h4 className="text-slate-500 uppercase text-[10px] mb-1">Philosophy</h4>
                        <p className="text-slate-300">{a.philosophy}</p>
                      </div>
                      <div>
                        <h4 className="text-slate-500 uppercase text-[10px] mb-1">Full Description</h4>
                        <p className="text-slate-300">{a.description}</p>
                      </div>
                      <div>
                        <h4 className="text-slate-500 uppercase text-[10px] mb-1">All Focus Factors</h4>
                        <div className="flex flex-wrap gap-1">
                          {a.focusFactors.map(f => (
                            <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="col-span-3 border-t border-slate-700 pt-2 mt-2">
                        <h4 className="text-slate-500 uppercase text-[10px] mb-2">X/Y/Z Output Details</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {(['X', 'Y', 'Z'] as const).map(key => (
                            <div key={key} className="bg-slate-900/50 rounded p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-purple-400 font-mono font-bold text-sm">{key}</span>
                                <span className="text-white font-medium">{a.factorInputs[key].name}</span>
                              </div>
                              <p className="text-slate-500 text-[10px] mb-1">{a.factorInputs[key].description}</p>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-slate-600">Range:</span>
                                <span className="font-mono text-slate-400">
                                  [{a.factorInputs[key].range.min}, {a.factorInputs[key].range.max}]
                                </span>
                                {a.factorInputs[key].unit && (
                                  <span className="text-slate-600">{a.factorInputs[key].unit}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

