/**
 * Attack Node Icon - React component wrapper for Figma-designed attack node
 * Uses SVG exported from Figma with team color customization
 */

import React from 'react';

interface AttackNodeIconProps {
  /** Team color for the hexagon fill */
  teamColor?: string;
  /** Size in pixels (default: 32) */
  size?: number;
  /** Whether the node is active/firing */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const AttackNodeIcon: React.FC<AttackNodeIconProps> = ({
  teamColor = '#FDB927',
  size = 32,
  active = false,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        filter: active ? 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))' : 'none',
        transition: 'filter 0.2s ease',
      }}
    >
      {/* Hexagon outline */}
      <path
        d="M11 3.99999L16 2L21 3.99999L24 8.99999V15L21 20L16 22L11 20L8 15V8.99999L11 3.99999Z"
        fill={teamColor}
        stroke="black"
        strokeWidth="2"
      />
      
      {/* Attack indicator triangle */}
      <path
        d="M16 8L18.5 13.5H13.5L16 8Z"
        fill="#E74C3C"
        opacity={active ? 1 : 0.7}
      />
    </svg>
  );
};

export default AttackNodeIcon;

