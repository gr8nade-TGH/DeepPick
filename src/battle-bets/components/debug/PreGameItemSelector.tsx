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
import type { ItemDefinition, RolledItemStats } from '../../game/items/ItemRollSystem';
import { rollItem } from '../../game/items/ItemRollSystem';
import { useMultiGameStore } from '../../store/multiGameStore';
import { castleHealthSystem } from '../../game/systems/CastleHealthSystem';
import { castleManager } from '../../game/managers/CastleManager';
import { itemEffectRegistry } from '../../game/items/ItemEffectRegistry';
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
  const [leftSlot1, setLeftSlot1] = useState<RolledItemStats | null>(
    typeof battle?.game.leftCapper.equippedItems?.slot1 === 'object'
      ? battle.game.leftCapper.equippedItems.slot1
      : null
  );
  const [leftSlot2, setLeftSlot2] = useState<RolledItemStats | null>(
    typeof battle?.game.leftCapper.equippedItems?.slot2 === 'object'
      ? battle.game.leftCapper.equippedItems.slot2
      : null
  );
  const [leftSlot3, setLeftSlot3] = useState<RolledItemStats | null>(
    typeof battle?.game.leftCapper.equippedItems?.slot3 === 'object'
      ? battle.game.leftCapper.equippedItems.slot3
      : null
  );

  const [rightSlot1, setRightSlot1] = useState<RolledItemStats | null>(
    typeof battle?.game.rightCapper.equippedItems?.slot1 === 'object'
      ? battle.game.rightCapper.equippedItems.slot1
      : null
  );
  const [rightSlot2, setRightSlot2] = useState<RolledItemStats | null>(
    typeof battle?.game.rightCapper.equippedItems?.slot2 === 'object'
      ? battle.game.rightCapper.equippedItems.slot2
      : null
  );
  const [rightSlot3, setRightSlot3] = useState<RolledItemStats | null>(
    typeof battle?.game.rightCapper.equippedItems?.slot3 === 'object'
      ? battle.game.rightCapper.equippedItems.slot3
      : null
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
    if (!battle) {
      console.error('❌ [PreGameItemSelector] Cannot save items - battle is null!');
      return;
    }

    console.log('💾💾💾 [PreGameItemSelector] Saving equipped items to battle:', {
      battleId,
      left: { slot1: leftSlot1, slot2: leftSlot2, slot3: leftSlot3 },
      right: { slot1: rightSlot1, slot2: rightSlot2, slot3: rightSlot3 }
    });

    console.log('💾 [PreGameItemSelector] Current battle state BEFORE update:', {
      leftCapper: battle.game.leftCapper.equippedItems,
      rightCapper: battle.game.rightCapper.equippedItems
    });

    updateBattle(battleId, (b) => {
      const updated = {
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
      };

      console.log('💾 [PreGameItemSelector] Updated battle state:', {
        leftCapper: updated.game.leftCapper.equippedItems,
        rightCapper: updated.game.rightCapper.equippedItems
      });

      return updated;
    });

    // Verify the update worked
    setTimeout(() => {
      const updatedBattle = useMultiGameStore.getState().getBattle(battleId);
      console.log('💾 [PreGameItemSelector] Battle state AFTER update (verified):', {
        leftCapper: updatedBattle?.game.leftCapper.equippedItems,
        rightCapper: updatedBattle?.game.rightCapper.equippedItems
      });
    }, 100);

    // Notify parent of changes (convert RolledItemStats to item IDs for backward compatibility)
    const leftItems = [leftSlot1, leftSlot2, leftSlot3]
      .filter(Boolean)
      .map(item => item!.itemId);
    const rightItems = [rightSlot1, rightSlot2, rightSlot3]
      .filter(Boolean)
      .map(item => item!.itemId);
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

    // Roll the item to get random stats
    const rolledItem = rollItem(item);
    console.log('🎲 Item rolled and selected:', { itemId, side, slot, rolls: rolledItem.rolls, quality: rolledItem.qualityTier });

    if (side === 'left') {
      if (slot === 1) setLeftSlot1(rolledItem);
      if (slot === 2) setLeftSlot2(rolledItem);
      if (slot === 3) setLeftSlot3(rolledItem);
    } else {
      if (slot === 1) setRightSlot1(rolledItem);
      if (slot === 2) setRightSlot2(rolledItem);
      if (slot === 3) setRightSlot3(rolledItem);
    }

    // Close the slot selector but keep popup open
    setSelectedSlot(null);
  };

  const handleClearSlot = () => {
    if (!selectedSlot) return;

    const { side, slot } = selectedSlot;

    // Get the current item before clearing
    let currentItem: RolledItemStats | null = null;
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
    if (slot === 1 && currentItem?.itemId === 'LAL_def_ironman_armor') {
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

  const handleSaveAndClose = async () => {
    console.log('💾💾💾 [PreGameItemSelector] SAVE AND CLOSE CLICKED!');
    console.log('💾 [PreGameItemSelector] Saving items:', {
      left: { slot1: leftSlot1, slot2: leftSlot2, slot3: leftSlot3 },
      right: { slot1: rightSlot1, slot2: rightSlot2, slot3: rightSlot3 }
    });

    try {
      // Save to battle state
      updateBattleEquippedItems();

      // Immediately activate/deactivate shields for defense items
      activateDefenseItems();

      // Activate item effects (event listeners for DEFENSE_ORB_DESTROYED, etc.)
      console.log('💾 [PreGameItemSelector] About to call activateItemEffects()...');
      await activateItemEffects();
      console.log('💾 [PreGameItemSelector] activateItemEffects() completed!');

      // Close popup
      onClose?.();
    } catch (error) {
      console.error('❌ [PreGameItemSelector] Error in handleSaveAndClose:', error);
      alert(`Error saving items: ${error}`);
    }
  };

  /**
   * Immediately activate or deactivate shields when defense items are equipped/unequipped
   */
  const activateDefenseItems = () => {
    // Left side - slot 1 (defense)
    if (leftSlot1?.itemId === 'LAL_def_ironman_armor') {
      const castleId = `${battleId}-left`;
      const shieldHP = leftSlot1.rolls.startShieldHp; // Use the rolled shield HP!

      console.log(`🛡️ [PreGameItemSelector] Activating Ironman Armor shield for LEFT castle with ${shieldHP} HP (rolled)`);

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
      if (shield && shield.source === 'LAL_def_ironman_armor') {
        console.log(`🛡️ [PreGameItemSelector] Deactivating Ironman Armor shield for LEFT castle`);
        castleHealthSystem.deactivateShield(castleId);
        const castle = castleManager.getCastle(battleId, castleId);
        if (castle) {
          castle.deactivateShield();
        }
      }
    }

    // Right side - slot 1 (defense)
    if (rightSlot1?.itemId === 'LAL_def_ironman_armor') {
      const castleId = `${battleId}-right`;
      const shieldHP = rightSlot1.rolls.startShieldHp; // Use the rolled shield HP!

      console.log(`🛡️ [PreGameItemSelector] Activating Ironman Armor shield for RIGHT castle with ${shieldHP} HP (rolled)`);

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
      if (shield && shield.source === 'LAL_def_ironman_armor') {
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
   * Activate item effects (register event listeners)
   * This is called when "APPLY ITEMS" is clicked
   */
  const activateItemEffects = async () => {
    console.log('🎮🎮🎮 [PreGameItemSelector] ACTIVATING ITEM EFFECTS!');
    console.log('🎮 [PreGameItemSelector] Battle ID:', battleId);

    try {
      // Deactivate all existing items for this battle first (cleanup)
      console.log('🎮 [PreGameItemSelector] Deactivating existing items...');
      itemEffectRegistry.deactivateGame(battleId);

      // Activate left side items
      if (leftSlot1) {
        console.log(`🎮 [PreGameItemSelector] Activating LEFT slot 1: ${leftSlot1.itemId}`);
        await itemEffectRegistry.activateItem(battleId, 'left', leftSlot1);
        console.log(`✅ [PreGameItemSelector] Activated ${leftSlot1.itemId} on LEFT side`);
      }
      if (leftSlot2) {
        console.log(`🎮 [PreGameItemSelector] Activating LEFT slot 2: ${leftSlot2.itemId}`);
        await itemEffectRegistry.activateItem(battleId, 'left', leftSlot2);
        console.log(`✅ [PreGameItemSelector] Activated ${leftSlot2.itemId} on LEFT side`);
      }
      if (leftSlot3) {
        console.log(`🎮 [PreGameItemSelector] Activating LEFT slot 3: ${leftSlot3.itemId}`);
        await itemEffectRegistry.activateItem(battleId, 'left', leftSlot3);
        console.log(`✅ [PreGameItemSelector] Activated ${leftSlot3.itemId} on LEFT side`);
      }

      // Activate right side items
      if (rightSlot1) {
        console.log(`🎮 [PreGameItemSelector] Activating RIGHT slot 1: ${rightSlot1.itemId}`);
        await itemEffectRegistry.activateItem(battleId, 'right', rightSlot1);
        console.log(`✅ [PreGameItemSelector] Activated ${rightSlot1.itemId} on RIGHT side`);
      }
      if (rightSlot2) {
        console.log(`🎮 [PreGameItemSelector] Activating RIGHT slot 2: ${rightSlot2.itemId}`);
        await itemEffectRegistry.activateItem(battleId, 'right', rightSlot2);
        console.log(`✅ [PreGameItemSelector] Activated ${rightSlot2.itemId} on RIGHT side`);
      }
      if (rightSlot3) {
        console.log(`🎮 [PreGameItemSelector] Activating RIGHT slot 3: ${rightSlot3.itemId}`);
        await itemEffectRegistry.activateItem(battleId, 'right', rightSlot3);
        console.log(`✅ [PreGameItemSelector] Activated ${rightSlot3.itemId} on RIGHT side`);
      }

      console.log('✅✅✅ [PreGameItemSelector] ALL ITEM EFFECTS ACTIVATED!');
    } catch (error) {
      console.error('❌ [PreGameItemSelector] Error activating item effects:', error);
      throw error;
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
    const tooltipInfo = {
      item,
      rolls,
      quality,
      x: rect.right + 10,
      y: rect.top,
    };
    console.log('🎯 [PreGameItemSelector] Showing tooltip:', tooltipInfo);
    setTooltipData(tooltipInfo);
  };

  /**
   * Hide tooltip
   */
  const handleItemLeave = () => {
    setTooltipData(null);
  };

  const getSlotItem = (side: 'left' | 'right', slot: 1 | 2 | 3): RolledItemStats | null => {
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
    const rolledItem = getSlotItem(side, slot);
    const item = rolledItem ? getItemDefinition(rolledItem.itemId) : null;
    const isSelected = selectedSlot?.side === side && selectedSlot?.slot === slot;

    return (
      <div
        className={`pre-game-slot ${rolledItem ? 'equipped' : 'empty'} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleSlotClick(side, slot)}
        onMouseEnter={(e) => {
          if (item && rolledItem) {
            handleItemHover(e, item, rolledItem.rolls, rolledItem.qualityTier);
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
    const rolledItem = getSlotItem(side, slot);
    const item = rolledItem ? getItemDefinition(rolledItem.itemId) : null;

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
          if (item && rolledItem) {
            handleItemHover(e, item, rolledItem.rolls, rolledItem.qualityTier);
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
            zIndex: 10001,
            pointerEvents: 'none',
          }}
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

