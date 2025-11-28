/**
 * ItemTooltip - Diablo 4 inspired item tooltip
 * 
 * Features:
 * - Quality tier colored header with gradient
 * - Ornate border design
 * - Stat display with icons (arrows, diamonds, stars)
 * - Compact but detailed layout
 */

import React from 'react';
import type { InventoryItemInstance } from '../../store/inventoryStore';
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

interface ItemTooltipProps {
  item: InventoryItemInstance;
  style?: React.CSSProperties;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, style }) => {
  const quality = QUALITY_STYLES[item.qualityTier] || QUALITY_STYLES.Balanced;

  // Format stat name for display
  const formatStatName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .replace(/Hp/g, 'HP')
      .replace(/Per /g, 'per ')
      .trim();
  };

  // Get stat entries
  const statEntries = Object.entries(item.rolledStats);

  // Calculate quality percentage for display
  const qualityPercent = Math.round(item.qualityScore);

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
          <div className="d4-item-icon-large">{item.icon}</div>
          <div className="d4-item-title" style={{ color: quality.titleColor }}>
            {item.name}
          </div>
          <div className="d4-item-type">
            {quality.tierName} {SLOT_NAMES[item.slot]}
          </div>
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
          {statEntries.map(([key, value], index) => (
            <div key={key} className="d4-stat-row primary">
              <span className="d4-stat-icon">→</span>
              <span className="d4-stat-text">
                <span className="d4-stat-value">{value}</span> {formatStatName(key)}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="d4-tooltip-divider thin" style={{ background: quality.borderColor }} />

        {/* Secondary Info */}
        <div className="d4-stats-section secondary">
          <div className="d4-stat-row">
            <span className="d4-stat-icon diamond">◆</span>
            <span className="d4-stat-text">Quality Tier: <span style={{ color: quality.titleColor }}>{item.qualityTier}</span></span>
          </div>
          <div className="d4-stat-row">
            <span className="d4-stat-icon diamond">◆</span>
            <span className="d4-stat-text">Slot: {item.slot.charAt(0).toUpperCase() + item.slot.slice(1)}</span>
          </div>
        </div>

        {/* Special Effect (if applicable) */}
        {item.qualityTier === 'Masterwork' && (
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
            <span className="d4-footer-label">Acquired:</span>
            <span className="d4-footer-value">{new Date(item.acquiredAt).toLocaleDateString()}</span>
          </div>
          <div className="d4-footer-row">
            <span className="d4-footer-label">Source:</span>
            <span className="d4-footer-value">{item.source.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

