/**
 * CopyDebugButton - Comprehensive debug info copy button
 */

import { useState } from 'react';
import { collisionManager } from '../../game/managers/CollisionManager';
import { castleManager } from '../../game/managers/CastleManager';
import { useMultiGameStore } from '../../store/multiGameStore';
import { debugLogger } from '../../game/debug/DebugLogger';

interface CopyDebugButtonProps {
  battleId: string;
}

export function CopyDebugButton({ battleId }: CopyDebugButtonProps) {
  const [copied, setCopied] = useState(false);
  const getBattle = useMultiGameStore(state => state.getBattle);

  const handleCopy = async () => {
    try {
      const lines: string[] = [];

      lines.push('='.repeat(80));
      lines.push('BATTLE BETS COMPREHENSIVE DEBUG REPORT');
      lines.push('='.repeat(80));
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push(`Battle ID: ${battleId}`);
      lines.push('='.repeat(80));
      lines.push('');

      // 1. Battle State from Store
      lines.push('\n' + '='.repeat(80));
      lines.push('BATTLE STATE (from multiGameStore)');
      lines.push('='.repeat(80));
      const battle = getBattle(battleId);
      if (battle) {
        lines.push(`Current Quarter: ${battle.currentQuarter}`);
        lines.push('\nCapper HP:');
        battle.capperHP.forEach((hp, side) => {
          lines.push(`  ${side}: ${hp.currentHP}/${hp.maxHP}`);
        });
        lines.push(`\nActive Projectiles: ${battle.projectiles.length}`);
        lines.push(`Defense Dots: ${battle.defenseDots.size} stat rows`);
      } else {
        lines.push('❌ Battle not found in store!');
      }

      // 2. Castle Manager State
      lines.push('\n' + '='.repeat(80));
      lines.push('CASTLE MANAGER STATE');
      lines.push('='.repeat(80));
      const castles = castleManager.getAllCastles(battleId);
      lines.push(`Castles found: ${castles.length}`);
      castles.forEach(castle => {
        lines.push(`\nCastle ID: ${castle.id}`);
        lines.push(`  Current HP: ${castle.currentHP}/${castle.maxHP}`);
        lines.push(`  Side: ${castle.side}`);
        lines.push(`  Destroyed: ${castle.isDestroyed}`);
      });

      // 3. Collision Manager State
      lines.push('\n' + '='.repeat(80));
      lines.push('COLLISION MANAGER STATE');
      lines.push('='.repeat(80));
      const collisionSnapshot = collisionManager.getDebugSnapshot(battleId);
      lines.push(collisionSnapshot);

      // 4. Debug Logger Logs
      lines.push('\n' + '='.repeat(80));
      lines.push('DEBUG LOGGER CAPTURED LOGS');
      lines.push('='.repeat(80));
      const logReport = debugLogger.getReport(battleId);
      lines.push(logReport);

      lines.push('\n' + '='.repeat(80));
      lines.push('END OF COMPREHENSIVE DEBUG REPORT');
      lines.push('='.repeat(80));

      const report = lines.join('\n');
      await navigator.clipboard.writeText(report);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      console.log('📋 Comprehensive debug report copied to clipboard!');
      console.log('Report length:', report.length, 'characters');
    } catch (error) {
      console.error('Failed to copy debug report:', error);
      alert('Failed to copy. Check console.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 'bold',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s',
        backgroundColor: copied ? '#16a34a' : '#2563eb',
        color: 'white'
      }}
      onMouseEnter={(e) => {
        if (!copied) {
          e.currentTarget.style.backgroundColor = '#1d4ed8';
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          e.currentTarget.style.backgroundColor = '#2563eb';
        }
      }}
    >
      {copied ? '✅ Copied!' : '📋 Copy Debug'}
    </button>
  );
}

