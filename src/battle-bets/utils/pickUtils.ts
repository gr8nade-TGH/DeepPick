/**
 * Pick Utility Functions
 *
 * Pure functions for sorting, filtering, and transforming pick data.
 * All functions are side-effect free and easily testable.
 */

import type {
  UserPick,
  PickStatus,
  PickChipData,
  PickTabCounts,
  CastleHP,
} from '../types/picks';

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort picks by unit record (highest first)
 * This determines default battle slot priority
 */
export function sortPicksByUnitRecord(picks: UserPick[]): UserPick[] {
  return [...picks].sort((a, b) => b.unitRecord.units - a.unitRecord.units);
}

/**
 * Sort picks by game start time (earliest first)
 */
export function sortPicksByStartTime(picks: UserPick[]): UserPick[] {
  return [...picks].sort(
    (a, b) => new Date(a.gameStartTime).getTime() - new Date(b.gameStartTime).getTime()
  );
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter picks by status
 */
export function filterPicksByStatus(
  picks: UserPick[],
  status: PickStatus | 'all'
): UserPick[] {
  if (status === 'all') return picks;
  return picks.filter((pick) => pick.status === status);
}

/**
 * Get filtered and sorted picks for display
 * Combines filtering and sorting by unit record
 */
export function getDisplayPicks(
  picks: UserPick[],
  filter: PickStatus | 'all'
): UserPick[] {
  const filtered = filterPicksByStatus(picks, filter);
  return sortPicksByUnitRecord(filtered);
}

// ============================================================================
// COUNTING
// ============================================================================

/**
 * Calculate tab counts for all statuses
 */
export function calculateTabCounts(picks: UserPick[]): PickTabCounts {
  return {
    all: picks.length,
    live: picks.filter((p) => p.status === 'live').length,
    upcoming: picks.filter((p) => p.status === 'upcoming').length,
    final: picks.filter((p) => p.status === 'final').length,
  };
}

// ============================================================================
// DISPLAY FORMATTING
// ============================================================================

/**
 * Format spread for display (+/- prefix)
 */
export function formatSpread(spread: number | undefined): string {
  if (spread === undefined) return '';
  if (spread > 0) return `+${spread}`;
  return `${spread}`;
}

/**
 * Format unit record for display
 */
export function formatUnitRecord(units: number): string {
  const prefix = units >= 0 ? '+' : '';
  return `${prefix}${units} units`;
}

/**
 * Get color class for unit record
 */
export function getUnitRecordColor(units: number): 'green' | 'red' | 'neutral' {
  if (units > 0) return 'green';
  if (units < 0) return 'red';
  return 'neutral';
}

/**
 * Format game score for display
 */
export function formatGameScore(
  score: { home: number; away: number } | undefined,
  isHomeTeamPicked: boolean
): string {
  if (!score) return '';
  // Show picked team score first
  if (isHomeTeamPicked) {
    return `${score.home}-${score.away}`;
  }
  return `${score.away}-${score.home}`;
}

/**
 * Format quarter/period for display
 */
export function formatQuarter(quarter: number | undefined): string {
  if (!quarter) return '';
  if (quarter <= 4) return `Q${quarter}`;
  return `OT${quarter - 4}`;
}

/**
 * Format game time for upcoming games
 */
export function formatGameTime(startTime: Date): string {
  const date = new Date(startTime);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format final result for display
 */
export function formatFinalResult(
  result: 'win' | 'loss' | 'push' | 'pending' | undefined,
  finalScore: { home: number; away: number } | undefined,
  isHomeTeamPicked: boolean
): string {
  const prefix = result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'push' ? 'P' : '';
  const score = formatGameScore(finalScore, isHomeTeamPicked);
  return `${prefix} ${score}`.trim();
}

// ============================================================================
// CHIP DATA TRANSFORMATION
// ============================================================================

/**
 * Transform a UserPick into PickChipData for rendering
 */
export function pickToChipData(
  pick: UserPick,
  selectedBattle1Id: string | null,
  selectedBattle2Id: string | null
): PickChipData {
  const isSelected = pick.id === selectedBattle1Id || pick.id === selectedBattle2Id;
  const slotNumber: 1 | 2 | null =
    pick.id === selectedBattle1Id ? 1 :
      pick.id === selectedBattle2Id ? 2 : null;

  // Determine if picked team is home team (for score display order)
  const isHomeTeamPicked = pick.pickedTeam.id === pick.gameId.split('-')[0]; // Simplified check

  // Build status display string based on pick status
  let statusDisplay: string;
  switch (pick.status) {
    case 'live':
      const quarter = formatQuarter(pick.score?.quarter);
      const score = formatGameScore(pick.score, isHomeTeamPicked);
      statusDisplay = `${quarter} ${score}`.trim();
      break;
    case 'upcoming':
      statusDisplay = formatGameTime(pick.gameStartTime);
      break;
    case 'final':
      statusDisplay = formatFinalResult(pick.result, pick.finalScore, isHomeTeamPicked);
      break;
    default:
      statusDisplay = '';
  }

  return {
    pickId: pick.id,
    teamAbbr: pick.pickedTeam.abbreviation,
    spread: formatSpread(pick.spread),
    opponentAbbr: pick.opposingTeam.abbreviation,
    unitRecordDisplay: formatUnitRecord(pick.unitRecord.units),
    status: pick.status,
    statusDisplay,
    isSelected,
    slotNumber,
    teamColor: pick.pickedTeam.color,
    unitRecordColor: getUnitRecordColor(pick.unitRecord.units),
    resultColor: pick.status === 'final'
      ? (pick.result === 'win' ? 'green' : pick.result === 'loss' ? 'red' : 'gray')
      : undefined,
    castleHP: pick.castleHP,
  };
}

/**
 * Get default selection (top 2 by unit record)
 * Returns [battle1Id, battle2Id]
 */
export function getDefaultSelection(
  picks: UserPick[]
): [string | null, string | null] {
  const sorted = sortPicksByUnitRecord(picks);
  return [
    sorted[0]?.id ?? null,
    sorted[1]?.id ?? null,
  ];
}

/**
 * Calculate new selection when a pick is clicked
 * Returns [newBattle1Id, newBattle2Id]
 */
export function calculateNewSelection(
  clickedPickId: string,
  currentBattle1Id: string | null,
  currentBattle2Id: string | null
): [string | null, string | null] {
  // If already selected, deselect it
  if (clickedPickId === currentBattle1Id) {
    // Promote Battle 2 to Battle 1
    return [currentBattle2Id, null];
  }
  if (clickedPickId === currentBattle2Id) {
    // Just remove Battle 2
    return [currentBattle1Id, null];
  }

  // If not selected, add it
  if (currentBattle1Id === null) {
    // No Battle 1, put it there
    return [clickedPickId, currentBattle2Id];
  }
  if (currentBattle2Id === null) {
    // Has Battle 1 but no Battle 2, put it in Battle 2
    return [currentBattle1Id, clickedPickId];
  }

  // Both slots filled - replace Battle 2 (the "swap" slot)
  return [currentBattle1Id, clickedPickId];
}

// ============================================================================
// HP BAR CALCULATIONS
// ============================================================================

/**
 * Calculate HP bar percentage
 */
export function calculateHPPercentage(hp: CastleHP | undefined): number {
  if (!hp || hp.max === 0) return 100;
  return Math.round((hp.current / hp.max) * 100);
}

/**
 * Get HP bar color based on percentage
 */
export function getHPBarColor(percentage: number): string {
  if (percentage > 60) return '#22c55e'; // Green
  if (percentage > 30) return '#eab308'; // Yellow
  return '#ef4444'; // Red
}
