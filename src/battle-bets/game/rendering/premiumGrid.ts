/**
 * Premium AAA-Quality Grid Rendering
 * Professional visual effects with depth, shadows, and crisp rendering
 */

import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight } from '../utils/positioning';
import { DEFAULT_GRID_CONFIG } from '../../types/game';

// No extra configuration needed - keep it simple from edges

/**
 * Draw AAA-quality grid background with premium visual effects
 */
export function drawPremiumGrid(container: PIXI.Container): void {
  const width = getCanvasWidth();
  const height = getCanvasHeight();

  // Use config values
  const cellWidth = DEFAULT_GRID_CONFIG.cellWidth;
  const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;
  const statLabelWidth = DEFAULT_GRID_CONFIG.statLabelWidth;
  const weaponSlotWidth = DEFAULT_GRID_CONFIG.weaponSlotWidth;
  const defenseCells = DEFAULT_GRID_CONFIG.defenseCellsPerSide;
  const attackCells = DEFAULT_GRID_CONFIG.attackCellsPerSide;
  const battlefieldWidth = DEFAULT_GRID_CONFIG.battlefieldWidth;

  // Calculate total grid width
  const gridWidth =
    (statLabelWidth * 2) +
    (weaponSlotWidth * 2) +
    (defenseCells * cellWidth * 2) +
    (attackCells * cellWidth * 2) +
    battlefieldWidth;

  // Center the grid on canvas
  const gridStartX = (width - gridWidth) / 2;

  // Calculate positions (simple, left to right)
  const leftStatLabelStart = gridStartX;
  const leftWeaponSlotStart = leftStatLabelStart + statLabelWidth;
  const leftDefenseStart = leftWeaponSlotStart + weaponSlotWidth;
  const leftAttackStart = leftDefenseStart + (defenseCells * cellWidth);
  const battlefieldStart = leftAttackStart + (attackCells * cellWidth);
  const battlefieldEnd = battlefieldStart + battlefieldWidth;
  const rightAttackStart = battlefieldEnd;
  const rightDefenseStart = rightAttackStart + (attackCells * cellWidth);
  const rightWeaponSlotStart = rightDefenseStart + (defenseCells * cellWidth);
  const rightStatLabelStart = rightWeaponSlotStart + weaponSlotWidth;

  // Stats configuration with glow colors
  const stats = [
    { name: 'PTS', id: 'pts', value: 34, color: 0xFF6B35, glowColor: 0xFF8C5A },
    { name: 'REB', id: 'reb', value: 12, color: 0x4ECDC4, glowColor: 0x6EDDD5 },
    { name: 'AST', id: 'ast', value: 6, color: 0xF7B731, glowColor: 0xF9C74F },
    { name: 'BLK', id: 'blk', value: 8, color: 0xFF3838, glowColor: 0xFF5858 },
    { name: '3PT', id: '3pt', value: 4, color: 0x00D2FF, glowColor: 0x33E0FF },
  ];

  // Background removed - no need for full-screen background

  // Draw premium grid cells with depth and shadows
  for (let row = 0; row < 5; row++) {
    const y = row * cellHeight;
    const stat = stats[row];

    // Left weapon slot cell (blue item slot)
    drawPremiumCell(container, leftWeaponSlotStart, y, weaponSlotWidth, cellHeight, 'weapon', stat.color);

    // Left defense cells
    for (let col = 0; col < defenseCells; col++) {
      const x = leftDefenseStart + (col * cellWidth);
      drawPremiumCell(container, x, y, cellWidth, cellHeight, 'defense', stat.color);
    }

    // Left attack cells
    for (let col = 0; col < attackCells; col++) {
      const x = leftAttackStart + (col * cellWidth);
      drawPremiumCell(container, x, y, cellWidth, cellHeight, 'attack', stat.color);
    }

    // Right attack cells
    for (let col = 0; col < attackCells; col++) {
      const x = rightAttackStart + (col * cellWidth);
      drawPremiumCell(container, x, y, cellWidth, cellHeight, 'attack', stat.color);
    }

    // Right defense cells
    // IMPORTANT: Must mirror GridManager.createDefenseCell - right side fills RIGHT to LEFT
    for (let col = 0; col < defenseCells; col++) {
      const reversedCol = (defenseCells - 1) - col;
      const x = rightDefenseStart + (reversedCol * cellWidth);
      drawPremiumCell(container, x, y, cellWidth, cellHeight, 'defense', stat.color);
    }

    // Right weapon slot cell (blue item slot)
    drawPremiumCell(container, rightWeaponSlotStart, y, weaponSlotWidth, cellHeight, 'weapon', stat.color);
  }

  // Premium battlefield area with depth
  drawPremiumBattlefield(container, battlefieldStart, 0, battlefieldWidth, height);

  // Draw stat labels (positioned after castle boxes)
  stats.forEach((stat, index) => {
    const y = (index * cellHeight) + (cellHeight / 2);
    drawPremiumStatLabels(container, stat, y, leftStatLabelStart, statLabelWidth, rightStatLabelStart, rightWeaponSlotStart, weaponSlotWidth);
  });

  // Draw attack balls inside weapon slot cells
  stats.forEach((stat, index) => {
    const y = (index * cellHeight) + (cellHeight / 2);

    // Left weapon slot ball
    drawWeaponBall(container, leftWeaponSlotStart + (weaponSlotWidth / 2), y, stat.color, stat.id, 'left');

    // Right weapon slot ball
    drawWeaponBall(container, rightWeaponSlotStart + (weaponSlotWidth / 2), y, stat.color, stat.id, 'right');
  });

  // That's it! Just the grid, no castle or inventory here
}

