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
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, Zap, Hand, GitMerge, Clock, Ban, Gauge, TrendingUp, Target, Home, Battery, Wind, BarChart3, Shield, Trophy, Flame } from 'lucide-react'

type Step = 1 | 2 | 3

type PickMode = 'manual' | 'auto' | 'hybrid'

interface CapperConfig {
  capper_id: string
  display_name: string
  description: string
  color_theme: string
  sport: string
  bet_types: string[]
  pick_mode: PickMode
  auto_generate_hours_before: number
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
  }
}

const AVAILABLE_FACTORS = {
  TOTAL: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays'],
  SPREAD: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance']
}

const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
]

export default function CreateCapperPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pageTopRef = useRef<HTMLDivElement>(null)

  const [config, setConfig] = useState<CapperConfig>({
    capper_id: '',
    display_name: '',
    description: '',
    color_theme: 'blue',
    sport: 'NBA',
    bet_types: ['TOTAL', 'SPREAD'], // Pre-selected, can't be changed
    pick_mode: 'auto',
    auto_generate_hours_before: 4,
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
      const response = await fetch('/api/cappers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.errors?.join(', ') || 'Failed to create capper')
      }

      // Success! Redirect to capper dashboard
      router.push('/dashboard/capper')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsSubmitting(false)
    }
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
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${s === step ? 'bg-primary text-primary-foreground scale-110' :
                s < step ? 'bg-green-500 text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                {s < step ? <CheckCircle className="w-6 h-6" /> : s}
              </div>
              <p className={`text-xs mt-2 font-medium ${s === step ? 'text-primary' : s < step ? 'text-green-500' : 'text-muted-foreground'}`}>
                {s === 1 && 'Pick Strategy'}
                {s === 2 && (shouldSkipFactorConfig ? 'Skipped' : 'Factors')}
                {s === 3 && 'Review'}
              </p>
            </div>
            {s < 3 && <div className={`h-1 w-full mx-4 ${s < step ? 'bg-green-500' : 'bg-muted'}`} />}
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

                {/* Auto-Generated Only */}
                <button
                  onClick={() => updateConfig({ pick_mode: 'auto' })}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${config.pick_mode === 'auto'
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-muted hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <Zap className="w-8 h-8 text-yellow-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">Auto-Generated Only <span className="text-xs text-green-500">(Recommended)</span></h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        AI generates picks based on your custom factor weights. Set timing and team exclusions.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Fully Automated</span>
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Recommended</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Hybrid */}
                <button
                  onClick={() => updateConfig({ pick_mode: 'hybrid' })}
                  className={`w-full p-6 rounded-lg border-2 transition-all text-left ${config.pick_mode === 'hybrid'
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-muted hover:border-primary/50'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <GitMerge className="w-8 h-8 text-purple-500 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">Hybrid (Manual + Auto)</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        AI generates picks, but you can override. Manual picks take priority over auto picks.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Best of Both</span>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">Advanced</span>
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

                  {/* Timing */}
                  <div className="space-y-2">
                    <Label htmlFor="hours_before">Generate picks how many hours before game start?</Label>
                    <Select
                      value={config.auto_generate_hours_before.toString()}
                      onValueChange={(value) => updateConfig({ auto_generate_hours_before: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 hours before</SelectItem>
                        <SelectItem value="3">3 hours before</SelectItem>
                        <SelectItem value="4">4 hours before (Recommended)</SelectItem>
                        <SelectItem value="5">5 hours before</SelectItem>
                        <SelectItem value="6">6 hours before</SelectItem>
                        <SelectItem value="8">8 hours before</SelectItem>
                        <SelectItem value="12">12 hours before</SelectItem>
                        <SelectItem value="24">24 hours before</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      💡 4-6 hours recommended for best odds availability
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
            </>
          )}

          {/* Step 2: Factor Configuration (only shown if auto or hybrid mode) */}
          {step === 2 && (
            <div className="space-y-6">
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
                {(config.pick_mode === 'auto' || config.pick_mode === 'hybrid') && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <Label className="text-muted-foreground text-xs">Auto-Generation Settings</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm">{config.auto_generate_hours_before} hours before game</span>
                      </div>
                      {config.excluded_teams.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-red-500" />
                          <span className="text-sm">{config.excluded_teams.length} team(s) excluded</span>
                        </div>
                      )}
                    </div>
                    {config.excluded_teams.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Excluded Teams:</p>
                        <div className="flex flex-wrap gap-1">
                          {config.excluded_teams.map(team => (
                            <span key={team} className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                              {team}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Factor Configuration (only if auto/hybrid) */}
              {config.pick_mode !== 'manual' && (
                <div>
                  <Label className="text-base font-semibold mb-3 block">Factor Configuration</Label>
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
              <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border-2 border-green-500/30 rounded-lg px-6 py-4">
                <p className="font-bold text-lg flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-6 h-6" />
                  Ready to Launch!
                </p>
                <p className="text-sm mt-2 text-slate-300">
                  {config.pick_mode === 'manual'
                    ? 'Your capper will be created. You can start making manual picks immediately from the dashboard.'
                    : `Your capper will be created and start auto-generating picks ${config.auto_generate_hours_before} hours before each game. Picks will appear on your dashboard within 15 minutes.`
                  }
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
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
              >
                {isSubmitting ? 'Becoming a Capper...' : 'Become a Capper'}
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

