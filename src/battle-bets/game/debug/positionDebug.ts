/**
 * Position Debug Utility
 * Logs all grid positions to help debug collision issues
 */

import { gridManager } from '../managers/GridManager';
import type { StatType } from '../../types/game';

export function debugGridPositions() {
  console.log('\n🔍 ===== GRID POSITION DEBUG =====\n');

  const stats: StatType[] = ['pts', 'reb', 'ast', 'blk', '3pt'];

  // Log weapon slot positions
  console.log('🎯 WEAPON SLOT POSITIONS:');
  stats.forEach(stat => {
    const leftWeapon = gridManager.getWeaponSlotPosition(stat, 'left');
    const rightWeapon = gridManager.getWeaponSlotPosition(stat, 'right');
    console.log(`  ${stat.toUpperCase()}: LEFT=${leftWeapon.x.toFixed(1)}, RIGHT=${rightWeapon.x.toFixed(1)}`);
  });

  // Log defense cell positions (first and last cell)
  console.log('\n🛡️ DEFENSE CELL POSITIONS (Cell #1 and #10):');
  stats.forEach(stat => {
    const leftCell1 = gridManager.getDefenseCellPosition(stat, 'left', 0);
    const leftCell10 = gridManager.getDefenseCellPosition(stat, 'left', 9);
    const rightCell1 = gridManager.getDefenseCellPosition(stat, 'right', 0);
    const rightCell10 = gridManager.getDefenseCellPosition(stat, 'right', 9);
    
    console.log(`  ${stat.toUpperCase()} LEFT:  Cell#1=${leftCell1.x.toFixed(1)}, Cell#10=${leftCell10.x.toFixed(1)}`);
    console.log(`  ${stat.toUpperCase()} RIGHT: Cell#1=${rightCell1.x.toFixed(1)}, Cell#10=${rightCell10.x.toFixed(1)}`);
  });

  // Log battlefield center
  const battlefield = gridManager.getBattlefieldCenter();
  console.log(`\n⚔️ BATTLEFIELD CENTER: X=${battlefield.x.toFixed(1)}`);

  // Log grid layout
  const layout = gridManager.getLayout();
  console.log('\n📐 GRID LAYOUT:');
  console.log(`  Left Weapon Slot Start: ${layout.leftWeaponSlotStart.toFixed(1)}`);
  console.log(`  Left Defense Start: ${layout.leftDefenseStart.toFixed(1)}`);
  console.log(`  Battlefield Start: ${layout.battlefieldStart.toFixed(1)}`);
  console.log(`  Battlefield End: ${layout.battlefieldEnd.toFixed(1)}`);
  console.log(`  Right Defense Start: ${layout.rightDefenseStart.toFixed(1)}`);
  console.log(`  Right Weapon Slot Start: ${layout.rightWeaponSlotStart.toFixed(1)}`);

  console.log('\n🔍 ===== END GRID DEBUG =====\n');
}

