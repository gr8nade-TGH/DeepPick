/**
 * Stat Counter Animation System
 * Displays animated counters showing stats earned during a quarter
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import type { StatType } from '../../types/game';
import { getStatColor } from '../utils/colors';

/**
 * Configuration for stat counter position
 */
interface StatCounterConfig {
  stat: StatType;
  side: 'left' | 'right';
  value: number;
  rowY: number; // Y position of the stat row
  labelX: number; // X position of the stat label
}

/**
 * Create and animate a stat counter
 * Updates the permanent stat value text with count-up animation
 * Returns a promise that resolves when the animation completes
 */
export async function animateStatCounter(
  container: PIXI.Container,
  config: StatCounterConfig
): Promise<void> {
  return new Promise((resolve) => {
    const { stat, side, value } = config;

    // Find the permanent stat value text object
    const statValueName = `stat-value-${stat}-${side}`;

    const statValueText = container.children.find(
      (child) => child.name === statValueName
    ) as PIXI.Text | undefined;

    if (!statValueText) {
      console.warn(`⚠️ Could not find stat value text: ${statValueName}`);
      resolve();
      return;
    }

    // Get current value
    const currentValue = parseInt(statValueText.text) || 0;
    const newValue = currentValue + value;

    console.log(`📊 Animating ${stat} ${side}: ${currentValue} → ${newValue} (+${value})`);

    // Animation state
    const animState = { value: currentValue };

    // Create count-up animation
    gsap.to(animState, {
      value: newValue,
      duration: 1.5,
      ease: 'power2.out',
      onUpdate: () => {
        const displayValue = Math.floor(animState.value);
        statValueText.text = displayValue.toString();
      },
      onComplete: () => {
        // Ensure final value is exact
        statValueText.text = newValue.toString();

        // Brief scale pulse to emphasize the update
        gsap.timeline()
          .to(statValueText.scale, {
            x: 1.2,
            y: 1.2,
            duration: 0.2,
            ease: 'power2.out',
          })
          .to(statValueText.scale, {
            x: 1,
            y: 1,
            duration: 0.3,
            ease: 'elastic.out(1, 0.5)',
            onComplete: resolve,
          });
      },
    });
  });
}

/**
 * Animate weapon slot activation (glow pulse + charge effect)
 * weaponBallContainer is the Container that holds the weapon ball graphics
 */
export async function animateWeaponActivation(
  weaponBallContainer: PIXI.Container,
  stat: StatType
): Promise<void> {
  return new Promise((resolve) => {
    const color = getStatColor(stat);
    const originalScale = weaponBallContainer.scale.x;

    // Create glow effect at the weapon ball's position
    const glow = new PIXI.Graphics();
    glow.circle(0, 0, 20);
    glow.fill({ color, alpha: 0 });

    // Add glow to the weapon ball container so it's positioned correctly
    weaponBallContainer.addChild(glow);

    // Animation timeline
    const timeline = gsap.timeline({
      onComplete: () => {
        weaponBallContainer.removeChild(glow);
        glow.destroy();
        resolve();
      },
    });

    // Pulse 1
    timeline.to(glow, {
      alpha: 0.6,
      duration: 0.3,
      ease: 'power2.out',
    });
    timeline.to(glow.scale, {
      x: 1.5,
      y: 1.5,
      duration: 0.3,
      ease: 'power2.out',
    }, '<');
    timeline.to(glow, {
      alpha: 0,
      duration: 0.2,
    });

    // Pulse 2
    timeline.to(glow, {
      alpha: 0.6,
      duration: 0.3,
      ease: 'power2.out',
    });
    timeline.to(glow.scale, {
      x: 1.5,
      y: 1.5,
      duration: 0.3,
      ease: 'power2.out',
    }, '<');
    timeline.to(glow, {
      alpha: 0,
      duration: 0.2,
    });

    // Charge effect - ball container grows and returns
    timeline.to(weaponBallContainer.scale, {
      x: originalScale * 1.3,
      y: originalScale * 1.3,
      duration: 0.3,
      ease: 'power2.out',
    }, '-=0.4');
    timeline.to(weaponBallContainer.scale, {
      x: originalScale,
      y: originalScale,
      duration: 0.3,
      ease: 'elastic.out(1, 0.5)',
    });

    console.log(`   ⚡ Weapon activation animation started: ${stat}`);
  });
}

/**
 * Get weapon ball container from the container
 * This searches for the weapon ball in the premium grid
 */
export function getWeaponBall(
  container: PIXI.Container,
  stat: StatType,
  side: 'left' | 'right'
): PIXI.Container | null {
  // Search for weapon ball by name
  const weaponBallName = `weapon-ball-${stat}-${side}`;

  const findInChildren = (parent: PIXI.Container): PIXI.Container | null => {
    for (const child of parent.children) {
      if (child.name === weaponBallName && child instanceof PIXI.Container) {
        return child;
      }
      if (child instanceof PIXI.Container) {
        const found = findInChildren(child);
        if (found) return found;
      }
    }
    return null;
  };

  return findInChildren(container);
}

/**
 * Get stat label position for counter placement
 */
export function getStatLabelPosition(
  stat: StatType,
  side: 'left' | 'right'
): { x: number; y: number } {
  // These values match the premium grid layout
  const statRowHeight = 50;
  const statOrder = ['points', 'reb', 'ast', 'fire', 'shield'];
  const rowIndex = statOrder.indexOf(stat);
  
  const y = 25 + rowIndex * statRowHeight; // Center of row
  
  // Canvas width calculation
  const statLabelWidth = 60;
  const weaponSlotWidth = 30;
  const defenseCellWidth = 30;
  const attackCellWidth = 30;
  const battlefieldWidth = 400;
  
  let x: number;
  if (side === 'left') {
    x = statLabelWidth / 2; // Center of left stat label
  } else {
    // Right side label position
    const totalWidth = statLabelWidth + weaponSlotWidth + (5 * defenseCellWidth) + 
                      (4 * attackCellWidth) + battlefieldWidth + 
                      (4 * attackCellWidth) + (5 * defenseCellWidth) + 
                      weaponSlotWidth + statLabelWidth;
    x = totalWidth - (statLabelWidth / 2); // Center of right stat label
  }
  
  return { x, y };
}

