/**
 * CollisionDebugger - Lightweight collision debugging system
 * Provides concise snapshots of projectile/defense orb state for troubleshooting
 */

import type { BaseProjectile } from '../entities/projectiles/BaseProjectile';
import type { DefenseDot } from '../entities/DefenseDot';
import { gridManager } from '../managers/GridManager';
import type { StatType } from '../../types/game';

interface CollisionEvent {
  time: string;
  type: 'HIT' | 'MISS' | 'CHECK';
  projectileId: string;
  cellId: string | null;
  orbFound: boolean;
  posX: number;
}

class CollisionDebugger {
  private collisionEvents: CollisionEvent[] = [];
  private maxEvents = 10;

  /**
   * Log a collision check event
   */
  logCollisionCheck(
    projectile: BaseProjectile,
    cellId: string | null,
    orbFound: boolean,
    hit: boolean
  ): void {
    this.collisionEvents.push({
      time: new Date().toLocaleTimeString(),
      type: hit ? 'HIT' : orbFound ? 'MISS' : 'CHECK',
      projectileId: `${projectile.stat}-${projectile.id.split('-').slice(-2).join('-')}`, // Include stat
      cellId,
      orbFound,
      posX: Math.round(projectile.position.x)
    });

    // Keep only last N events
    if (this.collisionEvents.length > this.maxEvents) {
      this.collisionEvents.shift();
    }
  }

  /**
   * Generate concise debug snapshot
   */
  generateSnapshot(
    gameId: string,
    activeProjectiles: Map<string, BaseProjectile>,
    defenseDots: Map<string, DefenseDot>
  ): string {
    const lines: string[] = [];

    // Safety check for undefined/null gameId
    const safeGameId = gameId || 'unknown';
    const gameLabel = safeGameId.includes('-') ? safeGameId.split('-')[0] : safeGameId;

    lines.push('🔍 COLLISION DEBUG SNAPSHOT');
    lines.push(`Game: ${gameLabel} | ${new Date().toLocaleTimeString()}`);
    lines.push('');

    // Defense Orbs Summary (grouped by stat/side)
    lines.push('🛡️ DEFENSE ORBS:');
    const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
    const sides: ('left' | 'right')[] = ['left', 'right'];

    // Also show sample cellIds for debugging
    const sampleCellIds: string[] = [];

    sides.forEach(side => {
      const sideLabel = side === 'left' ? 'L' : 'R';
      const orbsByStat: string[] = [];

      stats.forEach(stat => {
        const orbs: string[] = [];
        for (let i = 0; i < 10; i++) {
          const cellId = `defense-${stat}-${side}-${i}`;
          const orb = Array.from(defenseDots.values()).find(d => d.cellId === cellId);
          if (orb && orb.alive) {
            orbs.push(`${i}:${orb.hp}`);
            // Collect first few cellIds for debugging - show ACTUAL cellId property
            if (sampleCellIds.length < 3) {
              sampleCellIds.push(`grid[${cellId}]→orb[${orb.cellId}]`);
            }
          }
        }
        if (orbs.length > 0) {
          orbsByStat.push(`${stat}[${orbs.join(',')}]`);
        }
      });

      if (orbsByStat.length > 0) {
        lines.push(`  ${sideLabel}: ${orbsByStat.join(' | ')}`);
      }
    });

    // Show sample cellId mappings
    if (sampleCellIds.length > 0) {
      lines.push(`  Sample IDs: ${sampleCellIds.join(' | ')}`);
    }
    lines.push('');

    // Active Projectiles (concise)
    const leftProj = Array.from(activeProjectiles.values()).filter(p => p.side === 'left' && !p.collided);
    const rightProj = Array.from(activeProjectiles.values()).filter(p => p.side === 'right' && !p.collided);

    lines.push(`🚀 PROJECTILES: L→R:${leftProj.length} | R→L:${rightProj.length}`);

    // Show sample projectiles (max 3 per side) with X,Y coordinates
    [...leftProj.slice(0, 3), ...rightProj.slice(0, 3)].forEach(p => {
      const targetSide = p.side === 'left' ? 'right' : 'left';
      const cell = gridManager.getDefenseCellAtPosition(
        p.position.x,
        p.position.y,
        p.stat as StatType,
        targetSide
      );
      const shortId = p.id.split('-').slice(-2).join('-');
      lines.push(`  ${shortId}: X=${Math.round(p.position.x)} Y=${Math.round(p.position.y)} ${p.stat} ${cell ? `in[${cell.id.split('-').slice(-2).join('-')}]` : 'no-cell'}`);
    });
    lines.push('');

    // Sample cell bounds for debugging
    lines.push('📏 SAMPLE CELLS:');
    const sampleStats: StatType[] = ['pts', 'reb'];
    try {
      sampleStats.forEach(stat => {
        const leftCells = gridManager.getDefenseCells(stat, 'left');
        const rightCells = gridManager.getDefenseCells(stat, 'right');
        const leftCell = leftCells.length > 0 ? leftCells[0] : null;
        const rightCell = rightCells.length > 0 ? rightCells[0] : null;
        if (leftCell) {
          lines.push(`  ${stat}-L-0: X[${Math.round(leftCell.bounds.x)}-${Math.round(leftCell.bounds.x + leftCell.bounds.width)}] Y[${Math.round(leftCell.bounds.y)}-${Math.round(leftCell.bounds.y + leftCell.bounds.height)}]`);
        }
        if (rightCell) {
          lines.push(`  ${stat}-R-0: X[${Math.round(rightCell.bounds.x)}-${Math.round(rightCell.bounds.x + rightCell.bounds.width)}] Y[${Math.round(rightCell.bounds.y)}-${Math.round(rightCell.bounds.y + rightCell.bounds.height)}]`);
        }
      });
    } catch (err) {
      lines.push(`  ❌ Error getting cells: ${err}`);
    }
    lines.push('');

    // Recent collision events
    lines.push('💥 EVENTS:');
    this.collisionEvents.slice(-5).forEach(e => {
      const cellShort = e.cellId ? e.cellId.split('-').slice(-2).join('-') : 'null';
      const status = e.type === 'HIT' ? '✅' : e.type === 'MISS' ? '❌' : '🔍';
      lines.push(`  ${status} ${e.projectileId} X=${e.posX} cell=${cellShort} orb=${e.orbFound}`);
    });

    return lines.join('\n');
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.collisionEvents = [];
  }
}

export const collisionDebugger = new CollisionDebugger();

