/**
 * Grid Manager - Centralized grid coordinate system
 * 
 * Manages the premium grid layout with castle boxes, stat labels, weapon slots,
 * defense cells, attack cells, and battlefield zones.
 * 
 * Provides conversion between:
 * - Grid coordinates (row, column) ↔ Pixel positions (x, y)
 * - Cell IDs ↔ Grid coordinates
 * - Cell IDs ↔ Pixel positions
 */

import { DEFAULT_GRID_CONFIG } from '../../types/game';
import type { StatType } from '../../types/game';

/**
 * Grid cell types
 */
export type CellType =
  | 'castle-box'
  | 'stat-label'
  | 'weapon-slot'
  | 'defense'
  | 'attack'
  | 'battlefield';

/**
 * Grid cell coordinate
 */
export interface GridCoordinate {
  row: number;      // 0-4 (5 stat rows)
  column: number;   // Varies by zone
  zone: GridZone;
}

/**
 * Grid zones (left to right)
 */
export type GridZone =
  | 'left-castle-box'
  | 'left-stat-label'
  | 'left-weapon-slot'
  | 'left-defense'
  | 'left-attack'
  | 'battlefield'
  | 'right-attack'
  | 'right-defense'
  | 'right-weapon-slot'
  | 'right-stat-label'
  | 'right-castle-box';

/**
 * Grid cell information
 */
export interface GridCell {
  id: string;
  type: CellType;
  zone: GridZone;
  coordinate: GridCoordinate;
  position: { x: number; y: number };  // Center of cell
  bounds: {
    x: number;      // Left edge
    y: number;      // Top edge
    width: number;
    height: number;
  };
  stat?: StatType;  // For stat-specific cells
  side?: 'left' | 'right';
  index?: number;   // For defense/attack cells (0-based)
}

/**
 * Grid layout configuration
 */
interface GridLayout {
  // Zone boundaries (x positions)
  leftCastleBoxStart: number;
  leftStatLabelStart: number;
  leftWeaponSlotStart: number;
  leftDefenseStart: number;
  leftAttackStart: number;
  battlefieldStart: number;
  battlefieldEnd: number;
  rightAttackStart: number;
  rightDefenseStart: number;
  rightWeaponSlotStart: number;
  rightStatLabelStart: number;
  rightCastleBoxStart: number;

  // Dimensions
  castleBoxWidth: number;
  cellWidth: number;
  cellHeight: number;
  statLabelWidth: number;
  weaponSlotWidth: number;
  battlefieldWidth: number;
  defenseCells: number;
  attackCells: number;
}

/**
 * Grid Manager Singleton
 */
