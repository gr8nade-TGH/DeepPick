/**
 * Compact Game Info Bar - Bottom bar showing game details
 * Designed for multi-game stacking view
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Game } from '../../types/game';
import { getCapperUnitsForTeam, getTotalDefenseDotCount } from '../../types/game';
import { useMultiGameStore } from '../../store/multiGameStore';
import type { BattleStatus } from '@/lib/battle-bets/BattleTimer';
import './GameInfoBar.css';

interface GameInfoBarProps {
  game: Game;
  // Battle timing data for dynamic status display
  battleStatus?: BattleStatus;
  gameStartTime?: string | null;
  q1EndTime?: string | null;
  q2EndTime?: string | null;
  q3EndTime?: string | null;
  q4EndTime?: string | null;
}

export const GameInfoBar: React.FC<GameInfoBarProps> = ({
  game,
  battleStatus = 'SCHEDULED',
  gameStartTime,
  q1EndTime,
  q2EndTime,
  q3EndTime,
  q4EndTime
}) => {
  const [leftRecordHover, setLeftRecordHover] = useState(false);
  const [rightRecordHover, setRightRecordHover] = useState(false);
  const [leftTooltipPos, setLeftTooltipPos] = useState({ top: 0, left: 0 });
  const [rightTooltipPos, setRightTooltipPos] = useState({ top: 0, left: 0 });
  const leftUnitsRef = useRef<HTMLDivElement>(null);
  const rightUnitsRef = useRef<HTMLDivElement>(null);
  const [dynamicStatus, setDynamicStatus] = useState<{ main: string; subtitle?: string; subtitleColor?: string }>({ main: 'SCHEDULED' });

  // Get battle state from store
  const getBattle = useMultiGameStore(state => state.getBattle);
  const battle = getBattle(game.id);
  const currentQuarter = battle?.currentQuarter ?? 0;
  const isBattleInProgress = battle?.isBattleInProgress ?? false;
  const completedQuarters = battle?.completedQuarters ?? [];

  // Determine quarter end time based on current quarter
  let quarterEndTime: string | null = null;
  if (currentQuarter === 1 && q1EndTime) {
    quarterEndTime = q1EndTime;
  } else if (currentQuarter === 2 && q2EndTime) {
    quarterEndTime = q2EndTime;
  } else if (currentQuarter === 3 && q3EndTime) {
    quarterEndTime = q3EndTime;
  } else if (currentQuarter === 4 && q4EndTime) {
    quarterEndTime = q4EndTime;
  }

  // Get team unit records with W-L-P (with null safety)
  // First try teamRecords (per-team), then fall back to overall capper record
  const leftRecords = game.leftCapper?.teamRecords || [];
  const rightRecords = game.rightCapper?.teamRecords || [];
  const leftTeamRecord = leftRecords.find(r => r.teamId === game.leftTeam?.id);
  const rightTeamRecord = rightRecords.find(r => r.teamId === game.rightTeam?.id);

  // Use per-team record if available, otherwise use overall capper record
  const leftRecord = leftTeamRecord || {
    wins: game.leftCapper?.wins || 0,
    losses: game.leftCapper?.losses || 0,
    pushes: game.leftCapper?.pushes || 0,
  };
  const rightRecord = rightTeamRecord || {
    wins: game.rightCapper?.wins || 0,
    losses: game.rightCapper?.losses || 0,
    pushes: game.rightCapper?.pushes || 0,
  };

  // Get units - use capper.units if available, otherwise calculate from teamRecords
  const leftUnits = game.leftCapper?.units ?? getCapperUnitsForTeam(game.leftCapper, game.leftTeam.id);
  const rightUnits = game.rightCapper?.units ?? getCapperUnitsForTeam(game.rightCapper, game.rightTeam.id);

  // Calculate defense orbs
  const leftOrbs = getTotalDefenseDotCount(leftUnits);
  const rightOrbs = getTotalDefenseDotCount(rightUnits);

  // Format spread for display
  const leftSpread = game.spread || 0;
  const rightSpread = -leftSpread;

  // Get live scores (default to 0 if not set)
  const leftScore = game.leftScore || 0;
  const rightScore = game.rightScore || 0;

  // Three-part defense orb SVG (EXACTLY matching grid PIXI.Graphics style)
  // Matches DefenseDot.ts drawHPSegments() - 3 pie segments with small gaps
  const DefenseOrbIcon = () => {
    const radius = 8;
    const centerX = 10;
    const centerY = 10;
    const segmentCount = 3;
    const segmentAngle = (Math.PI * 2) / segmentCount;
    const gapAngle = 0.08;

    // Calculate segment paths (starting from top, going clockwise)
    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
      const startAngle = (i * segmentAngle) - (Math.PI / 2) + (gapAngle / 2);
      const endAngle = startAngle + segmentAngle - gapAngle;

      const startX = centerX + radius * Math.cos(startAngle);
      const startY = centerY + radius * Math.sin(startAngle);
      const endX = centerX + radius * Math.cos(endAngle);
      const endY = centerY + radius * Math.sin(endAngle);

      // Create arc path: Move to center, line to start, arc to end, line back to center
      const path = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY} Z`;
      segments.push(path);
    }

    return (
      <svg className="defense-orb-icon" width="16" height="16" viewBox="0 0 20 20">
        {/* Outer glow circle */}
        <circle cx={centerX} cy={centerY} r={radius + 4} fill="#4ECDC4" opacity="0.25" />

        {/* Three pie segments with black borders (matching PIXI graphics) */}
        {segments.map((path, i) => (
          <g key={i}>
            <path d={path} fill="#4ECDC4" opacity="1.0" />
            <path d={path} fill="none" stroke="#000000" strokeWidth="1.5" opacity="0.6" />
          </g>
        ))}
      </svg>
    );
  };

  // Get team name (extract just the team name, not city)
  const getTeamName = (fullName: string | null | undefined) => {
    if (!fullName) return 'TEAM';
    // Extract last word(s) after city name
    // "Los Angeles Lakers" -> "LAKERS"
    // "Memphis Grizzlies" -> "GRIZZLIES"
    const parts = fullName.split(' ');
    return parts[parts.length - 1].toUpperCase();
  };

  // Calculate dynamic status display based on BattleStatus
  useEffect(() => {
    const updateStatus = () => {
      switch (battleStatus) {
        case 'SCHEDULED':
          // Show countdown timer if game start time is available
          if (gameStartTime) {
            const countdown = getCountdownText(gameStartTime);
            if (countdown) {
              setDynamicStatus({ main: countdown });
            } else {
              setDynamicStatus({ main: 'Starting Soon' });
            }
          } else {
            setDynamicStatus({ main: 'Starting Soon' });
          }
          break;

        // IN-PROGRESS states: Real NBA quarter is happening, awaiting stats
        case 'Q1_IN_PROGRESS':
          setDynamicStatus({ main: 'Q1 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'Q2_IN_PROGRESS':
          setDynamicStatus({ main: 'Q2 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'Q3_IN_PROGRESS':
          setDynamicStatus({ main: 'Q3 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'Q4_IN_PROGRESS':
          setDynamicStatus({ main: 'Q4 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'OT1_IN_PROGRESS':
          setDynamicStatus({ main: 'OT1 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'OT2_IN_PROGRESS':
          setDynamicStatus({ main: 'OT2 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'OT3_IN_PROGRESS':
          setDynamicStatus({ main: 'OT3 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;
        case 'OT4_IN_PROGRESS':
          setDynamicStatus({ main: 'OT4 IN-PROGRESS', subtitleColor: '#ff9f43' });
          break;

        // BATTLE states: We have stats, battle animation is playing
        case 'Q1_BATTLE':
          setDynamicStatus({ main: 'Q1 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'Q2_BATTLE':
          setDynamicStatus({ main: 'Q2 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'Q3_BATTLE':
          setDynamicStatus({ main: 'Q3 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'Q4_BATTLE':
          setDynamicStatus({ main: 'Q4 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'OT1_BATTLE':
          setDynamicStatus({ main: 'OT1 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'OT2_BATTLE':
          setDynamicStatus({ main: 'OT2 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'OT3_BATTLE':
          setDynamicStatus({ main: 'OT3 BATTLE', subtitleColor: '#4ecdc4' });
          break;
        case 'OT4_BATTLE':
          setDynamicStatus({ main: 'OT4 BATTLE', subtitleColor: '#4ecdc4' });
          break;

        case 'HALFTIME':
          setDynamicStatus({ main: 'HALFTIME', subtitleColor: '#ffd700' });
          break;

        case 'GAME_OVER':
          setDynamicStatus({ main: 'GAME OVER', subtitleColor: '#e74c3c' });
          break;

        default:
          setDynamicStatus({ main: battleStatus });
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000); // Update every second for countdown
    return () => clearInterval(interval);
  }, [battleStatus, gameStartTime]);

  // Helper function to get countdown text
  const getCountdownText = (targetTime: string): string | null => {
    const now = Date.now();
    const target = new Date(targetTime).getTime();
    const remaining = target - now;

    if (remaining <= 0) return null;

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="game-info-bar">
      {/* Left Capper - [Rank] [Name] [Team+Spread Box] [Units Box] */}
      <div className="capper-section left">
        {/* Rank Badge */}
        <div className="capper-icon">
          <div className="icon-circle">{game.leftCapper.leaderboardRank}</div>
        </div>

        {/* Capper Name */}
        <div className="capper-name">{game.leftCapper.name}</div>

        {/* Pick Box (Team + Spread) */}
        <div
          className="pick-box"
          style={{
            borderColor: game.leftTeam.colorHex,
            boxShadow: `0 0 10px ${game.leftTeam.colorHex}80`,
          }}
        >
          <span className="pick-team">{game.leftTeam.abbreviation}</span>
          <span className="pick-spread" style={{ color: game.leftTeam.colorHex }}>{leftSpread > 0 ? '+' : ''}{leftSpread}</span>
        </div>

        {/* Units Box */}
        <div
          className="units-box"
          style={{
            borderColor: game.leftTeam.colorHex,
            boxShadow: `0 0 10px ${game.leftTeam.colorHex}80`,
          }}
          ref={leftUnitsRef}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setLeftTooltipPos({
              top: rect.top - 8,
              left: rect.left + rect.width / 2
            });
            setLeftRecordHover(true);
          }}
          onMouseLeave={() => setLeftRecordHover(false)}
        >
          <span className="units-value" style={{ color: game.leftTeam.colorHex }}>{leftUnits > 0 ? '+' : ''}{leftUnits.toFixed(1)}</span>
        </div>
        {/* Left Units Tooltip - Rendered via Portal to ensure it's above everything */}
        {leftRecordHover && createPortal(
          <div
            className="units-tooltip"
            style={{
              top: `${leftTooltipPos.top}px`,
              left: `${leftTooltipPos.left}px`
            }}
          >
            <div><strong>{game.leftCapper.name}'s {game.leftTeam.abbreviation} SPREAD Record</strong></div>
            <div>{leftRecord?.wins || 0}W - {leftRecord?.losses || 0}L - {leftRecord?.pushes || 0}P</div>
            <div>{leftUnits > 0 ? '+' : ''}{leftUnits.toFixed(1)} units ÷ 3 = <strong>{leftOrbs} defense orbs</strong></div>
          </div>,
          document.body
        )}
      </div>

      {/* Center Score - Single line layout */}
      <div className="score-section">
        {/* Game date/time above the score section */}
        <div className="game-info">
          {game.gameDate || 'TBD'} | {game.gameTime || ''}
        </div>

        {/* Left team score */}
        <div className="team-score">
          <span className="team-abbr">{game.leftTeam.abbreviation}</span>
          <span className="score-value">{leftScore}</span>
        </div>

        {/* VS / Status in center */}
        <div className="game-status-dynamic">
          <div className="status-main">{dynamicStatus.main}</div>
          {dynamicStatus.subtitle && (
            <div
              className="status-subtitle"
              style={{ color: dynamicStatus.subtitleColor || '#4ecdc4' }}
            >
              {dynamicStatus.subtitle}
            </div>
          )}
        </div>

        {/* Right team score */}
        <div className="team-score">
          <span className="score-value">{rightScore}</span>
          <span className="team-abbr">{game.rightTeam.abbreviation}</span>
        </div>
      </div>

      {/* Right Capper - [Units Box] [Team+Spread Box] [Name] [Rank] (mirrored, right-aligned) */}
      <div className="capper-section right">
        {/* Units Box */}
        <div
          className="units-box"
          style={{
            borderColor: game.rightTeam.colorHex,
            boxShadow: `0 0 10px ${game.rightTeam.colorHex}80`,
          }}
          ref={rightUnitsRef}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setRightTooltipPos({
              top: rect.top - 8,
              left: rect.left + rect.width / 2
            });
            setRightRecordHover(true);
          }}
          onMouseLeave={() => setRightRecordHover(false)}
        >
          <span className="units-value" style={{ color: game.rightTeam.colorHex }}>{rightUnits > 0 ? '+' : ''}{rightUnits.toFixed(1)}</span>
        </div>
        {/* Right Units Tooltip - Rendered via Portal to ensure it's above everything */}
        {rightRecordHover && createPortal(
          <div
            className="units-tooltip"
            style={{
              top: `${rightTooltipPos.top}px`,
              left: `${rightTooltipPos.left}px`
            }}
          >
            <div><strong>{game.rightCapper.name}'s {game.rightTeam.abbreviation} SPREAD Record</strong></div>
            <div>{rightRecord?.wins || 0}W - {rightRecord?.losses || 0}L - {rightRecord?.pushes || 0}P</div>
            <div>{rightUnits > 0 ? '+' : ''}{rightUnits.toFixed(1)} units ÷ 3 = <strong>{rightOrbs} defense orbs</strong></div>
          </div>,
          document.body
        )}

        {/* Pick Box (Team + Spread) */}
        <div
          className="pick-box"
          style={{
            borderColor: game.rightTeam.colorHex,
            boxShadow: `0 0 10px ${game.rightTeam.colorHex}80`,
          }}
        >
          <span className="pick-team">{game.rightTeam.abbreviation}</span>
          <span className="pick-spread" style={{ color: game.rightTeam.colorHex }}>{rightSpread > 0 ? '+' : ''}{rightSpread}</span>
        </div>

        {/* Capper Name */}
        <div className="capper-name">{game.rightCapper.name}</div>

        {/* Rank Badge */}
        <div className="capper-icon">
          <div className="icon-circle">{game.rightCapper.leaderboardRank}</div>
        </div>
      </div>
    </div>
  );
};

