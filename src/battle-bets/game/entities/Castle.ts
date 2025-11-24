/**
 * Castle - PixiJS sprite entity representing a capper's fortress
 * Displays damage states based on HP percentage
 * Supports inventory items and shield mechanics
 *
 * NOTE: HP and shield state are now managed by CastleHealthSystem.
 * This class focuses on visual representation and UI.
 */

import * as PIXI from 'pixi.js';
import { castleHealthSystem } from '../systems/CastleHealthSystem';

// Simplified inventory types (inline to avoid import issues)
interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  shieldHP?: number;
  shieldActivationThreshold?: number;
}

type ItemSlot = 'slot1' | 'slot2' | 'slot3';

interface EquippedItems {
  slot1: InventoryItem | null;
  slot2: InventoryItem | null;
  slot3: InventoryItem | null;
}

interface ShieldState {
  isActive: boolean;
  currentHP: number;
  maxHP: number;
  sourceItem: InventoryItem;
}

// Blue Orb Shield item (hard-coded)
const BLUE_ORB_SHIELD: InventoryItem = {
  id: 'blue-orb-shield',
  name: 'Blue Orb Shield',
  description: 'Protective shield that activates at HP < 3',
  icon: '🔵',
  shieldHP: 5,
  shieldActivationThreshold: 3,
};

// Fire Orb item (hard-coded)
const FIRE_ORB: InventoryItem = {
  id: 'fire-orb',
  name: 'Fire Orb',
  description: 'For every 5 POINTS projectiles, fire 1 bonus FIRE projectile',
  icon: '🔴',
};

export interface CastleConfig {
  id: string;
  capperId: string;
  capperName: string;
  capperRank?: string; // e.g., "EMPEROR", "KING", "KNIGHT"
  capperLevel?: number; // e.g., 33
  position: { x: number; y: number };
  maxHP: number;
  currentHP: number;
  scale?: number;
  boxWidth?: number; // Width of the castle box container (default 140)
  side?: 'left' | 'right'; // Which side of the battlefield (for item slot positioning)
}

export interface DamageState {
  hpThreshold: number; // HP percentage threshold (e.g., 0.66 = 66%)
  opacity: number;
  tint: number; // Hex color tint
  shake: boolean;
  particles: boolean;
}

export class Castle {
  public id: string;
  public capperId: string;
  public container: PIXI.Container;
  public sprite: PIXI.Sprite | null = null;

  private capperName: string;
  private capperRank: string;
  private capperLevel: number;
  private maxHP: number;
  private currentHP: number;
  private position: { x: number; y: number };
  private scale: number;
  private boxWidth: number;
  private side: 'left' | 'right';
  private isDestroyed: boolean = false;

  // UI elements
  private rankBadge: PIXI.Container | null = null;
  private levelBadge: PIXI.Container | null = null;
  private nameText: PIXI.Text | null = null;
  private hpBarContainer: PIXI.Container | null = null;
  private hpBarBackground: PIXI.Graphics | null = null;
  private hpBarFill: PIXI.Graphics | null = null;
  private hpText: PIXI.Text | null = null;

  // Inventory system (simplified - Blue Orb Shield auto-equipped)
  private equippedItems: EquippedItems = { slot1: BLUE_ORB_SHIELD, slot2: FIRE_ORB, slot3: null };
  private shieldState: ShieldState | null = null;
  private shieldVisual: PIXI.Container | null = null;
  private itemSlot1: PIXI.Container | null = null;
  private itemSlot2: PIXI.Container | null = null;
  private itemSlot3: PIXI.Container | null = null;
  private onItemSlotClick: ((slotNumber: number) => void) | null = null;

  // Blood effects
  private bloodOverlay: PIXI.Graphics | null = null;
  private bloodSplatters: PIXI.Graphics[] = [];

  // Damage state configuration
  private damageStates: DamageState[] = [
    { hpThreshold: 1.0, opacity: 1.0, tint: 0xFFFFFF, shake: false, particles: false },      // 100% HP - Perfect
    { hpThreshold: 0.66, opacity: 0.95, tint: 0xFFEEDD, shake: false, particles: false },    // 66% HP - Light damage
    { hpThreshold: 0.33, opacity: 0.85, tint: 0xFFCCAA, shake: true, particles: true },      // 33% HP - Heavy damage
    { hpThreshold: 0.0, opacity: 0.5, tint: 0x888888, shake: true, particles: true },        // 0% HP - Destroyed
  ];

  constructor(config: CastleConfig) {
    this.id = config.id;
    this.capperId = config.capperId;
    this.capperName = config.capperName;
    this.capperRank = config.capperRank || 'KNIGHT';
    this.capperLevel = config.capperLevel || 1;
    this.maxHP = config.maxHP;
    this.currentHP = config.currentHP;
    this.position = config.position;
    this.scale = config.scale || 0.3; // Default scale for castle sprite
    this.boxWidth = config.boxWidth || 140;
    this.side = config.side || 'left'; // Default to left if not specified

    // Create container for castle and effects
    this.container = new PIXI.Container();
    this.container.position.set(this.position.x, this.position.y);

    // Initialize health tracking in CastleHealthSystem
    castleHealthSystem.initializeCastle(this.id, this.maxHP, this.currentHP);
  }

