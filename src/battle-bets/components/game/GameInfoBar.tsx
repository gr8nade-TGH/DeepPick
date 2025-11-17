/**
 * Compact Game Info Bar - Bottom bar showing game details
 * Designed for multi-game stacking view
 */

import React, { useState } from 'react';
import type { Game } from '../../types/game';
import { getCapperUnitsForTeam, getTotalDefenseDotCount } from '../../types/game';
import './GameInfoBar.css';

interface GameInfoBarProps {
  game: Game;
}

export const GameInfoBar: React.FC<GameInfoBarProps> = ({ game }) => {
  const [leftRecordHover, setLeftRecordHover] = useState(false);
  const [rightRecordHover, setRightRecordHover] = useState(false);

  // Get team unit records with W-L-P
  const leftRecord = game.leftCapper.teamRecords.find(r => r.teamId === game.leftTeam.id);
  const rightRecord = game.rightCapper.teamRecords.find(r => r.teamId === game.rightTeam.id);

  // Get units
  const leftUnits = getCapperUnitsForTeam(game.leftCapper, game.leftTeam.id);
  const rightUnits = getCapperUnitsForTeam(game.rightCapper, game.rightTeam.id);

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
  const getTeamName = (fullName: string) => {
    // Extract last word(s) after city name
    // "Los Angeles Lakers" -> "LAKERS"
    // "Memphis Grizzlies" -> "GRIZZLIES"
    const parts = fullName.split(' ');
    return parts[parts.length - 1].toUpperCase();
  };

  return (
    <div className="game-info-bar">
      {/* Left Capper - All on one horizontal line */}
      <div className="capper-section left">
        {/* Capper Icon (circular avatar with leaderboard rank number) */}
        <div className="capper-icon">
          <div className="icon-circle">{game.leftCapper.leaderboardRank}</div>
        </div>

        {/* Capper Name */}
        <div className="capper-name">{game.leftCapper.name}</div>

        {/* Separator */}
        <div className="separator">|</div>

        {/* Team Name (just team name, not city) */}
        <div className="team-name">{getTeamName(game.leftTeam.name)}</div>

        {/* Separator */}
        <div className="separator">|</div>

        {/* Units with arrow */}
        <div
          className="capper-units"
          onMouseEnter={() => setLeftRecordHover(true)}
          onMouseLeave={() => setLeftRecordHover(false)}
        >
          <span className="units-value">{leftUnits > 0 ? '+' : ''}{Math.round(leftUnits * 10) / 10}U</span>
          <span className="units-arrow">{leftUnits > 0 ? '↑' : '↓'}</span>
          {leftRecordHover && (
            <div className="units-tooltip">
              <div><strong>{game.leftCapper.name}'s {game.leftTeam.abbreviation} Spread Record</strong></div>
              <div>{leftRecord?.wins || 0}W - {leftRecord?.losses || 0}L - {leftRecord?.pushes || 0}P</div>
              <div>{leftUnits} units ÷ 3 = <strong>{leftOrbs} defense orbs</strong></div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="separator">|</div>

        {/* Record */}
        <div className="capper-record">
          {leftRecord ? `${leftRecord.wins}-${leftRecord.losses}-${leftRecord.pushes}` : '0-0-0'}
        </div>

        {/* Pick Box (LAL -4.5) */}
        <div className="pick-box left-pick">
          <span className="pick-team">{game.leftTeam.abbreviation}</span>
          <span className="pick-spread">{leftSpread > 0 ? '+' : ''}{leftSpread}</span>
        </div>
      </div>

      {/* Center Score */}
      <div className="score-section">
        <div className="game-info">
          {game.gameDate || 'TBD'} | {game.gameTime || ''}
        </div>
        <div className="score-display">
          <div className="team-score">
            <span className="team-abbr">{game.leftTeam.abbreviation}</span>
            <span className="score-value">{leftScore}</span>
          </div>
          <div className="game-status">{game.status || 'SCHEDULED'}</div>
          <div className="team-score">
            <span className="score-value">{rightScore}</span>
            <span className="team-abbr">{game.rightTeam.abbreviation}</span>
          </div>
        </div>
      </div>

      {/* Right Capper - All on one horizontal line (mirrored) */}
      <div className="capper-section right">
        {/* Pick Box (MEM +4.5) */}
        <div className="pick-box right-pick">
          <span className="pick-team">{game.rightTeam.abbreviation}</span>
          <span className="pick-spread">{rightSpread > 0 ? '+' : ''}{rightSpread}</span>
        </div>

        {/* Record */}
        <div className="capper-record">
          {rightRecord ? `${rightRecord.wins}-${rightRecord.losses}-${rightRecord.pushes}` : '0-0-0'}
        </div>

        {/* Separator */}
        <div className="separator">|</div>

        {/* Units with arrow */}
        <div
          className="capper-units"
          onMouseEnter={() => setRightRecordHover(true)}
          onMouseLeave={() => setRightRecordHover(false)}
        >
          <span className="units-arrow">{rightUnits > 0 ? '↑' : '↓'}</span>
          <span className="units-value">{rightUnits > 0 ? '+' : ''}{Math.round(rightUnits * 10) / 10}U</span>
          {rightRecordHover && (
            <div className="units-tooltip">
              <div><strong>{game.rightCapper.name}'s {game.rightTeam.abbreviation} Spread Record</strong></div>
              <div>{rightRecord?.wins || 0}W - {rightRecord?.losses || 0}L - {rightRecord?.pushes || 0}P</div>
              <div>{rightUnits} units ÷ 3 = <strong>{rightOrbs} defense orbs</strong></div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="separator">|</div>

        {/* Team Name (just team name, not city) */}
        <div className="team-name">{getTeamName(game.rightTeam.name)}</div>

        {/* Separator */}
        <div className="separator">|</div>

        {/* Capper Name */}
        <div className="capper-name">{game.rightCapper.name}</div>

        {/* Capper Icon (circular avatar with leaderboard rank number) */}
        <div className="capper-icon">
          <div className="icon-circle">{game.rightCapper.leaderboardRank}</div>
        </div>
      </div>
    </div>
  );
};

