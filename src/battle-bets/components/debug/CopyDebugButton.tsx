/**
 * CopyDebugButton - Simple button to copy collision debug snapshot
 */

import { useState } from 'react';
import { collisionManager } from '../../game/managers/CollisionManager';

interface CopyDebugButtonProps {
  gameId: string;
}

export function CopyDebugButton({ gameId }: CopyDebugButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const snapshot = collisionManager.getDebugSnapshot(gameId);
      await navigator.clipboard.writeText(snapshot);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      console.log('📋 Debug snapshot copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy debug snapshot:', error);
      alert('Failed to copy. Check console.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 'bold',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s',
        backgroundColor: copied ? '#16a34a' : '#2563eb',
        color: 'white'
      }}
      onMouseEnter={(e) => {
        if (!copied) {
          e.currentTarget.style.backgroundColor = '#1d4ed8';
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          e.currentTarget.style.backgroundColor = '#2563eb';
        }
      }}
    >
      {copied ? '✅ Copied!' : '📋 Copy Debug'}
    </button>
  );
}

