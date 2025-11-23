/**
 * ProjectileDebugger - Visual debugging system for projectile movement
 * Shows grid cells, projectile paths, collision points, and detailed metrics
 */

import * as PIXI from 'pixi.js';
import { gridManager } from '../managers/GridManager';

interface ProjectileDebugInfo {
  id: string;
  side: 'left' | 'right';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  speed: number;
  distanceTraveled: number;
  gridCellsTraveled: number;
  isActive: boolean;
  collisionPoint?: { x: number; y: number };
}

/**
 * Per-battle debug data
 */
interface BattleDebugData {
  container: PIXI.Container;
  gridOverlay: PIXI.Graphics;
  projectileTrails: Map<string, PIXI.Graphics>;
  projectileLabels: Map<string, PIXI.Text>;
}

class ProjectileDebugger {
  // Support multiple battles - each battle has its own container and overlays
  private battles: Map<string, BattleDebugData> = new Map();
  private debugInfo: Map<string, ProjectileDebugInfo> = new Map();
  private isEnabled: boolean = false; // Disabled by default - set to true for debugging

  /**
   * Initialize debugger for a specific battle
   */
  public initialize(battleId: string, container: PIXI.Container): void {
    // Clean up existing battle data if re-initializing
    if (this.battles.has(battleId)) {
      const existing = this.battles.get(battleId)!;
      existing.gridOverlay.destroy();
      existing.projectileTrails.forEach(trail => trail.destroy());
      existing.projectileLabels.forEach(label => label.destroy());
    }

    const gridOverlay = this.createGridOverlay(container);

    this.battles.set(battleId, {
      container,
      gridOverlay,
      projectileTrails: new Map(),
      projectileLabels: new Map(),
    });
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    // Update visibility for all battles
    this.battles.forEach(battle => {
      battle.gridOverlay.visible = enabled;
      battle.projectileTrails.forEach(trail => trail.visible = enabled);
      battle.projectileLabels.forEach(label => label.visible = enabled);
    });
  }

  private createGridOverlay(container: PIXI.Container): PIXI.Graphics {
    const gridOverlay = new PIXI.Graphics();

    const cellWidth = gridManager.getCellWidth();
    const cellHeight = gridManager.getCellHeight();

    // CRITICAL: Use GridManager layout instead of hardcoded values
    // This ensures debug overlay matches actual grid positions
    const layout = gridManager.getLayout();

    const gridHeight = 5 * cellHeight;

    // Left defense cells
    for (let i = 0; i < layout.defenseCells; i++) {
      const x = layout.leftDefenseStart + (i * cellWidth);
      this.drawGridCell(gridOverlay, x, 0, cellWidth, gridHeight, `L-D${i}`, 0x00ff00);
    }

    // Battlefield cells
    const battlefieldCells = Math.floor(layout.battlefieldWidth / cellWidth);
    for (let i = 0; i < battlefieldCells; i++) {
      const x = layout.battlefieldStart + (i * cellWidth);
      this.drawGridCell(gridOverlay, x, 0, cellWidth, gridHeight, `BF${i}`, 0xff0000);
    }

    // Right defense cells
    for (let i = 0; i < layout.defenseCells; i++) {
      const x = layout.rightDefenseStart + (i * cellWidth);
      this.drawGridCell(gridOverlay, x, 0, cellWidth, gridHeight, `R-D${i}`, 0x00ff00);
    }

    // Center line
    const centerX = layout.battlefieldStart + (layout.battlefieldWidth / 2);
    gridOverlay.moveTo(centerX, 0);
    gridOverlay.lineTo(centerX, gridHeight);
    gridOverlay.stroke({ width: 3, color: 0xff00ff, alpha: 0.8 });

    const centerLabel = new PIXI.Text({
      text: 'CENTER',
      style: { fontSize: 10, fill: 0xff00ff, fontWeight: 'bold' }
    });
    centerLabel.anchor.set(0.5, 0);
    centerLabel.position.set(centerX, gridHeight + 5);
    gridOverlay.addChild(centerLabel);

    container.addChild(gridOverlay);
    return gridOverlay;
  }

