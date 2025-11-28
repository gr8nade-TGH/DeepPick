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
import { useMultiGameStore } from '../../store/multiGameStore';

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

    console.log(`🏰 takeDamage called: damage=${damage}, currentHP=${this.currentHP}`);

    // Apply damage through health system (no auto-shield activation)
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
   * Set castle HP (used by Castle item to override default HP)
   * Updates both max and current HP
   */
  public setHP(hp: number): void {
    if (this.isDestroyed) return;

    console.log(`🏰 [Castle.setHP] Setting HP for ${this.id}: ${this.maxHP} → ${hp}`);

    this.maxHP = hp;
    this.currentHP = hp;

    // Re-initialize in health system with new HP
    castleHealthSystem.initializeCastle(this.id, hp, hp);

    // Update visuals
    this.updateDamageState();
    this.updateHPBar();

    console.log(`✅ [Castle.setHP] HP updated to ${hp}/${hp}`);
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
   * Mark castle as destroyed with dramatic bloody explosion
   */
  private destroy(): void {
    this.isDestroyed = true;
    console.log(`💥🩸 Castle ${this.id} DESTROYED! Initiating bloody destruction...`);

    // Create massive blood explosion
    this.createBloodyExplosion();

    // Create debris/rubble flying outward
    this.createDebrisExplosion();

    // Create blood pool beneath castle
    this.createDeathBloodPool();

    // Show "DESTROYED" text
    this.showDestroyedText();

    // Dramatic destruction animation
    if (this.sprite && this.container) {
      // Shake violently first
      const originalX = this.container.x;
      const originalY = this.container.y;
      let shakeCount = 0;
      const maxShakes = 15;

      const violentShake = () => {
        if (shakeCount < maxShakes) {
          const intensity = 8 * (1 - shakeCount / maxShakes);
          this.container!.x = originalX + (Math.random() - 0.5) * intensity;
          this.container!.y = originalY + (Math.random() - 0.5) * intensity;
          shakeCount++;
          requestAnimationFrame(violentShake);
        } else {
          this.container!.x = originalX;
          this.container!.y = originalY;
          // Start collapse after shake
          this.collapseAnimation();
        }
      };
      violentShake();
    }
  }

  /**
   * Create massive blood explosion particles
   */
  private createBloodyExplosion(): void {
    if (!this.container) return;

    const bloodColors = [0x8B0000, 0xB22222, 0x6B0000, 0xDC143C, 0xFF0000, 0x4A0000];
    const particleCount = 60;

    for (let i = 0; i < particleCount; i++) {
      const blood = new PIXI.Graphics();
      const color = bloodColors[Math.floor(Math.random() * bloodColors.length)];
      const size = 3 + Math.random() * 8;

      // Random shape - circles and elongated drops
      if (Math.random() > 0.5) {
        blood.circle(0, 0, size);
      } else {
        blood.ellipse(0, 0, size * 0.6, size * 1.5);
      }
      blood.fill({ color, alpha: 0.9 });

      // Start from castle center
      blood.x = 0;
      blood.y = -60;

      this.container.addChild(blood);

      // Explosive outward trajectory
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance - 30;
      const duration = 0.4 + Math.random() * 0.4;

      // Animate outward with gravity
      const startTime = performance.now();
      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        blood.x = targetX * easeOut;
        blood.y = targetY * easeOut + (progress * progress * 50); // Gravity
        blood.alpha = 0.9 * (1 - progress * 0.5);
        blood.scale.set(1 - progress * 0.3);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.container?.removeChild(blood);
          blood.destroy();
        }
      };

      // Stagger the explosions slightly
      setTimeout(() => animate(), Math.random() * 100);
    }
  }

  /**
   * Create debris/rubble explosion
   */
  private createDebrisExplosion(): void {
    if (!this.container) return;

    const debrisColors = [0x4A4A4A, 0x6B6B6B, 0x8B8B8B, 0x5C4033, 0x3D2817];
    const debrisCount = 25;

    for (let i = 0; i < debrisCount; i++) {
      const debris = new PIXI.Graphics();
      const color = debrisColors[Math.floor(Math.random() * debrisColors.length)];
      const size = 4 + Math.random() * 10;

      // Rocky/angular shapes
      debris.rect(-size / 2, -size / 2, size, size * (0.5 + Math.random() * 0.5));
      debris.fill({ color, alpha: 1 });

      debris.x = (Math.random() - 0.5) * 40;
      debris.y = -60 + (Math.random() - 0.5) * 40;
      debris.rotation = Math.random() * Math.PI;

      this.container.addChild(debris);

      // Explosive trajectory
      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 100;
      const targetX = debris.x + Math.cos(angle) * distance;
      const targetY = debris.y + Math.sin(angle) * distance;
      const spinSpeed = (Math.random() - 0.5) * 10;
      const duration = 0.6 + Math.random() * 0.5;

      const startTime = performance.now();
      const startX = debris.x;
      const startY = debris.y;
      const startRot = debris.rotation;

      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 2);

        debris.x = startX + (targetX - startX) * easeOut;
        debris.y = startY + (targetY - startY) * easeOut + (progress * progress * 80);
        debris.rotation = startRot + spinSpeed * elapsed;
        debris.alpha = 1 - progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.container?.removeChild(debris);
          debris.destroy();
        }
      };
      animate();
    }
  }

  /**
   * Create large blood pool that spreads beneath the castle
   */
  private createDeathBloodPool(): void {
    if (!this.container) return;

    const pool = new PIXI.Graphics();
    pool.ellipse(0, 0, 5, 3);
    pool.fill({ color: 0x6B0000, alpha: 0.8 });
    pool.y = 20;

    this.container.addChild(pool);

    // Spread the blood pool
    const startTime = performance.now();
    const duration = 2.0;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      pool.clear();
      const width = 5 + 70 * easeOut;
      const height = 3 + 25 * easeOut;
      pool.ellipse(0, 0, width, height);
      pool.fill({ color: 0x6B0000, alpha: 0.7 - progress * 0.3 });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  /**
   * Show floating "DESTROYED" text followed by winner announcement
   */
  private showDestroyedText(): void {
    if (!this.container) return;

    const text = new PIXI.Text({
      text: '💀 DEFEATED 💀',
      style: {
        fontFamily: 'Arial Black',
        fontSize: 18,
        fill: 0xFF0000,
        stroke: { color: 0x000000, width: 4 },
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4,
        dropShadowDistance: 2,
      }
    });
    text.anchor.set(0.5);
    text.x = 0;
    // Start at visible position above castle (not too high!)
    text.y = -20;
    text.alpha = 0;

    this.container.addChild(text);

    // Fade in, float up slightly, then show winner
    const startTime = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed < 0.3) {
        // Fade in
        text.alpha = elapsed / 0.3;
      } else if (elapsed < 1.5) {
        // Hold and float up slightly (only 15px total)
        text.alpha = 1;
        text.y = -20 - (elapsed - 0.3) * 12;
      } else if (elapsed < 2.5) {
        // Fade out
        text.alpha = 1 - (elapsed - 1.5);
        text.y = -20 - 14.4 - (elapsed - 1.5) * 5;
      } else {
        this.container?.removeChild(text);
        text.destroy();
        // Show winner announcement after destroyed text fades
        this.showWinnerAnnouncement();
        return;
      }
      requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Show winner announcement with treasure chest
   * The winner is the OPPONENT of the destroyed castle
   */
  private showWinnerAnnouncement(): void {
    if (!this.container?.parent) return;

    // Get the parent container (battlefieldContainer) to show winner in center
    const battlefieldContainer = this.container.parent;

    // FIRST: Clear ALL projectiles so they don't fly over the popup
    // Extract battleId from castle id (format: "battleId-left" or "battleId-right")
    const battleId = this.id.replace(/-left$/, '').replace(/-right$/, '');
    console.log(`🧹 [Castle] Clearing projectiles for battle ${battleId} before winner popup`);
    useMultiGameStore.getState().clearAllProjectiles(battleId);

    // Determine winner - it's the OPPOSITE side
    const winnerSide = this.side === 'left' ? 'right' : 'left';
    const winnerColor = winnerSide === 'left' ? 0x00FFFF : 0xFF6666;

    // Create winner container for centered display
    const winnerContainer = new PIXI.Container();
    winnerContainer.label = 'winner-announcement';

    // Position CENTERED in the battlefield - align with "Q2 BATTLE" in top bar
    // x=580 for proper horizontal centering, y=85 to ensure popup fits vertically
    winnerContainer.x = 580;
    winnerContainer.y = 85;

    // Ensure popup is rendered on TOP of everything (including projectiles)
    winnerContainer.zIndex = 9999;

    // Create FULLY OPAQUE dark background panel with ornate border
    const bgPanel = new PIXI.Graphics();
    // Outer glow
    bgPanel.roundRect(-160, -90, 320, 200, 15);
    bgPanel.fill({ color: winnerColor, alpha: 0.4 });
    // Main dark background - FULLY OPAQUE so projectiles don't show through
    bgPanel.roundRect(-150, -80, 300, 180, 12);
    bgPanel.fill({ color: 0x1a1a2e, alpha: 1.0 });
    // Inner border
    bgPanel.roundRect(-145, -75, 290, 170, 10);
    bgPanel.stroke({ color: winnerColor, width: 2, alpha: 0.8 });
    // Gold accent border
    bgPanel.roundRect(-140, -70, 280, 160, 8);
    bgPanel.stroke({ color: 0xFFD700, width: 1, alpha: 0.5 });
    winnerContainer.addChild(bgPanel);

    // Create glowing aura behind chest
    const bgGlow = new PIXI.Graphics();
    bgGlow.circle(0, 30, 70);
    bgGlow.fill({ color: 0xFFD700, alpha: 0.2 });
    bgGlow.circle(0, 30, 50);
    bgGlow.fill({ color: 0xFFD700, alpha: 0.15 });
    bgGlow.circle(0, 30, 30);
    bgGlow.fill({ color: 0xFFFFFF, alpha: 0.1 });
    winnerContainer.addChild(bgGlow);

    // Create enhanced treasure chest (closed initially)
    const chestContainer = new PIXI.Container();
    chestContainer.y = 30;

    // Chest shadow
    const chestShadow = new PIXI.Graphics();
    chestShadow.ellipse(0, 35, 40, 10);
    chestShadow.fill({ color: 0x000000, alpha: 0.4 });
    chestContainer.addChild(chestShadow);

    // Chest base - larger and more detailed
    const chestBase = new PIXI.Graphics();
    // Main body
    chestBase.roundRect(-35, 0, 70, 40, 5);
    chestBase.fill({ color: 0x654321, alpha: 1 });
    // Wood grain highlight
    chestBase.roundRect(-32, 3, 64, 34, 4);
    chestBase.fill({ color: 0x8B4513, alpha: 1 });
    // Metal bands
    chestBase.rect(-35, 8, 70, 5);
    chestBase.fill({ color: 0xDAA520, alpha: 1 });
    chestBase.rect(-35, 25, 70, 5);
    chestBase.fill({ color: 0xDAA520, alpha: 1 });
    // Corner rivets
    for (const x of [-30, 30]) {
      for (const y of [5, 35]) {
        chestBase.circle(x, y, 3);
        chestBase.fill({ color: 0xFFD700, alpha: 1 });
        chestBase.circle(x, y, 1.5);
        chestBase.fill({ color: 0xFFF8DC, alpha: 0.8 });
      }
    }
    chestContainer.addChild(chestBase);

    // Chest lid (will rotate open) - enhanced
    const chestLid = new PIXI.Graphics();
    // Lid body with curved top
    chestLid.roundRect(-35, -22, 70, 25, 5);
    chestLid.fill({ color: 0x654321, alpha: 1 });
    chestLid.roundRect(-32, -19, 64, 19, 4);
    chestLid.fill({ color: 0x8B4513, alpha: 1 });
    // Metal band on lid
    chestLid.rect(-35, -12, 70, 4);
    chestLid.fill({ color: 0xDAA520, alpha: 1 });
    // Ornate lock plate
    chestLid.roundRect(-12, -8, 24, 16, 3);
    chestLid.fill({ color: 0xDAA520, alpha: 1 });
    chestLid.roundRect(-10, -6, 20, 12, 2);
    chestLid.fill({ color: 0xFFD700, alpha: 1 });
    // Keyhole
    chestLid.circle(0, -2, 4);
    chestLid.fill({ color: 0x1a1a1a, alpha: 1 });
    chestLid.rect(-1.5, 0, 3, 6);
    chestLid.fill({ color: 0x1a1a1a, alpha: 1 });
    // Lid gems
    for (const x of [-22, 22]) {
      chestLid.circle(x, -10, 4);
      chestLid.fill({ color: 0xFF0000, alpha: 1 });
      chestLid.circle(x - 1, -11, 1.5);
      chestLid.fill({ color: 0xFFFFFF, alpha: 0.6 });
    }
    chestLid.pivot.set(0, 3); // Pivot at bottom of lid for rotation
    chestContainer.addChild(chestLid);

    winnerContainer.addChild(chestContainer);

    // Winner text (above chest) - larger and more dramatic
    const winnerText = new PIXI.Text({
      text: `🏆 WINNER! 🏆`,
      style: {
        fontFamily: 'Arial Black',
        fontSize: 28,
        fill: 0xFFD700,
        stroke: { color: 0x000000, width: 5 },
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 6,
        dropShadowDistance: 3,
      }
    });
    winnerText.anchor.set(0.5);
    winnerText.x = 0;
    winnerText.y = -55;
    winnerContainer.addChild(winnerText);

    // Side indicator text - more prominent
    const sideText = new PIXI.Text({
      text: winnerSide === 'left' ? '◀ LEFT TEAM WINS! ◀' : '▶ RIGHT TEAM WINS! ▶',
      style: {
        fontFamily: 'Arial Black',
        fontSize: 16,
        fill: winnerColor,
        stroke: { color: 0x000000, width: 3 },
      }
    });
    sideText.anchor.set(0.5);
    sideText.x = 0;
    sideText.y = -28;
    winnerContainer.addChild(sideText);

    // "Click to open!" text - positioned below the enhanced chest
    const clickText = new PIXI.Text({
      text: '✨ Click chest to reveal rewards! ✨',
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xFFFFFF,
        stroke: { color: 0x000000, width: 2 },
      }
    });
    clickText.anchor.set(0.5);
    clickText.x = 0;
    clickText.y = 80;
    winnerContainer.addChild(clickText);

    // Start hidden, fade in
    winnerContainer.alpha = 0;
    winnerContainer.scale.set(0.5);

    // Enable sortableChildren so zIndex works, then add to container
    battlefieldContainer.sortableChildren = true;
    battlefieldContainer.addChild(winnerContainer);

    // Also move to top of display list as backup
    battlefieldContainer.setChildIndex(winnerContainer, battlefieldContainer.children.length - 1);

    // Fade in animation
    const fadeIn = () => {
      const startTime = performance.now();
      const duration = 500;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        winnerContainer.alpha = easeOut;
        winnerContainer.scale.set(0.5 + 0.5 * easeOut);

        // Pulse the glow
        bgGlow.alpha = 0.5 + 0.2 * Math.sin(elapsed / 200);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Start glow pulse loop
          this.pulseWinnerGlow(bgGlow);
        }
      };
      animate();
    };
    fadeIn();

    // Make chest interactive
    chestContainer.eventMode = 'static';
    chestContainer.cursor = 'pointer';

    let isOpen = false;
    chestContainer.on('pointerdown', () => {
      if (isOpen) return;
      isOpen = true;

      // Open chest animation
      this.openTreasureChest(chestLid, chestContainer, clickText, winnerContainer);
    });
  }

  /**
   * Pulse the winner glow effect
   */
  private pulseWinnerGlow(glow: PIXI.Graphics): void {
    const startTime = performance.now();
    const pulse = () => {
      if (!glow.parent) return; // Stop if removed
      const elapsed = (performance.now() - startTime) / 1000;
      glow.alpha = 0.3 + 0.15 * Math.sin(elapsed * 3);
      requestAnimationFrame(pulse);
    };
    pulse();
  }

  /**
   * Animate treasure chest opening with rewards
   */
  private openTreasureChest(
    lid: PIXI.Graphics,
    chestContainer: PIXI.Container,
    clickText: PIXI.Text,
    winnerContainer: PIXI.Container
  ): void {
    // Hide click text
    clickText.visible = false;

    // Open lid animation
    const startTime = performance.now();
    const duration = 400;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Rotate lid back (opening)
      lid.rotation = -easeOut * 1.2; // About 70 degrees open
      lid.y = -15 - easeOut * 5; // Lift slightly

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Spawn reward particles!
        this.spawnRewardParticles(chestContainer, winnerContainer);
      }
    };
    animate();
  }

  /**
   * Spawn golden reward particles from chest
   */
  private spawnRewardParticles(chestContainer: PIXI.Container, winnerContainer: PIXI.Container): void {
    const particleColors = [0xFFD700, 0xFFA500, 0xFFFF00, 0xFFFFFF, 0x00FF00];
    const particleEmojis = ['⭐', '💎', '🪙', '✨', '🎁'];

    // Spawn burst of particles
    for (let i = 0; i < 20; i++) {
      const isEmoji = Math.random() > 0.7;

      if (isEmoji) {
        const emoji = particleEmojis[Math.floor(Math.random() * particleEmojis.length)];
        const text = new PIXI.Text({
          text: emoji,
          style: { fontSize: 16 + Math.random() * 10 }
        });
        text.anchor.set(0.5);
        text.x = chestContainer.x + (Math.random() - 0.5) * 20;
        text.y = chestContainer.y - 10;

        winnerContainer.addChild(text);

        // Animate upward and fade
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const speed = 80 + Math.random() * 60;
        const startTime = performance.now();
        const duration = 1000 + Math.random() * 500;

        const animateParticle = () => {
          const elapsed = performance.now() - startTime;
          const progress = elapsed / duration;

          if (progress < 1) {
            text.x = chestContainer.x + (Math.random() - 0.5) * 20 + Math.cos(angle) * speed * progress;
            text.y = chestContainer.y - 10 + Math.sin(angle) * speed * progress + progress * progress * 30;
            text.alpha = 1 - progress;
            text.rotation = progress * 2;
            requestAnimationFrame(animateParticle);
          } else {
            winnerContainer.removeChild(text);
            text.destroy();
          }
        };
        setTimeout(() => animateParticle(), i * 50);
      } else {
        const particle = new PIXI.Graphics();
        const color = particleColors[Math.floor(Math.random() * particleColors.length)];
        const size = 3 + Math.random() * 5;

        particle.circle(0, 0, size);
        particle.fill({ color, alpha: 1 });

        particle.x = chestContainer.x + (Math.random() - 0.5) * 20;
        particle.y = chestContainer.y - 10;

        winnerContainer.addChild(particle);

        // Animate
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
        const speed = 60 + Math.random() * 80;
        const startTime = performance.now();
        const duration = 800 + Math.random() * 400;

        const animateParticle = () => {
          const elapsed = performance.now() - startTime;
          const progress = elapsed / duration;

          if (progress < 1) {
            particle.x = chestContainer.x + Math.cos(angle) * speed * progress;
            particle.y = chestContainer.y - 10 + Math.sin(angle) * speed * progress + progress * progress * 40;
            particle.alpha = 1 - progress;
            particle.scale.set(1 - progress * 0.5);
            requestAnimationFrame(animateParticle);
          } else {
            winnerContainer.removeChild(particle);
            particle.destroy();
          }
        };
        setTimeout(() => animateParticle(), i * 30);
      }
    }

    // Show "Rewards Collected!" text after particles
    setTimeout(() => {
      const rewardText = new PIXI.Text({
        text: '🎉 Rewards Collected! 🎉',
        style: {
          fontFamily: 'Arial Black',
          fontSize: 16,
          fill: 0x00FF00,
          stroke: { color: 0x000000, width: 3 },
        }
      });
      rewardText.anchor.set(0.5);
      rewardText.x = 0;
      rewardText.y = 65;
      rewardText.alpha = 0;
      winnerContainer.addChild(rewardText);

      // Fade in reward text
      const startTime = performance.now();
      const fadeInReward = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / 300, 1);
        rewardText.alpha = progress;
        if (progress < 1) {
          requestAnimationFrame(fadeInReward);
        }
      };
      fadeInReward();
    }, 1000);
  }

  /**
   * Castle collapse animation
   */
  private collapseAnimation(): void {
    if (!this.sprite || !this.container) return;

    const startTime = performance.now();
    const duration = 1.5;
    const startAlpha = this.sprite.alpha;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      // Sink down
      if (this.sprite) {
        this.sprite.y = this.sprite.y + progress * 0.5;
        this.sprite.alpha = startAlpha * (1 - progress);
        // Slight tilt as it collapses
        this.sprite.rotation = progress * 0.1 * (this.side === 'left' ? 1 : -1);
      }

      // Fade HP bar
      if (this.hpBarContainer) {
        this.hpBarContainer.alpha = 1 - progress;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Final state - very faded remains
        if (this.sprite) {
          this.sprite.alpha = 0.1;
        }
      }
    };
    animate();
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
    const orbCenterX = 0; // Centered (was 10, too far right)
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
   * Creates dripping blood from top and cracks instead of a rectangle
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

    // Calculate damage intensity
    const damagePercent = 1 - hpPercent;
    const w = this.sprite.width;
    const h = this.sprite.height;

    // Blood drips from top - more drips as damage increases
    const numDrips = Math.floor(3 + damagePercent * 8); // 3-11 drips
    const dripMaxLength = h * (0.2 + damagePercent * 0.6); // Longer drips with more damage

    for (let i = 0; i < numDrips; i++) {
      // Random x position across the castle width
      const x = -w / 2 + (w * (i + 0.5)) / numDrips + (Math.random() - 0.5) * 15;
      const startY = -h / 2 - 5;
      const dripLength = 15 + Math.random() * dripMaxLength;
      const dripWidth = 2 + Math.random() * 3;

      // Draw drip trail
      this.bloodOverlay.moveTo(x, startY);
      this.bloodOverlay.lineTo(x + (Math.random() - 0.5) * 5, startY + dripLength);
      this.bloodOverlay.stroke({ width: dripWidth, color: 0x8B0000, alpha: 0.6 + damagePercent * 0.3 });

      // Add blood drop at the end
      this.bloodOverlay.circle(x + (Math.random() - 0.5) * 3, startY + dripLength, dripWidth * 0.8);
      this.bloodOverlay.fill({ color: 0xAA0000, alpha: 0.7 });
    }

    // Add damage cracks - more cracks with more damage
    const numCracks = Math.floor(damagePercent * 6); // 0-6 cracks
    for (let i = 0; i < numCracks; i++) {
      const startX = (Math.random() - 0.5) * w * 0.8;
      const startY = (Math.random() - 0.5) * h * 0.8;
      const crackLength = 10 + Math.random() * 25;
      const angle = Math.random() * Math.PI * 2;

      // Main crack line
      this.bloodOverlay.moveTo(startX, startY);
      this.bloodOverlay.lineTo(
        startX + Math.cos(angle) * crackLength,
        startY + Math.sin(angle) * crackLength
      );
      this.bloodOverlay.stroke({ width: 1 + Math.random(), color: 0x2a2a2a, alpha: 0.8 });

      // Branch cracks
      const branchX = startX + Math.cos(angle) * crackLength * 0.5;
      const branchY = startY + Math.sin(angle) * crackLength * 0.5;
      const branchAngle = angle + (Math.random() - 0.5) * 1.5;
      const branchLength = crackLength * 0.4;

      this.bloodOverlay.moveTo(branchX, branchY);
      this.bloodOverlay.lineTo(
        branchX + Math.cos(branchAngle) * branchLength,
        branchY + Math.sin(branchAngle) * branchLength
      );
      this.bloodOverlay.stroke({ width: 0.5 + Math.random() * 0.5, color: 0x1a1a1a, alpha: 0.6 });
    }

    // Add some blood splatters on the walls
    const numSplatters = Math.floor(2 + damagePercent * 5);
    for (let i = 0; i < numSplatters; i++) {
      const x = (Math.random() - 0.5) * w * 0.7;
      const y = (Math.random() - 0.5) * h * 0.7;
      const size = 3 + Math.random() * 5;

      this.bloodOverlay.circle(x, y, size);
      this.bloodOverlay.fill({ color: 0x8B0000, alpha: 0.3 + damagePercent * 0.2 });

      // Small splatter drops around it
      for (let j = 0; j < 3; j++) {
        const dropX = x + (Math.random() - 0.5) * size * 3;
        const dropY = y + (Math.random() - 0.5) * size * 3;
        const dropSize = size * 0.3;
        this.bloodOverlay.circle(dropX, dropY, dropSize);
        this.bloodOverlay.fill({ color: 0x6B0000, alpha: 0.25 });
      }
    }

    this.bloodOverlay.label = 'blood-overlay';

    // Add overlay on top of castle sprite
    this.container.addChild(this.bloodOverlay);

    console.log(`🩸 Blood overlay updated: drips=${numDrips}, cracks=${numCracks}, splatters=${numSplatters} (HP: ${(hpPercent * 100).toFixed(0)}%)`);
  }
}

