/**
 * Dynamic VS Display System
 * Replaces static "VS" text with dynamic status display
 * Shows: Countdown timer, Quarter status (Q1, Q2, Q3, Q4, OT), FINAL
 */

import * as PIXI from 'pixi.js';
import type { GameStatus } from '../../types/game';

interface VSDisplayConfig {
  centerX: number;
  centerY: number;
  status: GameStatus;
  gameStartTime?: string | null;
  currentQuarter?: number;
}

/**
 * Create or update dynamic VS display
 * Returns a container with the status text
 */
export function createDynamicVSDisplay(config: VSDisplayConfig): PIXI.Container {
  const { centerX, centerY, status, gameStartTime, currentQuarter } = config;

  const container = new PIXI.Container();
  container.label = 'dynamic-vs-display';
  container.position.set(centerX, centerY);

  // Determine what to display based on status
  const displayText = getDisplayText(status, gameStartTime, currentQuarter);
  const textColor = getTextColor(status);
  const fontSize = getFontSize(status);

  // Create main text
  const mainText = new PIXI.Text({
    text: displayText.main,
    style: {
      fontFamily: 'Arial Black, Arial',
      fontSize: fontSize,
      fontWeight: '900',
      fill: textColor,
      stroke: { color: 0x000000, width: 4 },
      dropShadow: {
        color: 0x000000,
        blur: 6,
        angle: Math.PI / 4,
        distance: 3,
        alpha: 0.8,
      },
    },
  });
  mainText.anchor.set(0.5);
  container.addChild(mainText);

  // Add subtitle if exists (e.g., countdown timer)
  if (displayText.subtitle) {
    const subtitleText = new PIXI.Text({
      text: displayText.subtitle,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        fontWeight: '600',
        fill: 0xaaaaaa,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    subtitleText.anchor.set(0.5);
    subtitleText.position.set(0, 30);
    container.addChild(subtitleText);
  }

  return container;
}

/**
 * Get display text based on game status
 */
function getDisplayText(
  status: GameStatus,
  gameStartTime?: string | null,
  currentQuarter?: number
): { main: string; subtitle?: string } {
  switch (status) {
    case 'SCHEDULED':
      // Show countdown timer if game start time is available
      if (gameStartTime) {
        const countdown = getCountdownText(gameStartTime);
        return {
          main: 'VS',
          subtitle: countdown,
        };
      }
      return { main: 'VS' };

    case '1Q':
      return { main: 'Q1' };

    case '2Q':
      return { main: 'Q2' };

    case '3Q':
      return { main: 'Q3' };

    case '4Q':
      return { main: 'Q4' };

    case 'OT':
      return { main: 'OT' };

    case 'OT2':
      return { main: 'OT2' };

    case 'OT3':
      return { main: 'OT3' };

    case 'OT4':
      return { main: 'OT4' };

    case 'FINAL':
      return { main: 'FINAL' };

    default:
      return { main: 'VS' };
  }
}

/**
 * Get countdown text from game start time
 */
function getCountdownText(gameStartTime: string): string {
  const now = Date.now();
  const startTime = new Date(gameStartTime).getTime();
  const diff = startTime - now;

  if (diff <= 0) {
    return 'STARTING...';
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get text color based on status
 */
function getTextColor(status: GameStatus): number {
  switch (status) {
    case 'SCHEDULED':
      return 0x999999; // Gray
    case '1Q':
    case '2Q':
    case '3Q':
    case '4Q':
      return 0x4ecdc4; // Cyan (active quarter)
    case 'OT':
    case 'OT2':
    case 'OT3':
    case 'OT4':
      return 0xff9f43; // Orange (overtime)
    case 'FINAL':
      return 0xff6b6b; // Red (final)
    default:
      return 0x999999;
  }
}

/**
 * Get font size based on status
 */
function getFontSize(status: GameStatus): number {
  // Smaller font for overtime labels (OT2, OT3, OT4)
  if (status === 'OT2' || status === 'OT3' || status === 'OT4') {
    return 32;
  }
  return 36;
}

