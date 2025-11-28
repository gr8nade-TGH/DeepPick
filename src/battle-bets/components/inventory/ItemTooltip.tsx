/**
 * ItemTooltip - Diablo 4 inspired item tooltip
 *
 * UNIFIED tooltip that works with BOTH:
 * 1. InventoryItemInstance (from inventory store)
 * 2. ItemDefinition + rolls + quality (from game item system)
 *
 * Features:
 * - Quality tier colored header with gradient
 * - Ornate border design
 * - Stat display with icons (arrows, diamonds, stars)
 * - Compact but detailed layout
 */

import React from 'react';
import type { InventoryItemInstance } from '../../store/inventoryStore';
import type { ItemDefinition, QualityTier, StatRollRange } from '../../game/items/ItemRollSystem';
import { getItemDefinition } from '../../game/items/ItemTestUtils';
import './ItemTooltip.css';

// Quality tier styling
const QUALITY_STYLES: Record<string, {
  headerBg: string;
  borderColor: string;
  titleColor: string;
  glowColor: string;
  tierName: string;
}> = {
  Warped: {
    headerBg: 'linear-gradient(180deg, #4a4a4a 0%, #2d2d2d 100%)',
    borderColor: '#6b7280',
    titleColor: '#9ca3af',
    glowColor: 'rgba(107, 114, 128, 0.3)',
    tierName: 'Common',
  },
  Balanced: {
    headerBg: 'linear-gradient(180deg, #1e40af 0%, #1e3a5f 100%)',
    borderColor: '#3b82f6',
    titleColor: '#60a5fa',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    tierName: 'Magic',
  },
  Honed: {
    headerBg: 'linear-gradient(180deg, #6b21a8 0%, #4c1d6e 100%)',
    borderColor: '#a855f7',
    titleColor: '#c084fc',
    glowColor: 'rgba(168, 85, 247, 0.5)',
    tierName: 'Rare',
  },
  Masterwork: {
    headerBg: 'linear-gradient(180deg, #b45309 0%, #78350f 100%)',
    borderColor: '#f59e0b',
    titleColor: '#fbbf24',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    tierName: 'Legendary',
  },
};

// Slot type display names
const SLOT_NAMES: Record<string, string> = {
  defense: 'Defensive Item',
  power: 'Power Item',
  weapon: 'Weapon',
  castle: 'Castle',
};

/**
 * Props - supports TWO modes:
 * 1. inventoryItem: Pass an InventoryItemInstance directly
 * 2. item + rolls + qualityTier: Pass ItemDefinition with rolled stats (game mode)
 */
