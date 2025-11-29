/**
 * useUserPicks Hook
 * Fetches user's picks and transforms them for the battle selector.
 *
 * This hook fetches the logged-in user's session from /api/auth/session
 * and then fetches ONLY that user's picks from /api/picks.
 */

import { useEffect, useCallback, useState } from 'react';
import { usePickBattleStore } from '../store/pickBattleStore';
import type { UserPick, PickStatus, PickResult, TeamUnitRecord } from '../types/picks';

interface ApiPick {
  id: string;
  game_id: string;
  user_id?: string;
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

interface UserSession {
  user: { id: string; email: string } | null;
  profile: { username: string; role: string; display_name?: string } | null;
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
    gameId: apiPick.game_id || '', // Null safety - API might return null
    capperId: apiPick.capper,
    capperName: apiPick.capper.toUpperCase(),
    betType: apiPick.pick_type as any,
    pickedTeam: {
      id: pickedTeamAbbr,
      name: (isHomePicked ? snapshot.home_team?.name : snapshot.away_team?.name) || pickedTeamAbbr,
      abbreviation: pickedTeamAbbr,
      color: TEAM_COLORS[pickedTeamAbbr] || '#6366f1',
    },
    opposingTeam: {
      id: isHomePicked ? awayAbbr : homeAbbr,
      name: (isHomePicked ? snapshot.away_team?.name : snapshot.home_team?.name) || (isHomePicked ? awayAbbr : homeAbbr),
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
  const { capperId: explicitCapperId, autoRefresh = true, refreshInterval = 30000 } = options;
  const { setPicks, updatePick, setIsLoading, setError } = usePickBattleStore();

  // Store the current user's info
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  // Fetch current user session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        console.log('[useUserPicks] Fetching user session...');
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          // full_name is used as the capper identifier (e.g., "gr8nade")
          // username column is typically null, so we use full_name
          const capperName = data.profile?.full_name || data.profile?.username;
          console.log('[useUserPicks] Session data:', data.user?.email, 'capper:', capperName);
          setCurrentUser(data);
        } else {
          console.log('[useUserPicks] No session found');
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('[useUserPicks] Error fetching session:', err);
        setCurrentUser(null);
      } finally {
        setUserLoaded(true);
      }
    };
    fetchSession();
  }, []);

  const fetchPicks = useCallback(async () => {
    // Wait for user to be loaded
    if (!userLoaded) {
      console.log('[useUserPicks] Waiting for user session...');
      return;
    }

    try {
      setIsLoading?.(true);

      // Determine which capper to filter by:
      // 1. Explicit capperId from options
      // 2. Current user's full_name (used as capper identifier, e.g., "gr8nade")
      // 3. No filter (should not happen for logged-in users)
      // Note: In profiles table, full_name stores the capper name, username is typically null
      const capperId = explicitCapperId ||
        currentUser?.profile?.full_name?.toLowerCase() ||
        currentUser?.profile?.username?.toLowerCase();

      if (!capperId && !currentUser?.user) {
        console.log('[useUserPicks] No user logged in, showing no picks');
        setPicks([]);
        setIsLoading?.(false);
        return;
      }

      console.log('[useUserPicks] Fetching picks for capper:', capperId);

      const params = new URLSearchParams({ limit: '50' });
      if (capperId) params.set('capper', capperId);

      const [picksRes, perfRes] = await Promise.all([
        fetch('/api/picks?' + params),
        fetch('/api/cappers/team-dominance'),
      ]);

      const picksData = await picksRes.json();
      const perfData = perfRes.ok ? await perfRes.json() : null;

      if (!picksData.success || !Array.isArray(picksData.data)) {
        console.log('[useUserPicks] No picks data for', capperId);
        setPicks([]);
        setIsLoading?.(false);
        return;
      }

      // Filter out PASS picks - Battle Arena only shows actual bets
      const actualPicks = picksData.data.filter((p: ApiPick) =>
        p.pick_type?.toLowerCase() !== 'pass' && p.selection?.toUpperCase() !== 'PASS'
      );
      console.log('[useUserPicks] Found', picksData.data.length, 'total picks,', actualPicks.length, 'actual bets (excluding PASS)');

      // Get user display name - use full_name as the capper display name
      // In profiles table: full_name = capper name (e.g., "gr8nade"), username is typically null
      const capperName = currentUser?.profile?.full_name || currentUser?.profile?.username || '';
      const displayName = capperName
        ? capperName.charAt(0).toUpperCase() + capperName.slice(1)
        : 'Unknown';

      console.log('[useUserPicks] Display name:', displayName, 'from capperName:', capperName);

      // Fetch capper's per-team SPREAD records and leaderboard rank
      let teamSpreadRecords: Map<string, { wins: number; losses: number; pushes: number; netUnits: number }> = new Map();
      let leaderboardRank: number | undefined;
      try {
        const [spreadRes, leaderboardRes] = await Promise.all([
          fetch(`/api/cappers/team-dominance?capperId=${capperId}&all=1`),
          fetch('/api/leaderboard'),
        ]);

        if (spreadRes.ok) {
          const spreadData = await spreadRes.json();
          if (spreadData.success && Array.isArray(spreadData.allTeams)) {
            spreadData.allTeams.forEach((team: any) => {
              teamSpreadRecords.set(team.team, {
                wins: team.wins || 0,
                losses: team.losses || 0,
                pushes: team.pushes || 0,
                netUnits: team.netUnits || 0,
              });
            });
            console.log('[useUserPicks] Found SPREAD records for', teamSpreadRecords.size, 'teams');
          }
        }

        if (leaderboardRes.ok) {
          const leaderboardData = await leaderboardRes.json();
          if (leaderboardData.success && Array.isArray(leaderboardData.data)) {
            // Find the capper's rank in the leaderboard
            const capperEntry = leaderboardData.data.find(
              (entry: any) => entry.id?.toLowerCase() === capperId?.toLowerCase()
            );
            if (capperEntry) {
              leaderboardRank = capperEntry.rank;
              console.log('[useUserPicks] Found leaderboard rank:', leaderboardRank, 'for capper:', capperId);
            }
          }
        }
      } catch (err) {
        console.warn('[useUserPicks] Could not fetch team SPREAD records or leaderboard:', err);
      }

      const picks = picksData.data.map((p: ApiPick) => {
        // Get the team that was picked (from selection)
        const homeAbbr = p.game_snapshot?.home_team?.abbreviation || '';
        const awayAbbr = p.game_snapshot?.away_team?.abbreviation || '';
        const selection = p.selection?.toUpperCase() || '';

        // Determine which team was picked
        const pickedTeamAbbr = selection.includes(homeAbbr) ? homeAbbr :
          selection.includes(awayAbbr) ? awayAbbr : homeAbbr;

        // Get the SPREAD record for the picked team
        const teamRecord = teamSpreadRecords.get(pickedTeamAbbr);
        const unitRecord: TeamUnitRecord = {
          teamId: pickedTeamAbbr,
          units: teamRecord?.netUnits || 0,
          wins: teamRecord?.wins || 0,
          losses: teamRecord?.losses || 0,
          pushes: teamRecord?.pushes || 0,
        };

        // Transform with user's display name override
        const pick = transformApiPick(p, unitRecord);
        pick.capperName = displayName; // Override to show user's name
        pick.leaderboardRank = leaderboardRank; // Add leaderboard rank
        return pick;
      });

      setPicks(picks);
      setIsLoading?.(false);
    } catch (err) {
      console.error('[useUserPicks] Error:', err);
      setError?.('Failed to fetch picks');
      setIsLoading?.(false);
    }
  }, [explicitCapperId, currentUser, userLoaded, setPicks, setIsLoading, setError]);

  // Fetch picks when user is loaded
  useEffect(() => {
    if (userLoaded) {
      fetchPicks();
    }
  }, [userLoaded, fetchPicks]);

  // Auto-refresh picks
  useEffect(() => {
    if (!autoRefresh || !userLoaded) return;
    const id = setInterval(fetchPicks, refreshInterval);
    return () => clearInterval(id);
  }, [autoRefresh, refreshInterval, fetchPicks, userLoaded]);

  return {
    refetch: fetchPicks,
    updatePick,
    currentUser,
    isLoggedIn: !!currentUser?.user,
  };
}

export default useUserPicks;
