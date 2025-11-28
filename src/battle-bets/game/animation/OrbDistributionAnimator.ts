/**
 * OrbDistributionAnimator - Handles the visual animation of defense orb distribution
 * 
 * Animation Flow:
 * 1. Highlight unit record text (glow/pulse)
 * 2. Spawn orbs from unit record position
 * 3. Animate orbs flying to their designated grid cells
 * 4. Orbs settle and transform into defense dots
 * 5. Repeat for each team sequentially
 */

import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { unitRecordDisplay } from '../managers/UnitRecordDisplay';
import { DefenseDot } from '../entities/DefenseDot';
import { getDefenseCellPosition } from '../utils/positioning';
import { getDefenseCellId, distributeDotsAcrossStats } from '../../types/game';
import type { Game, StatType } from '../../types/game';
import { getCapperUnitsForTeam, getTotalDefenseDotCount } from '../../types/game';

interface OrbParticle {
  graphics: PIXI.Graphics;
  targetStat: StatType;
  targetCellNumber: number;
  targetPosition: { x: number; y: number };
}

class OrbDistributionAnimatorClass {
  private container: PIXI.Container | null = null;
  private orbParticles: OrbParticle[] = [];

  /**
   * Set the PixiJS container for rendering
   */
  setContainer(container: PIXI.Container): void {
    this.container = container;
  }

  /**
   * Animate the full defense orb distribution for both teams
   * Adds to existing base defense dots (cell #1 already exists)
   * Returns a promise that resolves when animation is complete
   */
  async animateDistribution(game: Game, existingDefenseDots: Map<string, DefenseDot>): Promise<Map<string, DefenseDot>> {
    if (!this.container) {
      console.error('❌ Container not set for OrbDistributionAnimator!');
      throw new Error('Container not set for OrbDistributionAnimator');
    }

    console.log('🎬 Starting defense orb distribution animation...');
    console.log(`   Existing defense dots: ${existingDefenseDots.size}`);
    console.log(`   Container children: ${this.container.children.length}`);

    // Start with existing base defense dots (2 per stat row = 20 total)
    const allDefenseDots = new Map(existingDefenseDots);

    // Animate left team first, then right team
    console.log('🎬 Animating LEFT team distribution...');
    await this.animateTeamDistribution(game, 'left', allDefenseDots);
    console.log('✅ LEFT team distribution complete!');

    console.log('🎬 Animating RIGHT team distribution...');
    await this.animateTeamDistribution(game, 'right', allDefenseDots);
    console.log('✅ RIGHT team distribution complete!');

    console.log(`✅ Defense orb distribution animation complete! Total dots: ${allDefenseDots.size}`);
    return allDefenseDots;
  }

  /**
   * Animate orb distribution for a single team
   */
  private async animateTeamDistribution(
    game: Game,
    side: 'left' | 'right',
    defenseDots: Map<string, DefenseDot>
  ): Promise<void> {
    const team = side === 'left' ? game.leftTeam : game.rightTeam;
    const capper = side === 'left' ? game.leftCapper : game.rightCapper;
    const units = getCapperUnitsForTeam(capper, team.id);
    const totalDots = getTotalDefenseDotCount(units);

    console.log(`🎯 Animating ${side} team: ${team.abbreviation} (${units} units = ${totalDots} dots)`);

    // Debug: Check if unit record text exists
    const text = unitRecordDisplay.getText(side);
    const glow = unitRecordDisplay.getGlow(side);
    console.log(`   Unit record text exists: ${text !== null}`);
    console.log(`   Unit record glow exists: ${glow !== null}`);

    // Step 1: Highlight unit record text
    await this.highlightUnitRecord(side, team.primaryColor);

    // Step 2: Calculate distribution
    const distributionArray = distributeDotsAcrossStats(totalDots);
    const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
    const distribution: Record<StatType, number> = {
      pts: distributionArray[0],
      reb: distributionArray[1],
      ast: distributionArray[2],
      stl: distributionArray[3],
      '3pt': distributionArray[4],
    };
    console.log(`   Distribution:`, distribution);

    // Step 3: Spawn and animate orbs
    await this.spawnAndAnimateOrbs(game, side, distribution, defenseDots);

    // Step 4: Fade out unit record highlight
    await this.fadeOutHighlight(side);
  }

  /**
   * Highlight the unit record text with glow/pulse animation
   */
  private async highlightUnitRecord(side: 'left' | 'right', teamColor: number): Promise<void> {
    const text = unitRecordDisplay.getText(side);
    const glow = unitRecordDisplay.getGlow(side);

    if (!text || !glow) return;

    // Draw glow background
    glow.clear();
    glow.circle(0, 0, 80);
    glow.fill(teamColor);
    glow.alpha = 0.3;

    // Animate glow appearance + pulse
    return new Promise((resolve) => {
      const timeline = gsap.timeline({
        onComplete: resolve
      });

      // Fade in glow
      timeline.to(glow, {
        alpha: 0.5,
        duration: 0.3,
        ease: 'power2.out'
      });

      // Pulse animation (scale text)
      timeline.to(text.scale, {
        x: 1.2,
        y: 1.2,
        duration: 0.4,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
      }, '<');
    });
  }

  /**
   * Fade out the unit record highlight
   */
  private async fadeOutHighlight(side: 'left' | 'right'): Promise<void> {
    const glow = unitRecordDisplay.getGlow(side);
    if (!glow) return;

    return new Promise((resolve) => {
      gsap.to(glow, {
        alpha: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: resolve
      });
    });
  }

