'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Sliders, Save, X, RotateCcw, Gauge, TrendingUp, Target, Home, Battery, UserX, Flame, Wind, BarChart3, Shield, Trophy, Anchor, Scale, Rocket, Castle, TrendingDown, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FactorConfig {
  enabled_factors: string[]
  weights: { [factor: string]: number }
}

interface FactorConfigurationProps {
  capperId: string
  betTypes: string[]
  factorConfig: {
    [betType: string]: FactorConfig
  }
  onUpdate: () => void
}

const FACTOR_DETAILS = {
  // TOTAL factors
  paceIndex: {
    name: 'Pace Index',
    icon: Gauge,
    description: 'Expected game pace based on both teams\' recent pace',
    defaultWeight: 50,
    color: 'cyan'
  },
  netRating: {
    name: 'Net Rating',
    icon: TrendingUp,
    description: 'Combined offensive and defensive efficiency differential',
    defaultWeight: 50,
    color: 'green'
  },
  shooting: {
    name: 'Shooting Performance',
    icon: Target,
    description: '3PT% and FG% trends over last 5 games',
    defaultWeight: 50,
    color: 'orange'
  },
  homeAwayDiff: {
    name: 'Home/Away Split',
    icon: Home,
    description: 'Home vs away scoring differential',
    defaultWeight: 50,
    color: 'blue'
  },
  restDays: {
    name: 'Rest & Fatigue',
    icon: Battery,
    description: 'Days of rest and back-to-back game impact',
    defaultWeight: 50,
    color: 'yellow'
  },
  injuryImpact: {
    name: 'Key Injuries',
    icon: UserX,
    description: 'Impact of injured players on game outcome',
    defaultWeight: 50,
    color: 'red'
  },
  // SPREAD factors
  recentForm: {
    name: 'Recent Form (ATS)',
    icon: Flame,
    description: 'Against-the-spread performance over last 3 and 10 games',
    defaultWeight: 50,
    color: 'red'
  },
  paceMismatch: {
    name: 'Pace Mismatch',
    icon: Wind,
    description: 'Fast vs slow tempo differential between teams',
    defaultWeight: 50,
    color: 'purple'
  },
  offDefBalance: {
    name: 'Offensive/Defensive Balance',
    icon: BarChart3,
    description: 'Team efficiency ratings on both ends of the floor',
    defaultWeight: 50,
    color: 'blue'
  },
  homeCourtEdge: {
    name: 'Home Court Edge',
    icon: Home,
    description: 'Home court advantage impact on spread outcomes',
    defaultWeight: 50,
    color: 'green'
  },
  clutchPerformance: {
    name: 'Clutch Performance',
    icon: Trophy,
    description: 'Performance in close games and 4th quarter situations',
    defaultWeight: 50,
    color: 'yellow'
  }
}

const AVAILABLE_FACTORS = {
  TOTAL: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays', 'injuryImpact'],
  SPREAD: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact']
}

const PRESET_CONFIGS = [
  {
    id: 'conservative',
    name: 'The Conservative',
    description: 'Low-risk, high-confidence plays',
    icon: Anchor,
    color: 'blue',
    totalFactors: {
      enabled: ['netRating', 'restDays', 'injuryImpact', 'homeAwayDiff', 'paceIndex'],
      weights: { netRating: 70, restDays: 60, injuryImpact: 60, homeAwayDiff: 40, paceIndex: 20 }
    },
    spreadFactors: {
      enabled: ['offDefBalance', 'homeCourtEdge', 'injuryImpact', 'clutchPerformance', 'recentForm'],
      weights: { offDefBalance: 70, homeCourtEdge: 60, injuryImpact: 50, clutchPerformance: 40, recentForm: 30 }
    }
  },
  {
    id: 'balanced',
    name: 'The Balanced Sharp',
    description: 'Well-rounded, data-driven approach',
    icon: Scale,
    color: 'slate',
    totalFactors: {
      enabled: ['paceIndex', 'netRating', 'shooting', 'restDays', 'injuryImpact'],
      weights: { paceIndex: 45, netRating: 50, shooting: 50, restDays: 50, injuryImpact: 55 }
    },
    spreadFactors: {
      enabled: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'injuryImpact'],
      weights: { recentForm: 50, paceMismatch: 50, offDefBalance: 50, homeCourtEdge: 50, injuryImpact: 50 }
    }
  },
  {
    id: 'pace-demon',
    name: 'The Pace Demon',
    description: 'High-scoring, fast-paced games',
    icon: Rocket,
    color: 'orange',
    totalFactors: {
      enabled: ['paceIndex', 'shooting', 'netRating', 'homeAwayDiff'],
      weights: { paceIndex: 100, shooting: 70, netRating: 50, homeAwayDiff: 30 }
    },
    spreadFactors: {
      enabled: ['paceMismatch', 'offDefBalance', 'recentForm', 'homeCourtEdge', 'clutchPerformance'],
      weights: { paceMismatch: 80, offDefBalance: 60, recentForm: 50, homeCourtEdge: 30, clutchPerformance: 30 }
    }
  },
  {
    id: 'grind-it-out',
    name: 'The Grind-It-Out',
    description: 'Defense wins championships',
    icon: Castle,
    color: 'emerald',
    totalFactors: {
      enabled: ['netRating', 'restDays', 'homeAwayDiff', 'injuryImpact', 'paceIndex'],
      weights: { netRating: 80, restDays: 70, homeAwayDiff: 50, injuryImpact: 35, paceIndex: 15 }
    },
    spreadFactors: {
      enabled: ['offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'recentForm', 'injuryImpact'],
      weights: { offDefBalance: 80, homeCourtEdge: 70, clutchPerformance: 40, recentForm: 30, injuryImpact: 30 }
    }
  },
  {
    id: 'contrarian',
    name: 'The Contrarian',
    description: 'Fade the public, find value',
    icon: TrendingDown,
    color: 'purple',
    totalFactors: {
      enabled: ['paceIndex', 'netRating', 'shooting', 'homeAwayDiff', 'restDays', 'injuryImpact'],
      weights: { paceIndex: 50, netRating: 80, shooting: 60, homeAwayDiff: 20, restDays: 20, injuryImpact: 20 }
    },
    spreadFactors: {
      enabled: ['recentForm', 'paceMismatch', 'offDefBalance', 'homeCourtEdge', 'clutchPerformance', 'injuryImpact'],
      weights: { recentForm: 10, paceMismatch: 50, offDefBalance: 80, homeCourtEdge: 10, clutchPerformance: 80, injuryImpact: 20 }
    }
  }
]

