/**
 * UnitRecordDisplay - Manages the display of unit record text above each grid
 * Shows team abbreviation + unit record (e.g., "LAL +40 UNITS")
 * Positioned above the defense grid for each team
 */

import * as PIXI from 'pixi.js';
import { DEFAULT_GRID_CONFIG } from '../../types/game';

interface UnitRecordConfig {
  side: 'left' | 'right';
  teamAbbr: string;
  teamColor: number;
  units: number;
  position: { x: number; y: number };
}

class UnitRecordDisplayManager {
  private container: PIXI.Container | null = null;
  private leftText: PIXI.Text | null = null;
  private rightText: PIXI.Text | null = null;
  private leftGlow: PIXI.Graphics | null = null;
  private rightGlow: PIXI.Graphics | null = null;

  /**
   * Set the PixiJS container for rendering
   */
  setContainer(container: PIXI.Container): void {
    this.container = container;
  }

  /**
   * Add unit record text display for a team
   */
  addUnitRecord(config: UnitRecordConfig): void {
    if (!this.container) {
      console.error('❌ Container not set for UnitRecordDisplay');
      return;
    }

    // Format the text (e.g., "LAL +40 UNITS")
    const unitsText = config.units >= 0 ? `+${config.units}` : `${config.units}`;
    const displayText = `${config.teamAbbr} ${unitsText} UNITS`;

    // Create text style with team color
    const textStyle = new PIXI.TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: config.teamColor,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        alpha: 0.8,
        angle: Math.PI / 4,
        blur: 4,
        color: 0x000000,
        distance: 2,
      },
    });

    // Create text object
    const text = new PIXI.Text({
      text: displayText,
      style: textStyle,
    });

    // Position the text above the grid
    text.x = config.position.x;
    text.y = config.position.y;
    text.anchor.set(0.5, 0.5); // Center anchor

    // Create glow background (initially invisible)
    const glow = new PIXI.Graphics();
    glow.x = config.position.x;
    glow.y = config.position.y;
    glow.alpha = 0; // Start invisible

    // Add to container
    this.container.addChild(glow);
    this.container.addChild(text);

    // Store references
    if (config.side === 'left') {
      this.leftText = text;
      this.leftGlow = glow;
    } else {
      this.rightText = text;
      this.rightGlow = glow;
    }

    console.log(`✅ Unit record added for ${config.side}: ${displayText}`);
  }

  /**
   * Update unit record text (e.g., when units change)
   */
  updateUnitRecord(side: 'left' | 'right', teamAbbr: string, units: number): void {
    const text = side === 'left' ? this.leftText : this.rightText;
    if (!text) return;

    const unitsText = units >= 0 ? `+${units}` : `${units}`;
    text.text = `${teamAbbr} ${unitsText} UNITS`;
  }

  /**
   * Get the position of the unit record text (for orb spawn point)
   */
  getPosition(side: 'left' | 'right'): { x: number; y: number } | null {
    const text = side === 'left' ? this.leftText : this.rightText;
    if (!text) return null;

    return { x: text.x, y: text.y };
  }

  /**
   * Get the text object (for animations)
   */
  getText(side: 'left' | 'right'): PIXI.Text | null {
    return side === 'left' ? this.leftText : this.rightText;
  }

  /**
   * Get the glow graphics object (for animations)
   */
  getGlow(side: 'left' | 'right'): PIXI.Graphics | null {
    return side === 'left' ? this.leftGlow : this.rightGlow;
  }

  /**
   * Clear all unit record displays
   */
  clear(): void {
    if (this.leftText) {
      this.leftText.destroy();
      this.leftText = null;
    }
    if (this.rightText) {
      this.rightText.destroy();
      this.rightText = null;
    }
    if (this.leftGlow) {
      this.leftGlow.destroy();
      this.leftGlow = null;
    }
    if (this.rightGlow) {
      this.rightGlow.destroy();
      this.rightGlow = null;
    }
  }
}

// Singleton instance
export const unitRecordDisplay = new UnitRecordDisplayManager();

