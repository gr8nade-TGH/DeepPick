/**
 * ProjectileDebugger - Visual debugging system for projectile movement
 * Shows grid cells, projectile paths, collision points, and detailed metrics
 */

import * as PIXI from 'pixi.js';
import { gridManager } from '../managers/GridManager';
import { DEFAULT_GRID_CONFIG } from '../../types/game';

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

class ProjectileDebugger {
  private container: PIXI.Container | null = null;
  private gridOverlay: PIXI.Graphics | null = null;
  private projectileTrails: Map<string, PIXI.Graphics> = new Map();
  private projectileLabels: Map<string, PIXI.Text> = new Map();
  private debugInfo: Map<string, ProjectileDebugInfo> = new Map();
  private isEnabled: boolean = false; // Disabled by default - set to true for debugging

  public initialize(container: PIXI.Container): void {
    this.container = container;
    this.createGridOverlay();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (this.gridOverlay) {
      this.gridOverlay.visible = enabled;
    }
    this.projectileTrails.forEach(trail => trail.visible = enabled);
    this.projectileLabels.forEach(label => label.visible = enabled);
  }

  private createGridOverlay(): void {
    if (!this.container) return;

    this.gridOverlay = new PIXI.Graphics();

    const cellWidth = gridManager.getCellWidth();
    const cellHeight = gridManager.getCellHeight();

    // Use DEFAULT_GRID_CONFIG directly instead of gridManager.getConfig()
    const config = DEFAULT_GRID_CONFIG;

    const itemSlotsWidth = 40;
    const castleBoxWidth = 200;
    const statLabelWidth = config.statLabelWidth;
    const weaponSlotWidth = config.weaponSlotWidth;
    const defenseCells = config.defenseCellsPerSide;
    const attackCells = config.attackCellsPerSide;
    const battlefieldWidth = config.battlefieldWidth;

    const leftDefenseStart = itemSlotsWidth + castleBoxWidth + statLabelWidth + weaponSlotWidth;
    const leftAttackStart = leftDefenseStart + (defenseCells * cellWidth);
    const battlefieldStart = leftAttackStart + (attackCells * cellWidth);
    const battlefieldEnd = battlefieldStart + battlefieldWidth;
    const rightAttackStart = battlefieldEnd;
    const rightDefenseStart = rightAttackStart + (attackCells * cellWidth);

    const gridHeight = 5 * cellHeight;

    // Left defense cells
    for (let i = 0; i < defenseCells; i++) {
      const x = leftDefenseStart + (i * cellWidth);
      this.drawGridCell(this.gridOverlay, x, 0, cellWidth, gridHeight, `L-D${i}`, 0x00ff00, 0.1);
    }

    // Battlefield cells
    const battlefieldCells = Math.floor(battlefieldWidth / cellWidth);
    for (let i = 0; i < battlefieldCells; i++) {
      const x = battlefieldStart + (i * cellWidth);
      this.drawGridCell(this.gridOverlay, x, 0, cellWidth, gridHeight, `BF${i}`, 0xff0000, 0.15);
    }

    // Right defense cells
    for (let i = 0; i < defenseCells; i++) {
      const x = rightDefenseStart + (i * cellWidth);
      this.drawGridCell(this.gridOverlay, x, 0, cellWidth, gridHeight, `R-D${i}`, 0x00ff00, 0.1);
    }

    // Center line
    const centerX = battlefieldStart + (battlefieldWidth / 2);
    this.gridOverlay.moveTo(centerX, 0);
    this.gridOverlay.lineTo(centerX, gridHeight);
    this.gridOverlay.stroke({ width: 3, color: 0xff00ff, alpha: 0.8 });

    const centerLabel = new PIXI.Text({
      text: 'CENTER',
      style: { fontSize: 10, fill: 0xff00ff, fontWeight: 'bold' }
    });
    centerLabel.anchor.set(0.5, 0);
    centerLabel.position.set(centerX, gridHeight + 5);
    this.gridOverlay.addChild(centerLabel);

    this.container.addChild(this.gridOverlay);
  }

