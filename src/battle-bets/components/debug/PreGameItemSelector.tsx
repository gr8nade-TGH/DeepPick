/**
 * PreGameItemSelector.tsx
 * 
 * Pre-game item selection UI for testing items.
 * Allows clicking item slots to equip/unequip items before battle starts.
 */

import React, { useState, useEffect } from 'react';
import './PreGameItemSelector.css';
import { LAL_IRONMAN_ARMOR_DEFINITION } from '../../game/items/effects/LAL_IronmanArmor';
import type { ItemDefinition } from '../../game/items/ItemRollSystem';
import { useMultiGameStore } from '../../store/multiGameStore';

interface PreGameItemSelectorProps {
  battleId: string;
  onItemsChanged: (leftItems: string[], rightItems: string[]) => void;
  initialSlot?: { side: 'left' | 'right'; slot: 1 | 2 | 3 };
  onClose?: () => void;
}

// Available items for testing
const AVAILABLE_ITEMS: ItemDefinition[] = [
  LAL_IRONMAN_ARMOR_DEFINITION,
  // Add more items as they're implemented
];

export const PreGameItemSelector: React.FC<PreGameItemSelectorProps> = ({
  battleId,
  onItemsChanged,
  initialSlot,
  onClose,
}) => {
  const battle = useMultiGameStore(state => state.getBattle(battleId));
  const updateBattle = useMultiGameStore(state => state.updateBattle);

  // Initialize from battle's equipped items
  const [leftSlot1, setLeftSlot1] = useState<string | null>(
    battle?.game.leftCapper.equippedItems?.slot1 || null
  );
  const [leftSlot2, setLeftSlot2] = useState<string | null>(
    battle?.game.leftCapper.equippedItems?.slot2 || null
  );
  const [leftSlot3, setLeftSlot3] = useState<string | null>(
    battle?.game.leftCapper.equippedItems?.slot3 || null
  );

  const [rightSlot1, setRightSlot1] = useState<string | null>(
    battle?.game.rightCapper.equippedItems?.slot1 || null
  );
  const [rightSlot2, setRightSlot2] = useState<string | null>(
    battle?.game.rightCapper.equippedItems?.slot2 || null
  );
  const [rightSlot3, setRightSlot3] = useState<string | null>(
    battle?.game.rightCapper.equippedItems?.slot3 || null
  );

  const [selectedSlot, setSelectedSlot] = useState<{
    side: 'left' | 'right';
    slot: 1 | 2 | 3;
  } | null>(initialSlot || null);

  // Update battle's equipped items in the store
  const updateBattleEquippedItems = () => {
    if (!battle) return;

    console.log('💾 Saving equipped items to battle:', {
      battleId,
      left: { slot1: leftSlot1, slot2: leftSlot2, slot3: leftSlot3 },
      right: { slot1: rightSlot1, slot2: rightSlot2, slot3: rightSlot3 }
    });

    updateBattle(battleId, (b) => ({
      ...b,
      game: {
        ...b.game,
        leftCapper: {
          ...b.game.leftCapper,
          equippedItems: {
            slot1: leftSlot1,
            slot2: leftSlot2,
            slot3: leftSlot3,
          },
        },
        rightCapper: {
          ...b.game.rightCapper,
          equippedItems: {
            slot1: rightSlot1,
            slot2: rightSlot2,
            slot3: rightSlot3,
          },
        },
      },
    }));

    const leftItems = [leftSlot1, leftSlot2, leftSlot3].filter(Boolean) as string[];
    const rightItems = [rightSlot1, rightSlot2, rightSlot3].filter(Boolean) as string[];
    onItemsChanged(leftItems, rightItems);
  };

  const handleSlotClick = (side: 'left' | 'right', slot: 1 | 2 | 3) => {
    setSelectedSlot({ side, slot });
  };

  const handleItemSelect = (itemId: string) => {
    if (!selectedSlot) return;

    const { side, slot } = selectedSlot;

    // Get item definition to check slot type
    const item = AVAILABLE_ITEMS.find(i => i.id === itemId);
    if (!item) return;

    // Validate item type matches slot type
    // Slot 1 = DEFENSE, Slot 2 = ATTACK, Slot 3 = UNIQUE
    const slotType = slot === 1 ? 'defense' : slot === 2 ? 'attack' : 'unique';
    if (item.slot !== slotType) {
      console.error(`❌ Cannot equip ${item.name} in ${slotType} slot - item is for ${item.slot} slot`);
      alert(`This item can only be equipped in the ${item.slot.toUpperCase()} slot!`);
      return;
    }

    console.log('✅ Item selected:', { itemId, side, slot });

    if (side === 'left') {
      if (slot === 1) setLeftSlot1(itemId);
      if (slot === 2) setLeftSlot2(itemId);
      if (slot === 3) setLeftSlot3(itemId);
    } else {
      if (slot === 1) setRightSlot1(itemId);
      if (slot === 2) setRightSlot2(itemId);
      if (slot === 3) setRightSlot3(itemId);
    }

    // Close the slot selector but keep popup open
    setSelectedSlot(null);
  };

  const handleClearSlot = () => {
    if (!selectedSlot) return;

    const { side, slot } = selectedSlot;

    if (side === 'left') {
      if (slot === 1) setLeftSlot1(null);
      if (slot === 2) setLeftSlot2(null);
      if (slot === 3) setLeftSlot3(null);
    } else {
      if (slot === 1) setRightSlot1(null);
      if (slot === 2) setRightSlot2(null);
      if (slot === 3) setRightSlot3(null);
    }

    // Close the slot selector but keep popup open
    setSelectedSlot(null);
  };

  const handleSaveAndClose = () => {
    console.log('💾 [PreGameItemSelector] Saving items:', {
      left: { slot1: leftSlot1, slot2: leftSlot2, slot3: leftSlot3 },
      right: { slot1: rightSlot1, slot2: rightSlot2, slot3: rightSlot3 }
    });

    // Save to battle state
    updateBattleEquippedItems();

    // Close popup
    onClose?.();
  };

  const getSlotItem = (side: 'left' | 'right', slot: 1 | 2 | 3): string | null => {
    if (side === 'left') {
      if (slot === 1) return leftSlot1;
      if (slot === 2) return leftSlot2;
      if (slot === 3) return leftSlot3;
    } else {
      if (slot === 1) return rightSlot1;
      if (slot === 2) return rightSlot2;
      if (slot === 3) return rightSlot3;
    }
    return null;
  };

  const getItemDefinition = (itemId: string): ItemDefinition | null => {
    return AVAILABLE_ITEMS.find((item) => item.id === itemId) ?? null;
  };

  const renderSlot = (side: 'left' | 'right', slot: 1 | 2 | 3, slotType: string) => {
    const itemId = getSlotItem(side, slot);
    const item = itemId ? getItemDefinition(itemId) : null;
    const isSelected = selectedSlot?.side === side && selectedSlot?.slot === slot;

    return (
      <div
        className={`pre-game-slot ${itemId ? 'equipped' : 'empty'} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleSlotClick(side, slot)}
        title={item ? item.name : `${slotType} Slot (Empty)`}
      >
        {item ? (
          <div className="slot-item">
            <div className="item-icon">🛡️</div>
            <div className="item-name">{item.name}</div>
          </div>
        ) : (
          <div className="slot-empty-icon">{slotType === 'DEFENSE' ? '🛡️' : slotType === 'ATTACK' ? '⚔️' : '✨'}</div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Item Picker Popup (shows when slot selected) */}
      {selectedSlot && (
        <div className="item-picker-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="item-picker-popup" onClick={(e) => e.stopPropagation()}>
            <div className="picker-header">
              <h3>🛡️ SELECT ITEM</h3>
              <p>
                {selectedSlot.side.toUpperCase()} CAPPER - Slot {selectedSlot.slot}
              </p>
            </div>

            <div className="picker-body">
              <button className="clear-button" onClick={handleClearSlot}>
                ❌ Clear Slot
              </button>

              {(() => {
                // Filter items by slot type
                const slotType = selectedSlot.slot === 1 ? 'defense' : selectedSlot.slot === 2 ? 'attack' : 'unique';
                const filteredItems = AVAILABLE_ITEMS.filter(item => item.slot === slotType);

                if (filteredItems.length === 0) {
                  return (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                      No {slotType} items available yet
                    </div>
                  );
                }

                return filteredItems.map((item) => (
                  <button
                    key={item.id}
                    className="item-button"
                    onClick={() => handleItemSelect(item.id)}
                  >
                    <div className="item-button-content">
                      <div className="item-icon-large">🛡️</div>
                      <div className="item-details">
                        <div className="item-name">{item.name}</div>
                        <div className="item-team">{item.teamName}</div>
                        <div className="item-description">{item.description}</div>
                      </div>
                    </div>
                  </button>
                ));
              })()}
            </div>

            <div className="picker-footer">
              <button className="close-button" onClick={() => setSelectedSlot(null)}>
                Back
              </button>
              <button className="save-button" onClick={handleSaveAndClose}>
                💾 Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

