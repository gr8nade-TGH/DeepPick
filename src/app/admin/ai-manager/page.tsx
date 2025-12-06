'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  RefreshCw,
  Zap,
  Activity,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Database,
  Eye,
  EyeOff,
  ThumbsUp,
  Users,
  MessageSquare
} from 'lucide-react'

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

interface StoredInsight {
  id: string
  game_id: string
  insight_type: string
  provider: string
  bet_type: string
  away_team: string
  home_team: string
  spread_line: number | null
  total_line: number | null
  raw_data: any
  quantified_value: any
  status: string
  created_at: string
  expires_at: string | null
}

// AI Insights Registry - catalog of all available insight types
const AI_INSIGHTS_REGISTRY = [
  {
    id: 'SENTIMENT_LEAN',
    name: 'Sentiment Lean',
    provider: 'GROK',
    providerModel: 'grok-3-mini',
    betType: 'GLOBAL',
    category: 'Social Sentiment',
    description: 'Measures public opinion % on each side based on X/Twitter discourse',
    outputFormat: 'Percentage lean (-100% to +100%) toward away or home',
    usedByArchetypes: ['The Pulse', 'The Contrarian', 'The Market Mover'],
    status: 'active',
    apiCall: 'Combined with Engagement Lean in PULSE_SENTIMENT',
    weight: '60% of Pulse Score'
  },
  {
    id: 'ENGAGEMENT_LEAN',
    name: 'Engagement Lean',
    provider: 'GROK',
    providerModel: 'grok-3-mini',
    betType: 'GLOBAL',
    category: 'Social Sentiment',
    description: 'Measures social media engagement (likes/retweets) distribution between sides',
    outputFormat: 'Percentage lean (-100% to +100%) based on total engagement',
    usedByArchetypes: ['The Pulse', 'The Buzz Tracker'],
    status: 'active',
    apiCall: 'Combined with Sentiment Lean in PULSE_SENTIMENT',
    weight: '40% of Pulse Score'
  },
  {
    id: 'BOLD_PREDICTIONS',
    name: 'Bold Predictions',
    provider: 'OPENAI',
    providerModel: 'gpt-4o',
    betType: 'TOTAL',
    category: 'Player Performance',
    description: 'AI-generated player performance predictions with confidence levels',
    outputFormat: 'Array of player predictions with reasoning',
    usedByArchetypes: ['The Prophet', 'The Statistician'],
    status: 'active',
    apiCall: 'Individual call per game',
    weight: 'Variable by archetype'
  },
  {
    id: 'PROFESSIONAL_ANALYSIS',
    name: 'Professional Analysis',
    provider: 'OPENAI',
    providerModel: 'gpt-4o-mini',
    betType: 'GLOBAL',
    category: 'Game Breakdown',
    description: 'Comprehensive game analysis writeup for insight cards',
    outputFormat: 'Structured text analysis with key factors',
    usedByArchetypes: ['All cappers (per-pick)'],
    status: 'active',
    apiCall: 'Per-pick generation (not shared)',
    weight: 'N/A (narrative only)'
  },
  {
    id: 'NEWS_SIGNAL',
    name: 'News Signal',
    provider: 'PERPLEXITY',
    providerModel: 'sonar-pro',
    betType: 'GLOBAL',
    category: 'Breaking News',
    description: 'Real-time news and injury updates that could impact the game',
    outputFormat: 'News items with sentiment impact scores',
    usedByArchetypes: ['The Insider', 'The News Hawk'],
    status: 'planned',
    apiCall: 'Per game, cached 1 hour',
    weight: 'TBD'
  },
  {
    id: 'INJURY_IMPACT',
    name: 'Injury Impact',
    provider: 'OPENAI',
    providerModel: 'gpt-4o',
    betType: 'GLOBAL',
    category: 'Lineup Analysis',
    description: 'Analyzes how injuries/rest affect pace, totals, and spreads',
    outputFormat: 'Impact score with affected metrics',
    usedByArchetypes: ['The Medic', 'The Pace Analyst'],
    status: 'planned',
    apiCall: 'Per game, uses MySportsFeeds injury data',
    weight: 'TBD'
  },
  {
    id: 'SHARP_MONEY',
    name: 'Sharp Money Flow',
    provider: 'SYSTEM',
    providerModel: 'Internal calculation',
    betType: 'SPREAD',
    category: 'Betting Markets',
    description: 'Tracks line movement and betting percentages to identify sharp action',
    outputFormat: 'Sharp lean direction with confidence',
    usedByArchetypes: ['The Contrarian', 'The Sharp Follower'],
    status: 'planned',
    apiCall: 'Requires odds API integration',
    weight: 'TBD'
  },
  {
    id: 'HISTORICAL_MATCHUP',
    name: 'Historical Matchup',
    provider: 'SYSTEM',
    providerModel: 'MySportsFeeds',
    betType: 'GLOBAL',
    category: 'Historical Data',
    description: 'Head-to-head history and trends between teams',
    outputFormat: 'Trend indicators with win rates',
    usedByArchetypes: ['The Historian', 'The Trend Spotter'],
    status: 'planned',
    apiCall: 'Per matchup, uses MySportsFeeds',
    weight: 'TBD'
  }
]