  private drawGridCell(
    graphics: PIXI.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    alpha: number
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
    id: string,
    side: 'left' | 'right',
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    speed: number
  ): void {
    if (!this.isEnabled || !this.container) return;

    this.debugInfo.set(id, {
      id, side, startX, startY, targetX, targetY,
      currentX: startX, currentY: startY, speed,
      distanceTraveled: 0, gridCellsTraveled: 0, isActive: true
    });

    const trail = new PIXI.Graphics();
    this.projectileTrails.set(id, trail);
    this.container.addChild(trail);

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
    this.projectileLabels.set(id, label);
    this.container.addChild(label);

    console.log(`🎯 [DEBUG] Registered ${id}:`, {
      side, startX: startX.toFixed(1), targetX: targetX.toFixed(1),
      distance: Math.abs(targetX - startX).toFixed(1), speed: `${speed} cells/sec`
    });
  }

  public updateProjectile(id: string, currentX: number, currentY: number): void {
    if (!this.isEnabled) return;

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

    const trail = this.projectileTrails.get(id);
    if (trail) {
      trail.moveTo(prevX, prevY);
      trail.lineTo(currentX, currentY);
      trail.stroke({ width: 2, color: info.side === 'left' ? 0x00ff00 : 0xff6600, alpha: 0.6 });
    }

    const label = this.projectileLabels.get(id);
    if (label) {
      label.text = `${info.side[0].toUpperCase()}: ${info.gridCellsTraveled.toFixed(1)} cells`;
      label.position.set(currentX, currentY - 10);
    }
  }

  public markCollision(id: string, x: number, y: number, reason: string): void {
    if (!this.isEnabled || !this.container) return;

    const info = this.debugInfo.get(id);
    if (!info) return;

    info.isActive = false;
    info.collisionPoint = { x, y };

    const marker = new PIXI.Graphics();
    marker.circle(x, y, 8);
    marker.fill({ color: 0xff0000, alpha: 0.5 });
    marker.stroke({ width: 2, color: 0xff0000 });
    this.container.addChild(marker);

    const collisionLabel = new PIXI.Text({
      text: reason,
      style: {
        fontSize: 8, fill: 0xff0000, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 }
      }
    });
    collisionLabel.anchor.set(0.5, 0);
    collisionLabel.position.set(x, y + 10);
    this.container.addChild(collisionLabel);

    console.log(`💥 [DEBUG] Collision ${id}:`, {
      side: info.side, gridCells: info.gridCellsTraveled.toFixed(2),
      distance: info.distanceTraveled.toFixed(1), x: x.toFixed(1), reason
    });
  }

  public clear(): void {
    this.projectileTrails.forEach(trail => trail.destroy());
    this.projectileLabels.forEach(label => label.destroy());
    this.projectileTrails.clear();
    this.projectileLabels.clear();
    this.debugInfo.clear();
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

  /**
   * Get comprehensive debug report as a string (for copying to clipboard)
   */
  public getDebugReport(): string {
    const lines: string[] = [];

    lines.push('📊 ===== PROJECTILE DEBUG REPORT =====');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Total projectiles tracked: ${this.debugInfo.size}`);
    lines.push('');

    const leftProjectiles = Array.from(this.debugInfo.values()).filter(p => p.side === 'left');
    const rightProjectiles = Array.from(this.debugInfo.values()).filter(p => p.side === 'right');

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

    // Filter out spam - only show Fire Orb related messages
    const isFireOrbMessage = message.includes('🔥') || message.includes('FIRE ORB');
    const isImportantMessage = message.includes('❌') || message.includes('✅');

    if (isFireOrbMessage || isImportantMessage) {
      buffer.push(`[LOG] ${new Date().toLocaleTimeString()}: ${message}`);
      if (buffer.length > MAX_LOGS) buffer.shift();
      originalLog(...args);
    }
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

