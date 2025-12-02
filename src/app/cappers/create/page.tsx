'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sparkles, Zap, Hand, Ban, Gauge, TrendingUp, Target, Home, Battery, BarChart3, Shield, Trophy, Flame, UserX, Anchor, Scale, Rocket, Castle, TrendingDown, Loader2, AlertCircle, Swords, Crown, Star, ChevronRight, Pencil, Check, X, ChevronDown, Activity, Crosshair, Repeat, RotateCcw, MapPin, Award, Shuffle, HelpCircle } from 'lucide-react'
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

const FACTOR_DETAILS = {
  paceIndex: {
    name: 'Pace Index',
    icon: Gauge,
    description: 'Expected game pace based on both teams\' recent pace (last 10 games)',
    importance: 'Fast-paced games produce higher totals; slow-paced games produce lower totals.',
    example: 'High pace game (+12 possessions vs league avg) → Strong Over signal. Slow pace game (-8 possessions) → Strong Under signal.',
    defaultWeight: 30,
    color: 'cyan'
  },
  netRating: {
    name: 'Net Rating',
    icon: TrendingUp,
    description: 'Combined offensive and defensive efficiency differential',
    importance: 'Elite offenses vs weak defenses create higher scoring games.',
    example: 'Strong offense (+8 net rating) vs weak defense (-6 net rating) → Strong Over signal.',
    defaultWeight: 30,
    color: 'green'
  },
  shooting: {
    name: 'Shooting Performance',
    icon: Target,
    description: '3PT% and FG% trends over last 5 games',
    importance: 'Hot shooting teams score more points; cold shooting teams score fewer.',
    example: 'Team shooting 40% from 3PT (vs 35% avg) → +2.5 points per game.',
    defaultWeight: 25,
    color: 'orange'
  },
  homeAwayDiff: {
    name: 'Home/Away Split',
    icon: Home,
    description: 'Home vs away scoring differential',
    importance: 'Home teams typically score 2-4 more points per game than on the road.',
    example: 'Home team averages +3.5 PPG at home → Slight Over lean.',
    defaultWeight: 20,
    color: 'blue'
  },
  restDays: {
    name: 'Rest & Fatigue',
    icon: Battery,
    description: 'Days of rest and back-to-back game impact',
    importance: 'Fatigued teams score fewer points and allow more points on defense.',
    example: 'Team on back-to-back (0 days rest) → -3 to -5 points expected.',
    defaultWeight: 20,
    color: 'yellow'
  },
  recentForm: {
    name: 'Recent Form (ATS)',
    icon: Flame,
    description: 'Against-the-spread performance over last 3 and 10 games',
    importance: 'Teams on hot ATS streaks tend to continue covering spreads.',
    example: 'Team is 8-2 ATS in last 10 games → Strong cover signal.',
    defaultWeight: 30,
    color: 'red'
  },
  homeAwaySplits: {
    name: 'Home/Away Splits',
    icon: Home,
    description: 'How teams perform in their current game context (road vs home)',
    importance: 'Road performance vs home performance reveals true ATS value.',
    example: 'Strong road team (+5 NetRtg away) vs weak home team (-2 NetRtg home) → Road team gets ATS edge.',
    defaultWeight: 20,
    color: 'purple'
  },
  // Backward compatibility alias
  paceMismatch: {
    name: 'Home/Away Splits',
    icon: Home,
    description: 'How teams perform in their current game context (road vs home)',
    importance: 'Road performance vs home performance reveals true ATS value.',
    example: 'Strong road team (+5 NetRtg away) vs weak home team (-2 NetRtg home) → Road team gets ATS edge.',
    defaultWeight: 20,
    color: 'purple'
  },
  offDefBalance: {
    name: 'Offensive/Defensive Balance',
    icon: BarChart3,
    description: 'Team efficiency ratings on both ends of the floor',
    importance: 'Elite offenses vs weak defenses create larger point margins.',
    example: 'Elite offense (+8 rating) vs weak defense (-6 rating) → Large spread advantage.',
    defaultWeight: 25,
    color: 'indigo'
  },
  homeCourtEdge: {
    name: 'Home Court Advantage',
    icon: Shield,
    description: 'Home vs away point differential and win rate',
    importance: 'Home teams cover spreads more often than road teams.',
    example: 'Strong home team (+6.5 PPG at home) → Home spread advantage.',
    defaultWeight: 15,
    color: 'emerald'
  },
  clutchPerformance: {
    name: 'Clutch Performance',
    icon: Trophy,
    description: 'Performance in close games (within 5 points in 4th quarter)',
    importance: 'Clutch teams cover spreads in tight games.',
    example: 'Team is 12-3 in clutch situations → Strong spread cover signal.',
    defaultWeight: 15,
    color: 'amber'
  },
  injuryImpact: {
    name: 'Key Injuries & Availability',
    icon: UserX,
    description: 'Impact of injured players on game outcome (deterministic formula)',
    importance: 'Missing key players significantly impacts scoring (TOTALS) and competitive balance (SPREAD).',
    example: 'Star player (30 PPG, 36 MPG) OUT → 4.5 point impact. TOTALS: favors Under. SPREAD: opponent gets ATS edge.',
    defaultWeight: 25,
    color: 'red'
  }
}

