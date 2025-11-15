'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, Zap, Hand, GitMerge, Clock, Ban, Save, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface CapperData {
  capper_id: string
  pick_mode: 'manual' | 'auto' | 'hybrid'
  auto_generate_hours_before: number
  excluded_teams: string[]
  execution_interval_minutes: number
}

interface QuickSettingsProps {
  capperData: CapperData
  onUpdate: () => void
}

const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
]

export function QuickSettings({ capperData, onUpdate }: QuickSettingsProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pickMode, setPickMode] = useState(capperData.pick_mode)
  const [excludedTeams, setExcludedTeams] = useState<string[]>(capperData.excluded_teams || [])
  const [hoursBeforeGame, setHoursBeforeGame] = useState(capperData.auto_generate_hours_before)
  const [intervalMinutes, setIntervalMinutes] = useState(capperData.execution_interval_minutes)

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const response = await fetch('/api/user-cappers/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capper_id: capperData.capper_id,
          pick_mode: pickMode,
          excluded_teams: excludedTeams,
          auto_generate_hours_before: hoursBeforeGame,
          execution_interval_minutes: intervalMinutes
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update settings')
      }

      toast({
        title: 'Settings Updated',
        description: 'Your capper settings have been saved successfully',
      })

      setEditing(false)
      onUpdate()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update settings',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setPickMode(capperData.pick_mode)
    setExcludedTeams(capperData.excluded_teams || [])
    setHoursBeforeGame(capperData.auto_generate_hours_before)
    setIntervalMinutes(capperData.execution_interval_minutes)
    setEditing(false)
  }

  const toggleTeam = (team: string) => {
    setExcludedTeams(prev =>
      prev.includes(team)
        ? prev.filter(t => t !== team)
        : [...prev, team]
    )
  }

  const getPickModeIcon = (mode: string) => {
    switch (mode) {
      case 'manual': return <Hand className="w-4 h-4" />
      case 'auto': return <Zap className="w-4 h-4" />
      case 'hybrid': return <GitMerge className="w-4 h-4" />
      default: return <Zap className="w-4 h-4" />
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            Quick Settings
          </CardTitle>
          <CardDescription className="text-slate-400">
            Manage your pick generation configuration
          </CardDescription>
        </div>
        {!editing && (
          <Button
            onClick={() => setEditing(true)}
            variant="outline"
            className="border-slate-700 hover:bg-slate-800"
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pick Mode */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Pick Mode</label>
          {editing ? (
            <div className="grid grid-cols-3 gap-2">
              {(['manual', 'auto', 'hybrid'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPickMode(mode)}
                  className={`p-3 rounded-lg border transition-all ${
                    pickMode === mode
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {getPickModeIcon(mode)}
                    <span className="text-xs capitalize">{mode}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Badge variant="outline" className="text-sm">
              {getPickModeIcon(pickMode)}
              <span className="ml-1 capitalize">{pickMode}</span>
            </Badge>
          )}
        </div>

        {/* Execution Interval */}
        {(pickMode === 'auto' || pickMode === 'hybrid') && (
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Execution Interval
            </label>
            {editing ? (
              <select
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                <option value={4}>Every 4 minutes</option>
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
              </select>
            ) : (
              <p className="text-slate-400">Every {intervalMinutes} minutes</p>
            )}
          </div>
        )}

        {/* Hours Before Game */}
        {(pickMode === 'auto' || pickMode === 'hybrid') && (
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">
              Generate Picks (Hours Before Game)
            </label>
            {editing ? (
              <input
                type="number"
                min={1}
                max={48}
                value={hoursBeforeGame}
                onChange={(e) => setHoursBeforeGame(Number(e.target.value))}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
              />
            ) : (
              <p className="text-slate-400">{hoursBeforeGame} hours before game start</p>
            )}
          </div>
        )}

        {/* Excluded Teams */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Ban className="w-4 h-4" />
            Excluded Teams ({excludedTeams.length})
          </label>
          {editing ? (
            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/50 rounded-lg">
              {NBA_TEAMS.map((team) => (
                <button
                  key={team}
                  onClick={() => toggleTeam(team)}
                  className={`p-2 rounded text-xs font-medium transition-all ${
                    excludedTeams.includes(team)
                      ? 'bg-red-500/20 border border-red-500 text-red-400'
                      : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {team}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {excludedTeams.length > 0 ? (
                excludedTeams.map((team) => (
                  <Badge key={team} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                    {team}
                  </Badge>
                ))
              ) : (
                <p className="text-slate-500 text-sm">No teams excluded</p>
              )}
            </div>
          )}
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
      </CardContent>
    </Card>
  )
}

