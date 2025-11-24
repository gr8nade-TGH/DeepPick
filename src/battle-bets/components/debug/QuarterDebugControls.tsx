/**
 * Quarter Debug Controls
 * Manual controls to force quarter progression for testing
 * Allows testing full game flow without waiting for real game times
 */

import React, { useState } from 'react';
import { useMultiGameStore } from '../../store/multiGameStore';
import { simulateQuarter } from '../../game/simulation/quarterSimulation';
import type { GameStatus } from '../../types/game';
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
      // STEP 1: Activate equipped items BEFORE battle starts
      console.log(`🎮 [PreGame] Activating equipped items for battle ${battleId}`);

      // Activate left side items
      for (const itemId of leftItems) {
        const rolled = rollTestItem(itemId);
        if (rolled) {
          await itemEffectRegistry.activateItem(battleId, 'left', rolled);
          console.log(`✅ [PreGame] Activated ${itemId} on LEFT side`);
        }
      }

      // Activate right side items
      for (const itemId of rightItems) {
        const rolled = rollTestItem(itemId);
        if (rolled) {
          await itemEffectRegistry.activateItem(battleId, 'right', rolled);
          console.log(`✅ [PreGame] Activated ${itemId} on RIGHT side`);
        }
      }

      console.log(`✅ [PreGame] All items activated!`);

      // STEP 2: Update status to Q1
      useMultiGameStore.getState().updateGameStatus(battleId, '1Q');
      useMultiGameStore.getState().setCurrentQuarter(battleId, 1);

      setLastAction('⏳ Simulating Q1...');

      // STEP 3: Simulate Q1 (this will generate stats and fire projectiles)
      await simulateQuarter(battleId, 1);

      // Check if game ended
      const updatedBattle = useMultiGameStore.getState().getBattle(battleId);
      const updatedLeftHP = updatedBattle?.capperHP.get('left')?.currentHP ?? 0;
      const updatedRightHP = updatedBattle?.capperHP.get('right')?.currentHP ?? 0;

      if (updatedLeftHP <= 0 || updatedRightHP <= 0) {
        useMultiGameStore.getState().updateGameStatus(battleId, 'FINAL');
        const winner = updatedLeftHP > 0 ? 'LEFT' : 'RIGHT';
        setLastAction(`✅ Q1 complete - ${winner} WINS!`);
      } else {
        setLastAction('✅ Q1 complete');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      setLastAction('❌ Failed to start game');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Force next quarter with random stats
   */
  const handleForceNextQuarter = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const nextQuarter = currentQuarter + 1;

      // Check if game is over
      if (leftHP <= 0 || rightHP <= 0) {
        setLastAction('❌ Game already over - castle destroyed');
        setIsProcessing(false);
        return;
      }

      // Check if we've exceeded 4 quarters (would need OT logic)
      if (nextQuarter > 4) {
        setLastAction('❌ Q4 complete - need OT logic');
        setIsProcessing(false);
        return;
      }

      setLastAction(`⏳ Simulating Q${nextQuarter}...`);

      // Update quarter number
      useMultiGameStore.getState().setCurrentQuarter(battleId, nextQuarter);

      // Update game status
      const statusMap: Record<number, GameStatus> = {
        1: '1Q',
        2: '2Q',
        3: '3Q',
        4: '4Q',
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
        const winner = updatedLeftHP > 0 ? 'LEFT' : 'RIGHT';
        setLastAction(`✅ Q${nextQuarter} complete - ${winner} WINS!`);
      } else {
        setLastAction(`✅ Q${nextQuarter} complete`);
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

  // Calculate position offset based on index
  const bottomOffset = 20 + (index * 450); // Stack vertically with 450px spacing (increased from 420)

  return (
    <div
      className="quarter-debug-controls"
      style={{
        bottom: bottomOffset,
        position: 'fixed',
        right: 20,
        zIndex: 9999 - index // Higher index = lower z-index so they stack properly
      }}
    >
      <div className="debug-header">
        <h3>🎮 Quarter Debug Controls {index + 1}</h3>
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
            disabled={isProcessing || currentQuarter >= 4}
          >
            ⚡ Force Q{currentQuarter + 1}
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

