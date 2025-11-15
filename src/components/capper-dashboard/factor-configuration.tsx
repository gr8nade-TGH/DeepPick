'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sliders, Save, X, RotateCcw, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const FACTOR_DESCRIPTIONS: { [key: string]: string } = {
  'F1_Baseline': 'Team season averages and recent form',
  'F2_HomeAway': 'Home court advantage and travel factors',
  'F3_HeadToHead': 'Historical matchup performance',
  'F4_Injuries': 'Impact of injured players on team performance',
  'F5_RestDays': 'Back-to-back games and fatigue factors',
  'F6_EdgeVsMarket': 'Difference between prediction and market odds'
}

const DEFAULT_WEIGHTS: { [key: string]: number } = {
  'F1_Baseline': 1.0,
  'F2_HomeAway': 1.0,
  'F3_HeadToHead': 1.0,
  'F4_Injuries': 1.0,
  'F5_RestDays': 1.0,
  'F6_EdgeVsMarket': 1.0
}

export function FactorConfiguration({ capperId, betTypes, factorConfig, onUpdate }: FactorConfigurationProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedBetType, setSelectedBetType] = useState(betTypes[0] || 'TOTAL')
  const [localConfig, setLocalConfig] = useState(factorConfig)

  const currentConfig = localConfig[selectedBetType] || {
    enabled_factors: Object.keys(DEFAULT_WEIGHTS),
    weights: DEFAULT_WEIGHTS
  }

  const handleWeightChange = (factor: string, value: number) => {
    setLocalConfig(prev => ({
      ...prev,
      [selectedBetType]: {
        ...prev[selectedBetType],
        weights: {
          ...prev[selectedBetType]?.weights,
          [factor]: value
        }
      }
    }))
  }

  const handleToggleFactor = (factor: string) => {
    const enabledFactors = currentConfig.enabled_factors || []
    const newEnabledFactors = enabledFactors.includes(factor)
      ? enabledFactors.filter(f => f !== factor)
      : [...enabledFactors, factor]

    setLocalConfig(prev => ({
      ...prev,
      [selectedBetType]: {
        ...prev[selectedBetType],
        enabled_factors: newEnabledFactors
      }
    }))
  }

  const handleReset = () => {
    setLocalConfig(prev => ({
      ...prev,
      [selectedBetType]: {
        enabled_factors: Object.keys(DEFAULT_WEIGHTS),
        weights: DEFAULT_WEIGHTS
      }
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch('/api/user-cappers/update-factors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capper_id: capperId,
          factor_config: localConfig
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update factors')
      }

      toast({
        title: 'Factors Updated',
        description: 'Your factor configuration has been saved successfully',
      })

      setEditing(false)
      onUpdate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update factors',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setLocalConfig(factorConfig)
    setEditing(false)
  }

  const getFactorColor = (weight: number) => {
    if (weight >= 1.5) return 'text-emerald-400'
    if (weight >= 1.0) return 'text-blue-400'
    if (weight >= 0.5) return 'text-yellow-400'
    return 'text-slate-400'
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
            Customize how each factor influences your picks
          </CardDescription>
        </div>
        {!editing && (
          <Button
            onClick={() => setEditing(true)}
            variant="outline"
            className="border-slate-700 hover:bg-slate-800"
          >
            <Sliders className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bet Type Tabs */}
        {betTypes.length > 1 && (
          <Tabs value={selectedBetType} onValueChange={setSelectedBetType}>
            <TabsList className="bg-slate-900 border border-slate-700">
              {betTypes.map((betType) => (
                <TabsTrigger
                  key={betType}
                  value={betType}
                  className="data-[state=active]:bg-slate-700"
                >
                  {betType}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Factor List */}
        <div className="space-y-3">
          {Object.keys(DEFAULT_WEIGHTS).map((factor) => {
            const isEnabled = currentConfig.enabled_factors?.includes(factor) ?? true
            const weight = currentConfig.weights?.[factor] ?? DEFAULT_WEIGHTS[factor]
            const description = FACTOR_DESCRIPTIONS[factor] || 'No description available'

            return (
              <div
                key={factor}
                className={`p-4 rounded-lg border transition-all ${
                  isEnabled
                    ? 'bg-slate-900/50 border-slate-700'
                    : 'bg-slate-900/20 border-slate-800 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-medium">{factor}</h4>
                      {editing && (
                        <button
                          onClick={() => handleToggleFactor(factor)}
                          className={`text-xs px-2 py-1 rounded ${
                            isEnabled
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-700 text-slate-400 border border-slate-600'
                          }`}
                        >
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      )}
                      {!editing && (
                        <Badge
                          variant="outline"
                          className={isEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400'}
                        >
                          {isEnabled ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getFactorColor(weight)}`}>
                      {weight.toFixed(1)}x
                    </p>
                  </div>
                </div>

                {/* Weight Slider */}
                {editing && isEnabled && (
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={weight}
                      onChange={(e) => handleWeightChange(factor, parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>0.0x (Ignore)</span>
                      <span>1.0x (Normal)</span>
                      <span>2.0x (Double)</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        {editing && (
          <div className="flex gap-2 pt-4 border-t border-slate-700">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              disabled={saving}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleCancel}
              disabled={saving}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}

        {/* Info Box */}
        {!editing && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-400">
              💡 <strong>Tip:</strong> Higher weights (1.5x-2.0x) make factors more influential. Lower weights (0.0x-0.5x) reduce their impact.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