  /**
   * Spawn orbs and animate them to their grid cells
   */
  private async spawnAndAnimateOrbs(
    game: Game,
    side: 'left' | 'right',
    distribution: Record<StatType, number>,
    defenseDots: Map<string, DefenseDot>
  ): Promise<void> {
    if (!this.container) {
      console.error(`❌ No container set for orb animation (${side})`);
      return;
    }

    const team = side === 'left' ? game.leftTeam : game.rightTeam;
    let spawnPos = unitRecordDisplay.getPosition(side);

    // FALLBACK: If unit record position not found, use a default position above the grid
    if (!spawnPos) {
      console.warn(`⚠️ No spawn position found for ${side} side, using fallback position`);
      // Calculate fallback position (center of defense grid, above it)
      const cellWidth = 78;
      const defenseCells = 10;

      if (side === 'left') {
        const leftWeaponSlotStart = 117;
        const weaponSlotWidth = 78;
        const leftDefenseStart = leftWeaponSlotStart + weaponSlotWidth;
        const leftDefenseCenter = leftDefenseStart + (defenseCells * cellWidth) / 2;
        spawnPos = { x: leftDefenseCenter, y: -30 };
      } else {
        const rightDefenseStart = 585;
        const rightDefenseCenter = rightDefenseStart + (defenseCells * cellWidth) / 2;
        spawnPos = { x: rightDefenseCenter, y: -30 };
      }
    }

    console.log(`✅ Spawn position for ${side}: (${spawnPos.x}, ${spawnPos.y})`);

    const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
    const orbsToAnimate: OrbParticle[] = [];

    // Create orb particles for each defense dot
    // Start from cell #3 since cells #1 and #2 already have base dots
    const BASE_DOTS_PER_STAT = 2;
    stats.forEach((stat) => {
      const dotsForStat = distribution[stat];
      const orbsToCreate = dotsForStat - BASE_DOTS_PER_STAT;

      console.log(`   ${stat.toUpperCase()}: ${dotsForStat} dots (creating ${orbsToCreate} orbs)`);

      // Start from cellNumber = 3 (cells #1 and #2 already exist as base dots)
      for (let cellNumber = BASE_DOTS_PER_STAT + 1; cellNumber <= dotsForStat; cellNumber++) {
        const targetPos = getDefenseCellPosition(stat, side, cellNumber);

        // Create orb particle
        const orb = new PIXI.Graphics();
        orb.circle(0, 0, 8);
        orb.fill(team.primaryColor);
        orb.x = spawnPos.x;
        orb.y = spawnPos.y;
        orb.alpha = 0;

        this.container.addChild(orb);

        orbsToAnimate.push({
          graphics: orb,
          targetStat: stat,
          targetCellNumber: cellNumber,
          targetPosition: targetPos
        });
      }
    });

    console.log(`🎨 Created ${orbsToAnimate.length} orb particles for ${side} side`);

    // Animate all orbs with staggered timing
    await this.animateOrbsToTargets(orbsToAnimate, team.primaryColor, side, game.id, team, defenseDots);
  }

  /**
   * Animate orbs flying to their target positions
   */
  private async animateOrbsToTargets(
    orbs: OrbParticle[],
    teamColor: number,
    side: 'left' | 'right',
    gameId: string,
    team: any,
    defenseDots: Map<string, DefenseDot>
  ): Promise<void> {
    return new Promise((resolve) => {
      const timeline = gsap.timeline({
        onComplete: () => {
          // Clean up orb particles
          orbs.forEach(orb => orb.graphics.destroy());
          resolve();
        }
      });

      orbs.forEach((orb, index) => {
        const delay = index * 0.05; // Stagger by 50ms

        // Fade in orb
        timeline.to(orb.graphics, {
          alpha: 1,
          duration: 0.2,
          ease: 'power2.out'
        }, delay);

        // Fly to target with simple linear movement
        timeline.to(orb.graphics, {
          x: orb.targetPosition.x,
          y: orb.targetPosition.y,
          duration: 0.6,
          ease: 'power1.inOut',
          onComplete: () => {
            // Create defense dot at target position
            this.createDefenseDot(
              gameId,
              orb.targetStat,
              side,
              orb.targetCellNumber,
              orb.targetPosition,
              team,
              defenseDots
            );
          }
        }, delay + 0.2);

        // Fade out orb as it reaches target
        timeline.to(orb.graphics, {
          alpha: 0,
          duration: 0.2,
          ease: 'power2.in'
        }, delay + 0.7);
      });
    });
  }

  /**
   * Create a defense dot at the target position
   */
  private createDefenseDot(
    gameId: string,
    stat: StatType,
    side: 'left' | 'right',
    cellNumber: number,
    position: { x: number; y: number },
    team: any,
    defenseDots: Map<string, DefenseDot>
  ): void {
    const cellId = getDefenseCellId(stat, side, cellNumber);
    const id = `${gameId}-${cellId}`;
    const is3ptRow = stat === '3pt';

    const dot = new DefenseDot({
      id,
      gameId,
      stat,
      side,
      index: cellNumber - 1,
      cellId,
      position,
      team,
      maxHp: 3,
      isRegenerated: is3ptRow,
    });

    defenseDots.set(id, dot);

    // CRITICAL: Add the defense dot sprite to the container immediately
    // so it's visible during the animation
    if (this.container) {
      dot.sprite.name = 'defense-dot';
      this.container.addChild(dot.sprite);
    }
  }

  /**
   * Clear all orb particles
   */
  clear(): void {
    this.orbParticles.forEach(orb => orb.graphics.destroy());
    this.orbParticles = [];
  }
}

// Singleton instance
export const orbDistributionAnimator = new OrbDistributionAnimatorClass();

