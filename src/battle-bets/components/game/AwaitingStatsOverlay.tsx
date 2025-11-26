/**
 * Awaiting Stats Overlay
 * 
 * Shows a blinking "Awaiting Q# Stats" message in the middle of the grid
 * when the real NBA quarter is in progress and we're waiting for MySportsFeeds data.
 */

import React from 'react';
import type { BattleStatus } from '@/lib/battle-bets/BattleTimer';
import './AwaitingStatsOverlay.css';

interface AwaitingStatsOverlayProps {
  battleStatus: BattleStatus;
}

// Helper to extract quarter label from IN_PROGRESS status
const getQuarterLabel = (status: BattleStatus): string | null => {
  switch (status) {
    case 'Q1_IN_PROGRESS': return 'Q1';
    case 'Q2_IN_PROGRESS': return 'Q2';
    case 'Q3_IN_PROGRESS': return 'Q3';
    case 'Q4_IN_PROGRESS': return 'Q4';
    case 'OT1_IN_PROGRESS': return 'OT1';
    case 'OT2_IN_PROGRESS': return 'OT2';
    case 'OT3_IN_PROGRESS': return 'OT3';
    case 'OT4_IN_PROGRESS': return 'OT4';
    default: return null;
  }
};

export const AwaitingStatsOverlay: React.FC<AwaitingStatsOverlayProps> = ({ battleStatus }) => {
  const quarterLabel = getQuarterLabel(battleStatus);

  // Only show during IN_PROGRESS phases
  if (!quarterLabel) {
    return null;
  }

  return (
    <div className="awaiting-stats-overlay">
      <div className="awaiting-stats-content">
        <div className="awaiting-icon">⏳</div>
        <div className="awaiting-text">
          Awaiting <span className="quarter-label">{quarterLabel}</span> Stats
        </div>
        <div className="awaiting-dots">
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </div>
      </div>
    </div>
  );
};

export default AwaitingStatsOverlay;

