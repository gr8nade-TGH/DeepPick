/**
 * Test Controls Component
 * Provides UI controls for running test games with realistic NBA stats
 */

import React, { useState } from 'react';
import { runTestGame, printGameResults, getQuarterDataForSimulation } from '../../game/utils/testGameRunner';
import { runQuarterSimulation } from '../../game/simulation/quarterSimulation';
import type { GameSimulationResult } from '../../game/utils/testGameRunner';

export const TestControls: React.FC = () => {
  const [gameData, setGameData] = useState<GameSimulationResult | null>(null);
  const [currentQuarter, setCurrentQuarter] = useState<1 | 2 | 3 | 4>(1);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleGenerateGame = () => {
    const result = runTestGame();
    printGameResults(result);
    setGameData(result);
    setCurrentQuarter(1);
    console.log('✅ Game data generated! Use "Run Quarter" to simulate each quarter.');
  };

  const handleRunQuarter = async () => {
    if (!gameData) {
      console.error('❌ No game data! Generate a game first.');
      return;
    }

    if (isSimulating) {
      console.warn('⚠️ Simulation already in progress...');
      return;
    }

    setIsSimulating(true);

    try {
      const quarterData = getQuarterDataForSimulation(gameData.gameData, currentQuarter);
      
      console.log(`\n🏀 RUNNING Q${currentQuarter} SIMULATION`);
      console.log(`Team 1: PTS ${quarterData.left.points} | REB ${quarterData.left.rebounds} | AST ${quarterData.left.assists} | BLK ${quarterData.left.blocks} | 3PM ${quarterData.left.threePointers}`);
      console.log(`Team 2: PTS ${quarterData.right.points} | REB ${quarterData.right.rebounds} | AST ${quarterData.right.assists} | BLK ${quarterData.right.blocks} | 3PM ${quarterData.right.threePointers}\n`);

      await runQuarterSimulation(quarterData.left, quarterData.right, 'game1');

      console.log(`✅ Q${currentQuarter} simulation complete!`);

      // Auto-advance to next quarter
      if (currentQuarter < 4) {
        setCurrentQuarter((prev) => (prev + 1) as 1 | 2 | 3 | 4);
      } else {
        console.log('🏁 GAME COMPLETE!');
      }
    } catch (error) {
      console.error('❌ Quarter simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRunFullGame = async () => {
    if (!gameData) {
      console.error('❌ No game data! Generate a game first.');
      return;
    }

    if (isSimulating) {
      console.warn('⚠️ Simulation already in progress...');
      return;
    }

    setIsSimulating(true);

    try {
      console.log('\n🏀 RUNNING FULL GAME SIMULATION (ALL 4 QUARTERS)\n');

      for (let q = 1; q <= 4; q++) {
        const quarter = q as 1 | 2 | 3 | 4;
        setCurrentQuarter(quarter);

        const quarterData = getQuarterDataForSimulation(gameData.gameData, quarter);
        
        console.log(`\n--- Q${quarter} ---`);
        console.log(`Team 1: PTS ${quarterData.left.points} | REB ${quarterData.left.rebounds} | AST ${quarterData.left.assists} | BLK ${quarterData.left.blocks} | 3PM ${quarterData.left.threePointers}`);
        console.log(`Team 2: PTS ${quarterData.right.points} | REB ${quarterData.right.rebounds} | AST ${quarterData.right.assists} | BLK ${quarterData.right.blocks} | 3PM ${quarterData.right.threePointers}\n`);

        await runQuarterSimulation(quarterData.left, quarterData.right, 'game1');

        console.log(`✅ Q${quarter} complete!`);

        // Small delay between quarters
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('\n🏁 FULL GAME SIMULATION COMPLETE!');
      console.log(`Final Score: Team 1 ${gameData.finalScore.team1} - Team 2 ${gameData.finalScore.team2}`);
      console.log(`Winner: ${gameData.winner.toUpperCase()}\n`);
    } catch (error) {
      console.error('❌ Full game simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.85)',
      border: '2px solid #FFD700',
      borderRadius: '8px',
      padding: '16px',
      color: '#FFFFFF',
      fontFamily: 'monospace',
      fontSize: '14px',
      zIndex: 1000,
      minWidth: '280px',
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#FFD700', fontSize: '16px' }}>
        🏀 Test Controls
      </h3>

      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={handleGenerateGame}
          disabled={isSimulating}
          style={{
            width: '100%',
            padding: '8px',
            background: '#4ECDC4',
            border: 'none',
            borderRadius: '4px',
            color: '#000',
            fontWeight: 'bold',
            cursor: isSimulating ? 'not-allowed' : 'pointer',
            opacity: isSimulating ? 0.5 : 1,
          }}
        >
          Generate New Game
        </button>
      </div>

      {gameData && (
        <>
          <div style={{ marginBottom: '8px', fontSize: '12px', color: '#AAA' }}>
            Current Quarter: <strong style={{ color: '#FFD700' }}>Q{currentQuarter}</strong>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <button
              onClick={handleRunQuarter}
              disabled={isSimulating}
              style={{
                width: '100%',
                padding: '8px',
                background: '#FF6B35',
                border: 'none',
                borderRadius: '4px',
                color: '#FFF',
                fontWeight: 'bold',
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                opacity: isSimulating ? 0.5 : 1,
              }}
            >
              {isSimulating ? 'Simulating...' : `Run Q${currentQuarter}`}
            </button>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={handleRunFullGame}
              disabled={isSimulating}
              style={{
                width: '100%',
                padding: '8px',
                background: '#F7B731',
                border: 'none',
                borderRadius: '4px',
                color: '#000',
                fontWeight: 'bold',
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                opacity: isSimulating ? 0.5 : 1,
              }}
            >
              {isSimulating ? 'Simulating...' : 'Run Full Game'}
            </button>
          </div>

          <div style={{ fontSize: '11px', color: '#888', borderTop: '1px solid #444', paddingTop: '8px' }}>
            <div>Team 1: {gameData.finalScore.team1} pts</div>
            <div>Team 2: {gameData.finalScore.team2} pts</div>
            <div style={{ color: '#FFD700', marginTop: '4px' }}>
              Winner: {gameData.winner.toUpperCase()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

