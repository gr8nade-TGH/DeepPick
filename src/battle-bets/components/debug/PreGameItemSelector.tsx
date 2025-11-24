/**
 * PreGameItemSelector.tsx
 * 
 * Pre-game item selection UI for testing items.
 * Allows clicking item slots to equip/unequip items before battle starts.
 */

import React, { useState } from 'react';
import './PreGameItemSelector.css';
import { LAL_IRONMAN_ARMOR_DEFINITION } from '../../game/items/effects/LAL_IronmanArmor';
import type { ItemDefinition } from '../../game/items/ItemRollSystem';

interface PreGameItemSelectorProps {
  battleId: string;
  onItemsChanged: (leftItems: string[], rightItems: string[]) => void;
  initialSlot?: { side: 'left' | 'right'; slot: 1 | 2 | 3 };
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
}) => {
  const [leftSlot1, setLeftSlot1] = useState<string | null>(null);
  const [leftSlot2, setLeftSlot2] = useState<string | null>(null);
  const [leftSlot3, setLeftSlot3] = useState<string | null>(null);

  const [rightSlot1, setRightSlot1] = useState<string | null>(null);
  const [rightSlot2, setRightSlot2] = useState<string | null>(null);
  const [rightSlot3, setRightSlot3] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<{
    side: 'left' | 'right';
    slot: 1 | 2 | 3;
  } | null>(initialSlot || null);

  // Update parent when items change
  const updateParent = () => {
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

    if (side === 'left') {
      if (slot === 1) setLeftSlot1(itemId);
      if (slot === 2) setLeftSlot2(itemId);
      if (slot === 3) setLeftSlot3(itemId);
    } else {
      if (slot === 1) setRightSlot1(itemId);
      if (slot === 2) setRightSlot2(itemId);
      if (slot === 3) setRightSlot3(itemId);
    }

    setSelectedSlot(null);
    setTimeout(updateParent, 0);
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

    setSelectedSlot(null);
    setTimeout(updateParent, 0);
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

              {AVAILABLE_ITEMS.map((item) => (
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
              ))}
            </div>

            <div className="picker-footer">
              <button className="close-button" onClick={() => setSelectedSlot(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

