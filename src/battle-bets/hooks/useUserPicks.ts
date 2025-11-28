/**
 * useUserPicks Hook
 * Fetches user's picks and transforms them for the battle selector.
 */

import { useEffect, useCallback } from 'react';
import { usePickBattleStore } from '../store/pickBattleStore';
import type { UserPick, PickStatus, PickResult, TeamUnitRecord } from '../types/picks';

interface ApiPick {
  id: string;
  game_id: string;
  capper: string;
  pick_type: string;
  selection: string;
  odds: number;
  units: number;
  confidence: number;
  status: string;
  net_units: number | null;
  created_at: string;
  graded_at: string | null;
  game_snapshot: {
    home_team: { abbreviation: string; name: string };
    away_team: { abbreviation: string; name: string };
    game_start_timestamp: string;
    game_date: string;
    game_time: string;
  };
  games?: {
    id: string;
    status: string;
    final_score?: { home: number; away: number };
    game_start_timestamp: string;
  };
}

interface UseUserPicksOptions {
  capperId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const TEAM_COLORS: Record<string, string> = {
  LAL: '#552583', LAC: '#C8102E', GSW: '#1D428A', SAC: '#5A2D81',
  PHX: '#1D1160', DEN: '#0E2240', UTA: '#002B5C', POR: '#E03A3E',
  OKC: '#007AC1', MIN: '#0C2340', MEM: '#5D76A9', NOP: '#0C2340',
  SAS: '#C4CED4', HOU: '#CE1141', DAL: '#00538C', BOS: '#007A33',
  MIL: '#00471B', CLE: '#6F263D', IND: '#002D62', DET: '#C8102E',
  CHI: '#CE1141', ATL: '#E03A3E', MIA: '#98002E', ORL: '#0077C0',
  WAS: '#002B5C', CHA: '#1D1160', NYK: '#006BB6', BKN: '#000000',
  PHI: '#006BB6', TOR: '#CE1141',
};

function transformApiPick(apiPick: ApiPick, unitRecord: TeamUnitRecord): UserPick {
  const snapshot = apiPick.game_snapshot;
  const game = apiPick.games;
  const selection = apiPick.selection.toUpperCase();
  const homeAbbr = snapshot.home_team?.abbreviation || '';
  const awayAbbr = snapshot.away_team?.abbreviation || '';

  let pickedTeamAbbr = homeAbbr;
  let isHomePicked = true;
  if (selection.includes(awayAbbr)) {
    pickedTeamAbbr = awayAbbr;
    isHomePicked = false;
  } else if (selection.includes(homeAbbr)) {
    pickedTeamAbbr = homeAbbr;
    isHomePicked = true;
  }

  const spreadMatch = selection.match(/([+-]?\d+\.?\d*)/);
  const spread = spreadMatch ? parseFloat(spreadMatch[1]) : undefined;

  const statusMap: Record<string, PickStatus> = {
    pending: 'upcoming', live: 'live', in_progress: 'live',
    won: 'final', lost: 'final', push: 'final',
  };

  let status: PickStatus = statusMap[apiPick.status] || 'upcoming';
  const gameStartTime = new Date(snapshot.game_start_timestamp || snapshot.game_date);
  if (apiPick.status === 'pending' && gameStartTime <= new Date()) {
    status = 'live';
  }

  let result: PickResult | undefined;
  if (apiPick.status === 'won') result = 'win';
  else if (apiPick.status === 'lost') result = 'loss';
  else if (apiPick.status === 'push') result = 'push';

  return {
    id: apiPick.id,
    oddsId: apiPick.id,
    gameId: apiPick.game_id,
    capperId: apiPick.capper,
    capperName: apiPick.capper.toUpperCase(),
    betType: apiPick.pick_type as any,
    pickedTeam: {
      id: pickedTeamAbbr,
      name: isHomePicked ? snapshot.home_team?.name : snapshot.away_team?.name,
      abbreviation: pickedTeamAbbr,
      color: TEAM_COLORS[pickedTeamAbbr] || '#6366f1',
    },
    opposingTeam: {
      id: isHomePicked ? awayAbbr : homeAbbr,
      name: isHomePicked ? snapshot.away_team?.name : snapshot.home_team?.name,
      abbreviation: isHomePicked ? awayAbbr : homeAbbr,
      color: TEAM_COLORS[isHomePicked ? awayAbbr : homeAbbr] || '#6366f1',
    },
    spread,
    status,
    gameStartTime,
    result,
    finalScore: game?.final_score,
    unitRecord,
  };
}

export function useUserPicks(options: UseUserPicksOptions = {}) {
  const { capperId, autoRefresh = true, refreshInterval = 30000 } = options;
  const { setPicks, updatePick } = usePickBattleStore();

  const fetchPicks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (capperId) params.set('capper', capperId);
      
      const [picksRes, perfRes] = await Promise.all([
        fetch('/api/picks?' + params),
        fetch('/api/cappers/team-dominance'),
      ]);
      
      const picksData = await picksRes.json();
      const perfData = perfRes.ok ? await perfRes.json() : null;
      
      if (!picksData.success) return;
      
      const picks = picksData.data.map((p: ApiPick) => {
        const teamAbbr = p.game_snapshot?.home_team?.abbreviation || '';
        const capperPerf = perfData?.data?.[teamAbbr]?.cappers?.find(
          (c: any) => c.capper === p.capper
        );
        const unitRecord: TeamUnitRecord = {
          teamId: teamAbbr,
          units: capperPerf?.netUnits || 0,
          wins: capperPerf?.wins || 0,
          losses: capperPerf?.losses || 0,
          pushes: capperPerf?.pushes || 0,
        };
        return transformApiPick(p, unitRecord);
      });
      
      setPicks(picks);
    } catch (err) {
      console.error('[useUserPicks] Error:', err);
    }
  }, [capperId, setPicks]);

  useEffect(() => { fetchPicks(); }, [fetchPicks]);
  
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchPicks, refreshInterval);
    return () => clearInterval(id);
  }, [autoRefresh, refreshInterval, fetchPicks]);

  return { refetch: fetchPicks, updatePick };
}

export default useUserPicks;
