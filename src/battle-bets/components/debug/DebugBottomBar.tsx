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
  const [selectedBattleId, setSelectedBattleId] = useState<string>(battleIds[0] || '');
  const [copyStatus, setCopyStatus] = useState<string>('');

  // Enable debug logger on mount
  useEffect(() => {
    debugLogger.enable();
    debugLogger.clear();
    return () => debugLogger.disable();
  }, []);

  const handleCopyDebug = async () => {
    setCopyStatus('Copying...');
    try {
      // Build debug report for selected battle
      const battle = useMultiGameStore.getState().getBattle(selectedBattleId);
      const knightInfo = getKnightDebugInfo(selectedBattleId);

      const formatKnight = (k: any) => {
        if (!k) return 'None';
        return `HP=${k.hp}/${k.maxHP}, Patrolling=${k.isPatrolling}, Pos=(${k.position?.x?.toFixed(0) ?? '?'}, ${k.position?.y?.toFixed(0) ?? '?'}), Shields=${k.shieldCharges ?? 0}`;
      };

      // Get knight logs from debugLogger
      const knightLogs = debugLogger.getReport(selectedBattleId);

      const report = [
        '='.repeat(80),
        'BATTLE DEBUG REPORT',
        '='.repeat(80),
        `Generated: ${new Date().toISOString()}`,
        `Battle ID: ${selectedBattleId}`,
        `Status: ${battle?.game?.status || 'N/A'}`,
        `Quarter: ${battle?.currentQuarter || 0}`,
        `Left HP: ${battle?.capperHP.get('left')?.currentHP ?? 'N/A'}`,
        `Right HP: ${battle?.capperHP.get('right')?.currentHP ?? 'N/A'}`,
        '',
        '--- KNIGHT STATE ---',
        `Left Knight: ${formatKnight(knightInfo.left)}`,
        `Right Knight: ${formatKnight(knightInfo.right)}`,
        `All Active Knights: ${knightInfo.allKeys.join(', ') || 'none'}`,
        '',
        '--- KNIGHT LOGS ---',
        knightLogs,
        '='.repeat(80),
      ].join('\n');

      await navigator.clipboard.writeText(report);
      setCopyStatus('✅ Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus('❌ Failed');
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
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>Copy Debug for:</span>
          <select
            value={selectedBattleId}
            onChange={(e) => setSelectedBattleId(e.target.value)}
            style={{
              fontSize: '11px', padding: '4px 8px', background: '#374151', color: '#fff',
              border: '1px solid #4b5563', borderRadius: '4px',
            }}
          >
            {battleIds.map((id, idx) => (
              <option key={id} value={id}>Battle #{idx + 1} ({id})</option>
            ))}
          </select>
          <button
            onClick={handleCopyDebug}
            style={{
              fontSize: '11px', padding: '6px 12px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
            }}
          >
            📋 Copy Debug
          </button>
          {copyStatus && <span style={{ fontSize: '10px', color: '#9ca3af' }}>{copyStatus}</span>}
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

