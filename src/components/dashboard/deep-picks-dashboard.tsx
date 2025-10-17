'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle, 
  PlayCircle,
  Filter,
  Copy,
  Lightbulb,
  AlertTriangle,
  Zap,
  BarChart3,
  Rocket,
  MessageSquare
} from 'lucide-react'

// Mock data for the profit graph
const graphData = [
  { date: '2025-01-01', profit: 0 },
  { date: '2025-02-01', profit: 500 },
  { date: '2025-03-01', profit: 1500 },
  { date: '2025-04-01', profit: 2800 },
  { date: '2025-05-01', profit: 3200 },
  { date: '2025-06-01', profit: 4100 },
  { date: '2025-07-01', profit: 3800 },
  { date: '2025-08-01', profit: 5200 },
  { date: '2025-09-01', profit: 4800 },
  { date: '2025-10-01', profit: 6400 },
  { date: '2025-11-01', profit: 7200 },
  { date: '2025-12-01', profit: 6427.26 },
]

// Mock data for picks
const picksData = [
  {
    id: 1,
    pick: "Chiefs -3.5 vs Broncos",
    timestamp: "2025-10-17 13:45",
    units: 2.5,
    sportsbook: "DraftKings",
    status: "Complete",
    outcome: "+2.25u",
    insight: "Strong 2H rebound — defense sealed the cover",
    insightIcon: "lightbulb"
  },
  {
    id: 2,
    pick: "Lakers ML vs Warriors",
    timestamp: "2025-10-17 14:10",
    units: 3,
    sportsbook: "DraftKings",
    status: "Complete",
    outcome: "-3.00u",
    insight: "LeBron sat late — rebounding issues hurt",
    insightIcon: "warning"
  },
  {
    id: 3,
    pick: "Cowboys +2.5 @ Eagles",
    timestamp: "2025-10-16 21:30",
    units: 1.5,
    sportsbook: "DraftKings",
    status: "Complete",
    outcome: "+1.35u",
    insight: "Clutch 4Q stop — Micah Parsons MVP-level",
    insightIcon: "strong"
  },
  {
    id: 4,
    pick: "Yankees / Red Sox O9.5",
    timestamp: "2025-10-15 19:05",
    units: 2,
    sportsbook: "DraftKings",
    status: "Complete",
    outcome: "+1.80u",
    insight: "Both starters shelled early, over hit by 6th",
    insightIcon: "fire"
  },
  {
    id: 5,
    pick: "Dolphins TT O27.5",
    timestamp: "2025-10-14 12:00",
    units: 1,
    sportsbook: "DraftKings",
    status: "Complete",
    outcome: "-1.00u",
    insight: "Tua injury slowed tempo — missed by 3 pts",
    insightIcon: "thought"
  },
  {
    id: 6,
    pick: "Patrick Mahomes O2.5 TDs",
    timestamp: "2025-10-17 15:20",
    units: 2,
    sportsbook: "DraftKings Pick 6",
    status: "In Progress",
    outcome: "TBD",
    insight: "Facing weak pass D — projected 3.1 TDs",
    insightIcon: "data"
  },
  {
    id: 7,
    pick: "LeBron James O7.5 Rebounds",
    timestamp: "2025-10-17 15:22",
    units: 1.5,
    sportsbook: "DraftKings Pick 6",
    status: "In Progress",
    outcome: "TBD",
    insight: "Expected pace-up game — strong rebound spot",
    insightIcon: "trend"
  },
  {
    id: 8,
    pick: "Tyreek Hill Anytime TD",
    timestamp: "2025-10-17 15:30",
    units: 2,
    sportsbook: "DraftKings Pick 6",
    status: "Not Started",
    outcome: "TBD",
    insight: "Facing bottom-tier coverage — likely explosive",
    insightIcon: "rocket"
  }
]

// League data
const leagueData = [
  { name: "NCAAM", record: "48-68-3", profit: 4215.75 },
  { name: "Mixed", record: "567-876-64", profit: 4092.65 },
  { name: "MLB", record: "25-32-7", profit: 1633.02 }
]