export default function AIManagerPage() {
  const [activeTab, setActiveTab] = useState('insights')
  const [expandedInsight, setExpandedInsight] = useState<{ gameId: string; type: string } | null>(null)
  const [todaysGames, setTodaysGames] = useState<GameInfo[]>([])
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [grokResult, setGrokResult] = useState<GrokResult | null>(null)
  const [grokLoading, setGrokLoading] = useState(false)
  const [betType, setBetType] = useState<'SPREAD' | 'TOTAL'>('SPREAD')
  const [storedInsights, setStoredInsights] = useState<StoredInsight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [generatingGame, setGeneratingGame] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // The Influencer state
  const [influencerResult, setInfluencerResult] = useState<any>(null)
  const [influencerLoading, setInfluencerLoading] = useState(false)
  const [minFollowers, setMinFollowers] = useState(10000)

  // The Interpreter state
  const [interpreterResult, setInterpreterResult] = useState<any>(null)
  const [interpreterLoading, setInterpreterLoading] = useState(false)

  // The Devil's Advocate state
  const [devilsResult, setDevilsResult] = useState<any>(null)
  const [devilsLoading, setDevilsLoading] = useState(false)
  const [ourPick, setOurPick] = useState('')
  const [ourConfidence, setOurConfidence] = useState(65)

  useEffect(() => {
    fetchTodaysGames()
    fetchStoredInsights()
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

  const fetchStoredInsights = async () => {
    setInsightsLoading(true)
    try {
      const res = await fetch('/api/admin/ai-insights')
      const data = await res.json()
      if (data.success) {
        setStoredInsights(data.insights || [])
      }
    } catch (err) {
      console.error('Failed to fetch insights:', err)
    }
    setInsightsLoading(false)
  }

  const generateInsight = async (game: GameInfo, type: string) => {
    setGeneratingGame(game.id)
    try {
      const spreadLine = game.odds?.spread?.line || 0
      const res = await fetch('/api/admin/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          insightType: type,
          awayTeam: game.away_team.name,
          homeTeam: game.home_team.name,
          spread: { away: spreadLine, home: -spreadLine },
          total: game.odds?.total?.line,
          betType: 'SPREAD'
        })
      })
      await res.json()
      await fetchStoredInsights()
    } catch (err) {
      console.error('Failed to generate insight:', err)
    }
    setGeneratingGame(null)
  }

  const copyDebugInfo = () => {
    const debugData = {
      timestamp: new Date().toISOString(),
      todaysGames: todaysGames.map(g => ({
        id: g.id,
        matchup: `${g.away_team.abbreviation} @ ${g.home_team.abbreviation}`,
        spread: g.odds?.spread?.line,
        total: g.odds?.total?.line
      })),
      storedInsights: storedInsights,
      grokResult: grokResult
    }
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getInsightsForGame = (gameId: string) => {
    return storedInsights.filter(i => i.game_id === gameId)
  }

  const selectedGameData = todaysGames.find(g => g.id === selectedGame)

  const runInfluencerTest = async () => {
    if (!selectedGameData) return
    setInfluencerLoading(true)
    setInfluencerResult(null)

    try {
      const spreadLine = selectedGameData.odds?.spread?.line || 0
      const body = {
        awayTeam: selectedGameData.away_team.name,
        homeTeam: selectedGameData.home_team.name,
        spread: { away: spreadLine, home: -spreadLine },
        total: selectedGameData.odds?.total?.line,
        gameDate: new Date().toISOString().split('T')[0],
        betType,
        minFollowers
      }

      const res = await fetch('/api/admin/test-influencer-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      setInfluencerResult(data)
    } catch (err) {
      setInfluencerResult({ error: 'Failed to call API' })
    } finally {
      setInfluencerLoading(false)
    }
  }

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

  const runInterpreterTest = async () => {
    if (!selectedGameData) return
    setInterpreterLoading(true)
    setInterpreterResult(null)

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

      const res = await fetch('/api/admin/test-interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      setInterpreterResult(data)
    } catch (err) {
      setInterpreterResult({ error: 'Failed to call API' })
    } finally {
      setInterpreterLoading(false)
    }
  }

  const runDevilsAdvocateTest = async () => {
    if (!selectedGameData || !ourPick) return
    setDevilsLoading(true)
    setDevilsResult(null)

    try {
      const spreadLine = selectedGameData.odds?.spread?.line || 0
      const body = {
        awayTeam: selectedGameData.away_team.name,
        homeTeam: selectedGameData.home_team.name,
        spread: { away: spreadLine, home: -spreadLine },
        total: selectedGameData.odds?.total?.line,
        gameDate: new Date().toISOString().split('T')[0],
        betType,
        ourPick,
        ourConfidence
      }

      const res = await fetch('/api/admin/test-devils-advocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      setDevilsResult(data)
    } catch (err) {
      setDevilsResult({ error: 'Failed to call API' })
    } finally {
      setDevilsLoading(false)
    }
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>4 AI archetypes</span>
              <span>•</span>
              <span>{todaysGames.length} games</span>
              <span>•</span>
              <span>{storedInsights.length} insights</span>
            </div>
            <Button
              onClick={copyDebugInfo}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy Debug'}
            </Button>
            <Button
              onClick={() => { fetchTodaysGames(); fetchStoredInsights() }}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 mb-4 h-8">
            <TabsTrigger value="insights" className="text-xs h-7 px-3">
              <Database className="w-3 h-3 mr-1" /> Game Insights ({storedInsights.length})
            </TabsTrigger>
            <TabsTrigger value="registry" className="text-xs h-7 px-3">
              <Zap className="w-3 h-3 mr-1" /> AI Insights Registry
            </TabsTrigger>
            <TabsTrigger value="ai-archetypes" className="text-xs h-7 px-3">
              <Activity className="w-3 h-3 mr-1" /> AI Archetypes (4)
            </TabsTrigger>
          </TabsList>

          {/* Game Insights - Stored per matchup */}
          <TabsContent value="insights" className="mt-0">
            <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Stored AI Insights</h3>
                  <p className="text-xs text-slate-500">Generated once per game, referenced by all cappers</p>
                </div>
                {insightsLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
              </div>

              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="p-2">Game</th>
                    <th className="p-2 w-20">Spread</th>
                    <th className="p-2 w-20">Total</th>
                    <th className="p-2 text-purple-400">🌊 Pulse</th>
                    <th className="p-2 text-amber-400">👑 Influencer</th>
                    <th className="p-2 text-emerald-400">🔮 Interpreter</th>
                    <th className="p-2 text-red-400">😈 Devils Adv.</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysGames.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">No games found</td>
                    </tr>
                  ) : (
                    todaysGames.map(game => {
                      const gameInsights = getInsightsForGame(game.id)
                      const pulseInsight = gameInsights.find(i => i.insight_type === 'PULSE_SENTIMENT')
                      const influencerInsight = gameInsights.find(i => i.insight_type === 'INFLUENCER_SENTIMENT')
                      const interpreterInsight = gameInsights.find(i => i.insight_type === 'INTERPRETER_ANALYSIS')
                      const devilsInsight = gameInsights.find(i => i.insight_type === 'DEVILS_ADVOCATE')
                      const expandedType = expandedInsight?.gameId === game.id ? expandedInsight.type : null
                      const sentiment = pulseInsight?.raw_data?.sentiment
                      const interpreterData = interpreterInsight?.raw_data?.interpreter
                      const influencerData = influencerInsight?.raw_data?.sentiment

                      return (
                        <React.Fragment key={game.id}>
                          <tr className="border-t border-slate-800 hover:bg-slate-800/30">
                            <td className="p-2">
                              <div className="font-medium text-white">
                                {game.away_team.abbreviation} @ {game.home_team.abbreviation}
                              </div>
                              <div className="text-[10px] text-slate-600 font-mono">{game.id.slice(0, 12)}...</div>
                            </td>
                            <td className="p-2 text-slate-400 text-xs">
                              {game.odds?.spread?.line ? `${game.odds.spread.line > 0 ? '+' : ''}${game.odds.spread.line}` : '-'}
                            </td>
                            <td className="p-2 text-slate-400 text-xs">
                              {game.odds?.total?.line || '-'}
                            </td>
                            {/* Pulse */}
                            <td className="p-2">
                              {pulseInsight ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-mono text-purple-400">
                                    {pulseInsight.quantified_value?.points?.toFixed(1)}pts
                                  </span>
                                  <Button
                                    onClick={() => setExpandedInsight(expandedType === 'PULSE' ? null : { gameId: game.id, type: 'PULSE' })}
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-purple-400 hover:text-purple-300"
                                  >
                                    {expandedType === 'PULSE' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => generateInsight(game, 'PULSE_SENTIMENT')}
                                  disabled={generatingGame === game.id}
                                  size="sm"
                                  className="h-5 text-[9px] px-2 bg-purple-600/50 hover:bg-purple-500"
                                >
                                  {generatingGame === game.id ? <Loader2 className="w-2 h-2 animate-spin" /> : 'Gen'}
                                </Button>
                              )}
                            </td>
                            {/* Influencer */}
                            <td className="p-2">
                              {influencerInsight ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-mono text-amber-400">
                                    {influencerInsight.quantified_value?.points?.toFixed(1)}pts
                                  </span>
                                  <Button
                                    onClick={() => setExpandedInsight(expandedType === 'INFLUENCER' ? null : { gameId: game.id, type: 'INFLUENCER' })}
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-amber-400 hover:text-amber-300"
                                  >
                                    {expandedType === 'INFLUENCER' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => generateInsight(game, 'INFLUENCER_SENTIMENT')}
                                  disabled={generatingGame === game.id}
                                  size="sm"
                                  className="h-5 text-[9px] px-2 bg-amber-600/50 hover:bg-amber-500"
                                >
                                  {generatingGame === game.id ? <Loader2 className="w-2 h-2 animate-spin" /> : 'Gen'}
                                </Button>
                              )}
                            </td>
                            {/* Interpreter */}
                            <td className="p-2">
                              {interpreterInsight ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-mono text-emerald-400">
                                    {interpreterInsight.quantified_value?.points?.toFixed(1)}pts
                                  </span>
                                  <Button
                                    onClick={() => setExpandedInsight(expandedType === 'INTERPRETER' ? null : { gameId: game.id, type: 'INTERPRETER' })}
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-emerald-400 hover:text-emerald-300"
                                  >
                                    {expandedType === 'INTERPRETER' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => generateInsight(game, 'INTERPRETER_ANALYSIS')}
                                  disabled={generatingGame === game.id}
                                  size="sm"
                                  className="h-5 text-[9px] px-2 bg-emerald-600/50 hover:bg-emerald-500"
                                >
                                  {generatingGame === game.id ? <Loader2 className="w-2 h-2 animate-spin" /> : 'Gen'}
                                </Button>
                              )}
                            </td>
                            {/* Devils Advocate */}
                            <td className="p-2">
                              {devilsInsight ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-mono text-red-400">
                                    {devilsInsight.quantified_value?.points?.toFixed(1)}pts
                                  </span>
                                  <Button
                                    onClick={() => setExpandedInsight(expandedType === 'DEVILS' ? null : { gameId: game.id, type: 'DEVILS' })}
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-red-400 hover:text-red-300"
                                  >
                                    {expandedType === 'DEVILS' ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </Button>
                                </div>
                              ) : (
                                <Badge className="bg-slate-700/50 text-slate-500 text-[9px]">Needs Pick</Badge>
                              )}
                            </td>
                          </tr>
                          {/* Expanded Detail Row - PULSE */}
                          {expandedType === 'PULSE' && pulseInsight && sentiment && (
                            <tr className="bg-purple-900/20 border-l-2 border-purple-500">
                              <td colSpan={7} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">🌊</span>
                                  <h3 className="text-sm font-bold text-purple-400">The Pulse - Public Sentiment Details</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1">
                                      <Activity className="w-3 h-3" /> Score Breakdown
                                    </h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">Final Points:</span><span className="text-white font-mono">{pulseInsight.quantified_value?.points?.toFixed(3)}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Direction:</span><Badge className={`text-[10px] ${pulseInsight.quantified_value?.direction === 'away' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{pulseInsight.quantified_value?.direction}</Badge></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Team:</span><span className="text-green-400">{pulseInsight.quantified_value?.teamName}</span></div>
                                      <div className="border-t border-slate-700 pt-1 mt-1">
                                        <div className="flex justify-between"><span className="text-slate-500">Sentiment Lean:</span><span className="font-mono">{(pulseInsight.quantified_value?.breakdown?.sentimentLean * 100)?.toFixed(1)}%</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Engagement Lean:</span><span className="font-mono">{(pulseInsight.quantified_value?.breakdown?.engagementLean * 100)?.toFixed(1)}%</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Confidence:</span><span className="font-mono">{pulseInsight.quantified_value?.breakdown?.confidenceMultiplier}</span></div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Sentiment Split</h4>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      <div className="bg-blue-500/10 rounded p-2 text-center">
                                        <div className="text-lg font-bold text-blue-400">{sentiment.awaySentimentPct}%</div>
                                        <div className="text-[10px] text-slate-500">{game.away_team.abbreviation}</div>
                                        <div className="text-[10px] text-slate-600"><ThumbsUp className="w-3 h-3 inline" /> {sentiment.awayTotalLikes}</div>
                                      </div>
                                      <div className="bg-orange-500/10 rounded p-2 text-center">
                                        <div className="text-lg font-bold text-orange-400">{sentiment.homeSentimentPct}%</div>
                                        <div className="text-[10px] text-slate-500">{game.home_team.abbreviation}</div>
                                        <div className="text-[10px] text-slate-600"><ThumbsUp className="w-3 h-3 inline" /> {sentiment.homeTotalLikes}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Sample Posts ({sentiment.samplePosts?.length || 0})</h4>
                                    <div className="space-y-1 max-h-32 overflow-auto">
                                      {sentiment.samplePosts?.slice(0, 3).map((post: any, i: number) => (
                                        <div key={i} className="bg-slate-900/50 rounded p-1.5 text-[10px]">
                                          <Badge className={`text-[8px] ${post.sentiment === 'away' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{post.sentiment}</Badge>
                                          <p className="text-slate-400 line-clamp-2 mt-1">{post.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-600">Generated: {new Date(pulseInsight.created_at).toLocaleString()}</div>
                              </td>
                            </tr>
                          )}

                          {/* Expanded Detail Row - INFLUENCER */}
                          {expandedType === 'INFLUENCER' && influencerInsight && influencerData && (
                            <tr className="bg-amber-900/20 border-l-2 border-amber-500">
                              <td colSpan={7} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">👑</span>
                                  <h3 className="text-sm font-bold text-amber-400">The Influencer - Betting Account Sentiment</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-amber-400 mb-2">Score Breakdown</h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">Final Points:</span><span className="text-white font-mono">{influencerInsight.quantified_value?.points?.toFixed(3)}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Direction:</span><Badge className={`text-[10px] ${influencerInsight.quantified_value?.direction === 'away' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{influencerInsight.quantified_value?.direction}</Badge></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Team:</span><span className="text-green-400">{influencerInsight.quantified_value?.teamName}</span></div>
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-green-400 mb-2">Influencer Split</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-blue-500/10 rounded p-2 text-center">
                                        <div className="text-lg font-bold text-blue-400">{influencerData.awaySentimentPct}%</div>
                                        <div className="text-[10px] text-slate-500">{game.away_team.abbreviation}</div>
                                      </div>
                                      <div className="bg-orange-500/10 rounded p-2 text-center">
                                        <div className="text-lg font-bold text-orange-400">{influencerData.homeSentimentPct}%</div>
                                        <div className="text-[10px] text-slate-500">{game.home_team.abbreviation}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-yellow-400 mb-2">Key Reasons</h4>
                                    <div className="text-[10px] text-slate-400 space-y-1">
                                      {influencerData.awayReasons?.slice(0, 2).map((r: string, i: number) => <div key={i} className="text-blue-400">• {r}</div>)}
                                      {influencerData.homeReasons?.slice(0, 2).map((r: string, i: number) => <div key={i} className="text-orange-400">• {r}</div>)}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-600">Generated: {new Date(influencerInsight.created_at).toLocaleString()}</div>
                              </td>
                            </tr>
                          )}

                          {/* Expanded Detail Row - INTERPRETER */}
                          {expandedType === 'INTERPRETER' && interpreterInsight && interpreterData && (
                            <tr className="bg-emerald-900/20 border-l-2 border-emerald-500">
                              <td colSpan={7} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">🔮</span>
                                  <h3 className="text-sm font-bold text-emerald-400">The Interpreter - Independent Research Analysis</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-emerald-400 mb-2">Score & Pick</h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">Final Points:</span><span className="text-white font-mono">{interpreterInsight.quantified_value?.points?.toFixed(3)}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Pick:</span><Badge className="bg-emerald-500/20 text-emerald-400">{interpreterData.pick}</Badge></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Conviction:</span><span className="font-mono text-emerald-400">{interpreterData.conviction}/10</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Evidence Quality:</span><Badge className="bg-slate-700">{interpreterData.evidenceQuality}</Badge></div>
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-green-400 mb-2">Top Reasons</h4>
                                    <div className="space-y-1 text-[10px] text-slate-400">
                                      {interpreterData.topReasons?.map((r: string, i: number) => <div key={i}>• {r}</div>)}
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-yellow-400 mb-2">Research Summary</h4>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">{interpreterData.summary || interpreterData.rawAnalysis?.slice(0, 300)}...</p>
                                  </div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-600">Generated: {new Date(interpreterInsight.created_at).toLocaleString()}</div>
                              </td>
                            </tr>
                          )}

                          {/* Expanded Detail Row - DEVILS ADVOCATE */}
                          {expandedType === 'DEVILS' && devilsInsight && (
                            <tr className="bg-red-900/20 border-l-2 border-red-500">
                              <td colSpan={7} className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg">😈</span>
                                  <h3 className="text-sm font-bold text-red-400">The Devils Advocate - Contrarian Analysis</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-red-400 mb-2">Risk Assessment</h4>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between"><span className="text-slate-500">Warning Points:</span><span className="text-white font-mono">{devilsInsight.quantified_value?.points?.toFixed(3)}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Risk Score:</span><span className="font-mono text-red-400">{devilsInsight.raw_data?.devilsAdvocate?.riskScore}/10</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Recommendation:</span><Badge className={devilsInsight.raw_data?.devilsAdvocate?.recommendation === 'PROCEED' ? 'bg-green-500/20 text-green-400' : devilsInsight.raw_data?.devilsAdvocate?.recommendation === 'CAUTION' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>{devilsInsight.raw_data?.devilsAdvocate?.recommendation}</Badge></div>
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-yellow-400 mb-2">Contra Evidence</h4>
                                    <div className="space-y-1 text-[10px] text-slate-400">
                                      {devilsInsight.raw_data?.devilsAdvocate?.contraEvidence?.map((r: string, i: number) => <div key={i} className="text-red-300">• {r}</div>)}
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-3">
                                    <h4 className="text-xs font-semibold text-slate-400 mb-2">Analysis</h4>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">{devilsInsight.raw_data?.devilsAdvocate?.rawAnalysis?.slice(0, 300)}...</p>
                                  </div>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-600">Generated: {new Date(devilsInsight.created_at).toLocaleString()}</div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>

              {/* Raw Insights Debug */}
              {storedInsights.length > 0 && (
                <div className="border-t border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs text-slate-500">Raw Stored Insights ({storedInsights.length})</h4>
                  </div>
                  <div className="max-h-48 overflow-auto bg-slate-950 rounded p-2">
                    <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify(storedInsights.map(i => ({
                        id: i.id.slice(0, 8),
                        game: `${i.away_team} @ ${i.home_team}`,
                        type: i.insight_type,
                        points: i.quantified_value?.points?.toFixed(2),
                        direction: i.quantified_value?.direction,
                        created: new Date(i.created_at).toLocaleTimeString()
                      })), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* AI Insights Registry - Catalog of all insight types */}
          <TabsContent value="registry" className="mt-0">
            <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
              <div className="p-3 border-b border-slate-800">
                <h3 className="text-sm font-medium text-white">AI Insights Registry</h3>
                <p className="text-xs text-slate-500">Catalog of all AI insight types available in the system</p>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="p-2 w-10">Status</th>
                    <th className="p-2">Insight Name</th>
                    <th className="p-2">Bet Type</th>
                    <th className="p-2">Provider</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Used By</th>
                  </tr>
                </thead>
                <tbody>
                  {AI_INSIGHTS_REGISTRY.map(insight => (
                    <tr key={insight.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="p-2">
                        {insight.status === 'active' ? (
                          <Badge className="bg-green-500/20 text-green-400 text-[10px]">✓</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">○</Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-white">{insight.name}</div>
                        <div className="text-[10px] text-slate-600 font-mono">{insight.id}</div>
                      </td>
                      <td className="p-2">
                        <Badge className={`text-[10px] ${insight.betType === 'GLOBAL' ? 'bg-cyan-500/20 text-cyan-400' :
                          insight.betType === 'SPREAD' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                          {insight.betType}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge className={`text-[10px] ${insight.provider === 'GROK' ? 'bg-purple-500/20 text-purple-400' :
                          insight.provider === 'OPENAI' ? 'bg-green-500/20 text-green-400' :
                            insight.provider === 'PERPLEXITY' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-slate-500/20 text-slate-400'
                          }`}>
                          {insight.provider}
                        </Badge>
                        <div className="text-[10px] text-slate-600 mt-0.5">{insight.providerModel}</div>
                      </td>
                      <td className="p-2 text-slate-400 text-xs">{insight.category}</td>
                      <td className="p-2 text-slate-500 text-xs max-w-xs">
                        <div className="line-clamp-2">{insight.description}</div>
                        <div className="text-[10px] text-slate-600 mt-1">Output: {insight.outputFormat}</div>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {insight.usedByArchetypes.map((arch, i) => (
                            <Badge key={i} className="bg-slate-700 text-slate-300 text-[9px]">{arch}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="p-3 border-t border-slate-800 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
                <div className="flex items-center gap-1">
                  <Badge className="bg-green-500/20 text-green-400 text-[9px]">✓</Badge>
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px]">○</Badge>
                  <span>Planned</span>
                </div>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Bet Type:</span>
                <Badge className="bg-cyan-500/20 text-cyan-400 text-[9px]">GLOBAL</Badge>
                <Badge className="bg-orange-500/20 text-orange-400 text-[9px]">SPREAD</Badge>
                <Badge className="bg-blue-500/20 text-blue-400 text-[9px]">TOTAL</Badge>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Provider:</span>
                <Badge className="bg-purple-500/20 text-purple-400 text-[9px]">GROK</Badge>
                <Badge className="bg-green-500/20 text-green-400 text-[9px]">OPENAI</Badge>
                <Badge className="bg-blue-500/20 text-blue-400 text-[9px]">PERPLEXITY</Badge>
                <Badge className="bg-slate-500/20 text-slate-400 text-[9px]">SYSTEM</Badge>
              </div>
            </div>
          </TabsContent>

          {/* AI Archetypes - The Pulse, Influencer, Interpreter, Devil's Advocate */}
          <TabsContent value="ai-archetypes" className="mt-0">
            {/* Shared Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded p-3 mb-4">
              <div className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-4">
                  <label className="text-xs text-slate-500 block mb-1">Select Game</label>
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
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Bet Type</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setBetType('SPREAD')}
                      className={`flex-1 px-2 py-1.5 text-xs rounded ${betType === 'SPREAD' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      SPREAD
                    </button>
                    <button
                      onClick={() => setBetType('TOTAL')}
                      className={`flex-1 px-2 py-1.5 text-xs rounded ${betType === 'TOTAL' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      TOTAL
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Min Followers (Influencer)</label>
                  <select
                    value={minFollowers}
                    onChange={(e) => setMinFollowers(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm"
                  >
                    <option value={5000}>5K+</option>
                    <option value={10000}>10K+</option>
                    <option value={25000}>25K+</option>
                    <option value={50000}>50K+</option>
                    <option value={100000}>100K+</option>
                  </select>
                </div>
                {selectedGameData && (
                  <div className="col-span-4 text-xs bg-slate-800/50 rounded p-2 flex gap-4">
                    <span><span className="text-slate-500">Away:</span> {selectedGameData.away_team.abbreviation}</span>
                    <span><span className="text-slate-500">Home:</span> {selectedGameData.home_team.abbreviation}</span>
                    <span><span className="text-slate-500">Spread:</span> {selectedGameData.odds?.spread?.line || 'N/A'}</span>
                    <span><span className="text-slate-500">Total:</span> {selectedGameData.odds?.total?.line || 'N/A'}</span>
                  </div>
                )}
              </div>
            </div >

            {/* Two Columns: The Pulse vs The Influencer */}
            < div className="grid grid-cols-2 gap-4" >
              {/* THE PULSE */}
              < div className="space-y-3" >
                <div className="bg-slate-900 border border-purple-500/30 rounded overflow-hidden">
                  <div className="p-3 border-b border-slate-800 bg-purple-500/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-purple-400">🌊 THE PULSE</h3>
                      <p className="text-[10px] text-slate-500">General public sentiment (all X users)</p>
                    </div>
                    <Button
                      onClick={runGrokTest}
                      disabled={grokLoading || !selectedGame}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-500 h-7 text-xs"
                    >
                      {grokLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                      Run Test
                    </Button>
                  </div>

                  <div className="p-3">
                    {grokResult?.pulseScore ? (
                      <div className="space-y-3">
                        {/* Score Card */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-2xl font-bold text-purple-400">{grokResult.pulseScore.points.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500">Points</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-lg font-bold text-white">{grokResult.pulseScore.teamName}</div>
                            <div className="text-[10px] text-slate-500">Direction</div>
                          </div>
                        </div>

                        {/* Lean Breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Sentiment Lean:</span>
                            <span className="float-right font-mono text-purple-300">{(grokResult.pulseScore.breakdown.sentimentLean * 100).toFixed(1)}%</span>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Engagement Lean:</span>
                            <span className="float-right font-mono text-purple-300">{(grokResult.pulseScore.breakdown.engagementLean * 100).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Sample Posts */}
                        {grokResult.sentiment?.samplePosts && (
                          <div className="text-xs">
                            <div className="text-slate-500 mb-1">Sample Posts:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {grokResult.sentiment.samplePosts.slice(0, 3).map((post: any, i: number) => (
                                <div key={i} className="bg-slate-800/30 rounded p-1.5 text-[10px]">
                                  <span className="text-slate-400">{post.text?.substring(0, 80)}...</span>
                                  <span className="text-purple-400 ml-1">({post.likes} ❤️)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Click "Run Test" to analyze public sentiment</p>
                      </div>
                    )}
                  </div>

                  {/* Formula */}
                  <div className="p-2 border-t border-slate-800 bg-slate-800/30">
                    <div className="text-[9px] text-slate-600 font-mono">
                      {"rawLean = (sent*0.6) + (eng*0.4) -> points = sqrt|lean| * 5"}
                    </div>
                  </div>
                </div>
              </div >

              {/* THE INFLUENCER */}
              < div className="space-y-3" >
                <div className="bg-slate-900 border border-amber-500/30 rounded overflow-hidden">
                  <div className="p-3 border-b border-slate-800 bg-amber-500/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-amber-400">👑 THE INFLUENCER</h3>
                      <p className="text-[10px] text-slate-500">Betting influencer sentiment ({minFollowers.toLocaleString()}+ followers)</p>
                    </div>
                    <Button
                      onClick={runInfluencerTest}
                      disabled={influencerLoading || !selectedGame}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-500 h-7 text-xs"
                    >
                      {influencerLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                      Run Test
                    </Button>
                  </div>

                  <div className="p-3">
                    {influencerResult?.influencerScore ? (
                      <div className="space-y-3">
                        {/* Score Card */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-2xl font-bold text-amber-400">{influencerResult.influencerScore.points.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500">Points</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-lg font-bold text-white">{influencerResult.influencerScore.teamName}</div>
                            <div className="text-[10px] text-slate-500">Direction</div>
                          </div>
                        </div>

                        {/* Influencer Stats */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Accounts Analyzed:</span>
                            <span className="float-right font-mono text-amber-300">{influencerResult.influencerScore.breakdown.accountsAnalyzed}</span>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Avg Followers:</span>
                            <span className="float-right font-mono text-amber-300">{(influencerResult.influencerScore.breakdown.avgFollowerCount / 1000).toFixed(0)}K</span>
                          </div>
                        </div>

                        {/* Lean Breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Influencer Sent. Lean:</span>
                            <span className="float-right font-mono text-amber-300">{(influencerResult.influencerScore.breakdown.influencerSentimentLean * 100).toFixed(1)}%</span>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Influencer Eng. Lean:</span>
                            <span className="float-right font-mono text-amber-300">{(influencerResult.influencerScore.breakdown.influencerEngagementLean * 100).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Sample Posts with Followers */}
                        {influencerResult.sentiment?.samplePosts && (
                          <div className="text-xs">
                            <div className="text-slate-500 mb-1">Influencer Posts:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {influencerResult.sentiment.samplePosts.slice(0, 3).map((post: any, i: number) => (
                                <div key={i} className="bg-slate-800/30 rounded p-1.5 text-[10px]">
                                  <span className="text-slate-400">{post.text?.substring(0, 80)}...</span>
                                  <div className="flex gap-2 mt-0.5">
                                    <span className="text-amber-400">👤 {((post.followers || 0) / 1000).toFixed(0)}K</span>
                                    <span className="text-purple-400">❤️ {post.likes}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : influencerResult?.error ? (
                      <div className="text-center py-6 text-red-400">
                        <p className="text-xs">{influencerResult.error}</p>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Click "Run Test" to analyze influencer sentiment</p>
                      </div>
                    )}
                  </div>

                  {/* Formula */}
                  <div className="p-2 border-t border-slate-800 bg-slate-800/30">
                    <div className="text-[9px] text-slate-600 font-mono">
                      {"rawLean = (sent*0.7) + (eng*0.3) -> weighted by follower count"}
                    </div>
                  </div>
                </div>
              </div >
            </div >

            {/* Row 2: The Interpreter & The Devil's Advocate */}
            < div className="grid grid-cols-2 gap-4 mt-4" >
              {/* THE INTERPRETER */}
              < div className="space-y-3" >
                <div className="bg-slate-900 border border-emerald-500/30 rounded overflow-hidden">
                  <div className="p-3 border-b border-slate-800 bg-emerald-500/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400">🔮 THE INTERPRETER</h3>
                      <p className="text-[10px] text-slate-500">Independent research-based analysis</p>
                    </div>
                    <Button
                      onClick={runInterpreterTest}
                      disabled={interpreterLoading || !selectedGame}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 h-7 text-xs"
                    >
                      {interpreterLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                      Run Test
                    </Button>
                  </div>

                  <div className="p-3">
                    {interpreterResult?.interpreterScore ? (
                      <div className="space-y-3">
                        {/* Score Card */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-2xl font-bold text-emerald-400">{interpreterResult.interpreterScore.points.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500">Points (0-5)</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className="text-lg font-bold text-white">{interpreterResult.interpreterScore.teamName}</div>
                            <div className="text-[10px] text-slate-500">Pick</div>
                          </div>
                        </div>

                        {/* Conviction & Evidence */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Conviction:</span>
                            <span className="float-right font-mono text-emerald-300">{interpreterResult.interpreterScore.breakdown.conviction}/10</span>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Evidence Quality:</span>
                            <span className="float-right font-mono text-emerald-300">{(interpreterResult.interpreterScore.breakdown.evidenceQuality * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        {/* Top Reasons */}
                        {interpreterResult.analysis?.topReasons && (
                          <div className="text-xs">
                            <div className="text-slate-500 mb-1">Research Findings:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {interpreterResult.analysis.topReasons.slice(0, 3).map((reason: string, i: number) => (
                                <div key={i} className="bg-slate-800/30 rounded p-1.5 text-[10px] text-slate-400">
                                  • {reason}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : interpreterResult?.error ? (
                      <div className="text-center py-6 text-red-400">
                        <p className="text-xs">{interpreterResult.error}</p>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Click "Run Test" for independent analysis</p>
                      </div>
                    )}
                  </div>

                  {/* Formula */}
                  <div className="p-2 border-t border-slate-800 bg-slate-800/30">
                    <div className="text-[9px] text-slate-600 font-mono">
                      {"points = (conviction/10) * 5 * evidenceMultiplier"}
                    </div>
                  </div>
                </div>
              </div >

              {/* THE DEVIL'S ADVOCATE */}
              < div className="space-y-3" >
                <div className="bg-slate-900 border border-red-500/30 rounded overflow-hidden">
                  <div className="p-3 border-b border-slate-800 bg-red-500/10">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-red-400">😈 THE DEVIL&apos;S ADVOCATE</h3>
                        <p className="text-[10px] text-slate-500">Find holes in your pick</p>
                      </div>
                      <Button
                        onClick={runDevilsAdvocateTest}
                        disabled={devilsLoading || !selectedGame || !ourPick}
                        size="sm"
                        className="bg-red-600 hover:bg-red-500 h-7 text-xs"
                      >
                        {devilsLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                        Run Test
                      </Button>
                    </div>
                    {/* Pick Input */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Our Pick (e.g., Lakers or OVER)"
                        value={ourPick}
                        onChange={(e) => setOurPick(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Conf %"
                        value={ourConfidence}
                        onChange={(e) => setOurConfidence(Number(e.target.value))}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3">
                    {devilsResult?.devilsScore ? (
                      <div className="space-y-3">
                        {/* Risk Card */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className={`text-2xl font-bold ${devilsResult.devilsScore.points >= 3 ? 'text-red-400' : devilsResult.devilsScore.points >= 1.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                              {devilsResult.devilsScore.points.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500">Warning Points</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2 text-center">
                            <div className={`text-lg font-bold ${devilsResult.analysis?.recommendation === 'ABORT' ? 'text-red-400' : devilsResult.analysis?.recommendation === 'CAUTION' ? 'text-yellow-400' : 'text-green-400'}`}>
                              {devilsResult.analysis?.recommendation}
                            </div>
                            <div className="text-[10px] text-slate-500">Recommendation</div>
                          </div>
                        </div>

                        {/* Risk Score */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Risk Score:</span>
                            <span className="float-right font-mono text-red-300">{devilsResult.devilsScore.breakdown.riskScore}/10</span>
                          </div>
                          <div className="bg-slate-800/50 rounded p-2">
                            <span className="text-slate-500">Evidence Found:</span>
                            <span className="float-right font-mono text-red-300">{devilsResult.devilsScore.breakdown.evidenceCount} items</span>
                          </div>
                        </div>

                        {/* Contra Evidence */}
                        {devilsResult.analysis?.contraEvidence && (
                          <div className="text-xs">
                            <div className="text-slate-500 mb-1">Contra Evidence:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {devilsResult.analysis.contraEvidence.slice(0, 3).map((ev: string, i: number) => (
                                <div key={i} className="bg-red-900/20 rounded p-1.5 text-[10px] text-red-300">
                                  ⚠️ {ev}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : devilsResult?.error ? (
                      <div className="text-center py-6 text-red-400">
                        <p className="text-xs">{devilsResult.error}</p>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Enter your pick and click "Run Test"</p>
                      </div>
                    )}
                  </div>

                  {/* Formula */}
                  <div className="p-2 border-t border-slate-800 bg-slate-800/30">
                    <div className="text-[9px] text-slate-600 font-mono">
                      {"warningPoints = (riskScore/10) * 5 * severityMultiplier"}
                    </div>
                  </div>
                </div>
              </div >
            </div >
          </TabsContent >

        </Tabs>
      </div >
    </div>
  )
}
