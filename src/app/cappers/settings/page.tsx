'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, Zap, Hand, Ban, Gauge, TrendingUp, Target, Home, Battery, BarChart3, Shield, Trophy, Flame, UserX, Anchor, Scale, Rocket, Castle, TrendingDown, Loader2, AlertCircle, Swords, Crown, Star, ChevronRight, Pencil, Check, X, ChevronDown, Activity, Crosshair, Repeat, RotateCcw, MapPin, Award, Shuffle, HelpCircle, AlertTriangle, Waves, Eye, Snowflake, Bomb, LineChart, Mountain, Skull, Compass, Wind, Clock, Users, ArrowLeft, Save, BedDouble, Thermometer } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

type ConfigTab = 'archetype' | 'options'

// ============================================
// BASELINE MODELS - For Pick Diversity
// ============================================
type TotalsBaselineModel = 'pace-efficiency' | 'ppg-based' | 'matchup-defensive'
type SpreadBaselineModel = 'net-rating' | 'scoring-margin' | 'h2h-projection'

interface BaselineModelInfo {
  name: string
  shortName: string
  description: string
  iconName: 'Zap' | 'BarChart3' | 'Shield' | 'TrendingUp' | 'Target' | 'Swords'
  color: string
  borderStyle: string
  glowColor: string
  philosophy: string
}

const TOTALS_BASELINE_MODELS: Record<TotalsBaselineModel, BaselineModelInfo> = {
  'pace-efficiency': {
    name: 'Pace-Efficiency',
    shortName: 'Pace',
    description: 'Uses pace × offensive ratings',
    iconName: 'Zap',
    color: 'yellow',
    borderStyle: 'border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5),inset_0_0_15px_rgba(250,204,21,0.2)]',
    glowColor: 'rgba(250,204,21,0.6)',
    philosophy: 'Speed kills. Trust the tempo.'
  },
  'ppg-based': {
    name: 'PPG Average',
    shortName: 'PPG',
    description: 'Uses raw scoring averages',
    iconName: 'BarChart3',
    color: 'blue',
    borderStyle: 'border-4 border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.5),inset_0_0_15px_rgba(96,165,250,0.2)]',
    glowColor: 'rgba(96,165,250,0.6)',
    philosophy: 'Numbers don\'t lie. Trust the average.'
  },
  'matchup-defensive': {
    name: 'Matchup-Defensive',
    shortName: 'Defense',
    description: 'Weights opponent defense heavily',
    iconName: 'Shield',
    color: 'emerald',
    borderStyle: 'border-4 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5),inset_0_0_15px_rgba(52,211,153,0.2)]',
    glowColor: 'rgba(52,211,153,0.6)',
    philosophy: 'Defense wins. Respect the matchup.'
  }
}

const SPREAD_BASELINE_MODELS: Record<SpreadBaselineModel, BaselineModelInfo> = {
  'net-rating': {
    name: 'Net Rating',
    shortName: 'Net',
    description: 'Uses efficiency differential',
    iconName: 'TrendingUp',
    color: 'purple',
    borderStyle: 'border-4 border-purple-400 shadow-[0_0_20px_rgba(192,132,252,0.5),inset_0_0_15px_rgba(192,132,252,0.2)]',
    glowColor: 'rgba(192,132,252,0.6)',
    philosophy: 'Quality matters. Trust the ratings.'
  },
  'scoring-margin': {
    name: 'Scoring Margin',
    shortName: 'Margin',
    description: 'Uses actual point differentials',
    iconName: 'Target',
    color: 'red',
    borderStyle: 'border-4 border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.5),inset_0_0_15px_rgba(248,113,113,0.2)]',
    glowColor: 'rgba(248,113,113,0.6)',
    philosophy: 'Scoreboard is truth. Trust the margins.'
  },
  'h2h-projection': {
    name: 'Head-to-Head',
    shortName: 'H2H',
    description: 'Projects vs specific opponent',
    iconName: 'Swords',
    color: 'orange',
    borderStyle: 'border-4 border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.5),inset_0_0_15px_rgba(251,146,60,0.2)]',
    glowColor: 'rgba(251,146,60,0.6)',
    philosophy: 'Every opponent is different. Project the clash.'
  }
}

// Helper to render baseline model icons
const BaselineIcon = ({ iconName, className }: { iconName: BaselineModelInfo['iconName'], className?: string }) => {
  const iconClass = className || 'w-5 h-5'
  switch (iconName) {
    case 'Zap': return <Zap className={iconClass} />
    case 'BarChart3': return <BarChart3 className={iconClass} />
    case 'Shield': return <Shield className={iconClass} />
    case 'TrendingUp': return <TrendingUp className={iconClass} />
    case 'Target': return <Target className={iconClass} />
    case 'Swords': return <Swords className={iconClass} />
    default: return null
  }
}

