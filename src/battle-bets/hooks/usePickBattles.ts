/**
 * usePickBattles Hook
 * 
 * Converts selected picks to Game format for PixiJS battle rendering.
 * Bridges the pick selector with the battle visualization system.
 */

import { useMemo } from 'react';
import { useSelectedPicks } from '../store/pickBattleStore';
import type { Game, Team, Capper } from '../types/game';
import type { UserPick } from '../types/picks';

// Default capper data when not available
const DEFAULT_CAPPER: Capper = {
  id: 'default',
  name: 'Player',
  units: 0,
  colorTheme: '#6366f1',
};

// Team color lookup (hex values)
const TEAM_COLORS: Record<string, number> = {
  LAL: 0x552583, LAC: 0xC8102E, GSW: 0x1D428A, SAC: 0x5A2D81,
  PHX: 0x1D1160, DEN: 0x0E2240, UTA: 0x002B5C, POR: 0xE03A3E,
  OKC: 0x007AC1, MIN: 0x0C2340, MEM: 0x5D76A9, NOP: 0x0C2340,
  SAS: 0xC4CED4, HOU: 0xCE1141, DAL: 0x00538C, BOS: 0x007A33,
  MIL: 0x00471B, CLE: 0x6F263D, IND: 0x002D62, DET: 0xC8102E,
  CHI: 0xCE1141, ATL: 0xE03A3E, MIA: 0x98002E, ORL: 0x0077C0,
  WAS: 0x002B5C, CHA: 0x1D1160, NYK: 0x006BB6, BKN: 0x000000,
  PHI: 0x006BB6, TOR: 0xCE1141,
};

/**
 * Convert a UserPick to Game format for battle rendering
 */
function pickToGame(pick: UserPick): Game {
  const pickedAbbr = pick.pickedTeam.abbreviation;
  const opposingAbbr = pick.opposingTeam.abbreviation;

  // Create team objects
  const leftTeam: Team = {
    id: pickedAbbr.toLowerCase(),
    name: pick.pickedTeam.name || pickedAbbr,
    abbreviation: pickedAbbr,
    color: TEAM_COLORS[pickedAbbr] || 0x6366f1,
    colorHex: pick.pickedTeam.color || '#6366f1',
  };

  const rightTeam: Team = {
    id: opposingAbbr.toLowerCase(),
    name: pick.opposingTeam.name || opposingAbbr,
    abbreviation: opposingAbbr,
    color: TEAM_COLORS[opposingAbbr] || 0xef4444,
    colorHex: pick.opposingTeam.color || '#ef4444',
  };

  // Create capper objects
  const leftCapper: Capper = {
    id: pick.capperId,
    name: pick.capperName,
    units: pick.unitRecord.units,
    colorTheme: pick.pickedTeam.color || '#6366f1',
  };

  const rightCapper: Capper = {
    ...DEFAULT_CAPPER,
    colorTheme: pick.opposingTeam.color || '#ef4444',
  };

  // Format game date/time
  const gameDate = pick.gameStartTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const gameTime = pick.gameStartTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  // Map pick status to game status
  let status: Game['status'] = 'SCHEDULED';
  if (pick.status === 'live') {
    status = pick.score?.quarter ? (`${pick.score.quarter}Q` as Game['status']) : '1Q';
  } else if (pick.status === 'final') {
    status = 'FINAL';
  }

  return {
    id: pick.gameId,
    leftTeam,
    rightTeam,
    leftCapper,
    rightCapper,
    currentQuarter: pick.score?.quarter || 0,
    spread: pick.spread,
    gameDate,
    gameTime,
    gameStartTimestamp: pick.gameStartTime.toISOString(),
    leftScore: pick.score?.away || pick.finalScore?.away || 0,
    rightScore: pick.score?.home || pick.finalScore?.home || 0,
    status,
  };
}

export interface PickBattlesResult {
  /** Game data for Battle 1 (anchor slot) */
  battle1Game: Game | null;
  /** Game data for Battle 2 (swap slot) */
  battle2Game: Game | null;
  /** Battle ID for Battle 1 */
  battle1Id: string | null;
  /** Battle ID for Battle 2 */
  battle2Id: string | null;
  /** Whether any battles are available */
  hasBattles: boolean;
}

/**
 * Hook to get Game data for selected picks
 */
export function usePickBattles(): PickBattlesResult {
  const { battle1Pick, battle2Pick } = useSelectedPicks();

  return useMemo(() => {
    const battle1Game = battle1Pick ? pickToGame(battle1Pick) : null;
    const battle2Game = battle2Pick ? pickToGame(battle2Pick) : null;

    return {
      battle1Game,
      battle2Game,
      battle1Id: battle1Pick?.gameId || null,
      battle2Id: battle2Pick?.gameId || null,
      hasBattles: battle1Game !== null || battle2Game !== null,
    };
  }, [battle1Pick, battle2Pick]);
}

export default usePickBattles;

