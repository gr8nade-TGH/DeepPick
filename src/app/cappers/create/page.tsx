'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles } from 'lucide-react'

type Step = 1 | 2 | 3 | 4 | 5

interface CapperConfig {
  capper_id: string
  display_name: string
  description: string
  color_theme: string
  sport: string
  bet_types: string[]
  factor_config: {
    [betType: string]: {
      enabled_factors: string[]
      weights: { [factor: string]: number }
    }
  }
  execution_interval_minutes: number
  execution_priority: number
}

const AVAILABLE_FACTORS = {
  TOTAL: ['F1', 'F2', 'F3', 'F4', 'F5'],
  SPREAD: ['S1', 'S2', 'S3', 'S4', 'S5']
}

const COLOR_THEMES = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' }
]

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' }
]

export default function CreateCapperPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [config, setConfig] = useState<CapperConfig>({
    capper_id: '',
    display_name: '',
    description: '',
    color_theme: 'blue',
    sport: 'NBA',
    bet_types: [],
    factor_config: {},
    execution_interval_minutes: 15,
    execution_priority: 5
  })

  const updateConfig = (updates: Partial<CapperConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  const handleCapperIdChange = (displayName: string) => {
    const capper_id = displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)

    updateConfig({ display_name: displayName, capper_id })
  }

  const handleBetTypeToggle = (betType: string) => {
    const newBetTypes = config.bet_types.includes(betType)
      ? config.bet_types.filter(bt => bt !== betType)
      : [...config.bet_types, betType]

    // Initialize factor config for new bet types
    const newFactorConfig = { ...config.factor_config }
    newBetTypes.forEach(bt => {
      if (!newFactorConfig[bt]) {
        const factors = AVAILABLE_FACTORS[bt as keyof typeof AVAILABLE_FACTORS] || []
        newFactorConfig[bt] = {
          enabled_factors: factors,
          weights: factors.reduce((acc, f) => ({ ...acc, [f]: 1.0 }), {})
        }
      }
    })

    updateConfig({ bet_types: newBetTypes, factor_config: newFactorConfig })
  }

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
    newFactorConfig[betType].weights[factor] = value
    updateConfig({ factor_config: newFactorConfig })
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return config.capper_id.length >= 3 && config.display_name.length >= 3
      case 2:
        return config.bet_types.length > 0
      case 3:
        return config.bet_types.every(bt =>
          config.factor_config[bt]?.enabled_factors.length > 0
        )
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  }

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

      // Success! Redirect to system health to see the new capper
      router.push('/admin/system-health')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-yellow-500" />
          Create a Capper
        </h1>
        <p className="text-muted-foreground mt-2">
          Build your own automated sports betting AI with custom factor configurations
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${s === step ? 'bg-primary text-primary-foreground' :
                s < step ? 'bg-green-500 text-white' :
                  'bg-muted text-muted-foreground'
              }`}>
              {s < step ? <CheckCircle className="w-5 h-5" /> : s}
            </div>
            {s < 5 && <div className={`h-1 w-16 mx-2 ${s < step ? 'bg-green-500' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Capper Identity'}
            {step === 2 && 'Sport & Bet Types'}
            {step === 3 && 'Factor Configuration'}
            {step === 4 && 'Execution Schedule'}
            {step === 5 && 'Review & Launch'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'Choose a unique name and description for your capper'}
            {step === 2 && 'Select which sport and bet types your capper will analyze'}
            {step === 3 && 'Configure which factors to use and their weights'}
            {step === 4 && 'Set how often your capper should generate picks'}
            {step === 5 && 'Review your configuration and launch your capper'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Identity */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  placeholder="e.g., IFRIT, CERBERUS, NEXUS"
                  value={config.display_name}
                  onChange={(e) => handleCapperIdChange(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Capper ID: <code className="bg-muted px-2 py-1 rounded">{config.capper_id || 'auto-generated'}</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your capper's strategy and approach..."
                  value={config.description}
                  onChange={(e) => updateConfig({ description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Color Theme</Label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_THEMES.map(theme => (
                    <button
                      key={theme.value}
                      onClick={() => updateConfig({ color_theme: theme.value })}
                      className={`p-3 rounded-lg border-2 transition-all ${config.color_theme === theme.value ? 'border-primary scale-105' : 'border-muted'
                        }`}
                    >
                      <div className={`w-full h-8 rounded ${theme.class}`} />
                      <p className="text-xs mt-1">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Sport & Bet Types */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Sport *</Label>
                <Select value={config.sport} onValueChange={(value) => updateConfig({ sport: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NBA">NBA</SelectItem>
                    <SelectItem value="NFL" disabled>NFL (Coming Soon)</SelectItem>
                    <SelectItem value="MLB" disabled>MLB (Coming Soon)</SelectItem>
                    <SelectItem value="NHL" disabled>NHL (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bet Types * (Select at least one)</Label>
                <div className="space-y-2">
                  {['TOTAL', 'SPREAD'].map(betType => (
                    <div key={betType} className="flex items-center space-x-2">
                      <Checkbox
                        id={betType}
                        checked={config.bet_types.includes(betType)}
                        onCheckedChange={() => handleBetTypeToggle(betType)}
                      />
                      <Label htmlFor={betType} className="cursor-pointer">
                        {betType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Factor Configuration */}
          {step === 3 && (
            <div className="space-y-6">
              {config.bet_types.map(betType => (
                <div key={betType} className="space-y-4">
                  <h3 className="font-semibold text-lg">{betType} Factors</h3>

                  {AVAILABLE_FACTORS[betType as keyof typeof AVAILABLE_FACTORS]?.map(factor => {
                    const isEnabled = config.factor_config[betType]?.enabled_factors.includes(factor)
                    const weight = config.factor_config[betType]?.weights[factor] || 1.0

                    return (
                      <div key={factor} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${betType}-${factor}`}
                              checked={isEnabled}
                              onCheckedChange={() => handleFactorToggle(betType, factor)}
                            />
                            <Label htmlFor={`${betType}-${factor}`} className="cursor-pointer font-medium">
                              {factor}
                            </Label>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Weight: {weight.toFixed(1)}x
                          </span>
                        </div>

                        {isEnabled && (
                          <div className="space-y-2">
                            <Slider
                              value={[weight]}
                              onValueChange={([value]) => handleWeightChange(betType, factor, value)}
                              min={0.1}
                              max={2.0}
                              step={0.1}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0.1x (Low)</span>
                              <span>1.0x (Normal)</span>
                              <span>2.0x (High)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Execution Schedule */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Execution Interval *</Label>
                <Select
                  value={config.execution_interval_minutes.toString()}
                  onValueChange={(value) => updateConfig({ execution_interval_minutes: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  How often should your capper check for new games and generate picks?
                </p>
              </div>

              <div className="space-y-2">
                <Label>Priority (1-10) *</Label>
                <div className="space-y-2">
                  <Slider
                    value={[config.execution_priority]}
                    onValueChange={([value]) => updateConfig({ execution_priority: value })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 (Low)</span>
                    <span className="font-medium text-foreground">{config.execution_priority}</span>
                    <span>10 (High)</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Higher priority cappers execute first when multiple cappers are due at the same time
                </p>
              </div>
            </>
          )}

          {/* Step 5: Review & Launch */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Display Name</Label>
                  <p className="font-medium">{config.display_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Capper ID</Label>
                  <p className="font-mono text-sm">{config.capper_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Sport</Label>
                  <p className="font-medium">{config.sport}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bet Types</Label>
                  <p className="font-medium">{config.bet_types.join(', ')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Execution Interval</Label>
                  <p className="font-medium">
                    {INTERVAL_OPTIONS.find(o => o.value === config.execution_interval_minutes)?.label}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <p className="font-medium">{config.execution_priority}/10</p>
                </div>
              </div>

              {config.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{config.description}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground mb-2 block">Factor Configuration</Label>
                {config.bet_types.map(betType => (
                  <div key={betType} className="mb-4">
                    <p className="font-medium mb-2">{betType}:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {config.factor_config[betType]?.enabled_factors.map(factor => (
                        <div key={factor} className="flex justify-between bg-muted px-3 py-2 rounded">
                          <span>{factor}</span>
                          <span className="text-muted-foreground">
                            {config.factor_config[betType].weights[factor].toFixed(1)}x
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
                <p className="font-medium">Ready to launch!</p>
                <p className="text-sm mt-1">
                  Your capper will be created and automatically added to the execution schedule.
                  It will start generating picks within {config.execution_interval_minutes} minutes.
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
              onClick={() => step > 1 ? setStep((step - 1) as Step) : router.push('/admin/system-health')}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 5 ? (
              <Button
                onClick={() => setStep((step + 1) as Step)}
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
                {isSubmitting ? 'Creating...' : 'Create Capper'}
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