/**
 * Draw a premium cell with depth, gradient, and borders
 */
function drawPremiumCell(
  container: PIXI.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  type: 'defense' | 'attack' | 'weapon',
  accentColor: number
): void {
  // Shadow layer for depth (offset slightly)
  const shadow = new PIXI.Graphics();
  shadow.rect(x + 2, y + 2, width - 2, height - 2);
  shadow.fill({ color: 0x000000, alpha: 0.3 });
  container.addChild(shadow);

  // Main cell background with gradient effect
  const cell = new PIXI.Graphics();
  cell.rect(x, y, width, height);

  if (type === 'weapon') {
    // Weapon slot cells: blue background
    cell.fill({ color: 0x1a2332 });
  } else if (type === 'defense') {
    // Defense cells: darker with subtle gradient
    cell.fill({ color: 0x1a1a2e });
  } else {
    // Attack cells: lighter with more visible gradient
    cell.fill({ color: 0x1e2a45 });
  }

  // Border with accent color hint
  if (type === 'weapon') {
    // Blue border for weapon slots
    cell.stroke({ width: 2, color: 0x3366cc, alpha: 0.8 });
  } else {
    cell.stroke({ width: 2, color: 0x2a3a5e, alpha: 0.9 });
  }
  container.addChild(cell);

  // Inner highlight for 3D effect (top edge)
  const highlight = new PIXI.Graphics();
  highlight.rect(x + 2, y + 1, width - 4, 2);
  highlight.fill({ color: 0xffffff, alpha: 0.08 });
  container.addChild(highlight);

  // Subtle accent glow on top edge
  const accentGlow = new PIXI.Graphics();
  accentGlow.rect(x + 3, y, width - 6, 3);
  if (type === 'weapon') {
    // Blue glow for weapon slots
    accentGlow.fill({ color: 0x5588ff, alpha: 0.3 });
  } else {
    accentGlow.fill({ color: accentColor, alpha: 0.15 });
  }
  container.addChild(accentGlow);

  // Bottom shadow for depth
  const bottomShadow = new PIXI.Graphics();
  bottomShadow.rect(x + 2, y + height - 2, width - 4, 2);
  bottomShadow.fill({ color: 0x000000, alpha: 0.15 });
  container.addChild(bottomShadow);
}

/**
 * Draw premium battlefield area with depth and glow
 */
