/**
 * ItemTooltip.tsx
 * 
 * Diablo-style item tooltip that shows:
 * - Item name with quality color
 * - Item type and team
 * - Roll ranges vs achieved rolls
 * - Quality grade
 * - Item description
 */

import React from 'react';
import type { ItemDefinition } from '../../game/items/ItemRollSystem';

interface ItemTooltipProps {
  item: ItemDefinition;
  rolls?: Record<string, number>;
  quality?: 'Warped' | 'Balanced' | 'Honed' | 'Masterwork';
}

/**
 * Get quality color based on tier
 */
function getQualityColor(quality: string): string {
  switch (quality) {
    case 'Masterwork': return '#FFD700'; // Gold
    case 'Honed': return '#9370DB'; // Purple
    case 'Balanced': return '#4169E1'; // Blue
    case 'Warped': return '#808080'; // Gray
    default: return '#FFFFFF'; // White
  }
}

/**
 * Calculate quality tier based on rolls
 */
function calculateQuality(item: ItemDefinition, rolls: Record<string, number>): string {
  if (!item.rollRanges || !rolls) return 'Balanced';

  const rollKeys = Object.keys(item.rollRanges);
  let totalScore = 0;
  let maxScore = 0;

  for (const key of rollKeys) {
    const range = item.rollRanges[key];
    const roll = rolls[key];

    if (roll !== undefined) {
      const rangeSize = range.max - range.min;
      const rollScore = roll - range.min;
      totalScore += rollScore;
      maxScore += rangeSize;
    }
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 50;

  if (percentage >= 90) return 'Masterwork';
  if (percentage >= 65) return 'Honed';
  if (percentage >= 35) return 'Balanced';
  return 'Warped';
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, rolls, quality }) => {
  const calculatedQuality = quality || (rolls ? calculateQuality(item, rolls) : 'Balanced');
  const qualityColor = getQualityColor(calculatedQuality);

  console.log('🎨 [ItemTooltip] Rendering tooltip:', { item: item.name, quality: calculatedQuality, rolls });

  return (
    <div className="item-tooltip" data-quality={calculatedQuality}>
      {/* Item Name */}
      <div className="tooltip-name" style={{ color: qualityColor }}>
        {item.icon} {item.name}
      </div>

      {/* Quality Tier */}
      <div className="tooltip-quality" style={{ color: qualityColor }}>
        {calculatedQuality}
      </div>

      {/* Item Type & Team */}
      <div className="tooltip-type">
        {item.slot.toUpperCase()} • {item.teamName}
      </div>

      <div className="tooltip-divider" />

      {/* Roll Stats */}
      {item.rollRanges && rolls && (
        <div className="tooltip-stats">
          {Object.entries(item.rollRanges).map(([key, range]) => {
            const roll = rolls[key];
            const isMax = roll === range.max;
            const isMin = roll === range.min;

            // Format stat name (camelCase to Title Case)
            const statName = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();

            return (
              <div key={key} className="tooltip-stat">
                <span className="stat-name">{statName}:</span>
                <span className={`stat-value ${isMax ? 'max-roll' : isMin ? 'min-roll' : ''}`}>
                  {roll}
                </span>
                <span className="stat-range">
                  ({range.min}-{range.max})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {item.rollRanges && rolls && <div className="tooltip-divider" />}

      {/* Description */}
      <div className="tooltip-description">
        {item.description}
      </div>
    </div>
  );
};