  /**
   * Load castle sprite texture and initialize all UI elements
   */
  public async load(): Promise<void> {
    try {
      // Create UI elements in order from top to bottom
      // Note: All Y positions are relative to the castle container position
      // The container is positioned at the CENTER of the castle box (y=100 in a 200px box)
      // So: top of box = -100, bottom of box = +100

      // 1. Load castle sprite (centered in the box)
      // Rank and name are now shown in bottom info bar, not in castle box
      const texture = await PIXI.Assets.load('/assets/castles/castle-base.png');
      this.sprite = new PIXI.Sprite(texture);
      this.sprite.anchor.set(0.5, 0.5); // Anchor at center
      this.sprite.scale.set(this.scale);
      this.sprite.position.set(0, -20); // Centered in 200px box with room for HP bar below
      this.sprite.name = 'castle';
      this.container.addChild(this.sprite);

      // 2. Create HP bar below castle
      this.createHPBar();

      // 3. Level badge disabled to match original battle-bets-v3 layout
      // this.createLevelBadge();

      // 4. Create equipped item indicator (Blue Orb Shield)
      this.createEquippedItemIndicator();

      // Apply initial damage state
      this.updateDamageState();

      console.log(`✅ Castle ${this.id} loaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to load castle ${this.id}:`, error);
    }
  }

  /**
   * Create rank badge at the top of the castle box
   */
  private createRankBadge(): void {
    this.rankBadge = new PIXI.Container();

    // Container is at center of box (y=100 in a 200px box)
    // Top of box is at y = -100 relative to container
    // Position rank badge at the very top with small padding
    this.rankBadge.position.set(0, -95);

    // Background box for rank
    const badgeWidth = 100;
    const badgeHeight = 24;
    const badge = new PIXI.Graphics();
    badge.rect(-badgeWidth / 2, 0, badgeWidth, badgeHeight);
    badge.fill({ color: 0x0066cc }); // Blue background
    badge.stroke({ width: 2, color: 0x00aaff });
    this.rankBadge.addChild(badge);

    // Rank text (e.g., "Rank: 33")
    const rankText = new PIXI.Text({
      text: `Rank: ${this.capperLevel}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0x00aaff,
        align: 'center',
      }
    });
    rankText.anchor.set(0.5, 0.5);
    rankText.position.set(0, badgeHeight / 2);
    this.rankBadge.addChild(rankText);

    this.container.addChild(this.rankBadge);
  }

  /**
   * Create capper name text below the rank badge
   */
  private createCapperName(): void {
    // Position below rank badge
    // Rank badge is at y=-115, height=24, so name starts at y=-85
    this.nameText = new PIXI.Text({
      text: this.capperRank + '\n' + this.capperName,
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fontWeight: 'bold',
        fill: 0x00aaff, // Cyan/blue color
        align: 'center',
        lineHeight: 20,
      }
    });
    this.nameText.anchor.set(0.5, 0);
    this.nameText.position.set(0, -70); // Adjusted for 200px box
    this.container.addChild(this.nameText);
  }

  /**
   * Create HP bar positioned under the castle with numeric HP text
   */
  private createHPBar(): void {
    if (!this.sprite) return;

    // HP bar dimensions (same width as castle sprite)
    const castleWidth = this.sprite.width;
    const barWidth = castleWidth * 0.8; // 80% of castle width
    const barHeight = 10;

    // Position below castle sprite
    // Castle sprite is at y=-20 with anchor at center (0.5, 0.5)
    // Castle sprite height at scale 0.32 ≈ 126px, so bottom is at -20 + 63 ≈ 43
    const barY = 53; // Position below castle with small gap

    // Create container for HP bar
    this.hpBarContainer = new PIXI.Container();
    this.hpBarContainer.position.set(0, barY);

    // Background (dark red)
    this.hpBarBackground = new PIXI.Graphics();
    this.hpBarBackground.rect(-barWidth / 2, 0, barWidth, barHeight);
    this.hpBarBackground.fill({ color: 0x330000 });
    this.hpBarContainer.addChild(this.hpBarBackground);

    // Foreground (green/yellow/red based on HP)
    this.hpBarFill = new PIXI.Graphics();
    this.hpBarFill.rect(-barWidth / 2, 0, barWidth, barHeight);
    this.hpBarFill.fill({ color: 0x00FF00 });
    this.hpBarContainer.addChild(this.hpBarFill);

    // HP text below the bar
    this.hpText = new PIXI.Text({
      text: `${this.currentHP}/${this.maxHP}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0x00ff00, // Green text
        align: 'center',
      }
    });
    this.hpText.anchor.set(0.5, 0);
    this.hpText.position.set(0, barHeight + 2);
    this.hpBarContainer.addChild(this.hpText);

    // Add HP bar to castle container
    this.container.addChild(this.hpBarContainer);

