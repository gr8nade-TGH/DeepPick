/**
 * DebugBottomBar - Unified debug control bar at bottom of screen
 * Shows controls for all battles in a single organized bar
 */

import React, { useState, useEffect } from 'react';
import { useMultiGameStore } from '../../store/multiGameStore';
import { simulateQuarter } from '../../game/simulation/quarterSimulation';
import type { GameStatus } from '../../types/game';
import type { BattleStatus } from '../../lib/BattleTimer';
import { itemEffectRegistry } from '../../game/items/ItemEffectRegistry';
import { getKnight, getKnightDebugInfo } from '../../game/items/effects/MED_KnightDefender';
import { debugLogger } from '../../game/debug/DebugLogger';
import { getEquippedCastle } from '../../game/items/effects/CASTLE_Fortress';
import { castleManager } from '../../game/managers/CastleManager';

// Capture console logs with emoji markers for debug report
const capturedLogs: Array<{ timestamp: number; message: string }> = [];
const originalConsoleLog = console.log;

// Override console.log to capture relevant logs
if (!(console.log as any).__debugBottomBarPatched) {
  console.log = (...args: any[]) => {
    originalConsoleLog(...args);

    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
      return String(arg);
    }).join(' ');

    // Capture logs with emoji markers or keywords
    const emojiMarkers = ['🏰', '🎮', '✅', '🔔', '🛡️', '🔍', '💀', '💥', '⚔️', '🎯', '📦', '🚀', '🐴', '📡', '🐝', '🔮', '🧹', '❌'];
    const keywords = ['setCastleHP', 'HP Check', 'handleStartGame', 'handleRollCastle', 'getOrSpawnKnight',
      'equipCastle', 'battleId=', 'ForceQuarter', 'startPatrol', 'gsap.to', 'knight',
      'Multi-Game Store', 'PreGame', 'ItemEffectRegistry', 'activateItem'];

    if (emojiMarkers.some(emoji => message.includes(emoji)) || keywords.some(kw => message.includes(kw))) {
      capturedLogs.push({ timestamp: Date.now(), message });
      if (capturedLogs.length > 300) capturedLogs.shift();
    }
  };
  (console.log as any).__debugBottomBarPatched = true;
}

interface BattleControlProps {
  battleId: string;
  battleIndex: number;
}

