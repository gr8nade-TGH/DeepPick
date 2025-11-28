/**
 * Pick Types for Battle Bets
 * 
 * Defines the data structures for user picks that drive battle selection.
 * A "pick" is a user's bet on a game, which creates a corresponding "battle".
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Pick status aligned with game lifecycle
 */
export type PickStatus = 'upcoming' | 'live' | 'final';

/**
 * Pick result (only applicable when status === 'final')
 */
export type PickResult = 'win' | 'loss' | 'push' | 'pending';

/**
 * Bet type for the pick
 */
export type PickBetType = 'spread' | 'moneyline' | 'total';

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Team information for a pick
 */
export interface PickTeam {
  id: string;
  name: string;
  abbreviation: string; // e.g., "BOS", "MIA"
  color: string;        // Hex color for UI
}

/**
 * Game score (for live and final games)
 */
export interface GameScore {
  home: number;
  away: number;
  quarter?: number;      // 1-4, or 5+ for OT
  timeRemaining?: string; // e.g., "5:32"
  isHalftime?: boolean;
  isFinal?: boolean;
}

/**
 * Castle HP for battle visualization
 */
export interface CastleHP {
  current: number;
  max: number;
}

/**
 * Unit record for a capper on a specific team
 * Used for sorting picks by performance
 */
export interface TeamUnitRecord {
  teamId: string;
  units: number;        // e.g., +42, -5
  wins: number;
  losses: number;
  pushes: number;
}

/**
 * Core Pick interface - represents a user's bet
 */
export interface UserPick {
  // Identifiers
  id: string;
  oddsId: string;       // Reference to odds data
  gameId: string;       // MySportsFeeds game ID

  // User/Capper info
  capperId: string;
  capperName: string;

  // Bet details
  betType: PickBetType;
  pickedTeam: PickTeam;      // Team the user bet on
  opposingTeam: PickTeam;    // The opponent
  spread?: number;            // e.g., -2.5, +4.5
  line?: number;              // Moneyline odds
  totalLine?: number;         // For over/under
  overUnder?: 'over' | 'under';

  // Status & Timing
  status: PickStatus;
  gameStartTime: Date;

  // Live game data (populated when status === 'live')
  score?: GameScore;
  castleHP?: CastleHP;       // User's castle HP in the battle

  // Final result (populated when status === 'final')
  result?: PickResult;
  finalScore?: GameScore;

  // Performance data (for sorting)
  unitRecord: TeamUnitRecord;

  // Battle reference
  battleId?: string;          // Links to battle in multiGameStore
}

// ============================================================================
// SELECTION STATE
// ============================================================================

/**
 * Represents the current selection state
 */
export interface PickSelectionState {
  /** Currently active tab filter */
  activeFilter: PickStatus | 'all';

  /** ID of pick in Battle 1 (anchor slot) */
  battle1PickId: string | null;

  /** ID of pick in Battle 2 (swap slot) */
  battle2PickId: string | null;

  /** All user picks (unfiltered) */
  picks: UserPick[];

  /** Filtered picks based on activeFilter */
  filteredPicks: UserPick[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: string | null;
}

// ============================================================================
// DERIVED TYPES
// ============================================================================

/**
 * Pick chip display data (computed from UserPick)
 */
export interface PickChipData {
  pickId: string;

  // Display strings
  teamAbbr: string;        // "BOS"
  spread: string;          // "-2.5" or "+4.5"
  opponentAbbr: string;    // "MIA"
  unitRecordDisplay: string; // "+42 units" or "-5 units"

  // Status-specific display
  status: PickStatus;
  statusDisplay: string;   // "Q2 54-48" or "7:30 PM" or "W 112-98"

  // Visual state
  isSelected: boolean;
  slotNumber: 1 | 2 | null; // Which battle slot (1, 2, or not selected)

  // Colors
  teamColor: string;
  unitRecordColor: 'green' | 'red' | 'neutral';
  resultColor?: 'green' | 'red' | 'gray'; // For final picks

  // HP (for live battles)
  castleHP?: CastleHP;
}

/**
 * Tab count data for the filter tabs
 */
export interface PickTabCounts {
  all: number;
  live: number;
  upcoming: number;
  final: number;
}

// ============================================================================
// ACTION TYPES (for store)
// ============================================================================

export interface PickSelectionActions {
  /** Set the active filter tab */
  setActiveFilter: (filter: PickStatus | 'all') => void;

  /** Select a pick for a battle slot */
  selectPick: (pickId: string) => void;

  /** Deselect a pick */
  deselectPick: (pickId: string) => void;

  /** Set picks from API */
  setPicks: (picks: UserPick[]) => void;

  /** Update a single pick (e.g., live score update) */
  updatePick: (pickId: string, updates: Partial<UserPick>) => void;

  /** Auto-select top 2 picks by unit record */
  autoSelectTopPicks: () => void;

  /** Reset selection state */
  reset: () => void;
}

// ============================================================================
// STORE TYPE
// ============================================================================

export type PickBattleStore = PickSelectionState & PickSelectionActions;

