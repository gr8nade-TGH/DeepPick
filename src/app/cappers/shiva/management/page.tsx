"use client"
import { useState, useEffect } from 'react'
import { HeaderFilters } from './components/header-filters'
import { SHIVAManagementInbox } from './components/inbox'
import { SHIVAWizard } from './components/wizard'
import { FactorConfigModal } from './components/factor-config-modal'
import { RunLogTable } from './components/run-log'
import type { CapperProfile } from '@/lib/cappers/shiva-v1/profile'
import type { CapperProfile as FactorCapperProfile } from '@/types/factor-config'

// Factor metadata for UI display (from NBA_Factor_Library_v1.csv)
const NBA_FACTOR_METADATA: Record<string, { name: string; description: string; dataSource: string }> = {
  seasonNet: {
    name: 'Season Net Rating Differential',
    description: 'Team Net Rating (ORtg-DRtg) differential between opponents. Core strength signal.',
    dataSource: 'StatMuse: season ORtg/DRtg queries',
  },
  recentNet: {
    name: 'Recent Form (Last 10)',
    description: 'Net Rating over last 10 games; momentum indicator. Clamped to ±8 before weighting.',
    dataSource: 'StatMuse: last 10 games net rating',
  },
  matchupORtgDRtg: {
    name: 'Off/Def Rating Differential',
    description: 'Offensive vs Defensive rating mismatch between teams. Matchup quality indicator.',
    dataSource: 'StatMuse: ORtg and DRtg queries',
  },
  h2hPpg: {
    name: 'Head-to-Head PPG (season)',
    description: 'Season PPG by each team vs this opponent. Style/fit history. Capped at ±6.',
    dataSource: 'StatMuse: PPG vs opponent queries',
  },
  threePoint: {
    name: '3-Point Environment',
    description: '3PA rate / 3P% / opponent 3PA context merged into shot profile edge. Variance lever.',
    dataSource: 'StatMuse: 3PA, 3P%, opponent 3PA',
  },
  newsEdge: {
    name: 'News/Injury Edge',
    description: 'Injury/availability impact within last 48-72h. Capped at ±3 per 100 pre-aggregation.',
    dataSource: 'News: NBA.com, team sites, ESPN, The Athletic',
  },
  homeEdge: {
    name: 'Home Court Edge',
    description: 'Generic home advantage adjustment. Default +1.5 per 100; can tune per team later.',
    dataSource: 'Internal constant',
  },
}

