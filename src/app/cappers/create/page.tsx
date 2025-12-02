'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sparkles, Zap, Hand, Ban, Gauge, TrendingUp, Target, Home, Battery, BarChart3, Shield, Trophy, Flame, UserX, Anchor, Scale, Rocket, Castle, TrendingDown, Loader2, AlertCircle, Swords, Crown, Star, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCallback } from 'react'

type ConfigTab = 'archetype' | 'stats' | 'options'

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

const PRESET_CONFIGS: PresetConfig[] = [
  {
    id: 'conservative',
    name: 'The Conservative',
    description: 'Low-risk, high-confidence plays. Focus on proven, stable factors.',
    icon: Anchor,
    color: 'blue',
    philosophy: 'Risk-averse strategy emphasizing stable fundamentals. Avoids volatile factors like shooting streaks. Targets 58-62% win rate with selective picks.',
    totalFactors: {
      enabled: ['netRating', 'restDays', 'injuryImpact', 'homeAwayDiff', 'paceIndex'],
      weights: {
        netRating: 70,
        restDays: 60,
        injuryImpact: 60,
        homeAwayDiff: 40,
        paceIndex: 20
      }
    },
    spreadFactors: {
      enabled: ['offDefBalance', 'homeCourtEdge', 'injuryImpact', 'clutchPerformance', 'recentForm'],
      weights: {
        offDefBalance: 70,
        homeCourtEdge: 60,
        injuryImpact: 50,
        clutchPerformance: 40,
        recentForm: 30
      }
    }
  },
  {
    id: 'balanced',
    name: 'The Balanced Sharp',
    description: 'Well-rounded, data-driven approach. Trust the model, not gut feelings.',
    icon: Scale,
    color: 'slate',
    philosophy: 'Even distribution across all factors. Proven strategy for consistent results. Targets 55-58% win rate.',
    totalFactors: {
      enabled: ['paceIndex', 'netRating', 'shooting', 'restDays', 'injuryImpact'],
      weights: {
        paceIndex: 45,
        netRating: 50,
        shooting: 50,
        restDays: 50,
        injuryImpact: 55
      }
    },
    spreadFactors: {
      enabled: ['recentForm', 'homeAwaySplits', 'offDefBalance', 'homeCourtEdge', 'injuryImpact'],
      weights: {
        recentForm: 50,
        homeAwaySplits: 50,
        offDefBalance: 50,
        homeCourtEdge: 50,
        injuryImpact: 50
      }
    }
  },
  {
    id: 'pace-demon',
    name: 'The Pace Demon',
    description: 'High-scoring, fast-paced games. Overs specialist.',
    icon: Rocket,
    color: 'orange',
    philosophy: 'All-in on pace and offensive firepower. Maximizes pace factors to find high-scoring games. Targets 53-56% win rate with higher variance.',
    totalFactors: {
      enabled: ['paceIndex', 'shooting', 'netRating', 'homeAwayDiff'],
      weights: {
        paceIndex: 100,
        shooting: 70,
        netRating: 50,
        homeAwayDiff: 30
      }
    },
    spreadFactors: {
      enabled: ['homeAwaySplits', 'offDefBalance', 'recentForm', 'homeCourtEdge', 'clutchPerformance'],
      weights: {
        homeAwaySplits: 80,
        offDefBalance: 60,
        recentForm: 50,
        homeCourtEdge: 30,
        clutchPerformance: 30
      }
    }
  },
  {
    id: 'grind-it-out',
    name: 'The Grind-It-Out',
    description: 'Defense wins championships. Unders and home favorites.',
    icon: Castle,
    color: 'emerald',
    philosophy: 'Emphasizes defensive efficiency, slow pace, and home court advantage. Targets low-scoring games and home favorites. Targets 56-59% win rate.',
    totalFactors: {
      enabled: ['netRating', 'restDays', 'homeAwayDiff', 'injuryImpact', 'paceIndex'],
      weights: {
        netRating: 80,
        restDays: 70,
        homeAwayDiff: 50,
        injuryImpact: 35,
        paceIndex: 15
      }
    },
    spreadFactors: {
      enabled: ['offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'recentForm', 'injuryImpact'],
      weights: {
        offDefBalance: 80,
        homeCourtEdge: 70,
        clutchPerformance: 40,
        recentForm: 30,
        injuryImpact: 30
      }
    }
  },
  {
    id: 'contrarian',
    name: 'The Contrarian',
    description: 'Fade the public, find value in overreactions.',
    icon: TrendingDown,
    color: 'purple',
    philosophy: 'Ignores public-driven factors (recent form, home court, injuries). Emphasizes underlying metrics the public overlooks. Targets 54-57% win rate.',
    totalFactors: {
      enabled: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays', 'injuryImpact'],
      weights: {
        paceIndex: 50,
        netRating: 80,
        shooting: 60,
        homeAwayDiff: 20,
        restDays: 20,
        injuryImpact: 20
      }
    },
    spreadFactors: {
      enabled: ['recentForm', 'homeAwaySplits', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact'],
      weights: {
        recentForm: 10,
        homeAwaySplits: 50,
        offDefBalance: 80,
        homeCourtEdge: 10,
        clutchPerformance: 80,
        injuryImpact: 20
      }
    }
  }
]

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
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [activeBetType, setActiveBetType] = useState<'TOTAL' | 'SPREAD'>('TOTAL')

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
    // If clicking the same preset, deselect it
    if (selectedPreset === preset.id) {
      setSelectedPreset(null)
      return
    }

    setSelectedPreset(preset.id)

    // Apply preset configuration
    const newFactorConfig = {
      TOTAL: {
        enabled_factors: preset.totalFactors.enabled,
        weights: preset.totalFactors.weights
      },
      SPREAD: {
        enabled_factors: preset.spreadFactors.enabled,
        weights: preset.spreadFactors.weights
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
    // For auto/hybrid, also need valid weights
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

  // Get current preset details
  const currentPreset = PRESET_CONFIGS.find(p => p.id === selectedPreset)
  const PresetIcon = currentPreset?.icon || Swords

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
            <h1 className="text-xl font-bold text-white">Create Your Capper</h1>
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
              {/* Avatar/Icon */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${currentPreset
                  ? `bg-gradient-to-br from-${currentPreset.color}-500/30 to-${currentPreset.color}-600/10 border-2 border-${currentPreset.color}-500/50 shadow-lg shadow-${currentPreset.color}-500/20`
                  : 'bg-slate-700/50 border-2 border-slate-600'
                  }`}>
                  <PresetIcon className={`w-16 h-16 transition-all duration-500 ${currentPreset ? `text-${currentPreset.color}-400` : 'text-slate-500'}`} />
                </div>

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

                {/* Archetype Badge */}
                {currentPreset ? (
                  <div className={`px-4 py-2 rounded-full bg-${currentPreset.color}-500/20 border border-${currentPreset.color}-500/50 mb-4`}>
                    <span className={`text-sm font-bold text-${currentPreset.color}-400`}>{currentPreset.name}</span>
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600 mb-4">
                    <span className="text-sm text-slate-400">Select an Archetype</span>
                  </div>
                )}

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
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-4 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
              {[
                { id: 'archetype' as const, label: 'Archetype', icon: Swords },
                { id: 'stats' as const, label: 'Stats', icon: BarChart3 },
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
                <div className="space-y-6">
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

                  {/* Archetype Selection */}
                  {config.pick_mode !== 'manual' && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase mb-3">Choose Your Archetype</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {PRESET_CONFIGS.map(preset => {
                          const Icon = preset.icon
                          const isSelected = selectedPreset === preset.id
                          return (
                            <button
                              key={preset.id}
                              onClick={() => handlePresetSelect(preset)}
                              className={`group p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                ? 'border-amber-500 bg-gradient-to-br from-amber-500/20 to-orange-500/10 shadow-lg shadow-amber-500/20 scale-[1.02]'
                                : 'border-slate-600 hover:border-slate-500 bg-slate-700/30 hover:bg-slate-700/50'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg transition-all ${isSelected ? 'bg-amber-500/30' : 'bg-slate-600 group-hover:bg-slate-500'}`}>
                                  <Icon className={`w-5 h-5 ${isSelected ? 'text-amber-400' : 'text-slate-300'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className={`font-bold text-sm truncate ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                      {preset.name}
                                    </h4>
                                    {isSelected && <ChevronRight className="w-4 h-4 text-amber-400" />}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{preset.description}</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {currentPreset && (
                        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
                          <p className="text-sm text-slate-300 italic">&ldquo;{currentPreset.philosophy}&rdquo;</p>
                        </div>
                      )}
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

              {/* STATS TAB - Compact Design */}
              {activeTab === 'stats' && config.pick_mode !== 'manual' && (
                <div className="space-y-3">
                  {/* Bet Type Toggle + Budget in one row */}
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/50">
                      {(['TOTAL', 'SPREAD'] as const).map(bt => (
                        <button
                          key={bt}
                          onClick={() => setActiveBetType(bt)}
                          className={`py-1.5 px-3 rounded-md font-semibold text-xs transition-all ${activeBetType === bt
                            ? bt === 'TOTAL' ? 'bg-cyan-500/30 text-cyan-400' : 'bg-purple-500/30 text-purple-400'
                            : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          {bt}
                        </button>
                      ))}
                    </div>
                    {/* Compact Weight Budget */}
                    {(() => {
                      const totalW = calculateTotalWeight(activeBetType)
                      const isValid = isWeightValid(activeBetType)
                      return (
                        <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isValid ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${isValid ? 'bg-green-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min((totalW / 250) * 100, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold whitespace-nowrap ${isValid ? 'text-green-400' : 'text-amber-400'}`}>
                            {totalW}%/250%
                          </span>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Compact Factor List */}
                  <div className="space-y-1.5">
                    {AVAILABLE_FACTORS[activeBetType]?.map(factor => {
                      const isEnabled = config.factor_config[activeBetType]?.enabled_factors.includes(factor)
                      const weight = config.factor_config[activeBetType]?.weights[factor] || 50
                      const details = FACTOR_DETAILS[factor as keyof typeof FACTOR_DETAILS]
                      const Icon = details?.icon || Target

                      return (
                        <div
                          key={factor}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${isEnabled ? 'border-amber-500/30 bg-slate-800/60' : 'border-slate-700/50 bg-slate-800/30'
                            }`}
                        >
                          {/* Toggle Button */}
                          <button
                            onClick={() => handleFactorToggle(activeBetType, factor)}
                            className={`w-10 h-5 rounded-full transition flex-shrink-0 ${isEnabled ? 'bg-amber-500' : 'bg-slate-600'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-0.5 ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>

                          {/* Icon + Name */}
                          <Icon className={`w-4 h-4 flex-shrink-0 ${isEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span className={`text-xs font-medium flex-shrink-0 w-24 truncate ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                            {details?.name}
                          </span>

                          {/* Slider (inline when enabled) */}
                          {isEnabled ? (
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={weight}
                                onChange={e => handleWeightChange(activeBetType, factor, parseInt(e.target.value))}
                                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-slate-700"
                                style={{
                                  background: `linear-gradient(to right, rgb(251 191 36) 0%, rgb(251 191 36) ${weight}%, rgb(51 65 85) ${weight}%, rgb(51 65 85) 100%)`
                                }}
                              />
                              <span className="text-sm font-bold text-amber-400 w-10 text-right">{weight}%</span>
                            </div>
                          ) : (
                            <span className="flex-1 text-xs text-slate-500 truncate">{details?.description}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Quick tip */}
                  <p className="text-[10px] text-slate-500 text-center pt-1">
                    💡 Toggle factors on/off, then adjust weights to total 250%
                  </p>
                </div>
              )}

              {activeTab === 'stats' && config.pick_mode === 'manual' && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Hand className="w-16 h-16 text-blue-400 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Manual Mode</h3>
                  <p className="text-slate-400 text-sm">No AI stats to configure in manual mode.</p>
                  <p className="text-blue-400 text-sm mt-2">Switch to AI + Manual mode to customize factors.</p>
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

