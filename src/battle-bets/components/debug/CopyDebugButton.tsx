/**
 * CopyDebugButton - Comprehensive debug info copy button
 */

import { useState, useEffect, useRef } from 'react';
import { collisionManager } from '../../game/managers/CollisionManager';
import { castleManager } from '../../game/managers/CastleManager';
import { castleHealthSystem } from '../../game/systems/CastleHealthSystem';
import { itemEffectRegistry } from '../../game/items/ItemEffectRegistry';
import { useMultiGameStore } from '../../store/multiGameStore';
import { debugLogger } from '../../game/debug/DebugLogger';

interface CopyDebugButtonProps {
  battleId: string;
}

// Capture console logs with emoji markers
const capturedLogs: Array<{ timestamp: number; message: string }> = [];
const originalConsoleLog = console.log;

// Override console.log to capture emoji marker logs
console.log = (...args: any[]) => {
  originalConsoleLog(...args);

  // Convert args to string
  const message = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
    return String(arg);
  }).join(' ');

  // Capture ALL logs with emoji markers OR specific keywords
  const emojiMarkers = ['💾💾💾', '🧪🧪🧪', '🎮🎮🎮', '✅✅✅', '🔔', '🛡️', '🔍', '📢📢📢', '💀', '💥', '⚔️', '🎯', '📦', '🚀'];
  const keywords = ['[ItemEffectRegistry]', '[Shortsword]', '[IronmanArmor]', '[PreGameItemSelector]', 'activateItem', 'registerEffect'];

  if (emojiMarkers.some(emoji => message.includes(emoji)) || keywords.some(kw => message.includes(kw))) {
    capturedLogs.push({
      timestamp: Date.now(),
      message
    });

    // Keep only last 200 logs to prevent memory issues (increased from 100)
    if (capturedLogs.length > 200) {
      capturedLogs.shift();
    }
  }
};

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
      lines.push(`User Agent: ${navigator.userAgent}`);
      lines.push(`Current URL: ${window.location.href}`);
      lines.push('='.repeat(80));
      lines.push('');

      // Bundle version detection
      lines.push('\n' + '='.repeat(80));
      lines.push('BUNDLE VERSION CHECK');
      lines.push('='.repeat(80));
      const scripts = Array.from(document.querySelectorAll('script[src*="main-"]'));
      if (scripts.length > 0) {
        scripts.forEach((script: any) => {
          lines.push(`Loaded bundle: ${script.src}`);
        });
      } else {
        lines.push('❌ No main bundle script found!');
      }
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

      // 4.5. Item Save/Activation Flow Tracking
      try {
        lines.push('\n' + '-'.repeat(80));
        lines.push('ITEM SAVE/ACTIVATION FLOW (Captured Console Logs)');
        lines.push('-'.repeat(80));
        lines.push('');
        lines.push('Emoji markers explained:');
        lines.push('  💾💾💾 = Item save attempt (PreGameItemSelector)');
        lines.push('  🧪🧪🧪 = fetchBattles called (App.tsx - check if items preserved)');
        lines.push('  🎮🎮🎮 = Game start (QuarterDebugControls - item activation attempt)');
        lines.push('  ✅✅✅ = Item successfully activated');
        lines.push('  📢📢📢 = DEFENSE_ORB_DESTROYED event EMITTED (CollisionManager)');
        lines.push('  🔔 = DEFENSE_ORB_DESTROYED event RECEIVED (Ironman Armor listener)');
        lines.push('  🛡️ = Shield healing attempt');
        lines.push('  💀 = Defense orb destroyed');
        lines.push('  💥 = Projectile collision');
        lines.push('  🎯 = ItemEffectRegistry registration/activation');
        lines.push('  ⚔️ = Shortsword effect logs');
        lines.push('  📦 = Item effect registered');
        lines.push('  🚀 = Calling effect function');
        lines.push('');

        if (capturedLogs.length === 0) {
          lines.push('❌ NO LOGS CAPTURED!');
          lines.push('');
          lines.push('This means:');
          lines.push('  - You may not have equipped items (no 💾 logs)');
          lines.push('  - You may not have started the game (no 🎮 logs)');
          lines.push('  - The page may need a hard refresh (Ctrl+Shift+R)');
          lines.push('  - The bundle may not have loaded correctly');
        } else {
          lines.push(`✅ Captured ${capturedLogs.length} logs (most recent 100 shown):`);
          lines.push('');

          // Show most recent 100 logs (increased from 50)
          const recentLogs = capturedLogs.slice(-100);
          recentLogs.forEach(log => {
            const date = new Date(log.timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
            lines.push(`[${timeStr}] ${log.message}`);
          });
        }

        lines.push('');
        lines.push('Diagnosis:');
        lines.push('  - If NO 💾 logs: Items not being saved (PreGameItemSelector issue)');
        lines.push('  - If 💾 but items empty above: Save failed or cleared by fetchBattles');
        lines.push('  - If items present but NO 🎮 logs: Game not started properly');
        lines.push('  - If 🎮 but NO ✅ logs: Item activation failed');
        lines.push('  - If ✅ but "Active items: 0": Items deactivated or wrong battle ID');
        lines.push('  - If active items > 0 but NO 🔔 logs: Events not firing');
        lines.push('  - If 🔔 but NO 🛡️ logs: Shield healing logic not running');
      } catch (error) {
        lines.push(`❌ Error generating item flow info: ${error}`);
        console.error('Error generating item flow info:', error);
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

