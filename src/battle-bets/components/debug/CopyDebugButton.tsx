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
      className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg font-semibold shadow-lg transition-all ${
        copied
          ? 'bg-green-600 text-white'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
      style={{ fontSize: '14px' }}
    >
      {copied ? '✅ Copied!' : '📋 Copy Debug'}
    </button>
  );
}

