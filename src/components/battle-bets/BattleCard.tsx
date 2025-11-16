'use client'

import { BattleCanvas } from '@/battle-bets/components/game/BattleCanvas'
import type { Game } from '@/battle-bets/types/game'

interface BattleCardProps {
  battle: any // Battle data from API
}

export function BattleCard({ battle }: BattleCardProps) {
  // Convert API battle data to Game type
  const game: Game = {
    id: battle.id,
    leftTeam: {
      id: battle.left_team.toLowerCase(),
      name: battle.game?.home_team?.name || battle.left_team,
      abbreviation: battle.left_team,
      color: parseInt((battle.left_capper?.colorTheme || '#3b82f6').replace('#', ''), 16),
      colorHex: battle.left_capper?.colorTheme || '#3b82f6'
    },
    rightTeam: {
      id: battle.right_team.toLowerCase(),
      name: battle.game?.away_team?.name || battle.right_team,
      abbreviation: battle.right_team,
      color: parseInt((battle.right_capper?.colorTheme || '#ef4444').replace('#', ''), 16),
      colorHex: battle.right_capper?.colorTheme || '#ef4444'
    },
    leftCapper: {
      id: battle.left_capper_id,
      name: battle.left_capper?.displayName || battle.left_capper_id.toUpperCase(),
      favoriteTeam: {
        id: battle.left_team.toLowerCase(),
        name: battle.game?.home_team?.name || battle.left_team,
        abbreviation: battle.left_team,
        color: parseInt((battle.left_capper?.colorTheme || '#3b82f6').replace('#', ''), 16),
        colorHex: battle.left_capper?.colorTheme || '#3b82f6'
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
        color: parseInt((battle.right_capper?.colorTheme || '#ef4444').replace('#', ''), 16),
        colorHex: battle.right_capper?.colorTheme || '#ef4444'
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

  return (
    <div className="bg-slate-900/90 border-2 border-purple-500/30 rounded-lg overflow-hidden">
      {/* Game Canvas */}
      <div className="w-full h-[300px]">
        <BattleCanvas battleId={battle.id} game={game} />
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