export default function ShivaManagementPage() {
  // Trigger deployment - odds_snapshots table created
  const uiEnabled = true // Force enabled for production
  const [currentProfile, setCurrentProfile] = useState<CapperProfile | null>(null)
  const [effectiveProfile, setEffectiveProfile] = useState<CapperProfile | null>(null)
  const [selectedGame, setSelectedGame] = useState<any>(null)
  // Load mode from localStorage on mount (Write mode by default)
  const [mode, setMode] = useState<'write' | 'auto'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shiva-mode')
      if (saved === 'write' || saved === 'auto') {
        return saved
      }
    }
    return 'write' // Default to Write mode
  })
  const [betType, setBetType] = useState<'TOTAL' | 'SPREAD/MONEYLINE'>('TOTAL')
  const [providerOverrides, setProviderOverrides] = useState<{ step3?: string; step4?: string }>({})
  const [showFactorConfig, setShowFactorConfig] = useState(false)

  // Debug selectedGame changes
  useEffect(() => {
    console.log('Main page: selectedGame state changed to:', selectedGame)
  }, [selectedGame])

  if (!uiEnabled) {
    return <div className="p-6">SHIVA v1 UI is disabled. Environment: {process.env.NODE_ENV}</div>
  }

  const handleProfileChange = (profile: CapperProfile | null, capper: string, sport: string) => {
    setCurrentProfile(profile)
  }

  const handleGameSelect = (game: any) => {
    console.log('Main page: Game selected:', game)
    console.log('Main page: Setting selectedGame to:', game)
    setSelectedGame(game)
    console.log('Main page: selectedGame state updated')
  }

  const handleBetTypeChange = (newBetType: 'TOTAL' | 'SPREAD/MONEYLINE') => {
    setBetType(newBetType)
  }

  const handleRunClick = () => {
    // Build effective profile from current selections
    if (!currentProfile) return
    
    const effective: CapperProfile = {
      ...currentProfile,
      providers: {
        ...currentProfile.providers,
        step3_default: (providerOverrides.step3 as any) || currentProfile.providers.step3_default,
        step4_default: (providerOverrides.step4 as any) || currentProfile.providers.step4_default,
      },
    }
    
    setEffectiveProfile(effective)
  }

  return (
    <div className="min-h-screen bg-black">
      <HeaderFilters
        mode={mode}
        onProfileChange={handleProfileChange}
        onGameChange={handleGameSelect}
        onModeChange={setMode}
        onBetTypeChange={handleBetTypeChange}
        onProviderOverrides={(step3, step4) => setProviderOverrides({ step3, step4 })}
        selectedGame={selectedGame}
      />
      
      <div className="p-4 grid grid-cols-12 gap-4">
        {/* Left: Inbox */}
        <div className="col-span-4 space-y-4">
          <div className="border border-gray-700 rounded p-3 bg-gray-900">
            <SHIVAManagementInbox 
              onGameSelect={handleGameSelect}
              selectedGame={selectedGame}
            />
          </div>
        </div>

        {/* Right: Wizard */}
        <div className="col-span-8 border border-gray-700 rounded p-3 bg-gray-900">
          {/* Action Buttons */}
          <div className="mb-4 flex gap-3">
            <button
              onClick={() => setShowFactorConfig(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>⚙️</span>
              Configure Factors
            </button>
            <button
              onClick={async () => {
                if (!confirm('⚠️ This will delete ALL picks from ALL cappers. Continue?')) {
                  return
                }
                try {
                  console.log('🧹 [CLEAR ALL PICKS] Button clicked, calling API...')
                  const response = await fetch('/api/debug/clear-all-picks', { method: 'POST' })
                  console.log('🧹 [CLEAR ALL PICKS] API response status:', response.status)
                  const result = await response.json()
                  console.log('🧹 [CLEAR ALL PICKS] API response data:', result)
                  
                  if (result.success) {
                    alert(`✅ ${result.message}! Refreshing data...`)
                    console.log('🧹 [CLEAR ALL PICKS] Success, refreshing page...')
                    // Refresh the page to update all data
                    window.location.reload()
                  } else {
                    alert('❌ Error clearing picks: ' + (result.error || 'Unknown error'))
                    console.error('🧹 [CLEAR ALL PICKS] API error:', result)
                  }
                } catch (error) {
                  alert('❌ Error clearing picks: ' + error)
                  console.error('🧹 [CLEAR ALL PICKS] Network error:', error)
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>🧹</span>
              Clear ALL Picks
            </button>
            <button
              onClick={async () => {
                try {
                  console.log('🔍 [CHECK DB] Button clicked, checking database...')
                  const response = await fetch('/api/debug/check-database')
                  const result = await response.json()
                  console.log('🔍 [CHECK DB] Database state:', result)
                  
                  if (result.success) {
                    alert(`📊 Database State:\nPicks: ${result.counts.picks}\nCooldowns: ${result.counts.cooldowns}\nGames: ${result.counts.games}`)
                  } else {
                    alert('❌ Error checking database: ' + result.error)
                  }
                } catch (error) {
                  alert('❌ Error checking database: ' + error)
                  console.error('🔍 [CHECK DB] Network error:', error)
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>🔍</span>
              Check DB
            </button>
            <button
              onClick={async () => {
                try {
                  console.log('🔄 [FETCH NBA GAMES] Button clicked, fetching NBA games...')
                  const response = await fetch('/api/debug/fetch-nba-games', { method: 'POST' })
                  const result = await response.json()
                  console.log('🔄 [FETCH NBA GAMES] Response:', result)
                  
                  if (result.success) {
                    alert(`✅ ${result.message}! Refreshing page...`)
                    window.location.reload()
                  } else {
                    alert('❌ Error fetching NBA games: ' + result.error)
                  }
                } catch (error) {
                  alert('❌ Error fetching NBA games: ' + error)
                  console.error('🔄 [FETCH NBA GAMES] Network error:', error)
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>🔄</span>
              Fetch NBA Games
            </button>
            <button
              onClick={async () => {
                try {
                  console.log('🎮 [ADD TEST GAMES] Button clicked, adding test games...')
                  const response = await fetch('/api/debug/add-test-games', { method: 'POST' })
                  const result = await response.json()
                  console.log('🎮 [ADD TEST GAMES] Response:', result)
                  
                  if (result.success) {
                    alert(`✅ ${result.message}! Refreshing page...`)
                    window.location.reload()
                  } else {
                    alert('❌ Error adding test games: ' + result.error)
                  }
                } catch (error) {
                  alert('❌ Error adding test games: ' + error)
                  console.error('🎮 [ADD TEST GAMES] Network error:', error)
                }
              }}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>🎮</span>
              Add Test Games
            </button>
            <a
              href="/odds"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>📊</span>
              Games & Odds
            </a>
            <a
              href="/api-test"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>🧪</span>
              API Test
            </a>
          </div>
          
          {/* Run Log Table */}
          <div className="mb-4">
            <RunLogTable />
          </div>
          
          <SHIVAWizard
            effectiveProfile={effectiveProfile}
            selectedGame={selectedGame}
            mode={mode}
            betType={betType}
          />
        </div>
      </div>
      
      {/* Factor Configuration Modal */}
      <FactorConfigModal
        isOpen={showFactorConfig}
        onClose={() => setShowFactorConfig(false)}
        capperId="SHIVA"
        sport="NBA"
        betType={betType}
        onSave={(profile: FactorCapperProfile) => {
          console.log('Factor config saved:', profile)
          // TODO: Apply factor configuration to pick generation
        }}
      />
    </div>
  )
}



