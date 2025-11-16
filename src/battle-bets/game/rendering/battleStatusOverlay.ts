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
        message = 'FINDING OPPONENT...'
        showOverlay = true
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
      message = 'Q1 COMPLETE'
      showOverlay = true
      break

    case 'q2_complete':
      message = 'Q2 COMPLETE'
      showOverlay = true
      break

    case 'q3_complete':
      message = 'Q3 COMPLETE'
      showOverlay = true
      break

    case 'q4_complete':
      message = 'Q4 COMPLETE'
      showOverlay = true
      break

    case 'final':
      message = 'FINAL'
      showOverlay = true
      break

    case 'complete':
      message = 'BATTLE COMPLETE'
      showOverlay = true
      break

    // Don't show overlay during active quarters
    case 'q1_active':
    case 'q2_active':
    case 'q3_active':
    case 'q4_active':
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

  // White box for message
  const boxWidth = 600
  const boxHeight = countdown ? 180 : 120
  const boxX = (canvasWidth - boxWidth) / 2
  const boxY = (canvasHeight - boxHeight) / 2

  const messageBox = new PIXI.Graphics()
  messageBox.rect(boxX, boxY, boxWidth, boxHeight)
  messageBox.fill({ color: 0xffffff })
  container.addChild(messageBox)

  // Message text (black, bold, large)
  const messageText = new PIXI.Text({
    text: message,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: 48,
      fontWeight: '900',
      fill: 0x000000,
      align: 'center'
    }
  })
  messageText.anchor.set(0.5)
  messageText.x = canvasWidth / 2
  messageText.y = countdown ? boxY + 50 : canvasHeight / 2
  container.addChild(messageText)

  // Countdown text (black, bold, huge)
  if (countdown) {
    const countdownText = new PIXI.Text({
      text: countdown,
      style: {
        fontFamily: 'Arial Black, Arial',
        fontSize: 64,
        fontWeight: '900',
        fill: 0x000000,
        align: 'center'
      }
    })
    countdownText.anchor.set(0.5)
    countdownText.x = canvasWidth / 2
    countdownText.y = boxY + 120
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

