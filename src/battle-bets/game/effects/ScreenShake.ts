import gsap from 'gsap';
import * as PIXI from 'pixi.js';

/**
 * Screen shake effect manager
 * Provides cinematic camera shake for impacts and collisions
 * Supports multiple battles by tracking containers per battleId
 */
export class ScreenShake {
  private static instance: ScreenShake;
  private containers: Map<string, PIXI.Container> = new Map();
  private originalPositions: Map<string, { x: number; y: number }> = new Map();
  private shakingBattles: Set<string> = new Set();

  private constructor() { }

  static getInstance(): ScreenShake {
    if (!ScreenShake.instance) {
      ScreenShake.instance = new ScreenShake();
    }
    return ScreenShake.instance;
  }

  /**
   * Set the container to shake for a specific battle
   */
  setContainer(container: PIXI.Container, battleId: string): void {
    this.containers.set(battleId, container);
    this.originalPositions.set(battleId, { x: container.x, y: container.y });
    console.log(`✅ ScreenShake: Container set for battle ${battleId}`);
  }

  /**
   * Trigger a screen shake effect for a specific battle
   * @param battleId - Battle ID to shake
   * @param intensity - 'small' | 'medium' | 'large'
   * @param duration - Optional custom duration in seconds
   */
  shake(battleId: string, intensity: 'small' | 'medium' | 'large' = 'medium', duration?: number): void {
    const container = this.containers.get(battleId);
    const originalPos = this.originalPositions.get(battleId);

    if (!container || !originalPos || this.shakingBattles.has(battleId)) return;

    const magnitudes = {
      small: 3,
      medium: 6,
      large: 12,
    };

    const durations = {
      small: 0.3,
      medium: 0.4,
      large: 0.6,
    };

    const magnitude = magnitudes[intensity];
    const shakeDuration = duration ?? durations[intensity];

    this.shakingBattles.add(battleId);

    console.log(`📳 Screen shake for battle ${battleId}: ${intensity} (magnitude: ${magnitude}, duration: ${shakeDuration}s)`);

    const timeline = gsap.timeline({
      onComplete: () => {
        this.shakingBattles.delete(battleId);
      },
    });

    // Initial strong shake
    timeline.to(container, {
      x: originalPos.x + gsap.utils.random(-magnitude, magnitude),
      y: originalPos.y + gsap.utils.random(-magnitude, magnitude),
      duration: 0.05,
      ease: 'power2.out',
    });

    // Medium shake
    timeline.to(container, {
      x: originalPos.x + gsap.utils.random(-magnitude, magnitude) * 0.6,
      y: originalPos.y + gsap.utils.random(-magnitude, magnitude) * 0.6,
      duration: 0.05,
    });

    // Small shake
    timeline.to(container, {
      x: originalPos.x + gsap.utils.random(-magnitude, magnitude) * 0.3,
      y: originalPos.y + gsap.utils.random(-magnitude, magnitude) * 0.3,
      duration: 0.05,
    });

    // Return to original position with elastic bounce
    timeline.to(container, {
      x: originalPos.x,
      y: originalPos.y,
      duration: shakeDuration - 0.15,
      ease: 'elastic.out(1, 0.3)',
    });
  }

  /**
   * Reset container to original position for a specific battle (emergency stop)
   */
  reset(battleId: string): void {
    const container = this.containers.get(battleId);
    const originalPos = this.originalPositions.get(battleId);

    if (!container || !originalPos) return;

    gsap.killTweensOf(container);
    container.x = originalPos.x;
    container.y = originalPos.y;
    this.shakingBattles.delete(battleId);
  }

  /**
   * Clear all shake references for a battle
   */
  clearBattle(battleId: string): void {
    this.reset(battleId);
    this.containers.delete(battleId);
    this.originalPositions.delete(battleId);
    console.log(`🧹 ScreenShake: Cleared references for battle ${battleId}`);
  }
}

export const screenShake = ScreenShake.getInstance();

