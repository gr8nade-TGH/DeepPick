'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Gauge,
  Target,
  Shield,
  RotateCcw,
  Activity,
  Home,
  Plane,
  Trophy,
  Calculator,
  Info,
  ChevronRight,
  Sparkles,
  Database,
  Zap
} from 'lucide-react'

// Data source types
type DataSource = 'already_fetched' | 'team_gamelogs' | 'standings' | 'boxscore' | 'calculated' | 'schedule'

// Type definition for stats
interface StatDefinition {
  key: string
  name: string
  description: string
  unit: string
  currentlyUsed: boolean
  usedIn?: string[]
  dataSource: DataSource
  apiPath?: string // MySportsFeeds endpoint if needed
}

interface StatCategory {
  category: string
  icon: any
  color: string
  stats: StatDefinition[]
}

// Data source info for display
const DATA_SOURCE_INFO: Record<DataSource, { label: string; color: string; icon: any }> = {
  already_fetched: { label: 'Ready', color: 'green', icon: Zap },
  team_gamelogs: { label: 'Team Gamelogs', color: 'blue', icon: Database },
  standings: { label: 'Standings Feed', color: 'purple', icon: Trophy },
  boxscore: { label: 'Box Score', color: 'orange', icon: Target },
  calculated: { label: 'Calculated', color: 'cyan', icon: Calculator },
  schedule: { label: 'Schedule', color: 'yellow', icon: Plane },
}