  private drawGridCell(
    graphics: PIXI.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number
  ): void {
    // Only draw border, no fill (so it doesn't cover castles)
    graphics.rect(x, y, width, height);
    graphics.stroke({ width: 1, color, alpha: 0.5 });

    const text = new PIXI.Text({
      text: label,
      style: { fontSize: 8, fill: color, align: 'center', stroke: { color: 0x000000, width: 2 } }
    });
    text.anchor.set(0.5, 0);
    text.position.set(x + width / 2, y + 2);
    graphics.addChild(text);
  }

  public registerProjectile(
    battleId: string,
    id: string,
    side: 'left' | 'right',
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    speed: number
  ): void {
    if (!this.isEnabled) return;

    const battle = this.battles.get(battleId);
    if (!battle) return;

    this.debugInfo.set(id, {
      id, side, startX, startY, targetX, targetY,
      currentX: startX, currentY: startY, speed,
      distanceTraveled: 0, gridCellsTraveled: 0, isActive: true
    });

    const trail = new PIXI.Graphics();
    battle.projectileTrails.set(id, trail);
    battle.container.addChild(trail);

    const label = new PIXI.Text({
      text: `${side[0].toUpperCase()}: 0.0 cells`,
      style: {
        fontSize: 9,
        fill: side === 'left' ? 0x00ff00 : 0xff6600,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 }
      }
    });
    label.anchor.set(0.5, 1);
    battle.projectileLabels.set(id, label);
    battle.container.addChild(label);

