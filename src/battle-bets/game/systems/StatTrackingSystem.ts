/**
 * StatTrackingSystem.ts
 * 
 * API for items to query game stats and scores.
 * Provides functions to get quarter stats, scores, and differentials.
 */

import { multiGameStore } from '../../../store/multiGameStore';
import type { QuarterStats } from '../../events/types';

/**
 * Get quarter stats for a side
 */
export function getQuarterStats(
  gameId: string,
  side: 'left' | 'right',
  quarter: number
): QuarterStats | null {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [StatTrackingSystem] Game not found: ${gameId}`);
    return null;
  }
  
  const sideKey = side === 'left' ? 'leftQuarterStats' : 'rightQuarterStats';
  const quarterStats = game[sideKey];
  
  if (!quarterStats || !quarterStats[quarter]) {
    console.warn(`⚠️ [StatTrackingSystem] No stats for ${side} Q${quarter}`);
    return null;
  }
  
  return quarterStats[quarter];
}

/**
 * Get previous quarter stats (useful for items that react to last quarter)
 */
export function getPreviousQuarterStats(
  gameId: string,
  side: 'left' | 'right',
  currentQuarter: number
): QuarterStats | null {
  if (currentQuarter <= 1) {
    return null; // No previous quarter
  }
  
  return getQuarterStats(gameId, side, currentQuarter - 1);
}

/**
 * Get current score for a side
 */
export function getScore(
  gameId: string,
  side: 'left' | 'right'
): number {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [StatTrackingSystem] Game not found: ${gameId}`);
    return 0;
  }
  
  const sideKey = side === 'left' ? 'leftScore' : 'rightScore';
  return game[sideKey] ?? 0;
}

/**
 * Get score differential (positive = winning, negative = losing)
 */
export function getScoreDifferential(
  gameId: string,
  side: 'left' | 'right'
): number {
  const myScore = getScore(gameId, side);
  const opponentSide = side === 'left' ? 'right' : 'left';
  const opponentScore = getScore(gameId, opponentSide);
  
  return myScore - opponentScore;
}

/**
 * Check if a side is winning
 */
export function isWinning(
  gameId: string,
  side: 'left' | 'right'
): boolean {
  return getScoreDifferential(gameId, side) > 0;
}

/**
 * Check if a side is losing
 */
export function isLosing(
  gameId: string,
  side: 'left' | 'right'
): boolean {
  return getScoreDifferential(gameId, side) < 0;
}

/**
 * Get total 3PT makes across all quarters
 */
export function getTotal3PTMakes(
  gameId: string,
  side: 'left' | 'right'
): number {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [StatTrackingSystem] Game not found: ${gameId}`);
    return 0;
  }
  
  const sideKey = side === 'left' ? 'leftQuarterStats' : 'rightQuarterStats';
  const quarterStats = game[sideKey];
  
  if (!quarterStats) return 0;
  
  let total = 0;
  for (const quarter of Object.values(quarterStats)) {
    total += quarter['3pt'] ?? 0;
  }
  
  return total;
}

/**
 * Get total assists across all quarters
 */
export function getTotalAssists(
  gameId: string,
  side: 'left' | 'right'
): number {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [StatTrackingSystem] Game not found: ${gameId}`);
    return 0;
  }
  
  const sideKey = side === 'left' ? 'leftQuarterStats' : 'rightQuarterStats';
  const quarterStats = game[sideKey];
  
  if (!quarterStats) return 0;
  
  let total = 0;
  for (const quarter of Object.values(quarterStats)) {
    total += quarter.ast ?? 0;
  }
  
  return total;
}

/**
 * Get current quarter number
 */
export function getCurrentQuarter(gameId: string): number {
  const state = multiGameStore.getState();
  const game = state.games.get(gameId);
  
  if (!game) {
    console.error(`❌ [StatTrackingSystem] Game not found: ${gameId}`);
    return 0;
  }
  
  return game.currentQuarter ?? 0;
}

/**
 * Check if it's the 4th quarter (for Q4 bonuses)
 */
export function isFourthQuarter(gameId: string): boolean {
  return getCurrentQuarter(gameId) === 4;
}