const getInsightIcon = (iconType: string) => {
  const iconMap = {
    lightbulb: <Lightbulb className="h-4 w-4 text-blue-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    strong: <Zap className="h-4 w-4 text-green-400" />,
    fire: <TrendingUp className="h-4 w-4 text-red-400" />,
    thought: <MessageSquare className="h-4 w-4 text-gray-400" />,
    data: <BarChart3 className="h-4 w-4 text-purple-400" />,
    trend: <TrendingUp className="h-4 w-4 text-blue-400" />,
    rocket: <Rocket className="h-4 w-4 text-orange-400" />
  }
  return iconMap[iconType as keyof typeof iconMap] || <Lightbulb className="h-4 w-4 text-blue-400" />
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "Complete":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "In Progress":
      return <Clock className="h-4 w-4 text-yellow-500" />
    case "Not Started":
      return <PlayCircle className="h-4 w-4 text-gray-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

const getOutcomeColor = (outcome: string) => {
  if (outcome.startsWith('+')) return 'text-green-400'
  if (outcome.startsWith('-')) return 'text-red-400'
  return 'text-gray-400'
}

export function DeepPicksDashboard() {
  const [timeFilter, setTimeFilter] = useState('all')
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(['NCAAM', 'Mixed', 'MLB'])

  // Calculate totals
  const totalProfit = 6427.26
  const totalRecord = "887-1443-96"
  const roi = 5.55

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">DEEP PICKS</h1>
          <p className="text-gray-300">Data-driven sports predictions with transparent tracking</p>
        </div>

        {/* Profit & Record Summary */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl text-white">Current Record</CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <Tabs value={timeFilter} onValueChange={setTimeFilter}>
                  <TabsList className="bg-slate-700">
                    <TabsTrigger value="week" className="text-gray-300">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-gray-300">Month</TabsTrigger>
                    <TabsTrigger value="year" className="text-gray-300">Year</TabsTrigger>
                    <TabsTrigger value="all" className="text-gray-300">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Profit Display */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-4xl font-bold text-white">${totalProfit.toLocaleString()}</div>
                    <div className="text-green-400 text-lg">+{roi}% ROI</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{totalRecord}</div>
                    <div className="text-gray-400">W-L-P</div>
                  </div>
                </div>
                
                {/* Profit Graph */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graphData}>
                      <defs>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9ca3af"
                        fontSize={12}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        fontSize={12}
                        tickFormatter={(value) => `$${(value/1000).toFixed(1)}K`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#f9fafb'
                        }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Profit']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#profitGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Leagues */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Leagues</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Today</span>
                    <Button variant="ghost" size="sm" className="text-gray-400">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {leagueData.map((league) => (
                    <div key={league.name} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{league.name}</div>
                        <div className="text-sm text-gray-400">{league.record}</div>
                      </div>
                      <div className="text-green-400 font-semibold">
                        +${league.profit.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full text-gray-400 hover:text-white">
                    Show More
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Picks Table */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl text-white">Current Top Picks</CardTitle>
              <Button variant="ghost" size="sm" className="text-gray-400">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Pick</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Posted Timestamp</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Units Risked</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">SportsBook Used</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Outcome</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Insight</th>
                  </tr>
                </thead>
                <tbody>
                  {picksData.map((pick) => (
                    <tr key={pick.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{pick.pick}</div>
                      </td>
                      <td className="py-4 px-4 text-gray-300">{pick.timestamp}</td>
                      <td className="py-4 px-4 text-white">{pick.units}</td>
                      <td className="py-4 px-4 text-gray-300">{pick.sportsbook}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(pick.status)}
                          <span className="text-gray-300">{pick.status}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-semibold ${getOutcomeColor(pick.outcome)}`}>
                          {pick.outcome}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getInsightIcon(pick.insightIcon)}
                          <span className="text-gray-300 text-sm">{pick.insight}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