const BattleControl: React.FC<BattleControlProps> = ({ battleId, battleIndex }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  const battle = useMultiGameStore(state => state.getBattle(battleId));
  if (!battle) return null;

  const currentQuarter = battle.currentQuarter;
  const gameStatus = battle.game.status || 'SCHEDULED';
  const leftHP = battle.capperHP.get('left')?.currentHP ?? 0;
  const rightHP = battle.capperHP.get('right')?.currentHP ?? 0;
  const leftTeam = battle.game.awayTeam?.abbreviation || 'L';
  const rightTeam = battle.game.homeTeam?.abbreviation || 'R';

  const knightInfo = getKnightDebugInfo(battleId);
  const hasKnight = knightInfo.left || knightInfo.right;

  const getQuarterLabel = (q: number) => (q <= 4 ? `Q${q}` : `OT${q - 4}`);

  const handleStartGame = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLastAction('Starting...');
    try {
      console.log(`🧹 [BottomBar] Deactivating items for battle ${battleId}`);
      itemEffectRegistry.deactivateGame(battleId);
      console.log(`🎮 [BottomBar] Activating items for battle ${battleId}`);
      console.log(`🐴 [BottomBar] Starting knight patrols for battleId: ${battleId}`);

      const leftKnight = getKnight(battleId, 'left');
      const rightKnight = getKnight(battleId, 'right');
      console.log(`🐴 [BottomBar] getKnight: left=${leftKnight ? 'FOUND' : 'null'}, right=${rightKnight ? 'FOUND' : 'null'}`);

      if (leftKnight) { try { leftKnight.startPatrol(); } catch (e) { console.error(e); } }
      if (rightKnight) { try { rightKnight.startPatrol(); } catch (e) { console.error(e); } }

      useMultiGameStore.getState().updateGameStatus(battleId, '1Q');
      useMultiGameStore.getState().setCurrentQuarter(battleId, 1);
      useMultiGameStore.getState().updateBattleStatus(battleId, 'Q1_IN_PROGRESS');
      setLastAction('✅ Started');
    } catch (error) {
      console.error('Failed to start game:', error);
      setLastAction('❌ Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceQuarter = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const nextQ = currentQuarter + 1;
    setLastAction(`⏳ ${getQuarterLabel(nextQ)}...`);
    try {
      const bStatusMap: Record<number, BattleStatus> = {
        1: 'Q1_BATTLE', 2: 'Q2_BATTLE', 3: 'Q3_BATTLE', 4: 'Q4_BATTLE',
        5: 'OT1_BATTLE', 6: 'OT2_BATTLE', 7: 'OT3_BATTLE', 8: 'OT4_BATTLE',
      };
      const gStatusMap: Record<number, GameStatus> = {
        1: '1Q', 2: '2Q', 3: '3Q', 4: '4Q', 5: 'OT', 6: 'OT2', 7: 'OT3', 8: 'OT4',
      };
      useMultiGameStore.getState().updateBattleStatus(battleId, bStatusMap[nextQ]);
      useMultiGameStore.getState().setCurrentQuarter(battleId, nextQ);
      useMultiGameStore.getState().updateGameStatus(battleId, gStatusMap[nextQ]);
      await simulateQuarter(battleId, nextQ);
      setLastAction(`✅ ${getQuarterLabel(nextQ)}`);
    } catch (error) {
      console.error('Failed to force quarter:', error);
      setLastAction('❌ Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    useMultiGameStore.getState().setCurrentQuarter(battleId, 0);
    useMultiGameStore.getState().updateGameStatus(battleId, 'SCHEDULED');
    useMultiGameStore.getState().initializeCapperHP(battleId);
    useMultiGameStore.getState().initializeDefenseDots(battleId);
    setLastAction('🔄 Reset');
  };

  const bgColor = hasKnight ? '#1e3a5f' : '#1a1a2e';
  const btnStyle = (bg: string): React.CSSProperties => ({
    fontSize: '10px', padding: '4px 8px', background: bg, color: '#fff',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 12px', background: bgColor, borderRadius: '8px',
      border: hasKnight ? '2px solid #60a5fa' : '1px solid #374151', minWidth: '180px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px' }}>
        Battle #{battleIndex + 1} {hasKnight && '🐴'}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
        {leftTeam} vs {rightTeam}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', padding: '2px 6px', background: '#374151', borderRadius: '4px', color: '#d1d5db' }}>{gameStatus}</span>
        <span style={{ fontSize: '10px', padding: '2px 6px', background: '#4b5563', borderRadius: '4px', color: '#fff' }}>Q{currentQuarter}</span>
      </div>
      <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>HP: {leftHP} vs {rightHP}</div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {gameStatus === 'SCHEDULED' && (
          <button onClick={handleStartGame} disabled={isProcessing} style={btnStyle('#16a34a')}>🎬 Start</button>
        )}
        {gameStatus !== 'SCHEDULED' && gameStatus !== 'FINAL' && (
          <button onClick={handleForceQuarter} disabled={isProcessing} style={btnStyle('#2563eb')}>⚡ {getQuarterLabel(currentQuarter + 1)}</button>
        )}
        <button onClick={handleReset} disabled={isProcessing} style={btnStyle('#6b7280')}>🔄</button>
      </div>
      {lastAction && <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>{lastAction}</div>}
    </div>
  );
};

interface DebugBottomBarProps {
  battleIds: string[];
}

export const DebugBottomBar: React.FC<DebugBottomBarProps> = ({ battleIds }) => {
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});

  // Enable debug logger on mount
  useEffect(() => {
    debugLogger.enable();
    debugLogger.clear();
    return () => debugLogger.disable();
  }, []);

  const handleCopyDebug = async (battleId: string, battleIndex: number) => {
    setCopyStatus(prev => ({ ...prev, [battleId]: 'Copying...' }));
    try {
      // Build debug report for this specific battle
      const battle = useMultiGameStore.getState().getBattle(battleId);
      const knightInfo = getKnightDebugInfo(battleId);
      const activeItems = itemEffectRegistry.getActiveItems().filter(i => i.gameId === battleId);
      const leftCastle = getEquippedCastle(battleId, 'left');
      const rightCastle = getEquippedCastle(battleId, 'right');
      const castles = castleManager.getAllCastles(battleId);

      const formatKnight = (k: any) => {
        if (!k) return 'None';
        return `HP=${k.hp}/${k.maxHP}, Patrolling=${k.isPatrolling}, Pos=(${k.position?.x?.toFixed(0) ?? '?'}, ${k.position?.y?.toFixed(0) ?? '?'}), Shields=${k.shieldCharges ?? 0}`;
      };

      // Check for battle ID mismatch
      const expectedLeftKey = `${battleId}-left`;
      const expectedRightKey = `${battleId}-right`;
      const otherBattleKnights = knightInfo.allKeys.filter((k: string) => !k.startsWith(battleId));
      const hasMismatch = otherBattleKnights.length > 0;

      // Get knight logs from debugLogger
      const knightLogs = debugLogger.getReport(battleId);

      // Format captured console logs
      const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
      };

      const lines = [
        '='.repeat(80),
        `BATTLE #${battleIndex + 1} DEBUG REPORT (v2)`,
        '='.repeat(80),
        `Generated: ${new Date().toISOString()}`,
        `Battle ID: ${battleId}`,
        `Status: ${battle?.game?.status || 'N/A'}`,
        `Battle Status: ${battle?.battleStatus || 'N/A'}`,
        `Quarter: ${battle?.currentQuarter || 0}`,
        `Left HP: ${battle?.capperHP.get('left')?.currentHP ?? 'NOT SET'}`,
        `Right HP: ${battle?.capperHP.get('right')?.currentHP ?? 'NOT SET'}`,
        `Active Items: ${activeItems.length}`,
        `Captured Logs: ${capturedLogs.length}`,
        '',
      ];

      // Battle ID mismatch warning
      if (hasMismatch) {
        lines.push('⚠️⚠️⚠️ BATTLE ID MISMATCH DETECTED! ⚠️⚠️⚠️');
        lines.push(`  Knights exist for OTHER battles: ${otherBattleKnights.join(', ')}`);
        lines.push(`  Expected: "${expectedLeftKey}" or "${expectedRightKey}"`);
        lines.push(`  → You may have rolled castle on wrong battle!`);
        lines.push('');
      }

      lines.push('--- CASTLE ITEMS ---');
      lines.push(`Left Castle: ${leftCastle ? `HP=${leftCastle.castleHP}, Shields=${leftCastle.shieldCharges}` : 'Not equipped'}`);
      lines.push(`Right Castle: ${rightCastle ? `HP=${rightCastle.castleHP}, Shields=${rightCastle.shieldCharges}` : 'Not equipped'}`);
      lines.push(`CastleManager Castles: ${castles.length}`);
      castles.forEach(c => lines.push(`  ${c.id}: HP=${c.currentHP}/${c.maxHP}, side=${c.side}`));
      lines.push('');

      lines.push('--- KNIGHT STATE ---');
      lines.push(`Left Knight: ${formatKnight(knightInfo.left)}`);
      lines.push(`Right Knight: ${formatKnight(knightInfo.right)}`);
      lines.push(`All Active Knights: ${knightInfo.allKeys.join(', ') || 'none'}`);
      lines.push('');

      lines.push('--- ACTIVE ITEMS ---');
      if (activeItems.length === 0) {
        lines.push('  No active items for this battle');
      } else {
        activeItems.forEach(item => {
          lines.push(`  ${item.itemId} (${item.side}): ${item.qualityTier}`);
        });
      }
      lines.push('');

      lines.push('--- CONSOLE LOGS (Castle/HP/Knight Flow) ---');
      if (capturedLogs.length === 0) {
        lines.push('❌ NO LOGS CAPTURED! Hard refresh (Ctrl+Shift+R) and try again.');
      } else {
        // Show last 50 logs
        const recentLogs = capturedLogs.slice(-50);
        recentLogs.forEach(log => {
          lines.push(`[${formatTime(log.timestamp)}] ${log.message.substring(0, 200)}`);
        });
      }
      lines.push('');

      lines.push('--- KNIGHT LOGS (from debugLogger) ---');
      lines.push(knightLogs);
      lines.push('='.repeat(80));

      const report = lines.join('\n');
      await navigator.clipboard.writeText(report);
      setCopyStatus(prev => ({ ...prev, [battleId]: '✅' }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [battleId]: '' })), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus(prev => ({ ...prev, [battleId]: '❌' }));
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(to top, #0f172a 0%, #1e293b 100%)',
      borderTop: '2px solid #374151', padding: '10px 20px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa' }}>
          🎮 DEBUG CONTROL BAR
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {battleIds.map((id, idx) => (
            <button
              key={id}
              onClick={() => handleCopyDebug(id, idx)}
              style={{
                fontSize: '11px', padding: '6px 12px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
              }}
            >
              📋 Battle #{idx + 1} {copyStatus[id] || ''}
            </button>
          ))}
        </div>
      </div>

      {/* Battle Controls Row */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {battleIds.map((battleId, index) => (
          <BattleControl key={battleId} battleId={battleId} battleIndex={index} />
        ))}
      </div>
    </div>
  );
};

export default DebugBottomBar;

