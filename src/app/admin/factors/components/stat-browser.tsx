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
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react'

// Type definition for stats
interface StatDefinition {
  key: string
  name: string
  description: string
  unit: string
  currentlyUsed: boolean
  usedIn?: string[]
}

interface StatCategory {
  category: string
  icon: any
  color: string
  stats: StatDefinition[]
}

// All available stats from MySportsFeeds that we can turn into factors
export const AVAILABLE_STATS: Record<string, StatCategory> = {
  pace: {
    category: 'Pace & Tempo',
    icon: Gauge,
    color: 'cyan',
    stats: [
      { key: 'pace', name: 'Pace', description: 'Possessions per game', unit: 'poss/game', currentlyUsed: true, usedIn: ['paceIndex'] },
      { key: 'paceDelta', name: 'Pace vs League', description: 'Team pace minus league average pace', unit: 'delta', currentlyUsed: false },
      { key: 'paceVariance', name: 'Pace Variance', description: 'Standard deviation of pace over last 10 games', unit: 'stdev', currentlyUsed: false },
    ]
  },
  offense: {
    category: 'Offense',
    icon: Target,
    color: 'green',
    stats: [
      { key: 'ortg', name: 'Offensive Rating', description: 'Points per 100 possessions', unit: 'pts/100', currentlyUsed: true, usedIn: ['offForm', 'netRatingDiff'] },
      { key: 'ppg', name: 'Points Per Game', description: 'Average points scored per game', unit: 'pts', currentlyUsed: false },
      { key: 'fgPct', name: 'Field Goal %', description: 'Field goal percentage', unit: '%', currentlyUsed: false },
      { key: 'avgEfg', name: 'Effective FG%', description: 'eFG% (accounts for 3-pointers)', unit: '%', currentlyUsed: true, usedIn: ['fourFactorsDiff'] },
      { key: 'threeP_pct', name: '3-Point %', description: '3-point field goal percentage', unit: '%', currentlyUsed: true, usedIn: ['threeEnv'] },
      { key: 'threeP_rate', name: '3-Point Rate (3PAR)', description: '3-point attempts as % of total FGA', unit: '%', currentlyUsed: true, usedIn: ['threeEnv'] },
      { key: 'ft_rate', name: 'Free Throw Rate', description: 'FTA per FGA', unit: 'ratio', currentlyUsed: true, usedIn: ['whistleEnv'] },
      { key: 'assists', name: 'Assists Per Game', description: 'Average assists per game', unit: 'ast', currentlyUsed: false },
      { key: 'astTovRatio', name: 'AST/TOV Ratio', description: 'Assists per turnover', unit: 'ratio', currentlyUsed: false },
    ]
  },
  defense: {
    category: 'Defense',
    icon: Shield,
    color: 'red',
    stats: [
      { key: 'drtg', name: 'Defensive Rating', description: 'Opponent points per 100 possessions', unit: 'pts/100', currentlyUsed: true, usedIn: ['defErosion', 'netRatingDiff'] },
      { key: 'oppPpg', name: 'Opp Points Per Game', description: 'Average points allowed per game', unit: 'pts', currentlyUsed: false },
      { key: 'steals', name: 'Steals Per Game', description: 'Average steals per game', unit: 'stl', currentlyUsed: false },
      { key: 'blocks', name: 'Blocks Per Game', description: 'Average blocks per game', unit: 'blk', currentlyUsed: false },
      { key: 'oppFgPct', name: 'Opp FG%', description: 'Opponent field goal percentage allowed', unit: '%', currentlyUsed: false },
      { key: 'oppThreePct', name: 'Opp 3P%', description: 'Opponent 3-point percentage allowed', unit: '%', currentlyUsed: false },
    ]
  },
  ballControl: {
    category: 'Ball Control',
    icon: RotateCcw,
    color: 'yellow',
    stats: [
      { key: 'avgTurnovers', name: 'Turnovers Per Game', description: 'Average turnovers committed', unit: 'tov', currentlyUsed: true, usedIn: ['turnoverDiff'] },
      { key: 'avgTovPct', name: 'Turnover %', description: 'Turnovers per 100 possessions', unit: '%', currentlyUsed: true, usedIn: ['fourFactorsDiff'] },
      { key: 'oppTov', name: 'Opp Turnovers', description: 'Turnovers forced per game', unit: 'tov', currentlyUsed: false },
      { key: 'tovDiff', name: 'Turnover Differential', description: 'Turnovers forced minus committed', unit: 'diff', currentlyUsed: false },
    ]
  },
  rebounding: {
    category: 'Rebounding',
    icon: Activity,
    color: 'purple',
    stats: [
      { key: 'avgOffReb', name: 'Offensive Rebounds', description: 'Offensive rebounds per game', unit: 'oreb', currentlyUsed: true, usedIn: ['fourFactorsDiff'] },
      { key: 'avgDefReb', name: 'Defensive Rebounds', description: 'Defensive rebounds per game', unit: 'dreb', currentlyUsed: true },
      { key: 'avgOrebPct', name: 'OREB%', description: 'Offensive rebound percentage', unit: '%', currentlyUsed: true, usedIn: ['fourFactorsDiff'] },
      { key: 'rebDiff', name: 'Rebound Differential', description: 'Total rebounds minus opponent rebounds', unit: 'diff', currentlyUsed: false },
    ]
  },
  splits: {
    category: 'Home/Away Splits',
    icon: Home,
    color: 'blue',
    stats: [
      { key: 'ortgHome', name: 'Home ORtg', description: 'Offensive rating in home games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'] },
      { key: 'ortgAway', name: 'Away ORtg', description: 'Offensive rating in away games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'] },
      { key: 'drtgHome', name: 'Home DRtg', description: 'Defensive rating in home games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'] },
      { key: 'drtgAway', name: 'Away DRtg', description: 'Defensive rating in away games', unit: 'pts/100', currentlyUsed: true, usedIn: ['homeAwaySplits'] },
      { key: 'homeWinPct', name: 'Home Win %', description: 'Win percentage at home', unit: '%', currentlyUsed: false },
      { key: 'awayWinPct', name: 'Away Win %', description: 'Win percentage on the road', unit: '%', currentlyUsed: false },
    ]
  },
  situational: {
    category: 'Situational',
    icon: Plane,
    color: 'orange',
    stats: [
      { key: 'restDays', name: 'Rest Days', description: 'Days since last game', unit: 'days', currentlyUsed: false },
      { key: 'b2bRecord', name: 'Back-to-Back Record', description: 'Win % on back-to-backs', unit: '%', currentlyUsed: false },
      { key: 'lastNWinPct', name: 'Last 10 Win %', description: 'Win percentage over last 10 games', unit: '%', currentlyUsed: false },
      { key: 'clutchNetRtg', name: 'Clutch Net Rating', description: 'Net rating in clutch situations', unit: 'pts/100', currentlyUsed: false },
      { key: 'q4Scoring', name: '4th Quarter Scoring', description: 'Average 4th quarter points', unit: 'pts', currentlyUsed: false },
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
              {filteredStats.map((stat) => (
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
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{stat.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">
                          {stat.unit}
                        </Badge>
                        {stat.currentlyUsed && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-[10px]">
                            IN USE
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{stat.description}</p>
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
              ))}

              {filteredStats.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>All stats in this category are already in use</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            💡 Click on an unused stat to create a new factor from it
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

