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
import {
  Brain,
  TrendingUp,
  Target,
  CheckCircle2,
  Copy,
  ExternalLink
} from 'lucide-react'

interface FactorStrategistProps {
  open: boolean
  onClose: () => void
}

// All the factor system info in one place
const FACTOR_INFO = {
  totals: {
    title: 'NBA TOTALS Factor System',
    currentFactors: [
      { key: 'paceIndex', name: 'Pace Index', stats: ['awayPaceLast10', 'homePaceLast10', 'leaguePace'], logic: 'Combined pace vs league avg → Higher = OVER' },
      { key: 'offForm', name: 'Offensive Form', stats: ['awayORtgLast10', 'homeORtgLast10', 'leagueORtg'], logic: 'Combined ORtg vs league avg → Higher = OVER' },
      { key: 'defErosion', name: 'Defensive Erosion', stats: ['awayDRtgSeason', 'homeDRtgSeason', 'leagueDRtg'], logic: 'Combined DRtg vs league avg → Higher (worse D) = OVER' },
      { key: 'threeEnv', name: '3-Point Environment', stats: ['away3PAR', 'home3PAR', 'away3Pct', 'home3Pct'], logic: 'Combined 3PA rate × 3P% → Higher = OVER' },
      { key: 'whistleEnv', name: 'Whistle Environment', stats: ['awayFTr', 'homeFTr', 'leagueFTr'], logic: 'Combined FT rate vs league avg → Higher = OVER' },
    ],
  },
  spread: {
    title: 'NBA SPREAD Factor System',
    currentFactors: [
      { key: 'netRatingDiff', name: 'Net Rating Diff', stats: ['awayORtgLast10', 'awayDRtgSeason', 'homeORtgLast10', 'homeDRtgSeason'], logic: 'Away net rating - Home net rating' },
      { key: 'turnoverDiff', name: 'Turnover Diff', stats: ['awayTOVLast10', 'homeTOVLast10'], logic: 'Away TOV - Home TOV → Lower = Away advantage' },
      { key: 'fourFactorsDiff', name: 'Four Factors Diff', stats: ['awayEfg', 'homeEfg', 'awayTovPct', 'homeTovPct', 'awayOrebPct', 'homeOrebPct'], logic: 'Dean Oliver Four Factors comparison' },
      { key: 'homeAwaySplits', name: 'Home/Away Splits', stats: ['awayORtgAway', 'homeORtgHome', 'awayDRtgAway', 'homeDRtgHome'], logic: 'Location-adjusted performance' },
    ],
  },
  availableStats: {
    paceAndTempo: [
      { stat: 'awayPaceSeason / homePaceSeason', desc: 'Season pace (poss/game)', inUse: true },
      { stat: 'awayPaceLast10 / homePaceLast10', desc: 'Last 10 games pace', inUse: true },
      { stat: 'leaguePace', desc: 'League average (~100.1)', inUse: true },
    ],
    scoring: [
      { stat: 'awayPointsPerGame / homePointsPerGame', desc: 'PPG (last 5 games)', inUse: false },
    ],
    offense: [
      { stat: 'awayORtgLast10 / homeORtgLast10', desc: 'Offensive rating (pts/100 poss)', inUse: true },
      { stat: 'leagueORtg', desc: 'League average (~114.5)', inUse: true },
    ],
    defense: [
      { stat: 'awayDRtgSeason / homeDRtgSeason', desc: 'Defensive rating', inUse: true },
      { stat: 'leagueDRtg', desc: 'League average (~114.5)', inUse: true },
    ],
    threePoint: [
      { stat: 'away3PAR / home3PAR', desc: '3-point attempt rate', inUse: true },
      { stat: 'awayOpp3PAR / homeOpp3PAR', desc: 'Opponent 3PA allowed', inUse: false },
      { stat: 'away3Pct / home3Pct', desc: 'Season 3P%', inUse: true },
      { stat: 'away3PctLast10 / home3PctLast10', desc: 'Last 10 games 3P%', inUse: false },
      { stat: 'league3PAR / league3Pct', desc: 'League averages', inUse: true },
    ],
    freeThrow: [
      { stat: 'awayFTr / homeFTr', desc: 'Free throw rate (FTA/FGA)', inUse: true },
      { stat: 'awayOppFTr / homeOppFTr', desc: 'Opponent FT rate allowed', inUse: false },
      { stat: 'leagueFTr', desc: 'League average (~0.22)', inUse: true },
    ],
    turnovers: [
      { stat: 'awayTOVLast10 / homeTOVLast10', desc: 'Turnovers/game (last 10)', inUse: true },
    ],
    rebounding: [
      { stat: 'awayOffReb / homeOffReb', desc: 'Offensive rebounds/game', inUse: false },
      { stat: 'awayDefReb / homeDefReb', desc: 'Defensive rebounds/game', inUse: false },
      { stat: 'awayOppOffReb / homeOppOffReb', desc: 'Opponent OREB allowed', inUse: false },
    ],
    fourFactors: [
      { stat: 'awayEfg / homeEfg', desc: 'Effective FG%', inUse: true },
      { stat: 'awayTovPct / homeTovPct', desc: 'Turnover %', inUse: true },
      { stat: 'awayOrebPct / homeOrebPct', desc: 'Offensive rebound %', inUse: true },
      { stat: 'awayFtr / homeFtr', desc: 'Free throw rate', inUse: true },
    ],
    splits: [
      { stat: 'awayORtgHome / awayORtgAway', desc: 'Away team ORtg by location', inUse: true },
      { stat: 'homeORtgHome / homeORtgAway', desc: 'Home team ORtg by location', inUse: true },
      { stat: 'awayDRtgHome / awayDRtgAway', desc: 'Away team DRtg by location', inUse: true },
      { stat: 'homeDRtgHome / homeDRtgAway', desc: 'Home team DRtg by location', inUse: true },
    ],
  },
  formulaPattern: `
TOTALS Formula Pattern:
1. Combine both teams: (awayStat + homeStat) / 2
2. Compare to league avg: combined - leagueAvg
3. Scale with tanh: Math.tanh(delta / SCALE)
4. Positive signal → OVER, Negative → UNDER

SPREAD Formula Pattern:
1. Compare teams: awayStat - homeStat (or inverse)
2. Scale with tanh: Math.tanh(diff / SCALE)
3. Positive signal → Away covers, Negative → Home covers
`,
}

