import gsap from 'gsap';
import * as PIXI from 'pixi.js';

/**
 * Screen shake effect manager
 * Provides cinematic camera shake for impacts and collisions
 */
export class ScreenShake {
  private static instance: ScreenShake;
  private container: PIXI.Container | null = null;
  private originalX = 0;
  private originalY = 0;
  private isShaking = false;

  private constructor() {}

  static getInstance(): ScreenShake {
    if (!ScreenShake.instance) {
      ScreenShake.instance = new ScreenShake();
    }
    return ScreenShake.instance;
  }

  /**
   * Set the container to shake (usually the main stage)
   */
  setContainer(container: PIXI.Container): void {
    this.container = container;
    this.originalX = container.x;
    this.originalY = container.y;
  }

  /**
   * Trigger a screen shake effect
   * @param intensity - 'small' | 'medium' | 'large'
   * @param duration - Optional custom duration in seconds
   */
  shake(intensity: 'small' | 'medium' | 'large' = 'medium', duration?: number): void {
    if (!this.container || this.isShaking) return;

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

    this.isShaking = true;

    console.log(`📳 Screen shake: ${intensity} (magnitude: ${magnitude}, duration: ${shakeDuration}s)`);

    const timeline = gsap.timeline({
      onComplete: () => {
        this.isShaking = false;
      },
    });

    // Initial strong shake
    timeline.to(this.container, {
      x: this.originalX + gsap.utils.random(-magnitude, magnitude),
      y: this.originalY + gsap.utils.random(-magnitude, magnitude),
      duration: 0.05,
      ease: 'power2.out',
    });

    // Medium shake
    timeline.to(this.container, {
      x: this.originalX + gsap.utils.random(-magnitude, magnitude) * 0.6,
      y: this.originalY + gsap.utils.random(-magnitude, magnitude) * 0.6,
      duration: 0.05,
    });

    // Small shake
    timeline.to(this.container, {
      x: this.originalX + gsap.utils.random(-magnitude, magnitude) * 0.3,
      y: this.originalY + gsap.utils.random(-magnitude, magnitude) * 0.3,
      duration: 0.05,
    });

    // Return to original position with elastic bounce
    timeline.to(this.container, {
      x: this.originalX,
      y: this.originalY,
      duration: shakeDuration - 0.15,
      ease: 'elastic.out(1, 0.3)',
    });
  }

  /**
   * Reset container to original position (emergency stop)
   */
  reset(): void {
    if (!this.container) return;

    gsap.killTweensOf(this.container);
    this.container.x = this.originalX;
    this.container.y = this.originalY;
    this.isShaking = false;
  }
}

export const screenShake = ScreenShake.getInstance();

