/**
 * CastleDebugPanel - Debug controls for testing castle damage states
 */

import React from 'react';
import { castleManager } from '../../game/managers/CastleManager';

export const CastleDebugPanel: React.FC = () => {
  const handleDamageLeft = () => {
    castleManager.damageCastle('castle-left', 20);
    console.log('💥 Damaged left castle by 20 HP');
  };

  const handleDamageRight = () => {
    castleManager.damageCastle('castle-right', 20);
    console.log('💥 Damaged right castle by 20 HP');
  };

  const handleHealLeft = () => {
    castleManager.healCastle('castle-left', 20);
    console.log('💚 Healed left castle by 20 HP');
  };

  const handleHealRight = () => {
    castleManager.healCastle('castle-right', 20);
    console.log('💚 Healed right castle by 20 HP');
  };

  const handleResetCastles = () => {
    const leftCastle = castleManager.getCastle('castle-left');
    const rightCastle = castleManager.getCastle('castle-right');
    
    if (leftCastle) {
      leftCastle.heal(100);
    }
    if (rightCastle) {
      rightCastle.heal(100);
    }
    
    console.log('🔄 Reset all castles to full HP');
  };

  const handleGetCastleInfo = () => {
    const leftCastle = castleManager.getCastle('castle-left');
    const rightCastle = castleManager.getCastle('castle-right');
    
    console.log('🏰 Castle Info:');
    if (leftCastle) {
      console.log(`  Left Castle: ${(leftCastle.getHPPercentage() * 100).toFixed(0)}% HP`);
    }
    if (rightCastle) {
      console.log(`  Right Castle: ${(rightCastle.getHPPercentage() * 100).toFixed(0)}% HP`);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '16px',
      borderRadius: '8px',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 1000,
      minWidth: '250px',
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4ECDC4' }}>
        🏰 Castle Debug Panel
      </h3>
      
      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '4px', color: '#aaa' }}>Left Castle:</div>
        <button
          onClick={handleDamageLeft}
          style={{
            background: '#FF6B35',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px',
            fontSize: '11px',
          }}
        >
          💥 Damage -20
        </button>
        <button
          onClick={handleHealLeft}
          style={{
            background: '#4ECDC4',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          💚 Heal +20
        </button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '4px', color: '#aaa' }}>Right Castle:</div>
        <button
          onClick={handleDamageRight}
          style={{
            background: '#FF6B35',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px',
            fontSize: '11px',
          }}
        >
          💥 Damage -20
        </button>
        <button
          onClick={handleHealRight}
          style={{
            background: '#4ECDC4',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          💚 Heal +20
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px' }}>
        <button
          onClick={handleResetCastles}
          style={{
            background: '#9B59B6',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px',
            fontSize: '11px',
            width: '100%',
            marginBottom: '8px',
          }}
        >
          🔄 Reset All
        </button>
        <button
          onClick={handleGetCastleInfo}
          style={{
            background: '#34495E',
            border: 'none',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            width: '100%',
          }}
        >
          ℹ️ Log Info
        </button>
      </div>
    </div>
  );
};