interface ItemTooltipProps {
  // Mode 1: From inventory
  inventoryItem?: InventoryItemInstance;
  // Mode 2: From game (ItemDefinition + rolls)
  item?: ItemDefinition;
  rolls?: Record<string, number>;
  qualityTier?: QualityTier;
  qualityScore?: number;
  // Shared
  style?: React.CSSProperties;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({
  inventoryItem,
  item,
  rolls,
  qualityTier,
  qualityScore,
  style
}) => {
  // If only inventoryItem is provided, look up the full item definition
  // This ensures we have rollRanges, description, and teamName
  const lookedUpDefinition = inventoryItem && !item
    ? getItemDefinition(inventoryItem.itemId)
    : null;

  // Prefer explicitly passed item, fallback to looked up definition
  const itemDef = item || lookedUpDefinition;

  // Normalize data from either source
  // IMPORTANT: Always prefer itemDef (canonical definition) for name/icon/slot/description
  // Only use inventoryItem values as fallback if no definition found
  const name = itemDef?.name || inventoryItem?.name || 'Unknown Item';
  const icon = itemDef?.icon || inventoryItem?.icon || '❓';
  const slot = itemDef?.slot || inventoryItem?.slot || 'defense';
  const tier = inventoryItem?.qualityTier || qualityTier || 'Balanced';
  const score = inventoryItem?.qualityScore ?? qualityScore ?? 50;
  const stats = inventoryItem?.rolledStats || rolls || {};
  const rollRanges = itemDef?.rollRanges;
  const description = itemDef?.description;
  const teamName = itemDef?.teamName;

  const quality = QUALITY_STYLES[tier] || QUALITY_STYLES.Balanced;

  // Format stat name for display
  const formatStatName = (key: string): string => {
    // Special handling for known stats
    switch (key) {
      case 'startShieldHp': return 'Shield Strength';
      case 'hpPerDestroyedOrb': return 'Shield Regen per Orb';
      case 'ptsThreshold': return 'PTS Threshold';
      case 'bonusProjectiles': return 'Bonus Projectiles';
      case 'ptsSpeedBoost': return 'PTS Speed Boost';
      case 'bonusStatSpeedBoost': return 'Bonus Stat Speed';
      case 'castleHP': return 'Castle HP';
      case 'shieldCharges': return 'Shield Charges';
      default:
        return key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s) => s.toUpperCase())
          .replace(/Hp/g, 'HP')
          .replace(/Per /g, 'per ')
          .trim();
    }
  };

  // Get stat entries (filter out internal stats like bonusStat)
  const statEntries = Object.entries(stats).filter(([key]) => key !== 'bonusStat');

  // Calculate quality percentage for display
  const qualityPercent = Math.round(score);

  // Check if stat is at max roll
  const isMaxRoll = (key: string, value: number): boolean => {
    if (!rollRanges?.[key]) return false;
    return value >= rollRanges[key].max;
  };

  // Get range display for a stat
  const getRangeDisplay = (key: string): string | null => {
    if (!rollRanges?.[key]) return null;
    const range = rollRanges[key];
    const suffix = (key === 'ptsSpeedBoost' || key === 'bonusStatSpeedBoost') ? '%' : '';
    return `(${range.min}${suffix}-${range.max}${suffix})`;
  };

  return (
    <div className="d4-item-tooltip" style={style}>
      {/* Ornate border frame */}
      <div className="d4-tooltip-frame" style={{ borderColor: quality.borderColor }}>
        {/* Corner ornaments */}
        <div className="d4-corner-ornament top-left" style={{ borderColor: quality.borderColor }} />
        <div className="d4-corner-ornament top-right" style={{ borderColor: quality.borderColor }} />
        <div className="d4-corner-ornament bottom-left" style={{ borderColor: quality.borderColor }} />
        <div className="d4-corner-ornament bottom-right" style={{ borderColor: quality.borderColor }} />

        {/* Header with item name */}
        <div className="d4-tooltip-header" style={{ background: quality.headerBg }}>
          <div className="d4-item-icon-large">{icon}</div>
          <div className="d4-item-title" style={{ color: quality.titleColor }}>
            {name}
          </div>
          <div className="d4-item-type">
            {quality.tierName} {SLOT_NAMES[slot]}
          </div>
          {teamName && <div className="d4-item-team">{teamName}</div>}
        </div>

        {/* Item Power / Quality Score */}
        <div className="d4-item-power">
          <span className="d4-power-value" style={{ color: quality.titleColor }}>
            {qualityPercent}
          </span>
          <span className="d4-power-label">Quality Score</span>
        </div>

        {/* Divider */}
        <div className="d4-tooltip-divider" style={{ background: quality.borderColor }} />

        {/* Primary Stats */}
        <div className="d4-stats-section">
          {statEntries.map(([key, value]) => {
            const isMax = isMaxRoll(key, value);
            const rangeStr = getRangeDisplay(key);
            const suffix = (key === 'ptsSpeedBoost' || key === 'bonusStatSpeedBoost') ? '%' : '';

            return (
              <div key={key} className="d4-stat-row primary">
                <span className="d4-stat-icon">◆</span>
                <span className="d4-stat-text">
                  <span className={`d4-stat-value ${isMax ? 'd4-max-roll' : ''}`}>
                    +{value}{suffix}
                  </span>
                  {' '}{formatStatName(key)}
                  {rangeStr && <span className="d4-stat-range"> {rangeStr}</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Description / Flavor text (if available) */}
        {description && (
          <>
            <div className="d4-tooltip-divider thin" style={{ background: quality.borderColor }} />
            <div className="d4-description">{description}</div>
          </>
        )}

        {/* Special Effect (if applicable) */}
        {tier === 'Masterwork' && (
          <>
            <div className="d4-tooltip-divider thin" style={{ background: quality.borderColor }} />
            <div className="d4-special-effect">
              <span className="d4-star-icon">★</span>
              <span className="d4-effect-text">Legendary quality - Maximum stat potential</span>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="d4-tooltip-footer">
          <div className="d4-footer-row">
            <span className="d4-footer-label">Quality:</span>
            <span className="d4-footer-value" style={{ color: quality.titleColor }}>{tier}</span>
          </div>
          {inventoryItem && (
            <div className="d4-footer-row">
              <span className="d4-footer-label">Source:</span>
              <span className="d4-footer-value">{inventoryItem.source.replace('_', ' ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

