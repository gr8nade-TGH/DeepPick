"use client"
import { useState, useEffect, useRef } from 'react'
import type { CapperProfile } from '@/lib/cappers/shiva-v1/profile'

interface GameOption {
  game_id: string
  sport: string
  status: string
  start_time_utc: string
  away: string
  home: string
  odds: {
    ml_home: number
    ml_away: number
    spread_team: string
    spread_line: number
    total_line: number
  }
  book_count?: number
}

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
  const [gameSearch, setGameSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null)
  const [gameOptions, setGameOptions] = useState<GameOption[]>([])
  const [showGameDropdown, setShowGameDropdown] = useState(false)
  const [loadingGames, setLoadingGames] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Fetch games (debounced typeahead)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (sport !== 'NBA') return // Only NBA active for now
      
      setLoadingGames(true)
      try {
        const query = gameSearch ? `&q=${encodeURIComponent(gameSearch)}` : ''
        const res = await fetch(`/api/games/current?league=${sport}${query}&limit=50`)
        if (res.ok) {
          const data = await res.json()
          setGameOptions(data.games || [])
        }
      } catch (error) {
        console.error('Failed to load games:', error)
      } finally {
        setLoadingGames(false)
      }
    }, 250) // 250ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [gameSearch, sport])

  // Load default game on mount
  useEffect(() => {
    async function loadDefaultGame() {
      if (sport !== 'NBA') return
      
      try {
        const res = await fetch(`/api/games/current?league=${sport}&limit=1`)
        if (res.ok) {
          const data = await res.json()
          if (data.games && data.games.length > 0) {
            const firstGame = data.games[0]
            setSelectedGame(firstGame)
            setGameSearch(`${firstGame.away} @ ${firstGame.home}`)
            props.onGameChange(firstGame)
          }
        }
      } catch (error) {
        console.error('Failed to load default game:', error)
      }
    }
    
    loadDefaultGame()
  }, [sport])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowGameDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleGameSelect = (game: GameOption) => {
    setSelectedGame(game)
    setGameSearch(`${game.away} @ ${game.home}`)
    setShowGameDropdown(false)
    props.onGameChange(game)
  }

  const formatLocalTime = (utcTime: string) => {
    try {
      const date = new Date(utcTime)
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch {
      return ''
    }
  }

  const groupGamesByDate = (games: GameOption[]) => {
    const now = new Date()
    const today = now.toDateString()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()

    const grouped: { today: GameOption[]; tomorrow: GameOption[]; later: GameOption[] } = {
      today: [],
      tomorrow: [],
      later: [],
    }

    games.forEach((game) => {
      const gameDate = new Date(game.start_time_utc).toDateString()
      if (gameDate === today) {
        grouped.today.push(game)
      } else if (gameDate === tomorrow) {
        grouped.tomorrow.push(game)
      } else {
        grouped.later.push(game)
      }
    })

    return grouped
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

        {/* Game Search Dropdown (Combobox) */}
        <div className="flex flex-col gap-1 flex-1 relative" ref={dropdownRef}>
          <label className="text-xs font-bold text-white">Game</label>
          <input
            type="text"
            value={gameSearch}
            onChange={(e) => {
              setGameSearch(e.target.value)
              setShowGameDropdown(true)
            }}
            onFocus={() => setShowGameDropdown(true)}
            placeholder="Search games..."
            className="px-3 py-1 border border-gray-600 rounded text-sm bg-gray-800 text-white placeholder-gray-400"
          />
          
          {/* Dropdown */}
          {showGameDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-96 overflow-y-auto z-20">
              {loadingGames && (
                <div className="p-3 text-center text-gray-400 text-xs">Loading games...</div>
              )}
              
              {!loadingGames && gameOptions.length === 0 && (
                <div className="p-3 text-center text-gray-400 text-xs">
                  No upcoming NBA games found. Try clearing your search.
                </div>
              )}

              {!loadingGames && gameOptions.length > 0 && (() => {
                const grouped = groupGamesByDate(gameOptions)
                return (
                  <>
                    {grouped.today.length > 0 && (
                      <div>
                        <div className="px-3 py-1 bg-gray-700 text-white text-xs font-bold sticky top-0">
                          Today
                        </div>
                        {grouped.today.map((game) => (
                          <button
                            key={game.game_id}
                            onClick={() => handleGameSelect(game)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 border-b border-gray-700"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white">
                                  {game.away} @ {game.home}
                                </div>
                                <div className="text-xs text-gray-300 mt-1">
                                  ML {game.away.split(' ').pop()} {game.odds.ml_away !== 0 ? (game.odds.ml_away > 0 ? '+' : '') + game.odds.ml_away : '—'} • {game.home.split(' ').pop()} {game.odds.ml_home !== 0 ? (game.odds.ml_home > 0 ? '+' : '') + game.odds.ml_home : '—'} | 
                                  Spread: {game.odds.spread_team.split(' ').pop()} {game.odds.spread_line !== 0 ? (game.odds.spread_line > 0 ? '+' : '') + game.odds.spread_line : '—'} | 
                                  Total: {game.odds.total_line !== 0 ? game.odds.total_line : '—'}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 ml-2 flex flex-col items-end">
                                <div>{formatLocalTime(game.start_time_utc)}</div>
                                <div className="mt-1">
                                  {game.status === 'scheduled' && (
                                    <span className="px-1 py-0.5 bg-blue-600 rounded text-xs text-white">UPCOMING</span>
                                  )}
                                  {game.status === 'in_progress' && (
                                    <span className="px-1 py-0.5 bg-green-600 rounded text-xs text-white">LIVE</span>
                                  )}
                                  {game.status === 'final' && (
                                    <span className="px-1 py-0.5 bg-gray-600 rounded text-xs text-white">FINAL</span>
                                  )}
                                  {game.status === 'postponed' && (
                                    <span className="px-1 py-0.5 bg-yellow-600 rounded text-xs text-white">POSTPONED</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {grouped.tomorrow.length > 0 && (
                      <div>
                        <div className="px-3 py-1 bg-gray-700 text-white text-xs font-bold sticky top-0">
                          Tomorrow
                        </div>
                        {grouped.tomorrow.map((game) => (
                          <button
                            key={game.game_id}
                            onClick={() => handleGameSelect(game)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 border-b border-gray-700"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white">
                                  {game.away} @ {game.home}
                                </div>
                                <div className="text-xs text-gray-300 mt-1">
                                  ML {game.away.split(' ').pop()} {game.odds.ml_away !== 0 ? (game.odds.ml_away > 0 ? '+' : '') + game.odds.ml_away : '—'} • {game.home.split(' ').pop()} {game.odds.ml_home !== 0 ? (game.odds.ml_home > 0 ? '+' : '') + game.odds.ml_home : '—'} | 
                                  Spread: {game.odds.spread_team.split(' ').pop()} {game.odds.spread_line !== 0 ? (game.odds.spread_line > 0 ? '+' : '') + game.odds.spread_line : '—'} | 
                                  Total: {game.odds.total_line !== 0 ? game.odds.total_line : '—'}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 ml-2">
                                {formatLocalTime(game.start_time_utc)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {grouped.later.length > 0 && (
                      <div>
                        <div className="px-3 py-1 bg-gray-700 text-white text-xs font-bold sticky top-0">
                          Later
                        </div>
                        {grouped.later.map((game) => (
                          <button
                            key={game.game_id}
                            onClick={() => handleGameSelect(game)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 border-b border-gray-700"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white">
                                  {game.away} @ {game.home}
                                </div>
                                <div className="text-xs text-gray-300 mt-1">
                                  ML {game.away.split(' ').pop()} {game.odds.ml_away !== 0 ? (game.odds.ml_away > 0 ? '+' : '') + game.odds.ml_away : '—'} • {game.home.split(' ').pop()} {game.odds.ml_home !== 0 ? (game.odds.ml_home > 0 ? '+' : '') + game.odds.ml_home : '—'} | 
                                  Spread: {game.odds.spread_team.split(' ').pop()} {game.odds.spread_line !== 0 ? (game.odds.spread_line > 0 ? '+' : '') + game.odds.spread_line : '—'} | 
                                  Total: {game.odds.total_line !== 0 ? game.odds.total_line : '—'}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 ml-2">
                                {formatLocalTime(game.start_time_utc)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

