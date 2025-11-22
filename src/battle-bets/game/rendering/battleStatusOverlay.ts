/**
 * Battle Status Overlay - PixiJS Text Overlays
 * Renders countdown timers and status messages directly on the PixiJS canvas
 */

import * as PIXI from 'pixi.js'
import type { BattleStatus } from '@/lib/battle-bets/BattleTimer'

interface OverlayConfig {
  status: BattleStatus
  gameStartTime: string | null
  q1EndTime: string | null
  q2EndTime: string | null
  halftimeEndTime: string | null
  q3EndTime: string | null
  q4EndTime: string | null
  winner?: 'left' | 'right' | null
  canvasWidth: number
  canvasHeight: number
  // Optional: whether both cappers/opponents are present for this battle
  hasOpponent?: boolean
}

/**
 * Calculate time remaining until a target time
 */
function getTimeRemaining(targetTime: string | null): number {
  if (!targetTime) return 0
  const now = new Date().getTime()
  const target = new Date(targetTime).getTime()
  return Math.max(0, target - now)
}

/**
 * Format milliseconds as MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Create or update the battle status overlay
 * Returns a container with the overlay graphics and text
 */
export function createBattleStatusOverlay(config: OverlayConfig): PIXI.Container | null {
  const {
    status,
    gameStartTime,
    q1EndTime,
    q2EndTime,
    halftimeEndTime,
    q3EndTime,
    q4EndTime,
    canvasWidth,
    canvasHeight
  } = config

  // Determine what to show based on status
  let message = ''
  let countdown = ''
  let showOverlay = false
  let isFindingOpponent = false
  let loadingPhase = 0

  const now = Date.now()

  switch (status) {
    case 'scheduled':
      if (gameStartTime) {
        const timeRemaining = getTimeRemaining(gameStartTime)
        if (timeRemaining > 0) {
          message = 'GAME START'
          countdown = formatTime(timeRemaining)
          showOverlay = true
        }
      } else {
        // Only show the premium "FINDING OPPONENT" overlay when this battle truly
        // does not yet have an opponent. If both cappers are present, we skip the
        // overlay entirely so the live battle action is always visible.
        if (config.hasOpponent === false) {
          isFindingOpponent = true
          const phases = [
            'FINDING OPPONENT',
            'FINDING OPPONENT.',
            'FINDING OPPONENT..',
            'FINDING OPPONENT...',
          ]
          loadingPhase = Math.floor(now / 500) % phases.length
          message = phases[loadingPhase]
          showOverlay = true
        } else {
          showOverlay = false
        }
      }
      break

    case 'q1_pending':
      if (q1EndTime) {
        const timeRemaining = getTimeRemaining(q1EndTime)
        if (timeRemaining > 0) {
          message = 'Q1 BATTLE IN'
          countdown = formatTime(timeRemaining)
          showOverlay = true
        }
      }
      break

    case 'q2_pending':
      if (q2EndTime) {
        const timeRemaining = getTimeRemaining(q2EndTime)
        if (timeRemaining > 0) {
          message = 'Q2 BATTLE IN'
          countdown = formatTime(timeRemaining)
          showOverlay = true
        }
      }
      break

    case 'halftime':
      if (halftimeEndTime) {
        const timeRemaining = getTimeRemaining(halftimeEndTime)
        if (timeRemaining > 0) {
          message = 'HALFTIME'
          countdown = formatTime(timeRemaining)
          showOverlay = true
        }
      }
      break

    case 'q3_pending':
      if (q3EndTime) {
        const timeRemaining = getTimeRemaining(q3EndTime)
        if (timeRemaining > 0) {
          message = 'Q3 BATTLE IN'
          countdown = formatTime(timeRemaining)
          showOverlay = true
        }
      }
      break

    case 'q4_pending':
      if (q4EndTime) {
        const timeRemaining = getTimeRemaining(q4EndTime)
        if (timeRemaining > 0) {
          message = 'Q4 BATTLE IN'
          countdown = formatTime(timeRemaining)
          showOverlay = true
        }
      }
      break

    case 'q1_complete':
      // Disabled - quarter logic needs to be re-implemented
      showOverlay = false
      break

    case 'q2_complete':
      // Disabled - quarter logic needs to be re-implemented
      showOverlay = false
      break

    case 'q3_complete':
      // Disabled - quarter logic needs to be re-implemented
      showOverlay = false
      break

    case 'q4_complete':
      // Disabled - quarter logic needs to be re-implemented
      showOverlay = false
      break

    case 'final':
      message = 'FINAL'
      showOverlay = true
      break

    case 'complete':
      message = 'BATTLE COMPLETE'
      showOverlay = true
      break

    default:
      // Don't show overlay for any other status
      showOverlay = false
      break
  }

  if (!showOverlay) {
    return null
  }

  // Create container for overlay
  const container = new PIXI.Container()
  container.label = 'battle-status-overlay'

  // Semi-transparent background
  const background = new PIXI.Graphics()
  background.rect(0, 0, canvasWidth, canvasHeight)
  background.fill({ color: 0x000000, alpha: 0.7 })
  container.addChild(background)

  // Premium status box
  const boxWidth = isFindingOpponent ? 700 : 600
  const boxHeight = isFindingOpponent ? 170 : countdown ? 180 : 120
  const boxX = (canvasWidth - boxWidth) / 2
  const boxY = (canvasHeight - boxHeight) / 2

  const messageBox = new PIXI.Graphics()
  messageBox.roundRect(boxX, boxY, boxWidth, boxHeight, 16)

  if (isFindingOpponent) {
    // Dark navy panel with orange edge for the "searching" state
    messageBox.fill({ color: 0x020617, alpha: 0.96 })
    messageBox.stroke({ width: 4, color: 0xf97316, alpha: 0.9 })
  } else {
    messageBox.fill({ color: 0xffffff })
  }

  container.addChild(messageBox)

  // Message text (large, bold)
  const messageText = new PIXI.Text({
    text: message,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: isFindingOpponent ? 40 : 48,
      fontWeight: '900',
      fill: isFindingOpponent ? 0xfacc15 : 0x000000,
      align: 'center',
      letterSpacing: isFindingOpponent ? 2 : 0,
    },
  })
  messageText.anchor.set(0.5)
  messageText.x = canvasWidth / 2
  messageText.y = isFindingOpponent ? boxY + 50 : countdown ? boxY + 50 : canvasHeight / 2
  container.addChild(messageText)

  if (isFindingOpponent) {
    // Subtitle explaining what's happening
    const subtitle = new PIXI.Text({
      text: 'Scanning for rival cappers and matching live NBA SPREAD battles...',
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        fontWeight: '500',
        fill: 0xe5e7eb,
        align: 'center',
      },
    })
    subtitle.anchor.set(0.5)
    subtitle.x = canvasWidth / 2
    subtitle.y = messageText.y + 36
    container.addChild(subtitle)

    // Animated loading dots (phase based on time so they pulse while overlay is visible)
    const dotCount = 4
    const dotRadius = 6
    const dotSpacing = 24
    const totalWidth = (dotCount - 1) * dotSpacing
    const startX = canvasWidth / 2 - totalWidth / 2
    const dotsY = boxY + boxHeight - 40

    for (let i = 0; i < dotCount; i++) {
      const dot = new PIXI.Graphics()
      const active = i <= loadingPhase

      dot.circle(0, 0, dotRadius)
      dot.fill({
        color: active ? 0xf97316 : 0x4b5563,
        alpha: active ? 1 : 0.6,
      })

      dot.x = startX + i * dotSpacing
      dot.y = dotsY

      container.addChild(dot)
    }
  }

  // Countdown text for timed battle phases
  if (countdown) {
    const countdownText = new PIXI.Text({
      text: countdown,
      style: {
        fontFamily: 'Arial Black, Arial',
        fontSize: 64,
        fontWeight: '900',
        fill: 0x000000,
        align: 'center',
      },
    })
    countdownText.anchor.set(0.5)
    countdownText.x = canvasWidth / 2
    countdownText.y = boxY + (isFindingOpponent ? 100 : 120)
    container.addChild(countdownText)
  }

  return container
}

/**
 * Update existing overlay or create new one
 */
export function updateBattleStatusOverlay(
  container: PIXI.Container,
  config: OverlayConfig
): void {
  // Remove old overlay
  const oldOverlay = container.children.find(child => child.label === 'battle-status-overlay')
  if (oldOverlay) {
    container.removeChild(oldOverlay)
    oldOverlay.destroy({ children: true })
  }

  // Create new overlay
  const newOverlay = createBattleStatusOverlay(config)
  if (newOverlay) {
    container.addChild(newOverlay)
  }
}

