/**
 * InventoryModal - Diablo-style inventory grid with drag & drop
 * 
 * Features:
 * - Dark medieval aesthetic
 * - Grid-based inventory layout
 * - Category tabs (Defense, Offense, Castle, All)
 * - Equipment slots at top for selected team
 * - Drag and drop to equip items
 */

import React, { useState } from 'react';
import { useInventoryStore, type InventoryItemInstance } from '../../store/inventoryStore';
import { InventoryGrid } from './InventoryGrid';
import { EquipmentSlots } from './EquipmentSlots';
import './InventoryModal.css';

type TabType = 'ALL' | 'DEFENSE' | 'OFFENSE' | 'CASTLE';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTeamId?: string;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  initialTeamId = 'BOS',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [selectedTeam, setSelectedTeam] = useState(initialTeamId);
  const [draggedItem, setDraggedItem] = useState<InventoryItemInstance | null>(null);
  
  const { items, gold, capacity, getTeamEquipment, equipItem, unequipItem } = useInventoryStore();

  if (!isOpen) return null;

  // Filter items by category
  const filteredItems = items.filter((item) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'DEFENSE') return item.slot === 'defense';
    if (activeTab === 'OFFENSE') return item.slot === 'power' || item.slot === 'weapon';
    if (activeTab === 'CASTLE') return item.slot === 'castle';
    return true;
  });

  const teamEquipment = getTeamEquipment(selectedTeam);

  const handleDragStart = (item: InventoryItemInstance) => {
    setDraggedItem(item);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDropOnSlot = (slot: 'castle' | 'slot1' | 'slot2' | 'slot3') => {
    if (!draggedItem) return;
    
    // Validate slot type matches item slot
    if (slot === 'castle' && draggedItem.slot !== 'castle') {
      console.warn('Cannot equip non-castle item to castle slot');
      return;
    }
    if (slot !== 'castle' && draggedItem.slot === 'castle') {
      console.warn('Cannot equip castle item to regular slot');
      return;
    }
    
    equipItem(selectedTeam, slot, draggedItem);
    setDraggedItem(null);
  };

  const handleUnequip = (slot: 'castle' | 'slot1' | 'slot2' | 'slot3') => {
    unequipItem(selectedTeam, slot);
  };

  // Available teams for selection
  const teams = ['BOS', 'LAL', 'MIA', 'GSW', 'CHI', 'NYK'];

  return (
    <div className="inventory-modal-overlay" onClick={onClose}>
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="inventory-header">
          <h2>⚔️ INVENTORY</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Team Selector */}
        <div className="team-selector">
          <span className="team-label">TEAM:</span>
          {teams.map((team) => (
            <button
              key={team}
              className={`team-btn ${selectedTeam === team ? 'active' : ''}`}
              onClick={() => setSelectedTeam(team)}
            >
              {team}
            </button>
          ))}
        </div>

        {/* Equipment Slots */}
        <EquipmentSlots
          teamId={selectedTeam}
          equipment={teamEquipment}
          onDropOnSlot={handleDropOnSlot}
          onUnequip={handleUnequip}
          draggedItem={draggedItem}
        />

        {/* Category Tabs */}
        <div className="inventory-tabs">
          {(['ALL', 'DEFENSE', 'OFFENSE', 'CASTLE'] as TabType[]).map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'ALL' && '📦'}
              {tab === 'DEFENSE' && '🛡️'}
              {tab === 'OFFENSE' && '⚔️'}
              {tab === 'CASTLE' && '🏰'}
              {' '}{tab}
            </button>
          ))}
        </div>

        {/* Inventory Grid */}
        <InventoryGrid
          items={filteredItems}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          draggedItem={draggedItem}
        />

        {/* Footer - Gold & Capacity */}
        <div className="inventory-footer">
          <div className="stash-info">
            <span className="gold">💰 {gold.toLocaleString()}</span>
            <span className="capacity">📦 {items.length}/{capacity}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

