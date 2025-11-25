/**
 * CopyDebugButton - Comprehensive debug info copy button
 */

import { useState } from 'react';
import { collisionManager } from '../../game/managers/CollisionManager';
import { castleManager } from '../../game/managers/CastleManager';
import { castleHealthSystem } from '../../game/systems/CastleHealthSystem';
import { itemEffectRegistry } from '../../game/items/ItemEffectRegistry';
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

      console.log('📋 Starting debug report generation...');

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

      // 4. Item System State
      lines.push('\n' + '='.repeat(80));
      lines.push('ITEM SYSTEM STATE');
      lines.push('='.repeat(80));

      try {
        // Active items
        console.log('📋 Getting active items...');
        const activeItems = itemEffectRegistry.getActiveItems();
        console.log('📋 Active items:', activeItems);
        const battleItems = activeItems.filter(item => item.gameId === battleId);
        lines.push(`Active items for this battle: ${battleItems.length}`);
        battleItems.forEach(item => {
          lines.push(`\nItem Instance: ${item.instanceId}`);
          lines.push(`  Item ID: ${item.itemId}`);
          lines.push(`  Side: ${item.side}`);
          lines.push(`  Quality: ${item.qualityTier}`);
          lines.push(`  Rolls: ${JSON.stringify(item.rolls)}`);
          lines.push(`  Counters: ${JSON.stringify(Array.from(item.counters.entries()))}`);
        });
      } catch (error) {
        lines.push(`❌ Error getting active items: ${error}`);
        console.error('Error getting active items:', error);
      }

      try {
        // Shield states
        lines.push('\n' + '-'.repeat(80));
        lines.push('SHIELD STATES (CastleHealthSystem)');
        lines.push('-'.repeat(80));
        const leftCastleId = `${battleId}-left`;
        const rightCastleId = `${battleId}-right`;

        console.log('📋 Getting shield states...');
        const leftShield = castleHealthSystem.getShield(leftCastleId);
        const rightShield = castleHealthSystem.getShield(rightCastleId);

        lines.push(`\nLEFT Castle Shield (${leftCastleId}):`);
        if (leftShield) {
          lines.push(`  Active: ${leftShield.isActive}`);
          lines.push(`  HP: ${leftShield.currentHP}/${leftShield.maxHP}`);
          lines.push(`  Source: ${leftShield.source}`);
          lines.push(`  Activation Threshold: ${leftShield.activationThreshold}`);
        } else {
          lines.push(`  No shield`);
        }

        lines.push(`\nRIGHT Castle Shield (${rightCastleId}):`);
        if (rightShield) {
          lines.push(`  Active: ${rightShield.isActive}`);
          lines.push(`  HP: ${rightShield.currentHP}/${rightShield.maxHP}`);
          lines.push(`  Source: ${rightShield.source}`);
          lines.push(`  Activation Threshold: ${rightShield.activationThreshold}`);
        } else {
          lines.push(`  No shield`);
        }
      } catch (error) {
        lines.push(`❌ Error getting shield states: ${error}`);
        console.error('Error getting shield states:', error);
      }

      try {
        // Equipped items from battle state
        lines.push('\n' + '-'.repeat(80));
        lines.push('EQUIPPED ITEMS (Battle State)');
        lines.push('-'.repeat(80));
        console.log('📋 Getting equipped items from battle state...');
        if (battle) {
          const leftItems = battle.game?.leftCapper?.equippedItems;
          const rightItems = battle.game?.rightCapper?.equippedItems;

          lines.push(`\nLEFT Side Equipped Items:`);
          if (leftItems) {
            const slot1 = typeof leftItems.slot1 === 'object' ? leftItems.slot1?.itemId : leftItems.slot1;
            const slot2 = typeof leftItems.slot2 === 'object' ? leftItems.slot2?.itemId : leftItems.slot2;
            const slot3 = typeof leftItems.slot3 === 'object' ? leftItems.slot3?.itemId : leftItems.slot3;
            lines.push(`  Slot 1: ${slot1 || 'empty'}`);
            lines.push(`  Slot 2: ${slot2 || 'empty'}`);
            lines.push(`  Slot 3: ${slot3 || 'empty'}`);
          } else {
            lines.push(`  No equipped items (equippedItems property not initialized)`);
          }

          lines.push(`\nRIGHT Side Equipped Items:`);
          if (rightItems) {
            const slot1 = typeof rightItems.slot1 === 'object' ? rightItems.slot1?.itemId : rightItems.slot1;
            const slot2 = typeof rightItems.slot2 === 'object' ? rightItems.slot2?.itemId : rightItems.slot2;
            const slot3 = typeof rightItems.slot3 === 'object' ? rightItems.slot3?.itemId : rightItems.slot3;
            lines.push(`  Slot 1: ${slot1 || 'empty'}`);
            lines.push(`  Slot 2: ${slot2 || 'empty'}`);
            lines.push(`  Slot 3: ${slot3 || 'empty'}`);
          } else {
            lines.push(`  No equipped items (equippedItems property not initialized)`);
          }
        }
      } catch (error) {
        lines.push(`❌ Error getting equipped items: ${error}`);
        console.error('Error getting equipped items:', error);
      }

      // 5. Debug Logger Logs
      lines.push('\n' + '='.repeat(80));
      lines.push('DEBUG LOGGER CAPTURED LOGS');
      lines.push('='.repeat(80));
      const logReport = debugLogger.getReport(battleId);
      lines.push(logReport);

      lines.push('\n' + '='.repeat(80));
      lines.push('END OF COMPREHENSIVE DEBUG REPORT');
      lines.push('='.repeat(80));

      const report = lines.join('\n');
      console.log('📋 Report generated, copying to clipboard...');
      console.log('Report length:', report.length, 'characters');

      await navigator.clipboard.writeText(report);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      console.log('✅ Comprehensive debug report copied to clipboard!');
    } catch (error) {
      console.error('❌ Failed to copy debug report:', error);
      console.error('Error details:', error);
      alert(`Failed to copy. Error: ${error}\nCheck console for details.`);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'fixed',
        top: '80px', // Moved down to avoid overlapping with DEBUG button
        right: '20px',
        zIndex: 9998, // Below DEBUG button
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 'bold',
        borderRadius: '8px',
        border: '2px solid #fff',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.2s',
        background: copied
          ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
          : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        color: 'white'
      }}
      onMouseEnter={(e) => {
        if (!copied) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5)';
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        }
      }}
    >
      {copied ? '✅ Copied!' : '📋 Copy Debug'}
    </button>
  );
}

