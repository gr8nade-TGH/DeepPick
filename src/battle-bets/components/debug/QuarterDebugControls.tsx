/**
 * Quarter Debug Controls
 * Manual controls to force quarter progression for testing
 * Allows testing full game flow without waiting for real game times
 *
 * Flow: SCHEDULED → Q1_IN_PROGRESS → Q1_BATTLE → Q2_IN_PROGRESS → Q2_BATTLE →
 *       HALFTIME → Q3_IN_PROGRESS → Q3_BATTLE → Q4_IN_PROGRESS → Q4_BATTLE →
 *       [OT1_IN_PROGRESS → OT1_BATTLE → ...] → GAME_OVER
 */

import React, { useState } from 'react';
import { useMultiGameStore } from '../../store/multiGameStore';
import { simulateQuarter } from '../../game/simulation/quarterSimulation';
import type { GameStatus } from '../../types/game';
import type { BattleStatus } from '../../lib/BattleTimer';
import { getStatusDisplayText } from '../../lib/BattleTimer';
import './QuarterDebugControls.css';
import { PreGameItemSelector } from './PreGameItemSelector';
import { itemEffectRegistry } from '../../game/items/ItemEffectRegistry';
import { rollTestItem } from '../../game/items/ItemTestUtils';

interface QuarterDebugControlsProps {
  battleId: string;
  index?: number; // Index for positioning when multiple controls are shown
}

