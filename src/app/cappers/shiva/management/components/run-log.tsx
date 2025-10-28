"use client"
import { useEffect, useState } from 'react'

interface FactorContribution {
  key: string
  name: string
  z: number
  weight: number
  contribution: number
}

interface RunLogEntry {
  run_id: string
  game_id: string
  matchup?: string
  pick_type: string | null
  selection: string | null
  units: number | null
  confidence: number | null
  created_at: string
  result?: 'PICK_GENERATED' | 'PASS' | 'ERROR'
  // From cooldowns table
  cooldown_result?: string
  cooldown_until?: string
  // Factor data
  factor_contributions?: FactorContribution[]
  factor_adjustments?: Record<string, number>
  predicted_total?: number
}

export function RunLogTable() {
  const [runs, setRuns] = useState<RunLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())

  console.log('[RunLogTable] Component mounted/rendered')

  useEffect(() => {
    async function fetchRunLog() {
      try {
        console.log('[RunLogTable] Fetching run history...')
        const response = await fetch('/api/shiva/runs/history?limit=50')
        console.log('[RunLogTable] Response status:', response.status)
        if (response.ok) {
          const data = await response.json()
          console.log('[RunLogTable] Data received:', data)
          setRuns(data.runs || [])
        } else {
          console.error('[RunLogTable] Failed to fetch run log:', response.status)
        }
      } catch (error) {
        console.error('[RunLogTable] Failed to fetch run log:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRunLog()
    
    // Refresh every 30 seconds to see new runs
    const interval = setInterval(fetchRunLog, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const getOutcome = (run: RunLogEntry): string => {
    // Check cooldown result first (most accurate)
    if (run.cooldown_result) {
      return run.cooldown_result
    }
    // Fallback to units-based detection
    if (run.units === null || run.units === undefined) {
      return 'UNKNOWN'
    }
    return run.units > 0 ? 'PICK_GENERATED' : 'PASS'
  }

  const getBetType = (run: RunLogEntry): string => {
    if (!run.pick_type) return 'UNKNOWN'
    const type = run.pick_type.toUpperCase()
    if (type === 'TOTAL') return 'TOTALS'
    if (type === 'SPREAD' || type === 'MONEYLINE' || type === 'ML') return 'ML/ATS'
    return type
  }

  const toggleExpand = (runId: string) => {
    setExpandedRuns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(runId)) {
        newSet.delete(runId)
      } else {
        newSet.add(runId)
      }
      return newSet
    })
  }

  const getOutcomeColor = (outcome: string) => {
    if (outcome === 'PICK_GENERATED') return 'text-green-400'
    if (outcome === 'PASS') return 'text-yellow-400'
    if (outcome === 'ERROR') return 'text-red-400'
    return 'text-gray-400'
  }

  // Factor key to short name mapping
  const getFactorShortName = (key: string): string => {
    const mapping: Record<string, string> = {
      'edgeVsMarket': 'EM',
      'paceIndex': 'PI',
      'offForm': 'OF',
      'defErosion': 'DE',
      'threeEnv': '3E',
      'whistleEnv': 'WE',
      'injuryAvailability': 'IA'
    }
    return mapping[key] || key.substring(0, 2).toUpperCase()
  }

  // Format factor contribution with O/U indicator (3 decimal places for precision)
  const formatFactorContribution = (contribution: number): string => {
    if (contribution === 0) return '0O'
    const absValue = Math.abs(contribution)
    const direction = contribution > 0 ? 'O' : 'U'
    // Use 3 decimal places to show small values better
    return `+${absValue.toFixed(3)}${direction}`
  }
  
  // Extract pick type from selection string
  const getPickType = (run: RunLogEntry): string => {
    if (run.units === 0 || run.units === null) return 'PASS'
    if (!run.selection) return '—'
    if (run.selection.toUpperCase().includes('OVER')) return 'OVER'
    if (run.selection.toUpperCase().includes('UNDER')) return 'UNDER'
    return run.selection.split(' ')[0]?.toUpperCase() || '—'
  }

  // Get a specific factor's contribution value
  const getFactorValue = (run: RunLogEntry, key: string): number | null => {
    if (!run.factor_contributions) return null
    const factor = run.factor_contributions.find(f => f.key === key)
    return factor ? factor.contribution : null
  }

  // Define factor keys in order
  const factorKeys = ['edgeVsMarket', 'paceIndex', 'offForm', 'defErosion', 'threeEnv', 'whistleEnv', 'injuryAvailability']

  if (loading) {
    return (
      <div className="border border-gray-700 rounded p-3 bg-gray-900">
        <h3 className="text-lg font-bold text-white mb-3">Run Log</h3>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  console.log('[RunLogTable] Rendering with', runs.length, 'runs')

  return (
    <div className="border border-gray-700 rounded bg-gray-900 overflow-hidden flex flex-col" style={{ height: '300px' }}>
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <h3 className="text-lg font-bold text-white">📋 Run Log ({runs.length})</h3>
      </div>
      
      {runs.length === 0 ? (
        <div className="p-3 text-gray-400 text-sm">No runs found. Run pick generation in Write mode to see results.</div>
      ) : (
        <div className="overflow-y-auto overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Time</th>
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Game</th>
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Outcome</th>
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Pick</th>
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Units</th>
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Conf</th>
                {factorKeys.map(key => (
                  <th key={key} className="text-center py-2 px-1 text-gray-400 font-bold text-xs">
                    {getFactorShortName(key)}
                  </th>
                ))}
                <th className="text-left py-2 px-2 text-gray-400 font-bold">Proj</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, idx) => {
                const outcome = getOutcome(run)
                const betType = getBetType(run)
                const shortRunId = run.run_id.length > 12 ? run.run_id.substring(0, 12) + '...' : run.run_id
                
                return (
                  <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="py-2 px-2 text-gray-300">{formatDateTime(run.created_at)}</td>
                    <td className="py-2 px-2 text-gray-300 text-xs">{run.matchup || run.game_id?.substring(0, 8) + '...'}</td>
                    <td className={`py-2 px-2 font-bold ${getOutcomeColor(outcome)}`}>
                      {outcome}
                    </td>
                    <td className={`py-2 px-2 font-bold ${getPickType(run) === 'PASS' ? 'text-yellow-400' : getPickType(run) === 'OVER' ? 'text-green-400' : 'text-red-400'}`}>
                      {getPickType(run)}
                    </td>
                    <td className="py-2 px-2 text-gray-300">{run.units || 0}</td>
                    <td className="py-2 px-2 text-gray-300">
                      {run.confidence !== null && run.confidence !== undefined ? run.confidence.toFixed(3) : '—'}
                    </td>
                    {factorKeys.map(key => {
                      const value = getFactorValue(run, key)
                      const absValue = value !== null ? Math.abs(value) : 0
                      // Use 0.1 threshold for 3 decimal places (instead of 1 for 2 decimal places)
                      return (
                        <td key={key} className={`py-2 px-1 text-center text-xs font-mono ${value !== null ? (absValue > 0.1 ? 'text-green-400' : 'text-gray-300') : 'text-gray-500'}`}>
                          {value !== null ? formatFactorContribution(value) : '—'}
                        </td>
                      )
                    })}
                    <td className="py-2 px-2 text-gray-300 font-mono text-xs">
                      {run.predicted_total ? run.predicted_total.toFixed(1) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

