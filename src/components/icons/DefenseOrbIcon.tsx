/**
 * Defense Orb Icon - React component wrapper for Figma-designed defense orb
 * Uses SVG exported from Figma with team color customization
 */

import React from 'react';

interface DefenseOrbIconProps {
  /** Team color for the shield fill */
  teamColor?: string;
  /** Size in pixels (default: 32) */
  size?: number;
  /** HP segments to show (0-3) */
  hp?: number;
  /** Maximum HP (default: 3) */
  maxHp?: number;
  /** Additional CSS classes */
  className?: string;
}

export const DefenseOrbIcon: React.FC<DefenseOrbIconProps> = ({
  teamColor = '#FDB927',
  size = 32,
  hp = 3,
  maxHp = 3,
  className = '',
}) => {
  const hpPercent = hp / maxHp;
  const opacity = 0.3 + (hpPercent * 0.7); // Fade based on HP

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
    >
      {/* Shield outline */}
      <path
        d="M16 4L8 8V14C8 19.5 11.8 24.7 16 26C20.2 25.3 24 20.5 24 14V8L16 4Z"
        fill={teamColor}
        stroke="black"
        strokeWidth="2"
      />
      
      {/* HP indicator diamond - only show if HP > 0 */}
      {hp > 0 && (
        <path
          d="M16 10L12 16L16 22L20 16L16 10Z"
          fill="#E74C3C"
          opacity={hpPercent}
        />
      )}
    </svg>
  );
};

export default DefenseOrbIcon;

