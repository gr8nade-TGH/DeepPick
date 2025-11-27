/**
 * InventoryBar - Vertical item slots displayed on left and right sides of the grid
 * Shows 3 item slots per side with equipped items
 */

import React, { useEffect, useState } from 'react';
import './InventoryBar.css';
import '../debug/ItemTooltip.css';
import { castleManager } from '../../game/managers/CastleManager';
import { useMultiGameStore } from '../../store/multiGameStore';
import { LAL_IRONMAN_ARMOR_DEFINITION } from '../../game/items/effects/LAL_IronmanArmor';
import { STARTER_SHORTSWORD_DEFINITION } from '../../game/items/effects/STARTER_Shortsword';
import { CHA_HORNETS_NEST_DEFINITION } from '../../game/items/effects/CHA_HornetsNest';
import { WAS_WIZARDS_WATCHTOWER_DEFINITION } from '../../game/items/effects/WAS_WizardsWatchtower';
import { MED_KNIGHT_DEFENDER_DEFINITION } from '../../game/items/effects/MED_KnightDefender';
import { CASTLE_FORTRESS_DEFINITION, getEquippedCastle, getCastleType, getCastleRarityColor } from '../../game/items/effects/CASTLE_Fortress';
import type { ItemDefinition, RolledItemStats } from '../../game/items/ItemRollSystem';
import { ItemTooltip } from '../debug/ItemTooltip';

// Available items registry
const ITEM_REGISTRY: Record<string, ItemDefinition> = {
  [LAL_IRONMAN_ARMOR_DEFINITION.id]: LAL_IRONMAN_ARMOR_DEFINITION,
  [STARTER_SHORTSWORD_DEFINITION.id]: STARTER_SHORTSWORD_DEFINITION,
  [CHA_HORNETS_NEST_DEFINITION.id]: CHA_HORNETS_NEST_DEFINITION,
  [WAS_WIZARDS_WATCHTOWER_DEFINITION.id]: WAS_WIZARDS_WATCHTOWER_DEFINITION,
  [MED_KNIGHT_DEFENDER_DEFINITION.id]: MED_KNIGHT_DEFENDER_DEFINITION,
  // Add more items as they're implemented
};

const getItemDefinition = (itemId: string | null): ItemDefinition | null => {
  if (!itemId) return null;
  return ITEM_REGISTRY[itemId] || null;
};

interface InventoryBarProps {
  battleId: string;
  side: 'left' | 'right';
  onSlotClick?: (side: 'left' | 'right', slot: 1 | 2 | 3) => void;
  onCastleSlotClick?: (side: 'left' | 'right') => void;
}

