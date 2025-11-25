/**
 * Grid positioning utilities - Calculate pixel-perfect positions for all game elements
 */

import type { Position, StatType } from '../../types/game';
import { DEFAULT_GRID_CONFIG } from '../../types/game';
import { gridManager } from '../managers/GridManager';

const config = DEFAULT_GRID_CONFIG;

/**
 * Get weapon slot position (attack node position)
 * Wrapper around gridManager.getWeaponSlotPosition
 */
export function getWeaponSlotPosition(stat: StatType, side: 'left' | 'right'): Position {
  return gridManager.getWeaponSlotPosition(stat, side);
}

/**
 * Calculate the Y position for a stat row
 */
export function getStatRowY(statIndex: number): number {
  return statIndex * config.cellHeight + config.cellHeight / 2;
}

/**
 * Get stat index from stat type
 */
export function getStatIndex(stat: StatType): number {
  const statOrder: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];
  return statOrder.indexOf(stat);
}

/**
 * Calculate defense dot position (legacy - assumes 5 dots)
 * Use getDefenseDotPositionVariable for dynamic dot counts
 */
export function getDefenseDotPosition(
  stat: StatType,
  side: 'left' | 'right',
  index: number
): Position {
  const statIndex = getStatIndex(stat);
  const y = getStatRowY(statIndex);

  if (side === 'left') {
    // Left defense dots: after stat label, before attack dots
    const x = config.statLabelWidth + (index * config.cellWidth) + (config.cellWidth / 2);
    return { x, y };
  } else {
    // Right defense dots: after battlefield and attack dots, before right stat label
    const battlefieldStart = config.statLabelWidth +
      (config.defenseCellsPerSide * config.cellWidth) +
      (config.attackCellsPerSide * config.cellWidth) +
      config.battlefieldWidth +
      (config.attackCellsPerSide * config.cellWidth);
    const x = battlefieldStart + (index * config.cellWidth) + (config.cellWidth / 2);
    return { x, y };
  }
}

/**
 * Calculate defense cell position (max 10 cells per stat row)
 * Each cell can contain 0 or 1 defense dot
 * cellNumber: 1-10 (cell index within the stat row)
 *
 * LEFT SIDE: Dots fill from left to right (cell 1 = leftmost)
 * RIGHT SIDE: Dots fill from right to left (cell 1 = rightmost)
 *
 * NOW USES GRID MANAGER for accurate positioning
 */
export function getDefenseCellPosition(
  stat: StatType,
  side: 'left' | 'right',
  cellNumber: number
): Position {
  // Convert cellNumber (1-based) to index (0-based)
  const index = cellNumber - 1;
  return gridManager.getDefenseCellPosition(stat, side, index);
}

/**
 * Calculate attack dot position
 */
export function getAttackDotPosition(
  stat: StatType,
  side: 'left' | 'right',
  quarter: number
): Position {
  const statIndex = getStatIndex(stat);
  const y = getStatRowY(statIndex);

  if (side === 'left') {
    // Left attack dots: after stat label, weapon slot, and defense dots
    const attackStart = config.statLabelWidth + config.weaponSlotWidth + (config.defenseCellsPerSide * config.cellWidth);
    const x = attackStart + ((quarter - 1) * config.cellWidth) + (config.cellWidth / 2);
    return { x, y };
  } else {
    // Right attack dots: after battlefield, before defense dots
    const attackStart = config.statLabelWidth +
      config.weaponSlotWidth +
      (config.defenseCellsPerSide * config.cellWidth) +
      (config.attackCellsPerSide * config.cellWidth) +
      config.battlefieldWidth;
    const x = attackStart + ((quarter - 1) * config.cellWidth) + (config.cellWidth / 2);
    return { x, y };
  }
}

/**
 * Calculate attack cell position (alias for getAttackDotPosition with index instead of quarter)
 */
export function getAttackCellPosition(
  stat: StatType,
  side: 'left' | 'right',
  index: number
): Position {
  // index is 0-3, quarter is 1-4, so add 1
  return getAttackDotPosition(stat, side, index + 1);
}

/**
 * Calculate battlefield center position for a stat row
 */
export function getBattlefieldCenter(stat: StatType): Position {
  const statIndex = getStatIndex(stat);
  const y = getStatRowY(statIndex);

  const battlefieldStart = config.statLabelWidth +
    config.weaponSlotWidth +
    (config.defenseCellsPerSide * config.cellWidth) +
    (config.attackCellsPerSide * config.cellWidth);
  const x = battlefieldStart + (config.battlefieldWidth / 2);

  return { x, y };
}

/**
 * Calculate projectile start position (from attack dot)
 */
export function getProjectileStartPosition(
  stat: StatType,
  side: 'left' | 'right',
  quarter: number
): Position {
  return getAttackDotPosition(stat, side, quarter);
}

/**
 * Calculate projectile target position
 * - If hitting defense dot: position of the first alive defense dot
 * - If colliding with opposing projectile: battlefield center
 */
export function getProjectileTargetPosition(
  stat: StatType,
  side: 'left' | 'right',
  targetType: 'defense' | 'collision',
  defenseDotIndex?: number
): Position {
  if (targetType === 'collision') {
    return getBattlefieldCenter(stat);
  }

  // Target is a defense dot
  const targetSide = side === 'left' ? 'right' : 'left';
  const index = defenseDotIndex ?? 0;
  return getDefenseDotPosition(stat, targetSide, index);
}

/**
 * Calculate total canvas width
 */
export function getCanvasWidth(): number {
  // Grid width + space for castles (inventory bars are now outside canvas in flex layout)
  const gridWidth =
    (config.statLabelWidth * 2) + // Left and right stat labels
    (config.weaponSlotWidth * 2) + // Left and right weapon slots
    (config.defenseCellsPerSide * config.cellWidth * 2) + // Left and right defense
    (config.attackCellsPerSide * config.cellWidth * 2) + // Left and right attack
    config.battlefieldWidth; // Battlefield

  const castleSpace = 240; // Space for castle on each side (120px offset * 2)

  return gridWidth + castleSpace;
}

/**
 * Calculate total canvas height
 */
export function getCanvasHeight(): number {
  return 5 * config.cellHeight; // 5 stat rows
}

/**
 * Check if two positions are close enough for collision
 */
export function isColliding(
  pos1: Position,
  pos2: Position,
  threshold: number = 10
): boolean {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < threshold;
}

/**
 * Calculate distance between two positions
 */
export function getDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

