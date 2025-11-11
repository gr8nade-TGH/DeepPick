/**
 * InventoryPopup - Modal interface for selecting and equipping items
 */

import React from 'react';
import { InventoryItem, INVENTORY_ITEMS, getRarityColor } from '../../types/inventory';
import './InventoryPopup.css';

interface InventoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: InventoryItem) => void;
  castleName: string;
  slotNumber: number;
}

export const InventoryPopup: React.FC<InventoryPopupProps> = ({
  isOpen,
  onClose,
  onSelectItem,
  castleName,
  slotNumber,
}) => {
  if (!isOpen) return null;

  const handleItemClick = (item: InventoryItem) => {
    if (!item.isImplemented) {
      alert(`${item.name} - Coming Soon!\n\nThis item is not yet implemented. Stay tuned for future updates!`);
      return;
    }
    
    onSelectItem(item);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close if clicking the overlay background (not the popup content)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="inventory-overlay" onClick={handleOverlayClick}>
      <div className="inventory-popup">
        {/* Header */}
        <div className="inventory-header">
          <h2 className="inventory-title">
            ⚔️ Select Item
          </h2>
          <p className="inventory-subtitle">
            {castleName} - Slot {slotNumber}
          </p>
          <button className="inventory-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Item Grid */}
        <div className="inventory-grid">
          {INVENTORY_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`inventory-item ${!item.isImplemented ? 'item-disabled' : ''}`}
              onClick={() => handleItemClick(item)}
              style={{
                borderColor: getRarityColor(item.rarity),
              }}
            >
              {/* Item Icon */}
              <div className="item-icon" style={{ borderColor: getRarityColor(item.rarity) }}>
                <span className="item-emoji">{item.icon}</span>
              </div>

              {/* Item Info */}
              <div className="item-info">
                <h3 className="item-name" style={{ color: getRarityColor(item.rarity) }}>
                  {item.name}
                </h3>
                <p className="item-rarity">{item.rarity.toUpperCase()}</p>
                <p className="item-description">{item.description}</p>
                
                {!item.isImplemented && (
                  <div className="item-coming-soon">
                    🔒 Coming Soon
                  </div>
                )}
                
                {item.isImplemented && (
                  <div className="item-status">
                    ✅ Available
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="inventory-footer">
          <p className="inventory-hint">
            💡 Click an item to equip it to your castle
          </p>
        </div>
      </div>
    </div>
  );
};

