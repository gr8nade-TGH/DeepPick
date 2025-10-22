"use client"
import { useState } from 'react'
import { HeaderFilters } from './components/header-filters'
import { SHIVAManagementInbox } from './components/inbox'
import { SHIVAWizard } from './components/wizard'
import { FactorConfigModal } from './components/factor-config-modal'
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
  const uiEnabled = (process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED || '').toLowerCase() === 'true'
  const [currentProfile, setCurrentProfile] = useState<CapperProfile | null>(null)
  const [effectiveProfile, setEffectiveProfile] = useState<CapperProfile | null>(null)
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [mode, setMode] = useState<'dry-run' | 'write'>('dry-run')
  const [betType, setBetType] = useState<'TOTAL' | 'SPREAD/MONEYLINE'>('TOTAL')
  const [providerOverrides, setProviderOverrides] = useState<{ step3?: string; step4?: string }>({})
  const [showFactorConfig, setShowFactorConfig] = useState(false)

  if (!uiEnabled) {
    return <div className="p-6">SHIVA v1 UI is disabled.</div>
  }

  const handleProfileChange = (profile: CapperProfile | null, capper: string, sport: string) => {
    setCurrentProfile(profile)
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
        onProfileChange={handleProfileChange}
        onGameChange={setSelectedGame}
        onModeChange={setMode}
        onProviderOverrides={(step3, step4) => setProviderOverrides({ step3, step4 })}
        onBetTypeChange={handleBetTypeChange}
      />
      
      <div className="p-4 grid grid-cols-12 gap-4">
        {/* Left: Inbox */}
        <div className="col-span-4 space-y-4">
          <div className="border border-gray-700 rounded p-3 bg-gray-900">
            <SHIVAManagementInbox />
          </div>
        </div>

        {/* Right: Wizard */}
        <div className="col-span-8 border border-gray-700 rounded p-3 bg-gray-900">
          {/* Configure Factors Button */}
          <div className="mb-4">
            <button
              onClick={() => setShowFactorConfig(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition flex items-center gap-2"
            >
              <span>⚙️</span>
              Configure Factors
            </button>
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



