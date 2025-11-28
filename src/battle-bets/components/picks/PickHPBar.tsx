/**
 * PickHPBar Component
 * 
 * Mini HP bar for displaying castle health in pick chips.
 * Used only for LIVE battles.
 */

import React from 'react';
import type { CastleHP } from '../../types/picks';
import { calculateHPPercentage, getHPBarColor } from '../../utils/pickUtils';

interface PickHPBarProps {
  hp: CastleHP;
}

export const PickHPBar: React.FC<PickHPBarProps> = ({ hp }) => {
  const percentage = calculateHPPercentage(hp);
  const fillColor = getHPBarColor(percentage);
  
  // Determine fill class based on percentage
  const fillClass = 
    percentage > 60 ? 'pick-chip__hp-bar-fill--high' :
    percentage > 30 ? 'pick-chip__hp-bar-fill--medium' :
    'pick-chip__hp-bar-fill--low';

  return (
    <div className="pick-chip__hp-bar">
      <div className="pick-chip__hp-bar-track">
        <div 
          className={`pick-chip__hp-bar-fill ${fillClass}`}
          style={{ 
            width: `${percentage}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
      <span className="pick-chip__hp-value">{hp.current}</span>
    </div>
  );
};

export default PickHPBar;

