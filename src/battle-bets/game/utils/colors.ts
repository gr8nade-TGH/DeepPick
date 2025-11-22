/**
 * Color utilities for stats and UI elements
 */

import type { StatType } from '../../types/game';

/**
 * Get the color for a specific stat type
 */
export function getStatColor(stat: StatType): number {
  const colorMap: Record<StatType, number> = {
    pts: 0xFF6B35, // Orange (Points)
    reb: 0x4ECDC4, // Cyan (Rebounds)
    ast: 0xF7B731, // Yellow (Assists)
    blk: 0xFF3838, // Red (Blocks)
    '3pt': 0x00D2FF, // Blue (3-Point)
  };

  return colorMap[stat] || 0xFFFFFF; // Default to white if stat not found
}

/**
 * Get the glow color for a specific stat type (lighter version)
 */
export function getStatGlowColor(stat: StatType): number {
  const glowMap: Record<StatType, number> = {
    pts: 0xFFAA88, // Light orange
    reb: 0x88FFEE, // Light cyan
    ast: 0xFFEE88, // Light yellow
    blk: 0xFF8888, // Light red
    '3pt': 0x88EEFF, // Light blue
  };

  return glowMap[stat] || 0xFFFFFF;
}