class GridManagerClass {
  private layout: GridLayout;
  private cellCache: Map<string, GridCell> = new Map();
  private stats: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];

  constructor() {
    this.layout = this.calculateLayout();
    this.initializeCellCache();
  }

  /**
   * Calculate grid layout based on config
   * MUST MATCH premiumGrid.ts layout exactly!
   */
  private calculateLayout(): GridLayout {
    const config = DEFAULT_GRID_CONFIG;
    const castleBoxWidth = 200; // Increased from 140px for more castle space

    // Calculate canvas width (from positioning.ts)
    const gridWidth =
      (config.statLabelWidth * 2) +
      (config.weaponSlotWidth * 2) +
      (config.defenseCellsPerSide * config.cellWidth * 2) +
      (config.attackCellsPerSide * config.cellWidth * 2) +
      config.battlefieldWidth;

    const castleSpace = 240; // Space for castles (120px offset * 2)
    const canvasWidth = gridWidth + castleSpace;

    // Center the grid on canvas (MUST MATCH premiumGrid.ts)
    const gridStartX = (canvasWidth - gridWidth) / 2;

    // CRITICAL: Must match premiumGrid.ts layout exactly
    const leftStatLabelStart = gridStartX;
    const leftWeaponSlotStart = leftStatLabelStart + config.statLabelWidth;
    const leftDefenseStart = leftWeaponSlotStart + config.weaponSlotWidth;
    const leftAttackStart = leftDefenseStart + (config.defenseCellsPerSide * config.cellWidth);
    const battlefieldStart = leftAttackStart + (config.attackCellsPerSide * config.cellWidth);
    const battlefieldEnd = battlefieldStart + config.battlefieldWidth;
    const rightAttackStart = battlefieldEnd;
    const rightDefenseStart = rightAttackStart + (config.attackCellsPerSide * config.cellWidth);
    const rightWeaponSlotStart = rightDefenseStart + (config.defenseCellsPerSide * config.cellWidth);
    const rightStatLabelStart = rightWeaponSlotStart + config.weaponSlotWidth;
    // Castle boxes: left anchored to left canvas edge, right anchored to right edge
    const leftCastleBoxStart = 0;
    const rightCastleBoxStart = canvasWidth - castleBoxWidth;

    return {
      leftCastleBoxStart,
      leftStatLabelStart,
      leftWeaponSlotStart,
      leftDefenseStart,
      leftAttackStart,
      battlefieldStart,
      battlefieldEnd,
      rightAttackStart,
      rightDefenseStart,
      rightWeaponSlotStart,
      rightStatLabelStart,
      rightCastleBoxStart,
      castleBoxWidth,
      cellWidth: config.cellWidth,
      cellHeight: config.cellHeight,
      statLabelWidth: config.statLabelWidth,
      weaponSlotWidth: config.weaponSlotWidth,
      battlefieldWidth: config.battlefieldWidth,
      defenseCells: config.defenseCellsPerSide,
      attackCells: config.attackCellsPerSide,
    };
  }

  /**
   * Initialize cell cache with all grid cells
   */
  private initializeCellCache(): void {
    // Create cells for each stat row (0-4)
    for (let row = 0; row < 5; row++) {
      const stat = this.stats[row];

      // Left weapon slot
      this.createWeaponSlotCell(row, stat, 'left');

      // Left defense cells
      for (let col = 0; col < this.layout.defenseCells; col++) {
        this.createDefenseCell(row, col, stat, 'left');
      }

      // Left attack cells
      for (let col = 0; col < this.layout.attackCells; col++) {
        this.createAttackCell(row, col, stat, 'left');
      }

      // Right attack cells
      for (let col = 0; col < this.layout.attackCells; col++) {
        this.createAttackCell(row, col, stat, 'right');
      }

      // Right defense cells
      for (let col = 0; col < this.layout.defenseCells; col++) {
        this.createDefenseCell(row, col, stat, 'right');
      }

      // Right weapon slot
      this.createWeaponSlotCell(row, stat, 'right');
    }

    console.log(`✅ GridManager initialized with ${this.cellCache.size} cells`);
  }

  /**
   * Create weapon slot cell
   */
  private createWeaponSlotCell(row: number, stat: StatType, side: 'left' | 'right'): void {
    const y = row * this.layout.cellHeight;
    const x = side === 'left'
      ? this.layout.leftWeaponSlotStart
      : this.layout.rightWeaponSlotStart;

    const cell: GridCell = {
      id: `weapon-${stat}-${side}`,
      type: 'weapon-slot',
      zone: side === 'left' ? 'left-weapon-slot' : 'right-weapon-slot',
      coordinate: { row, column: 0, zone: side === 'left' ? 'left-weapon-slot' : 'right-weapon-slot' },
      position: {
        x: x + this.layout.weaponSlotWidth / 2,
        y: y + this.layout.cellHeight / 2,
      },
      bounds: {
        x,
        y,
        width: this.layout.weaponSlotWidth,
        height: this.layout.cellHeight,
      },
      stat,
      side,
    };

    this.cellCache.set(cell.id, cell);
  }

  /**
   * Create defense cell
   * LEFT SIDE: Fills left to right (col 0 = leftmost)
   * RIGHT SIDE: Fills RIGHT to LEFT (col 0 = rightmost, col 9 = leftmost)
   */
  private createDefenseCell(row: number, col: number, stat: StatType, side: 'left' | 'right'): void {
    const y = row * this.layout.cellHeight;

    let x: number;
    if (side === 'left') {
      // Left side: col 0 = leftmost, col 9 = rightmost
      x = this.layout.leftDefenseStart + (col * this.layout.cellWidth);
    } else {
      // Right side: col 0 = rightmost, col 9 = leftmost
      // Reverse the column index so dots fill from right to left
      const reversedCol = (this.layout.defenseCells - 1) - col;
      x = this.layout.rightDefenseStart + (reversedCol * this.layout.cellWidth);
    }

    const cell: GridCell = {
      id: `defense-${stat}-${side}-${col}`,
      type: 'defense',
      zone: side === 'left' ? 'left-defense' : 'right-defense',
      coordinate: { row, column: col, zone: side === 'left' ? 'left-defense' : 'right-defense' },
      position: {
        x: x + this.layout.cellWidth / 2,
        y: y + this.layout.cellHeight / 2,
      },
      bounds: {
        x,
        y,
        width: this.layout.cellWidth,
        height: this.layout.cellHeight,
      },
      stat,
      side,
      index: col,
    };

    this.cellCache.set(cell.id, cell);
  }

  /**
   * Create attack cell
   */
  private createAttackCell(row: number, col: number, stat: StatType, side: 'left' | 'right'): void {
    const y = row * this.layout.cellHeight;
    const x = side === 'left'
      ? this.layout.leftAttackStart + (col * this.layout.cellWidth)
      : this.layout.rightAttackStart + (col * this.layout.cellWidth);

    const cell: GridCell = {
      id: `attack-${stat}-${side}-${col}`,
      type: 'attack',
      zone: side === 'left' ? 'left-attack' : 'right-attack',
      coordinate: { row, column: col, zone: side === 'left' ? 'left-attack' : 'right-attack' },
      position: {
        x: x + this.layout.cellWidth / 2,
        y: y + this.layout.cellHeight / 2,
      },
      bounds: {
        x,
        y,
        width: this.layout.cellWidth,
        height: this.layout.cellHeight,
      },
      stat,
      side,
      index: col,
    };

    this.cellCache.set(cell.id, cell);
  }

  // ==================== PUBLIC API ====================

  /**
   * Get cell by ID
   */
  getCell(cellId: string): GridCell | undefined {
    return this.cellCache.get(cellId);
  }

  /**
   * Get weapon slot position (center of cell)
   */
  getWeaponSlotPosition(stat: StatType, side: 'left' | 'right'): { x: number; y: number } {
    const cellId = `weapon-${stat}-${side}`;
    const cell = this.cellCache.get(cellId);
    if (!cell) {
      console.error(`❌ Weapon slot cell not found: ${cellId}`);
      return { x: 0, y: 0 };
    }
    return cell.position;
  }

  /**
   * Get defense cell position by index
   */
  getDefenseCellPosition(stat: StatType, side: 'left' | 'right', index: number): { x: number; y: number } {
    const cellId = `defense-${stat}-${side}-${index}`;
    const cell = this.cellCache.get(cellId);
    if (!cell) {
      console.error(`❌ Defense cell not found: ${cellId}`);
      return { x: 0, y: 0 };
    }
    return cell.position;
  }

  /**
   * Get battlefield center position
   */
  getBattlefieldCenter(): { x: number; y: number } {
    return {
      x: this.layout.battlefieldStart + this.layout.battlefieldWidth / 2,
      y: (5 * this.layout.cellHeight) / 2,
    };
  }

  /**
   * Get castle box position.
   *
   * We want each castle to sit in the side lane between the canvas edge and the grid,
   * but slightly biased toward the grid so there isn't a big gap between the castle
   * and the stat labels (as in the reference design).
   */
  getCastleBoxPosition(side: 'left' | 'right'): { x: number; y: number } {
    // Distance from left canvas edge to start of the grid
    const leftRegionWidth = this.layout.leftStatLabelStart;

    // X coordinate where the grid ends on the right
    const gridEndX = this.layout.rightStatLabelStart + this.layout.statLabelWidth;

    // Because the grid is centered, the space to the right of the grid is also
    // `leftRegionWidth`, so total canvas width can be reconstructed.
    const canvasWidth = gridEndX + leftRegionWidth;

    // Bias castles ~20px toward the grid from the exact center of the side lane
    const bias = 20;

    const x = side === 'left'
      ? (leftRegionWidth / 2) + bias
      : (canvasWidth - (leftRegionWidth / 2) - bias);

    const y = (5 * this.layout.cellHeight) / 2; // Center of 5 rows

    return { x, y };
  }

  /**
   * Get all defense cells for a stat and side
   */
  getDefenseCells(stat: StatType, side: 'left' | 'right'): GridCell[] {
    const cells: GridCell[] = [];
    for (let i = 0; i < this.layout.defenseCells; i++) {
      const cellId = `defense-${stat}-${side}-${i}`;
      const cell = this.cellCache.get(cellId);
      if (cell) cells.push(cell);
    }
    return cells;
  }

  /**
   * Get grid layout info
   */
  getLayout(): Readonly<GridLayout> {
    return { ...this.layout };
  }

  /**
   * Get cell width (for projectile speed calculations)
   */
  public getCellWidth(): number {
    return this.layout.cellWidth;
  }

  /**
   * Get cell height
   */
  public getCellHeight(): number {
    return this.layout.cellHeight;
  }

  /**
   * Debug: Log all cells
   */
  debugLogCells(): void {
    console.log('📊 Grid Manager - All Cells:');
    this.cellCache.forEach((cell, id) => {
      console.log(`  ${id}:`, cell.position);
    });
  }
}

// Export singleton instance
export const gridManager = new GridManagerClass();

