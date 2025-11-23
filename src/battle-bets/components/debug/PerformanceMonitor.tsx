import React, { useEffect, useState, useRef } from 'react';
import { useMultiGameStore } from '../../store/multiGameStore';
import { projectilePool } from '../../game/entities/projectiles/ProjectilePool';
import { pixiManager } from '../../game/managers/PixiManager';
import { projectileDebugger } from '../../game/debug/ProjectileDebugger';

/**
 * Real-time performance monitor for development
 * Shows FPS, memory usage, and entity counts
 */
export const PerformanceMonitor: React.FC = () => {
  const [fps, setFps] = useState(60);
  const [memory, setMemory] = useState(0);
  const [poolStats, setPoolStats] = useState({ pooled: 0, active: 0 });
  const [copied, setCopied] = useState(false);

  const store = useMultiGameStore();

  const projectiles = Array.from(store.battles.values()).reduce((sum, battle) => sum + battle.projectiles.length, 0);
  const defenseDots = Array.from(store.battles.values()).reduce((sum, battle) => sum + battle.defenseDots.size, 0);
  const games = store.battles.size;

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;

    const updateMetrics = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        // Calculate FPS
        const currentFps = Math.round((frames * 1000) / (currentTime - lastTime));
        setFps(currentFps);
        frames = 0;
        lastTime = currentTime;

        // Update memory if available (Chrome only)
        if ((performance as any).memory) {
          const memMB = (performance as any).memory.usedJSHeapSize / 1048576;
          setMemory(Math.round(memMB));
        }

        // Update pool stats
        const stats = projectilePool.getStats();
        setPoolStats(stats.total);
      }

      requestAnimationFrame(updateMetrics);
    };

    const rafId = requestAnimationFrame(updateMetrics);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Show when running in development OR when ?debug=1 is present in the URL
  const [forceVisible, setForceVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const debugParam = params.get('debug');
      const isDebug = debugParam === '1' || debugParam === 'true';
      setForceVisible(isDebug);
    } catch (error) {
      // If URL parsing fails for any reason, just fall back to default behavior
      console.warn('[PerformanceMonitor] Failed to parse debug query param', error);
    }
  }, []);

  if (!import.meta.env.DEV && !forceVisible) {
    return null;
  }

  // Color coding for FPS
  const getFpsColor = () => {
    if (fps < 50) return '#ff4444';
    if (fps < 55) return '#ffaa00';
    return '#44ff44';
  };

  // Color coding for memory
  const getMemoryColor = () => {
    if (memory > 200) return '#ff4444';
    if (memory > 100) return '#ffaa00';
    return '#44ff44';
  };

  // Copy CONCISE debug info - only the essentials
  const copyDebugInfo = async () => {
    const consoleBuffer = (window as any).__debugConsoleBuffer || [];

    // Count projectiles by status using live debugger data
    const { leftTotal, rightTotal, leftCollided, leftInFlight, rightCollided, rightInFlight } = projectileDebugger.getSummaryCounts();

    // Filter for ONLY collision-related logs
    const collisionLogs = consoleBuffer.filter((log: string) =>
      log.includes('💥 [DEBUG] Collision') ||
      log.includes('🎯 [DEBUG] Registered') ||
      log.includes('[ERROR]') ||
      log.includes('[WARN]')
    );

    // Get last 10 collision events
    const recentCollisions = collisionLogs.slice(-10);

    const conciseDebug = `🔍 DEBUG REPORT - ${new Date().toLocaleTimeString()}
════════════════════════════════════════════════════════════════

📊 PERFORMANCE:
FPS: ${fps} | Memory: ${memory}MB | Defense Dots: ${defenseDots} | Games: ${games}

🎯 PROJECTILE STATUS:
LEFT:  ${leftCollided}/${leftTotal} collided (${leftInFlight} in-flight)
RIGHT: ${rightCollided}/${rightTotal} collided (${rightInFlight} in-flight)

💥 RECENT COLLISIONS (Last 10):
${recentCollisions.length > 0 ? recentCollisions.join('\n') : '⚠️ NO COLLISIONS DETECTED'}

════════════════════════════════════════════════════════════════`;

    await navigator.clipboard.writeText(conciseDebug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    console.log('📋 Smart debug report copied! (Only critical info)');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        minWidth: '180px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ECDC4' }}>
          ⚡ Performance
        </div>
        <button
          onClick={copyDebugInfo}
          style={{
            background: copied ? '#44ff44' : '#4ECDC4',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy Debug'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>FPS:</span>
        <span style={{ color: getFpsColor(), fontWeight: 'bold' }}>{fps}</span>
      </div>

      {memory > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Memory:</span>
          <span style={{ color: getMemoryColor(), fontWeight: 'bold' }}>{memory} MB</span>
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', marginTop: '8px', paddingTop: '8px' }}>
        <div style={{ marginBottom: '4px', fontSize: '11px', color: '#4ECDC4' }}>
          Entities
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Projectiles:</span>
          <span style={{ color: '#FF6B35' }}>{projectiles.length}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Defense Dots:</span>
          <span style={{ color: '#4ECDC4' }}>{defenseDots}</span>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '6px', paddingTop: '6px' }}>
          <div style={{ marginBottom: '4px', fontSize: '11px', color: '#F7B731' }}>
            Object Pool
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Active:</span>
            <span style={{ color: '#FF6B35' }}>{poolStats.active}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pooled:</span>
            <span style={{ color: '#4ECDC4' }}>{poolStats.pooled}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

