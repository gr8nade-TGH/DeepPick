/**
 * Game state management with Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DefenseDot } from '../game/entities/DefenseDot';
import { BaseProjectile } from '../game/entities/projectiles/BaseProjectile';
import type { Game, StatType, StatRowHP } from '../types/game';
import {
  TEAMS,
  getTotalDefenseDotCount,
  distributeDotsAcrossStats,
  getCapperUnitsForTeam,
  getDefenseCellId
} from '../types/game';
import { getDefenseCellPosition } from '../game/utils/positioning';
import { castleManager } from '../game/managers/CastleManager';
import { fireFireOrbProjectilesV4 } from '../game/items/FireOrb';

/**
 * State for a single battle
 */
interface BattleState {
  game: Game;
  currentQuarter: number;
  capperHP: Map<string, { currentHP: number; maxHP: number }>; // Key: "side" (e.g., "left", "right")
  defenseDots: Map<string, DefenseDot>;
  projectiles: BaseProjectile[];
}

/**
 * Multi-game store state
 * Supports multiple simultaneous battles (up to 4 per page)
 */
interface GameState {
  // Map of battleId → BattleState
  battles: Map<string, BattleState>;

  // Actions
  initializeBattle: (battleId: string, game: Game) => void;
  initializeCapperHP: (battleId: string) => void;
  initializeDefenseDots: (battleId: string) => void;
  addProjectile: (battleId: string, projectile: BaseProjectile) => void;
  removeProjectile: (battleId: string, id: string) => void;
  applyDamageToCapperHP: (battleId: string, side: 'left' | 'right', damage: number) => void;
  applyDamage: (battleId: string, dotId: string, damage: number) => void;
  triggerFireOrb: (battleId: string, side: 'left' | 'right') => void;
  setCurrentQuarter: (battleId: string, quarter: number) => void;
  updateScore: (battleId: string, leftScore: number, rightScore: number) => void;
  updateGameStatus: (battleId: string, status: Game['status']) => void;
  resetBattle: (battleId: string) => void;
  resetAllBattles: () => void;
}

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      // Initial state
      battles: new Map(),

      // Initialize a single battle
      initializeBattle: (battleId: string, game: Game) => {
        console.log(`[Multi-Game Store] Initializing battle: ${battleId}`)

        const battleState: BattleState = {
          game,
          currentQuarter: 0,
          capperHP: new Map(),
          defenseDots: new Map(),
          projectiles: []
        }

        set(state => {
          const newBattles = new Map(state.battles)
          newBattles.set(battleId, battleState)
          return { battles: newBattles }
        })

        // Initialize HP and defense dots for this battle
        get().initializeCapperHP(battleId)
        get().initializeDefenseDots(battleId)
      },

      // DEPRECATED: Old single-game initialization (kept for backward compatibility)
      initializeGame: () => {
        console.warn('[Multi-Game Store] initializeGame() is deprecated. Use initializeBattle() instead.')
        const game1: Game = {
          id: 'game1',
          leftTeam: TEAMS.LAL,
          rightTeam: TEAMS.MEM,
          leftCapper: {
            id: 'capper1',
            name: 'Shiva',
            favoriteTeam: TEAMS.LAL,
            health: 100,
            maxHealth: 100,
            level: 1,
            experience: 0,
            leaderboardRank: 1, // #1 on leaderboard
            // Unit records for different teams (every +3 units = 1 defense dot)
            teamRecords: [
              { teamId: 'lakers', units: 32, wins: 12, losses: 5, pushes: 1 }, // +32 units → 11 defense dots
              { teamId: 'grizzlies', units: 15, wins: 8, losses: 6, pushes: 0 }, // +15 units → 5 defense dots
              { teamId: 'celtics', units: 25, wins: 10, losses: 4, pushes: 2 }, // +25 units → 8 defense dots
              { teamId: 'cavaliers', units: 10, wins: 6, losses: 5, pushes: 1 }, // +10 units → 3 defense dots
            ],
            equippedItems: {
              slot1: 'blue-orb-shield', // Blue Orb Shield (already equipped)
              slot2: 'fire-orb', // Fire Orb equipped!
              slot3: null,
            },
          },
          rightCapper: {
            id: 'capper2',
            name: 'Oracle',
            favoriteTeam: TEAMS.MEM,
            health: 100,
            maxHealth: 100,
            level: 1,
            experience: 0,
            leaderboardRank: 3, // #3 on leaderboard
            // Unit records for different teams (every +3 units = 1 defense dot)
            teamRecords: [
              { teamId: 'lakers', units: 20, wins: 9, losses: 6, pushes: 1 }, // +20 units → 7 defense dots
              { teamId: 'grizzlies', units: 24, wins: 10, losses: 5, pushes: 1 }, // +24 units → 8 defense dots
              { teamId: 'celtics', units: 18, wins: 8, losses: 5, pushes: 2 }, // +18 units → 6 defense dots
              { teamId: 'cavaliers', units: 30, wins: 11, losses: 4, pushes: 0 }, // +30 units → 10 defense dots
            ],
            equippedItems: {
              slot1: 'blue-orb-shield', // Blue Orb Shield (already equipped)
              slot2: 'fire-orb', // Fire Orb equipped!
              slot3: null,
            },
          },
          currentQuarter: 0,
          spread: -4.5, // LAL -4.5 (Lakers favored by 4.5)
          gameDate: 'Jan 15, 2024',
          gameTime: '7:30 PM ET',
          leftScore: 0,
          rightScore: 0,
          status: 'SCHEDULED',
        };

        set({ games: [game1] });

        // Initialize capper HP for game 1
        get().initializeCapperHP('game1');

        // Initialize defense dots for game 1
        get().initializeDefenseDots('game1');
      },

      // Initialize capper HP (one HP bar per capper)
      // HP is based on total defense dots (units / 3)
      initializeCapperHP: (gameId: string) => {
        const game = get().games.find(g => g.id === gameId);
        if (!game) return;

        const capperHP = new Map<string, { currentHP: number; maxHP: number }>();

        // Left capper - HP based on units
        const leftUnits = getCapperUnitsForTeam(game.leftCapper, game.leftTeam.id);
        const leftHP = getTotalDefenseDotCount(leftUnits); // Every 3 units = 1 HP
        const leftKey = `${gameId}-left`;
        capperHP.set(leftKey, {
          currentHP: leftHP,
          maxHP: leftHP,
        });

        // Right capper - HP based on units
        const rightUnits = getCapperUnitsForTeam(game.rightCapper, game.rightTeam.id);
        const rightHP = getTotalDefenseDotCount(rightUnits); // Every 3 units = 1 HP
        const rightKey = `${gameId}-right`;
        capperHP.set(rightKey, {
          currentHP: rightHP,
          maxHP: rightHP,
        });

        set({ capperHP });
        console.log(`💚 Initialized Capper HP:`);
        console.log(`   ${game.leftCapper.name}: ${leftHP} HP (from ${leftUnits} units)`);
        console.log(`   ${game.rightCapper.name}: ${rightHP} HP (from ${rightUnits} units)`);
      },

      // Initialize defense dots for a game
      // Creates ONLY 1 base defense dot per stat row (5 per side = 10 total)
      // Full distribution happens during orb animation when "Simulate Battle" is clicked
      initializeDefenseDots: (gameId: string) => {
        const game = get().games.find(g => g.id === gameId);
        if (!game) return;

        const defenseDots = new Map<string, DefenseDot>();
        const stats: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];
        const sides: ('left' | 'right')[] = ['left', 'right'];

        sides.forEach(side => {
          const team = side === 'left' ? game.leftTeam : game.rightTeam;
          const capper = side === 'left' ? game.leftCapper : game.rightCapper;

          // Get capper's TOTAL unit record for this team (for logging)
          const units = getCapperUnitsForTeam(capper, team.id);
          const totalDots = getTotalDefenseDotCount(units);

          console.log(`📊 ${capper.name} has ${units} units on ${team.abbreviation} = ${totalDots} TOTAL defense dots (will be distributed during orb animation)`);

          // Create ONLY 1 base defense dot per stat row (cell #1)
          stats.forEach((stat) => {
            const cellNumber = 1; // Only first cell
            const is3ptRow = stat === '3pt';
            const cellId = getDefenseCellId(stat, side, cellNumber);
            const id = `${gameId}-${cellId}`;

            // GridManager already returns the CENTER of the cell, no offset needed
            const position = getDefenseCellPosition(stat, side, cellNumber);

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
              isRegenerated: is3ptRow, // 3PT dots are golden
            });

            defenseDots.set(id, dot);
          });
        });

        set({ defenseDots });
        console.log(`✅ Initialized ${defenseDots.size} BASE defense dots for ${gameId} (1 per stat row)`);
      },

      // Add a projectile to the game
      addProjectile: (projectile: BaseProjectile) => {
        set(
          state => ({
            projectiles: [...state.projectiles, projectile],
          }),
          false,
          'addProjectile'
        );
      },

      // Remove a projectile from the game
      removeProjectile: (id: string) => {
        set(
          state => ({
            projectiles: state.projectiles.filter(p => p.id !== id),
          }),
          false,
          'removeProjectile'
        );
      },

      // Apply damage to capper HP (when projectile hits weapon slot with no defense dots)
      applyDamageToCapperHP: (gameId: string, side: 'left' | 'right', damage: number) => {
        const key = `${gameId}-${side}`;
        const hp = get().capperHP.get(key);

        if (!hp) {
          console.warn(`⚠️ No HP tracking found for ${key}`);
          return;
        }

        const newHP = Math.max(0, hp.currentHP - damage);
        const actualDamage = hp.currentHP - newHP;

        if (actualDamage > 0) {
          const game = get().games.find(g => g.id === gameId);
          const capperName = side === 'left' ? game?.leftCapper.name : game?.rightCapper.name;

          console.log(`💔 ${capperName} HP: ${hp.currentHP} → ${newHP} (-${actualDamage})`);

          if (newHP === 0) {
            console.log(`☠️ ${capperName} HAS BEEN DEFEATED!`);
          }

          // Update store HP tracking
          set(state => {
            const newCapperHP = new Map(state.capperHP);
            newCapperHP.set(key, {
              currentHP: newHP,
              maxHP: hp.maxHP,
            });
            return { capperHP: newCapperHP };
          });

          // CRITICAL: Also damage the Castle entity to trigger shield activation
          const castleId = `castle-${side}`;
          castleManager.damageCastle(castleId, actualDamage);
        }
      },

      // Apply damage to a defense dot
      // CRITICAL: This is the single source of truth for defense dot HP
      // When called, it immediately updates the dot's HP and alive status
      applyDamage: (dotId: string, damage: number) => {
        const dot = get().defenseDots.get(dotId);
        if (!dot) {
          console.warn(`⚠️ [STORE] Attempted to damage non-existent defense dot: ${dotId}`);
          return;
        }

        const hpBefore = dot.hp;
        const aliveBefore = dot.alive;

        // Apply damage to the dot (this updates hp and alive immediately)
        dot.takeDamage(damage);

        const hpAfter = dot.hp;
        const aliveAfter = dot.alive;

        // Check if this dot was just destroyed and if all dots in its row are now destroyed
        if (aliveBefore && !aliveAfter) {
          // Extract stat and side from dotId (format: "defense-{stat}-{side}-{index}")
          // Example: "defense-pts-left-0" or "game1-defense-pts-left-0"
          const parts = dotId.split('-');

          // Handle both formats: "defense-pts-left-0" and "game1-defense-pts-left-0"
          let stat: StatType;
          let side: 'left' | 'right';

          if (parts[0] === 'defense') {
            // Format: "defense-pts-left-0"
            stat = parts[1] as StatType;
            side = parts[2] as 'left' | 'right';
          } else if (parts[1] === 'defense') {
            // Format: "game1-defense-pts-left-0"
            stat = parts[2] as StatType;
            side = parts[3] as 'left' | 'right';
          } else {
            console.log(`❌ [PARSING ERROR] Could not parse dotId: ${dotId}`);
            return;
          }

          // Use setTimeout to ensure state has fully updated before checking
          setTimeout(() => {
            // Check if all dots in this stat row are destroyed
            const allDotsInRow = Array.from(get().defenseDots.values()).filter(
              d => d.stat === stat && d.side === side
            );
            const allDestroyed = allDotsInRow.every(d => !d.alive);

            if (allDestroyed) {
              console.log(`🔥🔥🔥 ALL ${stat.toUpperCase()} DEFENSE DOTS DESTROYED ON ${side.toUpperCase()} SIDE!`);

              // CRITICAL: When a team loses all defense dots in a row, THAT TEAM fires the Fire Orb
              // This is a "desperation attack" - you lost your defense, so you fire back!
              const firingSide = side; // The side that lost defense fires the Fire Orb

              // Check if the side that lost defense has Fire Orb equipped
              const game = get().games[0];
              if (game) {
                const capper = firingSide === 'left' ? game.leftCapper : game.rightCapper;
                const hasFireOrb = capper.equippedItems?.slot1 === 'fire-orb' ||
                  capper.equippedItems?.slot2 === 'fire-orb' ||
                  capper.equippedItems?.slot3 === 'fire-orb';

                if (hasFireOrb) {
                  console.log(`🔥🔥🔥 ${firingSide.toUpperCase()} side has Fire Orb! Triggering bonus attack!`);
                  get().triggerFireOrb(firingSide);
                }
              }
            }
          }, 10); // Small delay to ensure state is updated
        }

        // Trigger re-render by creating new Map
        // NOTE: The Map itself is new, but the defense dot objects are the SAME references
        // This means collision checks will see the updated HP values
        set(
          state => ({
            defenseDots: new Map(state.defenseDots),
          }),
          false,
          `applyDamage/${dotId}/${damage}`
        );

        // Verify the dot is still the same reference after the set
        const dotAfterSet = get().defenseDots.get(dotId);
        if (dotAfterSet === dot) {
          console.log(`✅ [STORE] Defense dot reference preserved after set`);
        } else {
          console.error(`❌ [STORE] Defense dot reference CHANGED after set! This is the bug!`);
        }
      },

      // Trigger Fire Orb effect when a stat row is fully destroyed
      triggerFireOrb: (side: 'left' | 'right') => {
        console.log(`🔥🔥🔥 FIRE ORB ACTIVATED for ${side} side!`);

        // Fire projectiles from all 5 stat rows (don't await - fire and forget)
        fireFireOrbProjectilesV4(side).catch(err => {
          console.error(`❌ Fire Orb error:`, err);
        });
      },

      // Set current quarter
      setCurrentQuarter: (quarter: number) => {
        set({ currentQuarter: quarter }, false, 'setCurrentQuarter');
      },

      // Update live score
      updateScore: (leftScore: number, rightScore: number) => {
        set(
          state => ({
            games: state.games.map(game => ({
              ...game,
              leftScore,
              rightScore,
            })),
          }),
          false,
          'updateScore'
        );
      },

      // Update game status
      updateGameStatus: (status: 'SCHEDULED' | '1Q' | '2Q' | '3Q' | '4Q' | 'OT' | 'OT2' | 'OT3' | 'OT4' | 'FINAL') => {
        set(
          state => ({
            games: state.games.map(game => ({
              ...game,
              status,
            })),
          }),
          false,
          'updateGameStatus'
        );
      },

      // Reset game to initial state
      resetGame: () => {
        // Clean up existing defense dots
        get().defenseDots.forEach(dot => dot.dispose());

        // Clean up projectiles
        get().projectiles.forEach(p => p.dispose());

        // Reset state
        set(
          {
            defenseDots: new Map(),
            projectiles: [],
            currentQuarter: 0,
          },
          false,
          'resetGame'
        );

        // Reinitialize
        get().initializeGame();
      },
    }),
    { name: 'BattleBets-GameStore' }
  )
);