export const QuarterDebugControls: React.FC<QuarterDebugControlsProps> = ({ battleId, index = 0 }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [leftItems, setLeftItems] = useState<string[]>([]);
  const [rightItems, setRightItems] = useState<string[]>([]);

  const battle = useMultiGameStore(state => state.getBattle(battleId));

  // DEBUG: Log the index and position
  console.log(`🎮 QuarterDebugControls rendered: battleId=${battleId}, index=${index}, position=${index === 0 ? 'LEFT' : 'RIGHT'}`);

  if (!battle) return null;

  const currentQuarter = battle.currentQuarter;
  const gameStatus = battle.game.status || 'SCHEDULED';
  const leftHP = battle.capperHP.get('left')?.currentHP ?? 0;
  const rightHP = battle.capperHP.get('right')?.currentHP ?? 0;

  // Get team abbreviations for display
  const leftTeam = battle.game.awayTeam?.abbreviation || 'L';
  const rightTeam = battle.game.homeTeam?.abbreviation || 'R';

  /**
   * Force start the game (SCHEDULED → Q1)
   */
  const handleStartGame = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLastAction('Starting game...');

    try {
      // STEP 1: Deactivate any existing items for this battle (prevent duplicates)
      console.log(`🧹 [PreGame] Deactivating existing items for battle ${battleId}`);
      itemEffectRegistry.deactivateGame(battleId);

      // STEP 2: Activate equipped items BEFORE battle starts
      console.log(`🎮🎮🎮 [PreGame] Activating equipped items for battle ${battleId}`);

      // Get equipped items from battle state (saved by PreGameItemSelector)
      const currentBattle = useMultiGameStore.getState().getBattle(battleId);
      const leftEquipped = currentBattle?.game?.leftCapper?.equippedItems;
      const rightEquipped = currentBattle?.game?.rightCapper?.equippedItems;

      console.log(`🔍 [PreGame] Left equipped items:`, leftEquipped);
      console.log(`🔍 [PreGame] Right equipped items:`, rightEquipped);

      // Activate left side items
      if (leftEquipped) {
        for (const slot of ['slot1', 'slot2', 'slot3'] as const) {
          const item = leftEquipped[slot];
          if (item) {
            // Item can be either a string (item ID) or RolledItemStats object
            const rolled = typeof item === 'string' ? rollTestItem(item) : item;
            if (rolled) {
              await itemEffectRegistry.activateItem(battleId, 'left', rolled);
              console.log(`✅✅✅ [PreGame] Activated ${rolled.itemId} on LEFT ${slot}`);
            }
          }
        }
      }

      // Activate right side items
      if (rightEquipped) {
        for (const slot of ['slot1', 'slot2', 'slot3'] as const) {
          const item = rightEquipped[slot];
          if (item) {
            // Item can be either a string (item ID) or RolledItemStats object
            const rolled = typeof item === 'string' ? rollTestItem(item) : item;
            if (rolled) {
              await itemEffectRegistry.activateItem(battleId, 'right', rolled);
              console.log(`✅✅✅ [PreGame] Activated ${rolled.itemId} on RIGHT ${slot}`);
            }
          }
        }
      }

      console.log(`✅✅✅ [PreGame] All items activated!`);

      // STEP 3: Transition to Q1_IN_PROGRESS (awaiting stats from MySportsFeeds)
      // User will click "Force Q1" to trigger the actual battle
      useMultiGameStore.getState().updateGameStatus(battleId, '1Q');
      useMultiGameStore.getState().setCurrentQuarter(battleId, 1);
      useMultiGameStore.getState().updateBattleStatus(battleId, 'Q1_IN_PROGRESS');

      setLastAction('✅ Game started - Q1 In Progress (awaiting stats)');
    } catch (error) {
      console.error('Failed to start game:', error);
      setLastAction('❌ Failed to start game');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Get quarter label for display (includes OT)
   */
  const getQuarterLabel = (quarter: number): string => {
    if (quarter <= 4) return `Q${quarter}`;
    return `OT${quarter - 4}`;
  };

  /**
   * Force next quarter with random stats
   * Supports Q1-Q4 and OT1-OT4
   */
  const handleForceNextQuarter = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Get the current battle status to determine what quarter we're forcing
      const currentBattle = useMultiGameStore.getState().getBattle(battleId);
      const currentBattleStatus = currentBattle?.battleStatus || 'SCHEDULED';

      // Determine which quarter to run based on current status
      // If IN_PROGRESS, run that quarter's battle
      // If BATTLE just finished or first time, this shouldn't happen (Start Game should be clicked first)
      const battleStatusToQuarter: Record<BattleStatus, number> = {
        'SCHEDULED': 0,
        'Q1_IN_PROGRESS': 1,
        'Q1_BATTLE': 1,
        'Q2_IN_PROGRESS': 2,
        'Q2_BATTLE': 2,
        'HALFTIME': 2,
        'Q3_IN_PROGRESS': 3,
        'Q3_BATTLE': 3,
        'Q4_IN_PROGRESS': 4,
        'Q4_BATTLE': 4,
        'OT1_IN_PROGRESS': 5,
        'OT1_BATTLE': 5,
        'OT2_IN_PROGRESS': 6,
        'OT2_BATTLE': 6,
        'OT3_IN_PROGRESS': 7,
        'OT3_BATTLE': 7,
        'OT4_IN_PROGRESS': 8,
        'OT4_BATTLE': 8,
        'GAME_OVER': 0,
      };

      const nextQuarter = battleStatusToQuarter[currentBattleStatus] || currentQuarter + 1;

      // Check if game is over
      if (leftHP <= 0 || rightHP <= 0) {
        setLastAction('❌ Game already over - castle destroyed');
        setIsProcessing(false);
        return;
      }

      // Support up to Q4 + 4 OT periods = 8 total quarters
      if (nextQuarter > 8) {
        setLastAction('❌ Maximum overtime periods reached');
        setIsProcessing(false);
        return;
      }

      const quarterLabel = getQuarterLabel(nextQuarter);

      // Set status to BATTLE for this quarter
      const battleStatusMap: Record<number, BattleStatus> = {
        1: 'Q1_BATTLE',
        2: 'Q2_BATTLE',
        3: 'Q3_BATTLE',
        4: 'Q4_BATTLE',
        5: 'OT1_BATTLE',
        6: 'OT2_BATTLE',
        7: 'OT3_BATTLE',
        8: 'OT4_BATTLE',
      };
      useMultiGameStore.getState().updateBattleStatus(battleId, battleStatusMap[nextQuarter]);
      setLastAction(`⏳ ${quarterLabel} BATTLE...`);

      // Update quarter number
      useMultiGameStore.getState().setCurrentQuarter(battleId, nextQuarter);

      // Update game status based on quarter
      const statusMap: Record<number, GameStatus> = {
        1: '1Q',
        2: '2Q',
        3: '3Q',
        4: '4Q',
        5: 'OT',
        6: 'OT2',
        7: 'OT3',
        8: 'OT4',
      };
      useMultiGameStore.getState().updateGameStatus(battleId, statusMap[nextQuarter]);

      // Simulate the quarter (this will generate random stats and fire projectiles)
      await simulateQuarter(battleId, nextQuarter);

      // Check if game ended
      const updatedBattle = useMultiGameStore.getState().getBattle(battleId);
      const updatedLeftHP = updatedBattle?.capperHP.get('left')?.currentHP ?? 0;
      const updatedRightHP = updatedBattle?.capperHP.get('right')?.currentHP ?? 0;

      if (updatedLeftHP <= 0 || updatedRightHP <= 0) {
        useMultiGameStore.getState().updateGameStatus(battleId, 'FINAL');
        useMultiGameStore.getState().updateBattleStatus(battleId, 'GAME_OVER');
        const winner = updatedLeftHP > 0 ? 'LEFT' : 'RIGHT';
        setLastAction(`✅ ${quarterLabel} complete - ${winner} WINS!`);
      } else {
        // After battle, transition to next IN_PROGRESS state
        const nextInProgressMap: Record<number, BattleStatus> = {
          1: 'Q2_IN_PROGRESS',
          2: 'HALFTIME',  // After Q2 battle, go to halftime
          3: 'Q4_IN_PROGRESS',
          4: 'GAME_OVER', // TODO: Check for OT
          5: 'OT2_IN_PROGRESS',
          6: 'OT3_IN_PROGRESS',
          7: 'OT4_IN_PROGRESS',
          8: 'GAME_OVER',
        };
        useMultiGameStore.getState().updateBattleStatus(battleId, nextInProgressMap[nextQuarter]);
        setLastAction(`✅ ${quarterLabel} complete`);
      }
    } catch (error) {
      console.error('Failed to force quarter:', error);
      setLastAction('❌ Failed to simulate quarter');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Reset game to initial state
   */
  const handleResetGame = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLastAction('Resetting game...');

    try {
      // Reset to initial state
      useMultiGameStore.getState().setCurrentQuarter(battleId, 0);
      useMultiGameStore.getState().updateGameStatus(battleId, 'SCHEDULED');

      // Reinitialize HP
      useMultiGameStore.getState().initializeCapperHP(battleId);

      // Reinitialize defense dots
      useMultiGameStore.getState().initializeDefenseDots(battleId);

      setLastAction('✅ Game reset to SCHEDULED');
    } catch (error) {
      console.error('Failed to reset game:', error);
      setLastAction('❌ Failed to reset game');
    } finally {
      setIsProcessing(false);
    }
  };

  // Position: index 0 = LEFT side, index 1 = RIGHT side
  const positionStyle = index === 0
    ? { left: '20px' }
    : { right: '20px' };

  return (
    <div
      className="quarter-debug-controls"
      style={{
        position: 'fixed',
        bottom: '20px',
        ...positionStyle,
        zIndex: 9999
      }}
    >
      <div className="debug-header">
        <h3>🎮 {leftTeam} vs {rightTeam} - Control #{index + 1}</h3>
        <div className="debug-status">
          <span className="status-badge">{gameStatus}</span>
          <span className="quarter-badge">Q{currentQuarter}</span>
        </div>
      </div>

      <div className="debug-info">
        <div className="hp-display">
          <div className="hp-bar left">
            <span className="hp-label">LEFT HP:</span>
            <span className="hp-value">{leftHP}</span>
          </div>
          <div className="hp-bar right">
            <span className="hp-label">RIGHT HP:</span>
            <span className="hp-value">{rightHP}</span>
          </div>
        </div>
      </div>

      <div className="debug-actions">
        {gameStatus === 'SCHEDULED' && (
          <button
            className="debug-btn start-btn"
            onClick={handleStartGame}
            disabled={isProcessing}
          >
            🎬 Start Game (→ Q1)
          </button>
        )}

        {gameStatus !== 'SCHEDULED' && gameStatus !== 'FINAL' && (
          <button
            className="debug-btn force-btn"
            onClick={handleForceNextQuarter}
            disabled={isProcessing || currentQuarter >= 8}
          >
            ⚡ Force {getQuarterLabel(currentQuarter + 1)}
          </button>
        )}

        <button
          className="debug-btn reset-btn"
          onClick={handleResetGame}
          disabled={isProcessing}
        >
          🔄 Reset Game
        </button>
      </div>

      {lastAction && (
        <div className="debug-feedback">
          {lastAction}
        </div>
      )}
    </div>
  );
};