export function FactorStrategist({ open, onClose }: FactorStrategistProps) {
  const [betType, setBetType] = useState<'TOTALS' | 'SPREAD'>('TOTALS')
  const [copied, setCopied] = useState(false)

  const currentInfo = betType === 'TOTALS' ? FACTOR_INFO.totals : FACTOR_INFO.spread

  const generateCopyText = () => {
    const info = betType === 'TOTALS' ? FACTOR_INFO.totals : FACTOR_INFO.spread
    const isTotals = betType === 'TOTALS'

    let text = `You are a professional NBA sports bettor and quantitative analyst. I'm building an AI prediction system for NBA ${betType} betting.\n\n`

    text += `## THE GOAL\n`
    if (isTotals) {
      text += `Predict whether NBA games will go OVER or UNDER the Vegas total line. Each "factor" analyzes a specific statistical angle and contributes to the final prediction.\n\n`
    } else {
      text += `Predict whether the AWAY or HOME team will cover the spread. Each "factor" analyzes a specific statistical angle and contributes to the final prediction.\n\n`
    }

    text += `## CURRENT FACTORS (Already Implemented - DO NOT Duplicate)\n\n`
    info.currentFactors.forEach(f => {
      text += `**${f.name}** - ${f.logic}\n`
    })

    text += `\n## AVAILABLE STATS (From MySportsFeeds API)\n`
    text += `Stats marked 🔓 are NOT yet used and available for new factors:\n\n`

    const allStats = [
      ...FACTOR_INFO.availableStats.paceAndTempo,
      ...FACTOR_INFO.availableStats.scoring,
      ...FACTOR_INFO.availableStats.offense,
      ...FACTOR_INFO.availableStats.defense,
      ...FACTOR_INFO.availableStats.threePoint,
      ...FACTOR_INFO.availableStats.freeThrow,
      ...FACTOR_INFO.availableStats.turnovers,
      ...FACTOR_INFO.availableStats.rebounding,
      ...FACTOR_INFO.availableStats.fourFactors,
      ...FACTOR_INFO.availableStats.splits,
    ]

    const availableOnly = allStats.filter(s => !s.inUse)
    const inUseStats = allStats.filter(s => s.inUse)

    text += `### 🔓 AVAILABLE (Use these for new factors)\n`
    availableOnly.forEach(s => {
      text += `- ${s.stat}: ${s.desc}\n`
    })

    text += `\n### ✅ Already in use (for reference only)\n`
    inUseStats.forEach(s => {
      text += `- ${s.stat}: ${s.desc}\n`
    })

    text += `\n## HOW FACTORS WORK\n`
    if (isTotals) {
      text += `\`\`\`
1. Combine both teams: (awayStat + homeStat) / 2
2. Compare to league average: combined - leagueAvg
3. Result: Positive = leans OVER, Negative = leans UNDER
\`\`\`\n\n`
    } else {
      text += `\`\`\`
1. Compare teams: awayStat - homeStat
2. Result: Positive = Away team advantage, Negative = Home team advantage
\`\`\`\n\n`
    }

    text += `## YOUR TASK\n`
    text += `Propose 3-5 NEW factors using ONLY the 🔓 AVAILABLE stats listed above.\n\n`

    text += `For each factor, provide:\n`
    text += `1. **Name**: Short descriptive name\n`
    text += `2. **Stats Used**: Which stats from the AVAILABLE list\n`
    text += `3. **Formula**: How to combine the stats (use exact stat names)\n`
    text += `4. **Direction**: ${isTotals ? 'Higher value = OVER or UNDER?' : 'Positive value = Away covers or Home covers?'}\n`
    text += `5. **Betting Thesis**: Why this factor predicts ${isTotals ? 'scoring' : 'spread outcomes'} (2-3 sentences max)\n`
    text += `6. **Confidence**: High/Medium/Low - how strong is the predictive logic?\n\n`

    text += `## CONSTRAINTS\n`
    text += `- ONLY use stats from the 🔓 AVAILABLE list\n`
    text += `- Do NOT duplicate logic already covered by existing factors\n`
    text += `- Each factor should measure something DIFFERENT\n`
    text += `- Prefer factors with clear, logical betting thesis over complex formulas\n`
    text += `- Think like a sharp bettor: what edges does the market miss?\n`

    return text
  }

  const copyToClipboard = async () => {
    const text = generateCopyText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Brain className="w-6 h-6 text-purple-400" />
            Factor System Info
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50 ml-2">
              For ChatGPT 5.0
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Copy this info and paste into ChatGPT 5.0 to get factor recommendations
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selection + Copy Button */}
        <div className="flex gap-3 py-4 border-b border-slate-700">
          <Button
            variant={betType === 'TOTALS' ? 'default' : 'outline'}
            onClick={() => setBetType('TOTALS')}
            className={betType === 'TOTALS' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            TOTALS
          </Button>
          <Button
            variant={betType === 'SPREAD' ? 'default' : 'outline'}
            onClick={() => setBetType('SPREAD')}
            className={betType === 'SPREAD' ? 'bg-gradient-to-r from-amber-600 to-orange-600' : ''}
          >
            <Target className="w-4 h-4 mr-2" />
            SPREAD
          </Button>

          <div className="flex-1" />

          <Button
            variant="outline"
            onClick={() => window.open('https://chat.openai.com/', '_blank')}
            className="border-slate-600"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Open ChatGPT
          </Button>
          <Button
            onClick={copyToClipboard}
            className={copied
              ? "bg-green-600 hover:bg-green-700"
              : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            }
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy All Info
              </>
            )}
          </Button>
        </div>

        {/* Info Display */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">

          {/* Current Factors */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Current {betType} Factors (Already In Use)
            </h3>
            <div className="grid gap-2">
              {currentInfo.currentFactors.map(f => (
                <div key={f.key} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{f.name}</span>
                    <Badge variant="outline" className="text-xs text-slate-400">{f.key}</Badge>
                  </div>
                  <div className="text-xs text-cyan-400 mb-1">
                    Stats: {f.stats.join(', ')}
                  </div>
                  <div className="text-xs text-slate-400">{f.logic}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Stats */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">📊 Available Stats (MySportsFeeds API)</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(FACTOR_INFO.availableStats).map(([category, stats]) => (
                <div key={category} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-300 mb-2 capitalize">
                    {category.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <div className="space-y-1">
                    {stats.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">{s.stat}</span>
                        <Badge
                          variant="outline"
                          className={s.inUse
                            ? "text-green-400 border-green-500/30 text-[10px]"
                            : "text-amber-400 border-amber-500/30 text-[10px]"
                          }
                        >
                          {s.inUse ? '✅ IN USE' : '🔓 AVAILABLE'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formula Pattern */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">🧮 Formula Pattern</h3>
            <pre className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap">
              {FACTOR_INFO.formulaPattern.trim()}
            </pre>
          </div>

          {/* Instructions */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h4 className="font-semibold text-purple-300 mb-2">📋 How to use:</h4>
            <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
              <li>Click "Copy All Info" to copy everything above</li>
              <li>Open ChatGPT 5.0 and paste</li>
              <li>Ask: "Propose 3-5 new factors using the AVAILABLE stats"</li>
              <li>Share the good recommendations here and I'll implement them!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            💡 Copy this info to ChatGPT 5.0 to get smart factor recommendations
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
