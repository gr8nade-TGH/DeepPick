/**
 * DefenseOrbDebugger - Visual debugging for defense orb positions
 * Shows which grid cells contain defense orbs and their HP
 */

import * as PIXI from 'pixi.js';
import { gridManager } from '../managers/GridManager';
import type { StatType } from '../types';

interface DefenseOrbDebugInfo {
  stat: StatType;
  side: 'left' | 'right';
  cellIndex: number;
  hp: number;
  position: { x: number; y: number };
}

class DefenseOrbDebugger {
  private container: PIXI.Container | null = null;
  private overlayGraphics: PIXI.Graphics | null = null;
  private isVisible: boolean = false;

  /**
   * Initialize debugger with the battle container
   */
  public initialize(container: PIXI.Container): void {
    this.container = container;
  }

  /**
   * Toggle debug overlay visibility
   */
  public toggle(): void {
    this.isVisible = !this.isVisible;

    if (this.isVisible) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Show debug overlay with defense orb positions
   */
  public show(): void {
    if (!this.container) return;

    // Remove existing overlay
    this.hide();

    this.overlayGraphics = new PIXI.Graphics();
    this.container.addChild(this.overlayGraphics);

    const cellWidth = gridManager.getCellWidth();
    const cellHeight = gridManager.getCellHeight();
    const layout = gridManager.getLayout();

    // Draw all defense cells with labels
    const stats: StatType[] = ['PTS', 'AST', 'REB', 'BLK', 'STL'];

    stats.forEach((stat, statIndex) => {
      const y = statIndex * cellHeight;

      // LEFT DEFENSE CELLS
      for (let cellIndex = 0; cellIndex < layout.defenseCells; cellIndex++) {
        const x = layout.leftDefenseStart + (cellIndex * cellWidth);
        this.drawDefenseCell(
          this.overlayGraphics!,
          x,
          y,
          cellWidth,
          cellHeight,
          `L-${stat}-D${cellIndex}`,
          0x00ff00,
          cellIndex
        );
      }

      // RIGHT DEFENSE CELLS
      for (let cellIndex = 0; cellIndex < layout.defenseCells; cellIndex++) {
        const x = layout.rightDefenseStart + (cellIndex * cellWidth);
        this.drawDefenseCell(
          this.overlayGraphics!,
          x,
          y,
          cellWidth,
          cellHeight,
          `R-${stat}-D${cellIndex}`,
          0xff6600,
          cellIndex
        );
      }
    });

    this.isVisible = true;
  }

  /**
   * Draw a single defense cell with label
   */
  private drawDefenseCell(
    graphics: PIXI.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    cellIndex: number
  ): void {
    // Highlight cell 0 (closest to castle) with brighter color
    const alpha = cellIndex === 0 ? 0.8 : 0.3;
    const strokeWidth = cellIndex === 0 ? 3 : 1;

    // Draw cell border
    graphics.rect(x, y, width, height);
    graphics.stroke({ width: strokeWidth, color, alpha });

    // Fill cell 0 with semi-transparent color
    if (cellIndex === 0) {
      graphics.rect(x, y, width, height);
      graphics.fill({ color, alpha: 0.2 });
    }

    // Draw label
    const text = new PIXI.Text({
      text: label,
      style: {
        fontSize: 7,
        fill: color,
        align: 'center',
        fontWeight: cellIndex === 0 ? 'bold' : 'normal',
        stroke: { color: 0x000000, width: 2 }
      }
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(x + width / 2, y + height / 2);
    graphics.addChild(text);
  }

  /**
   * Hide debug overlay
   */
  public hide(): void {
    if (this.overlayGraphics) {
      this.overlayGraphics.destroy();
      this.overlayGraphics = null;
    }
    this.isVisible = false;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.hide();
    this.container = null;
  }
}

// Singleton instance
export const defenseOrbDebugger = new DefenseOrbDebugger();

