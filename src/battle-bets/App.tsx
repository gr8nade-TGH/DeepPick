/**
 * Battle Bets V3 - Main Application Component
 */

import { useEffect, useState } from 'react';
import { BattleCanvas } from './components/game/BattleCanvas';
import { GameInfoBar } from './components/game/GameInfoBar';
import { useGameStore } from './store/gameStore';
import { simulateQuarter, fireStatRow } from './game/simulation/quarterSimulation';
import { simulateFullBattle } from './game/simulation/battleSimulation';
import { GameErrorBoundary } from './components/ErrorBoundary';
import { PerformanceMonitor } from './components/debug/PerformanceMonitor';
import { CastleDebugPanel } from './components/debug/CastleDebugPanel';
import { getCapperUnitsForTeam, formatUnitRecord, getTotalDefenseDotCount } from './types/game';
import type { Game, StatType } from './types/game';
import { castleManager } from './game/managers/CastleManager';
import './App.css';

function App() {
  const initializeGame = useGameStore(state => state.initializeGame);
  const resetGame = useGameStore(state => state.resetGame);
  const currentQuarter = useGameStore(state => state.currentQuarter);
  const setCurrentQuarter = useGameStore(state => state.setCurrentQuarter);
  const games = useGameStore(state => state.games);
  const defenseDots = useGameStore(state => state.defenseDots);
  const projectiles = useGameStore(state => state.projectiles);
  const capperHP = useGameStore(state => state.capperHP);

  const [isSimulating, setIsSimulating] = useState(false);
  const [battleResult, setBattleResult] = useState<{ winner: 'left' | 'right' | 'draw'; quarterEnded: number } | null>(null);

  // Initialize game on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const handleSimulateQuarter = async (quarter: number) => {
    setCurrentQuarter(quarter);
    console.log(`🎮 Simulating Quarter ${quarter}`);

    try {
      // Run the simulation
      await simulateQuarter(quarter);
      console.log(`✅ Quarter ${quarter} simulation completed successfully`);
    } catch (error) {
      console.error(`❌ Error simulating quarter ${quarter}:`, error);
    }
  };

  const handleSimulateBattle = async () => {
    if (isSimulating) return;

    setIsSimulating(true);
    setBattleResult(null);
    console.log('🎮 Starting full battle simulation...');

    try {
      // Run the full 4-quarter battle simulation
      // (Orb distribution animation happens before each quarter inside simulateFullBattle)
      const result = await simulateFullBattle();
      setBattleResult(result);
      console.log(`✅ Battle completed! Winner: ${result.winner}, Ended in Q${result.quarterEnded}`);
    } catch (error) {
      console.error('❌ Error simulating battle:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTestBlueOrbShield = () => {
    console.log('🛡️ Testing Blue Orb Shield...');

    // Get the left castle from CastleManager
    const leftCastle = castleManager.getCastle('castle-left');
    if (leftCastle) {
      const currentHP = leftCastle.getCurrentHP();
      const equippedItems = leftCastle.getEquippedItems();
      console.log(`Current HP: ${currentHP}`);
      console.log(`Equipped items:`, equippedItems);

      // Damage castle to HP = 2 (below threshold of 3), but only apply 3 damage so shield survives
      const damageNeeded = Math.min(currentHP - 2, 3); // Max 3 damage so shield (5 HP) survives
      if (damageNeeded > 0) {
        console.log(`💥 Applying ${damageNeeded} damage to trigger shield (shield will survive with ${5 - damageNeeded} HP)...`);
        leftCastle.takeDamage(damageNeeded);

        // Check shield state after damage
        setTimeout(() => {
          const shieldState = leftCastle.getShieldState();
          const newHP = leftCastle.getCurrentHP();
          console.log(`🛡️ Shield state after damage:`, shieldState);
          console.log(`💚 Castle HP after damage: ${newHP}`);
          if (shieldState) {
            console.log(`✅ Shield activated! HP: ${shieldState.currentHP}/${shieldState.maxHP}`);
          } else {
            console.log(`❌ Shield did not activate`);
          }
        }, 100);
      } else {
        console.log('⚠️ Castle HP already below 3');
        // Try to activate shield anyway
        leftCastle.takeDamage(1);
      }
    } else {
      console.error('❌ Left castle not found. Make sure the game has loaded first.');
    }
  };

  const handleTestFireOrb = async () => {
    console.log('🔴 Testing Fire Orb...');
    console.log('🔥🔥🔥 [APP VERSION 4.0-FINAL - FUNCTION RENAMED] Fire Orb test starting...');

    // Trigger Fire Orb effect for left side
    const store = useGameStore.getState();
    await store.triggerFireOrb('left');

    console.log('✅ Fire Orb test complete!');
  };

  const handleReset = () => {
    setBattleResult(null);
    setIsSimulating(false);
    resetGame();
  };

  const handleDebug = () => {
    console.clear();
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 BATTLE BETS V3 - COMPREHENSIVE DEBUG INFO');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. Game State
    console.log('📊 GAME STATE:');
    console.log(`   Total Games: ${games.length}`);
    if (games.length > 0) {
      const game = games[0];
      console.log(`   Game ID: ${game.id}`);
      console.log(`   Left Team: ${game.leftTeam.name} (${game.leftTeam.abbreviation})`);
      console.log(`   Right Team: ${game.rightTeam.name} (${game.rightTeam.abbreviation})`);
      console.log(`   Left Capper: ${game.leftCapper.name}`);
      console.log(`   Right Capper: ${game.rightCapper.name}`);
      console.log(`   Current Quarter: ${currentQuarter}`);
    } else {
      console.log('   ⚠️ NO GAMES FOUND!');
    }

    // 2. Defense Dots
    console.log('\n🛡️ DEFENSE DOTS:');
    console.log(`   Total Defense Dots: ${defenseDots.size}`);

    const leftDots = Array.from(defenseDots.values()).filter(d => d.side === 'left');
    const rightDots = Array.from(defenseDots.values()).filter(d => d.side === 'right');
    const aliveDots = Array.from(defenseDots.values()).filter(d => d.alive);

    console.log(`   Left Side: ${leftDots.length} dots`);
    console.log(`   Right Side: ${rightDots.length} dots`);
    console.log(`   Alive: ${aliveDots.length} dots`);
    console.log(`   Dead: ${defenseDots.size - aliveDots.length} dots`);

    // Group by stat
    const stats = ['points', 'reb', 'ast', 'fire', 'shield'];
    stats.forEach(stat => {
      const statDots = Array.from(defenseDots.values()).filter(d => d.stat === stat);
      const leftStatDots = statDots.filter(d => d.side === 'left' && d.alive);
      const rightStatDots = statDots.filter(d => d.side === 'right' && d.alive);
      console.log(`   ${stat.toUpperCase()}: Left=${leftStatDots.length}, Right=${rightStatDots.length}`);
    });

    // 3. Projectiles
    console.log('\n🎯 PROJECTILES:');
    console.log(`   Total Active Projectiles: ${projectiles.length}`);
    if (projectiles.length > 0) {
      projectiles.forEach((proj) => {
        console.log(`   - ${proj.id}: ${proj.stat} from ${proj.side} (active: ${proj.active})`);
      });
    }

    // 4. Store Functions
    console.log('\n⚙️ STORE FUNCTIONS:');
    const store = useGameStore.getState();
    console.log(`   initializeGame: ${typeof store.initializeGame}`);
    console.log(`   initializeDefenseDots: ${typeof store.initializeDefenseDots}`);
    console.log(`   addProjectile: ${typeof store.addProjectile}`);
    console.log(`   removeProjectile: ${typeof store.removeProjectile}`);
    console.log(`   applyDamage: ${typeof store.applyDamage}`);

    // 5. Simulation Function
    console.log('\n🎮 SIMULATION:');
    console.log(`   simulateQuarter function: ${typeof simulateQuarter}`);

    // 6. Test Quarter Data
    console.log('\n📋 TEST QUARTER DATA (Q1):');
    console.log('   Left (Lakers): 28 PTS, 12 REB, 7 AST');
    console.log('   Right (Grizzlies): 24 PTS, 10 REB, 6 AST');
    console.log('   Expected Collisions:');
    console.log('      POINTS: 24 collisions, 4 Lakers projectiles hit');
    console.log('      REB: 10 collisions, 2 Lakers projectiles hit');
    console.log('      AST: 6 collisions, 1 Lakers projectile hits');

    // 7. Canvas Info
    console.log('\n🖼️ CANVAS INFO:');
    const canvas = document.querySelector('canvas');
    if (canvas) {
      console.log(`   Canvas found: ${canvas.width}x${canvas.height}`);
      console.log(`   Canvas parent: ${canvas.parentElement?.tagName}`);
    } else {
      console.log('   ⚠️ NO CANVAS FOUND!');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Debug info complete! Check console above.');
    console.log('═══════════════════════════════════════════════════════\n');
  };

  // Helper function to format pick (e.g., "LAL -4.5" or "MEM +4.5")
  const formatPick = (game: Game, side: 'left' | 'right'): string => {
    if (!game.spread) return 'N/A';

    if (side === 'left') {
      // Left team gets the spread as-is
      return `${game.leftTeam.abbreviation} ${game.spread > 0 ? '+' : ''}${game.spread}`;
    } else {
      // Right team gets the opposite spread
      const oppositeSpread = -game.spread;
      return `${game.rightTeam.abbreviation} ${oppositeSpread > 0 ? '+' : ''}${oppositeSpread}`;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚔️ Battle Bets</h1>
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: '#ff4444',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '5px',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          VERSION 4.0-FINAL
        </div>
      </header>

      <main className="app-main">
        {/* Game Area Wrapper - Contains Info Bar + Canvas */}
        <div className="game-area-wrapper">
          {/* Info Bar - Full Width Above Canvas */}
          {games.length > 0 && <GameInfoBar game={games[0]} />}

          {/* Battle Canvas */}
          <div className="game-container">
            <BattleCanvas />
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          <div className="quarter-controls">
            <h3>
              {battleResult
                ? `🏆 ${battleResult.winner.toUpperCase()} WINS! (Q${battleResult.quarterEnded})`
                : currentQuarter === 0
                  ? 'Ready to Battle'
                  : `Quarter ${currentQuarter}`
              }
            </h3>
            <div className="button-group" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleSimulateBattle}
                disabled={isSimulating || battleResult !== null}
                className="simulate-button"
                style={{
                  fontSize: '18px',
                  padding: '15px 40px',
                  background: isSimulating
                    ? 'linear-gradient(135deg, #666 0%, #444 100%)'
                    : 'linear-gradient(135deg, #FF4500 0%, #FF6347 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSimulating || battleResult !== null ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(255, 69, 0, 0.4)',
                  transition: 'all 0.3s ease',
                }}
              >
                {isSimulating ? '⚔️ BATTLE IN PROGRESS...' : battleResult ? '✅ BATTLE COMPLETE' : '⚔️ SIMULATE BATTLE'}
              </button>

              <button
                onClick={handleTestBlueOrbShield}
                disabled={isSimulating}
                className="test-shield-button"
                style={{
                  fontSize: '16px',
                  padding: '15px 30px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSimulating ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.3s ease',
                }}
              >
                🛡️ TEST SHIELD
              </button>

              <button
                onClick={handleTestFireOrb}
                disabled={isSimulating}
                className="test-fire-button"
                style={{
                  fontSize: '16px',
                  padding: '15px 30px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSimulating ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.3s ease',
                }}
              >
                🔴 TEST FIRE ORB
              </button>
            </div>
          </div>

          <div className="button-group" style={{ marginTop: '20px', gap: '10px' }}>
            <button onClick={handleReset} className="reset-button">
              🔄 Reset Battle
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="info-panel">
          <h3>🎯 Battle Bets V3 Features</h3>
          <ul>
            <li>✅ PixiJS WebGL rendering (60fps)</li>
            <li>✅ Pixel-perfect grid alignment</li>
            <li>✅ GSAP professional animations</li>
            <li>✅ TypeScript type safety</li>
            <li>✅ Zustand state management</li>
            <li>🚧 Battle simulation (coming next)</li>
            <li>🚧 Supabase integration</li>
            <li>🚧 3D avatars with Three.js</li>
          </ul>
        </div>
      </main>

      <footer className="app-footer">
        <p>Built with React + TypeScript + PixiJS + GSAP + Zustand</p>
      </footer>

      {/* Performance Monitor (dev only) */}
      <PerformanceMonitor />
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <GameErrorBoundary>
      <App />
    </GameErrorBoundary>
  );
}

export default AppWithErrorBoundary;
