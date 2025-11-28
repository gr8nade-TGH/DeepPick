/**
 * EquipmentSlots - Team equipment display with castle visual and 3 item slots
 *
 * Shows equipped items for a team with drop zones for equipping
 * Features castle SVG visualization and Diablo-style tooltips
 */

import React, { useState, useRef } from 'react';
import { type TeamEquipment, type InventoryItemInstance } from '../../store/inventoryStore';
import { ItemTooltip } from './ItemTooltip';

// Quality tier colors
const QUALITY_COLORS: Record<string, { border: string; glow: string }> = {
  Warped: { border: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)' },
  Balanced: { border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)' },
  Honed: { border: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)' },
  Masterwork: { border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.7)' },
};

// Castle SVG component with quality-based styling
const CastleVisual: React.FC<{ qualityTier?: string; size?: number }> = ({
  qualityTier = 'Balanced',
  size = 60
}) => {
  const colors = QUALITY_COLORS[qualityTier] || QUALITY_COLORS.Balanced;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Glow filter */}
      <defs>
        <filter id="castleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Castle base */}
      <rect x="8" y="40" width="48" height="20" fill="#374151" stroke={colors.border} strokeWidth="2" />

      {/* Castle main body */}
      <rect x="12" y="24" width="40" height="20" fill="#1f2937" stroke={colors.border} strokeWidth="1.5" />

      {/* Left tower */}
      <rect x="4" y="16" width="14" height="28" fill="#1f2937" stroke={colors.border} strokeWidth="1.5" />
      <rect x="4" y="10" width="4" height="8" fill="#374151" stroke={colors.border} strokeWidth="1" />
      <rect x="10" y="10" width="4" height="8" fill="#374151" stroke={colors.border} strokeWidth="1" />

      {/* Right tower */}
      <rect x="46" y="16" width="14" height="28" fill="#1f2937" stroke={colors.border} strokeWidth="1.5" />
      <rect x="46" y="10" width="4" height="8" fill="#374151" stroke={colors.border} strokeWidth="1" />
      <rect x="52" y="10" width="4" height="8" fill="#374151" stroke={colors.border} strokeWidth="1" />

      {/* Center tower */}
      <rect x="24" y="8" width="16" height="20" fill="#1f2937" stroke={colors.border} strokeWidth="1.5" />
      <polygon points="32,2 40,10 24,10" fill="#374151" stroke={colors.border} strokeWidth="1" />

      {/* Gate */}
      <rect x="26" y="44" width="12" height="16" rx="6" fill="#0f172a" stroke={colors.border} strokeWidth="1" />

      {/* Windows */}
      <circle cx="11" cy="28" r="2" fill={colors.glow} filter="url(#castleGlow)" />
      <circle cx="53" cy="28" r="2" fill={colors.glow} filter="url(#castleGlow)" />
      <circle cx="32" cy="18" r="2" fill={colors.glow} filter="url(#castleGlow)" />
    </svg>
  );
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
  const [isOver, setIsOver] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const slotRef = useRef<HTMLDivElement>(null);
  const colors = item ? QUALITY_COLORS[item.qualityTier] || QUALITY_COLORS.Balanced : null;

  const handleMouseEnter = () => {
    if (item) {
      const rect = slotRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({
          x: rect.right + 10,
          y: rect.top - 20,
        });
      }
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      ref={slotRef}
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: isCastle ? '90px' : '48px',
        height: isCastle ? '90px' : '48px',
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
    >
      {isCastle ? (
        // Castle visual
        item ? (
          <CastleVisual qualityTier={item.qualityTier} size={70} />
        ) : (
          <CastleVisual qualityTier="Warped" size={50} />
        )
      ) : (
        // Regular item slot
        item ? (
          <span style={{ fontSize: '22px' }}>{item.icon}</span>
        ) : (
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
        )
      )}

      {/* Tooltip */}
      {item && showTooltip && (
        <ItemTooltip
          item={item}
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        />
      )}
    </div>
  );
};

