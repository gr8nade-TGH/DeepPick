/**
 * Simple Debug Component - Shows collision logs in real-time
 */

import { useEffect, useState } from 'react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'grid' | 'collision' | 'defense' | 'error' | 'info';
}

export function SimpleDebug() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Intercept console.log
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      originalLog(...args);
      const message = args.join(' ');
      
      // Only capture collision-related logs
      if (
        message.includes('🎯 [GRID CHECK]') ||
        message.includes('💥 [COLLISION!]') ||
        message.includes('🛡️ [DEFENSE HIT]') ||
        message.includes('[PROJECTILE]')
      ) {
        const type = message.includes('GRID CHECK') ? 'grid' :
                     message.includes('COLLISION!') ? 'collision' :
                     message.includes('DEFENSE HIT') ? 'defense' : 'info';
        
        setLogs(prev => [...prev.slice(-19), {
          timestamp: new Date().toLocaleTimeString(),
          message,
          type
        }]);
      }
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      setLogs(prev => [...prev.slice(-19), {
        timestamp: new Date().toLocaleTimeString(),
        message: args.join(' '),
        type: 'error'
      }]);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      const message = args.join(' ');
      if (message.includes('[COLLISION]') || message.includes('[GRID]')) {
        setLogs(prev => [...prev.slice(-19), {
          timestamp: new Date().toLocaleTimeString(),
          message,
          type: 'error'
        }]);
      }
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 z-50"
      >
        Show Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-2xl border-2 border-blue-500 w-[600px] max-h-[400px] overflow-hidden z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-lg">🔍 Collision Debug</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="bg-black rounded p-2 overflow-y-auto max-h-[300px] font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            Waiting for collision events...
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`mb-1 ${
                log.type === 'grid' ? 'text-blue-400' :
                log.type === 'collision' ? 'text-red-400' :
                log.type === 'defense' ? 'text-yellow-400' :
                log.type === 'error' ? 'text-red-600' :
                'text-gray-400'
              }`}
            >
              <span className="text-gray-600">[{log.timestamp}]</span> {log.message}
            </div>
          ))
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        Showing last 20 collision events
      </div>
    </div>
  );
}

