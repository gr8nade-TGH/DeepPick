/**
 * PreGameItemSelector.tsx
 * 
 * Pre-game item selection UI for testing items.
 * Allows clicking item slots to equip/unequip items before battle starts.
 */

import React, { useState, useEffect } from 'react';
import './PreGameItemSelector.css';
import './ItemTooltip.css';
import { LAL_IRONMAN_ARMOR_DEFINITION } from '../../game/items/effects/LAL_IronmanArmor';
import type { ItemDefinition } from '../../game/items/ItemRollSystem';
import { useMultiGameStore } from '../../store/multiGameStore';
import { castleHealthSystem } from '../../game/systems/CastleHealthSystem';
import { castleManager } from '../../game/managers/CastleManager';
import { ItemTooltip } from './ItemTooltip';

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

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<{
    item: ItemDefinition;
    rolls: Record<string, number>;
    quality: 'Warped' | 'Balanced' | 'Honed' | 'Masterwork';
    x: number;
    y: number;
  } | null>(null);

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

    // Get the current item before clearing
    let currentItem: string | null = null;
    if (side === 'left') {
      if (slot === 1) currentItem = leftSlot1;
      if (slot === 2) currentItem = leftSlot2;
      if (slot === 3) currentItem = leftSlot3;
    } else {
      if (slot === 1) currentItem = rightSlot1;
      if (slot === 2) currentItem = rightSlot2;
      if (slot === 3) currentItem = rightSlot3;
    }

    // Clear the slot
    if (side === 'left') {
      if (slot === 1) setLeftSlot1(null);
      if (slot === 2) setLeftSlot2(null);
      if (slot === 3) setLeftSlot3(null);
    } else {
      if (slot === 1) setRightSlot1(null);
      if (slot === 2) setRightSlot2(null);
      if (slot === 3) setRightSlot3(null);
    }

    // If clearing a defense item (slot 1), deactivate shield immediately
    if (slot === 1 && currentItem === 'LAL_def_ironman_armor') {
      const castleId = `${battleId}-${side}`;
      console.log(`🛡️ [PreGameItemSelector] Clearing Ironman Armor from ${side} side, deactivating shield`);

      castleHealthSystem.deactivateShield(castleId);
      const castle = castleManager.getCastle(battleId, castleId);
      if (castle) {
        castle.deactivateShield();
        console.log(`✅ [PreGameItemSelector] Shield deactivated for ${side.toUpperCase()} castle`);
      }
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

    // Immediately activate/deactivate shields for defense items
    activateDefenseItems();

    // Close popup
    onClose?.();
  };

  /**
   * Immediately activate or deactivate shields when defense items are equipped/unequipped
   */
  const activateDefenseItems = () => {
    // Left side - slot 1 (defense)
    if (leftSlot1 === 'LAL_def_ironman_armor') {
      const castleId = `${battleId}-left`;
      const shieldHP = 5; // Default shield HP for testing (will be random 3-8 in real game)

      console.log(`🛡️ [PreGameItemSelector] Activating Ironman Armor shield for LEFT castle`);

      // Activate shield in system
      castleHealthSystem.activateShield(castleId, shieldHP, 0, 'LAL_def_ironman_armor');

      // Activate shield visual
      const castle = castleManager.getCastle(battleId, castleId);
      console.log(`🔍 [PreGameItemSelector] Looking for castle: ${castleId}, found:`, castle ? 'YES' : 'NO');
      if (castle) {
        castle.activateShield({
          id: 'LAL_def_ironman_armor',
          name: 'AC "Ironman" Armor',
          description: 'Castle shield',
          icon: '🛡️',
          shieldHP: shieldHP,
          shieldActivationThreshold: 0,
        });
        console.log(`✅ [PreGameItemSelector] Shield activated for LEFT castle`);
      } else {
        console.error(`❌ [PreGameItemSelector] Castle not found: ${castleId}`);
      }
    } else {
      // Deactivate shield if item was unequipped
      const castleId = `${battleId}-left`;
      const shield = castleHealthSystem.getShield(castleId);
      if (shield && shield.itemId === 'LAL_def_ironman_armor') {
        console.log(`🛡️ [PreGameItemSelector] Deactivating Ironman Armor shield for LEFT castle`);
        castleHealthSystem.deactivateShield(castleId);
        const castle = castleManager.getCastle(battleId, castleId);
        if (castle) {
          castle.deactivateShield();
        }
      }
    }

    // Right side - slot 1 (defense)
    if (rightSlot1 === 'LAL_def_ironman_armor') {
      const castleId = `${battleId}-right`;
      const shieldHP = 5; // Default shield HP for testing

      console.log(`🛡️ [PreGameItemSelector] Activating Ironman Armor shield for RIGHT castle`);

      // Activate shield in system
      castleHealthSystem.activateShield(castleId, shieldHP, 0, 'LAL_def_ironman_armor');

      // Activate shield visual
      const castle = castleManager.getCastle(battleId, castleId);
      console.log(`🔍 [PreGameItemSelector] Looking for castle: ${castleId}, found:`, castle ? 'YES' : 'NO');
      if (castle) {
        castle.activateShield({
          id: 'LAL_def_ironman_armor',
          name: 'AC "Ironman" Armor',
          description: 'Castle shield',
          icon: '🛡️',
          shieldHP: shieldHP,
          shieldActivationThreshold: 0,
        });
        console.log(`✅ [PreGameItemSelector] Shield activated for RIGHT castle`);
      } else {
        console.error(`❌ [PreGameItemSelector] Castle not found: ${castleId}`);
      }
    } else {
      // Deactivate shield if item was unequipped
      const castleId = `${battleId}-right`;
      const shield = castleHealthSystem.getShield(castleId);
      if (shield && shield.itemId === 'LAL_def_ironman_armor') {
        console.log(`🛡️ [PreGameItemSelector] Deactivating Ironman Armor shield for RIGHT castle`);
        castleHealthSystem.deactivateShield(castleId);
        const castle = castleManager.getCastle(battleId, castleId);
        if (castle) {
          castle.deactivateShield();
        }
      }
    }
  };

  /**
   * Show tooltip on hover over equipped item
   */
  const handleItemHover = (
    event: React.MouseEvent,
    item: ItemDefinition,
    rolls: Record<string, number>,
    quality: 'Warped' | 'Balanced' | 'Honed' | 'Masterwork'
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipData({
      item,
      rolls,
      quality,
      x: rect.right + 10,
      y: rect.top,
    });
  };

  /**
   * Hide tooltip
   */
  const handleItemLeave = () => {
    setTooltipData(null);
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
        onMouseEnter={(e) => {
          if (item) {
            handleItemHover(e, item, testRolls, calculateQuality());
          }
        }}
        onMouseLeave={handleItemLeave}
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

  const renderSlotPreview = (side: 'left' | 'right', slot: 1 | 2 | 3) => {
    const slotType = slot === 1 ? 'DEFENSE' : slot === 2 ? 'ATTACK' : 'UNIQUE';
    const slotIcon = slot === 1 ? '🛡️' : slot === 2 ? '⚔️' : '✨';
    const itemId = getSlotItem(side, slot);
    const item = itemId ? getItemDefinition(itemId) : null;

    // Generate test rolls for tooltip (in real game, these come from item instance)
    const testRolls = item?.rollRanges ? Object.keys(item.rollRanges).reduce((acc, key) => {
      const range = item.rollRanges![key];
      // Random roll between min and max
      acc[key] = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      return acc;
    }, {} as Record<string, number>) : {};

    // Calculate quality based on rolls
    const calculateQuality = (): 'Warped' | 'Balanced' | 'Honed' | 'Masterwork' => {
      if (!item?.rollRanges) return 'Balanced';
      const rollKeys = Object.keys(item.rollRanges);
      let totalScore = 0;
      let maxScore = 0;
      for (const key of rollKeys) {
        const range = item.rollRanges[key];
        const roll = testRolls[key];
        if (roll !== undefined) {
          totalScore += roll - range.min;
          maxScore += range.max - range.min;
        }
      }
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 50;
      if (percentage >= 90) return 'Masterwork';
      if (percentage >= 65) return 'Honed';
      if (percentage >= 35) return 'Balanced';
      return 'Warped';
    };

    return (
      <div
        key={`${side}-${slot}`}
        style={{
          padding: '12px',
          marginBottom: '8px',
          background: 'rgba(255, 215, 0, 0.1)',
          border: '2px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        onClick={() => setSelectedSlot({ side, slot })}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 215, 0, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
          // Show tooltip if item is equipped
          if (item) {
            handleItemHover(e, item, testRolls, calculateQuality());
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
          handleItemLeave();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>{slotIcon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#ffd700', fontWeight: 'bold', marginBottom: '4px' }}>
              Slot {slot}: {slotType}
            </div>
            <div style={{ color: item ? '#4ecdc4' : '#888', fontSize: '14px' }}>
              {item ? item.name : 'Empty'}
            </div>
          </div>
          <div style={{ color: '#ffd700', fontSize: '18px' }}>→</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Main Popup Overlay - Always visible when component is rendered */}
      <div className="item-picker-overlay" onClick={onClose}>
        <div className="item-picker-popup" onClick={(e) => e.stopPropagation()}>
          {selectedSlot ? (
            <>
              {/* Item Picker - Shows when a slot is selected */}
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
            </>
          ) : (
            <>
              {/* Main View - Shows all equipped items */}
              <div className="picker-header">
                <h3>⚔️ EQUIPPED ITEMS</h3>
                <p>Click a slot to change items</p>
              </div>

              <div className="picker-body">
                {/* Left Side Slots */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#ffd700', marginBottom: '12px' }}>LEFT CAPPER</h4>
                  {renderSlotPreview('left', 1)}
                  {renderSlotPreview('left', 2)}
                  {renderSlotPreview('left', 3)}
                </div>

                {/* Right Side Slots */}
                <div>
                  <h4 style={{ color: '#ffd700', marginBottom: '12px' }}>RIGHT CAPPER</h4>
                  {renderSlotPreview('right', 1)}
                  {renderSlotPreview('right', 2)}
                  {renderSlotPreview('right', 3)}
                </div>
              </div>

              <div className="picker-footer">
                <button className="save-button" onClick={handleSaveAndClose}>
                  💾 Save & Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltipData.x}px`,
            top: `${tooltipData.y}px`,
            zIndex: 10000,
          }}
          data-quality={tooltipData.quality}
        >
          <ItemTooltip
            item={tooltipData.item}
            rolls={tooltipData.rolls}
            quality={tooltipData.quality}
          />
        </div>
      )}
    </>
  );
};

