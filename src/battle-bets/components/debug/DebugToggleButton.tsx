/**
 * Debug Toggle Button
 * Visible button to enable/disable debug overlays and controls
 */

import React, { useState } from 'react';
import { projectileDebugger } from '../../game/debug/ProjectileDebugger';
import './DebugToggleButton.css';

interface DebugToggleButtonProps {
  battleId: string;
}

export const DebugToggleButton: React.FC<DebugToggleButtonProps> = ({ battleId }) => {
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);

  const handleToggle = () => {
    const newState = !isDebugEnabled;
    setIsDebugEnabled(newState);
    projectileDebugger.setEnabled(newState);
    
    console.log(`🐛 Debug mode ${newState ? 'ENABLED' : 'DISABLED'} for battle ${battleId}`);
  };

  return (
    <button
      className="debug-toggle-button"
      onClick={handleToggle}
      title={isDebugEnabled ? 'Disable Debug Mode' : 'Enable Debug Mode'}
    >
      {isDebugEnabled ? '🐛 DEBUG ON' : '🐛 DEBUG'}
    </button>
  );
};

