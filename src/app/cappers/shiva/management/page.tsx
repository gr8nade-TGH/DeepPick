"use client"
import { useState } from 'react'
import { HeaderFilters } from './components/header-filters'
import { FactorControls, type FactorConfig } from './components/factor-controls'
import { SHIVAManagementInbox } from './components/inbox'
import { SHIVAWizard } from './components/wizard'
import type { CapperProfile } from '@/lib/cappers/shiva-v1/profile'

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
  const [betType, setBetType] = useState<'SPREAD' | 'MONEYLINE' | 'TOTAL'>('TOTAL')
  const [providerOverrides, setProviderOverrides] = useState<{ step3?: string; step4?: string }>({})
  const [factorConfigs, setFactorConfigs] = useState<FactorConfig[]>([])

  if (!uiEnabled) {
    return <div className="p-6">SHIVA v1 UI is disabled.</div>
  }

  const handleProfileChange = (profile: CapperProfile | null, capper: string, sport: string) => {
    setCurrentProfile(profile)
    
    // Convert profile to factor configs for UI
    if (profile) {
      const configs: FactorConfig[] = []
      
      // Map profile factors to UI configs
      const factorKeys = ['seasonNet', 'recentNet', 'h2hPpg', 'matchupORtgDRtg', 'newsEdge', 'homeEdge', 'threePoint']
      const weights = [
        profile.weights.f1_net_rating,
        profile.weights.f2_recent_form,
        profile.weights.f3_h2h_matchup,
        profile.weights.f4_ortg_diff,
        profile.weights.f5_news_injury,
        profile.weights.f6_home_court,
        profile.weights.f7_three_point,
      ]
      
      factorKeys.forEach((key, idx) => {
        const metadata = NBA_FACTOR_METADATA[key]
        if (metadata) {
          configs.push({
            key,
            enabled: true, // Default all enabled
            weight: weights[idx],
            name: metadata.name,
            description: metadata.description,
            dataSource: metadata.dataSource,
          })
        }
      })
      
      setFactorConfigs(configs)
    }
  }

  const handleFactorsChange = (updatedFactors: FactorConfig[]) => {
    setFactorConfigs(updatedFactors)
  }

  const handleBetTypeChange = (newBetType: 'SPREAD' | 'MONEYLINE' | 'TOTAL') => {
    setBetType(newBetType)
  }

  const handleRunClick = () => {
    // Build effective profile from current selections
    if (!currentProfile) return
    
    const effective: CapperProfile = {
      ...currentProfile,
      weights: {
        f1_net_rating: factorConfigs.find(f => f.key === 'seasonNet')?.weight ?? 0.21,
        f2_recent_form: factorConfigs.find(f => f.key === 'recentNet')?.weight ?? 0.175,
        f3_h2h_matchup: factorConfigs.find(f => f.key === 'h2hPpg')?.weight ?? 0.14,
        f4_ortg_diff: factorConfigs.find(f => f.key === 'matchupORtgDRtg')?.weight ?? 0.07,
        f5_news_injury: factorConfigs.find(f => f.key === 'newsEdge')?.weight ?? 0.07,
        f6_home_court: factorConfigs.find(f => f.key === 'homeEdge')?.weight ?? 0.035,
        f7_three_point: factorConfigs.find(f => f.key === 'threePoint')?.weight ?? 0.021,
      },
      providers: {
        ...currentProfile.providers,
        step3_default: (providerOverrides.step3 as any) || currentProfile.providers.step3_default,
        step4_default: (providerOverrides.step4 as any) || currentProfile.providers.step4_default,
      },
    }
    
    setEffectiveProfile(effective)
    // Trigger Step 1 with this profile
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
        {/* Left: Inbox + Factor Controls */}
        <div className="col-span-4 space-y-4">
          <div className="border border-gray-700 rounded p-3 bg-gray-900">
            <SHIVAManagementInbox />
          </div>
          
          {factorConfigs.length > 0 && (
            <FactorControls
              factors={factorConfigs}
              onFactorsChange={handleFactorsChange}
              onRunClick={handleRunClick}
              hasSelectedGame={!!selectedGame}
              selectedGameStatus={selectedGame?.status}
            />
          )}
        </div>

        {/* Right: Wizard */}
        <div className="col-span-8 border border-gray-700 rounded p-3 bg-gray-900">
          <SHIVAWizard 
            effectiveProfile={effectiveProfile}
            selectedGame={selectedGame}
            mode={mode}
          />
        </div>
      </div>
    </div>
  )
}



