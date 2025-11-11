/**
 * Shield Regeneration System
 * Activates at the end of each quarter to regenerate defense dots
 */

import { useGameStore } from '../../store/gameStore';
import { DefenseDot } from '../entities/DefenseDot';
import { getDefenseCellPosition } from '../utils/positioning';
import { getDefenseCellId } from '../../types/game';
import type { StatType } from '../../types/game';
import gsap from 'gsap';
import { pixiManager } from '../managers/PixiManager';

/**
 * Regenerate defense dots at the end of a quarter
 * SHIELD row distributes 1 gold dot to POINTS, REB, and AST rows
 */
export async function regenerateDefenseDots(gameId: string): Promise<void> {
  const store = useGameStore.getState();
  const game = store.games.find(g => g.id === gameId);
  if (!game) return;

  console.log('\n🛡️ SHIELD REGENERATION ACTIVATING...');

  const sides: ('left' | 'right')[] = ['left', 'right'];
  const statsToRegenerate: StatType[] = ['points', 'reb', 'ast'];

  for (const side of sides) {
    const team = side === 'left' ? game.leftTeam : game.rightTeam;
    const capper = side === 'left' ? game.leftCapper : game.rightCapper;

    // Check if this side has any SHIELD dots
    const shieldDots = Array.from(store.defenseDots.values()).filter(
      d => d.gameId === gameId && d.side === side && d.stat === 'shield' && d.alive
    );

    if (shieldDots.length === 0) {
      console.log(`   ⚠️ ${capper.name} has no SHIELD dots - no regeneration`);
      continue;
    }

    console.log(`   ✨ ${capper.name} has ${shieldDots.length} SHIELD dots - regenerating...`);

    // Regenerate 1 gold dot for each stat
    for (const stat of statsToRegenerate) {
      await regenerateStatRow(gameId, stat, side, team);
    }
  }

  console.log('✅ Shield regeneration complete!\n');
}

/**
 * Regenerate a single stat row
 */
async function regenerateStatRow(
  gameId: string,
  stat: StatType,
  side: 'left' | 'right',
  team: any
): Promise<void> {
  const store = useGameStore.getState();

  // Find all alive defense dots for this stat/side
  const aliveDots = Array.from(store.defenseDots.values())
    .filter(d => d.gameId === gameId && d.side === side && d.stat === stat && d.alive)
    .sort((a, b) => a.index - b.index); // Sort by index

  // Determine next cell number
  let nextCellNumber: number;

  if (aliveDots.length === 0) {
    // No dots alive - resurrect at cell 1
    nextCellNumber = 1;
    console.log(`      💀 ${stat.toUpperCase()} row is dead - resurrecting at cell 1`);
  } else {
    // Find the last (rightmost for left side, leftmost for right side) alive dot
    const lastDot = aliveDots[aliveDots.length - 1];
    nextCellNumber = lastDot.index + 2; // index is 0-based, cellNumber is 1-based, so +2 for next cell

    // Check if we're at max capacity (10 cells)
    if (nextCellNumber > 10) {
      console.log(`      ⚠️ ${stat.toUpperCase()} row is full (10 cells) - cannot regenerate`);
      return;
    }

    console.log(`      ✨ ${stat.toUpperCase()} regenerating gold dot at cell ${nextCellNumber}`);
  }

  // Create the gold regeneration dot
  const cellId = getDefenseCellId(stat, side, nextCellNumber);
  const id = `${gameId}-${cellId}-regen-${Date.now()}`;
  const position = getDefenseCellPosition(stat, side, nextCellNumber);

  const goldDot = new DefenseDot({
    id,
    gameId,
    stat,
    side,
    index: nextCellNumber - 1,
    cellId,
    position,
    team,
    maxHp: 3,
    isRegenerated: true, // Mark as regenerated for gold color
  });

  // Add to store
  store.defenseDots.set(id, goldDot);

  // Trigger re-render
  useGameStore.setState(
    state => ({
      defenseDots: new Map(state.defenseDots),
    }),
    false,
    'regenerateDefenseDot'
  );

  // Animate spawn effect
  await animateGoldDotSpawn(goldDot);
}

/**
 * Animate the gold dot spawn with a glow effect
 */
async function animateGoldDotSpawn(dot: DefenseDot): Promise<void> {
  return new Promise((resolve) => {
    if (!dot.sprite) {
      resolve();
      return;
    }

    // Start invisible and small
    dot.sprite.alpha = 0;
    dot.sprite.scale.set(0.1);

    // Animate spawn
    gsap.timeline()
      .to(dot.sprite, {
        alpha: 1,
        duration: 0.3,
        ease: 'power2.out',
      })
      .to(dot.sprite.scale, {
        x: 1.5,
        y: 1.5,
        duration: 0.2,
        ease: 'back.out',
      }, '<')
      .to(dot.sprite.scale, {
        x: 1,
        y: 1,
        duration: 0.2,
        ease: 'elastic.out',
      })
      .call(() => {
        // Add pulsing glow effect
        gsap.to(dot.sprite, {
          alpha: 0.7,
          duration: 0.5,
          yoyo: true,
          repeat: 2,
          ease: 'sine.inOut',
        });
        resolve();
      });
  });
}

