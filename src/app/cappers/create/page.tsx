'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, Zap, Hand, GitMerge, Clock, Ban, Gauge, TrendingUp, Target, Home, Battery, Wind, BarChart3, Shield, Trophy, Flame, UserX, Anchor, Scale, Rocket, Castle, TrendingDown, ExternalLink, Eye, Loader2, AlertCircle, Share2, Globe } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

type Step = 1 | 2 | 3

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
  paceMismatch: {
    name: 'Pace Mismatch',
    icon: Wind,
    description: 'Fast vs slow tempo differential between teams',
    importance: 'Slower team typically gets ATS edge in pace mismatches.',
    example: 'Fast team (105 pace) vs slow team (95 pace) → Slower team gets +3.8 ATS edge.',
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
  SPREAD: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact']
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
      enabled: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'injuryImpact'],
      weights: {
        recentForm: 50,
        paceMismatch: 50,
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
      enabled: ['paceMismatch', 'offDefBalance', 'recentForm', 'homeCourtEdge', 'clutchPerformance'],
      weights: {
        paceMismatch: 80,
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
      enabled: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact'],
      weights: {
        recentForm: 10,
        paceMismatch: 50,
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
  const [step, setStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const pageTopRef = useRef<HTMLDivElement>(null)

  const [config, setConfig] = useState<CapperConfig>({
    capper_id: '',
    display_name: '',
    description: '',
    color_theme: 'blue',
    sport: 'NBA',
    bet_types: ['TOTAL', 'SPREAD'], // Pre-selected, can't be changed
    pick_mode: 'auto',
    excluded_teams: [],
    factor_config: {
      // Initialize with default weights for both bet types (50% each = 250% total)
      TOTAL: {
        enabled_factors: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays'],
        weights: { paceIndex: 50, netRating: 50, shooting: 50, homeAwayDiff: 50, restDays: 50 }
      },
      SPREAD: {
        enabled_factors: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance'],
        weights: { recentForm: 50, paceMismatch: 50, offDefBalance: 50, homeCourtEdge: 50, clutchPerformance: 50 }
      }
    },
    execution_interval_minutes: 15,
    execution_priority: 5
  })

  const [socialLinks, setSocialLinks] = useState({
    twitter: '',
    instagram: '',
    youtube: '',
    website: ''
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

      setConfig(prev => ({
        ...prev,
        display_name: displayName,
        capper_id: capperId
      }))
    }
  }, [profile])

  // Scroll to top when step changes
  useEffect(() => {
    pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const updateConfig = (updates: Partial<CapperConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
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

  const canProceed = () => {
    switch (step) {
      case 1:
        // Pick mode must be selected
        return config.pick_mode !== null
      case 2:
        // If manual mode, skip factor config - always can proceed
        if (config.pick_mode === 'manual') return true
        // Otherwise, ensure all bet types have valid weight allocation (250%)
        return config.bet_types.every(bt => isWeightValid(bt))
      case 3:
        // Review step - always can proceed
        return true
      default:
        return false
    }
  }

  // Determine if we should skip step 2 (factor config) for manual mode
  const shouldSkipFactorConfig = config.pick_mode === 'manual'

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Filter out empty social links
      const filteredSocialLinks = Object.fromEntries(
        Object.entries(socialLinks).filter(([_, value]) => value.trim() !== '')
      )

      const response = await fetch('/api/cappers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          social_links: filteredSocialLinks
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

  return (
    <div ref={pageTopRef} className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-yellow-500" />
          Become a Capper
        </h1>
        <p className="text-muted-foreground mt-2">
          Build your own automated sports betting AI with custom factor configurations
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold transition-all ${s === step
                ? 'bg-blue-600 text-white scale-110 ring-4 ring-blue-500/30'
                : s < step
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-400'
                }`}>
                {s < step ? <CheckCircle className="w-7 h-7" /> : <span className="text-lg">{s}</span>}
              </div>
              <p className={`text-sm mt-2 font-semibold ${s === step
                ? 'text-blue-400'
                : s < step
                  ? 'text-green-400'
                  : 'text-slate-500'
                }`}>
                {s === 1 && 'Pick Strategy'}
                {s === 2 && (shouldSkipFactorConfig ? 'Skipped' : 'Factors')}
                {s === 3 && 'Review'}
              </p>
            </div>
            {s < 3 && <div className={`h-1 w-full mx-4 transition-all ${s < step ? 'bg-green-500' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Choose Your Pick Strategy'}
            {step === 2 && 'Configure Factor Weights'}
            {step === 3 && 'Review & Launch'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'How do you want to make your picks?'}
            {step === 2 && 'Customize which factors influence your AI predictions (250% total allocation)'}
            {step === 3 && 'Review your configuration and activate your capper'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Pick Strategy */}
          {step === 1 && (
            <>
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-2 border-blue-500/30 rounded-lg px-6 py-4">
                <p className="font-bold text-lg flex items-center gap-2 text-blue-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  Welcome to Capper Creation!
                </p>
                <p className="text-sm text-slate-300">
                  You're about to create your own AI-powered sports betting capper. This 3-step wizard will help you configure your pick generation strategy, factor weights, and launch your capper in minutes.
                </p>
              </div>

              {/* User Info Display */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-muted-foreground text-xs">Capper Name</Label>
                    <p className="font-bold text-lg">{config.display_name || 'Loading...'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ID: <code className="bg-muted px-1.5 py-0.5 rounded">{config.capper_id || 'generating...'}</code>
                    </p>
                  </div>
                  <div className="text-right">
                    <Label className="text-muted-foreground text-xs">Bet Types</Label>
                    <p className="font-semibold">NBA - TOTAL & SPREAD</p>
                    <p className="text-xs text-green-500 mt-0.5">✓ Pre-configured</p>
                  </div>
                </div>
              </div>

              {/* Pick Mode Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Pick Mode *</Label>

                {/* Manual Only */}
                <button
                  onClick={() => updateConfig({ pick_mode: 'manual' })}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${config.pick_mode === 'manual'
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-muted hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <Hand className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">Manual Only</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        You make all picks yourself. No automation.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Full Control</span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">No AI</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Sharp Auto-Generated + Manual Picks */}
                <button
                  onClick={() => updateConfig({ pick_mode: 'hybrid' })}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${config.pick_mode === 'hybrid'
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-muted hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <Zap className="w-8 h-8 text-yellow-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">Sharp Auto-Generated + Manual Picks <span className="text-xs text-green-500">(Recommended)</span></h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        AI generates sharp picks automatically based on your custom factor weights, plus you can add manual picks anytime.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Automated + Manual</span>
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Recommended</span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Auto/Hybrid Settings */}
              {(config.pick_mode === 'auto' || config.pick_mode === 'hybrid') && (
                <div className="space-y-4 pt-4 border-t border-slate-700">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-500" />
                    Auto-Generation Settings
                  </h3>

                  {/* Auto-Generation Info */}
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <p className="text-sm text-cyan-400">
                      ⚡ Picks are automatically generated throughout the day as games approach. The system checks for new games every few minutes and generates picks when conditions are optimal.
                    </p>
                  </div>

                  {/* Team Exclusions */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Exclude Teams (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Select teams you want to pick manually. AI won't generate picks for these teams.
                    </p>
                    <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/50 rounded-lg border border-slate-700">
                      {NBA_TEAMS.map(team => (
                        <button
                          key={team}
                          onClick={() => handleTeamToggle(team)}
                          className={`px-3 py-2 rounded text-xs font-semibold transition-all ${config.excluded_teams.includes(team)
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                          {team}
                        </button>
                      ))}
                    </div>
                    {config.excluded_teams.length > 0 && (
                      <p className="text-xs text-red-400">
                        ✓ {config.excluded_teams.length} team(s) excluded from auto-generation
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Social Links (Optional) */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                <h3 className="font-semibold flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-500" />
                  Social Links (Optional)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add your social media links to showcase on your public capper profile. These are completely optional.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Twitter */}
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Twitter / X
                    </Label>
                    <input
                      type="url"
                      placeholder="https://twitter.com/username"
                      value={socialLinks.twitter}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Instagram */}
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      Instagram
                    </Label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/username"
                      value={socialLinks.instagram}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* YouTube */}
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                      YouTube
                    </Label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/@username"
                      value={socialLinks.youtube}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, youtube: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Website
                    </Label>
                    <input
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={socialLinks.website}
                      onChange={(e) => setSocialLinks(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Factor Configuration (only shown if auto or hybrid mode) */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Preset Configuration Selection */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Quick Start Presets (Optional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a recommended configuration or customize your own below. Click a preset again to deselect it.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PRESET_CONFIGS.map(preset => {
                    const PresetIcon = preset.icon
                    const isSelected = selectedPreset === preset.id

                    return (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset)}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${isSelected
                          ? `border-${preset.color}-500 bg-${preset.color}-500/10 shadow-lg shadow-${preset.color}-500/20`
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                          }`}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${isSelected ? `bg-${preset.color}-500/20` : 'bg-slate-700'}`}>
                            <PresetIcon className={`w-5 h-5 ${isSelected ? `text-${preset.color}-400` : 'text-slate-400'}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{preset.name}</h4>
                            {isSelected && (
                              <span className="text-xs text-green-400">✓ Selected</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {preset.description}
                        </p>
                        <p className="text-xs text-slate-400 italic">
                          {preset.philosophy}
                        </p>
                      </button>
                    )
                  })}
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400">
                    💡 <strong>Tip:</strong> Presets auto-configure all factors and weights. You can still customize individual factors below after selecting a preset.
                  </p>
                </div>
              </div>

              {/* Factor Configuration by Bet Type */}
              {config.bet_types.map(betType => {
                const totalWeight = calculateTotalWeight(betType)
                const remainingWeight = 250 - totalWeight
                const isValid = isWeightValid(betType)

                return (
                  <div key={betType} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{betType} Factors</h3>
                    </div>

                    {/* Weight Budget Display */}
                    <div className={`p-3 rounded border ${isValid
                      ? 'bg-green-500/10 border-green-500/30'
                      : remainingWeight > 0
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                      }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-white">
                            Weight Budget: {totalWeight.toFixed(0)}% / 250%
                          </div>
                          <div className={`text-xs mt-1 ${isValid
                            ? 'text-green-400'
                            : remainingWeight > 0
                              ? 'text-blue-400'
                              : 'text-red-400'
                            }`}>
                            {isValid
                              ? '✓ Perfect! All weight allocated.'
                              : remainingWeight > 0
                                ? `${remainingWeight.toFixed(0)}% remaining to allocate`
                                : `Over budget by ${Math.abs(remainingWeight).toFixed(0)}%`
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      💡 Distribute <strong>250% total weight</strong> across all factors. Higher weights = more influence on predictions.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {AVAILABLE_FACTORS[betType as keyof typeof AVAILABLE_FACTORS]?.map(factor => {
                        const isEnabled = config.factor_config[betType]?.enabled_factors.includes(factor)
                        const weight = config.factor_config[betType]?.weights[factor] || 50
                        const details = FACTOR_DETAILS[factor as keyof typeof FACTOR_DETAILS]
                        const Icon = details?.icon || Target
                        const colorClass = details?.color || 'blue'

                        return (
                          <div
                            key={factor}
                            className={`relative border-2 rounded-xl p-4 transition-all cursor-pointer ${isEnabled
                              ? `border-${colorClass}-500 bg-${colorClass}-500/5 shadow-lg shadow-${colorClass}-500/20`
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                              }`}
                            onClick={() => !isEnabled && handleFactorToggle(betType, factor)}
                          >
                            {/* Header */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${isEnabled ? `bg-${colorClass}-500/20` : 'bg-slate-700'}`}>
                                <Icon className={`w-5 h-5 ${isEnabled ? `text-${colorClass}-400` : 'text-slate-400'}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor={`${betType}-${factor}`} className="cursor-pointer font-semibold text-sm">
                                    {details?.name}
                                  </Label>
                                  <Checkbox
                                    id={`${betType}-${factor}`}
                                    checked={isEnabled}
                                    onCheckedChange={() => handleFactorToggle(betType, factor)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {details?.description}
                                </p>
                              </div>
                            </div>

                            {/* Weight Slider (only when enabled) */}
                            {isEnabled && (
                              <div className="space-y-2 pt-3 border-t border-slate-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">Weight</span>
                                  <span className={`text-lg font-bold text-${colorClass}-400`}>{weight}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={weight}
                                  onChange={e => handleWeightChange(betType, factor, parseInt(e.target.value))}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-${colorClass}-500`}
                                  style={{
                                    background: `linear-gradient(to right, rgb(var(--${colorClass}-500)) 0%, rgb(var(--${colorClass}-500)) ${weight}%, rgb(51 65 85) ${weight}%, rgb(51 65 85) 100%)`
                                  }}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>0%</span>
                                  <span>50%</span>
                                  <span>100%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-primary/30 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                  Capper Configuration Summary
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Capper Name</Label>
                    <p className="font-bold text-lg">{config.display_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Capper ID</Label>
                    <p className="font-mono text-sm">{config.capper_id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Sport & Bet Types</Label>
                    <p className="font-medium">{config.sport} - {config.bet_types.join(' & ')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Pick Mode</Label>
                    <p className="font-medium capitalize flex items-center gap-2">
                      {config.pick_mode === 'manual' && <><Hand className="w-4 h-4" /> Manual Only</>}
                      {config.pick_mode === 'auto' && <><Zap className="w-4 h-4 text-yellow-500" /> Auto-Generated</>}
                      {config.pick_mode === 'hybrid' && <><GitMerge className="w-4 h-4 text-purple-500" /> Hybrid</>}
                    </p>
                  </div>
                </div>

                {/* Auto/Hybrid Settings */}
                {(config.pick_mode === 'auto' || config.pick_mode === 'hybrid') && config.excluded_teams.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <Label className="text-muted-foreground text-xs">Excluded Teams</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      <span className="text-sm">{config.excluded_teams.length} team(s) excluded from auto-generation</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1">
                        {config.excluded_teams.map(team => (
                          <span key={team} className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                            {team}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Factor Configuration (only if auto/hybrid) */}
              {config.pick_mode !== 'manual' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">Factor Configuration</Label>
                    {selectedPreset && (
                      <span className="text-sm text-muted-foreground">
                        Using preset: <span className="text-primary font-semibold">{PRESET_CONFIGS.find(p => p.id === selectedPreset)?.name}</span>
                      </span>
                    )}
                  </div>
                  {config.bet_types.map(betType => (
                    <div key={betType} className="mb-4 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <p className="font-semibold mb-3 text-primary">{betType} Factors:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {config.factor_config[betType]?.enabled_factors.map(factor => {
                          const details = FACTOR_DETAILS[factor as keyof typeof FACTOR_DETAILS]
                          return (
                            <div key={factor} className="flex justify-between bg-slate-900/50 px-3 py-2 rounded border border-slate-700">
                              <span className="font-medium">{factor}: {details?.name}</span>
                              <span className="text-primary font-bold">
                                {config.factor_config[betType].weights[factor].toFixed(1)}x
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ready to Launch */}
              <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border-2 border-green-500/30 rounded-lg px-6 py-5">
                <p className="font-bold text-xl flex items-center gap-2 text-green-400 mb-3">
                  <CheckCircle className="w-6 h-6" />
                  Ready to Launch!
                </p>
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    {config.pick_mode === 'manual'
                      ? 'Your capper will be created and ready for manual picks.'
                      : 'Your capper will be created and start auto-generating picks throughout the day as games approach.'
                    }
                  </p>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      What happens next:
                    </p>
                    <ul className="text-sm text-slate-300 space-y-1.5 ml-6">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>You'll be redirected to your <strong>Capper Dashboard</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>
                          {config.pick_mode === 'manual'
                            ? 'Start making manual picks for upcoming games'
                            : 'Picks will auto-generate within 15 minutes and appear on your dashboard'
                          }
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>View your public profile to see how others see your picks</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>Track performance, win rate, and ROI in real-time</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border-2 border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 1) {
                  router.push('/admin/system-health')
                } else if (step === 3 && shouldSkipFactorConfig) {
                  // If on review and skipped factor config, go back to step 1
                  setStep(1)
                } else {
                  setStep((step - 1) as Step)
                }
              }}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => {
                  // If on step 1 and manual mode, skip to step 3 (review)
                  if (step === 1 && shouldSkipFactorConfig) {
                    setStep(3)
                  } else {
                    setStep((step + 1) as Step)
                  }
                }}
                disabled={!canProceed()}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Capper...
                  </>
                ) : (
                  <>
                    Become a Capper
                    <Sparkles className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