interface PresetConfig {
  id: string
  name: string
  description: string
  icon: any
  color: string
  philosophy: string
  totalFactors: {
    enabled: string[]
    weights: { [factor: string]: number }
  }
  spreadFactors: {
    enabled: string[]
    weights: { [factor: string]: number }
  }
}

type PickMode = 'manual' | 'auto' | 'hybrid'

interface CapperData {
  id: string
  capper_id: string
  display_name: string
  description: string
  color_theme: string
  sport: string
  bet_types: string[]
  pick_mode: PickMode
  excluded_teams: string[]
  factor_config: {
    [betType: string]: {
      enabled_factors: string[]
      weights: { [factor: string]: number }
      baseline_model?: string
    }
  }
  execution_interval_minutes: number
  execution_priority: number
}

// ============================================
// FACTOR_DETAILS - Using CORRECT SHIVA factor keys
// ============================================
const FACTOR_DETAILS: Record<string, { name: string; icon: any; description: string; importance: string; example: string; defaultWeight: number; color: string }> = {
  // === TOTALS FACTORS ===
  paceIndex: { name: 'Pace Index', icon: Gauge, description: 'Expected game pace based on both teams\' recent pace', importance: 'Fast-paced games produce higher totals.', example: 'High pace game → Strong Over signal.', defaultWeight: 20, color: 'cyan' },
  offForm: { name: 'Offensive Form', icon: TrendingUp, description: 'Recent offensive efficiency and scoring trends', importance: 'Elite offenses vs weak defenses create higher scoring games.', example: 'Strong offense vs weak defense → Strong Over signal.', defaultWeight: 20, color: 'green' },
  defErosion: { name: 'Defensive Erosion', icon: Shield, description: 'Defensive performance degradation', importance: 'Eroded defenses allow more points.', example: 'Team allowing +6 PPG more than avg → Strong Over lean.', defaultWeight: 20, color: 'red' },
  threeEnv: { name: '3-Point Environment', icon: Target, description: '3PT% trends and shooting volume', importance: 'Hot shooting teams score more points.', example: 'Team shooting 40% from 3PT → +2.5 points per game.', defaultWeight: 20, color: 'orange' },
  whistleEnv: { name: 'Whistle Environment', icon: Activity, description: 'Free throw rate and foul tendencies', importance: 'High foul rate games produce more free throws.', example: 'Both teams in top 10 FT rate → Game likely to go Over.', defaultWeight: 20, color: 'yellow' },
  injuryAvailability: { name: 'Injury Availability', icon: UserX, description: 'Impact of injured players', importance: 'Missing key players significantly impacts scoring.', example: 'Star player OUT → 4.5 point impact on total.', defaultWeight: 20, color: 'purple' },
  restAdvantage: { name: 'Rest Advantage', icon: Clock, description: 'Rest differential between teams', importance: 'Fatigued teams score less efficiently.', example: 'Both teams on B2B → Strong Under signal.', defaultWeight: 15, color: 'slate' },
  defStrength: { name: 'Defensive Strength', icon: Shield, description: 'UNDER-biased: Strong combined defense', importance: 'Elite defenses limit scoring.', example: 'Both teams DRtg < 108 → Strong Under signal.', defaultWeight: 20, color: 'teal' },
  coldShooting: { name: 'Cold Shooting', icon: Snowflake, description: 'UNDER-biased: Teams in shooting slumps', importance: 'Cold shooting streaks are real.', example: 'Both teams shooting 32% from 3 → Strong Under signal.', defaultWeight: 20, color: 'sky' },
  // === SPREAD FACTORS ===
  netRatingDiff: { name: 'Net Rating Differential', icon: BarChart3, description: 'Difference in overall team quality', importance: 'Better teams by net rating tend to cover spreads.', example: 'Team A: +8 NetRtg vs Team B: -3 NetRtg → Team A strong ATS.', defaultWeight: 25, color: 'indigo' },
  turnoverDiff: { name: 'Turnover Differential', icon: Shuffle, description: 'Ball security and forcing turnovers', importance: 'Teams that protect the ball create extra possessions.', example: '+3 turnover differential → Extra 6+ points of offense.', defaultWeight: 20, color: 'emerald' },
  shootingEfficiencyMomentum: { name: 'Shooting Momentum', icon: Flame, description: 'Recent shooting efficiency trends', importance: 'Teams on hot ATS streaks tend to continue.', example: 'Team shooting +5% above avg → Strong cover signal.', defaultWeight: 25, color: 'red' },
  reboundingDiff: { name: 'Rebounding Differential', icon: Activity, description: 'Board control advantage', importance: 'Offensive rebounds = second chance points.', example: '+5 total rebounding advantage → ATS edge.', defaultWeight: 20, color: 'purple' },
  defensivePressure: { name: 'Defensive Pressure', icon: Shield, description: 'Defensive disruption through steals and blocks', importance: 'High pressure defense creates transition opportunities.', example: 'Team with +2 steals/game → Cover potential.', defaultWeight: 15, color: 'teal' },
  assistEfficiency: { name: 'Assist Efficiency', icon: Users, description: 'Ball movement quality and team chemistry', importance: 'High AST/TOV ratio = smart decisions.', example: 'Team with 2.0 AST/TOV vs 1.5 → ATS value.', defaultWeight: 15, color: 'sky' },
  fourFactorsDiff: { name: 'Four Factors Differential', icon: Trophy, description: 'Dean Oliver\'s Four Factors matchup analysis', importance: 'Four factors predict winning better than raw scoring.', example: 'Winning 3/4 factors → High probability of covering.', defaultWeight: 25, color: 'amber' },
  momentumIndex: { name: 'Momentum Index', icon: TrendingUp, description: 'Team momentum based on win streak', importance: 'Hot teams tend to cover spreads.', example: 'Team on 5-game win streak → Strong ATS signal.', defaultWeight: 15, color: 'green' }
}

