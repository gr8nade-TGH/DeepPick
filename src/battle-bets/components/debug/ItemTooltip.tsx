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

  // Format stat descriptions based on item type
  const getStatDescription = (key: string, roll: number, range: { min: number; max: number }): { label: string; prefix: string } => {
    const isMax = roll === range.max;

    switch (key) {
      case 'startShieldHp':
        return {
          label: 'Shield Strength',
          prefix: isMax ? '⚡ ' : ''
        };
      case 'hpPerDestroyedOrb':
        return {
          label: 'Shield Regeneration per Orb Destroyed',
          prefix: '+'
        };
      case 'ptsThreshold':
        return {
          label: 'Pts Threshold',
          prefix: '+'
        };
      case 'bonusProjectiles':
        return {
          label: 'Bonus Projectiles',
          prefix: '+'
        };
      case 'ptsSpeedBoost':
        return {
          label: 'Projectile Speed for PTS stat row',
          prefix: '+'
        };
      case 'bonusStatSpeedBoost':
        // Get the actual bonus stat from rolls (0=REB, 1=AST, 2=STL, 3=3PT)
        const bonusStatOptions = ['REB', 'AST', 'STL', '3PT'];
        const bonusStatIndex = rolls?.bonusStat || 0;
        const bonusStatName = bonusStatOptions[bonusStatIndex];
        return {
          label: `Projectile Speed for ${bonusStatName} stat row`,
          prefix: '+'
        };
      case 'bonusStat':
        // Don't display this stat in the tooltip (it's used internally)
        return { label: '', prefix: '' };
      case 'castleHP':
        return {
          label: 'Castle HP',
          prefix: ''
        };
      case 'shieldCharges':
        return {
          label: 'Knight Shield Charges',
          prefix: ''
        };
      default:
        // Generic formatting
        const formatted = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        return { label: formatted, prefix: '+' };
    }
  };

  return (
    <div className="item-tooltip" data-quality={calculatedQuality}>
      {/* Item Name */}
      <div className="tooltip-name" style={{ color: qualityColor }}>
        {item.name}
      </div>

      {/* Quality Tier */}
      <div className="tooltip-quality" style={{ color: qualityColor }}>
        {calculatedQuality} {item.slot.charAt(0).toUpperCase() + item.slot.slice(1)}
      </div>

      <div className="tooltip-divider" />

      {/* Team Badge */}
      <div className="tooltip-team">
        {item.icon} {item.teamName}
      </div>

      <div className="tooltip-divider" />

      {/* Roll Stats - Bullet Points with Creative Descriptions */}
      {item.rollRanges && rolls && (
        <div className="tooltip-stats">
          {Object.entries(item.rollRanges).map(([key, range]) => {
            const roll = rolls[key];
            const isMax = roll === range.max;
            const isMin = roll === range.min;
            const { label, prefix } = getStatDescription(key, roll, range);

            // Skip bonusStat (internal value, not displayed)
            if (key === 'bonusStat' || !label) return null;

            // Add % suffix for speed boost stats
            const suffix = (key === 'ptsSpeedBoost' || key === 'bonusStatSpeedBoost') ? '%' : '';

            return (
              <div key={key} className="tooltip-stat-bullet">
                <span className="bullet">◆</span>
                <span className="stat-text">
                  <span className={`stat-value ${isMax ? 'max-roll' : isMin ? 'min-roll' : ''}`}>
                    {prefix}{roll}{suffix}
                  </span>
                  {' '}{label}
                  <span className="stat-range"> ({range.min}{suffix}-{range.max}{suffix})</span>
                </span>
              </div>
            );
          })}

          {/* Fixed stats for Wizard's Watchtower (shield regen is fixed at +1) */}
          {item.id === 'WAS_def_wizards_watchtower' && (
            <div className="tooltip-stat-bullet">
              <span className="bullet">◆</span>
              <span className="stat-text">
                <span className="stat-value">+1</span>
                {' '}Shield Regeneration per Orb Destroyed
                <span className="stat-range"> (fixed)</span>
              </span>
            </div>
          )}
        </div>
      )}

      <div className="tooltip-divider" />

      {/* Flavor Text / Lore */}
      <div className="tooltip-flavor">
        {item.description}
      </div>

      {/* Empty Socket (if applicable) */}
      {calculatedQuality === 'Masterwork' && (
        <>
          <div className="tooltip-divider-thin" />
          <div className="tooltip-socket">
            <span className="socket-icon">◇</span> Empty Socket
          </div>
        </>
      )}

      <div className="tooltip-divider-thin" />

      {/* Footer */}
      <div className="tooltip-footer">
        <div className="tooltip-footer-item">Item Level: 1</div>
        <div className="tooltip-footer-item">Requires Level: 1</div>
      </div>
    </div>
  );
};