export const InventoryBar: React.FC<InventoryBarProps> = ({ battleId, side, onSlotClick, onCastleSlotClick }) => {
  const [isFireOrbPulsing, setIsFireOrbPulsing] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    item: ItemDefinition;
    rolls: Record<string, number>;
    quality: 'Warped' | 'Balanced' | 'Honed' | 'Masterwork';
    x: number;
    y: number;
  } | null>(null);

  // Get battle and equipped items from store
  const battle = useMultiGameStore(state => state.getBattle(battleId));
  const gameStatus = battle?.game.status || 'SCHEDULED';
  const isPreGame = gameStatus === 'SCHEDULED';

  // Get equipped items from the battle's capper data
  const equippedItems = side === 'left'
    ? battle?.game.leftCapper.equippedItems || { slot1: null, slot2: null, slot3: null }
    : battle?.game.rightCapper.equippedItems || { slot1: null, slot2: null, slot3: null };

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

  // Slot types: 1 = DEFENSE (top), 2 = POWER (middle), 3 = WEAPON (bottom)
  const slots = [
    { num: 1, type: 'DEFENSE', icon: '🛡️', slotKey: 'slot1' as const },
    { num: 2, type: 'POWER', icon: '⚡', slotKey: 'slot2' as const },
    { num: 3, type: 'WEAPON', icon: '⚔️', slotKey: 'slot3' as const }
  ];

  const handleSlotClick = (slotNum: number) => {
    console.log('🖱️ Slot clicked:', { battleId, side, slotNum, isPreGame, hasCallback: !!onSlotClick });
    if (isPreGame && onSlotClick) {
      onSlotClick(side, slotNum as 1 | 2 | 3);
    } else if (!isPreGame) {
      console.log('⚠️ Cannot change items - game already started');
    } else if (!onSlotClick) {
      console.log('⚠️ No onSlotClick callback provided');
    }
  };

  const handleItemHover = (event: React.MouseEvent, item: ItemDefinition, rolledItem: RolledItemStats) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipData({
      item,
      rolls: rolledItem.rolls,
      quality: rolledItem.qualityTier,
      x: rect.right + 10,
      y: rect.top,
    });
  };

  const handleItemLeave = () => {
    setTooltipData(null);
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

  // Get equipped castle for this side
  const equippedCastle = getEquippedCastle(battleId, side);
  const castleHP = equippedCastle ? Math.round(equippedCastle.rolls.castleHP || 20) : null;
  const castleShields = equippedCastle ? Math.round(equippedCastle.rolls.shieldCharges || 1) : null;
  const castleRarity = castleHP ? getCastleType(castleHP) : null;
  const castleRarityColor = castleRarity ? getCastleRarityColor(castleRarity.rarity) : '#9CA3AF';

  const handleCastleClick = () => {
    if (isPreGame && onCastleSlotClick) {
      onCastleSlotClick(side);
    }
  };

  const handleCastleHover = (event: React.MouseEvent) => {
    if (equippedCastle) {
      const rect = event.currentTarget.getBoundingClientRect();
      // Build detailed description explaining castle mechanics
      const shieldText = castleShields === 1 ? 'charge' : 'charges';
      const description = `Deploys a Knight Defender with ${castleShields} shield ${shieldText}. Shield charges allow the knight to block projectiles without taking damage. After shields are depleted, knight uses normal deflect cooldown (takes damage if hit again within 0.5s of blocking).`;

      setTooltipData({
        item: {
          ...CASTLE_FORTRESS_DEFINITION,
          name: equippedCastle.generatedName || 'Castle',
          description,
        },
        rolls: equippedCastle.rolls,
        quality: equippedCastle.qualityTier,
        x: rect.right + 10,
        y: rect.top,
      });
    }
  };

  return (
    <div className={`inventory-bar ${side}`}>
      {/* Castle Slot - Always at top */}
      <div
        className={`inventory-slot castle-slot ${equippedCastle ? 'inventory-slot-equipped' : 'inventory-slot-empty'} ${isPreGame ? 'inventory-slot-clickable' : ''}`}
        onClick={handleCastleClick}
        onMouseEnter={handleCastleHover}
        onMouseLeave={handleItemLeave}
        style={{
          cursor: isPreGame ? 'pointer' : 'default',
          borderColor: equippedCastle ? castleRarityColor : undefined,
          boxShadow: equippedCastle ? `0 0 8px ${castleRarityColor}40` : undefined,
        }}
      >
        {equippedCastle ? (
          <div className="slot-icon-equipped castle-icon">
            <span style={{ fontSize: '1.5rem' }}>🏰</span>
            <span className="castle-hp-badge" style={{ backgroundColor: castleRarityColor }}>
              {castleHP}
            </span>
          </div>
        ) : (
          <div className="slot-icon-empty">🏰</div>
        )}
      </div>

      {/* Item Slots */}
      {slots.map((slot) => {
        const itemData = equippedItems[slot.slotKey];
        const rolledItem = typeof itemData === 'object' ? itemData : null;
        const itemId = typeof itemData === 'string' ? itemData : rolledItem?.itemId || null;
        const equippedItem = itemId ? getItemDefinition(itemId) : null;
        const isEmpty = !equippedItem;
        const isFireOrb = itemId === 'fire-orb';
        const shouldPulse = isFireOrb && isFireOrbPulsing;

        return (
          <div
            key={slot.num}
            className={`inventory-slot ${isEmpty ? 'inventory-slot-empty' : 'inventory-slot-equipped'} ${isPreGame ? 'inventory-slot-clickable' : ''}`}
            onClick={() => handleSlotClick(slot.num)}
            onMouseEnter={(e) => {
              if (!isEmpty && equippedItem && rolledItem) {
                handleItemHover(e, equippedItem, rolledItem);
              }
            }}
            onMouseLeave={handleItemLeave}
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
    </div>
  );
};

