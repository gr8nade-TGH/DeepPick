/**
 * Castle Names Reference Data
 * Used for randomized castle item naming system
 */

// Team names (possessive form)
export const TEAM_NAMES = [
  "Warriors'",
  "Lakers'",
  "Celtics'",
  "Bulls'",
  "Spurs'",
  "Suns'",
  "Nets'",
  "Knicks'",
  "Hawks'",
  "Magic's",
  "Heat's",
  "Thunder's",
  "Raptors'",
  "Grizzlies'",
  "Hornets'",
  "Pistons'",
  "Cavaliers'",
  "Blazers'",
  "Nuggets'",
  "Jazz's",
  "Mavericks'",
  "Clippers'",
  "Sixers'",
  "Pacers'",
  "Kings'",
  "Wizards'",
  "Bucks'",
  "Rockets'",
  "Timberwolves'",
] as const;

// Legendary player names (one-name icons)
export const LEGENDARY_PLAYERS = [
  "Kobe's",
  "Jordan's",
  "Magic's",
  "Shaq's",
  "Wilt's",
  "Curry's",
  "KD's",
  "Giannis's",
  "Dirk's",
  "Duncan's",
  "Iverson's",
  "Hakeem's",
  "Nash's",
  "Kidd's",
  "Pippen's",
  "Kareem's",
  "Bird's",
] as const;

// Castle types ordered by rarity (highest to lowest)
export const CASTLE_TYPES = {
  LEGENDARY: 'Castle',      // Rarest - e.g., "Jordan's Castle"
  EPIC: 'Stronghold',       // e.g., "Lakers' Stronghold"
  RARE: 'Garrison',         // e.g., "Curry's Garrison"
  UNCOMMON: 'Guard Tower',  // e.g., "Hawks' Guard Tower"
  COMMON: 'Outpost',        // Most common - e.g., "Pistons' Outpost"
} as const;

export type CastleRarity = keyof typeof CASTLE_TYPES;
export type CastleTypeName = typeof CASTLE_TYPES[CastleRarity];
export type TeamName = typeof TEAM_NAMES[number];
export type LegendaryPlayer = typeof LEGENDARY_PLAYERS[number];

