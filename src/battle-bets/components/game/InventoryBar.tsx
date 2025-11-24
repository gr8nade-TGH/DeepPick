/**
 * InventoryBar - Vertical item slots displayed on left and right sides of the grid
 * Shows 3 item slots per side with equipped items
 */

import React, { useEffect, useState } from 'react';
import './InventoryBar.css';
import { castleManager } from '../../game/managers/CastleManager';
import { useMultiGameStore } from '../../store/multiGameStore';

interface InventoryBarProps {
  battleId: string;
  side: 'left' | 'right';
  onSlotClick?: (side: 'left' | 'right', slot: 1 | 2 | 3) => void;
}

export const InventoryBar: React.FC<InventoryBarProps> = ({ battleId, side, onSlotClick }) => {
  const [equippedItems, setEquippedItems] = useState<any>({ slot1: null, slot2: null, slot3: null });
  const [isFireOrbPulsing, setIsFireOrbPulsing] = useState(false);

  // Get game status to determine if slots are clickable
  const battle = useMultiGameStore(state => state.getBattle(battleId));
  const gameStatus = battle?.game.status || 'SCHEDULED';
  const isPreGame = gameStatus === 'SCHEDULED';

  // Update equipped items when castle loads
  useEffect(() => {
    const updateItems = () => {
      // In multi-battle mode, castles are keyed by `${battleId}-${side}`
      const castleId = `${battleId}-${side}`;
      let castle = castleManager.getCastle(castleId);

      // Fallback to legacy single-battle IDs if needed
      if (!castle) {
        castle = castleManager.getCastle(`castle-${side}`);
      }

      if (castle) {
        const items = castle.getEquippedItems();
        setEquippedItems(items);
      }
    };

    // Update immediately
    updateItems();

    // Update periodically (in case items change)
    const interval = setInterval(updateItems, 1000);
    return () => clearInterval(interval);
  }, [battleId, side]);

  // Listen for Fire Orb activation events
  useEffect(() => {
    const handleFireOrbActivation = (event: CustomEvent) => {
      if (event.detail.side === side) {
        console.log(`🔥 Fire Orb pulsing on ${side} side!`);
        setIsFireOrbPulsing(true);
        // Stop pulsing after 2 seconds (4 pulses × 0.5s)
        setTimeout(() => setIsFireOrbPulsing(false), 2000);
      }
    };

    window.addEventListener('fire-orb-activated' as any, handleFireOrbActivation as any);
    return () => window.removeEventListener('fire-orb-activated' as any, handleFireOrbActivation as any);
  }, [side]);

  // Slot types: 1 = ATTACK (Fire Orb), 2 = DEFENSE (Blue Shield), 3 = UNIQUE
  const slots = [
    { num: 2, type: 'DEFENSE', icon: '🛡️', slotKey: 'slot1' as const }, // Defense slot (slot 2 in UI, slot1 in data)
    { num: 1, type: 'ATTACK', icon: '⚔️', slotKey: 'slot2' as const }, // Attack slot (slot 1 in UI, slot2 in data)
    { num: 3, type: 'UNIQUE', icon: '✨', slotKey: 'slot3' as const }  // Unique slot
  ];

  const handleSlotClick = (slotNum: number) => {
    if (isPreGame && onSlotClick) {
      onSlotClick(side, slotNum as 1 | 2 | 3);
    }
  };

  // Render Blue Shield Ring SVG
  const renderBlueShieldRing = () => (
    <svg width="45" height="45" viewBox="0 0 45 45" style={{ filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))', display: 'block', margin: '0 auto' }}>
      {/* Outer glow */}
      <circle cx="22.5" cy="22.5" r="15" fill="rgba(59, 130, 246, 0.2)" />
      {/* Mid glow */}
      <circle cx="22.5" cy="22.5" r="13" fill="rgba(96, 165, 250, 0.3)" />
      {/* Main ring */}
      <circle cx="22.5" cy="22.5" r="12" fill="rgba(30, 58, 138, 0.4)" stroke="rgba(96, 165, 250, 1.0)" strokeWidth="2.5" />
      {/* Inner ring */}
      <circle cx="22.5" cy="22.5" r="9" fill="none" stroke="rgba(147, 197, 253, 0.8)" strokeWidth="1.5" />
      {/* Shield icon */}
      <path
        d="M 22.5 15.5 L 27.5 17.5 L 27.5 25.5 L 22.5 30.5 L 17.5 25.5 L 17.5 17.5 Z"
        fill="rgba(255, 255, 255, 0.95)"
        stroke="rgba(59, 130, 246, 1.0)"
        strokeWidth="1"
      />
      {/* Shield cross */}
      <rect x="21.7" y="17.5" width="1.6" height="10" fill="rgba(59, 130, 246, 0.8)" />
      <rect x="19.5" y="21.5" width="6" height="1.6" fill="rgba(59, 130, 246, 0.8)" />
      {/* Shine highlight */}
      <circle cx="19.5" cy="18.5" r="2.5" fill="rgba(255, 255, 255, 0.6)" />
      {/* Sparkle */}
      <circle cx="26.5" cy="18.5" r="1.5" fill="rgba(147, 197, 253, 0.9)" />
    </svg>
  );

  // Render Fire Ring SVG
  const renderFireRing = () => (
    <svg width="45" height="45" viewBox="0 0 45 45" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 99, 71, 0.6))', display: 'block', margin: '0 auto' }}>
      {/* Outer glow */}
      <circle cx="22.5" cy="22.5" r="15" fill="rgba(255, 69, 0, 0.3)" />
      {/* Mid glow */}
      <circle cx="22.5" cy="22.5" r="13" fill="rgba(255, 99, 71, 0.4)" />
      {/* Main ring */}
      <circle cx="22.5" cy="22.5" r="12" fill="rgba(220, 20, 60, 0.5)" stroke="rgba(255, 99, 71, 1.0)" strokeWidth="2.5" />
      {/* Inner ring */}
      <circle cx="22.5" cy="22.5" r="9" fill="none" stroke="rgba(255, 165, 0, 0.8)" strokeWidth="1.5" />
      {/* Flame icon */}
      <path
        d="M 22.5 16.5 Q 24.5 18.5 25.5 20.5 Q 26.5 22.5 25.5 24.5 Q 26.5 26.5 24.5 28.5 Q 23.5 29.5 22.5 30.5 Q 21.5 29.5 20.5 28.5 Q 18.5 26.5 19.5 24.5 Q 18.5 22.5 19.5 20.5 Q 20.5 18.5 22.5 16.5 Z"
        fill="rgba(255, 215, 0, 0.95)"
        stroke="rgba(255, 165, 0, 1.0)"
        strokeWidth="0.5"
      />
      {/* Shine highlight */}
      <circle cx="19.5" cy="19.5" r="2.5" fill="rgba(255, 255, 255, 0.7)" />
      {/* Sparkle 1 */}
      <circle cx="26.5" cy="18.5" r="1.5" fill="rgba(255, 215, 0, 0.9)" />
      {/* Sparkle 2 */}
      <circle cx="25.5" cy="26.5" r="1.2" fill="rgba(255, 165, 0, 0.8)" />
    </svg>
  );

  return (
    <div className={`inventory-bar ${side}`}>
      {slots.map((slot) => {
        const equippedItem = equippedItems[slot.slotKey];
        const isEmpty = !equippedItem;
        const isFireOrb = equippedItem?.id === 'fire-orb';
        const shouldPulse = isFireOrb && isFireOrbPulsing;

        return (
          <div
            key={slot.num}
            className={`inventory-slot ${isEmpty ? 'inventory-slot-empty' : 'inventory-slot-equipped'} ${isPreGame ? 'inventory-slot-clickable' : ''}`}
            title={isEmpty ? `${slot.type} Item Slot (Empty)` : equippedItem.name}
            onClick={() => handleSlotClick(slot.num)}
            style={{ cursor: isPreGame ? 'pointer' : 'default' }}
          >
            {isEmpty ? (
              <div className="slot-icon-empty">
                {slot.icon}
              </div>
            ) : (
              <div className={`slot-icon-equipped ${shouldPulse ? 'fire-orb-pulsing' : ''}`}>
                {equippedItem.id === 'blue-orb-shield' ? renderBlueShieldRing() :
                  equippedItem.id === 'fire-orb' ? renderFireRing() :
                    equippedItem.icon}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

