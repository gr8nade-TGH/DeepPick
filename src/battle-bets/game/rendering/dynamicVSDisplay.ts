/**
 * Dynamic VS Display System
 * Replaces static "VS" text with dynamic status display
 * Shows: Countdown timer, Quarter status (Q1, Q2, Q3, Q4, OT), FINAL, Battle In-Progress
 */

import * as PIXI from 'pixi.js';
import type { GameStatus } from '../../types/game';

interface VSDisplayConfig {
  centerX: number;
  centerY: number;
  status: GameStatus;
  gameStartTime?: string | null;
  currentQuarter?: number;
  quarterEndTime?: string | null; // When current quarter ends (for countdown)
  isBattleInProgress?: boolean; // True when battle animation is running
  completedQuarters?: number[]; // Array of completed quarter numbers [1, 2, 3, 4]
}

/**
 * Create or update dynamic VS display
 * Returns a container with the status text
 */
export function createDynamicVSDisplay(config: VSDisplayConfig): PIXI.Container {
  const {
    centerX,
    centerY,
    status,
    gameStartTime,
    currentQuarter,
    quarterEndTime,
    isBattleInProgress,
    completedQuarters = []
  } = config;

  const container = new PIXI.Container();
  container.label = 'dynamic-vs-display';
  container.position.set(centerX, centerY);

  // Determine what to display based on status and battle state
  const displayText = getDisplayText(
    status,
    gameStartTime,
    currentQuarter,
    quarterEndTime,
    isBattleInProgress,
    completedQuarters
  );
  const textColor = getTextColor(status, isBattleInProgress);
  const fontSize = getFontSize(status, isBattleInProgress);

  // Create semi-transparent background panel for better readability
  const hasSubtitle = !!displayText.subtitle;
  const panelHeight = hasSubtitle ? 80 : 50;
  const panelWidth = 200;

  const background = new PIXI.Graphics();
  background.rect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);
  background.fill({ color: 0x000000, alpha: 0.7 });
  background.stroke({ color: textColor, width: 2, alpha: 0.5 });
  container.addChild(background);

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
  mainText.position.set(0, hasSubtitle ? -15 : 0);
  container.addChild(mainText);

  // Add subtitle if exists (e.g., countdown timer)
  if (displayText.subtitle) {
    const subtitleText = new PIXI.Text({
      text: displayText.subtitle,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        fontWeight: '700',
        fill: displayText.subtitleColor || 0xaaaaaa,
        stroke: { color: 0x000000, width: 2 },
        dropShadow: {
          color: 0x000000,
          blur: 4,
          angle: Math.PI / 4,
          distance: 2,
          alpha: 0.6,
        },
      },
    });
    subtitleText.anchor.set(0.5);
    subtitleText.position.set(0, 18);
    container.addChild(subtitleText);
  }

  return container;
}

/**
 * Get display text based on game status and battle state
 */
function getDisplayText(
  status: GameStatus,
  gameStartTime?: string | null,
  currentQuarter?: number,
  quarterEndTime?: string | null,
  isBattleInProgress?: boolean,
  completedQuarters: number[] = []
): { main: string; subtitle?: string; subtitleColor?: number } {

  // If battle is in progress for a specific quarter, show "Q# Battle In-Progress"
  if (isBattleInProgress && currentQuarter) {
    return {
      main: `Q${currentQuarter}`,
      subtitle: 'Battle In-Progress',
      subtitleColor: 0xff9f43, // Orange for active battle
    };
  }

  switch (status) {
    case 'SCHEDULED':
      // Show countdown timer if game start time is available
      if (gameStartTime) {
        const countdown = getCountdownText(gameStartTime);
        return {
          main: 'VS',
          subtitle: `Game starts in ${countdown}`,
          subtitleColor: 0x4ecdc4, // Cyan
        };
      }
      return { main: 'VS' };

    case '1Q':
    case '2Q':
    case '3Q':
    case '4Q': {
      const quarter = parseInt(status[0]); // Extract quarter number (1, 2, 3, 4)

      // If this quarter is completed, show "Q# Complete"
      if (completedQuarters.includes(quarter)) {
        return {
          main: `Q${quarter}`,
          subtitle: 'Complete',
          subtitleColor: 0x10b981, // Green for complete
        };
      }

      // If quarter is in progress, show countdown to quarter end
      if (quarterEndTime) {
        const countdown = getCountdownText(quarterEndTime);
        return {
          main: `Q${quarter}`,
          subtitle: `In Progress • ${countdown}`,
          subtitleColor: 0x4ecdc4, // Cyan for active
        };
      }

      // Default: just show quarter
      return {
        main: `Q${quarter}`,
        subtitle: 'In Progress',
        subtitleColor: 0x4ecdc4,
      };
    }

    case 'OT':
      return {
        main: 'OT',
        subtitle: quarterEndTime ? `In Progress • ${getCountdownText(quarterEndTime)}` : 'In Progress',
        subtitleColor: 0xff9f43, // Orange for overtime
      };

    case 'OT2':
      return {
        main: 'OT2',
        subtitle: quarterEndTime ? `In Progress • ${getCountdownText(quarterEndTime)}` : 'In Progress',
        subtitleColor: 0xff9f43,
      };

    case 'OT3':
      return {
        main: 'OT3',
        subtitle: quarterEndTime ? `In Progress • ${getCountdownText(quarterEndTime)}` : 'In Progress',
        subtitleColor: 0xff9f43,
      };

    case 'OT4':
      return {
        main: 'OT4',
        subtitle: quarterEndTime ? `In Progress • ${getCountdownText(quarterEndTime)}` : 'In Progress',
        subtitleColor: 0xff9f43,
      };

    case 'FINAL':
      return {
        main: 'FINAL',
        subtitle: 'Game Complete',
        subtitleColor: 0xff6b6b, // Red
      };

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
 * Get text color based on status and battle state
 */
function getTextColor(status: GameStatus, isBattleInProgress?: boolean): number {
  // If battle is in progress, use orange
  if (isBattleInProgress) {
    return 0xff9f43; // Orange
  }

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
 * Get font size based on status and battle state
 */
function getFontSize(status: GameStatus, isBattleInProgress?: boolean): number {
  // Smaller font for overtime labels (OT2, OT3, OT4)
  if (status === 'OT2' || status === 'OT3' || status === 'OT4') {
    return 32;
  }

  // Slightly smaller when battle is in progress (to fit subtitle)
  if (isBattleInProgress) {
    return 34;
  }

  return 36;
}

