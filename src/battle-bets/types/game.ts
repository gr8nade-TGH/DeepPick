/**
 * Core game types for Battle Bets V3
 */

export interface Position {
  x: number;
  y: number;
}

export type StatType = 'pts' | 'reb' | 'ast' | 'stl' | '3pt';

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  color: number; // Hex color for PixiJS
  colorHex: string; // Hex color string for CSS
}

/**
 * Unit record for a capper on a specific team
 * Tracks their betting performance (units won/lost)
 */
export interface TeamUnitRecord {
  teamId: string;
  units: number; // Positive = winning, negative = losing (e.g., +40 units, -10 units)
  wins: number; // Number of winning picks
  losses: number; // Number of losing picks
  pushes: number; // Number of push picks (tie)
}

/**
 * Castle configuration for visual representation
 */
export interface CastleData {
  id: string;
  capperId: string;
  capperName?: string;
  capperRank?: string;
  capperLevel?: number;
  currentHP: number;
  maxHP: number;
  position?: { x: number; y: number };
  scale?: number;
  boxWidth?: number;
  side?: 'left' | 'right';
}

export interface Capper {
  id: string;
  name: string;
  favoriteTeam: Team;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  leaderboardRank: number; // Capper's rank on the global leaderboard (1 = #1, 2 = #2, etc.)

  // Unit records per team (determines TOTAL defense dot count across all stats)
  // Example: +40 units = 40 total defense dots distributed across all 5 stat rows
  // Each stat row has max 5 cells, so 40 dots = ~8 dots per stat row
  teamRecords: TeamUnitRecord[];

  // Equipped items (3 item slots)
  equippedItems?: {
    slot1: string | null; // Item ID
    slot2: string | null; // Item ID
    slot3: string | null; // Item ID
  };

  // Castle visual representation (optional - for Battle Bets fortress mode)
  castle?: CastleData;
}

export type GameStatus = 'SCHEDULED' | '1Q' | '2Q' | '3Q' | '4Q' | 'OT' | 'OT2' | 'OT3' | 'OT4' | 'FINAL';

export interface Game {
  id: string;
  leftTeam: Team;
  rightTeam: Team;
  leftCapper: Capper;
  rightCapper: Capper;
  currentQuarter: number;
  spread?: number; // e.g., -4.5 (negative means left team is favored)
  gameDate?: string; // e.g., "Jan 15, 2024"
  gameTime?: string; // e.g., "7:30 PM ET"
  leftScore?: number; // Live score for left team (updated per quarter)
  rightScore?: number; // Live score for right team (updated per quarter)
  status?: GameStatus; // Current game status
}

/**
 * HP tracking for each stat row (replaces individual defense dots)
 * Each stat row has a single HP value that depletes when hit by projectiles
 */
export interface StatRowHP {
  gameId: string;
  stat: StatType;
  side: 'left' | 'right';
  currentHP: number;
  maxHP: number;
}

export interface DefenseDotConfig {
  id: string;
  gameId: string;
  stat: StatType;
  side: 'left' | 'right';
  index: number;
  cellId: string; // Unique cell identifier (e.g., "Points_Left_Cell1")
  position: Position;
  team: Team;
  maxHp: number;
  isRegenerated?: boolean; // True if this is a gold regeneration dot from SHIELD
}

export interface ProjectileConfig {
  id: string;
  gameId: string;
  stat: StatType;
  side: 'left' | 'right';
  startPosition: Position;
  targetPosition: Position;
  damage: number;
  speed: number;
}

export interface StatValue {
  stat: StatType;
  leftValue: number;
  rightValue: number;
}

export interface Battle {
  id: string;
  gameId: string;
  quarter: number;
  stats: StatValue[];
  timestamp: number;
}

export interface BattleEvent {
  id: string;
  battleId: string;
  type: 'projectile_fired' | 'collision' | 'damage_dealt' | 'dot_destroyed';
  data: any;
  timestamp: number;
}

export interface Collision {
  projectileId: string;
  dotId: string;
  position: Position;
}

