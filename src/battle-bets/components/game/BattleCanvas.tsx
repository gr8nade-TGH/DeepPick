/**
 * BattleCanvas - PixiJS canvas component for rendering a single battle
 * Supports multi-instance rendering (multiple battles on one page)
 */

import React, { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { useMultiGameStore } from '../../store/multiGameStore'
import { getCanvasWidth, getCanvasHeight } from '../../game/utils/positioning'
import { drawPremiumGrid, updateDynamicVSDisplay } from '../../game/rendering/premiumGrid'
import { updateBattleStatusOverlay } from '../../game/rendering/battleStatusOverlay'
import { screenShake } from '../../game/effects/ScreenShake'
import { detectWebGLSupport } from '../../utils/webglDetection'
import { castleManager } from '../../game/managers/CastleManager'
import { gridManager } from '../../game/managers/GridManager'
import { pixiManager } from '../../game/managers/PixiManager'
import { runDebugBattleForMultiStore } from '../../game/simulation/quarterSimulation'
import { QuarterDebugControls } from '../debug/QuarterDebugControls'
import { DebugToggleButton } from '../debug/DebugToggleButton'
import type { Game } from '../../types/game'
import type { BattleStatus } from '@/lib/battle-bets/BattleTimer'

interface BattleCanvasProps {
  battleId: string
  game: Game
  // Battle timing data
  status?: BattleStatus
  gameStartTime?: string | null
  q1EndTime?: string | null
  q2EndTime?: string | null
  halftimeEndTime?: string | null
  q3EndTime?: string | null
  q4EndTime?: string | null
  winner?: 'left' | 'right' | null
  autoStart?: boolean // Only auto-start simulation if true (prevents multiple battles from running simultaneously)
}

export const BattleCanvas: React.FC<BattleCanvasProps> = ({
  battleId,
  game,
  status = 'scheduled',
  gameStartTime,
  q1EndTime,
  q2EndTime,
  halftimeEndTime,
  q3EndTime,
  q4EndTime,
  winner = null,
  autoStart = false
}) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const containerRef = useRef<PIXI.Container | null>(null)
  const hasStartedSimulationRef = useRef(false)
  const [webglSupport, setWebglSupport] = useState<ReturnType<typeof detectWebGLSupport> | null>(null)
  const [containerReady, setContainerReady] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  const initializeBattle = useMultiGameStore(state => state.initializeBattle)
  const getBattle = useMultiGameStore(state => state.getBattle)

  // Check WebGL support on mount
  useEffect(() => {
    const support = detectWebGLSupport()
    setWebglSupport(support)

    if (!support.supported) {
      console.error('❌ WebGL not supported:', support.error)
    }
  }, [])

  // Detect debug mode from URL query string (?debug=1)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const search = window.location.search
      console.log('[BattleCanvas] window.location.search =', search)

      const params = new URLSearchParams(search)
      const debugParam = params.get('debug')
      const isDebug = debugParam === '1' || debugParam === 'true'

      console.log('[BattleCanvas] Parsed debug param =', debugParam, '=> debugMode =', isDebug)
      setDebugMode(isDebug)
    } catch (error) {
      console.warn('[BattleCanvas] Failed to read debug query param', error)
    }
  }, [])


  // Initialize PixiJS application
  // NOTE: We intentionally *do not* re-run this effect on every data refresh.
  // The Pixi canvas is created once per battleId and then kept stable so that
  // React auto-refreshes (new Game props) don't destroy/rebuild the grid,
  // which can cause subtle alignment glitches between the canvas and UI.
  useEffect(() => {
    if (!webglSupport?.supported) return
    if (!canvasRef.current) return

    // If we've already created an app for this battle, don't re-initialize.
    // This keeps the canvas layout perfectly stable across API refreshes.
    if (appRef.current) {
      return
    }

    let app: PIXI.Application | null = null
    let mounted = true

      ; (async () => {
        try {
          console.log(`[BattleCanvas] Initializing battle: ${battleId}`)

          app = new PIXI.Application()

          await app.init({
            width: getCanvasWidth(),
            height: getCanvasHeight(),
            background: 0x0a0e1a,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
          })

          if (!mounted || !canvasRef.current) {
            app.destroy(true)
            return
          }

          if (app.canvas) {
            canvasRef.current.appendChild(app.canvas)
          }

          const container = new PIXI.Container()
          app.stage.addChild(container)
          containerRef.current = container

          // Register this battle's app + container with PixiManager
          pixiManager.setApp(app, battleId)
          pixiManager.setContainer(container, battleId)

          screenShake.setContainer(container)

          // Draw grid
          drawPremiumGrid(container)

          // Set container for castle manager for this specific battle
          castleManager.setContainer(container, battleId)

          // Initialize battle in store (HP + defense dots)
          initializeBattle(battleId, game)

          setContainerReady(true)

          // Get HP from store (fixed at 20 for both teams)
          const battle = getBattle(battleId)
          const leftHP = battle?.capperHP.get('left') || { currentHP: 20, maxHP: 20 }
          const rightHP = battle?.capperHP.get('right') || { currentHP: 20, maxHP: 20 }

          // Add castles for this battle
          await castleManager.addCastle(battleId, {
            id: `${battleId}-left`,
            capperId: game.leftCapper.id,
            capperName: game.leftCapper.name,
            capperRank: 'KNIGHT',
            capperLevel: game.leftCapper.level,
            position: gridManager.getCastleBoxPosition('left'),
            maxHP: leftHP.maxHP,
            currentHP: leftHP.currentHP,
            scale: 0.25,
            boxWidth: 140,
            side: 'left',
          })

          await castleManager.addCastle(battleId, {
            id: `${battleId}-right`,
            capperId: game.rightCapper.id,
            capperName: game.rightCapper.name,
            capperRank: 'KNIGHT',
            capperLevel: game.rightCapper.level,
            position: gridManager.getCastleBoxPosition('right'),
            maxHP: rightHP.maxHP,
            currentHP: rightHP.currentHP,
            scale: 0.25,
            boxWidth: 140,
            side: 'right',
          })

          appRef.current = app

          console.log(`✅ [BattleCanvas] Battle initialized: ${battleId}`)
        } catch (error) {
          console.error(`❌ [BattleCanvas] Failed to initialize battle ${battleId}:`, error)
        }
      })()

    return () => {
      mounted = false
      console.log(`[BattleCanvas] Cleaning up battle: ${battleId}`)

      // Clear castles only for this battle
      castleManager.clearBattle(battleId)

      // Clear PixiManager references for this battle (actual app destroy happens here)
      pixiManager.clearBattle(battleId)

      if (app) {
        try {
          app.destroy(true)
        } catch (error) {
          console.warn('Error destroying PixiJS app:', error)
        }
      }
      appRef.current = null
      containerRef.current = null
    }
  }, [webglSupport, battleId, initializeBattle])

  // Render defense dots and projectiles
  useEffect(() => {
    if (!containerRef.current || !containerReady) return

    const battle = getBattle(battleId)
    if (!battle) return

    const container = containerRef.current

    // Remove old defense dot sprites
    container.children
      .filter(child => child.name === 'defense-dot')
      .forEach(child => container.removeChild(child))

    // Add current defense dot sprites
    battle.defenseDots.forEach(dot => {
      dot.sprite.name = 'defense-dot'
      if (dot.alive || dot.sprite.visible) {
        container.addChild(dot.sprite)
      }
    })

    // Remove old projectile sprites
    container.children
      .filter(child => child.name === 'projectile')
      .forEach(child => container.removeChild(child))

    // Add current projectile sprites
    battle.projectiles.forEach(projectile => {
      projectile.sprite.name = 'projectile'
      if (projectile.active) {
        container.addChild(projectile.sprite)
      }
    })
  }, [battleId, getBattle, containerReady])

  // Auto-start debug simulation for this battle when ?debug=1 is present
  // ONLY if autoStart=true (prevents multiple battles from running simultaneously)
  useEffect(() => {
    if (!debugMode) return
    if (!autoStart) return // NEW: Only auto-start if explicitly enabled
    if (!containerReady) return
    if (hasStartedSimulationRef.current) return

    hasStartedSimulationRef.current = true

    console.log(`🎮 [BattleCanvas] Auto-starting simulation for battle ${battleId}`)
    runDebugBattleForMultiStore(battleId).catch(error => {
      console.error(`[BattleCanvas] Debug battle simulation failed for ${battleId}:`, error)
    })
  }, [battleId, debugMode, autoStart, containerReady])


  // Update battle status overlay (countdown timers) every second
  useEffect(() => {
    if (!containerRef.current || !containerReady) return

    const container = containerRef.current
    const canvasWidth = getCanvasWidth()
    const canvasHeight = getCanvasHeight()

    const hasOpponent = Boolean(game.rightCapper && game.rightCapper.id)

    // Update overlay immediately
    updateBattleStatusOverlay(container, {
      status,
      gameStartTime: gameStartTime ?? null,
      q1EndTime: q1EndTime ?? null,
      q2EndTime: q2EndTime ?? null,
      halftimeEndTime: halftimeEndTime ?? null,
      q3EndTime: q3EndTime ?? null,
      q4EndTime: q4EndTime ?? null,
      winner,
      canvasWidth,
      canvasHeight,
      hasOpponent,
    })

    // Update every second for countdown timers
    const interval = setInterval(() => {
      updateBattleStatusOverlay(container, {
        status,
        gameStartTime: gameStartTime ?? null,
        q1EndTime: q1EndTime ?? null,
        q2EndTime: q2EndTime ?? null,
        halftimeEndTime: halftimeEndTime ?? null,
        q3EndTime: q3EndTime ?? null,
        q4EndTime: q4EndTime ?? null,
        winner,
        canvasWidth,
        canvasHeight,
        hasOpponent,
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [status, gameStartTime, q1EndTime, q2EndTime, halftimeEndTime, q3EndTime, q4EndTime, winner, containerReady, game.rightCapper])

  // Update dynamic VS display based on game status
  useEffect(() => {
    if (!containerRef.current || !containerReady) return

    const container = containerRef.current

    // Get current quarter from store
    const battle = useMultiGameStore.getState().getBattle(battleId)
    const currentQuarter = battle?.currentQuarter ?? 0

    // Update VS display immediately
    updateDynamicVSDisplay(container, {
      status: game.status || 'SCHEDULED',
      gameStartTime: gameStartTime ?? null,
      currentQuarter,
    })

    // Update every second for countdown timer
    const interval = setInterval(() => {
      const battle = useMultiGameStore.getState().getBattle(battleId)
      const currentQuarter = battle?.currentQuarter ?? 0

      updateDynamicVSDisplay(container, {
        status: game.status || 'SCHEDULED',
        gameStartTime: gameStartTime ?? null,
        currentQuarter,
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [battleId, game.status, gameStartTime, containerReady])

  if (webglSupport && !webglSupport.supported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-slate-950 text-white p-8 rounded-lg">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-500 mb-2">WebGL Not Supported</h2>
        <p className="text-gray-400 text-center max-w-md">{webglSupport.error}</p>
      </div>
    )
  }

  // Check if debug mode is enabled via URL parameter
  const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const [showDebugControls, setShowDebugControls] = useState(isDebugMode);

  return (
    <div className="relative w-full h-full">
      {/* PixiJS Canvas with integrated overlays */}
      <div
        ref={canvasRef}
        className="flex justify-center items-center w-full h-full"
      />

      {/* Debug Toggle Button - Always visible */}
      <button
        onClick={() => setShowDebugControls(!showDebugControls)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: showDebugControls ? 'linear-gradient(135deg, #4ecdc4 0%, #44a8a0 100%)' : 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
          color: '#fff',
          border: '2px solid #fff',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.2s ease',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        }}
      >
        {showDebugControls ? '🐛 DEBUG ON' : '🐛 DEBUG'}
      </button>

      {/* Quarter Debug Controls - Show when debug is enabled */}
      {showDebugControls && (
        <QuarterDebugControls battleId={battleId} />
      )}
    </div>
  )
}

