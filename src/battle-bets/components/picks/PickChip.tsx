/**
 * PickChip Component
 * 
 * Individual pick chip that displays bet info and can be selected
 * to assign a battle to one of the two battle slots.
 */

import React, { useMemo } from 'react';
import type { PickChipData } from '../../types/picks';
import { PickHPBar } from './PickHPBar';

interface PickChipProps {
  data: PickChipData;
  onClick: (pickId: string) => void;
}

export const PickChip: React.FC<PickChipProps> = ({ data, onClick }) => {
  const {
    pickId,
    teamAbbr,
    spread,
    opponentAbbr,
    unitRecordDisplay,
    status,
    statusDisplay,
    isSelected,
    slotNumber,
    teamColor,
    unitRecordColor,
    resultColor,
    castleHP,
  } = data;

  // Build class names
  const chipClasses = useMemo(() => {
    const classes = ['pick-chip'];
    
    if (isSelected) {
      classes.push('pick-chip--selected');
      if (slotNumber === 1) classes.push('pick-chip--slot-1');
      if (slotNumber === 2) classes.push('pick-chip--slot-2');
    }
    
    classes.push(`pick-chip--${status}`);
    
    if (status === 'final' && resultColor) {
      classes.push(`pick-chip--${resultColor === 'green' ? 'win' : 'loss'}`);
    }
    
    return classes.join(' ');
  }, [isSelected, slotNumber, status, resultColor]);

  // Unit record color class
  const unitColorClass = `pick-chip__units--${unitRecordColor === 'green' ? 'positive' : unitRecordColor === 'red' ? 'negative' : 'neutral'}`;

  // Status color class
  const statusColorClass = useMemo(() => {
    if (status === 'live') return 'pick-chip__status--live';
    if (status === 'upcoming') return 'pick-chip__status--upcoming';
    if (status === 'final') {
      return resultColor === 'green' ? 'pick-chip__status--final-win' : 'pick-chip__status--final-loss';
    }
    return '';
  }, [status, resultColor]);

  const handleClick = () => {
    onClick(pickId);
  };

  return (
    <div className="pick-chip-wrapper">
      <div 
        className={chipClasses}
        onClick={handleClick}
        style={{ '--chip-team-color': teamColor } as React.CSSProperties}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        {/* Row 1: Team + Spread @ Opponent */}
        <div className="pick-chip__row pick-chip__matchup">
          <span className="pick-chip__team">{teamAbbr}</span>
          <span className="pick-chip__spread">{spread}</span>
          <span className="pick-chip__vs">@</span>
          <span className="pick-chip__opponent">{opponentAbbr}</span>
        </div>
        
        {/* Row 2: Unit Record */}
        <div className={`pick-chip__row pick-chip__units ${unitColorClass}`}>
          {unitRecordDisplay}
        </div>
        
        {/* Row 3: Status */}
        <div className={`pick-chip__row pick-chip__status ${statusColorClass}`}>
          <span className="pick-chip__status-text">{statusDisplay}</span>
        </div>
        
        {/* HP Bar (LIVE only) */}
        {status === 'live' && castleHP && (
          <PickHPBar hp={castleHP} />
        )}
      </div>
      
      {/* Slot badge */}
      {slotNumber && (
        <div className={`pick-chip__slot-badge pick-chip__slot-badge--${slotNumber}`}>
          {slotNumber === 1 ? '📌' : '🔄'}
        </div>
      )}
    </div>
  );
};

export default PickChip;