// Grid configuration
export interface GridConfig {
  cellWidth: number;
  cellHeight: number;
  defenseCellsPerSide: number;
  attackCellsPerSide: number;
  battlefieldWidth: number;
  statLabelWidth: number;
  weaponSlotWidth: number; // Width of weapon slot cell (same as cellWidth)
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  cellWidth: 30,
  cellHeight: 40, // Reduced from 50px to 40px for compact multi-game view
  defenseCellsPerSide: 10, // Increased from 5 to 10 for shield regeneration
  attackCellsPerSide: 0, // Removed attack cells to reduce grid width
  battlefieldWidth: 150, // Reduced from 400px to 150px for more castle box space
  statLabelWidth: 60,
  weaponSlotWidth: 30, // Same as cellWidth for consistency
};

// Team colors (PixiJS uses hex numbers, CSS uses hex strings)
export const TEAMS: Record<string, Team> = {
  LAL: {
    id: 'lakers',
    name: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    color: 0x552583, // Purple
    colorHex: '#552583',
  },
  MEM: {
    id: 'grizzlies',
    name: 'Memphis Grizzlies',
    abbreviation: 'MEM',
    color: 0x5D76A9, // Blue
    colorHex: '#5D76A9',
  },
  BOS: {
    id: 'celtics',
    name: 'Boston Celtics',
    abbreviation: 'BOS',
    color: 0x007A33, // Green
    colorHex: '#007A33',
  },
  CLE: {
    id: 'cavaliers',
    name: 'Cleveland Cavaliers',
    abbreviation: 'CLE',
    color: 0x860038, // Wine
    colorHex: '#860038',
  },
};

// Stat configuration
export interface StatConfig {
  type: StatType;
  label: string;
  color: number;
  colorHex: string;
}

export const STATS: Record<StatType, StatConfig> = {
  pts: {
    type: 'pts',
    label: 'PTS',
    color: 0xFF6B35,
    colorHex: '#FF6B35',
  },
  reb: {
    type: 'reb',
    label: 'REB',
    color: 0x4ECDC4,
    colorHex: '#4ECDC4',
  },
  ast: {
    type: 'ast',
    label: 'AST',
    color: 0xF7B731,
    colorHex: '#F7B731',
  },
  stl: {
    type: 'stl',
    label: 'STL',
    color: 0xFF3838,
    colorHex: '#FF3838',
  },
  '3pt': {
    type: '3pt',
    label: '3PT',
    color: 0x00D2FF,
    colorHex: '#00D2FF',
  },
};

/**
 * Calculate TOTAL defense dot count from unit record
 * FORMULA: 3:1 ratio (3 units = 1 defense dot)
 * Formula: units ÷ 3 (rounded UP)
 * Minimum: 0 (negative units = 0 dots)
 */
export function getTotalDefenseDotCount(units: number): number {
  if (units <= 0) return 0;
  return Math.ceil(units / 3); // 3:1 ratio, rounded up
}

/**
 * Distribute total defense dots across 5 stat rows
 * Returns array of 5 numbers representing dots per stat: [PTS, REB, AST, STL, 3PT]
 *
 * System:
 * 1. Base dots (1 per stat = 5 total) are already on the grid
 * 2. This function distributes ADDITIONAL dots from unit record using 60/20/10/5/5 percentages
 * 3. Final total = base dots (5) + distributed dots (from this function)
 *
 * Distribution percentages:
 * - PTS: 60%
 * - REB: 20%
 * - AST: 10%
 * - STL: 5%
 * - 3PT: 5%
 *
 * Example: 11 additional dots (from +32 units)
 *   Additional: [7, 2, 1, 1, 0] (60/20/10/5/5 of 11)
 *   Final on grid: [1+7, 1+2, 1+1, 1+1, 1+0] = [8, 3, 2, 2, 1] = 16 total
 */
