/**
 * BattleCanvas - PixiJS canvas component for rendering a single battle
 * Supports multi-instance rendering (multiple battles on one page)
 */

import React, { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { useMultiGameStore } from '../../store/multiGameStore'
import { getCanvasWidth, getCanvasHeight } from '../../game/utils/positioning'
import { drawPremiumGrid } from '../../game/rendering/premiumGrid'
import { updateBattleStatusOverlay } from '../../game/rendering/battleStatusOverlay'
import { screenShake } from '../../game/effects/ScreenShake'
import { detectWebGLSupport } from '../../utils/webglDetection'
import { castleManager } from '../../game/managers/CastleManager'
import { gridManager } from '../../game/managers/GridManager'
import type { Game } from '../../types/game'
import type { BattleStatus } from '../../lib/BattleTimer'

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
  winner = null
}) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const containerRef = useRef<PIXI.Container | null>(null)
  const [webglSupport, setWebglSupport] = useState<ReturnType<typeof detectWebGLSupport> | null>(null)
  const [containerReady, setContainerReady] = useState(false)

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

  // Initialize PixiJS application
  useEffect(() => {
    if (!webglSupport?.supported) return
    if (!canvasRef.current) return

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

          screenShake.setContainer(container)

          // Draw grid
          drawPremiumGrid(container)

          // Set container for castle manager
          castleManager.setContainer(container)

          // Initialize battle in store
          initializeBattle(battleId, game)

          setContainerReady(true)

          // Add castles
          await castleManager.addCastle({
            id: `${battleId}-left`,
            capperId: game.leftCapper.id,
            capperName: game.leftCapper.name,
            capperRank: 'KNIGHT',
            capperLevel: game.leftCapper.level,
            position: gridManager.getCastleBoxPosition('left'),
            maxHP: game.leftCapper.maxHealth,
            currentHP: game.leftCapper.health,
            scale: 0.25,
            boxWidth: 140,
            side: 'left',
          })

          await castleManager.addCastle({
            id: `${battleId}-right`,
            capperId: game.rightCapper.id,
            capperName: game.rightCapper.name,
            capperRank: 'KNIGHT',
            capperLevel: game.rightCapper.level,
            position: gridManager.getCastleBoxPosition('right'),
            maxHP: game.rightCapper.maxHealth,
            currentHP: game.rightCapper.health,
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

      castleManager.clear()

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
  }, [webglSupport, battleId, game, initializeBattle])

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

  // Update battle status overlay (countdown timers) every second
  useEffect(() => {
    if (!containerRef.current || !containerReady) return

    const container = containerRef.current
    const canvasWidth = getCanvasWidth()
    const canvasHeight = getCanvasHeight()

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
      canvasHeight
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
        canvasHeight
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [status, gameStartTime, q1EndTime, q2EndTime, halftimeEndTime, q3EndTime, q4EndTime, winner, containerReady])

  if (webglSupport && !webglSupport.supported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-slate-950 text-white p-8 rounded-lg">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-red-500 mb-2">WebGL Not Supported</h2>
        <p className="text-gray-400 text-center max-w-md">{webglSupport.error}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* PixiJS Canvas with integrated overlays */}
      <div
        ref={canvasRef}
        className="flex justify-center items-center"
      />
    </div>
  )
}