const AVAILABLE_FACTORS = {
  TOTAL: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays', 'injuryImpact'],
  SPREAD: ['recentForm', 'homeAwaySplits', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact']
}

// Factor groups for organized display - each group can contain multiple factors
const FACTOR_GROUPS = {
  TOTAL: [
    { id: 'pace', name: 'Pace & Tempo', icon: Activity, factors: ['paceIndex'], color: 'cyan' },
    { id: 'offense', name: 'Offense', icon: TrendingUp, factors: ['netRating'], color: 'green' },
    { id: 'shooting', name: 'Shooting', icon: Crosshair, factors: ['shooting'], color: 'orange' },
    { id: 'homeAway', name: 'Home/Away Splits', icon: Home, factors: ['homeAwayDiff'], color: 'blue' },
    { id: 'situational', name: 'Situational', icon: Battery, factors: ['restDays'], color: 'yellow' },
    { id: 'injuries', name: 'Injuries', icon: UserX, factors: ['injuryImpact'], color: 'red' },
  ],
  SPREAD: [
    { id: 'form', name: 'Recent Form', icon: Flame, factors: ['recentForm'], color: 'red' },
    { id: 'homeAway', name: 'Home/Away Splits', icon: Home, factors: ['homeAwaySplits'], color: 'purple' },
    { id: 'efficiency', name: 'Efficiency', icon: BarChart3, factors: ['offDefBalance'], color: 'indigo' },
    { id: 'homeAdvantage', name: 'Home Court', icon: Shield, factors: ['homeCourtEdge'], color: 'emerald' },
    { id: 'clutch', name: 'Clutch', icon: Trophy, factors: ['clutchPerformance'], color: 'amber' },
    { id: 'injuries', name: 'Injuries', icon: UserX, factors: ['injuryImpact'], color: 'red' },
  ]
}

// Map user-friendly factor names to SHIVA v1 factor names used by the wizard
const FACTOR_NAME_MAPPING = {
  TOTAL: {
    'paceIndex': 'paceIndex',        // Same
    'netRating': 'offForm',          // Maps to offForm
    'shooting': 'threeEnv',          // Maps to threeEnv
    'homeAwayDiff': 'defErosion',    // Maps to defErosion
    'restDays': 'whistleEnv',        // Maps to whistleEnv
    'injuryImpact': 'injuryAvailability' // Maps to injuryAvailability
  },
  SPREAD: {
    'recentForm': 'shootingMomentum',      // Maps to shootingMomentum
    'homeAwaySplits': 'homeAwaySplits',    // New factor
    'paceMismatch': 'homeAwaySplits',      // Legacy alias → maps to homeAwaySplits
    'offDefBalance': 'netRatingDiff',      // Maps to netRatingDiff
    'homeCourtEdge': 'turnoverDiff',       // Maps to turnoverDiff
    'clutchPerformance': 'fourFactorsDiff', // Maps to fourFactorsDiff
    'injuryImpact': 'injuryAvailabilitySpread' // Maps to injuryAvailabilitySpread
  }
}

// ============================================
// TOTALS ARCHETYPES - Designed for O/U betting
// Key differentiators: pace vs efficiency vs situational
// ============================================
const TOTALS_ARCHETYPES: PresetConfig[] = [
  {
    id: 'pace-prophet',
    name: 'The Pace Prophet',
    description: 'Game tempo is everything. Fast pace = points.',
    icon: Rocket,
    color: 'cyan',
    philosophy: 'Pace is the #1 predictor of totals. Fast-paced games create more possessions = more points. Ignores shooting variance, trusts volume.',
    totalFactors: {
      enabled: ['paceIndex', 'netRating', 'restDays'],
      weights: { paceIndex: 100, netRating: 80, restDays: 70 }
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
      enabled: ['netRating', 'injuryImpact', 'homeAwayDiff', 'paceIndex'],
      weights: { netRating: 100, injuryImpact: 70, homeAwayDiff: 50, paceIndex: 30 }
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
      enabled: ['shooting', 'netRating', 'paceIndex', 'homeAwayDiff'],
      weights: { shooting: 100, netRating: 60, paceIndex: 50, homeAwayDiff: 40 }
    },
    spreadFactors: { enabled: [], weights: {} }
  },
  {
    id: 'rest-detective',
    name: 'The Rest Detective',
    description: 'Fatigue kills. Back-to-backs and travel matter.',
    icon: Battery,
    color: 'yellow',
    philosophy: 'Tired legs = poor shooting = lower totals. Fresh teams with rest advantage dominate. Schedule spots are undervalued by the public.',
    totalFactors: {
      enabled: ['restDays', 'injuryImpact', 'homeAwayDiff', 'netRating'],
      weights: { restDays: 100, injuryImpact: 80, homeAwayDiff: 40, netRating: 30 }
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
      enabled: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays'],
      weights: { paceIndex: 50, netRating: 50, shooting: 50, homeAwayDiff: 50, restDays: 50 }
    },
    spreadFactors: { enabled: [], weights: {} }
  }
]

// ============================================
// SPREAD ARCHETYPES - Designed for ATS betting
// Key differentiators: form vs matchups vs situational
// ============================================
const SPREAD_ARCHETYPES: PresetConfig[] = [
  {
    id: 'form-rider',
    name: 'The Form Rider',
    description: 'ATS streaks are real. Ride the winners.',
    icon: TrendingUp,
    color: 'red',
    philosophy: 'Teams covering spreads have confidence and momentum. A team 8-2 ATS in last 10 keeps covering. Public overreacts to bad beats.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      enabled: ['recentForm', 'clutchPerformance', 'homeAwaySplits'],
      weights: { recentForm: 100, clutchPerformance: 80, homeAwaySplits: 70 }
    }
  },
  {
    id: 'matchup-master',
    name: 'The Matchup Master',
    description: 'It\'s all about the matchup. Offense vs defense.',
    icon: Swords,
    color: 'indigo',
    philosophy: 'Ignore records, focus on how teams match up. Elite offense vs weak defense = cover. Strong defense vs weak offense = cover.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      enabled: ['offDefBalance', 'homeAwaySplits', 'injuryImpact', 'recentForm'],
      weights: { offDefBalance: 100, homeAwaySplits: 70, injuryImpact: 50, recentForm: 30 }
    }
  },
  {
    id: 'home-court-hero',
    name: 'The Home Court Hero',
    description: 'Home court is undervalued. Back the home teams.',
    icon: Home,
    color: 'emerald',
    philosophy: 'Vegas still underweights home court advantage. Strong home teams with good home splits are money. Road favorites are traps.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      enabled: ['homeCourtEdge', 'homeAwaySplits', 'offDefBalance', 'recentForm'],
      weights: { homeCourtEdge: 100, homeAwaySplits: 80, offDefBalance: 40, recentForm: 30 }
    }
  },
  {
    id: 'closer',
    name: 'The Closer',
    description: 'Clutch performance wins spreads. Who closes games?',
    icon: Trophy,
    color: 'amber',
    philosophy: 'Games are won in the 4th quarter. Teams with clutch DNA cover in tight games. Closers beat pretenders when it matters.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      enabled: ['clutchPerformance', 'recentForm', 'offDefBalance', 'homeCourtEdge'],
      weights: { clutchPerformance: 100, recentForm: 60, offDefBalance: 50, homeCourtEdge: 40 }
    }
  },
  {
    id: 'injury-hawk',
    name: 'The Injury Hawk',
    description: 'Lines move slow. Injuries create value.',
    icon: UserX,
    color: 'purple',
    philosophy: 'Vegas adjusts lines, but not enough. A star out = 4-7 point swing. Beat the book before lines fully adjust to injury news.',
    totalFactors: { enabled: [], weights: {} },
    spreadFactors: {
      enabled: ['injuryImpact', 'offDefBalance', 'homeAwaySplits', 'recentForm'],
      weights: { injuryImpact: 100, offDefBalance: 60, homeAwaySplits: 50, recentForm: 40 }
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

  // Expanded factor groups
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['pace', 'form'])

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [isCheckingName, setIsCheckingName] = useState(false)

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
        enabled_factors: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays'],
        weights: { paceIndex: 50, netRating: 50, shooting: 50, homeAwayDiff: 50, restDays: 50 }
      },
      SPREAD: {
        enabled_factors: ['recentForm', 'homeAwaySplits', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance'],
        weights: { recentForm: 50, homeAwaySplits: 50, offDefBalance: 50, homeCourtEdge: 50, clutchPerformance: 50 }
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

  // Toggle factor group expansion
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(g => g !== groupId)
        : [...prev, groupId]
    )
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

      // Map user-friendly factor names to SHIVA v1 factor names
      const mappedFactorConfig: typeof config.factor_config = {}

      for (const betType of Object.keys(config.factor_config)) {
        const mapping = FACTOR_NAME_MAPPING[betType as keyof typeof FACTOR_NAME_MAPPING]
        const originalConfig = config.factor_config[betType]

        // Map enabled factors
        const mappedEnabledFactors = originalConfig.enabled_factors.map(
          factor => mapping[factor as keyof typeof mapping] || factor
        )

        // Map weights
        const mappedWeights: { [key: string]: number } = {}
        for (const [factor, weight] of Object.entries(originalConfig.weights)) {
          const mappedFactorName = mapping[factor as keyof typeof mapping] || factor
          mappedWeights[mappedFactorName] = weight
        }

        mappedFactorConfig[betType] = {
          enabled_factors: mappedEnabledFactors,
          weights: mappedWeights
        }
      }

      const response = await fetch('/api/cappers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          factor_config: mappedFactorConfig
        })
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

                      {/* Archetype Cards - Use bet-type specific archetypes */}
                      {(() => {
                        const archetypes = archetypeBetType === 'TOTAL' ? TOTALS_ARCHETYPES : SPREAD_ARCHETYPES
                        return (
                          <>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              {archetypes.slice(0, 3).map(preset => {
                                const Icon = preset.icon
                                const isSelected = selectedPresets[archetypeBetType] === preset.id
                                return (
                                  <button
                                    key={preset.id}
                                    onClick={() => handlePresetSelect(preset)}
                                    className={`group p-3 rounded-xl border-2 transition-all text-left ${isSelected
                                      ? `border-${preset.color}-500 bg-gradient-to-br from-${preset.color}-500/20 to-${preset.color}-600/10 shadow-lg shadow-${preset.color}-500/20`
                                      : 'border-slate-600 hover:border-slate-500 bg-slate-700/30 hover:bg-slate-700/50'
                                      }`}
                                  >
                                    <div className="flex items-start gap-2">
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
                            <div className="grid grid-cols-2 gap-2">
                              {archetypes.slice(3).map(preset => {
                                const Icon = preset.icon
                                const isSelected = selectedPresets[archetypeBetType] === preset.id
                                return (
                                  <button
                                    key={preset.id}
                                    onClick={() => handlePresetSelect(preset)}
                                    className={`group p-3 rounded-xl border-2 transition-all text-left ${isSelected
                                      ? `border-${preset.color}-500 bg-gradient-to-br from-${preset.color}-500/20 to-${preset.color}-600/10 shadow-lg shadow-${preset.color}-500/20`
                                      : 'border-slate-600 hover:border-slate-500 bg-slate-700/30 hover:bg-slate-700/50'
                                      }`}
                                  >
                                    <div className="flex items-start gap-2">
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
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {/* Factor Configuration - Two Column Layout */}
                  {config.pick_mode !== 'manual' && (
                    <div className="grid grid-cols-12 gap-4">
                      {/* Left: Factor Groups */}
                      <div className="col-span-5 space-y-1">
                        {FACTOR_GROUPS[factorBetType].map(group => {
                          const GroupIcon = group.icon
                          const enabledCount = group.factors.filter(f =>
                            config.factor_config[factorBetType]?.enabled_factors.includes(f)
                          ).length

                          return (
                            <button
                              key={group.id}
                              onClick={() => toggleGroupExpanded(group.id)}
                              className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${expandedGroups.includes(group.id)
                                ? `border-${group.color}-500/50 bg-${group.color}-500/10`
                                : 'border-slate-700/50 bg-slate-800/50 hover:bg-slate-700/50'
                                }`}
                            >
                              <GroupIcon className={`w-4 h-4 text-${group.color}-400 flex-shrink-0`} />
                              <span className="text-sm font-medium text-white flex-1">{group.name}</span>
                              <span className={`text-xs font-bold text-${group.color}-400`}>+{enabledCount}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Right: Factor Weights Panel */}
                      <div className="col-span-7 bg-slate-900/50 border border-slate-700/50 rounded-xl p-3">
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
                                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
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

                        {/* Factor Sliders */}
                        <div className="space-y-2">
                          {AVAILABLE_FACTORS[factorBetType]?.map(factor => {
                            const isEnabled = config.factor_config[factorBetType]?.enabled_factors.includes(factor)
                            const weight = config.factor_config[factorBetType]?.weights[factor] || 50
                            const details = FACTOR_DETAILS[factor as keyof typeof FACTOR_DETAILS]
                            const Icon = details?.icon || Target

                            return (
                              <div
                                key={factor}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${isEnabled ? 'border-amber-500/30 bg-slate-800/60' : 'border-slate-700/30 bg-slate-800/20'}`}
                              >
                                {/* Toggle */}
                                <button
                                  onClick={() => handleFactorToggle(factorBetType, factor)}
                                  className={`w-8 h-4 rounded-full transition flex-shrink-0 ${isEnabled ? 'bg-amber-500' : 'bg-slate-600'}`}
                                >
                                  <div className={`w-3 h-3 bg-white rounded-full transition-transform mt-0.5 ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </button>

                                {/* Icon + Name + Tooltip */}
                                <Icon className={`w-4 h-4 flex-shrink-0 ${isEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                                <span className={`text-xs font-medium flex-shrink-0 w-20 truncate ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                  {details?.name?.split(' ').slice(0, 2).join(' ')}
                                </span>
                                {/* Info Tooltip */}
                                <div className="relative group/tooltip flex-shrink-0">
                                  <HelpCircle className={`w-3.5 h-3.5 cursor-help ${isEnabled ? 'text-slate-400 hover:text-amber-400' : 'text-slate-600'}`} />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-amber-500/30 rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none">
                                    <div className="text-xs font-bold text-amber-400 mb-1">{details?.name}</div>
                                    <div className="text-[10px] text-slate-300 mb-2">{details?.description}</div>
                                    <div className="text-[10px] text-slate-400 italic">{details?.importance}</div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-4 border-transparent border-t-slate-900" />
                                  </div>
                                </div>

                                {/* Slider */}
                                {isEnabled ? (
                                  <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={weight}
                                      onChange={e => handleWeightChange(factorBetType, factor, parseInt(e.target.value))}
                                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-slate-700"
                                      style={{
                                        background: `linear-gradient(to right, rgb(34 197 94) 0%, rgb(34 197 94) ${weight}%, rgb(51 65 85) ${weight}%, rgb(51 65 85) 100%)`
                                      }}
                                    />
                                    <span className="text-sm font-bold text-green-400 w-10 text-right">{weight}%</span>
                                  </div>
                                ) : (
                                  <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full" />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        <p className="text-[10px] text-slate-500 text-center pt-2 mt-2 border-t border-slate-700/50">
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