function drawPremiumBattlefield(
  container: PIXI.Container,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Outer shadow for depth
  const outerShadow = new PIXI.Graphics();
  outerShadow.rect(x + 4, y + 4, width - 8, height - 8);
  outerShadow.fill({ color: 0x000000, alpha: 0.4 });
  container.addChild(outerShadow);

  // Main battlefield background
  const battlefield = new PIXI.Graphics();
  battlefield.rect(x, y, width, height);
  battlefield.fill({ color: 0x0d1117 });
  battlefield.stroke({ width: 3, color: 0x30363d, alpha: 0.8 });
  container.addChild(battlefield);

  // Inner glow for premium look
  const innerGlow = new PIXI.Graphics();
  innerGlow.rect(x + 4, y + 4, width - 8, height - 8);
  innerGlow.stroke({ width: 2, color: 0x1d2127, alpha: 0.6 });
  container.addChild(innerGlow);

  // Center line with glow effect
  const centerX = x + (width / 2);

  // Glow layer (wider, more transparent)
  const centerGlow = new PIXI.Graphics();
  centerGlow.moveTo(centerX, y);
  centerGlow.lineTo(centerX, y + height);
  centerGlow.stroke({ width: 8, color: 0x30363d, alpha: 0.4 });
  container.addChild(centerGlow);

  // Main line (sharp and crisp)
  const centerLine = new PIXI.Graphics();
  centerLine.moveTo(centerX, y);
  centerLine.lineTo(centerX, y + height);
  centerLine.stroke({ width: 3, color: 0x50565d, alpha: 1.0 });
  container.addChild(centerLine);

  // VS text with premium styling
  const vsText = new PIXI.Text({
    text: 'VS',
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 36,
      fontWeight: '900',
      fill: 0x999999,
      stroke: { color: 0x000000, width: 4 },
      dropShadow: {
        color: 0x000000,
        blur: 6,
        angle: Math.PI / 4,
        distance: 3,
        alpha: 0.8,
      },
    },
  });
  vsText.anchor.set(0.5);
  vsText.x = centerX;
  vsText.y = (y + height) / 2;
  container.addChild(vsText);
}

/**
 * Draw weapon ball inside weapon slot cell
 */
function drawWeaponBall(
  container: PIXI.Container,
  x: number,
  y: number,
  color: number,
  statName: string,
  side: 'left' | 'right'
): void {
  const ballRadius = 10;

  // Create a container for the weapon ball so we can reference it later
  const weaponBallContainer = new PIXI.Container();
  weaponBallContainer.label = `weapon-ball-${statName}-${side}`; // Label for easy lookup (v8+ uses label instead of name)
  weaponBallContainer.x = x;
  weaponBallContainer.y = y;

  // Outer glow
  const outerGlow = new PIXI.Graphics();
  outerGlow.circle(0, 0, ballRadius + 4);
  outerGlow.fill({ color: color, alpha: 0.3 });
  weaponBallContainer.addChild(outerGlow);

  // Main ball
  const ball = new PIXI.Graphics();
  ball.circle(0, 0, ballRadius);
  ball.fill({ color: color, alpha: 0.9 });
  weaponBallContainer.addChild(ball);

  // Inner highlight for 3D effect
  const highlight = new PIXI.Graphics();
  highlight.circle(-3, -3, ballRadius / 3);
  highlight.fill({ color: 0xffffff, alpha: 0.6 });
  weaponBallContainer.addChild(highlight);

  // Border
  const border = new PIXI.Graphics();
  border.circle(0, 0, ballRadius);
  border.stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
  weaponBallContainer.addChild(border);

  container.addChild(weaponBallContainer);
}

/**
 * Create awesome Blue Shield Ring with shield icon
 */
