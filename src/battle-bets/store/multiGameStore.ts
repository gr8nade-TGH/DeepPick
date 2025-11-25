/**
 * Multi-Game Battle Store
 * 
 * Manages multiple simultaneous battles (up to 4 per page)
 * Each battle has its own state: game data, HP, defense dots, projectiles
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DefenseDot } from '../game/entities/DefenseDot';
import { BaseProjectile } from '../game/entities/projectiles/BaseProjectile';
import type { Game, StatType } from '../types/game';
import {
  getTotalDefenseDotCount,
  getCapperUnitsForTeam,
  getDefenseCellId,
  distributeDotsAcrossStats
} from '../types/game';
import { castleManager } from '../game/managers/CastleManager';
import { getDefenseCellPosition } from '../game/utils/positioning';
import { debugLogger } from '../game/debug/DebugLogger';
import { itemEffectRegistry } from '../game/items/ItemEffectRegistry';
import { rollTestItem } from '../game/items/ItemTestUtils';
import { attackNodeQueueManager } from '../game/managers/AttackNodeQueueManager';

/**
 * State for a single battle
 */
export interface BattleState {
  game: Game;
  currentQuarter: number;
  capperHP: Map<string, { currentHP: number; maxHP: number }>; // Key: "side" (e.g., "left", "right")
  defenseDots: Map<string, DefenseDot>;
  projectiles: BaseProjectile[];
  isBattleInProgress: boolean; // True when battle animation is running
  completedQuarters: number[]; // Array of completed quarter numbers [1, 2, 3, 4]
}

/**
 * Multi-game store state
 */
interface MultiGameState {
  // Map of battleId → BattleState
  battles: Map<string, BattleState>;

  // Actions
  initializeBattle: (battleId: string, game: Game) => void;
  getBattle: (battleId: string) => BattleState | undefined;
  initializeCapperHP: (battleId: string) => void;
  initializeDefenseDots: (battleId: string) => void;
  addProjectile: (battleId: string, projectile: BaseProjectile) => void;
  removeProjectile: (battleId: string, id: string) => void;
  applyDamageToCapperHP: (battleId: string, side: 'left' | 'right', damage: number) => void;
  applyDamage: (battleId: string, dotId: string, damage: number) => void;
  setCurrentQuarter: (battleId: string, quarter: number) => void;
  updateScore: (battleId: string, leftScore: number, rightScore: number) => void;
  updateGameStatus: (battleId: string, status: Game['status']) => void;
  setBattleInProgress: (battleId: string, inProgress: boolean) => void;
  markQuarterComplete: (battleId: string, quarter: number) => void;
  updateBattle: (battleId: string, updater: (battle: BattleState) => BattleState) => void;
  resetBattle: (battleId: string) => void;
  resetAllBattles: () => void;
}

