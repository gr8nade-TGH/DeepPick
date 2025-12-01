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
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Plus
} from 'lucide-react'

interface FactorProposal {
  name: string
  key: string
  description: string
  stats_used: string[]
  formula: string
  direction: 'higher_over' | 'higher_under' | 'higher_favorite' | 'higher_underdog'
  betting_thesis: string
  edge_explanation: string
  confidence: 'high' | 'medium' | 'low'
}

interface FactorStrategistProps {
  open: boolean
  onClose: () => void
  onCreateFactor?: (factor: FactorProposal, betType: string) => void
}

export function FactorStrategist({ open, onClose, onCreateFactor }: FactorStrategistProps) {
  const [betType, setBetType] = useState<'TOTALS' | 'SPREAD'>('TOTALS')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<FactorProposal[]>([])
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set())
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const generateFactors = async () => {
    setLoading(true)
    setError(null)
    setProposals([])

    try {
      const response = await fetch('/api/admin/factors/strategist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betType, count: 8 })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate factors')
      }

      const data = await response.json()
      setProposals(data.factors)
      setGeneratedAt(data.generated_at)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedFactors)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedFactors(newExpanded)
  }

  const getDirectionInfo = (direction: string) => {
    switch (direction) {
      case 'higher_over':
        return { label: 'Higher → OVER', color: 'text-green-400', icon: TrendingUp }
      case 'higher_under':
        return { label: 'Higher → UNDER', color: 'text-blue-400', icon: TrendingDown }
      case 'higher_favorite':
        return { label: 'Higher → Favorite Covers', color: 'text-amber-400', icon: Target }
      case 'higher_underdog':
        return { label: 'Higher → Underdog Covers', color: 'text-purple-400', icon: Shield }
      default:
        return { label: direction, color: 'text-slate-400', icon: Target }
    }
  }

  const getConfidenceInfo = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return { label: 'High Confidence', color: 'bg-green-500/20 text-green-400 border-green-500/50' }
      case 'medium':
        return { label: 'Medium', color: 'bg-amber-500/20 text-amber-400 border-amber-500/50' }
      case 'low':
        return { label: 'Experimental', color: 'bg-slate-500/20 text-slate-400 border-slate-500/50' }
      default:
        return { label: confidence, color: 'bg-slate-500/20 text-slate-400 border-slate-500/50' }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Brain className="w-6 h-6 text-purple-400" />
            AI Factor Strategist
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50 ml-2">
              GPT-4o
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Let AI think like a pro bettor and propose strategic factor combinations
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selection */}
        <div className="flex gap-3 py-4 border-b border-slate-700">
          <Button
            variant={betType === 'TOTALS' ? 'default' : 'outline'}
            onClick={() => setBetType('TOTALS')}
            className={betType === 'TOTALS'
              ? 'bg-gradient-to-r from-green-600 to-emerald-600'
              : ''}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            TOTALS Factors
          </Button>
          <Button
            variant={betType === 'SPREAD' ? 'default' : 'outline'}
            onClick={() => setBetType('SPREAD')}
            className={betType === 'SPREAD'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600'
              : ''}
          >
            <Target className="w-4 h-4 mr-2" />
            SPREAD Factors
          </Button>

          <div className="flex-1" />

          <Button
            onClick={generateFactors}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Thinking like a sharp...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Factor Ideas
              </>
            )}
          </Button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto py-4">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {!loading && proposals.length === 0 && !error && (
            <div className="text-center py-16 text-slate-500">
              <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">Ready to think like a sharp</p>
              <p className="text-sm">Select a bet type and click "Generate Factor Ideas"</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-400" />
              <p className="text-slate-400">AI is analyzing 55 stats and designing optimal factors...</p>
              <p className="text-sm text-slate-500 mt-2">This may take 10-20 seconds</p>
            </div>
          )}

          {proposals.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                <span>Generated {proposals.length} factor proposals for {betType}</span>
                {generatedAt && (
                  <span>Generated at {new Date(generatedAt).toLocaleTimeString()}</span>
                )}
              </div>

              {proposals.map((factor) => {
                const isExpanded = expandedFactors.has(factor.key)
                const dirInfo = getDirectionInfo(factor.direction)
                const confInfo = getConfidenceInfo(factor.confidence)
                const DirIcon = dirInfo.icon

                return (
                  <div
                    key={factor.key}
                    className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all"
                  >
                    {/* Header */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleExpanded(factor.key)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-lg">{factor.name}</span>
                            <Badge variant="outline" className="text-xs text-slate-400">
                              {factor.key}
                            </Badge>
                            <Badge className={confInfo.color + ' text-xs'}>
                              {confInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{factor.description}</p>

                          {/* Stats used */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs text-slate-500">Uses:</span>
                            {factor.stats_used.map(stat => (
                              <Badge key={stat} variant="outline" className="text-xs text-cyan-400 border-cyan-500/30">
                                {stat}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Direction badge */}
                          <div className={`flex items-center gap-1 ${dirInfo.color}`}>
                            <DirIcon className="w-4 h-4" />
                            <span className="text-xs">{dirInfo.label}</span>
                          </div>

                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
                        {/* Formula */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Formula</h4>
                          <code className="text-sm text-cyan-400 bg-slate-900/50 px-2 py-1 rounded">
                            {factor.formula}
                          </code>
                        </div>

                        {/* Betting Thesis */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            Betting Thesis
                          </h4>
                          <p className="text-sm text-slate-300">{factor.betting_thesis}</p>
                        </div>

                        {/* Edge Explanation */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Market Edge
                          </h4>
                          <p className="text-sm text-slate-300">{factor.edge_explanation}</p>
                        </div>

                        {/* Create Button */}
                        <div className="flex justify-end pt-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onCreateFactor?.(factor, betType)
                            }}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Create This Factor
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            💡 AI thinks like a professional handicapper to find edges the market misses
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

