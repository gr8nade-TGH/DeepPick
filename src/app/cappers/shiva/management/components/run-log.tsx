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
  // Baseline and market data
  baseline_avg?: number
  market_total?: number
}

interface CooldownEntry {
  id: string
  game_id: string
  capper: string
  bet_type: string
  cooldown_until: string
  result: string
  units: number
  matchup?: string
}

export function RunLogTable() {
  const [runs, setRuns] = useState<RunLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())
  const [cooldowns, setCooldowns] = useState<CooldownEntry[]>([])
  const [clearingCooldown, setClearingCooldown] = useState<string | null>(null)
  const [clearingAllRuns, setClearingAllRuns] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [isMounted, setIsMounted] = useState(false)

  // console.log('[RunLogTable] Component mounted/rendered')

  // Track when component is mounted to avoid hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    async function fetchRunLog() {
      try {
        // console.log('[RunLogTable] Fetching run history...')
        // Add cache-busting timestamp to prevent stale data
        const timestamp = Date.now()
        const response = await fetch(`/api/shiva/runs/history?limit=50&_t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        // console.log('[RunLogTable] Response status:', response.status)
        if (response.ok) {
          const data = await response.json()
          // console.log('[RunLogTable] Data received:', data)
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

    async function fetchCooldowns() {
      try {
        // Add cache-busting timestamp to prevent stale data
        const timestamp = Date.now()
        const response = await fetch(`/api/shiva/cooldowns?_t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        if (response.ok) {
          const data = await response.json()
          setCooldowns(data.cooldowns || [])
        }
      } catch (error) {
        console.error('[RunLogTable] Failed to fetch cooldowns:', error)
      }
    }

    fetchRunLog()
    fetchCooldowns()

    // Refresh every 30 seconds to see new runs
    const runInterval = setInterval(fetchRunLog, 30000)
    const cooldownInterval = setInterval(fetchCooldowns, 30000)
    return () => {
      clearInterval(runInterval)
      clearInterval(cooldownInterval)
    }
  }, [])

  // Update timer every second for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
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

  // Format factor contribution with OVER/UNDER indicator (3 decimal places for precision)
  // Now uses overScore/underScore from parsed_values_json instead of net contribution
  // Returns JSX with colored OVER/UNDER text
  const formatFactorContribution = (factor: any): JSX.Element => {
    if (!factor) return <span>—</span>

    const parsedValues = factor.parsed_values_json || {}

    // Safely parse scores with fallback to 0
    // Use Number() to handle string numbers and ensure valid number
    const overScore = Number(parsedValues.overScore) || 0
    const underScore = Number(parsedValues.underScore) || 0

    // Validate that we have valid numbers
    if (isNaN(overScore) || isNaN(underScore)) {
      console.warn('[RunLog] Invalid factor scores:', { factor: factor.key, overScore, underScore, parsedValues })
      return <span className="text-red-400">ERR</span>
    }

    // Determine which score is higher
    if (overScore > underScore) {
      return (
        <span>
          +{overScore.toFixed(2)} <span className="text-blue-400">OVER</span>
        </span>
      )
    } else if (underScore > overScore) {
      return (
        <span>
          +{underScore.toFixed(2)} <span className="text-orange-400">UNDER</span>
        </span>
      )
    } else {
      return <span>0 NEUTRAL</span>
    }
  }

  // Extract pick type from selection string with market total
  const getPickType = (run: RunLogEntry): string => {
    if (run.units === 0 || run.units === null) return 'PASS'
    if (!run.selection) return '—'

    // If selection already includes the total (e.g., "OVER 223.5"), return as-is
    if (run.selection.match(/\d+(\.\d+)?/)) {
      return run.selection
    }

    // Otherwise, append market total to OVER/UNDER
    const marketTotal = run.market_total || 0
    if (run.selection.toUpperCase().includes('OVER')) {
      return `OVER ${marketTotal.toFixed(1)}`
    }
    if (run.selection.toUpperCase().includes('UNDER')) {
      return `UNDER ${marketTotal.toFixed(1)}`
    }

    return run.selection.split(' ')[0]?.toUpperCase() || '—'
  }

  // Get a specific factor object (not just the contribution value)
  const getFactor = (run: RunLogEntry, key: string): any | null => {
    if (!run.factor_contributions) return null
    return run.factor_contributions.find(f => f.key === key) || null
  }

  // Format countdown timer
  const formatCountdown = (until: string): string => {
    const untilTime = new Date(until).getTime()
    const remaining = untilTime - now
    if (remaining <= 0) return 'Expired'
    const hours = Math.floor(remaining / 3600000)
    const minutes = Math.floor((remaining % 3600000) / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${hours}h ${minutes}m ${seconds}s`
  }

  // Clear cooldown
  const handleClearCooldown = async (cooldownId: string) => {
    console.log('[RunLogTable] Clearing cooldown:', cooldownId)
    setClearingCooldown(cooldownId)
    try {
      const response = await fetch(`/api/shiva/cooldowns/${cooldownId}`, { method: 'DELETE' })
      const json = await response.json()
      console.log('[RunLogTable] Clear response:', json)
      if (response.ok) {
        // Remove from local state immediately - no refetch needed
        setCooldowns(prev => prev.filter(cd => cd.id !== cooldownId))
      } else {
        console.error('[RunLogTable] Failed to clear cooldown:', json)
      }
    } catch (error) {
      console.error('[RunLogTable] Failed to clear cooldown:', error)
    } finally {
      setClearingCooldown(null)
    }
  }

  // Clear all runs
  const handleClearAllRuns = async () => {
    if (!confirm('Are you sure you want to clear ALL runs? This cannot be undone.')) {
      return
    }

    console.log('[RunLogTable] Clearing all runs...')
    setClearingAllRuns(true)
    try {
      const response = await fetch('/api/shiva/runs/clear', { method: 'DELETE' })
      const json = await response.json()
      console.log('[RunLogTable] Clear all runs response:', json)
      if (response.ok) {
        // Clear local state immediately
        setRuns([])
        setCooldowns([])

        // Force refetch with cache-busting to verify deletion
        setTimeout(async () => {
          const timestamp = Date.now()
          const verifyResponse = await fetch(`/api/shiva/runs/history?limit=50&_t=${timestamp}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          })
          if (verifyResponse.ok) {
            const data = await verifyResponse.json()
            setRuns(data.runs || [])
            console.log('[RunLogTable] Verified runs after clear:', data.runs?.length || 0)
          }

          const cooldownResponse = await fetch(`/api/shiva/cooldowns?_t=${timestamp}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          })
          if (cooldownResponse.ok) {
            const data = await cooldownResponse.json()
            setCooldowns(data.cooldowns || [])
            console.log('[RunLogTable] Verified cooldowns after clear:', data.cooldowns?.length || 0)
          }
        }, 500) // Wait 500ms for database to propagate

        alert(`Successfully cleared ${json.deletedCount || 0} runs, ${json.shivaRunsDeleted || 0} shiva_runs, and ${json.cooldownsDeleted || 0} cooldowns!`)
      } else {
        console.error('[RunLogTable] Failed to clear runs:', json)
        alert(`Failed to clear runs: ${json.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[RunLogTable] Failed to clear runs:', error)
      alert('Failed to clear runs. Check console for details.')
    } finally {
      setClearingAllRuns(false)
    }
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

  // console.log('[RunLogTable] Rendering with', runs.length, 'runs')

  // Copy debug info to clipboard
  const handleCopyDebugInfo = async () => {
    const debugInfo = {
      total_runs: runs.length,
      runs: runs.map(run => ({
        run_id: run.run_id,
        game_id: run.game_id,
        matchup: run.matchup,
        created_at: run.created_at,
        pick_type: run.pick_type,
        selection: run.selection,
        units: run.units,
        confidence: run.confidence,
        cooldown_result: run.cooldown_result,
        factor_contributions: run.factor_contributions,
        predicted_total: run.predicted_total,
        baseline_avg: run.baseline_avg,
        market_total: run.market_total
      })),
      cooldowns: cooldowns.map(cd => ({
        id: cd.id,
        game_id: cd.game_id,
        capper: cd.capper,
        bet_type: cd.bet_type,
        cooldown_until: cd.cooldown_until,
        result: cd.result,
        units: cd.units,
        matchup: cd.matchup
      }))
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      alert('Debug info copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy debug info:', error)
      alert('Failed to copy debug info. Check console for details.')
    }
  }

  // Download full debug export as JSON file
  const handleDownloadFullDebug = async () => {
    try {
      console.log('[RunLogTable] Fetching full debug export...')
      const timestamp = Date.now()
      const response = await fetch(`/api/shiva/runs/debug-export?limit=100&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch debug export: ${response.status}`)
      }

      const data = await response.json()
      console.log('[RunLogTable] Debug export received:', data.summary)

      // Create formatted JSON string
      const jsonString = JSON.stringify(data, null, 2)

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Generate filename with timestamp
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      link.download = `shiva-run-log-debug-${dateStr}.json`

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      alert(`✅ Downloaded debug export with ${data.runs?.length || 0} runs!\n\nSummary:\n- Pick Generated: ${data.summary?.pick_generated_count || 0}\n- Pass: ${data.summary?.pass_count || 0}\n- Avg Confidence: ${data.summary?.average_confidence?.toFixed(2) || 'N/A'}`)
    } catch (error) {
      console.error('[RunLogTable] Failed to download debug export:', error)
      alert('❌ Failed to download debug export. Check console for details.')
    }
  }

  // Copy cooldown debug info to clipboard
  const handleCopyCooldownDebug = async () => {
    const cooldownDebugInfo = {
      total_cooldowns: cooldowns.length,
      current_time: new Date().toISOString(),
      cooldowns: cooldowns.map(cd => ({
        id: cd.id,
        game_id: cd.game_id,
        capper: cd.capper,
        bet_type: cd.bet_type,
        cooldown_until: cd.cooldown_until,
        result: cd.result,
        units: cd.units,
        matchup: cd.matchup,
        is_expired: new Date(cd.cooldown_until).getTime() <= Date.now(),
        time_remaining_ms: new Date(cd.cooldown_until).getTime() - Date.now()
      }))
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(cooldownDebugInfo, null, 2))
      alert('Cooldown debug info copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy cooldown debug info:', error)
      alert('Failed to copy cooldown debug info. Check console for details.')
    }
  }

  return (
    <div className="flex flex-col gap-4" style={{ maxHeight: '400px' }}>
      {/* Run Log Table */}
      <div className="border border-gray-700 rounded bg-gray-900 overflow-hidden flex flex-col" style={{ height: '250px' }}>
        <div className="p-3 border-b border-gray-700 flex-shrink-0 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">📋 Run Log ({runs.length})</h3>
          <div className="flex gap-2">
            <button
              onClick={handleClearAllRuns}
              disabled={clearingAllRuns || runs.length === 0}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              title="Clear all runs from the database"
            >
              {clearingAllRuns ? '🗑️ Clearing...' : '🗑️ Clear All Runs'}
            </button>
            <button
              onClick={handleCopyDebugInfo}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              title="Copy Run Log debug info to clipboard"
            >
              📋 Copy Run Log Debug
            </button>
            <button
              onClick={handleDownloadFullDebug}
              disabled={runs.length === 0}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              title="Download comprehensive debug export with all factor calculations and step data"
            >
              💾 Download Full Debug JSON
            </button>
          </div>
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
                  {factorKeys.map(key => (
                    <th key={key} className="text-center py-2 px-1 text-gray-400 font-bold text-xs">
                      {getFactorShortName(key)}
                    </th>
                  ))}
                  <th className="text-left py-2 px-2 text-gray-400 font-bold">Conf</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-bold">Units</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-bold">Proj</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-bold">Avg</th>
                  <th className="text-left py-2 px-2 text-gray-400 font-bold">Mkt</th>
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
                      {factorKeys.map(key => {
                        const factor = getFactor(run, key)
                        const parsedValues = factor?.parsed_values_json || {}
                        const overScore = parsedValues.overScore || 0
                        const underScore = parsedValues.underScore || 0
                        const maxScore = Math.max(overScore, underScore)
                        const isSignificant = maxScore > 0.1

                        return (
                          <td key={key} className={`py-2 px-1 text-center text-xs font-mono ${factor ? (isSignificant ? 'text-green-400' : 'text-gray-300') : 'text-gray-500'}`}>
                            {formatFactorContribution(factor)}
                          </td>
                        )
                      })}
                      <td className="py-2 px-2 text-gray-300">
                        {run.confidence !== null && run.confidence !== undefined ? run.confidence.toFixed(3) : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-300">{run.units || 0}</td>
                      <td className="py-2 px-2 text-gray-300 font-mono text-xs">
                        {run.predicted_total ? run.predicted_total.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-300 font-mono text-xs">
                        {run.baseline_avg ? run.baseline_avg.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-300 font-mono text-xs">
                        {run.market_total ? run.market_total.toFixed(1) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cooldown Management Table */}
      {cooldowns.length > 0 && (
        <div className="border border-gray-700 rounded bg-gray-900 overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">⏸️ Cooldowns ({cooldowns.length})</h3>
            <button
              onClick={handleCopyCooldownDebug}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              title="Copy Cooldown debug info to clipboard"
            >
              📋 Copy Cooldown Debug
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '130px' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-bold">Game</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-bold">Result</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-bold">Units</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-bold">Time Remaining</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {cooldowns.map((cd, idx) => {
                  // Only calculate isExpired after component is mounted to avoid hydration mismatch
                  const isExpired = isMounted ? new Date(cd.cooldown_until).getTime() <= now : false
                  return (
                    <tr key={idx} className={`border-b border-gray-800 hover:bg-gray-800 ${isExpired ? 'opacity-50' : ''}`}>
                      <td className="py-2 px-3 text-gray-300 text-xs">{cd.matchup || cd.game_id?.substring(0, 12)}</td>
                      <td className="py-2 px-3">
                        <span className={`font-bold ${cd.result === 'PASS' ? 'text-yellow-400' : 'text-green-400'}`}>
                          {cd.result}
                        </span>
                        {isMounted && isExpired && <span className="ml-2 text-xs text-gray-500">(EXPIRED)</span>}
                      </td>
                      <td className="py-2 px-3 text-gray-300">{cd.units || 0}</td>
                      <td className="py-2 px-3 font-mono text-orange-400">
                        {!isMounted ? 'Loading...' : isExpired ? 'EXPIRED' : formatCountdown(cd.cooldown_until)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleClearCooldown(cd.id)}
                          disabled={clearingCooldown === cd.id}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs rounded"
                        >
                          {clearingCooldown === cd.id ? 'Clearing...' : 'Clear'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