function createBlueShieldRing(container: PIXI.Container): void {
  const ringRadius = 12;
  const ringThickness = 2.5;

  // Outer glow (blue aura)
  const outerGlow = new PIXI.Graphics();
  outerGlow.circle(0, 0, ringRadius + 4);
  outerGlow.fill({ color: 0x3b82f6, alpha: 0.2 });
  container.addChild(outerGlow);

  // Middle glow
  const midGlow = new PIXI.Graphics();
  midGlow.circle(0, 0, ringRadius + 2);
  midGlow.fill({ color: 0x60a5fa, alpha: 0.3 });
  container.addChild(midGlow);

  // Main ring (bright blue)
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, ringRadius);
  ring.stroke({ width: ringThickness, color: 0x60a5fa, alpha: 0.9 });
  container.addChild(ring);

  // Inner ring (decorative detail)
  const innerRing = new PIXI.Graphics();
  innerRing.circle(0, 0, ringRadius - 3);
  innerRing.stroke({ width: 1, color: 0x93c5fd, alpha: 0.6 });
  container.addChild(innerRing);

  // Shield icon in center (medieval shield shape)
  const shield = new PIXI.Graphics();

  // Shield outline (classic medieval shield - kite shield style)
  shield.moveTo(0, -6);        // Top center
  shield.lineTo(4, -4);         // Top right
  shield.lineTo(4, 2);          // Right side
  shield.lineTo(0, 6);          // Bottom point
  shield.lineTo(-4, 2);         // Left side
  shield.lineTo(-4, -4);        // Top left
  shield.closePath();
  shield.fill({ color: 0xffffff, alpha: 0.95 });

  // Shield border for definition
  shield.moveTo(0, -6);
  shield.lineTo(4, -4);
  shield.lineTo(4, 2);
  shield.lineTo(0, 6);
  shield.lineTo(-4, 2);
  shield.lineTo(-4, -4);
  shield.closePath();
  shield.stroke({ width: 0.8, color: 0x3b82f6 });

  // Shield cross emblem (classic medieval design)
  shield.rect(-0.6, -4, 1.2, 8); // Vertical bar
  shield.fill({ color: 0x3b82f6, alpha: 0.8 });
  shield.rect(-2.5, -0.8, 5, 1.2); // Horizontal bar
  shield.fill({ color: 0x3b82f6, alpha: 0.8 });

  container.addChild(shield);

  // Top-left shine highlight for 3D effect
  const shine = new PIXI.Graphics();
  shine.circle(-2, -3, 1.5);
  shine.fill({ color: 0xffffff, alpha: 0.5 });
  container.addChild(shine);
}

/**
 * Create awesome Fire Ring with flame icon
 */
function createFireRing(container: PIXI.Container): void {
  const ringRadius = 12;
  const ringThickness = 2.5;

  // Outer glow (orange-red aura)
  const outerGlow = new PIXI.Graphics();
  outerGlow.circle(0, 0, ringRadius + 4);
  outerGlow.fill({ color: 0xff4500, alpha: 0.25 });
  container.addChild(outerGlow);

  // Middle glow (brighter orange)
  const midGlow = new PIXI.Graphics();
  midGlow.circle(0, 0, ringRadius + 2);
  midGlow.fill({ color: 0xff6347, alpha: 0.35 });
  container.addChild(midGlow);

  // Main ring (bright orange-red)
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, ringRadius);
  ring.stroke({ width: ringThickness, color: 0xff6347, alpha: 0.9 });
  container.addChild(ring);

  // Inner ring (decorative detail - golden)
  const innerRing = new PIXI.Graphics();
  innerRing.circle(0, 0, ringRadius - 3);
  innerRing.stroke({ width: 1, color: 0xffa500, alpha: 0.7 });
  container.addChild(innerRing);

  // Flame icon in center (stylized fire)
  const flame = new PIXI.Graphics();

  // Flame shape (stylized fire)
  flame.moveTo(0, -5);         // Top point
  flame.bezierCurveTo(2, -3, 2.5, -1, 1.5, 1);  // Right curve
  flame.bezierCurveTo(2.5, 3, 0.5, 5, 0, 5.5);  // Right bottom
  flame.bezierCurveTo(-0.5, 5, -2.5, 3, -1.5, 1); // Left bottom
  flame.bezierCurveTo(-2.5, -1, -2, -3, 0, -5); // Left curve back to top
  flame.fill({ color: 0xffd700, alpha: 0.95 }); // Gold

  // Flame border for definition
  flame.moveTo(0, -5);
  flame.bezierCurveTo(2, -3, 2.5, -1, 1.5, 1);
  flame.bezierCurveTo(2.5, 3, 0.5, 5, 0, 5.5);
  flame.bezierCurveTo(-0.5, 5, -2.5, 3, -1.5, 1);
  flame.bezierCurveTo(-2.5, -1, -2, -3, 0, -5);
  flame.stroke({ width: 0.5, color: 0xffa500 }); // Orange border

  container.addChild(flame);

  // Inner flame highlight (brighter yellow)
  const innerFlame = new PIXI.Graphics();
  innerFlame.moveTo(0, -3);
  innerFlame.bezierCurveTo(1, -2, 1.2, -0.5, 0.8, 0.5);
  innerFlame.bezierCurveTo(1, 1.5, 0.3, 2.5, 0, 3);
  innerFlame.bezierCurveTo(-0.3, 2.5, -1, 1.5, -0.8, 0.5);
  innerFlame.bezierCurveTo(-1.2, -0.5, -1, -2, 0, -3);
  innerFlame.fill({ color: 0xffff00, alpha: 0.7 }); // Bright yellow
  container.addChild(innerFlame);

  // Top shine highlight for 3D effect
  const shine = new PIXI.Graphics();
  shine.circle(-1, -3, 1.2);
  shine.fill({ color: 0xffffff, alpha: 0.6 });
  container.addChild(shine);
}