// All available stats from MySportsFeeds that we can turn into factors
// VERIFIED against MySportsFeeds API documentation (2024-12-01)
export const AVAILABLE_STATS: Record<string, StatCategory> = {
  pace: {
    category: 'Pace & Tempo',
    icon: Gauge,
    color: 'cyan',
    stats: [
      { key: 'pace', name: 'Pace', description: 'Possessions per game (FGA + 0.44*FTA - OREB + TOV)', unit: 'poss/game', currentlyUsed: true, usedIn: ['paceIndex'], dataSource: 'already_fetched' },
      { key: 'paceDelta', name: 'Pace vs League', description: 'Team pace minus league average pace', unit: 'delta', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from team_gamelogs' },
      { key: 'paceVariance', name: 'Pace Variance', description: 'Standard deviation of pace over last 10 games', unit: 'stdev', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from team_gamelogs' },
    ]
  },
  offense: {
    category: 'Offense',
    icon: Target,
    color: 'green',
    stats: [
      { key: 'ortg', name: 'Offensive Rating', description: 'Points per 100 possessions', unit: 'pts/100', currentlyUsed: true, usedIn: ['offForm', 'netRatingDiff'], dataSource: 'already_fetched' },
      { key: 'ppg', name: 'Points Per Game', description: 'Average points scored per game', unit: 'pts', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.offense.pts' },
      { key: 'fgPct', name: 'Field Goal %', description: 'Field goal percentage', unit: '%', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.fieldGoals.fgPct' },
      { key: 'fgMade', name: 'Field Goals Made', description: 'Field goals made per game', unit: 'fgm', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.fieldGoals.fgMade' },
      { key: 'avgEfg', name: 'Effective FG%', description: 'eFG% = (FGM + 0.5*3PM) / FGA', unit: '%', currentlyUsed: true, usedIn: ['fourFactorsDiff'], dataSource: 'already_fetched' },
      { key: 'threeP_pct', name: '3-Point %', description: '3-point field goal percentage', unit: '%', currentlyUsed: true, usedIn: ['threeEnv'], dataSource: 'already_fetched' },
      { key: 'threeP_rate', name: '3-Point Rate (3PAR)', description: '3-point attempts as % of total FGA', unit: '%', currentlyUsed: true, usedIn: ['threeEnv'], dataSource: 'already_fetched' },
      { key: 'fg3PtMade', name: '3-Pointers Made', description: '3-pointers made per game', unit: '3pm', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.fieldGoals.fg3PtMade' },
      { key: 'ft_rate', name: 'Free Throw Rate', description: 'FTA per FGA', unit: 'ratio', currentlyUsed: true, usedIn: ['whistleEnv'], dataSource: 'already_fetched' },
      { key: 'ftPct', name: 'Free Throw %', description: 'Free throw percentage', unit: '%', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.freeThrows.ftPct' },
      { key: 'ftMade', name: 'Free Throws Made', description: 'Free throws made per game', unit: 'ftm', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.freeThrows.ftMade' },
      { key: 'assists', name: 'Assists Per Game', description: 'Average assists per game', unit: 'ast', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.offense.ast' },
      { key: 'astTovRatio', name: 'AST/TOV Ratio', description: 'Assists per turnover', unit: 'ratio', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from ast/tov' },
    ]
  },
  defense: {
    category: 'Defense',
    icon: Shield,
    color: 'red',
    stats: [
      { key: 'drtg', name: 'Defensive Rating', description: 'Opponent points per 100 possessions', unit: 'pts/100', currentlyUsed: true, usedIn: ['defErosion', 'netRatingDiff'], dataSource: 'already_fetched' },
      { key: 'oppPpg', name: 'Opp Points Per Game', description: 'Average points allowed per game', unit: 'pts', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.ptsAgainst' },
      { key: 'steals', name: 'Steals Per Game', description: 'Average steals per game', unit: 'stl', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.stl' },
      { key: 'blocks', name: 'Blocks Per Game', description: 'Average blocks per game', unit: 'blk', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.blk' },
      { key: 'blkAgainst', name: 'Blocks Against', description: 'Shots blocked by opponent per game', unit: 'blk', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.blkAgainst' },
      { key: 'stlAgainst', name: 'Steals Against', description: 'Steals by opponent per game', unit: 'stl', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.stlAgainst' },
      { key: 'oppFgPct', name: 'Opp FG%', description: 'Opponent field goal percentage allowed', unit: '%', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.fgPctAgainst' },
      { key: 'oppThreePct', name: 'Opp 3P%', description: 'Opponent 3-point percentage allowed', unit: '%', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.fg3PtPctAgainst' },
    ]
  },
  ballControl: {
    category: 'Ball Control',
    icon: RotateCcw,
    color: 'yellow',
    stats: [
      { key: 'avgTurnovers', name: 'Turnovers Per Game', description: 'Average turnovers committed', unit: 'tov', currentlyUsed: true, usedIn: ['turnoverDiff'], dataSource: 'already_fetched' },
      { key: 'avgTovPct', name: 'Turnover %', description: 'Turnovers per 100 possessions', unit: '%', currentlyUsed: true, usedIn: ['fourFactorsDiff'], dataSource: 'already_fetched' },
      { key: 'oppTov', name: 'Opp Turnovers', description: 'Turnovers forced per game', unit: 'tov', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.tovAgainst' },
      { key: 'tovDiff', name: 'Turnover Differential', description: 'Turnovers forced minus committed', unit: 'diff', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from tovAgainst - tov' },
    ]
  },
  rebounding: {
    category: 'Rebounding',
    icon: Activity,
    color: 'purple',
    stats: [
      { key: 'avgOffReb', name: 'Offensive Rebounds', description: 'Offensive rebounds per game', unit: 'oreb', currentlyUsed: true, usedIn: ['fourFactorsDiff'], dataSource: 'already_fetched' },
      { key: 'avgDefReb', name: 'Defensive Rebounds', description: 'Defensive rebounds per game', unit: 'dreb', currentlyUsed: true, dataSource: 'already_fetched' },
      { key: 'totalReb', name: 'Total Rebounds', description: 'Total rebounds per game', unit: 'reb', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.rebounds.reb' },
      { key: 'avgOrebPct', name: 'OREB%', description: 'Offensive rebound percentage', unit: '%', currentlyUsed: true, usedIn: ['fourFactorsDiff'], dataSource: 'already_fetched' },
      { key: 'oppTotalReb', name: 'Opp Total Rebounds', description: 'Opponent rebounds per game', unit: 'reb', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.defense.rebAgainst' },
      { key: 'rebDiff', name: 'Rebound Differential', description: 'Total rebounds minus opponent rebounds', unit: 'diff', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from reb - rebAgainst' },
    ]
  },
  splits: {
    category: 'Home/Away Splits',
    icon: Home,
    color: 'blue',
    stats: [
      { key: 'ortgHome', name: 'Home ORtg', description: 'Offensive rating in home games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'], dataSource: 'already_fetched' },
      { key: 'ortgAway', name: 'Away ORtg', description: 'Offensive rating in away games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'], dataSource: 'already_fetched' },
      { key: 'drtgHome', name: 'Home DRtg', description: 'Defensive rating in home games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'], dataSource: 'already_fetched' },
      { key: 'drtgAway', name: 'Away DRtg', description: 'Defensive rating in away games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'], dataSource: 'already_fetched' },
      { key: 'homeWinPct', name: 'Home Win %', description: 'Win percentage at home', unit: '%', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → homeWins/homeLosses' },
      { key: 'awayWinPct', name: 'Away Win %', description: 'Win percentage on the road', unit: '%', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → awayWins/awayLosses' },
    ]
  },
  standings: {
    category: 'Standings & Records',
    icon: Trophy,
    color: 'amber',
    stats: [
      { key: 'winPct', name: 'Win Percentage', description: 'Overall win percentage', unit: '%', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → winPct' },
      { key: 'confRank', name: 'Conference Rank', description: 'Team rank in conference', unit: 'rank', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → conferenceRank' },
      { key: 'divRank', name: 'Division Rank', description: 'Team rank in division', unit: 'rank', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → divisionRank' },
      { key: 'streak', name: 'Current Streak', description: 'Current win/loss streak', unit: 'games', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → streak' },
      { key: 'last10', name: 'Last 10 Record', description: 'Wins in last 10 games', unit: 'wins', currentlyUsed: false, dataSource: 'standings', apiPath: 'standings.json → lastTen' },
      { key: 'netRtg', name: 'Net Rating', description: 'ORtg minus DRtg (team quality)', unit: 'pts/100', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from ortg - drtg' },
    ]
  },
  situational: {
    category: 'Situational',
    icon: Plane,
    color: 'orange',
    stats: [
      { key: 'restDays', name: 'Rest Days', description: 'Days since last game', unit: 'days', currentlyUsed: false, dataSource: 'schedule', apiPath: 'Calculated from games.json dates' },
      { key: 'b2bGame', name: 'Back-to-Back', description: 'Is this game a back-to-back?', unit: 'bool', currentlyUsed: false, dataSource: 'schedule', apiPath: 'Calculated from games.json dates' },
      { key: 'b2bWinPct', name: 'B2B Win %', description: 'Win % in back-to-back games', unit: '%', currentlyUsed: false, dataSource: 'calculated', apiPath: 'Calculated from team_gamelogs' },
      { key: 'q4Scoring', name: '4th Quarter Scoring', description: 'Average 4th quarter points', unit: 'pts', currentlyUsed: false, dataSource: 'boxscore', apiPath: 'game_boxscore → quarterSummary.Q4' },
      { key: 'q4Diff', name: '4th Quarter Diff', description: 'Average 4th quarter point differential', unit: 'diff', currentlyUsed: false, dataSource: 'boxscore', apiPath: 'Calculated from game_boxscore' },
    ]
  },
  misc: {
    category: 'Miscellaneous',
    icon: Activity,
    color: 'slate',
    stats: [
      { key: 'fouls', name: 'Personal Fouls', description: 'Personal fouls per game', unit: 'pf', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.miscellaneous.fouls' },
      { key: 'plusMinus', name: 'Plus/Minus', description: 'Average plus/minus per game', unit: '+/-', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.miscellaneous.plusMinus' },
      { key: 'minPlayed', name: 'Minutes Distribution', description: 'Starter vs bench minutes', unit: 'min', currentlyUsed: false, dataSource: 'team_gamelogs', apiPath: 'stats.miscellaneous.minSeconds' },
    ]
  }
}

// Count stats
const totalStats = Object.values(AVAILABLE_STATS).reduce((sum, cat) => sum + cat.stats.length, 0)
const usedStats = Object.values(AVAILABLE_STATS).reduce((sum, cat) => sum + cat.stats.filter(s => s.currentlyUsed).length, 0)

interface StatBrowserProps {
  open: boolean
  onClose: () => void
  onSelectStat?: (stat: StatDefinition, category: string) => void
}

export function StatBrowser({ open, onClose, onSelectStat }: StatBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('pace')
  const [showOnlyUnused, setShowOnlyUnused] = useState(false)

  const categories = Object.entries(AVAILABLE_STATS)
  const currentCategory = AVAILABLE_STATS[selectedCategory as keyof typeof AVAILABLE_STATS]
  const filteredStats = showOnlyUnused
    ? currentCategory.stats.filter(s => !s.currentlyUsed)
    : currentCategory.stats

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            MySportsFeeds Stat Browser
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span>Browse all available stats that can be used to create new factors</span>
            <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
              {usedStats}/{totalStats} stats in use
            </Badge>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex gap-4 overflow-hidden mt-4">
          {/* Category Sidebar */}
          <div className="w-56 flex-shrink-0 space-y-1">
            {categories.map(([key, cat]) => {
              const Icon = cat.icon
              const unusedCount = cat.stats.filter(s => !s.currentlyUsed).length
              const isActive = selectedCategory === key
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${isActive
                    ? `bg-${cat.color}-500/20 border border-${cat.color}-500/50 text-${cat.color}-400`
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 font-medium text-sm">{cat.category}</span>
                  {unusedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      +{unusedCount}
                    </Badge>
                  )}
                </button>
              )
            })}

            {/* Filter toggle */}
            <div className="pt-4 border-t border-slate-700 mt-4">
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={showOnlyUnused}
                  onChange={(e) => setShowOnlyUnused(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800"
                />
                Show only unused stats
              </label>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid gap-3">
              {filteredStats.map((stat) => {
                const sourceInfo = DATA_SOURCE_INFO[stat.dataSource]
                const SourceIcon = sourceInfo.icon
                return (
                  <div
                    key={stat.key}
                    className={`p-4 rounded-xl border transition-all ${stat.currentlyUsed
                      ? 'bg-slate-800/50 border-slate-700'
                      : 'bg-slate-800/80 border-slate-600 hover:border-cyan-500/50 cursor-pointer hover:shadow-lg hover:shadow-cyan-500/10'
                      }`}
                    onClick={() => !stat.currentlyUsed && onSelectStat?.(stat, selectedCategory)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{stat.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">
                            {stat.unit}
                          </Badge>
                          {stat.currentlyUsed && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-[10px]">
                              IN USE
                            </Badge>
                          )}
                          {/* Data Source Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 flex items-center gap-1 ${stat.dataSource === 'already_fetched'
                                ? 'text-green-400 border-green-500/30 bg-green-500/10'
                                : stat.dataSource === 'calculated'
                                  ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                                  : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                              }`}
                          >
                            <SourceIcon className="w-3 h-3" />
                            {sourceInfo.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{stat.description}</p>

                        {/* API Path / Source Info */}
                        {stat.apiPath && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Database className="w-3 h-3 text-slate-500" />
                            <code className="text-[10px] text-slate-500 font-mono">{stat.apiPath}</code>
                          </div>
                        )}

                        {stat.currentlyUsed && stat.usedIn && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-xs text-slate-500">Used in:</span>
                            {stat.usedIn.map(factor => (
                              <Badge key={factor} variant="outline" className="text-[10px] px-1.5 py-0 text-cyan-400 border-cyan-500/30">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {!stat.currentlyUsed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectStat?.(stat, selectedCategory)
                          }}
                        >
                          Create Factor
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}

              {filteredStats.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>All stats in this category are already in use</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Legend */}
        <div className="pt-4 border-t border-slate-700">
          {/* Data Source Legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            <span className="text-xs text-slate-500">Data Sources:</span>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400">Ready</span>
              <span className="text-[10px] text-slate-600">- Already fetched</span>
            </div>
            <div className="flex items-center gap-1">
              <Calculator className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] text-cyan-400">Calculated</span>
              <span className="text-[10px] text-slate-600">- Derived from existing</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400">API Required</span>
              <span className="text-[10px] text-slate-600">- Needs new fetch</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              💡 Click on an unused stat to create a new factor from it
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