export function distributeDotsAcrossStats(totalDots: number): number[] {
  if (totalDots <= 0) {
    return [1, 1, 1, 1, 1]; // Return base dots only
  }

  // Base dots are already on the grid (1 per stat = 5 total)
  // We're distributing ADDITIONAL dots on top of those
  const BASE_DOTS_PER_STAT = 1;

  // Start with base allocation
  let ptsTotal = BASE_DOTS_PER_STAT;
  let rebTotal = BASE_DOTS_PER_STAT;
  let astTotal = BASE_DOTS_PER_STAT;
  let stlTotal = BASE_DOTS_PER_STAT;
  let threePtTotal = BASE_DOTS_PER_STAT;

  // Distribute ALL dots using 60/20/10/5/5 percentages (no subtraction of base)
  const remainingDots = totalDots;

  if (remainingDots > 0) {
    // Distribute remaining dots using 60/20/10/5/5 percentages
    const ptsDots = remainingDots * 0.60;
    const rebDots = remainingDots * 0.20;
    const astDots = remainingDots * 0.10;
    const stlDots = remainingDots * 0.05;
    const threePtDots = remainingDots * 0.05;

    // Round down for each stat
    const ptsRounded = Math.floor(ptsDots);
    const rebRounded = Math.floor(rebDots);
    const astRounded = Math.floor(astDots);
    const stlRounded = Math.floor(stlDots);
    const threePtRounded = Math.floor(threePtDots);

    // Calculate remainder (due to rounding)
    const allocated = ptsRounded + rebRounded + astRounded + stlRounded + threePtRounded;
    const remainder = remainingDots - allocated;

    // Distribute remainder to stats with largest fractional parts
    const fractionalParts = [
      { index: 0, fraction: ptsDots - ptsRounded, value: ptsRounded },
      { index: 1, fraction: rebDots - rebRounded, value: rebRounded },
      { index: 2, fraction: astDots - astRounded, value: astRounded },
      { index: 3, fraction: stlDots - stlRounded, value: stlRounded },
      { index: 4, fraction: threePtDots - threePtRounded, value: threePtRounded },
    ];

    // Sort by fractional part (descending), with index as tiebreaker for stability
    fractionalParts.sort((a, b) => {
      if (b.fraction !== a.fraction) {
        return b.fraction - a.fraction;
      }
      return a.index - b.index; // Lower index (higher priority stat) wins ties
    });

    // Add remainder dots to stats with largest fractional parts
    for (let i = 0; i < remainder; i++) {
      fractionalParts[i].value++;
    }

    // Add distributed dots to base allocation
    ptsTotal += fractionalParts.find(item => item.index === 0)!.value;
    rebTotal += fractionalParts.find(item => item.index === 1)!.value;
    astTotal += fractionalParts.find(item => item.index === 2)!.value;
    stlTotal += fractionalParts.find(item => item.index === 3)!.value;
    threePtTotal += fractionalParts.find(item => item.index === 4)!.value;
  }

  // Cap each stat at 10 dots maximum (grid limitation: 10 cells per row)
  const MAX_DOTS_PER_STAT = 10;
  ptsTotal = Math.min(ptsTotal, MAX_DOTS_PER_STAT);
  rebTotal = Math.min(rebTotal, MAX_DOTS_PER_STAT);
  astTotal = Math.min(astTotal, MAX_DOTS_PER_STAT);
  stlTotal = Math.min(stlTotal, MAX_DOTS_PER_STAT);
  threePtTotal = Math.min(threePtTotal, MAX_DOTS_PER_STAT);

  return [ptsTotal, rebTotal, astTotal, stlTotal, threePtTotal];
}

/**
 * Get capper's unit record for a specific team
 */
export function getCapperUnitsForTeam(capper: Capper, teamId: string): number {
  const record = capper.teamRecords.find(r => r.teamId === teamId);
  return record?.units ?? 0;
}

/**
 * Format unit record for display
 * Example: +32 units → "+32 UNITS"
 * Example: -5 units → "-5 UNITS"
 * Example: 0 units → "0 UNITS"
 */
export function formatUnitRecord(units: number): string {
  const sign = units > 0 ? '+' : '';
  return `${sign}${units} UNITS`;
}

/**
 * Generate cell ID for a defense cell
 * Format: defense-{stat}-{side}-{index}
 * Example: "defense-points-left-0"
 *
 * IMPORTANT: This MUST match the format used in GridManager.createDefenseCell()
 * cellNumber is 1-based (1-10), but index is 0-based (0-9)
 */
export function getDefenseCellId(stat: StatType, side: 'left' | 'right', cellNumber: number): string {
  // Convert cellNumber (1-based) to index (0-based)
  const index = cellNumber - 1;
  return `defense-${stat}-${side}-${index}`;
}

