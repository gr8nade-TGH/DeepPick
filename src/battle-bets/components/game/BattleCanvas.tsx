/**
 * BattleCanvas - Main PixiJS canvas component for rendering the battle grid
 */

import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useGameStore } from '../../store/gameStore';
import { getCanvasWidth, getCanvasHeight } from '../../game/utils/positioning';
import { drawPremiumGrid } from '../../game/rendering/premiumGrid';
import { pixiManager } from '../../game/managers/PixiManager';
import { screenShake } from '../../game/effects/ScreenShake';
import { detectWebGLSupport } from '../../utils/webglDetection';
import { castleManager } from '../../game/managers/CastleManager';
import { DEFAULT_GRID_CONFIG } from '../../types/game';
import { projectileDebugger } from '../../game/debug/ProjectileDebugger';
import { unitRecordDisplay } from '../../game/managers/UnitRecordDisplay';
import { orbDistributionAnimator } from '../../game/animation/OrbDistributionAnimator';
import { getCapperUnitsForTeam } from '../../types/game';
import { InventoryBar } from './InventoryBar';
// Inventory system disabled for now
// import { InventoryPopup } from './InventoryPopup';
// import { InventoryItem, ItemSlot } from '../../types/inventory';

export const BattleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const [webglSupport, setWebglSupport] = useState<ReturnType<typeof detectWebGLSupport> | null>(null);
  const [containerReady, setContainerReady] = useState(false);

  const defenseDots = useGameStore(state => state.defenseDots);
  const projectiles = useGameStore(state => state.projectiles);

  // Inventory popup state
  // Inventory system disabled
  // const [inventoryOpen, setInventoryOpen] = useState(false);
  // const [selectedCastleId, setSelectedCastleId] = useState<string | null>(null);
  // const [selectedSlot, setSelectedSlot] = useState<number>(1);

  // Check WebGL support on mount
  useEffect(() => {
    const support = detectWebGLSupport();
    setWebglSupport(support);

    if (!support.supported) {
      console.error('❌ WebGL not supported:', support.error);
    }
  }, []);

  // Initialize PixiJS application
  useEffect(() => {
    // Don't initialize if WebGL is not supported
    if (!webglSupport?.supported) return;
    if (!canvasRef.current) return;

    let app: PIXI.Application | null = null;
    let mounted = true;

    // Create PixiJS application (v8 async API)
    (async () => {
      try {
        app = new PIXI.Application();

        await app.init({
          width: getCanvasWidth(),
          height: getCanvasHeight(),
          background: 0x1a1a2e,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        // Check if component is still mounted
        if (!mounted || !canvasRef.current) {
          app.destroy(true);
          return;
        }

        // Append canvas to DOM
        if (app.canvas) {
          canvasRef.current.appendChild(app.canvas);
        }

        // Create main container
        const container = new PIXI.Container();
        app.stage.addChild(container);
        containerRef.current = container;

        // Set app and container references in PixiManager for global access
        pixiManager.setApp(app);
        pixiManager.setContainer(container);

        // Set container reference for screen shake
        screenShake.setContainer(container);

        // Draw premium AAA-quality grid background
        drawPremiumGrid(container);

        // Set container reference for castle manager
        castleManager.setContainer(container);

        // Signal that container is ready (triggers defense dot rendering)
        setContainerReady(true);

        // Initialize demo castles for left and right cappers
        // Grid positioning constants (use config values to match premiumGrid.ts)
        const cellWidth = DEFAULT_GRID_CONFIG.cellWidth;
        const cellHeight = DEFAULT_GRID_CONFIG.cellHeight;
        const statLabelWidth = DEFAULT_GRID_CONFIG.statLabelWidth;
        const weaponSlotWidth = DEFAULT_GRID_CONFIG.weaponSlotWidth;
        const defenseCells = DEFAULT_GRID_CONFIG.defenseCellsPerSide;
        const attackCells = DEFAULT_GRID_CONFIG.attackCellsPerSide;
        const battlefieldWidth = DEFAULT_GRID_CONFIG.battlefieldWidth;

        // Calculate total grid width
        const gridWidth =
          (statLabelWidth * 2) +
          (weaponSlotWidth * 2) +
          (defenseCells * cellWidth * 2) +
          (attackCells * cellWidth * 2) +
          battlefieldWidth;

        // Center the grid on canvas
        const canvasWidth = app.screen.width;
        const gridStartX = (canvasWidth - gridWidth) / 2;

        // Calculate grid positions
        const leftStatLabelStart = gridStartX;

        // Castle positioning - place castles close to the stat labels
        const castleOffset = 60; // Distance from stat labels to castle center (reduced to bring closer)
        const leftCastleX = leftStatLabelStart - castleOffset;
        const rightCastleX = leftStatLabelStart + gridWidth + castleOffset;

        // Castle box dimensions
        const gridHeight = 5 * cellHeight; // Height of 5 stat rows

        // Left capper castle
        await castleManager.addCastle({
          id: 'castle-left',
          capperId: 'capper1',
          capperName: 'SHIVA',
          capperRank: 'KING',
          capperLevel: 33,
          currentHP: 13,
          maxHP: 13,
          position: {
            x: leftCastleX,
            y: 100 // Center vertically
          },
          scale: 0.32,
          boxWidth: 200,
          side: 'left',
        });

        // Right capper castle
        await castleManager.addCastle({
          id: 'castle-right',
          capperId: 'capper2',
          capperName: 'ORACLE',
          capperRank: 'KING',
          capperLevel: 28,
          currentHP: 11,
          maxHP: 11,
          position: {
            x: rightCastleX,
            y: 100 // Center vertically
          },
          scale: 0.32,
          boxWidth: 200,
          side: 'right',
        });

        // Item slot click handlers disabled (inventory system removed)
        // Blue Orb Shield is auto-equipped to all castles
        console.log('✅ Castles created with Blue Orb Shield auto-equipped');

        // Initialize projectile debugger AFTER castles so it renders on top
        projectileDebugger.initialize(container);
        projectileDebugger.setEnabled(false); // Disable debug visualization (BF0-BF4 labels)

        // Initialize unit record display manager
        unitRecordDisplay.setContainer(container);

        // Initialize orb distribution animator
        orbDistributionAnimator.setContainer(container);

        // Add unit record text above each grid
        // Get game data from store
        const gameStore = useGameStore.getState();
        const game = gameStore.games[0];

        if (game) {
          // Calculate positions for unit record text (above the defense grid)
          const textY = -30; // 30px above the grid

          // Left side unit record
          const leftUnits = getCapperUnitsForTeam(game.leftCapper, game.leftTeam.id);
          const leftDefenseStart = leftWeaponSlotStart + weaponSlotWidth;
          const leftDefenseCenter = leftDefenseStart + (defenseCells * cellWidth) / 2;

          unitRecordDisplay.addUnitRecord({
            side: 'left',
            teamAbbr: game.leftTeam.abbreviation,
            teamColor: game.leftTeam.primaryColor,
            units: leftUnits,
            position: { x: leftDefenseCenter, y: textY }
          });

          // Right side unit record
          const rightUnits = getCapperUnitsForTeam(game.rightCapper, game.rightTeam.id);
          const rightDefenseCenter = rightDefenseStart + (defenseCells * cellWidth) / 2;

          unitRecordDisplay.addUnitRecord({
            side: 'right',
            teamAbbr: game.rightTeam.abbreviation,
            teamColor: game.rightTeam.primaryColor,
            units: rightUnits,
            position: { x: rightDefenseCenter, y: textY }
          });

          console.log('✅ Unit record displays added above grids');
        }

        appRef.current = app;

        console.log('✅ PixiJS canvas initialized with castles and unit records!');
      } catch (error) {
        console.error('❌ Failed to initialize PixiJS:', error);
      }
    })();

    return () => {
      mounted = false;

      // Clean up castles
      castleManager.clear();

      // Clean up unit record displays
      unitRecordDisplay.clear();

      if (app) {
        try {
          app.destroy(true);
        } catch (error) {
          console.warn('Error destroying PixiJS app:', error);
        }
      }
      appRef.current = null;
      containerRef.current = null;
    };
  }, [webglSupport]);

  // Update defense dots
  useEffect(() => {
    if (!containerRef.current || !containerReady) return;

    const container = containerRef.current;

    // Remove old defense dot sprites
    container.children
      .filter(child => child.name === 'defense-dot')
      .forEach(child => container.removeChild(child));

    // Add current defense dot sprites (only alive ones or ones being destroyed)
    defenseDots.forEach(dot => {
      dot.sprite.name = 'defense-dot';
      // Only add to container if alive or if it's visible (being destroyed with animation)
      if (dot.alive || dot.sprite.visible) {
        container.addChild(dot.sprite);
      }
    });

    console.log(`🎨 Rendered ${defenseDots.size} defense dots to canvas`);
  }, [defenseDots, containerReady]);

  // Update projectiles - CRITICAL: Add projectile sprites to the container!
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Remove old projectile sprites
    container.children
      .filter(child => child.name === 'projectile')
      .forEach(child => container.removeChild(child));

    // Add current projectile sprites
    projectiles.forEach(projectile => {
      projectile.sprite.name = 'projectile';
      if (projectile.active) {
        container.addChild(projectile.sprite);
      }
    });

    console.log(`🎯 Rendered ${projectiles.length} projectiles to canvas`);
  }, [projectiles]);

  // Update projectiles
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Remove old projectile sprites
    container.children
      .filter(child => child.name === 'projectile')
      .forEach(child => container.removeChild(child));

    // Add current projectile sprites
    projectiles.forEach(projectile => {
      projectile.sprite.name = 'projectile';
      container.addChild(projectile.sprite);
    });
  }, [projectiles]);

  // Show WebGL error if not supported
  if (webglSupport && !webglSupport.supported) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '600px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        padding: '40px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#FF6B35' }}>
          WebGL Not Supported
        </h2>
        <p style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#aaa', maxWidth: '600px', textAlign: 'center' }}>
          {webglSupport.error}
        </p>
        <div style={{
          background: 'rgba(78, 205, 196, 0.1)',
          border: '1px solid rgba(78, 205, 196, 0.3)',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '600px',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#4ECDC4' }}>
            💡 Suggestions:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc' }}>
            <li>Try using a modern browser (Chrome, Firefox, Edge, Safari)</li>
            <li>Update your graphics drivers</li>
            <li>Enable hardware acceleration in browser settings</li>
            <li>Try a different device if the issue persists</li>
          </ul>
        </div>
      </div>
    );
  }

  // Inventory handlers and test functions removed (system disabled)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0',
      overflow: 'visible',
      position: 'relative'
    }}>
      {/* Left Inventory Bar */}
      <InventoryBar side="left" />

      {/* PixiJS Canvas */}
      <div
        ref={canvasRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0',
          overflow: 'visible', // Ensure castles are not clipped
        }}
      />

      {/* Right Inventory Bar */}
      <InventoryBar side="right" />

      {/* Test Controls removed temporarily - file path issues */}
      {/* Inventory Popup removed - Blue Orb Shield auto-equipped */}
    </div>
  );
};