    console.log(`🎯 [DEBUG] Registered ${id}:`, {
      side, startX: startX.toFixed(1), targetX: targetX.toFixed(1),
      distance: Math.abs(targetX - startX).toFixed(1), speed: `${speed} cells/sec`
    });
  }

  public updateProjectile(battleId: string, id: string, currentX: number, currentY: number): void {
    if (!this.isEnabled) return;

    const battle = this.battles.get(battleId);
    if (!battle) return;

    const info = this.debugInfo.get(id);
    if (!info || !info.isActive) return;

    const prevX = info.currentX;
    const prevY = info.currentY;

    info.currentX = currentX;
    info.currentY = currentY;

    const dx = currentX - prevX;
    const dy = currentY - prevY;
    const distanceThisFrame = Math.sqrt(dx * dx + dy * dy);
    info.distanceTraveled += distanceThisFrame;

    const cellWidth = gridManager.getCellWidth();
    info.gridCellsTraveled = info.distanceTraveled / cellWidth;

    const trail = battle.projectileTrails.get(id);
    if (trail) {
      trail.moveTo(prevX, prevY);
      trail.lineTo(currentX, currentY);
      trail.stroke({ width: 2, color: info.side === 'left' ? 0x00ff00 : 0xff6600, alpha: 0.6 });
    }

    const label = battle.projectileLabels.get(id);
    if (label) {
      label.text = `${info.side[0].toUpperCase()}: ${info.gridCellsTraveled.toFixed(1)} cells`;
      label.position.set(currentX, currentY - 10);
    }
  }

  public markCollision(battleId: string, id: string, x: number, y: number, reason: string): void {
    if (!this.isEnabled) return;

    const battle = this.battles.get(battleId);
    if (!battle) return;

    const info = this.debugInfo.get(id);
    if (!info) return;

    info.isActive = false;
    info.collisionPoint = { x, y };

    const marker = new PIXI.Graphics();
    marker.circle(x, y, 8);
    marker.fill({ color: 0xff0000, alpha: 0.5 });
    marker.stroke({ width: 2, color: 0xff0000 });
    battle.container.addChild(marker);

    const collisionLabel = new PIXI.Text({
      text: reason,
      style: {
        fontSize: 8, fill: 0xff0000, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 }
      }
    });
    collisionLabel.anchor.set(0.5, 0);
    collisionLabel.position.set(x, y + 10);
    battle.container.addChild(collisionLabel);

    console.log(`💥 [DEBUG] Collision ${id}:`, {
      side: info.side, gridCells: info.gridCellsTraveled.toFixed(2),
      distance: info.distanceTraveled.toFixed(1), x: x.toFixed(1), reason
    });
  }

  /**
   * Clear all debug data for all battles
   */
  public clear(): void {
    this.battles.forEach(battle => {
      battle.projectileTrails.forEach(trail => trail.destroy());
      battle.projectileLabels.forEach(label => label.destroy());
      battle.projectileTrails.clear();
      battle.projectileLabels.clear();
    });
    this.debugInfo.clear();
  }

  /**
   * Clear debug data for a specific battle
   */
  public clearBattle(battleId: string): void {
    const battle = this.battles.get(battleId);
    if (!battle) return;

    battle.projectileTrails.forEach(trail => trail.destroy());
    battle.projectileLabels.forEach(label => label.destroy());
    battle.gridOverlay.destroy();

    this.battles.delete(battleId);

    // Clear debug info for this battle's projectiles
    const projectilesToRemove: string[] = [];
    this.debugInfo.forEach((info, id) => {
      if (id.includes(battleId)) {
        projectilesToRemove.push(id);
      }
    });
    projectilesToRemove.forEach(id => this.debugInfo.delete(id));
  }

  public printSummary(): void {
    console.log('📊 [DEBUG] Projectile Summary:');
    this.debugInfo.forEach((info) => {
      console.log(`  ${info.id}:`, {
        side: info.side, gridCells: info.gridCellsTraveled.toFixed(2),
        pixels: info.distanceTraveled.toFixed(1), active: info.isActive
      });
    });
  }

  public getSummaryCounts(): {
    leftTotal: number;
    rightTotal: number;
    leftCollided: number;
    leftInFlight: number;
    rightCollided: number;
    rightInFlight: number;
  } {
    const allProjectiles = Array.from(this.debugInfo.values());
    const leftProjectiles = allProjectiles.filter(p => p.side === 'left');
    const rightProjectiles = allProjectiles.filter(p => p.side === 'right');

    const leftCollided = leftProjectiles.filter(p => !p.isActive).length;
    const rightCollided = rightProjectiles.filter(p => !p.isActive).length;

    return {
      leftTotal: leftProjectiles.length,
      rightTotal: rightProjectiles.length,
      leftCollided,
      leftInFlight: leftProjectiles.length - leftCollided,
      rightCollided,
      rightInFlight: rightProjectiles.length - rightCollided,
    };
  }


  /**
   * Get comprehensive debug report as a string (for copying to clipboard)
   * Safe on "no projectiles" and never throws.
   */
  public getDebugReport(): string {
    const lines: string[] = [];

    try {
      lines.push('📊 ===== PROJECTILE DEBUG REPORT =====');
      lines.push(`Generated: ${new Date().toLocaleString()}`);
      lines.push(`Total projectiles tracked: ${this.debugInfo.size}`);
      lines.push('');

      const allProjectiles = Array.from(this.debugInfo.values());
      const leftProjectiles = allProjectiles.filter(p => p.side === 'left');
      const rightProjectiles = allProjectiles.filter(p => p.side === 'right');

      lines.push(`🟢 LEFT PROJECTILES (${leftProjectiles.length}):`);
      lines.push('─'.repeat(80));
      leftProjectiles.forEach(p => {
        const status = p.isActive ? '✈️ IN FLIGHT' : '💥 COLLIDED';
        lines.push(`ID: ${p.id}`);
        lines.push(`  Status: ${status}`);
        lines.push(`  Side: ${p.side}`);
        lines.push(`  Grid Cells Traveled: ${p.gridCellsTraveled.toFixed(2)}`);
        lines.push(`  Pixels Traveled: ${p.distanceTraveled.toFixed(1)}px`);
        lines.push('');
      });

      lines.push('');
      lines.push(`🟠 RIGHT PROJECTILES (${rightProjectiles.length}):`);
      lines.push('─'.repeat(80));
      rightProjectiles.forEach(p => {
        const status = p.isActive ? '✈️ IN FLIGHT' : '💥 COLLIDED';
        lines.push(`ID: ${p.id}`);
        lines.push(`  Status: ${status}`);
        lines.push(`  Side: ${p.side}`);
        lines.push(`  Grid Cells Traveled: ${p.gridCellsTraveled.toFixed(2)}`);
        lines.push(`  Pixels Traveled: ${p.distanceTraveled.toFixed(1)}px`);
        lines.push('');
      });

      lines.push('');
      lines.push('📈 STATISTICS:');
      lines.push('─'.repeat(80));

      const avgLeftCells = leftProjectiles.length > 0
        ? leftProjectiles.reduce((sum, p) => sum + p.gridCellsTraveled, 0) / leftProjectiles.length
        : 0;
      const avgRightCells = rightProjectiles.length > 0
        ? rightProjectiles.reduce((sum, p) => sum + p.gridCellsTraveled, 0) / rightProjectiles.length
        : 0;

      lines.push(`Average Grid Cells Traveled (Left): ${avgLeftCells.toFixed(2)}`);
      lines.push(`Average Grid Cells Traveled (Right): ${avgRightCells.toFixed(2)}`);
      lines.push(`Difference: ${Math.abs(avgLeftCells - avgRightCells).toFixed(2)} cells`);

      const leftCollided = leftProjectiles.filter(p => !p.isActive).length;
      const rightCollided = rightProjectiles.filter(p => !p.isActive).length;

      lines.push(`Left Projectiles Collided: ${leftCollided}/${leftProjectiles.length}`);
      lines.push(`Right Projectiles Collided: ${rightCollided}/${rightProjectiles.length}`);

      lines.push('');
      lines.push('======================================');
    } catch (error) {
      lines.push('⚠️ Projectile debug report failed to generate.');
      lines.push(String(error));
    }

    return lines.join('\n');
  }

  /**
   * Generate comprehensive debug report with console logs
   */
  public generateFullDebugReport(): string {
    const lines: string[] = [];

    lines.push('🔍 ===== COMPREHENSIVE DEBUG REPORT =====');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    // Projectile data
    lines.push(this.getDebugReport());
    lines.push('');

    // Console logs
    lines.push('📋 ===== CONSOLE LOGS (Last 100) =====');
    const logs = (window as any).__debugConsoleBuffer || [];
    const recentLogs = logs.slice(-100);
    recentLogs.forEach((log: string) => lines.push(log));
    lines.push('');
    lines.push('======================================');

    return lines.join('\n');
  }
}

// Console log capture
if (typeof window !== 'undefined') {
  (window as any).__debugConsoleBuffer = (window as any).__debugConsoleBuffer || [];
  const buffer = (window as any).__debugConsoleBuffer;
  const MAX_LOGS = 500;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    // Capture all logs but keep buffer bounded; filtering for "critical" happens in PerformanceMonitor
    buffer.push(`[LOG] ${new Date().toLocaleTimeString()}: ${message}`);
    if (buffer.length > MAX_LOGS) buffer.shift();

    originalLog(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    buffer.push(`[WARN] ${new Date().toLocaleTimeString()}: ${message}`);
    if (buffer.length > MAX_LOGS) buffer.shift();
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    buffer.push(`[ERROR] ${new Date().toLocaleTimeString()}: ${message}`);
    if (buffer.length > MAX_LOGS) buffer.shift();
    originalError(...args);
  };
}

export const projectileDebugger = new ProjectileDebugger();

