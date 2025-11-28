/**
 * EquipmentSlots - Team equipment display with castle and 3 item slots
 * 
 * Shows equipped items for a team with drop zones for equipping
 */

import React from 'react';
import { type TeamEquipment, type InventoryItemInstance } from '../../store/inventoryStore';

// Quality tier colors
const QUALITY_COLORS: Record<string, { border: string; glow: string }> = {
  Warped: { border: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)' },
  Balanced: { border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
  Honed: { border: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)' },
  Masterwork: { border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.7)' },
};

interface EquipmentSlotsProps {
  teamId: string;
  equipment: TeamEquipment;
  onDropOnSlot: (slot: 'castle' | 'slot1' | 'slot2' | 'slot3') => void;
  onUnequip: (slot: 'castle' | 'slot1' | 'slot2' | 'slot3') => void;
  draggedItem: InventoryItemInstance | null;
}

export const EquipmentSlots: React.FC<EquipmentSlotsProps> = ({
  teamId,
  equipment,
  onDropOnSlot,
  onUnequip,
  draggedItem,
}) => {
  // Check if dragged item can be dropped on a slot
  const canDropOnSlot = (slot: 'castle' | 'slot1' | 'slot2' | 'slot3'): boolean => {
    if (!draggedItem) return false;
    if (slot === 'castle') return draggedItem.slot === 'castle';
    return draggedItem.slot !== 'castle';
  };

  return (
    <div className="equipment-section">
      <div className="equipment-container">
        {/* Castle Slot */}
        <EquipSlot
          label="🏰"
          slotType="castle"
          item={equipment.castle}
          canDrop={canDropOnSlot('castle')}
          onDrop={() => onDropOnSlot('castle')}
          onUnequip={() => onUnequip('castle')}
          isCastle
        />

        {/* Team Badge */}
        <div className="team-badge">
          <div className="badge-inner">{teamId}</div>
          <div className="hp-bar">
            <div className="hp-fill" style={{ width: '100%' }} />
          </div>
          <span className="hp-text">20/20</span>
        </div>

        {/* Item Slots */}
        <div className="item-slots-row">
          <EquipSlot
            label="1"
            slotType="slot1"
            item={equipment.slot1}
            canDrop={canDropOnSlot('slot1')}
            onDrop={() => onDropOnSlot('slot1')}
            onUnequip={() => onUnequip('slot1')}
          />
          <EquipSlot
            label="2"
            slotType="slot2"
            item={equipment.slot2}
            canDrop={canDropOnSlot('slot2')}
            onDrop={() => onDropOnSlot('slot2')}
            onUnequip={() => onUnequip('slot2')}
          />
          <EquipSlot
            label="3"
            slotType="slot3"
            item={equipment.slot3}
            canDrop={canDropOnSlot('slot3')}
            onDrop={() => onDropOnSlot('slot3')}
            onUnequip={() => onUnequip('slot3')}
          />
        </div>
      </div>
    </div>
  );
};

interface EquipSlotProps {
  label: string;
  slotType: 'castle' | 'slot1' | 'slot2' | 'slot3';
  item: InventoryItemInstance | null;
  canDrop: boolean;
  onDrop: () => void;
  onUnequip: () => void;
  isCastle?: boolean;
}

const EquipSlot: React.FC<EquipSlotProps> = ({
  label,
  slotType,
  item,
  canDrop,
  onDrop,
  onUnequip,
  isCastle = false,
}) => {
  const [isOver, setIsOver] = React.useState(false);
  const colors = item ? QUALITY_COLORS[item.qualityTier] || QUALITY_COLORS.Balanced : null;

  return (
    <div
      className={`equip-slot ${isCastle ? 'castle-slot' : 'item-slot'} ${canDrop ? 'can-drop' : ''} ${isOver && canDrop ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        if (canDrop) {
          e.preventDefault();
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        if (canDrop) onDrop();
      }}
      onClick={() => item && onUnequip()}
      style={{
        width: isCastle ? '70px' : '48px',
        height: isCastle ? '70px' : '48px',
        background: item && colors 
          ? `linear-gradient(135deg, ${colors.glow} 0%, rgba(0,0,0,0.5) 100%)`
          : 'rgba(30, 41, 59, 0.9)',
        border: item && colors 
          ? `2px solid ${colors.border}` 
          : isOver && canDrop 
            ? '2px solid #22c55e' 
            : '2px solid #4b5563',
        borderRadius: isCastle ? '10px' : '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: item ? 'pointer' : 'default',
        boxShadow: item && colors ? `0 0 15px ${colors.glow}` : 'inset 0 0 10px rgba(0,0,0,0.5)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      title={item ? `${item.name} (${item.qualityTier}) - Click to unequip` : `${isCastle ? 'Castle' : 'Item'} Slot ${label}`}
    >
      {item ? (
        <span style={{ fontSize: isCastle ? '32px' : '22px' }}>{item.icon}</span>
      ) : (
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{isCastle ? '🏰' : label}</span>
      )}
    </div>
  );
};