/**
 * Draw premium stat labels with glow effects
 */
function drawPremiumStatLabels(
  container: PIXI.Container,
  stat: { name: string; id: string; value: number; color: number; glowColor: number },
  y: number,
  leftStatLabelStart: number,
  statLabelWidth: number,
  rightStatLabelStart: number,
  rightWeaponSlotStart: number,
  weaponSlotWidth: number
): void {
  // Left stat label with glow
  const leftLabel = new PIXI.Text({
    text: stat.name,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 12,
      fontWeight: 'bold',
      fill: stat.color,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: stat.glowColor,
        blur: 4,
        alpha: 0.7,
        distance: 0,
      },
    },
  });
  leftLabel.anchor.set(1, 0.5);
  leftLabel.x = leftStatLabelStart + statLabelWidth - 5;
  leftLabel.y = y - 10;
  container.addChild(leftLabel);

  // Left stat value with glow (starts at 0, accumulates during simulation)
  const leftValue = new PIXI.Text({
    text: '0',
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: stat.color,
        blur: 5,
        alpha: 0.9,
        distance: 0,
      },
    },
  });
  leftValue.anchor.set(1, 0.5);
  leftValue.x = leftStatLabelStart + statLabelWidth - 5;
  leftValue.y = y + 10;
  leftValue.label = `stat-value-${stat.id}-left`; // Label for easy lookup (v8+ uses label instead of name)
  container.addChild(leftValue);

  // Right stat label with glow (positioned in right stat label area)
  const rightLabel = new PIXI.Text({
    text: stat.name,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 12,
      fontWeight: 'bold',
      fill: stat.color,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: stat.glowColor,
        blur: 4,
        alpha: 0.7,
        distance: 0,
      },
    },
  });
  rightLabel.anchor.set(0, 0.5);
  rightLabel.x = rightStatLabelStart + 5;
  rightLabel.y = y - 10;
  container.addChild(rightLabel);

  // Right stat value with glow (positioned in right stat label area, starts at 0)
  const rightValue = new PIXI.Text({
    text: '0',
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: stat.color,
        blur: 5,
        alpha: 0.9,
        distance: 0,
      },
    },
  });
  rightValue.anchor.set(0, 0.5);
  rightValue.x = rightStatLabelStart + 5;
  rightValue.y = y + 10;
  rightValue.label = `stat-value-${stat.id}-right`; // Label for easy lookup (v8+ uses label instead of name)
  container.addChild(rightValue);
}

// Castle and inventory rendering removed - will be added as separate overlays later