export function FactorConfiguration({ capperId, betTypes, factorConfig, onUpdate }: FactorConfigurationProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedBetType, setSelectedBetType] = useState(betTypes[0] || 'TOTAL')
  const [localConfig, setLocalConfig] = useState(factorConfig)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const calculateTotalWeight = (betType: string): number => {
    const factorCfg = localConfig[betType]
    if (!factorCfg) return 0
    return factorCfg.enabled_factors.reduce((sum, factor) => sum + (factorCfg.weights[factor] || 0), 0)
  }

  const isWeightValid = (betType: string): boolean => {
    const total = calculateTotalWeight(betType)
    return Math.abs(total - 250) < 0.01
  }

  const handleFactorToggle = (betType: string, factor: string) => {
    const newFactorConfig = { ...localConfig }
    const enabled = newFactorConfig[betType].enabled_factors
    newFactorConfig[betType].enabled_factors = enabled.includes(factor)
      ? enabled.filter(f => f !== factor)
      : [...enabled, factor]
    setLocalConfig(newFactorConfig)
  }

  const handleWeightChange = (betType: string, factor: string, value: number) => {
    const newFactorConfig = { ...localConfig }
    const currentTotal = calculateTotalWeight(betType)
    const currentWeight = newFactorConfig[betType].weights[factor] || 0
    const weightDiff = value - currentWeight
    const newTotal = currentTotal + weightDiff

    if (newTotal > 250) {
      const maxAllowed = 250 - (currentTotal - currentWeight)
      newFactorConfig[betType].weights[factor] = Math.max(0, maxAllowed)
    } else {
      newFactorConfig[betType].weights[factor] = value
    }
    setLocalConfig(newFactorConfig)
  }

  const handlePresetSelect = (preset: any) => {
    const isCurrentlySelected = selectedPreset === preset.id

    if (isCurrentlySelected) {
      // Deselect preset
      setSelectedPreset(null)
    } else {
      // Apply preset
      setSelectedPreset(preset.id)
      const newConfig = { ...localConfig }

      // Apply TOTAL factors
      newConfig.TOTAL = {
        enabled_factors: preset.totalFactors.enabled,
        weights: preset.totalFactors.weights
      }

      // Apply SPREAD factors
      newConfig.SPREAD = {
        enabled_factors: preset.spreadFactors.enabled,
        weights: preset.spreadFactors.weights
      }

      setLocalConfig(newConfig)

      toast({
        title: `${preset.name} Applied`,
        description: preset.description,
        variant: 'default'
      })
    }
  }

  const handleReset = () => {
    const resetConfig = { ...localConfig }
    betTypes.forEach(betType => {
      const availableFactors = AVAILABLE_FACTORS[betType as keyof typeof AVAILABLE_FACTORS] || []
      resetConfig[betType] = {
        enabled_factors: availableFactors,
        weights: availableFactors.reduce((acc, factor) => {
          acc[factor] = 50
          return acc
        }, {} as { [key: string]: number })
      }
    })
    setLocalConfig(resetConfig)
    setSelectedPreset(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/user-cappers/update-factors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capper_id: capperId, factor_config: localConfig })
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to update factors')
      toast({ title: 'Factors Updated', description: 'Your factor configuration has been saved successfully' })
      setEditing(false)
      onUpdate()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update factors', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setLocalConfig(factorConfig)
    setEditing(false)
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            Factor Configuration
          </CardTitle>
          <CardDescription className="text-slate-400">
            Distribute 250% total weight across all factors
          </CardDescription>
        </div>
        {!editing && (
          <Button onClick={() => setEditing(true)} variant="outline" className="border-slate-700 hover:bg-slate-800">
            <Sliders className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset Configurations */}
        {editing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Quick Apply Presets</h3>
            </div>
            <p className="text-xs text-slate-400">
              Choose a recommended configuration or customize your own below. Click a preset again to deselect it.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRESET_CONFIGS.map(preset => {
                const PresetIcon = preset.icon
                const isSelected = selectedPreset === preset.id

                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-3 border-2 rounded-lg transition-all text-left ${isSelected
                        ? `border-${preset.color}-500 bg-${preset.color}-500/10 shadow-lg shadow-${preset.color}-500/20`
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <PresetIcon className={`w-5 h-5 flex-shrink-0 ${isSelected ? `text-${preset.color}-400` : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {preset.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">{preset.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {betTypes.length > 1 && (
          <Tabs value={selectedBetType} onValueChange={setSelectedBetType}>
            <TabsList className="bg-slate-900 border border-slate-700">
              {betTypes.map((betType) => (
                <TabsTrigger key={betType} value={betType} className="data-[state=active]:bg-slate-700">
                  {betType}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {betTypes.map(betType => {
          const totalWeight = calculateTotalWeight(betType)
          const remainingWeight = 250 - totalWeight
          const isValid = isWeightValid(betType)
          if (betType !== selectedBetType) return null

          return (
            <div key={betType} className="space-y-4">
              {editing && (
                <div className={`p-3 rounded border ${isValid ? 'bg-green-500/10 border-green-500/30' : remainingWeight > 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="text-sm font-medium text-white">Weight Budget: {totalWeight.toFixed(0)}% / 250%</div>
                  <div className={`text-xs mt-1 ${isValid ? 'text-green-400' : remainingWeight > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {isValid ? '✓ Perfect! All weight allocated.' : remainingWeight > 0 ? `${remainingWeight.toFixed(0)}% remaining` : `Over by ${Math.abs(remainingWeight).toFixed(0)}%`}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AVAILABLE_FACTORS[betType as keyof typeof AVAILABLE_FACTORS]?.map(factor => {
                  const isEnabled = localConfig[betType]?.enabled_factors.includes(factor)
                  const weight = localConfig[betType]?.weights[factor] || 50
                  const details = FACTOR_DETAILS[factor as keyof typeof FACTOR_DETAILS]
                  const Icon = details?.icon || Target
                  const colorClass = details?.color || 'blue'

                  return (
                    <div key={factor} className={`relative border-2 rounded-xl p-4 transition-all ${editing ? 'cursor-pointer' : ''} ${isEnabled ? `border-${colorClass}-500 bg-${colorClass}-500/5` : 'border-slate-700 bg-slate-800/50'}`}
                      onClick={() => editing && !isEnabled && handleFactorToggle(betType, factor)}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${isEnabled ? `bg-${colorClass}-500/20` : 'bg-slate-700'}`}>
                          <Icon className={`w-5 h-5 ${isEnabled ? `text-${colorClass}-400` : 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${betType}-${factor}`} className="cursor-pointer font-semibold text-sm">{details?.name}</Label>
                            {editing && <Checkbox id={`${betType}-${factor}`} checked={isEnabled} onCheckedChange={() => handleFactorToggle(betType, factor)} onClick={(e) => e.stopPropagation()} />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{details?.description}</p>
                        </div>
                      </div>

                      {isEnabled && editing && (
                        <div className="space-y-2 pt-3 border-t border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Weight</span>
                            <span className={`text-lg font-bold text-${colorClass}-400`}>{weight}%</span>
                          </div>
                          <input type="range" min="0" max="100" value={weight} onChange={e => handleWeightChange(betType, factor, parseInt(e.target.value))} onClick={(e) => e.stopPropagation()} className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-${colorClass}-500`} />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      )}

                      {isEnabled && !editing && (
                        <div className="pt-3 border-t border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Weight</span>
                            <span className={`text-lg font-bold text-${colorClass}-400`}>{weight}%</span>
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

        {editing && (
          <div className="flex gap-2 pt-4 border-t border-slate-700">
            <Button onClick={handleSave} disabled={saving || !betTypes.every(bt => isWeightValid(bt))} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {saving ? <>Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
            </Button>
            <Button onClick={handleReset} disabled={saving} variant="outline" className="border-slate-700 hover:bg-slate-800">
              <RotateCcw className="w-4 h-4 mr-2" />Reset
            </Button>
            <Button onClick={handleCancel} disabled={saving} variant="outline" className="border-slate-700 hover:bg-slate-800">
              <X className="w-4 h-4 mr-2" />Cancel
            </Button>
          </div>
        )}

        {!editing && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-400">
              💡 <strong>Tip:</strong> Distribute 250% total weight across all factors. Higher weights = more influence on predictions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

