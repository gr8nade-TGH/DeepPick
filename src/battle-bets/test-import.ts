// Test file to verify inventory.ts exports
import { EquippedItems, ShieldState, InventoryItem, ItemSlot } from './types/inventory';

console.log('Import test successful!');

const testEquipped: EquippedItems = {
  slot1: null,
  slot2: null
};

console.log('EquippedItems type works:', testEquipped);

