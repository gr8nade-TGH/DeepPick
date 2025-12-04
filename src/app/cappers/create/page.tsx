'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sparkles, Zap, Hand, Ban, Gauge, TrendingUp, Target, Home, Battery, BarChart3, Shield, Trophy, Flame, UserX, Anchor, Scale, Rocket, Castle, TrendingDown, Loader2, AlertCircle, Swords, Crown, Star, ChevronRight, Pencil, Check, X, ChevronDown, Activity, Crosshair, Repeat, RotateCcw, MapPin, Award, Shuffle, HelpCircle, AlertTriangle, Waves, Eye, Snowflake, Bomb, LineChart, Mountain, Skull, Compass, Wind, Clock, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCallback } from 'react'

type ConfigTab = 'archetype' | 'options'

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

interface CapperConfig {
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
    }
  }
  execution_interval_minutes: number
  execution_priority: number
}

// ============================================
// FACTOR_DETAILS - Using CORRECT SHIVA factor keys
// TOTALS: paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability, restAdvantage
// SPREAD: netRatingDiff, turnoverDiff, shootingEfficiencyMomentum, reboundingDiff, fourFactorsDiff, injuryAvailability, momentumIndex, defensivePressure, assistEfficiency
// ============================================
const FACTOR_DETAILS: Record<string, { name: string; icon: any; description: string; importance: string; example: string; defaultWeight: number; color: string }> = {
  // === TOTALS FACTORS ===
  paceIndex: {
    name: 'Pace Index',
    icon: Gauge,
    description: 'Expected game pace based on both teams\' recent pace (last 10 games)',
    importance: 'Fast-paced games produce higher totals; slow-paced games produce lower totals.',
    example: 'High pace game (+12 possessions vs league avg) → Strong Over signal.',
    defaultWeight: 20,
    color: 'cyan'
  },
  offForm: {
    name: 'Offensive Form',
    icon: TrendingUp,
    description: 'Recent offensive efficiency and scoring trends',
    importance: 'Elite offenses vs weak defenses create higher scoring games.',
    example: 'Strong offense (+8 net rating) vs weak defense → Strong Over signal.',
    defaultWeight: 20,
    color: 'green'
  },
  defErosion: {
    name: 'Defensive Erosion',
    icon: Shield,
    description: 'Defensive performance degradation due to fatigue or injuries',
    importance: 'Eroded defenses allow more points; strong defenses limit scoring.',
    example: 'Team allowing +6 PPG more than season avg → Strong Over lean.',
    defaultWeight: 20,
    color: 'red'
  },
  threeEnv: {
    name: '3-Point Environment',
    icon: Target,
    description: '3PT% trends and shooting volume environment',
    importance: 'Hot shooting teams score more points; cold shooting teams score fewer.',
    example: 'Team shooting 40% from 3PT (vs 35% avg) → +2.5 points per game.',
    defaultWeight: 20,
    color: 'orange'
  },
  whistleEnv: {
    name: 'Whistle Environment',
    icon: Activity,
    description: 'Free throw rate and foul tendencies impact on scoring',
    importance: 'High foul rate games produce more free throws and higher totals.',
    example: 'Both teams in top 10 FT rate → Game likely to go Over.',
    defaultWeight: 20,
    color: 'yellow'
  },
  injuryAvailability: {
    name: 'Injury Availability',
    icon: UserX,
    description: 'Impact of injured players on game outcome',
    importance: 'Missing key players significantly impacts scoring and competitive balance.',
    example: 'Star player (30 PPG) OUT → 4.5 point impact on total.',
    defaultWeight: 20,
    color: 'purple'
  },
  restAdvantage: {
    name: 'Rest Advantage',
    icon: Clock,
    description: 'Rest differential between teams. Back-to-backs cause fatigue.',
    importance: 'Fatigued teams score less efficiently; well-rested teams score more.',
    example: 'Both teams on B2B → Strong Under signal due to fatigue.',
    defaultWeight: 15,
    color: 'slate'
  },
  defStrength: {
    name: 'Defensive Strength',
    icon: Shield,
    description: 'UNDER-biased: Strong combined defense = fewer points allowed.',
    importance: 'Elite defenses limit scoring. Both teams with strong D = low-scoring game.',
    example: 'Both teams DRtg < 108 (top 10 defense) → Strong Under signal.',
    defaultWeight: 20,
    color: 'teal'
  },
  coldShooting: {
    name: 'Cold Shooting',
    icon: Snowflake,
    description: 'UNDER-biased: Teams in shooting slumps score fewer points.',
    importance: 'Cold shooting streaks are real. Teams below league avg 3P% = fewer points.',
    example: 'Both teams shooting 32% from 3 (vs 35% avg) → Strong Under signal.',
    defaultWeight: 20,
    color: 'sky'
  },
  // === SPREAD FACTORS ===
  netRatingDiff: {
    name: 'Net Rating Differential',
    icon: BarChart3,
    description: 'Difference in overall team quality (offense + defense ratings)',
    importance: 'Better teams by net rating tend to cover spreads.',
    example: 'Team A: +8 NetRtg vs Team B: -3 NetRtg → Team A strong ATS.',
    defaultWeight: 25,
    color: 'indigo'
  },
  turnoverDiff: {
    name: 'Turnover Differential',
    icon: Shuffle,
    description: 'Ball security and forcing turnovers differential',
    importance: 'Teams that protect the ball and force turnovers create extra possessions.',
    example: '+3 turnover differential → Extra 6+ points of offense.',
    defaultWeight: 20,
    color: 'emerald'
  },
  shootingEfficiencyMomentum: {
    name: 'Shooting Momentum',
    icon: Flame,
    description: 'Recent shooting efficiency trends and hot/cold streaks',
    importance: 'Teams on hot ATS streaks tend to continue covering spreads.',
    example: 'Team shooting +5% above season avg last 5 games → Strong cover signal.',
    defaultWeight: 25,
    color: 'red'
  },
  reboundingDiff: {
    name: 'Rebounding Differential',
    icon: Activity,
    description: 'Board control advantage - offensive and defensive rebounding',
    importance: 'Offensive rebounds = second chance points. DREB ends opponent possessions.',
    example: '+5 total rebounding advantage → Extra possessions → ATS edge.',
    defaultWeight: 20,
    color: 'purple'
  },
  defensivePressure: {
    name: 'Defensive Pressure',
    icon: Shield,
    description: 'Defensive disruption through steals and blocks',
    importance: 'High pressure defense creates transition opportunities.',
    example: 'Team with +2 steals/game → Transition points → Cover potential.',
    defaultWeight: 15,
    color: 'teal'
  },
  assistEfficiency: {
    name: 'Assist Efficiency',
    icon: Users,
    description: 'Ball movement quality and team chemistry (AST/TOV ratio)',
    importance: 'High AST/TOV ratio = smart decisions = better shots.',
    example: 'Team with 2.0 AST/TOV vs 1.5 → Better offense → ATS value.',
    defaultWeight: 15,
    color: 'sky'
  },
  fourFactorsDiff: {
    name: 'Four Factors Differential',
    icon: Trophy,
    description: 'Dean Oliver\'s Four Factors matchup analysis (eFG%, TOV%, ORB%, FTr)',
    importance: 'Four factors predict winning better than raw scoring.',
    example: 'Winning 3/4 factors → High probability of covering spread.',
    defaultWeight: 25,
    color: 'amber'
  },
  momentumIndex: {
    name: 'Momentum Index',
    icon: TrendingUp,
    description: 'Team momentum based on win streak and last 10 record',
    importance: 'Hot teams tend to cover spreads; cold teams tend to fail.',
    example: 'Team on 5-game win streak (8-2 L10) → Strong ATS signal.',
    defaultWeight: 15,
    color: 'green'
  }
}

