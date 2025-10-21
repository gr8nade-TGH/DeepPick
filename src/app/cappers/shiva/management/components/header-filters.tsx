"use client"
import { useState, useEffect } from 'react'
import type { CapperProfile } from '@/lib/cappers/shiva-v1/profile'

export interface HeaderFiltersProps {
  onProfileChange: (profile: CapperProfile | null, capper: string, sport: string) => void
  onGameChange: (game: any) => void
  onModeChange: (mode: 'dry-run' | 'write') => void
  onProviderOverrides: (step3?: string, step4?: string) => void
}

export function HeaderFilters(props: HeaderFiltersProps) {
  const [capper, setCapper] = useState('SHIVA')
  const [sport, setSport] = useState('NBA')
  const [mode, setMode] = useState<'dry-run' | 'write'>('dry-run')
  const [step3Provider, setStep3Provider] = useState<string>('')
  const [step4Provider, setStep4Provider] = useState<string>('')
  const [profile, setProfile] = useState<CapperProfile | null>(null)
  const [gameId, setGameId] = useState('')
  const [oddsSnippet, setOddsSnippet] = useState<any>(null)

  // Fetch profile when capper/sport changes
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`/api/cappers/profile?capper=${capper}&sport=${sport}`)
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
          
          // Set default providers from profile
          if (data.providers) {
            setStep3Provider(data.providers.step3_default || '')
            setStep4Provider(data.providers.step4_default || '')
          }
          
          props.onProfileChange(data, capper, sport)
        } else {
          setProfile(null)
          props.onProfileChange(null, capper, sport)
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
        setProfile(null)
        props.onProfileChange(null, capper, sport)
      }
    }
    
    loadProfile()
  }, [capper, sport])

  // Fetch default game from odds API
  useEffect(() => {
    async function loadDefaultGame() {
      if (sport !== 'NBA') return // Only NBA active for now
      
      try {
        const res = await fetch(`/api/odds?league=NBA`)
        if (res.ok) {
          const data = await res.json()
          if (data.games && data.games.length > 0) {
            const firstGame = data.games[0]
            setGameId(firstGame.id || '')
            setOddsSnippet({
              spread: firstGame.spread_line || 0,
              total: firstGame.total_line || 0,
              ml_home: firstGame.home_ml || 0,
              ml_away: firstGame.away_ml || 0,
            })
            props.onGameChange(firstGame)
          }
        }
      } catch (error) {
        console.error('Failed to load default game:', error)
      }
    }
    
    loadDefaultGame()
  }, [sport])

  const handleCapperChange = (newCapper: string) => {
    setCapper(newCapper)
  }

  const handleSportChange = (newSport: string) => {
    setSport(newSport as 'NBA' | 'MLB' | 'NFL')
  }

  const handleModeChange = (newMode: 'dry-run' | 'write') => {
    setMode(newMode)
    props.onModeChange(newMode)
  }

  return (
    <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 p-4 shadow-sm">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Capper Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-white">Capper</label>
          <select
            value={capper}
            onChange={(e) => handleCapperChange(e.target.value)}
            className="px-3 py-1 border border-gray-600 rounded text-sm bg-gray-800 text-white"
          >
            <option value="SHIVA">SHIVA</option>
            <option value="IFRIT" disabled={!profile || profile.capper !== 'IFRIT'}>
              IFRIT {!profile || profile.capper !== 'IFRIT' ? '(no profile)' : ''}
            </option>
            <option value="CERBERUS" disabled>CERBERUS (no profile)</option>
            <option value="NEXUS" disabled>NEXUS (no profile)</option>
          </select>
        </div>

        {/* Sport Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-white">Sport</label>
          <select
            value={sport}
            onChange={(e) => handleSportChange(e.target.value)}
            className="px-3 py-1 border border-gray-600 rounded text-sm bg-gray-800 text-white"
          >
            <option value="NBA">NBA</option>
            <option value="MLB" disabled title="Coming soon">
              MLB (coming soon)
            </option>
            <option value="NFL" disabled title="Coming soon">
              NFL (coming soon)
            </option>
          </select>
        </div>

        {/* Mode Toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-white">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange('dry-run')}
              className={`px-3 py-1 text-sm rounded font-bold ${
                mode === 'dry-run'
                  ? 'bg-blue-600 text-white border-2 border-blue-400'
                  : 'bg-gray-700 text-white'
              }`}
            >
              Dry-Run
            </button>
            <button
              onClick={() => handleModeChange('write')}
              disabled
              title="Admin only - not enabled"
              className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-400 cursor-not-allowed"
            >
              Write
            </button>
          </div>
        </div>

        {/* AI Overrides */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-white">Step 3 AI</label>
            <select
              value={step3Provider}
              onChange={(e) => {
                setStep3Provider(e.target.value)
                props.onProviderOverrides(e.target.value, step4Provider)
              }}
              className="px-2 py-1 border border-gray-600 rounded text-xs bg-gray-800 text-white"
            >
              <option value="">Default ({profile?.providers.step3_default || 'perplexity'})</option>
              <option value="perplexity">Perplexity</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-white">Step 4 AI</label>
            <select
              value={step4Provider}
              onChange={(e) => {
                setStep4Provider(e.target.value)
                props.onProviderOverrides(step3Provider, e.target.value)
              }}
              className="px-2 py-1 border border-gray-600 rounded text-xs bg-gray-800 text-white"
            >
              <option value="">Default ({profile?.providers.step4_default || 'openai'})</option>
              <option value="perplexity">Perplexity</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
        </div>

        {/* Game Controls */}
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-bold text-white">Game ID</label>
          <input
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Search game..."
            className="px-3 py-1 border border-gray-600 rounded text-sm bg-gray-800 text-white placeholder-gray-400"
          />
        </div>

        {/* Odds Snippet */}
        {oddsSnippet && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-white">Current Odds</label>
            <div className="text-xs text-white px-2 py-1 bg-gray-800 rounded border border-gray-600 font-semibold">
              ML: {oddsSnippet.ml_home}/{oddsSnippet.ml_away} • 
              Spread: {oddsSnippet.spread} • 
              Total: {oddsSnippet.total}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