// Available factors for each bet type
const AVAILABLE_FACTORS = {
  TOTAL: ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability', 'restAdvantage', 'defStrength', 'coldShooting'],
  SPREAD: ['netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'reboundingDiff', 'fourFactorsDiff', 'injuryAvailability', 'momentumIndex', 'defensivePressure', 'assistEfficiency']
}

// Factor groups for organized display
const FACTOR_GROUPS = {
  TOTAL: [
    { id: 'pace', name: 'Pace & Tempo', icon: Activity, factors: ['paceIndex'], color: 'cyan' },
    { id: 'offense', name: 'Offensive Form', icon: TrendingUp, factors: ['offForm'], color: 'green' },
    { id: 'defense', name: 'Defensive Erosion', icon: Shield, factors: ['defErosion'], color: 'red' },
    { id: 'defStrength', name: 'Defensive Strength', icon: Shield, factors: ['defStrength'], color: 'teal' },
    { id: 'shooting', name: '3-Point Environment', icon: Crosshair, factors: ['threeEnv'], color: 'orange' },
    { id: 'coldShooting', name: 'Cold Shooting', icon: Snowflake, factors: ['coldShooting'], color: 'sky' },
    { id: 'whistle', name: 'Whistle Environment', icon: Activity, factors: ['whistleEnv'], color: 'yellow' },
    { id: 'injuries', name: 'Injuries', icon: UserX, factors: ['injuryAvailability'], color: 'purple' },
    { id: 'rest', name: 'Rest Advantage', icon: Clock, factors: ['restAdvantage'], color: 'slate' },
  ],
  SPREAD: [
    { id: 'netRating', name: 'Net Rating', icon: BarChart3, factors: ['netRatingDiff'], color: 'indigo' },
    { id: 'turnovers', name: 'Turnovers', icon: Shuffle, factors: ['turnoverDiff'], color: 'emerald' },
    { id: 'momentum', name: 'Shooting Momentum', icon: Flame, factors: ['shootingEfficiencyMomentum'], color: 'red' },
    { id: 'rebounding', name: 'Rebounding', icon: Activity, factors: ['reboundingDiff'], color: 'purple' },
    { id: 'fourFactors', name: 'Four Factors', icon: Trophy, factors: ['fourFactorsDiff'], color: 'amber' },
    { id: 'injuries', name: 'Injuries', icon: UserX, factors: ['injuryAvailability'], color: 'purple' },
    { id: 'momentumIndex', name: 'Momentum Index', icon: TrendingUp, factors: ['momentumIndex'], color: 'green' },
    { id: 'defensivePressure', name: 'Defensive Pressure', icon: Shield, factors: ['defensivePressure'], color: 'teal' },
    { id: 'assistEfficiency', name: 'Assist Efficiency', icon: Users, factors: ['assistEfficiency'], color: 'sky' },
  ]
}

// ============================================
// TOTALS ARCHETYPES - All weights MUST sum to 250%
// ============================================
const TOTALS_ARCHETYPES: PresetConfig[] = [
  { id: 'pace-prophet', name: 'The Pace Prophet', description: 'Game tempo is everything. Fast pace = points.', icon: Rocket, color: 'cyan', philosophy: 'Pace is the #1 predictor of totals.', totalFactors: { enabled: ['paceIndex', 'offForm', 'threeEnv', 'defErosion', 'whistleEnv'], weights: { paceIndex: 80, offForm: 60, threeEnv: 50, defErosion: 40, whistleEnv: 20 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'efficiency-expert', name: 'The Efficiency Expert', description: 'Quality over quantity. Elite offense + weak defense = points.', icon: BarChart3, color: 'green', philosophy: 'Offensive and defensive ratings tell the real story.', totalFactors: { enabled: ['offForm', 'defErosion', 'injuryAvailability', 'paceIndex', 'threeEnv'], weights: { offForm: 70, defErosion: 60, injuryAvailability: 50, paceIndex: 40, threeEnv: 30 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'hot-hand-hunter', name: 'The Hot Hand Hunter', description: 'Ride the streaks. Hot shooting = easy overs.', icon: Flame, color: 'orange', philosophy: 'Shooting streaks are real.', totalFactors: { enabled: ['threeEnv', 'offForm', 'paceIndex', 'whistleEnv', 'defErosion'], weights: { threeEnv: 80, offForm: 60, paceIndex: 50, whistleEnv: 40, defErosion: 20 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'free-throw-fiend', name: 'The Whistle Hunter', description: 'Refs run the game. Free throws decide totals.', icon: AlertTriangle, color: 'yellow', philosophy: 'Free throws are free points.', totalFactors: { enabled: ['whistleEnv', 'offForm', 'defErosion', 'paceIndex', 'injuryAvailability'], weights: { whistleEnv: 90, offForm: 60, defErosion: 50, paceIndex: 30, injuryAvailability: 20 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'totals-balanced', name: 'The Sharp Scholar', description: 'Trust the math. Every factor has value.', icon: Scale, color: 'slate', philosophy: 'No single factor dominates.', totalFactors: { enabled: ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'], weights: { paceIndex: 50, offForm: 50, defErosion: 50, threeEnv: 50, whistleEnv: 50 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'the-fade', name: 'The Fade Artist', description: 'Bet against the cold. Fade the strugglers.', icon: TrendingDown, color: 'blue', philosophy: 'Defense tells the truth.', totalFactors: { enabled: ['defErosion', 'offForm', 'injuryAvailability', 'whistleEnv', 'paceIndex'], weights: { defErosion: 80, offForm: 60, injuryAvailability: 50, whistleEnv: 40, paceIndex: 20 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'tempo-tyrant', name: 'The Tempo Tyrant', description: 'Control the clock. Slow games = unders.', icon: Snowflake, color: 'sky', philosophy: 'Pace and defense together reveal the grind-it-out games.', totalFactors: { enabled: ['paceIndex', 'defErosion', 'offForm', 'threeEnv', 'whistleEnv'], weights: { paceIndex: 90, defErosion: 70, offForm: 50, threeEnv: 25, whistleEnv: 15 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'injury-assassin', name: 'The Injury Assassin', description: 'Missing stars change everything.', icon: Skull, color: 'rose', philosophy: 'When key players sit, scoring collapses or explodes.', totalFactors: { enabled: ['injuryAvailability', 'defErosion', 'offForm', 'paceIndex', 'whistleEnv'], weights: { injuryAvailability: 80, defErosion: 60, offForm: 50, paceIndex: 40, whistleEnv: 20 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'the-locksmith', name: 'The Locksmith', description: 'UNDER specialist. Defense wins and limits scoring.', icon: Shield, color: 'teal', philosophy: 'Elite defenses create low-scoring games.', totalFactors: { enabled: ['defStrength', 'coldShooting', 'injuryAvailability', 'paceIndex', 'restAdvantage'], weights: { defStrength: 80, coldShooting: 70, injuryAvailability: 50, paceIndex: 30, restAdvantage: 20 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'the-grinder', name: 'The Grinder', description: 'Slow games, ugly games, UNDER games.', icon: Snowflake, color: 'sky', philosophy: 'Pace is king for unders.', totalFactors: { enabled: ['paceIndex', 'coldShooting', 'defStrength', 'restAdvantage', 'injuryAvailability'], weights: { paceIndex: 70, coldShooting: 60, defStrength: 50, restAdvantage: 40, injuryAvailability: 30 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'rest-detective', name: 'The Rest Detective', description: 'Fatigue kills. Fresh legs = easy points.', icon: BedDouble, color: 'indigo', philosophy: 'Back-to-backs and long road trips destroy performance.', totalFactors: { enabled: ['restAdvantage', 'injuryAvailability', 'defErosion', 'paceIndex', 'offForm'], weights: { restAdvantage: 80, injuryAvailability: 60, defErosion: 50, paceIndex: 35, offForm: 25 } }, spreadFactors: { enabled: [], weights: {} } },
  { id: 'cold-hunter', name: 'The Cold Hunter', description: 'Fade the slump. Cold shooting = unders.', icon: Thermometer, color: 'blue', philosophy: 'Shooting slumps are real. Fade the brick-layers.', totalFactors: { enabled: ['coldShooting', 'threeEnv', 'defStrength', 'paceIndex', 'offForm'], weights: { coldShooting: 85, threeEnv: 55, defStrength: 45, paceIndex: 40, offForm: 25 } }, spreadFactors: { enabled: [], weights: {} } }
]

// ============================================
// SPREAD ARCHETYPES - All weights MUST sum to 250%
// ============================================
const SPREAD_ARCHETYPES: PresetConfig[] = [
  { id: 'hot-hand', name: 'The Hot Hand', description: 'Shooting streaks are real. Ride the hot teams.', icon: TrendingUp, color: 'red', philosophy: 'Recent shooting momentum predicts near-term performance.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['shootingEfficiencyMomentum', 'netRatingDiff', 'reboundingDiff', 'fourFactorsDiff', 'turnoverDiff'], weights: { shootingEfficiencyMomentum: 80, netRatingDiff: 60, reboundingDiff: 50, fourFactorsDiff: 40, turnoverDiff: 20 } } },
  { id: 'matchup-master', name: 'The Matchup Master', description: 'It\'s all about the matchup. Offense vs defense.', icon: Swords, color: 'indigo', philosophy: 'Ignore records, focus on how teams match up.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['fourFactorsDiff', 'reboundingDiff', 'netRatingDiff', 'shootingEfficiencyMomentum', 'injuryAvailability'], weights: { fourFactorsDiff: 70, reboundingDiff: 60, netRatingDiff: 50, shootingEfficiencyMomentum: 40, injuryAvailability: 30 } } },
  { id: 'disruptor', name: 'The Disruptor', description: 'Chaos wins. Force turnovers, control the game.', icon: Shuffle, color: 'emerald', philosophy: 'Turnovers are the great equalizer.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['turnoverDiff', 'defensivePressure', 'fourFactorsDiff', 'netRatingDiff', 'reboundingDiff'], weights: { turnoverDiff: 70, defensivePressure: 50, fourFactorsDiff: 50, netRatingDiff: 40, reboundingDiff: 40 } } },
  { id: 'closer', name: 'The Closer', description: 'Net rating and efficiency win close games.', icon: Trophy, color: 'amber', philosophy: 'Games are won by the better team.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['netRatingDiff', 'shootingEfficiencyMomentum', 'turnoverDiff', 'reboundingDiff', 'fourFactorsDiff'], weights: { netRatingDiff: 75, shootingEfficiencyMomentum: 55, turnoverDiff: 50, reboundingDiff: 40, fourFactorsDiff: 30 } } },
  { id: 'injury-hawk', name: 'The Injury Hawk', description: 'Lines move slow. Injuries create value.', icon: UserX, color: 'purple', philosophy: 'Vegas adjusts lines, but not enough.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['injuryAvailability', 'fourFactorsDiff', 'reboundingDiff', 'netRatingDiff', 'turnoverDiff'], weights: { injuryAvailability: 80, fourFactorsDiff: 60, reboundingDiff: 50, netRatingDiff: 40, turnoverDiff: 20 } } },
  { id: 'board-bully', name: 'The Board Bully', description: 'Control the glass, control the game.', icon: Activity, color: 'teal', philosophy: 'Rebounding is the most underrated factor.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['reboundingDiff', 'turnoverDiff', 'fourFactorsDiff', 'netRatingDiff', 'shootingEfficiencyMomentum'], weights: { reboundingDiff: 85, turnoverDiff: 55, fourFactorsDiff: 50, netRatingDiff: 40, shootingEfficiencyMomentum: 20 } } },
  { id: 'cold-blooded', name: 'The Cold Blooded', description: 'Fade the hype. Trust fundamentals over narratives.', icon: Eye, color: 'gray', philosophy: 'Ignore the noise. Net rating + four factors = truth.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['netRatingDiff', 'fourFactorsDiff', 'injuryAvailability', 'turnoverDiff', 'reboundingDiff'], weights: { netRatingDiff: 80, fourFactorsDiff: 70, injuryAvailability: 50, turnoverDiff: 30, reboundingDiff: 20 } } },
  { id: 'the-grinder', name: 'The Grinder', description: 'Discipline wins. Low turnover teams cover.', icon: Mountain, color: 'stone', philosophy: 'Ball security + efficient shooting = covering spreads.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['turnoverDiff', 'shootingEfficiencyMomentum', 'netRatingDiff', 'fourFactorsDiff', 'reboundingDiff'], weights: { turnoverDiff: 75, shootingEfficiencyMomentum: 60, netRatingDiff: 50, fourFactorsDiff: 40, reboundingDiff: 25 } } },
  { id: 'ball-mover', name: 'The Ball Mover', description: 'Unselfish teams with great chemistry cover.', icon: Users, color: 'sky', philosophy: 'High AST/TOV ratio = smart decisions.', totalFactors: { enabled: [], weights: {} }, spreadFactors: { enabled: ['assistEfficiency', 'turnoverDiff', 'fourFactorsDiff', 'netRatingDiff', 'reboundingDiff'], weights: { assistEfficiency: 75, turnoverDiff: 55, fourFactorsDiff: 50, netRatingDiff: 40, reboundingDiff: 30 } } }
]

const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
]

export default function CapperSettingsPage() {
  const router = useRouter()
  const { profile, loading: authLoading, user } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<ConfigTab>('archetype')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capperData, setCapperData] = useState<CapperData | null>(null)

  // Archetype per bet type
  const [selectedPresets, setSelectedPresets] = useState<{ TOTAL: string | null; SPREAD: string | null }>({
    TOTAL: null,
    SPREAD: null
  })
  const [archetypeBetType, setArchetypeBetType] = useState<'TOTAL' | 'SPREAD'>('TOTAL')
  const [factorBetType, setFactorBetType] = useState<'TOTAL' | 'SPREAD'>('TOTAL')

  // Baseline models for pick diversity
  const [selectedTotalsModel, setSelectedTotalsModel] = useState<TotalsBaselineModel>('pace-efficiency')
  const [selectedSpreadModel, setSelectedSpreadModel] = useState<SpreadBaselineModel>('net-rating')

  // Factor configuration
  const [enabledFactors, setEnabledFactors] = useState<{ TOTAL: string[]; SPREAD: string[] }>({
    TOTAL: [],
    SPREAD: []
  })
  const [factorWeights, setFactorWeights] = useState<{ TOTAL: { [key: string]: number }; SPREAD: { [key: string]: number } }>({
    TOTAL: {},
    SPREAD: {}
  })

  // Options
  const [pickMode, setPickMode] = useState<PickMode>('auto')
  const [excludedTeams, setExcludedTeams] = useState<string[]>([])

  // Load existing capper data
  useEffect(() => {
    const loadCapperData = async () => {
      if (!user) return

      try {
        setIsLoading(true)
        const response = await fetch('/api/user-cappers/my-capper')
        if (!response.ok) {
          if (response.status === 404) {
            // No capper found, redirect to create page
            router.push('/cappers/create')
            return
          }
          throw new Error('Failed to load capper data')
        }

        const data = await response.json()
        if (!data.capper) {
          router.push('/cappers/create')
          return
        }

        setCapperData(data.capper)

        // Populate form with existing data
        const capper = data.capper
        setPickMode(capper.pick_mode || 'auto')
        setExcludedTeams(capper.excluded_teams || [])

        // Load factor config
        if (capper.factor_config) {
          const totalConfig = capper.factor_config.TOTAL || {}
          const spreadConfig = capper.factor_config.SPREAD || {}

          setEnabledFactors({
            TOTAL: totalConfig.enabled_factors || [],
            SPREAD: spreadConfig.enabled_factors || []
          })
          setFactorWeights({
            TOTAL: totalConfig.weights || {},
            SPREAD: spreadConfig.weights || {}
          })

          // Load baseline models
          if (totalConfig.baseline_model) {
            setSelectedTotalsModel(totalConfig.baseline_model as TotalsBaselineModel)
          }
          if (spreadConfig.baseline_model) {
            setSelectedSpreadModel(spreadConfig.baseline_model as SpreadBaselineModel)
          }
        }

        // Try to match archetypes
        const matchArchetype = (factors: string[], weights: Record<string, number>, archetypes: PresetConfig[], betType: 'TOTAL' | 'SPREAD') => {
          for (const arch of archetypes) {
            const archFactors = betType === 'TOTAL' ? arch.totalFactors : arch.spreadFactors
            if (JSON.stringify(archFactors.enabled.sort()) === JSON.stringify(factors.sort()) &&
              JSON.stringify(archFactors.weights) === JSON.stringify(weights)) {
              return arch.id
            }
          }
          return null
        }

        const totalMatch = matchArchetype(
          capper.factor_config?.TOTAL?.enabled_factors || [],
          capper.factor_config?.TOTAL?.weights || {},
          TOTALS_ARCHETYPES,
          'TOTAL'
        )
        const spreadMatch = matchArchetype(
          capper.factor_config?.SPREAD?.enabled_factors || [],
          capper.factor_config?.SPREAD?.weights || {},
          SPREAD_ARCHETYPES,
          'SPREAD'
        )

        setSelectedPresets({
          TOTAL: totalMatch,
          SPREAD: spreadMatch
        })

      } catch (err) {
        console.error('Error loading capper:', err)
        setError('Failed to load your capper settings')
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      loadCapperData()
    }
  }, [user, authLoading, router])

  // Handle archetype selection
  const handlePresetSelect = useCallback((presetId: string, betType: 'TOTAL' | 'SPREAD') => {
    const archetypes = betType === 'TOTAL' ? TOTALS_ARCHETYPES : SPREAD_ARCHETYPES
    const preset = archetypes.find(p => p.id === presetId)
    if (!preset) return

    setSelectedPresets(prev => ({ ...prev, [betType]: presetId }))

    const factors = betType === 'TOTAL' ? preset.totalFactors : preset.spreadFactors
    setEnabledFactors(prev => ({ ...prev, [betType]: factors.enabled }))
    setFactorWeights(prev => ({ ...prev, [betType]: factors.weights }))
  }, [])

  // Handle save
  const handleSave = async () => {
    if (!capperData) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/user-cappers/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capper_id: capperData.capper_id,
          pick_mode: pickMode,
          excluded_teams: excludedTeams,
          factor_config: {
            TOTAL: {
              enabled_factors: enabledFactors.TOTAL,
              weights: factorWeights.TOTAL,
              baseline_model: selectedTotalsModel
            },
            SPREAD: {
              enabled_factors: enabledFactors.SPREAD,
              weights: factorWeights.SPREAD,
              baseline_model: selectedSpreadModel
            }
          }
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      toast({
        title: 'Settings Saved!',
        description: 'Your pick settings have been updated.',
      })

    } catch (err: any) {
      setError(err.message)
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get current archetype info
  const currentTotalsArchetype = TOTALS_ARCHETYPES.find(a => a.id === selectedPresets.TOTAL)
  const currentSpreadArchetype = SPREAD_ARCHETYPES.find(a => a.id === selectedPresets.SPREAD)
  const totalsModelInfo = TOTALS_BASELINE_MODELS[selectedTotalsModel]
  const spreadModelInfo = SPREAD_BASELINE_MODELS[selectedSpreadModel]

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading your settings...</p>
        </div>
      </div>
    )
  }

  // Not a capper
  if (!profile || profile.role !== 'capper') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Not a Capper</h1>
          <p className="text-slate-400 mb-6">You need to create a capper first to access settings.</p>
          <Link href="/cappers/create">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-500">
              Create Your Capper
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/capper">
                <Button variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-white">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                  Pick Settings
                </h1>
                <p className="text-sm text-slate-400">
                  Editing: <span className="text-cyan-400 font-semibold">{capperData?.display_name}</span>
                </p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Preview */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4">Current Configuration</h3>

              {/* Avatar Preview */}
              <div className="flex justify-center mb-6">
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-3xl font-bold ${totalsModelInfo?.borderStyle || ''}`}
                >
                  {capperData?.display_name?.charAt(0).toUpperCase() || '?'}
                </div>
              </div>

              {/* Archetypes */}
              <div className="space-y-3 mb-6">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">TOTALS Archetype</p>
                  <p className="text-white font-medium">{currentTotalsArchetype?.name || 'Custom'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">SPREAD Archetype</p>
                  <p className="text-white font-medium">{currentSpreadArchetype?.name || 'Custom'}</p>
                </div>
              </div>

              {/* Baseline Models */}
              <div className="space-y-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">TOTALS Model</p>
                  <div className="flex items-center gap-2">
                    <BaselineIcon iconName={totalsModelInfo?.iconName || 'Zap'} className="w-4 h-4 text-cyan-400" />
                    <p className="text-white font-medium">{totalsModelInfo?.name}</p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">SPREAD Model</p>
                  <div className="flex items-center gap-2">
                    <BaselineIcon iconName={spreadModelInfo?.iconName || 'TrendingUp'} className="w-4 h-4 text-purple-400" />
                    <p className="text-white font-medium">{spreadModelInfo?.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Settings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-4">
              <button
                onClick={() => setActiveTab('archetype')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'archetype'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Archetypes & Models
              </button>
              <button
                onClick={() => setActiveTab('options')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'options'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                Options
              </button>
            </div>

            {/* Archetype Tab */}
            {activeTab === 'archetype' && (
              <div className="space-y-8">
                {/* Bet Type Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setArchetypeBetType('TOTAL')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${archetypeBetType === 'TOTAL'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    TOTALS
                  </button>
                  <button
                    onClick={() => setArchetypeBetType('SPREAD')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${archetypeBetType === 'SPREAD'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    SPREAD
                  </button>
                </div>

                {/* Archetypes Grid */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">
                    {archetypeBetType === 'TOTAL' ? 'TOTALS' : 'SPREAD'} Archetypes
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(archetypeBetType === 'TOTAL' ? TOTALS_ARCHETYPES : SPREAD_ARCHETYPES).map((preset) => {
                      const Icon = preset.icon
                      const isSelected = selectedPresets[archetypeBetType] === preset.id
                      return (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetSelect(preset.id, archetypeBetType)}
                          className={`p-4 rounded-xl border transition-all text-left ${isSelected
                            ? `bg-${preset.color}-500/20 border-${preset.color}-500/50 ring-2 ring-${preset.color}-500/30`
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            }`}
                        >
                          <Icon className={`w-6 h-6 mb-2 ${isSelected ? `text-${preset.color}-400` : 'text-slate-400'}`} />
                          <p className={`font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{preset.name}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{preset.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Baseline Models */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Prediction Brain</h3>
                  <p className="text-sm text-slate-400 mb-4">Choose how your capper calculates baseline predictions</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* TOTALS Models */}
                    <div>
                      <p className="text-sm font-medium text-green-400 mb-3">TOTALS Model</p>
                      <div className="space-y-2">
                        {(Object.entries(TOTALS_BASELINE_MODELS) as [TotalsBaselineModel, BaselineModelInfo][]).map(([key, model]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedTotalsModel(key)}
                            className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${selectedTotalsModel === key
                              ? 'bg-green-500/20 border-green-500/50'
                              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                              }`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedTotalsModel === key ? 'bg-green-500/30' : 'bg-slate-700'
                              }`}>
                              <BaselineIcon iconName={model.iconName} className={`w-5 h-5 ${selectedTotalsModel === key ? 'text-green-400' : 'text-slate-400'}`} />
                            </div>
                            <div className="text-left">
                              <p className={`font-medium ${selectedTotalsModel === key ? 'text-white' : 'text-slate-300'}`}>{model.name}</p>
                              <p className="text-xs text-slate-500">{model.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SPREAD Models */}
                    <div>
                      <p className="text-sm font-medium text-purple-400 mb-3">SPREAD Model</p>
                      <div className="space-y-2">
                        {(Object.entries(SPREAD_BASELINE_MODELS) as [SpreadBaselineModel, BaselineModelInfo][]).map(([key, model]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedSpreadModel(key)}
                            className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${selectedSpreadModel === key
                              ? 'bg-purple-500/20 border-purple-500/50'
                              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                              }`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedSpreadModel === key ? 'bg-purple-500/30' : 'bg-slate-700'
                              }`}>
                              <BaselineIcon iconName={model.iconName} className={`w-5 h-5 ${selectedSpreadModel === key ? 'text-purple-400' : 'text-slate-400'}`} />
                            </div>
                            <div className="text-left">
                              <p className={`font-medium ${selectedSpreadModel === key ? 'text-white' : 'text-slate-300'}`}>{model.name}</p>
                              <p className="text-xs text-slate-500">{model.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Options Tab */}
            {activeTab === 'options' && (
              <div className="space-y-8">
                {/* Pick Mode */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Pick Mode</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(['auto', 'manual', 'hybrid'] as PickMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPickMode(mode)}
                        className={`p-4 rounded-xl border transition-all ${pickMode === mode
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                          }`}
                      >
                        <p className={`font-medium capitalize ${pickMode === mode ? 'text-white' : 'text-slate-300'}`}>{mode}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {mode === 'auto' && 'Picks generated automatically'}
                          {mode === 'manual' && 'You approve each pick'}
                          {mode === 'hybrid' && 'Auto with manual override'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Excluded Teams */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Excluded Teams</h3>
                  <p className="text-sm text-slate-400 mb-4">Select teams you want to avoid betting on</p>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {NBA_TEAMS.map((team) => (
                      <button
                        key={team}
                        onClick={() => {
                          setExcludedTeams(prev =>
                            prev.includes(team)
                              ? prev.filter(t => t !== team)
                              : [...prev, team]
                          )
                        }}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all ${excludedTeams.includes(team)
                          ? 'bg-red-500/20 border-red-500/50 text-red-400'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                      >
                        {team}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

