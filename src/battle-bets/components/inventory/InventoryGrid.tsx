/**
 * InventoryGrid - Diablo-style item grid
 *
 * Dark themed grid with glowing item cells based on quality tier
 * Features Diablo 4 inspired tooltips on hover
 */

import React, { useState, useRef } from 'react';
import { type InventoryItemInstance, useInventoryStore } from '../../store/inventoryStore';
import { ItemTooltip } from './ItemTooltip';

// Quality tier colors (matches Diablo style)
const QUALITY_COLORS: Record<string, { border: string; glow: string; bg: string }> = {
  Warped: { border: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', bg: 'rgba(107, 114, 128, 0.1)' },
  Balanced: { border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', bg: 'rgba(59, 130, 246, 0.1)' },
  Honed: { border: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)', bg: 'rgba(168, 85, 247, 0.15)' },
  Masterwork: { border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)', bg: 'rgba(245, 158, 11, 0.2)' },
};

// Grid dimensions
const GRID_COLS = 8;
const GRID_ROWS = 5;
const TOTAL_SLOTS = GRID_COLS * GRID_ROWS;

interface InventoryGridProps {
  items: InventoryItemInstance[];
  onDragStart: (item: InventoryItemInstance) => void;
  onDragEnd: () => void;
  draggedItem: InventoryItemInstance | null;
}

export const InventoryGrid: React.FC<InventoryGridProps> = ({
  items,
  onDragStart,
  onDragEnd,
  draggedItem,
}) => {
  const { isItemEquipped } = useInventoryStore();

  // Create array of slots (some filled, some empty)
  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => items[i] || null);

  return (
    <div className="inventory-grid-container">
      <div
        className="inventory-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gap: '4px',
          padding: '12px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          borderRadius: '8px',
          border: '2px solid #2d3748',
        }}
      >
        {slots.map((item, index) => (
          <InventorySlot
            key={index}
            item={item}
            isEquipped={item ? isItemEquipped(item.instanceId) : false}
            isDragging={item?.instanceId === draggedItem?.instanceId}
            onDragStart={() => item && onDragStart(item)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

interface InventorySlotProps {
  item: InventoryItemInstance | null;
  isEquipped: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const InventorySlot: React.FC<InventorySlotProps> = ({
  item,
  isEquipped,
  isDragging,
  onDragStart,
  onDragEnd,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const slotRef = useRef<HTMLDivElement>(null);
  const colors = item ? QUALITY_COLORS[item.qualityTier] || QUALITY_COLORS.Balanced : null;

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (item && !isDragging) {
      const rect = slotRef.current?.getBoundingClientRect();
      if (rect) {
        // Position tooltip to the right of the slot
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
      className={`inventory-slot ${item ? 'has-item' : 'empty'} ${isDragging ? 'dragging' : ''} ${isEquipped ? 'equipped' : ''}`}
      draggable={!!item && !isEquipped}
      onDragStart={(e) => {
        if (item && !isEquipped) {
          e.dataTransfer.effectAllowed = 'move';
          setShowTooltip(false);
          onDragStart();
        }
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: '52px',
        height: '52px',
        background: item && colors ? colors.bg : 'rgba(30, 41, 59, 0.8)',
        border: item && colors ? `2px solid ${colors.border}` : '2px solid #374151',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: item && !isEquipped ? 'grab' : 'default',
        opacity: isDragging ? 0.5 : isEquipped ? 0.6 : 1,
        boxShadow: item && colors ? `0 0 10px ${colors.glow}, inset 0 0 10px ${colors.glow}` : 'none',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      {item && (
        <>
          <span style={{ fontSize: '24px' }}>{item.icon}</span>
          {/* Quality tier indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              fontSize: '8px',
              color: colors?.border || '#fff',
              fontWeight: 'bold',
              textShadow: '0 0 3px #000',
            }}
          >
            {item.qualityTier.charAt(0)}
          </div>
          {/* Equipped indicator */}
          {isEquipped && (
            <div
              style={{
                position: 'absolute',
                top: '2px',
                left: '2px',
                fontSize: '10px',
              }}
            >
              ✓
            </div>
          )}
          {/* Diablo-style Tooltip */}
          {showTooltip && (
            <ItemTooltip
              inventoryItem={item}
              style={{
                position: 'fixed',
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

