'use client'

import { useEffect, useRef } from 'react'
import { useMultiGameStore } from '@/battle-bets/store/multiGameStore'
import { GameStatusOverlay } from './GameStatusOverlay'
import type { Game } from '@/battle-bets/types/game'
import type { BattleStatus } from '@/lib/battle-bets/BattleTimer'

interface BattleCardProps {
  battle: any // Battle data from API
}

export function BattleCard({ battle }: BattleCardProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const initializeBattle = useMultiGameStore(state => state.initializeBattle)
  const getBattle = useMultiGameStore(state => state.getBattle)

  // Initialize battle in store
  useEffect(() => {
    if (!battle) return

    // Convert API battle data to Game type
    const game: Game = {
      id: battle.id,
      leftTeam: {
        id: battle.left_team.toLowerCase(),
        name: battle.game?.home_team?.name || battle.left_team,
        abbreviation: battle.left_team,
        primaryColor: battle.left_capper?.colorTheme || '#3b82f6',
        secondaryColor: '#1e40af',
        logo: `/team-logos/${battle.left_team}.png`
      },
      rightTeam: {
        id: battle.right_team.toLowerCase(),
        name: battle.game?.away_team?.name || battle.right_team,
        abbreviation: battle.right_team,
        primaryColor: battle.right_capper?.colorTheme || '#ef4444',
        secondaryColor: '#991b1b',
        logo: `/team-logos/${battle.right_team}.png`
      },
      leftCapper: {
        id: battle.left_capper_id,
        name: battle.left_capper?.displayName || battle.left_capper_id.toUpperCase(),
        favoriteTeam: {
          id: battle.left_team.toLowerCase(),
          name: battle.game?.home_team?.name || battle.left_team,
          abbreviation: battle.left_team,
          primaryColor: battle.left_capper?.colorTheme || '#3b82f6',
          secondaryColor: '#1e40af',
          logo: `/team-logos/${battle.left_team}.png`
        },
        health: battle.left_hp || 100,
        maxHealth: 100,
        level: 1,
        experience: 0,
        leaderboardRank: 1,
        teamRecords: [
          {
            teamId: battle.left_team.toLowerCase(),
            units: battle.left_capper?.teamPerformance?.netUnits || 0,
            wins: battle.left_capper?.teamPerformance?.wins || 0,
            losses: battle.left_capper?.teamPerformance?.losses || 0,
            pushes: battle.left_capper?.teamPerformance?.pushes || 0
          }
        ],
        equippedItems: {
          slot1: null,
          slot2: null,
          slot3: null
        }
      },
      rightCapper: {
        id: battle.right_capper_id,
        name: battle.right_capper?.displayName || battle.right_capper_id.toUpperCase(),
        favoriteTeam: {
          id: battle.right_team.toLowerCase(),
          name: battle.game?.away_team?.name || battle.right_team,
          abbreviation: battle.right_team,
          primaryColor: battle.right_capper?.colorTheme || '#ef4444',
          secondaryColor: '#991b1b',
          logo: `/team-logos/${battle.right_team}.png`
        },
        health: battle.right_hp || 100,
        maxHealth: 100,
        level: 1,
        experience: 0,
        leaderboardRank: 2,
        teamRecords: [
          {
            teamId: battle.right_team.toLowerCase(),
            units: battle.right_capper?.teamPerformance?.netUnits || 0,
            wins: battle.right_capper?.teamPerformance?.wins || 0,
            losses: battle.right_capper?.teamPerformance?.losses || 0,
            pushes: battle.right_capper?.teamPerformance?.pushes || 0
          }
        ],
        equippedItems: {
          slot1: null,
          slot2: null,
          slot3: null
        }
      },
      currentQuarter: battle.current_quarter || 0,
      spread: battle.spread || 0,
      gameDate: battle.game?.game_date || '',
      gameTime: battle.game?.game_time || '',
      leftScore: battle.left_score || 0,
      rightScore: battle.right_score || 0,
      status: mapBattleStatusToGameStatus(battle.status)
    }

    // Initialize battle in store
    initializeBattle(battle.id, game)

    return () => {
      // Cleanup handled by store
    }
  }, [battle, initializeBattle])

  // Get battle state from store
  const battleState = getBattle(battle.id)

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-4 border-b border-purple-500/30">
        <div className="flex items-center justify-between">
          {/* Left Capper */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {battle.left_capper?.displayName?.[0] || 'L'}
            </div>
            <div>
              <p className="text-white font-bold">{battle.left_capper?.displayName || battle.left_capper_id}</p>
              <p className="text-gray-400 text-sm">{battle.left_team}</p>
            </div>
          </div>

          {/* VS Badge */}
          <div className="px-4 py-2 bg-purple-600 rounded-lg">
            <p className="text-white font-bold">VS</p>
          </div>

          {/* Right Capper */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-white font-bold text-right">{battle.right_capper?.displayName || battle.right_capper_id}</p>
              <p className="text-gray-400 text-sm text-right">{battle.right_team}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white font-bold">
              {battle.right_capper?.displayName?.[0] || 'R'}
            </div>
          </div>
        </div>

        {/* Game Info */}
        <div className="mt-3 text-center">
          <p className="text-gray-300 text-sm">
            {battle.game?.home_team?.name} vs {battle.game?.away_team?.name}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Spread: {battle.spread > 0 ? '+' : ''}{battle.spread} • Status: {battle.status}
          </p>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className="relative bg-slate-900/50"
        style={{ height: '400px' }}
      >
        {/* Status Overlay */}
        <GameStatusOverlay
          status={battle.status as BattleStatus}
          gameStartTime={battle.game_start_time}
          q1EndTime={battle.q1_end_time}
          q2EndTime={battle.q2_end_time}
          halftimeEndTime={battle.halftime_end_time}
          q3EndTime={battle.q3_end_time}
          q4EndTime={battle.q4_end_time}
          winner={battle.winner}
          leftCapperName={battle.left_capper?.displayName || battle.left_capper_id}
          rightCapperName={battle.right_capper?.displayName || battle.right_capper_id}
        />

        {/* PixiJS canvas will be inserted here */}
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <p>Battle Canvas (PixiJS integration pending)</p>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-slate-900/50 p-4 border-t border-purple-500/30">
        <div className="grid grid-cols-2 gap-4">
          {/* Left Stats */}
          <div>
            <p className="text-gray-400 text-xs mb-1">HP</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${(battle.left_hp / 100) * 100}%` }}
                />
              </div>
              <span className="text-white text-sm font-bold">{battle.left_hp}</span>
            </div>
            <p className="text-gray-400 text-xs mt-2">Score: {battle.left_score}</p>
            <p className="text-gray-400 text-xs">
              Defense: {battle.left_capper?.teamPerformance?.defenseDots?.total || 0} dots
            </p>
          </div>

          {/* Right Stats */}
          <div>
            <p className="text-gray-400 text-xs mb-1 text-right">HP</p>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-bold">{battle.right_hp}</span>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-600 transition-all duration-300"
                  style={{ width: `${(battle.right_hp / 100) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-2 text-right">Score: {battle.right_score}</p>
            <p className="text-gray-400 text-xs text-right">
              Defense: {battle.right_capper?.teamPerformance?.defenseDots?.total || 0} dots
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Map battle status to game status
 */
function mapBattleStatusToGameStatus(status: string): Game['status'] {
  const statusMap: Record<string, Game['status']> = {
    'scheduled': 'SCHEDULED',
    'q1_pending': 'SCHEDULED',
    'q1_complete': '1Q',
    'q2_pending': '1Q',
    'q2_complete': '2Q',
    'halftime': '2Q',
    'q3_pending': '2Q',
    'q3_complete': '3Q',
    'q4_pending': '3Q',
    'q4_complete': '4Q',
    'final': 'FINAL',
    'complete': 'FINAL'
  }

  return statusMap[status] || 'SCHEDULED'
}