export const useMultiGameStore = create<MultiGameState>()(
  devtools(
    (set, get) => ({
      // Initial state
      battles: new Map(),

      // Get a specific battle
      getBattle: (battleId: string) => {
        return get().battles.get(battleId);
      },

      // Initialize a single battle
      initializeBattle: (battleId: string, game: Game) => {
        console.log(`[Multi-Game Store] Initializing battle: ${battleId}`);

        const battleState: BattleState = {
          game,
          currentQuarter: 0,
          capperHP: new Map(),
          defenseDots: new Map(),
          projectiles: [],
          isBattleInProgress: false,
          completedQuarters: []
        };

        set(state => {
          const newBattles = new Map(state.battles);
          newBattles.set(battleId, battleState);
          return { battles: newBattles };
        });

        // Initialize HP and defense dots for this battle
        get().initializeCapperHP(battleId);
        get().initializeDefenseDots(battleId);

        // Auto-activate equipped items
        activateEquippedItems(battleId, game);
      },

      // Initialize capper HP for a battle
      initializeCapperHP: (battleId: string) => {
        const battle = get().battles.get(battleId);
        if (!battle) {
          console.warn(`[Multi-Game Store] Battle not found: ${battleId}`);
          return;
        }

        const { game } = battle;
        const capperHP = new Map<string, { currentHP: number; maxHP: number }>();

        // FIXED: Castle HP is always 20 for both teams
        // Units only determine defense orb count, not castle HP
        const CASTLE_HP = 20;

        capperHP.set('left', {
          currentHP: CASTLE_HP,
          maxHP: CASTLE_HP,
        });

        capperHP.set('right', {
          currentHP: CASTLE_HP,
          maxHP: CASTLE_HP,
        });

        // Update battle state
        set(state => {
          const newBattles = new Map(state.battles);
          const updatedBattle = newBattles.get(battleId);
          if (updatedBattle) {
            updatedBattle.capperHP = capperHP;
          }
          return { battles: newBattles };
        });

        console.log(`[Multi-Game Store] Initialized HP for ${battleId}:`);
        console.log(`  ${game.leftCapper.name}: ${CASTLE_HP} HP (fixed)`);
        console.log(`  ${game.rightCapper.name}: ${CASTLE_HP} HP (fixed)`);
      },

      // Initialize defense dots for a battle
      initializeDefenseDots: (battleId: string) => {
        const battle = get().battles.get(battleId);
        if (!battle) {
          console.warn(`[Multi-Game Store] Battle not found: ${battleId}`);
          return;
        }

        const { game } = battle;
        const defenseDots = new Map<string, DefenseDot>();
        const stats: StatType[] = ['pts', 'reb', 'ast', 'stl', '3pt'];
        const sides: ('left' | 'right')[] = ['left', 'right'];

        sides.forEach(side => {
          const team = side === 'left' ? game.leftTeam : game.rightTeam;
          const capper = side === 'left' ? game.leftCapper : game.rightCapper;

          // Get capper's TOTAL unit record for this team
          const units = getCapperUnitsForTeam(capper, team.id);
          const totalDots = getTotalDefenseDotCount(units);
          const distributionArray = distributeDotsAcrossStats(totalDots);

          // Convert array to Record for easier access
          const distribution: Record<StatType, number> = {
            pts: distributionArray[0],
            reb: distributionArray[1],
            ast: distributionArray[2],
            stl: distributionArray[3],
            '3pt': distributionArray[4],
          };

          console.log(`[Multi-Game Store] ${capper.name} has ${units} units on ${team.abbreviation} = ${totalDots} defense dots`);
          console.log(`[Multi-Game Store] Distribution:`, distribution);

          // Create ALL defense dots across all cells (no animation for now)
          stats.forEach((stat) => {
            const dotsForStat = distribution[stat];

            console.log(`[Multi-Game Store] Creating ${dotsForStat} dots for ${stat} on ${side} side`);

            // Create dots from cell #1 to cell #dotsForStat
            for (let cellNumber = 1; cellNumber <= dotsForStat; cellNumber++) {
              const is3ptRow = stat === '3pt';
              const cellId = getDefenseCellId(stat, side, cellNumber);
              const id = `${battleId}-${cellId}`;

              const position = getDefenseCellPosition(stat, side, cellNumber);

              console.log(`[Multi-Game Store]   Cell #${cellNumber}: ID=${cellId}, X=${position.x.toFixed(1)}, Y=${position.y.toFixed(1)}`);

              const dot = new DefenseDot({
                id,
                gameId: battleId,
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
            }
          });
        });

        // Update battle state
        set(state => {
          const newBattles = new Map(state.battles);
          const updatedBattle = newBattles.get(battleId);
          if (updatedBattle) {
            updatedBattle.defenseDots = defenseDots;
          }
          return { battles: newBattles };
        });

        console.log(`[Multi-Game Store] Initialized ${defenseDots.size} defense dots for ${battleId}`);
      },

      // Add a projectile to a battle
      addProjectile: (battleId: string, projectile: BaseProjectile) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            battle.projectiles = [...battle.projectiles, projectile];
          }
          return { battles: newBattles };
        });
      },

      // Remove a projectile from a battle
      removeProjectile: (battleId: string, id: string) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            battle.projectiles = battle.projectiles.filter(p => p.id !== id);
          }
          return { battles: newBattles };
        });
      },

      // Apply damage to capper HP
      applyDamageToCapperHP: (battleId: string, side: 'left' | 'right', damage: number) => {
        const logMsg = `Called with battleId=${battleId}, side=${side}, damage=${damage}`;
        console.log(`🏰 [applyDamageToCapperHP] ${logMsg}`);
        debugLogger.log('store-hp', `applyDamageToCapperHP: ${logMsg}`);

        const battle = get().battles.get(battleId);
        if (!battle) {
          const errMsg = `No battle found for battleId=${battleId}`;
          console.error(`❌ [applyDamageToCapperHP] ${errMsg}`);
          debugLogger.log('store-hp', `ERROR: ${errMsg}`);
          return;
        }

        const hp = battle.capperHP.get(side);
        if (!hp) {
          const warnMsg = `No HP tracking found for ${battleId}-${side}`;
          console.warn(`⚠️ [applyDamageToCapperHP] ${warnMsg}`);
          debugLogger.log('store-hp', `WARNING: ${warnMsg}`);
          return;
        }

        const hpMsg = `Current HP for ${side}: ${hp.currentHP}/${hp.maxHP}`;
        console.log(`🏰 [applyDamageToCapperHP] ${hpMsg}`);
        debugLogger.log('store-hp', hpMsg);

        const newHP = Math.max(0, hp.currentHP - damage);
        const actualDamage = hp.currentHP - newHP;

        if (actualDamage > 0) {
          const capperName = side === 'left' ? battle.game.leftCapper.name : battle.game.rightCapper.name;
          const damageMsg = `${capperName} HP: ${hp.currentHP} → ${newHP} (-${actualDamage})`;
          console.log(`💥 [Multi-Game Store] ${damageMsg}`);
          debugLogger.log('store-hp', damageMsg, { battleId, side, oldHP: hp.currentHP, newHP, actualDamage });

          if (newHP === 0) {
            const defeatMsg = `${capperName} HAS BEEN DEFEATED!`;
            console.log(`☠️ [Multi-Game Store] ${defeatMsg}`);
            debugLogger.log('store-hp', defeatMsg);
          }

          // Update HP in store
          set(state => {
            const newBattles = new Map(state.battles);
            const updatedBattle = newBattles.get(battleId);
            if (updatedBattle) {
              const newCapperHP = new Map(updatedBattle.capperHP);
              newCapperHP.set(side, {
                currentHP: newHP,
                maxHP: hp.maxHP,
              });
              updatedBattle.capperHP = newCapperHP;
              const updateMsg = `HP updated in store for ${side}: ${newHP}/${hp.maxHP}`;
              console.log(`✅ [applyDamageToCapperHP] ${updateMsg}`);
              debugLogger.log('store-hp', updateMsg);
            }
            return { battles: newBattles };
          });

          // CRITICAL: Also damage the Castle entity to update visual HP bar
          const castleId = `${battleId}-${side}`;
          castleManager.damageCastle(battleId, castleId, actualDamage);
          const castleMsg = `Called castleManager.damageCastle(battleId=${battleId}, castleId=${castleId}, damage=${actualDamage})`;
          console.log(`🏰 [applyDamageToCapperHP] ${castleMsg}`);
          debugLogger.log('store-hp', castleMsg);
        } else {
          const noOpMsg = 'No actual damage applied (already at 0 HP or invalid damage)';
          console.log(`⚠️ [applyDamageToCapperHP] ${noOpMsg}`);
          debugLogger.log('store-hp', noOpMsg);
        }
      },

      // Apply damage to a defense dot
      applyDamage: (battleId: string, dotId: string, damage: number) => {
        const battle = get().battles.get(battleId);
        if (!battle) return;

        const dot = battle.defenseDots.get(dotId);
        if (!dot) {
          console.warn(`[Multi-Game Store] Defense dot not found: ${dotId}`);
          return;
        }

        // Apply damage to the dot
        dot.takeDamage(damage);

        // Trigger re-render
        set(state => {
          const newBattles = new Map(state.battles);
          const updatedBattle = newBattles.get(battleId);
          if (updatedBattle) {
            updatedBattle.defenseDots = new Map(updatedBattle.defenseDots);
          }
          return { battles: newBattles };
        });
      },

      // Set current quarter for a battle
      setCurrentQuarter: (battleId: string, quarter: number) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            battle.currentQuarter = quarter;
          }
          return { battles: newBattles };
        });
      },

      // Update score for a battle
      updateScore: (battleId: string, leftScore: number, rightScore: number) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            battle.game.leftScore = leftScore;
            battle.game.rightScore = rightScore;
          }
          return { battles: newBattles };
        });
      },

      // Update game status for a battle
      updateGameStatus: (battleId: string, status: Game['status']) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            battle.game.status = status;
          }
          return { battles: newBattles };
        });
      },

      // Set battle in progress state
      setBattleInProgress: (battleId: string, inProgress: boolean) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            battle.isBattleInProgress = inProgress;
          }
          return { battles: newBattles };
        });
      },

      // Mark a quarter as complete
      markQuarterComplete: (battleId: string, quarter: number) => {
        set(state => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle && !battle.completedQuarters.includes(quarter)) {
            battle.completedQuarters = [...battle.completedQuarters, quarter];
          }
          return { battles: newBattles };
        });
      },

      // Update battle with custom updater function
      updateBattle: (battleId: string, updater: (battle: BattleState) => BattleState) => {
        set((state) => {
          const newBattles = new Map(state.battles);
          const battle = newBattles.get(battleId);
          if (battle) {
            const updatedBattle = updater(battle);
            newBattles.set(battleId, updatedBattle);
          }
          return { battles: newBattles };
        });
      },

      // Reset a single battle
      resetBattle: (battleId: string) => {
        const battle = get().battles.get(battleId);
        if (!battle) return;

        // Clean up defense dots
        battle.defenseDots.forEach(dot => dot.dispose());

        // Clean up projectiles
        battle.projectiles.forEach(p => p.dispose());

        // Clear attack node queues for this battle
        attackNodeQueueManager.clearGame(battleId);

        // Remove battle from map
        set(state => {
          const newBattles = new Map(state.battles);
          newBattles.delete(battleId);
          return { battles: newBattles };
        });
      },

      // Reset all battles
      resetAllBattles: () => {
        const battles = get().battles;

        // Clean up all battles
        battles.forEach((battle, battleId) => {
          battle.defenseDots.forEach(dot => dot.dispose());
          battle.projectiles.forEach(p => p.dispose());
          // Clear attack node queues for each battle
          attackNodeQueueManager.clearGame(battleId);
        });

        // Clear all battles
        set({ battles: new Map() });
      },
    }),
    { name: 'BattleBets-MultiGameStore' }
  )
);