// Available factors for each bet type - USING CORRECT SHIVA KEYS
const AVAILABLE_FACTORS = {
  TOTAL: ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability', 'restAdvantage', 'defStrength', 'coldShooting'],
  SPREAD: ['netRatingDiff', 'turnoverDiff', 'shootingEfficiencyMomentum', 'reboundingDiff', 'fourFactorsDiff', 'injuryAvailability', 'momentumIndex', 'defensivePressure', 'assistEfficiency']
}

// Factor groups for organized display - USING CORRECT SHIVA KEYS
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
// TOTALS ARCHETYPES - Designed for O/U betting
// Key differentiators: pace vs efficiency vs situational
// Valid factors: paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability
// ============================================
// ============================================
// TOTALS ARCHETYPES - All weights MUST sum to 250%
// Available factors: paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability
// ============================================
const TOTALS_ARCHETYPES: PresetConfig[] = [
  {
    id: 'pace-prophet',
    name: 'The Pace Prophet',
    description: 'Game tempo is everything. Fast pace = points.',
    icon: Rocket,
    color: 'cyan',
    philosophy: 'Pace is the #1 predictor of totals. Fast-paced games create more possessions = more points. Volume beats variance.',
    totalFactors: {
      // Primary: paceIndex (80), Strong: offForm (60) + threeEnv (50), Support: defErosion (40) + whistleEnv (20) = 250
      enabled: ['paceIndex', 'offForm', 'threeEnv', 'defErosion', 'whistleEnv'],
      weights: { paceIndex: 80, offForm: 60, threeEnv: 50, defErosion: 40, whistleEnv: 20 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'efficiency-expert',
    name: 'The Efficiency Expert',
    description: 'Quality over quantity. Elite offense + weak defense = points.',
    icon: BarChart3,
    color: 'green',
    philosophy: 'Offensive and defensive ratings tell the real story. A +10 offense vs -8 defense is a goldmine regardless of pace.',
    totalFactors: {
      // Primary: offForm (70) + defErosion (60), Strong: injury (50) + pace (40), Support: threeEnv (30) = 250
      enabled: ['offForm', 'defErosion', 'injuryAvailability', 'paceIndex', 'threeEnv'],
      weights: { offForm: 70, defErosion: 60, injuryAvailability: 50, paceIndex: 40, threeEnv: 30 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'hot-hand-hunter',
    name: 'The Hot Hand Hunter',
    description: 'Ride the streaks. Hot shooting = easy overs.',
    icon: Flame,
    color: 'orange',
    philosophy: 'Shooting streaks are real. Teams hitting 40%+ from 3 don\'t cool off overnight. Chase the heat, fade the cold.',
    totalFactors: {
      // Primary: threeEnv (80), Strong: offForm (60) + paceIndex (50), Support: whistleEnv (40) + defErosion (20) = 250
      enabled: ['threeEnv', 'offForm', 'paceIndex', 'whistleEnv', 'defErosion'],
      weights: { threeEnv: 80, offForm: 60, paceIndex: 50, whistleEnv: 40, defErosion: 20 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'free-throw-fiend',
    name: 'The Whistle Hunter',
    description: 'Refs run the game. Free throws decide totals.',
    icon: AlertTriangle,
    color: 'yellow',
    philosophy: 'Free throws are free points. High-foul games inflate totals. Aggressive drivers + whistle-happy refs = easy overs.',
    totalFactors: {
      // Primary: whistleEnv (90), Strong: offForm (60) + defErosion (50), Support: paceIndex (30) + injury (20) = 250
      enabled: ['whistleEnv', 'offForm', 'defErosion', 'paceIndex', 'injuryAvailability'],
      weights: { whistleEnv: 90, offForm: 60, defErosion: 50, paceIndex: 30, injuryAvailability: 20 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'totals-balanced',
    name: 'The Sharp Scholar',
    description: 'Trust the math. Every factor has value.',
    icon: Scale,
    color: 'slate',
    philosophy: 'No single factor dominates. Balanced weighting across all variables produces consistent, grindable edge over the long run.',
    totalFactors: {
      // Balanced: 50% each across 5 factors = 250
      enabled: ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'],
      weights: { paceIndex: 50, offForm: 50, defErosion: 50, threeEnv: 50, whistleEnv: 50 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'the-fade',
    name: 'The Fade Artist',
    description: 'Bet against the cold. Fade the strugglers.',
    icon: TrendingDown,
    color: 'blue',
    philosophy: 'Defense tells the truth. Teams with eroding D and declining offense are bleeding points. Fade them into oblivion.',
    totalFactors: {
      // Primary: defErosion (80), Strong: offForm (60) + injury (50), Support: whistleEnv (40) + paceIndex (20) = 250
      enabled: ['defErosion', 'offForm', 'injuryAvailability', 'whistleEnv', 'paceIndex'],
      weights: { defErosion: 80, offForm: 60, injuryAvailability: 50, whistleEnv: 40, paceIndex: 20 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'tempo-tyrant',
    name: 'The Tempo Tyrant',
    description: 'Control the clock. Slow games = unders.',
    icon: Snowflake,
    color: 'sky',
    philosophy: 'Pace and defense together reveal the grind-it-out games. Low possessions + strong defense = under city. Trust the tempo.',
    totalFactors: {
      // Primary: paceIndex (90) + defErosion (70), Strong: offForm (50), Support: threeEnv (25) + whistleEnv (15) = 250
      enabled: ['paceIndex', 'defErosion', 'offForm', 'threeEnv', 'whistleEnv'],
      weights: { paceIndex: 90, defErosion: 70, offForm: 50, threeEnv: 25, whistleEnv: 15 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'injury-assassin',
    name: 'The Injury Assassin',
    description: 'Missing stars change everything.',
    icon: Skull,
    color: 'rose',
    philosophy: 'When key players sit, scoring collapses or explodes. Injuries + defensive context = totals gold. The market adjusts too slowly.',
    totalFactors: {
      // Primary: injury (80), Strong: defErosion (60) + offForm (50), Support: paceIndex (40) + whistleEnv (20) = 250
      enabled: ['injuryAvailability', 'defErosion', 'offForm', 'paceIndex', 'whistleEnv'],
      weights: { injuryAvailability: 80, defErosion: 60, offForm: 50, paceIndex: 40, whistleEnv: 20 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'the-locksmith',
    name: 'The Locksmith',
    description: 'UNDER specialist. Defense wins and limits scoring.',
    icon: Shield,
    color: 'teal',
    philosophy: 'Elite defenses create low-scoring games. When both teams play strong D, the total stays under. Lock it down.',
    totalFactors: {
      // UNDER-FOCUSED: defStrength (80) + coldShooting (70) + injury (50) + paceIndex (30) + restAdvantage (20) = 250
      enabled: ['defStrength', 'coldShooting', 'injuryAvailability', 'paceIndex', 'restAdvantage'],
      weights: { defStrength: 80, coldShooting: 70, injuryAvailability: 50, paceIndex: 30, restAdvantage: 20 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'the-grinder',
    name: 'The Grinder',
    description: 'Slow games, ugly games, UNDER games.',
    icon: Snowflake,
    color: 'sky',
    philosophy: 'Pace is king for unders. Slow teams + cold shooting + fatigue = grinding, low-scoring affairs. Embrace the ugly.',
    totalFactors: {
      // UNDER-FOCUSED: paceIndex (70) + coldShooting (60) + defStrength (50) + restAdvantage (40) + injury (30) = 250
      enabled: ['paceIndex', 'coldShooting', 'defStrength', 'restAdvantage', 'injuryAvailability'],
      weights: { paceIndex: 70, coldShooting: 60, defStrength: 50, restAdvantage: 40, injuryAvailability: 30 }
    },
    spreadFactors: { enabled: [], weights: {} }
  }
]

// ============================================
// SPREAD ARCHETYPES - All weights MUST sum to 250%
// Available factors: netRatingDiff, turnoverDiff, shootingEfficiencyMomentum, reboundingDiff, fourFactorsDiff, injuryAvailability, momentumIndex, defensivePressure, assistEfficiency, clutchShooting, scoringMargin, perimeterDefense
// ============================================
const SPREAD_ARCHETYPES: PresetConfig[] = [
  {
    id: 'hot-hand',
    name: 'The Hot Hand',
    description: 'Shooting streaks are real. Ride the hot teams.',
    icon: TrendingUp,
    color: 'red',
    philosophy: 'Recent shooting momentum predicts near-term performance. Teams shooting hot carry that confidence. Fade cold shooters.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: shooting (80), Strong: netRating (60) + rebounding (50), Support: fourFactors (40) + turnover (20) = 250
      enabled: ['shootingEfficiencyMomentum', 'netRatingDiff', 'reboundingDiff', 'fourFactorsDiff', 'turnoverDiff'],
      weights: { shootingEfficiencyMomentum: 80, netRatingDiff: 60, reboundingDiff: 50, fourFactorsDiff: 40, turnoverDiff: 20 }
    }
  },
  {
    id: 'matchup-master',
    name: 'The Matchup Master',
    description: 'It\'s all about the matchup. Offense vs defense.',
    icon: Swords,
    color: 'indigo',
    philosophy: 'Ignore records, focus on how teams match up. Elite offense vs weak defense = cover. Four factors reveal the truth.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: fourFactors (70), Strong: rebounding (60) + netRating (50), Support: shooting (40) + injury (30) = 250
      enabled: ['fourFactorsDiff', 'reboundingDiff', 'netRatingDiff', 'shootingEfficiencyMomentum', 'injuryAvailability'],
      weights: { fourFactorsDiff: 70, reboundingDiff: 60, netRatingDiff: 50, shootingEfficiencyMomentum: 40, injuryAvailability: 30 }
    }
  },
  {
    id: 'disruptor',
    name: 'The Disruptor',
    description: 'Chaos wins. Force turnovers, control the game.',
    icon: Shuffle,
    color: 'emerald',
    philosophy: 'Turnovers are the great equalizer. Teams that force chaos and protect the rock control destiny. Discipline beats talent.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: turnover (70) + defensivePressure (50), Strong: fourFactors (50) + netRating (40), Support: rebounding (40) = 250
      enabled: ['turnoverDiff', 'defensivePressure', 'fourFactorsDiff', 'netRatingDiff', 'reboundingDiff'],
      weights: { turnoverDiff: 70, defensivePressure: 50, fourFactorsDiff: 50, netRatingDiff: 40, reboundingDiff: 40 }
    }
  },
  {
    id: 'closer',
    name: 'The Closer',
    description: 'Net rating and efficiency win close games.',
    icon: Trophy,
    color: 'amber',
    philosophy: 'Games are won by the better team. Net rating differential determines who closes. Trust the fundamentals over narratives.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: netRating (75), Strong: shooting (55) + turnover (50), Support: rebounding (40) + fourFactors (30) = 250
      enabled: ['netRatingDiff', 'shootingEfficiencyMomentum', 'turnoverDiff', 'reboundingDiff', 'fourFactorsDiff'],
      weights: { netRatingDiff: 75, shootingEfficiencyMomentum: 55, turnoverDiff: 50, reboundingDiff: 40, fourFactorsDiff: 30 }
    }
  },
  {
    id: 'injury-hawk',
    name: 'The Injury Hawk',
    description: 'Lines move slow. Injuries create value.',
    icon: UserX,
    color: 'purple',
    philosophy: 'Vegas adjusts lines, but not enough. A star out = 4-7 point swing. Beat the book before lines fully adjust.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: injury (80), Strong: fourFactors (60) + rebounding (50), Support: netRating (40) + turnover (20) = 250
      enabled: ['injuryAvailability', 'fourFactorsDiff', 'reboundingDiff', 'netRatingDiff', 'turnoverDiff'],
      weights: { injuryAvailability: 80, fourFactorsDiff: 60, reboundingDiff: 50, netRatingDiff: 40, turnoverDiff: 20 }
    }
  },
  {
    id: 'board-bully',
    name: 'The Board Bully',
    description: 'Control the glass, control the game.',
    icon: Activity,
    color: 'teal',
    philosophy: 'Rebounding is the most underrated factor. Offensive boards = 2nd chances. Defensive boards = end possessions. Board control wins ATS.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: rebounding (85), Strong: turnover (55) + fourFactors (50), Support: netRating (40) + shooting (20) = 250
      enabled: ['reboundingDiff', 'turnoverDiff', 'fourFactorsDiff', 'netRatingDiff', 'shootingEfficiencyMomentum'],
      weights: { reboundingDiff: 85, turnoverDiff: 55, fourFactorsDiff: 50, netRatingDiff: 40, shootingEfficiencyMomentum: 20 }
    }
  },
  {
    id: 'cold-blooded',
    name: 'The Cold Blooded',
    description: 'Fade the hype. Trust fundamentals over narratives.',
    icon: Eye,
    color: 'gray',
    philosophy: 'Ignore the noise. Net rating + four factors = truth. Public chases hot teams, sharps trust the math.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: netRating (80) + fourFactors (70), Strong: injury (50), Support: turnover (30) + rebounding (20) = 250
      enabled: ['netRatingDiff', 'fourFactorsDiff', 'injuryAvailability', 'turnoverDiff', 'reboundingDiff'],
      weights: { netRatingDiff: 80, fourFactorsDiff: 70, injuryAvailability: 50, turnoverDiff: 30, reboundingDiff: 20 }
    }
  },
  {
    id: 'the-grinder',
    name: 'The Grinder',
    description: 'Discipline wins. Low turnover teams cover.',
    icon: Mountain,
    color: 'stone',
    philosophy: 'Ball security + efficient shooting = covering spreads. Grind it out teams frustrate opponents and cover.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: turnover (75), Strong: shooting (60) + netRating (50), Support: fourFactors (40) + rebounding (25) = 250
      enabled: ['turnoverDiff', 'shootingEfficiencyMomentum', 'netRatingDiff', 'fourFactorsDiff', 'reboundingDiff'],
      weights: { turnoverDiff: 75, shootingEfficiencyMomentum: 60, netRatingDiff: 50, fourFactorsDiff: 40, reboundingDiff: 25 }
    }
  },
  {
    id: 'ball-mover',
    name: 'The Ball Mover',
    description: 'Unselfish teams with great chemistry cover.',
    icon: Users,
    color: 'sky',
    philosophy: 'High AST/TOV ratio = smart decisions = quality shots. ISO-heavy teams fade under pressure. Trust the system.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: assistEfficiency (75), Strong: turnover (55) + fourFactors (50), Support: netRating (40) + rebounding (30) = 250
      enabled: ['assistEfficiency', 'turnoverDiff', 'fourFactorsDiff', 'netRatingDiff', 'reboundingDiff'],
      weights: { assistEfficiency: 75, turnoverDiff: 55, fourFactorsDiff: 50, netRatingDiff: 40, reboundingDiff: 30 }
    }
  },
  {
    id: 'ice-veins',
    name: 'Ice Veins',
    description: 'Clutch shooting wins close games. Nerves of steel.',
    icon: Target,
    color: 'cyan',
    philosophy: 'When the game is on the line, FT% and FG% are everything. Teams that execute under pressure close out games and cover spreads.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: clutchShooting (80), Strong: scoringMargin (55) + netRating (50), Support: fourFactors (40) + turnover (25) = 250
      enabled: ['clutchShooting', 'scoringMargin', 'netRatingDiff', 'fourFactorsDiff', 'turnoverDiff'],
      weights: { clutchShooting: 80, scoringMargin: 55, netRatingDiff: 50, fourFactorsDiff: 40, turnoverDiff: 25 }
    }
  },
  {
    id: 'lockdown',
    name: 'The Lockdown',
    description: 'Defense travels. Elite perimeter D = spreads covered.',
    icon: Shield,
    color: 'violet',
    philosophy: 'Great 3PT defense wins in the modern NBA. Teams that contest shots and limit opponent FG% control the game tempo and cover.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: perimeterDefense (80), Strong: defensivePressure (55) + fourFactors (50), Support: turnover (40) + netRating (25) = 250
      enabled: ['perimeterDefense', 'defensivePressure', 'fourFactorsDiff', 'turnoverDiff', 'netRatingDiff'],
      weights: { perimeterDefense: 80, defensivePressure: 55, fourFactorsDiff: 50, turnoverDiff: 40, netRatingDiff: 25 }
    }
  },
  {
    id: 'point-machine',
    name: 'The Point Machine',
    description: 'Outscore everyone. Scoring margin is destiny.',
    icon: Flame,
    color: 'orange',
    philosophy: 'Simple math: teams that consistently outscore opponents cover spreads. Raw PPG differential reveals true team quality.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      // Primary: scoringMargin (85), Strong: clutchShooting (55) + netRating (50), Support: fourFactors (35) + turnover (25) = 250
      enabled: ['scoringMargin', 'clutchShooting', 'netRatingDiff', 'fourFactorsDiff', 'turnoverDiff'],
      weights: { scoringMargin: 85, clutchShooting: 55, netRatingDiff: 50, fourFactorsDiff: 35, turnoverDiff: 25 }
    }
  }
]

// Combined for backwards compatibility where needed
const PRESET_CONFIGS: PresetConfig[] = [...TOTALS_ARCHETYPES, ...SPREAD_ARCHETYPES]

const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
]

export default function CreateCapperPage() {
  const router = useRouter()
  const { profile, loading: authLoading, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<ConfigTab>('archetype')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Archetype per bet type - allows different archetypes for TOTAL vs SPREAD
  const [selectedPresets, setSelectedPresets] = useState<{ TOTAL: string | null; SPREAD: string | null }>({
    TOTAL: null,
    SPREAD: null
  })
  const [archetypeBetType, setArchetypeBetType] = useState<'TOTAL' | 'SPREAD'>('TOTAL')
  const [factorBetType, setFactorBetType] = useState<'TOTAL' | 'SPREAD'>('TOTAL')

  // For backwards compatibility
  const selectedPreset = selectedPresets[archetypeBetType]
  const activeBetType = factorBetType

  // Factor category filter - 'all' shows all factors (default for archetype animation)
  const [factorCategoryFilter, setFactorCategoryFilter] = useState<string>('all')

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [isCheckingName, setIsCheckingName] = useState(false)

  // Default config uses Sharp Scholar (TOTALS) + Matchup Master (SPREAD) - balanced approach
  // Valid TOTALS: paceIndex, offForm, defErosion, threeEnv, whistleEnv, injuryAvailability, restAdvantage
  // Valid SPREAD: netRatingDiff, turnoverDiff, shootingEfficiencyMomentum, reboundingDiff, fourFactorsDiff, injuryAvailability, momentumIndex, defensivePressure, assistEfficiency
  const [config, setConfig] = useState<CapperConfig>({
    capper_id: '',
    display_name: '',
    description: '',
    color_theme: 'blue',
    sport: 'NBA',
    bet_types: ['TOTAL', 'SPREAD'],
    pick_mode: 'hybrid',
    excluded_teams: [],
    factor_config: {
      TOTAL: {
        enabled_factors: ['paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv'],
        weights: { paceIndex: 20, offForm: 20, defErosion: 20, threeEnv: 20, whistleEnv: 20 }
      },
      SPREAD: {
        enabled_factors: ['fourFactorsDiff', 'reboundingDiff', 'netRatingDiff', 'shootingEfficiencyMomentum'],
        weights: { fourFactorsDiff: 25, reboundingDiff: 25, netRatingDiff: 25, shootingEfficiencyMomentum: 25 }
      }
    },
    execution_interval_minutes: 15,
    execution_priority: 5
  })

  // Auto-populate display name from user profile
  useEffect(() => {
    if (profile && !config.display_name) {
      const displayName = profile.full_name || profile.username || profile.email?.split('@')[0] || 'User'
      const capperId = displayName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30)
      setConfig(prev => ({ ...prev, display_name: displayName, capper_id: capperId }))
    }
  }, [profile])

  // Randomly select 2 archetypes on page load (1 TOTAL, 1 SPREAD) and apply their factors
  useEffect(() => {
    // Pick random TOTAL archetype
    const randomTotalIndex = Math.floor(Math.random() * TOTALS_ARCHETYPES.length)
    const randomTotalArchetype = TOTALS_ARCHETYPES[randomTotalIndex]

    // Pick random SPREAD archetype
    const randomSpreadIndex = Math.floor(Math.random() * SPREAD_ARCHETYPES.length)
    const randomSpreadArchetype = SPREAD_ARCHETYPES[randomSpreadIndex]

    // Set selected presets
    setSelectedPresets({
      TOTAL: randomTotalArchetype.id,
      SPREAD: randomSpreadArchetype.id
    })

    // Apply their factor configurations
    setConfig(prev => ({
      ...prev,
      factor_config: {
        TOTAL: {
          enabled_factors: randomTotalArchetype.totalFactors.enabled,
          weights: randomTotalArchetype.totalFactors.weights
        },
        SPREAD: {
          enabled_factors: randomSpreadArchetype.spreadFactors.enabled,
          weights: randomSpreadArchetype.spreadFactors.weights
        }
      }
    }))
  }, []) // Empty dependency array = runs once on mount

  const updateConfig = (updates: Partial<CapperConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  // Check if a capper name already exists
  const checkNameExists = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false
    try {
      const response = await fetch(`/api/cappers/check-name?name=${encodeURIComponent(name.trim())}`)
      const data = await response.json()
      return data.exists === true
    } catch {
      return false // Assume it doesn't exist if check fails
    }
  }, [])

  // Handle name edit start
  const startEditingName = () => {
    setTempName(config.display_name)
    setNameError(null)
    setIsEditingName(true)
  }

  // Handle name save
  const saveNameEdit = async () => {
    const trimmedName = tempName.trim()

    if (!trimmedName) {
      setNameError('Name is required')
      return
    }

    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters')
      return
    }

    if (trimmedName.length > 30) {
      setNameError('Name must be 30 characters or less')
      return
    }

    // Check if name is unchanged
    if (trimmedName === config.display_name) {
      setIsEditingName(false)
      return
    }

    setIsCheckingName(true)
    const exists = await checkNameExists(trimmedName)
    setIsCheckingName(false)

    if (exists) {
      setNameError('This name is already taken')
      return
    }

    // Generate new capper_id from name
    const capperId = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)

    updateConfig({ display_name: trimmedName, capper_id: capperId })
    setNameError(null)
    setIsEditingName(false)
  }

  // Handle name edit cancel
  const cancelNameEdit = () => {
    setTempName('')
    setNameError(null)
    setIsEditingName(false)
  }

  // Calculate total weight allocation for a bet type (must equal 250%)
  const calculateTotalWeight = (betType: string): number => {
    const factorConfig = config.factor_config[betType]
    if (!factorConfig) return 0

    return factorConfig.enabled_factors.reduce((sum, factor) => {
      return sum + (factorConfig.weights[factor] || 0)
    }, 0)
  }

  // Check if weight allocation is valid (must equal 250%)
  const isWeightValid = (betType: string): boolean => {
    const total = calculateTotalWeight(betType)
    return Math.abs(total - 250) < 0.01 // Allow tiny floating point errors
  }

  const handleTeamToggle = (team: string) => {
    const newExcludedTeams = config.excluded_teams.includes(team)
      ? config.excluded_teams.filter(t => t !== team)
      : [...config.excluded_teams, team]

    updateConfig({ excluded_teams: newExcludedTeams })
  }

  // Removed - bet types are now fixed

  const handleFactorToggle = (betType: string, factor: string) => {
    const newFactorConfig = { ...config.factor_config }
    const enabled = newFactorConfig[betType].enabled_factors

    newFactorConfig[betType].enabled_factors = enabled.includes(factor)
      ? enabled.filter(f => f !== factor)
      : [...enabled, factor]

    updateConfig({ factor_config: newFactorConfig })
  }

  const handleWeightChange = (betType: string, factor: string, value: number) => {
    const newFactorConfig = { ...config.factor_config }
    const currentTotal = calculateTotalWeight(betType)
    const currentWeight = newFactorConfig[betType].weights[factor] || 0
    const weightDiff = value - currentWeight
    const newTotal = currentTotal + weightDiff

    // Prevent going over 250% budget
    if (newTotal > 250) {
      // Calculate max allowed value for this factor
      const maxAllowed = 250 - (currentTotal - currentWeight)
      newFactorConfig[betType].weights[factor] = Math.max(0, maxAllowed)
    } else {
      newFactorConfig[betType].weights[factor] = value
    }

    updateConfig({ factor_config: newFactorConfig })
  }

  const handlePresetSelect = (preset: PresetConfig) => {
    const currentBetType = archetypeBetType

    // If clicking the same preset for this bet type, deselect it
    if (selectedPresets[currentBetType] === preset.id) {
      setSelectedPresets(prev => ({ ...prev, [currentBetType]: null }))
      return
    }

    // Update the preset for the current bet type only
    setSelectedPresets(prev => ({ ...prev, [currentBetType]: preset.id }))

    // Apply preset configuration ONLY for the current bet type
    const factorsForBetType = currentBetType === 'TOTAL' ? preset.totalFactors : preset.spreadFactors

    const newFactorConfig = {
      ...config.factor_config,
      [currentBetType]: {
        enabled_factors: factorsForBetType.enabled,
        weights: factorsForBetType.weights
      }
    }

    updateConfig({ factor_config: newFactorConfig })
  }



  const canSubmit = () => {
    // Name is required
    if (!config.display_name.trim() || config.display_name.trim().length < 2) return false
    // If editing name, can't submit
    if (isEditingName) return false
    // For manual mode, just need a name
    if (config.pick_mode === 'manual') return true
    // For auto/hybrid mode: require BOTH TOTAL and SPREAD archetypes selected
    if (!selectedPresets.TOTAL || !selectedPresets.SPREAD) return false
    // Also need valid weights
    return config.bet_types.every(bt => isWeightValid(bt))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Factor config already uses correct SHIVA v1 factor keys, no mapping needed
      const response = await fetch('/api/cappers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.errors?.join(', ') || 'Failed to create capper')
      }

      // Success! Show toast and redirect
      toast({
        title: '🎉 Capper Created Successfully!',
        description: `${config.display_name} is now active and ${config.pick_mode === 'manual' ? 'ready for manual picks' : 'generating picks automatically'}.`,
        variant: 'success',
      })

      // Refresh profile to update role from 'free' to 'capper'
      await refreshProfile()

      // Small delay to let user see the toast before redirect
      setTimeout(() => {
        router.push('/dashboard/capper')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsSubmitting(false)

      toast({
        title: 'Error Creating Capper',
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      })
    }
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!profile) {
    router.push('/login')
    return null
  }

  // Get current preset details - show the preset for the currently viewed archetype bet type
  const currentPreset = PRESET_CONFIGS.find(p => p.id === selectedPresets[archetypeBetType])
  // For the left panel, show any selected preset (prefer TOTAL, fallback to SPREAD)
  const displayPreset = PRESET_CONFIGS.find(p => p.id === selectedPresets.TOTAL) ||
    PRESET_CONFIGS.find(p => p.id === selectedPresets.SPREAD)
  const PresetIcon = displayPreset?.icon || Swords

  // Calculate power level based on config
  const totalWeight = calculateTotalWeight('TOTAL')
  const spreadWeight = calculateTotalWeight('SPREAD')
  const powerLevel = Math.round(((totalWeight + spreadWeight) / 500) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Top Header Bar */}
      <div className="bg-slate-900/80 border-b border-amber-500/20 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl font-bold text-white">
              {config.pick_mode === 'manual'
                ? 'Become a Sharp Sports Analyst'
                : 'Become an Advanced AI Sports Predicting Robot'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-400">
              <span className="text-amber-400 font-semibold">{config.display_name || 'New Capper'}</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit() || isSubmitting}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold px-6"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Launch Capper</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-140px)]">

          {/* LEFT PANEL - Character Preview (Sticky) */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-6 flex flex-col">
              {/* Merged Avatar - Shows both archetypes */}
              <div className="flex-1 flex flex-col items-center justify-center">
                {(() => {
                  const totalsPreset = TOTALS_ARCHETYPES.find(p => p.id === selectedPresets.TOTAL)
                  const spreadPreset = SPREAD_ARCHETYPES.find(p => p.id === selectedPresets.SPREAD)
                  const hasBoth = totalsPreset && spreadPreset
                  const hasAny = totalsPreset || spreadPreset
                  const TotalsIcon = totalsPreset?.icon || Swords
                  const SpreadIcon = spreadPreset?.icon || Swords

                  return (
                    <div className="relative w-32 h-32 mb-4">
                      {/* Background glow ring - blends both colors */}
                      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${hasBoth
                        ? 'bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-red-500/20 border-2 border-amber-500/60 shadow-lg shadow-amber-500/30'
                        : totalsPreset
                          ? `bg-gradient-to-br from-${totalsPreset.color}-500/30 to-${totalsPreset.color}-600/10 border-2 border-${totalsPreset.color}-500/50 shadow-lg shadow-${totalsPreset.color}-500/20`
                          : spreadPreset
                            ? `bg-gradient-to-br from-${spreadPreset.color}-500/30 to-${spreadPreset.color}-600/10 border-2 border-${spreadPreset.color}-500/50 shadow-lg shadow-${spreadPreset.color}-500/20`
                            : 'bg-slate-700/50 border-2 border-slate-600'
                        }`} />

                      {hasBoth ? (
                        <>
                          {/* Dual icon display - split avatar */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-full h-full">
                              {/* Left icon (TOTALS) */}
                              <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                <TotalsIcon className={`w-10 h-10 text-${totalsPreset.color}-400 transition-all duration-300`} />
                              </div>
                              {/* Center divider */}
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
                              {/* Right icon (SPREAD) */}
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <SpreadIcon className={`w-10 h-10 text-${spreadPreset.color}-400 transition-all duration-300`} />
                              </div>
                            </div>
                          </div>
                          {/* Fusion badge */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-[8px] font-bold text-white uppercase tracking-wider shadow-lg">
                            Fusion
                          </div>
                        </>
                      ) : hasAny ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {totalsPreset && <TotalsIcon className={`w-16 h-16 text-${totalsPreset.color}-400 transition-all duration-500`} />}
                          {spreadPreset && <SpreadIcon className={`w-16 h-16 text-${spreadPreset.color}-400 transition-all duration-500`} />}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Swords className="w-16 h-16 text-slate-500 transition-all duration-500" />
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Name - Editable */}
                {isEditingName ? (
                  <div className="w-full max-w-[200px] space-y-2 mb-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={tempName}
                        onChange={(e) => {
                          setTempName(e.target.value)
                          setNameError(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNameEdit()
                          if (e.key === 'Escape') cancelNameEdit()
                        }}
                        placeholder="Enter your name"
                        className="text-center text-lg font-bold bg-slate-700 border-amber-500/50 focus:border-amber-500"
                        maxLength={30}
                        autoFocus
                      />
                      <button
                        onClick={saveNameEdit}
                        disabled={isCheckingName}
                        className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                      >
                        {isCheckingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={cancelNameEdit}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {nameError && (
                      <p className="text-xs text-red-400 text-center">{nameError}</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={startEditingName}
                    className="group flex items-center gap-2 mb-1 hover:bg-slate-700/50 px-3 py-1 rounded-lg transition-colors"
                  >
                    <h2 className="text-2xl font-bold text-white">{config.display_name || 'Click to set name'}</h2>
                    <Pencil className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </button>
                )}
                <p className="text-sm text-slate-400 mb-1">@{config.capper_id || 'capper-id'}</p>
                {!config.display_name.trim() && (
                  <p className="text-xs text-amber-400 mb-2">⚠️ Name is required</p>
                )}
                <p className="text-[10px] text-slate-500 mb-4">Once created, name cannot be changed</p>

                {/* Archetype List - Shows all bet types */}
                <div className="w-full space-y-2 mb-4">
                  {/* NBA TOTALS */}
                  {(() => {
                    const totalsPreset = TOTALS_ARCHETYPES.find(p => p.id === selectedPresets.TOTAL)
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${totalsPreset
                        ? `bg-${totalsPreset.color}-500/10 border border-${totalsPreset.color}-500/30`
                        : 'bg-slate-800/50 border border-slate-700/50'
                        }`}>
                        <span className="text-[10px] font-bold text-cyan-400 uppercase w-20">NBA Totals:</span>
                        {totalsPreset ? (
                          <span className={`text-xs font-semibold text-${totalsPreset.color}-400`}>{totalsPreset.name}</span>
                        ) : (
                          <span className="text-xs text-amber-400/80">⚠️ Select archetype</span>
                        )}
                      </div>
                    )
                  })()}

                  {/* NBA SPREAD */}
                  {(() => {
                    const spreadPreset = SPREAD_ARCHETYPES.find(p => p.id === selectedPresets.SPREAD)
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${spreadPreset
                        ? `bg-${spreadPreset.color}-500/10 border border-${spreadPreset.color}-500/30`
                        : 'bg-slate-800/50 border border-slate-700/50'
                        }`}>
                        <span className="text-[10px] font-bold text-purple-400 uppercase w-20">NBA Spread:</span>
                        {spreadPreset ? (
                          <span className={`text-xs font-semibold text-${spreadPreset.color}-400`}>{spreadPreset.name}</span>
                        ) : (
                          <span className="text-xs text-amber-400/80">⚠️ Select archetype</span>
                        )}
                      </div>
                    )
                  })()}

                  {/* NFL TOTALS - Coming Soon */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/30 opacity-50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase w-20">NFL Totals:</span>
                    <span className="text-xs text-slate-500 italic">(coming soon)</span>
                  </div>

                  {/* NFL SPREAD - Coming Soon */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/30 opacity-50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase w-20">NFL Spread:</span>
                    <span className="text-xs text-slate-500 italic">(coming soon)</span>
                  </div>
                </div>

                {/* Mode Badge */}
                <div className="flex items-center gap-2 mb-6">
                  {config.pick_mode === 'manual' ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                      <Hand className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">Manual Mode</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-amber-400">AI + Manual</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Summary */}
              <div className="space-y-3 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase">Power Level</span>
                  <span className="text-sm font-bold text-amber-400">{powerLevel}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                    style={{ width: `${powerLevel}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-cyan-400">{calculateTotalWeight('TOTAL')}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Totals Weight</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-purple-400">{calculateTotalWeight('SPREAD')}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Spread Weight</div>
                  </div>
                </div>

                {config.excluded_teams.length > 0 && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="text-xs text-red-400 flex items-center gap-1">
                      <Ban className="w-3 h-3" />
                      {config.excluded_teams.length} teams excluded
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Configuration (Scrollable) */}
          <div className="lg:col-span-8 flex flex-col lg:overflow-y-auto lg:max-h-[calc(100vh-140px)]">
            {/* Tab Navigation - Only Archetype and Options */}
            <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
              {[
                { id: 'archetype' as const, label: 'Archetype', icon: Swords },
                { id: 'options' as const, label: 'Options', icon: Ban },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex-1 overflow-y-auto">

              {/* ARCHETYPE TAB */}
              {activeTab === 'archetype' && (
                <div className="space-y-5">
                  {/* Pick Mode Toggle */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Pick Mode</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updateConfig({ pick_mode: 'hybrid' })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${config.pick_mode === 'hybrid'
                          ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                          }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Zap className={`w-6 h-6 ${config.pick_mode === 'hybrid' ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className={`font-bold ${config.pick_mode === 'hybrid' ? 'text-amber-400' : 'text-white'}`}>AI + Manual</span>
                          {config.pick_mode === 'hybrid' && <Star className="w-4 h-4 text-green-400 ml-auto" />}
                        </div>
                        <p className="text-xs text-slate-400">AI generates picks automatically + add your own</p>
                      </button>

                      <button
                        onClick={() => updateConfig({ pick_mode: 'manual' })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${config.pick_mode === 'manual'
                          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                          }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Hand className={`w-6 h-6 ${config.pick_mode === 'manual' ? 'text-blue-400' : 'text-slate-400'}`} />
                          <span className={`font-bold ${config.pick_mode === 'manual' ? 'text-blue-400' : 'text-white'}`}>Manual Only</span>
                        </div>
                        <p className="text-xs text-slate-400">Full control - you make all picks yourself</p>
                      </button>
                    </div>
                  </div>

                  {/* Archetype Selection with TOTAL/SPREAD toggle */}
                  {config.pick_mode !== 'manual' && (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase">Choose Your Archetype</h3>
                        {/* Unified Bet Type Toggle - syncs archetypes AND factors */}
                        <div className="flex gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700/50">
                          {(['TOTAL', 'SPREAD'] as const).map(bt => (
                            <button
                              key={bt}
                              onClick={() => {
                                setArchetypeBetType(bt)
                                setFactorBetType(bt)
                              }}
                              className={`py-1 px-2.5 rounded-md font-semibold text-xs transition-all ${archetypeBetType === bt
                                ? bt === 'TOTAL' ? 'bg-cyan-500/30 text-cyan-400' : 'bg-purple-500/30 text-purple-400'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                              {bt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Archetype Cards - Uniform 2x2 grid with equal heights */}
                      {(() => {
                        const archetypes = archetypeBetType === 'TOTAL' ? TOTALS_ARCHETYPES : SPREAD_ARCHETYPES
                        return (
                          <div className="grid grid-cols-2 gap-2">
                            {archetypes.map(preset => {
                              const Icon = preset.icon
                              const isSelected = selectedPresets[archetypeBetType] === preset.id
                              return (
                                <button
                                  key={preset.id}
                                  onClick={() => handlePresetSelect(preset)}
                                  className={`group p-3 rounded-xl border-2 transition-all text-left h-[72px] ${isSelected
                                    ? `border-${preset.color}-500 bg-gradient-to-br from-${preset.color}-500/20 to-${preset.color}-600/10 shadow-lg shadow-${preset.color}-500/20`
                                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/30 hover:bg-slate-700/50'
                                    }`}
                                >
                                  <div className="flex items-start gap-2 h-full">
                                    <div className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${isSelected ? `bg-${preset.color}-500/30` : 'bg-slate-600 group-hover:bg-slate-500'}`}>
                                      <Icon className={`w-4 h-4 ${isSelected ? `text-${preset.color}-400` : 'text-slate-300'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`font-bold text-xs truncate ${isSelected ? `text-${preset.color}-400` : 'text-white'}`}>
                                        {preset.name}
                                      </h4>
                                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{preset.description}</p>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Factor Configuration - Horizontal Category Tabs + Full Width Panel */}
                  {config.pick_mode !== 'manual' && (
                    <div className="space-y-3">
                      {/* Category Filter Tabs */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setFactorCategoryFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${factorCategoryFilter === 'all'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                            }`}
                        >
                          All Factors
                        </button>
                        {FACTOR_GROUPS[factorBetType].map(group => {
                          const GroupIcon = group.icon
                          const enabledCount = group.factors.filter(f =>
                            config.factor_config[factorBetType]?.enabled_factors.includes(f)
                          ).length
                          const isActive = factorCategoryFilter === group.id

                          return (
                            <button
                              key={group.id}
                              onClick={() => setFactorCategoryFilter(group.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isActive
                                ? `bg-${group.color}-500/20 text-${group.color}-400 border border-${group.color}-500/40`
                                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                }`}
                            >
                              <GroupIcon className={`w-3.5 h-3.5 ${isActive ? `text-${group.color}-400` : ''}`} />
                              <span className="hidden sm:inline">{group.name.split(' ')[0]}</span>
                              {enabledCount > 0 && (
                                <span className={`text-[10px] px-1 rounded ${isActive ? `bg-${group.color}-500/30` : 'bg-slate-700'}`}>
                                  {enabledCount}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Full-Width Factor Weights Panel */}
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
                        {/* Header with bet type label and budget */}
                        <div className="flex items-center justify-between mb-3">
                          <div className={`py-1 px-3 rounded-md font-semibold text-xs ${factorBetType === 'TOTAL' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                            {factorBetType} Factors
                          </div>
                          {/* Weight Budget */}
                          {(() => {
                            const totalW = calculateTotalWeight(factorBetType)
                            const isValid = isWeightValid(factorBetType)
                            return (
                              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${isValid ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                                <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${isValid ? 'bg-green-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min((totalW / 250) * 100, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${isValid ? 'text-green-400' : 'text-amber-400'}`}>
                                  {totalW}%/250%
                                </span>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Factor Sliders - Filtered by category */}
                        <div className="grid grid-cols-1 gap-2">
                          {(() => {
                            // Get factors to display based on category filter
                            const allFactors = AVAILABLE_FACTORS[factorBetType] || []
                            const filteredFactors = factorCategoryFilter === 'all'
                              ? allFactors
                              : FACTOR_GROUPS[factorBetType]
                                .find(g => g.id === factorCategoryFilter)?.factors || []

                            return filteredFactors.map(factor => {
                              const isEnabled = config.factor_config[factorBetType]?.enabled_factors.includes(factor)
                              const weight = config.factor_config[factorBetType]?.weights[factor] || 50
                              const details = FACTOR_DETAILS[factor as keyof typeof FACTOR_DETAILS]
                              const Icon = details?.icon || Target

                              return (
                                <div
                                  key={factor}
                                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isEnabled ? 'border-amber-500/30 bg-slate-800/60' : 'border-slate-700/30 bg-slate-800/20'}`}
                                >
                                  {/* Toggle */}
                                  <button
                                    onClick={() => handleFactorToggle(factorBetType, factor)}
                                    className={`w-10 h-5 rounded-full transition flex-shrink-0 ${isEnabled ? 'bg-amber-500' : 'bg-slate-600'}`}
                                  >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-0.5 ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                  </button>

                                  {/* Icon + Name */}
                                  <div className="flex items-center gap-2 flex-shrink-0 w-36">
                                    <Icon className={`w-4 h-4 flex-shrink-0 ${isEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                                    <span className={`text-sm font-medium truncate ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                      {details?.name || factor}
                                    </span>
                                  </div>

                                  {/* Info Tooltip */}
                                  <div className="relative group/tooltip flex-shrink-0">
                                    <HelpCircle className={`w-4 h-4 cursor-help ${isEnabled ? 'text-slate-400 hover:text-amber-400' : 'text-slate-600'}`} />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-amber-500/30 rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none">
                                      <div className="text-xs font-bold text-amber-400 mb-1">{details?.name}</div>
                                      <div className="text-[10px] text-slate-300 mb-2">{details?.description}</div>
                                      <div className="text-[10px] text-slate-400 italic">{details?.importance}</div>
                                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-4 border-transparent border-t-slate-900" />
                                    </div>
                                  </div>

                                  {/* Slider */}
                                  {isEnabled ? (
                                    <div className="flex-1 flex items-center gap-3 min-w-0">
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={weight}
                                        onChange={e => handleWeightChange(factorBetType, factor, parseInt(e.target.value))}
                                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-700"
                                        style={{
                                          background: `linear-gradient(to right, rgb(34 197 94) 0%, rgb(34 197 94) ${weight}%, rgb(51 65 85) ${weight}%, rgb(51 65 85) 100%)`
                                        }}
                                      />
                                      <span className="text-sm font-bold text-green-400 w-12 text-right">{weight}%</span>
                                    </div>
                                  ) : (
                                    <div className="flex-1 h-2 bg-slate-700/50 rounded-full" />
                                  )}
                                </div>
                              )
                            })
                          })()}
                        </div>

                        <p className="text-[10px] text-slate-500 text-center pt-3 mt-3 border-t border-slate-700/50">
                          💡 Toggle factors on/off, then adjust weights to total 250%
                        </p>
                      </div>
                    </div>
                  )}

                  {config.pick_mode === 'manual' && (
                    <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
                      <Hand className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white mb-2">Manual Mode Selected</h3>
                      <p className="text-sm text-slate-400">You'll make all picks yourself. No AI configuration needed.</p>
                      <p className="text-sm text-blue-400 mt-3">Click &ldquo;Launch Capper&rdquo; when ready!</p>
                    </div>
                  )}
                </div>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <div className="space-y-6">
                  {/* Team Exclusions */}
                  {config.pick_mode !== 'manual' && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-400" />
                        Exclude Teams (Optional)
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        AI won&apos;t generate picks for these teams. Click to toggle.
                      </p>
                      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                        {NBA_TEAMS.map(team => (
                          <button
                            key={team}
                            onClick={() => handleTeamToggle(team)}
                            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${config.excluded_teams.includes(team)
                              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                              }`}
                          >
                            {team}
                          </button>
                        ))}
                      </div>
                      {config.excluded_teams.length > 0 && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          {config.excluded_teams.length} team(s) excluded
                        </p>
                      )}
                    </div>
                  )}

                  {config.pick_mode === 'manual' && (
                    <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
                      <Hand className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white mb-2">Manual Mode</h3>
                      <p className="text-sm text-slate-400">No additional options for manual mode.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