    // Initial update
    this.updateHPBar();
  }

  /**
   * Create level badge next to the castle
   * Left side: badge on the left of castle
   * Right side: badge on the right of castle
   */
  private createLevelBadge(): void {
    if (!this.sprite) return;

    this.levelBadge = new PIXI.Container();

    // Position badge to the left or right of the castle
    // Castle sprite is centered at (0, -20)
    // Castle width at scale 0.32 ≈ 126px, so half-width ≈ 63px
    const castleHalfWidth = this.sprite.width / 2;
    const badgeOffsetX = this.side === 'left' ? -(castleHalfWidth + 45) : (castleHalfWidth + 45);
    const badgeY = -20; // Same vertical position as castle center

    this.levelBadge.position.set(badgeOffsetX, badgeY);

    // Background rounded rectangle
    const badgeWidth = 60;
    const badgeHeight = 50;
    const borderRadius = 8;

    const background = new PIXI.Graphics();
    background.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, borderRadius);
    background.fill({ color: 0x1a1a2e, alpha: 0.9 }); // Dark background
    background.stroke({ width: 2, color: 0xffd700 }); // Gold border
    this.levelBadge.addChild(background);

    // "LVL" text at top
    const lvlText = new PIXI.Text({
      text: 'LVL',
      style: {
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xaaffaa, // Light green
        align: 'center',
      }
    });
    lvlText.anchor.set(0.5, 0.5);
    lvlText.position.set(0, -12);
    this.levelBadge.addChild(lvlText);

    // Level number at bottom
    const levelText = new PIXI.Text({
      text: this.capperLevel.toString(),
      style: {
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'bold',
        fill: 0xffd700, // Gold
        align: 'center',
      }
    });
    levelText.anchor.set(0.5, 0.5);
    levelText.position.set(0, 8);
    this.levelBadge.addChild(levelText);

    this.container.addChild(this.levelBadge);
  }

  /**
   * Create 3 vertical item slots OUTSIDE the castle box
   * Left side (SHIVA) gets slots to the LEFT of castle box
   * Right side (ORACLE) gets slots to the RIGHT of castle box
   * Displays equipped items from equippedItems object
   */
  private createEquippedItemIndicator(): void {
    if (!this.sprite) return;

    // Determine if this is left or right castle based on side
    // Castle box is 200px wide, container is centered at x=0
    // Left edge is at x=-100, right edge is at x=+100
    const isLeftSide = this.side === 'left';

    // Position slots OUTSIDE the castle box (in the 40px item slots area)
    // Left castle: slots go to the left with padding from edge
    //   Castle box left edge: -100
    //   Need to go left by slot width (30px) + padding (5px from edge + 5px gap) = -135
    // Right castle: slots go to the right (x = +100 + 5 = +105) - PERFECT, don't change
    const slotsX = isLeftSide ? -135 : 105;

    // Start from top of castle box (y=-100) with padding
    const startY = -85;
    const slotSize = 30; // Square slots 30x30
    const slotGap = 5; // Gap between slots

    // Get equipped items
    const equippedItemsArray = [this.equippedItems.slot1, this.equippedItems.slot2, this.equippedItems.slot3];

    // Create 3 vertical item slots
    for (let i = 0; i < 3; i++) {
      const slotY = startY + (i * (slotSize + slotGap));
      const slot = new PIXI.Container();
      slot.position.set(slotsX, slotY);

      // Slot background
      const bg = new PIXI.Graphics();
      bg.roundRect(0, 0, slotSize, slotSize, 4);
      bg.fill({ color: 0x0d1f33 }); // Dark blue background
      bg.stroke({ width: 2, color: 0x0066cc }); // Blue border
      slot.addChild(bg);

      // Check if there's an item equipped in this slot
      const equippedItem = equippedItemsArray[i];
      if (equippedItem) {
        // Create item visual based on item ID
        if (equippedItem.id === 'blue-orb-shield') {
          const orbContainer = this.createBlueOrbShieldIcon(slotSize);
          slot.addChild(orbContainer);
        } else if (equippedItem.id === 'fire-orb') {
          const fireOrbContainer = this.createFireOrb(slotSize);
          slot.addChild(fireOrbContainer);
        } else {
          // Generic item icon (emoji)
          const iconText = new PIXI.Text({
            text: equippedItem.icon,
            style: {
              fontSize: 20,
              align: 'center',
            }
          });
          iconText.anchor.set(0.5);
          iconText.position.set(slotSize / 2, slotSize / 2);
          slot.addChild(iconText);
        }
      }

      this.container.addChild(slot);
    }
  }

  /**
   * Create a professional Blue Orb Shield with white shield icon inside
   * Ring design with shield in center - medieval fantasy style
   */
  private createBlueOrbShieldIcon(slotSize: number): PIXI.Container {
    const container = new PIXI.Container();
    container.position.set(slotSize / 2, slotSize / 2);

    // Outer glow - soft blue aura
    const outerGlow = new PIXI.Graphics();
    outerGlow.circle(0, 0, 15);
    outerGlow.fill({ color: 0x3b82f6, alpha: 0.2 }); // Soft blue glow
    container.addChild(outerGlow);

    // Middle glow - brighter
    const midGlow = new PIXI.Graphics();
    midGlow.circle(0, 0, 13);
    midGlow.fill({ color: 0x60a5fa, alpha: 0.3 }); // Brighter blue
    container.addChild(midGlow);

    // Main ring - solid blue ring
    const mainRing = new PIXI.Graphics();
    mainRing.circle(0, 0, 12);
    mainRing.fill({ color: 0x1e3a8a, alpha: 0.4 }); // Dark blue fill
    mainRing.stroke({ width: 2.5, color: 0x60a5fa, alpha: 1.0 }); // Bright blue ring
    container.addChild(mainRing);

    // Inner ring - decorative detail
    const innerRing = new PIXI.Graphics();
    innerRing.circle(0, 0, 9);
    innerRing.stroke({ width: 1.5, color: 0x93c5fd, alpha: 0.8 }); // Light blue inner ring
    container.addChild(innerRing);

    // White shield icon in center (medieval shield shape)
    const shield = new PIXI.Graphics();

    // Shield outline (classic medieval shield - kite shield style)
    shield.moveTo(0, -7);        // Top center
    shield.lineTo(5, -5);         // Top right
    shield.lineTo(5, 3);          // Right side
    shield.lineTo(0, 8);          // Bottom point
    shield.lineTo(-5, 3);         // Left side
    shield.lineTo(-5, -5);        // Top left
    shield.closePath();
    shield.fill({ color: 0xffffff, alpha: 0.95 });

    // Shield border for definition
    shield.moveTo(0, -7);
    shield.lineTo(5, -5);
    shield.lineTo(5, 3);
    shield.lineTo(0, 8);
    shield.lineTo(-5, 3);
    shield.lineTo(-5, -5);
    shield.closePath();
    shield.stroke({ width: 1, color: 0x3b82f6 }); // Blue border

    // Shield cross emblem (classic medieval design)
    shield.rect(-0.8, -5, 1.6, 10); // Vertical bar
    shield.fill({ color: 0x3b82f6, alpha: 0.8 });
    shield.rect(-3, -1, 6, 1.6); // Horizontal bar
    shield.fill({ color: 0x3b82f6, alpha: 0.8 });

    container.addChild(shield);

    // Top-left shine highlight for 3D effect
    const shine = new PIXI.Graphics();
    shine.circle(-3, -4, 2.5);
    shine.fill({ color: 0xffffff, alpha: 0.6 });
    container.addChild(shine);

    // Small sparkle (top-right) for magical effect
    const sparkle = new PIXI.Graphics();
    sparkle.circle(4, -4, 1.5);
    sparkle.fill({ color: 0x93c5fd, alpha: 0.9 }); // Light blue sparkle
    container.addChild(sparkle);

    return container;
  }

  /**
   * Create a professional Fire Orb with flame icon inside
   * Uses PixiJS Graphics for crisp, scalable vector graphics
   */
  private createFireOrb(slotSize: number): PIXI.Container {
    const container = new PIXI.Container();
    container.position.set(slotSize / 2, slotSize / 2);

    // Outer glow (largest) - soft red/orange aura
    const outerGlow = new PIXI.Graphics();
    outerGlow.circle(0, 0, 15);
    outerGlow.fill({ color: 0xff4500, alpha: 0.3 }); // Orange-red
    container.addChild(outerGlow);

    // Mid glow - brighter orange
    const midGlow = new PIXI.Graphics();
    midGlow.circle(0, 0, 13);
    midGlow.fill({ color: 0xff6347, alpha: 0.4 }); // Tomato red
    container.addChild(midGlow);

    // Main ring - solid red/orange ring
    const mainRing = new PIXI.Graphics();
    mainRing.circle(0, 0, 12);
    mainRing.fill({ color: 0xdc143c, alpha: 0.5 }); // Crimson fill
    mainRing.stroke({ width: 2.5, color: 0xff6347, alpha: 1.0 }); // Bright red-orange ring
    container.addChild(mainRing);

    // Inner ring - decorative detail
    const innerRing = new PIXI.Graphics();
    innerRing.circle(0, 0, 9);
    innerRing.stroke({ width: 1.5, color: 0xffa500, alpha: 0.8 }); // Orange inner ring
    container.addChild(innerRing);

    // Yellow flame icon in center
    const flame = new PIXI.Graphics();

    // Flame shape (stylized fire)
    flame.moveTo(0, -6);         // Top point
    flame.bezierCurveTo(2, -4, 3, -2, 2, 0);  // Right curve
    flame.bezierCurveTo(3, 2, 1, 4, 0, 6);    // Right bottom
    flame.bezierCurveTo(-1, 4, -3, 2, -2, 0); // Left bottom
    flame.bezierCurveTo(-3, -2, -2, -4, 0, -6); // Left curve back to top
    flame.fill({ color: 0xffd700, alpha: 0.95 }); // Gold

    // Flame border for definition
    flame.moveTo(0, -6);
    flame.bezierCurveTo(2, -4, 3, -2, 2, 0);
    flame.bezierCurveTo(3, 2, 1, 4, 0, 6);
    flame.bezierCurveTo(-1, 4, -3, 2, -2, 0);
    flame.bezierCurveTo(-3, -2, -2, -4, 0, -6);
    flame.stroke({ width: 0.5, color: 0xffa500 }); // Orange border

    container.addChild(flame);

    // Top-left shine highlight for 3D effect
    const shine = new PIXI.Graphics();
    shine.circle(-3, -3, 2.5);
    shine.fill({ color: 0xffffff, alpha: 0.7 });
    container.addChild(shine);

    // Small sparkle (top-right) for magical effect
    const sparkle = new PIXI.Graphics();
    sparkle.circle(4, -4, 1.5);
    sparkle.fill({ color: 0xffd700, alpha: 0.9 }); // Gold sparkle
    container.addChild(sparkle);

    // Bottom-right sparkle for extra magic
    const sparkle2 = new PIXI.Graphics();
    sparkle2.circle(3, 4, 1.2);
    sparkle2.fill({ color: 0xffa500, alpha: 0.8 }); // Orange sparkle
    container.addChild(sparkle2);

    return container;
  }

  /**
   * Create item slots at the bottom of the castle box (DISABLED)
   */
  private createItemSlots(): void {
    if (!this.sprite) return;

    // Position at bottom of castle box
    // Container is at center (y=0), bottom of box is at y=+100
    // HP bar is at y=40, height=10, text height=~16, so HP ends at ~66
    // Slots should be at the bottom with some padding
    const slotsY = 80; // Near bottom of box with more padding (125 - 45 for padding)
    const slotSize = 35; // Square buttons 35x35
    const slotGap = 8; // Gap between buttons

    // Calculate positions to center both buttons
    const totalWidth = (slotSize * 2) + slotGap;
    const startX = -totalWidth / 2;

    // Slot 1 (left)
    this.itemSlot1 = this.createItemSlot(startX, slotsY, slotSize, 1);
    this.container.addChild(this.itemSlot1);

    // Slot 2 (right)
    this.itemSlot2 = this.createItemSlot(startX + slotSize + slotGap, slotsY, slotSize, 2);
    this.container.addChild(this.itemSlot2);
  }

  /**
   * Create a single item slot button
   */
  private createItemSlot(x: number, y: number, size: number, slotNumber: number): PIXI.Container {
    const slot = new PIXI.Container();
    slot.position.set(x, y);

    // Background
    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, size, size, 4); // Rounded corners
    bg.fill({ color: 0x0d1f33 }); // Dark blue background
    bg.stroke({ width: 2, color: 0x0066cc }); // Bright blue border
    slot.addChild(bg);

    // Make interactive
    slot.eventMode = 'static';
    slot.cursor = 'pointer';

    // Hover effect
    slot.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 4);
      bg.fill({ color: 0x1a3a5a }); // Lighter blue on hover
      bg.stroke({ width: 2, color: 0x00aaff }); // Brighter border on hover
    });

    slot.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 4);
      bg.fill({ color: 0x0d1f33 });
      bg.stroke({ width: 2, color: 0x0066cc });
    });

    // Click handler - trigger callback if set
    slot.on('pointerdown', () => {
      if (this.onItemSlotClick) {
        this.onItemSlotClick(slotNumber);
      }
    });

    return slot;
  }

  /**
   * Update HP bar visual based on current HP
   */
  private updateHPBar(): void {
    console.log(`🎨 [Castle.updateHPBar] Called for castle ${this.id}, currentHP=${this.currentHP}, maxHP=${this.maxHP}`);

    if (!this.hpBarFill) {
      console.error(`❌ [Castle.updateHPBar] Missing hpBarFill for castle ${this.id}`);
      return;
    }
    if (!this.sprite) {
      console.error(`❌ [Castle.updateHPBar] Missing sprite for castle ${this.id}`);
      return;
    }
    if (!this.hpText) {
      console.error(`❌ [Castle.updateHPBar] Missing hpText for castle ${this.id}`);
      return;
    }

    const hpPercent = this.getHPPercentage();
    const castleWidth = this.sprite.width;
    const barWidth = castleWidth * 0.8;

    console.log(`🎨 [Castle.updateHPBar] hpPercent=${hpPercent.toFixed(2)}, castleWidth=${castleWidth.toFixed(1)}, barWidth=${barWidth.toFixed(1)}`);

    // Update fill width
    this.hpBarFill.clear();
    this.hpBarFill.rect(-barWidth / 2, 0, barWidth * hpPercent, 10);

    // Update color based on HP
    let color: number;
    if (hpPercent > 0.6) {
      color = 0x00FF00; // Green
    } else if (hpPercent > 0.3) {
      color = 0xFFFF00; // Yellow
    } else {
      color = 0xFF0000; // Red
    }
    this.hpBarFill.fill({ color });

    // Update HP text
    const oldText = this.hpText.text;
    this.hpText.text = `${this.currentHP}/${this.maxHP}`;
    this.hpText.style.fill = color; // Match text color to bar color

    console.log(`✅ [Castle.updateHPBar] HP bar updated! Text: "${oldText}" → "${this.hpText.text}", color=${color.toString(16)}, hpPercent=${hpPercent.toFixed(2)}`);
  }

  /**
   * Update castle HP and visual state
   * Delegates to CastleHealthSystem for HP/shield logic
   */
  public takeDamage(damage: number): void {
    if (this.isDestroyed) return;

    console.log(`🛡️ takeDamage called: damage=${damage}, currentHP=${this.currentHP}`);

    // Check if shield should activate BEFORE taking damage
    // This handles Blue Orb Shield auto-activation at HP < 3
    const currentHP = castleHealthSystem.getCurrentHP(this.id);
    const hpAfterDamage = currentHP - damage;

    if (!castleHealthSystem.hasActiveShield(this.id) && (currentHP < 3 || hpAfterDamage < 3)) {
      console.log(`🛡️ Shield activation condition met! Checking for shield items...`);
      this.checkAndActivateShield();
    }

    // Apply damage through health system
    const result = castleHealthSystem.takeDamage(this.id, damage);

    console.log(`💔 Damage result:`, result);

    // Sync local HP state with health system
    this.currentHP = result.finalHP;

    // Update shield visual if shield state changed
    if (result.shieldBroken) {
      this.deactivateShield();
    } else if (castleHealthSystem.hasActiveShield(this.id)) {
      this.updateShieldVisual();
    }

    // Add blood splatter effect
    this.addBloodSplatter();

    // Flash red when hit
    this.flashDamage();

    // Update visual state (includes blood overlay)
    this.updateDamageState();
    this.updateHPBar();

    // Check if destroyed
    if (result.castleDestroyed) {
      this.destroy();
    }
  }

  /**
   * Check equipped items and activate shield if conditions are met
   */
  private checkAndActivateShield(): void {
    console.log(`🛡️ checkAndActivateShield called`);
    console.log(`🛡️ Equipped items:`, this.equippedItems);

    // Check all item slots for shield items
    const items = [this.equippedItems.slot1, this.equippedItems.slot2, this.equippedItems.slot3];

    for (const item of items) {
      console.log(`🛡️ Checking item:`, item);
      if (!item || item.shieldHP === undefined || item.shieldActivationThreshold === undefined) {
        console.log(`🛡️ Item is not a shield or missing properties`);
        continue;
      }

      // Activate shield (threshold check already done in takeDamage)
      console.log(`🛡️ Found shield item! Activating...`);
      this.activateShield(item);
      return; // Only activate one shield at a time
    }

    console.log(`🛡️ No shield items found in equipped slots`);
  }

  /**
   * Heal castle HP
   */
  public heal(amount: number): void {
    if (this.isDestroyed) return;

    // Heal through health system
    castleHealthSystem.heal(this.id, amount);

    // Sync local HP state
    this.currentHP = castleHealthSystem.getCurrentHP(this.id);

    // Update visuals
    this.updateDamageState();
    this.updateHPBar();
  }

  /**
   * Get current HP percentage (0.0 to 1.0)
   */
  public getHPPercentage(): number {
    return this.currentHP / this.maxHP;
  }

  /**
   * Update visual appearance based on current HP
   */
  private updateDamageState(): void {
    if (!this.sprite) return;

    const hpPercent = this.getHPPercentage();

    // Find appropriate damage state
    let state = this.damageStates[0];
    for (const damageState of this.damageStates) {
      if (hpPercent <= damageState.hpThreshold) {
        state = damageState;
      }
    }

    // Apply visual effects
    this.sprite.alpha = state.opacity;
    this.sprite.tint = state.tint;

    // Update blood overlay based on damage
    this.updateBloodOverlay(hpPercent);

    // Apply shake effect if needed
    if (state.shake) {
      this.applyShake();
    }

    // TODO: Add particle effects (fire, smoke) for damaged states
    if (state.particles) {
      // this.addParticleEffects();
    }
  }

  /**
   * Flash red when taking damage - subtle, professional effect
   */
  private flashDamage(): void {
    if (!this.sprite) return;

    const originalTint = this.sprite.tint;

    // Subtle red flash
    this.sprite.tint = 0xFF6666;

    // Quick reset
    setTimeout(() => {
      if (this.sprite) {
        this.sprite.tint = originalTint;
      }
    }, 80);
  }

  /**
   * Apply shake animation to castle
   */
  private applyShake(): void {
    if (!this.sprite) return;

    const shakeIntensity = 3;
    const shakeDuration = 200;
    const originalX = this.sprite.x;
    const originalY = this.sprite.y;

    const startTime = Date.now();

    const shake = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed < shakeDuration && this.sprite) {
        this.sprite.x = originalX + (Math.random() - 0.5) * shakeIntensity;
        this.sprite.y = originalY + (Math.random() - 0.5) * shakeIntensity;
        requestAnimationFrame(shake);
      } else if (this.sprite) {
        this.sprite.x = originalX;
        this.sprite.y = originalY;
      }
    };

    shake();
  }

  /**
   * Mark castle as destroyed
   */
  private destroy(): void {
    this.isDestroyed = true;

    if (this.sprite) {
      // Fade out animation
      const fadeOut = () => {
        if (this.sprite && this.sprite.alpha > 0) {
          this.sprite.alpha -= 0.02;
          requestAnimationFrame(fadeOut);
        }
      };
      fadeOut();
    }

    console.log(`💥 Castle ${this.id} destroyed!`);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }

    if (this.container) {
      this.container.destroy({ children: true });
    }
  }

  /**
   * Get castle bounds for collision detection
   */
  public getBounds(): PIXI.Bounds | null {
    return this.sprite?.getBounds() || null;
  }

  /**
   * Update castle position
   */
  public setPosition(x: number, y: number): void {
    this.position = { x, y };
    this.container.position.set(x, y);
  }

  /**
   * Equip an item to a specific slot
   */
  public equipItem(item: InventoryItem, slot: ItemSlot): void {
    // Update equipped items
    this.equippedItems[slot] = item;

    // Update visual representation in item slot
    this.updateItemSlotVisual(slot, item);

    // If it's a shield item, initialize shield state (but don't activate yet)
    if (item.shieldHP !== undefined && item.shieldActivationThreshold !== undefined) {
      // Shield will activate automatically when HP drops below threshold
      console.log(`🛡️ Shield item equipped: ${item.name} (activates at HP < ${item.shieldActivationThreshold})`);
    }

    console.log(`✅ Equipped ${item.name} to ${slot}`);
  }

  /**
   * Unequip an item from a specific slot
   */
  public unequipItem(slot: ItemSlot): void {
    const item = this.equippedItems[slot];
    if (!item) return;

    this.equippedItems[slot] = null;
    this.updateItemSlotVisual(slot, null);

    // If shield was active from this item, deactivate it
    if (this.shieldState && this.shieldState.sourceItem.id === item.id) {
      this.deactivateShield();
    }

    console.log(`❌ Unequipped ${item.name} from ${slot}`);
  }

  /**
   * Update the visual representation of an item slot
   */
  private updateItemSlotVisual(slot: ItemSlot, item: InventoryItem | null): void {
    const slotContainer = slot === 'slot1' ? this.itemSlot1 : this.itemSlot2;
    if (!slotContainer) return;

    // Remove existing item icon if any
    const existingIcon = slotContainer.children.find(child => child.label === 'item-icon');
    if (existingIcon) {
      slotContainer.removeChild(existingIcon);
    }

    // Add new item icon if item is equipped
    if (item) {
      const iconText = new PIXI.Text({
        text: item.icon,
        style: {
          fontSize: 24,
          align: 'center',
        }
      });
      iconText.anchor.set(0.5);
      iconText.position.set(17.5, 17.5); // Center in 35x35 slot
      iconText.label = 'item-icon';
      slotContainer.addChild(iconText);
    }
  }

  /**
   * Activate shield from equipped item
   */
  public activateShield(item: InventoryItem): void {
    console.log(`🛡️ activateShield called with item:`, item);

    if (item.shieldHP === undefined || item.shieldActivationThreshold === undefined) {
      console.log(`🛡️ Item missing shield properties!`);
      return;
    }

    // Activate shield in health system
    castleHealthSystem.activateShield(
      this.id,
      item.shieldHP,
      item.shieldActivationThreshold,
      item.id
    );

    // Update local shield state for visual rendering
    this.shieldState = {
      isActive: true,
      currentHP: item.shieldHP,
      maxHP: item.shieldHP,
      sourceItem: item,
    };

    console.log(`🛡️ Shield state created:`, this.shieldState);

    // Create shield visual effect
    console.log(`🛡️ Creating shield visual...`);
    this.createShieldVisual();

    console.log(`🛡️ Shield activated! ${this.shieldState.currentHP}/${this.shieldState.maxHP} HP`);
  }

  /**
   * Deactivate shield
   */
  public deactivateShield(): void {
    if (!this.shieldState) return;

    console.log(`💥 Shield deactivated!`);

    // Deactivate in health system
    castleHealthSystem.deactivateShield(this.id);

    // Clear local shield state
    this.shieldState = null;

    // Remove shield visual
    if (this.shieldVisual) {
      this.container.removeChild(this.shieldVisual);
      this.shieldVisual = null;
    }
  }

  /**
   * Create visual effect for active shield - Blue HP bar above castle HP bar + Blue Orb Shield
   */
  private createShieldVisual(): void {
    console.log(`🛡️ Creating shield visual (${this.shieldState?.currentHP}/${this.shieldState?.maxHP} HP)`);

    if (this.shieldVisual) {
      this.container.removeChild(this.shieldVisual);
    }

    this.shieldVisual = new PIXI.Container();
    this.shieldVisual.visible = true;
    this.shieldVisual.alpha = 1;

    // Position shield bar right above the HP bar
    // HP bar is at y = 53, so shield bar goes at y = 41 (53 - 10 - 2 for gap)
    this.shieldVisual.position.set(0, 41);

    if (this.shieldState && this.sprite) {
      // Match castle HP bar dimensions
      const castleWidth = this.sprite.width;
      const barWidth = castleWidth * 0.8; // Same as castle HP bar
      const barHeight = 10; // Same as castle HP bar
      const shieldPercent = this.shieldState.currentHP / this.shieldState.maxHP;

      // Background (dark blue)
      const background = new PIXI.Graphics();
      background.rect(-barWidth / 2, 0, barWidth, barHeight);
      background.fill({ color: 0x1e3a8a, alpha: 0.8 });
      this.shieldVisual.addChild(background);

      // Shield HP fill (bright blue)
      const fill = new PIXI.Graphics();
      fill.rect(-barWidth / 2, 0, barWidth * shieldPercent, barHeight);
      fill.fill({ color: 0x3b82f6, alpha: 1 });
      fill.label = 'shield-fill';
      this.shieldVisual.addChild(fill);

      // Border (light blue)
      const border = new PIXI.Graphics();
      border.rect(-barWidth / 2, 0, barWidth, barHeight);
      border.stroke({ width: 1, color: 0x60a5fa, alpha: 1 });
      this.shieldVisual.addChild(border);

      // Shield HP text (small, to the right of the bar)
      const shieldText = new PIXI.Text({
        text: `🛡️${this.shieldState.currentHP}`,
        style: {
          fontSize: 10,
          fontWeight: 'bold',
          fill: 0x60a5fa,
          align: 'left',
        }
      });
      shieldText.anchor.set(0, 0.5);
      shieldText.position.set(barWidth / 2 + 3, barHeight / 2);
      shieldText.label = 'shield-hp-text';
      this.shieldVisual.addChild(shieldText);

      // Create awesome Blue Orb Shield that covers the castle
      this.createBlueOrbShield();
    }

    this.container.addChild(this.shieldVisual);
    console.log(`✅ Shield visual created and added to container`);

    // Pulse animation
    this.animateShield();
  }

  /**
   * Create the Blue Orb Shield visual - a glowing blue sphere that covers the castle
   */
  private createBlueOrbShield(): void {
    if (!this.sprite || !this.shieldVisual) return;

    // Create a glowing blue orb that covers the castle
    const orbRadius = 70; // Large enough to cover the castle
    const orbCenterX = -10; // Move left
    const orbCenterY = -60; // Move up to cover the top of the castle
    const orb = new PIXI.Graphics();

    // Draw multiple layers for a glowing effect
    // Outer glow (largest, most transparent)
    orb.circle(orbCenterX, orbCenterY, orbRadius + 15);
    orb.fill({ color: 0x3b82f6, alpha: 0.1 });

    // Middle glow
    orb.circle(orbCenterX, orbCenterY, orbRadius + 8);
    orb.fill({ color: 0x60a5fa, alpha: 0.15 });

    // Inner glow
    orb.circle(orbCenterX, orbCenterY, orbRadius);
    orb.fill({ color: 0x93c5fd, alpha: 0.2 });

    // Core shield (brightest)
    orb.circle(orbCenterX, orbCenterY, orbRadius - 5);
    orb.stroke({ width: 3, color: 0x3b82f6, alpha: 0.6 });

    // Add hexagonal pattern for sci-fi look
    const hexSize = 15;
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        const x = orbCenterX + col * hexSize * 1.5;
        const y = row * hexSize * Math.sqrt(3) + (col % 2) * hexSize * Math.sqrt(3) / 2 + orbCenterY;

        // Only draw hexagons within the orb radius
        const distance = Math.sqrt((x - orbCenterX) * (x - orbCenterX) + (y - orbCenterY) * (y - orbCenterY));
        if (distance < orbRadius - 10) {
          this.drawHexagon(orb, x, y, hexSize * 0.4, 0x60a5fa, 0.3);
        }
      }
    }

    orb.label = 'blue-orb-shield';
    this.shieldVisual.addChild(orb);
  }

  /**
   * Draw a hexagon for the shield pattern
   */
  private drawHexagon(graphics: PIXI.Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(x + size * Math.cos(angle));
      points.push(y + size * Math.sin(angle));
    }
    graphics.poly(points);
    graphics.stroke({ width: 1, color, alpha });
  }

  /**
   * Animate shield pulsing effect (subtle glow)
   */
  private animateShield(): void {
    if (!this.shieldVisual) return;

    const startTime = Date.now();
    const pulse = () => {
      if (!this.shieldVisual || !this.shieldState?.isActive) return;

      const elapsed = Date.now() - startTime;
      const alpha = 0.9 + Math.sin(elapsed / 300) * 0.1; // Subtle pulse
      this.shieldVisual.alpha = alpha;

      requestAnimationFrame(pulse);
    };
    pulse();
  }

  /**
   * Update shield HP visual when shield takes damage or heals
   */
  public updateShieldVisual(): void {
    if (!this.shieldVisual || !this.sprite) return;

    // Sync local shield state with CastleHealthSystem
    const shield = castleHealthSystem.getShield(this.id);
    if (!shield || !shield.isActive) {
      console.warn(`⚠️ updateShieldVisual called but no active shield in CastleHealthSystem`);
      return;
    }

    // Update local shield state
    if (this.shieldState) {
      this.shieldState.currentHP = shield.currentHP;
      this.shieldState.maxHP = shield.maxHP;
    }

    // Match castle HP bar dimensions
    const castleWidth = this.sprite.width;
    const barWidth = castleWidth * 0.8;
    const barHeight = 10;
    const shieldPercent = shield.currentHP / shield.maxHP;

    // Update the fill bar width
    const fill = this.shieldVisual.children.find(child => child.label === 'shield-fill') as PIXI.Graphics;
    if (fill) {
      fill.clear();
      fill.rect(-barWidth / 2, 0, barWidth * shieldPercent, barHeight);
      fill.fill({ color: 0x3b82f6, alpha: 1 });
    }

    // Update the text
    const shieldText = this.shieldVisual.children.find(child => child.label === 'shield-hp-text') as PIXI.Text;
    if (shieldText) {
      shieldText.text = `🛡️${shield.currentHP}`;
    }
  }

  /**
   * Get equipped items
   */
  public getEquippedItems(): EquippedItems {
    return { ...this.equippedItems };
  }

  /**
   * Get shield state
   */
  public getShieldState(): ShieldState | null {
    return this.shieldState ? { ...this.shieldState } : null;
  }

  /**
   * Get current HP
   */
  public getCurrentHP(): number {
    return this.currentHP;
  }

  /**
   * Get max HP
   */
  public getMaxHP(): number {
    return this.maxHP;
  }

  /**
   * Add subtle blood splatter effect when castle is hit
   */
  private addBloodSplatter(): void {
    if (!this.sprite) return;

    // Create subtle blood splatter graphics
    const splatter = new PIXI.Graphics();

    // Random position on the castle sprite
    const offsetX = (Math.random() - 0.5) * this.sprite.width * 0.5;
    const offsetY = (Math.random() - 0.5) * this.sprite.height * 0.5;

    // Smaller, more subtle size
    const size = 2 + Math.random() * 4;

    // Dark red blood color
    const bloodColor = 0x8B0000;

    // Draw main splatter (smaller, more subtle)
    splatter.circle(0, 0, size);
    splatter.fill({ color: bloodColor, alpha: 0.4 });

    // Fewer droplets
    const dropletCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < dropletCount; i++) {
      const dropletX = (Math.random() - 0.5) * size * 2;
      const dropletY = (Math.random() - 0.5) * size * 2;
      const dropletSize = size * (0.2 + Math.random() * 0.3);

      splatter.circle(dropletX, dropletY, dropletSize);
      splatter.fill({ color: bloodColor, alpha: 0.3 });
    }

    splatter.position.set(offsetX, offsetY);
    splatter.label = 'blood-splatter';

    // Add to container (behind the castle sprite)
    this.container.addChildAt(splatter, 0);
    this.bloodSplatters.push(splatter);

    // Quick fade in
    splatter.alpha = 0;
    const startTime = Date.now();
    const fadeIn = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / 150, 1);
      splatter.alpha = progress * 0.5; // More subtle max alpha

      if (progress < 1) {
        requestAnimationFrame(fadeIn);
      }
    };
    fadeIn();
  }

  /**
   * Update blood overlay based on HP percentage
   * Creates a progressive red tint that gets stronger as HP decreases
   */
  private updateBloodOverlay(hpPercent: number): void {
    if (!this.sprite) return;

    // Remove old overlay if it exists
    if (this.bloodOverlay) {
      this.container.removeChild(this.bloodOverlay);
      this.bloodOverlay = null;
    }

    // Only add overlay if damaged (below 100% HP)
    if (hpPercent >= 1.0) return;

    // Create blood overlay
    this.bloodOverlay = new PIXI.Graphics();

    // Calculate blood intensity based on damage
    // 100% HP = 0 intensity, 0% HP = max intensity
    const damagePercent = 1 - hpPercent;
    const bloodIntensity = damagePercent * 0.5; // Max 50% opacity

    // Red tint color (dark red)
    const bloodColor = 0xAA0000;

    // Draw overlay rectangle matching sprite size
    this.bloodOverlay.rect(
      -this.sprite.width / 2,
      -this.sprite.height / 2,
      this.sprite.width,
      this.sprite.height
    );
    this.bloodOverlay.fill({ color: bloodColor, alpha: bloodIntensity });

    this.bloodOverlay.label = 'blood-overlay';

    // Add overlay on top of castle sprite
    this.container.addChild(this.bloodOverlay);

    console.log(`🩸 Blood overlay updated: ${(bloodIntensity * 100).toFixed(0)}% intensity (HP: ${(hpPercent * 100).toFixed(0)}%)`);
  }
}