/**
 * Helper function to activate equipped items for a battle
 */
async function activateEquippedItems(battleId: string, game: Game): Promise<void> {
  console.log(`🎮 [Items] Activating equipped items for battle ${battleId}`);
  console.log(`🔍 [Items] Left capper equipped items:`, JSON.stringify(game.leftCapper.equippedItems));
  console.log(`🔍 [Items] Right capper equipped items:`, JSON.stringify(game.rightCapper.equippedItems));

  // Left side items
  const leftItems = game.leftCapper.equippedItems;
  if (leftItems) {
    if (leftItems.slot1) {
      const rolled = rollTestItem(leftItems.slot1);
      if (rolled) {
        await itemEffectRegistry.activateItem(battleId, 'left', rolled);
        console.log(`✅ [Items] Activated ${leftItems.slot1} on LEFT slot1`);
      }
    }
    if (leftItems.slot2) {
      const rolled = rollTestItem(leftItems.slot2);
      if (rolled) {
        await itemEffectRegistry.activateItem(battleId, 'left', rolled);
        console.log(`✅ [Items] Activated ${leftItems.slot2} on LEFT slot2`);
      }
    }
    if (leftItems.slot3) {
      const rolled = rollTestItem(leftItems.slot3);
      if (rolled) {
        await itemEffectRegistry.activateItem(battleId, 'left', rolled);
        console.log(`✅ [Items] Activated ${leftItems.slot3} on LEFT slot3`);
      }
    }
  }

  // Right side items
  const rightItems = game.rightCapper.equippedItems;
  if (rightItems) {
    if (rightItems.slot1) {
      const rolled = rollTestItem(rightItems.slot1);
      if (rolled) {
        await itemEffectRegistry.activateItem(battleId, 'right', rolled);
        console.log(`✅ [Items] Activated ${rightItems.slot1} on RIGHT slot1`);
      }
    }
    if (rightItems.slot2) {
      const rolled = rollTestItem(rightItems.slot2);
      if (rolled) {
        await itemEffectRegistry.activateItem(battleId, 'right', rolled);
        console.log(`✅ [Items] Activated ${rightItems.slot2} on RIGHT slot2`);
      }
    }
    if (rightItems.slot3) {
      const rolled = rollTestItem(rightItems.slot3);
      if (rolled) {
        await itemEffectRegistry.activateItem(battleId, 'right', rolled);
        console.log(`✅ [Items] Activated ${rightItems.slot3} on RIGHT slot3`);
      }
    }
  }

  console.log(`✅ [Items] All equipped items activated for battle ${battleId}`);
}

