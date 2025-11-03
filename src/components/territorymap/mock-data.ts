import { TerritoryData } from './types'

/**
 * Mock Territory Data for Testing
 * 
 * Shows:
 * - 12 claimed territories (owned by "SHIVA" capper)
 * - 2 active picks (LAL and GSW with live games)
 * - Remaining 16 territories unclaimed
 */
export const MOCK_TERRITORY_DATA: TerritoryData[] = [
  // ACTIVE PICKS (2)
  {
    teamAbbr: 'LAL',
    state: 'active',
    tier: 'dominant',
    capperUsername: 'SHIVA',
    units: 22.5,
    wins: 18,
    losses: 6,
    pushes: 1,
    activePick: {
      gameId: 'lal-gsw-2025-11-03',
      opponent: 'vs GSW',
      gameTime: '2025-11-03T19:00:00Z',
      prediction: 'OVER 225.5',
      confidence: 7.2,
      betType: 'TOTAL',
      line: 225.5
    }
  },
  {
    teamAbbr: 'GSW',
    state: 'active',
    tier: 'strong',
    capperUsername: 'SHIVA',
    units: 15.8,
    wins: 14,
    losses: 7,
    pushes: 0,
    activePick: {
      gameId: 'lal-gsw-2025-11-03',
      opponent: '@ LAL',
      gameTime: '2025-11-03T19:00:00Z',
      prediction: 'LAL -4.5',
      confidence: 6.5,
      betType: 'SPREAD',
      line: -4.5
    }
  },

  // CLAIMED TERRITORIES (10 more)
  {
    teamAbbr: 'BOS',
    state: 'claimed',
    tier: 'dominant',
    capperUsername: 'SHIVA',
    units: 25.3,
    wins: 20,
    losses: 5,
    pushes: 2
  },
  {
    teamAbbr: 'MIA',
    state: 'claimed',
    tier: 'strong',
    capperUsername: 'SHIVA',
    units: 18.2,
    wins: 16,
    losses: 8,
    pushes: 1
  },
  {
    teamAbbr: 'PHI',
    state: 'claimed',
    tier: 'strong',
    capperUsername: 'SHIVA',
    units: 12.7,
    wins: 13,
    losses: 9,
    pushes: 0
  },
  {
    teamAbbr: 'MIL',
    state: 'claimed',
    tier: 'strong',
    capperUsername: 'SHIVA',
    units: 11.4,
    wins: 12,
    losses: 8,
    pushes: 1
  },
  {
    teamAbbr: 'DEN',
    state: 'claimed',
    tier: 'weak',
    capperUsername: 'SHIVA',
    units: 8.9,
    wins: 10,
    losses: 9,
    pushes: 0
  },
  {
    teamAbbr: 'PHX',
    state: 'claimed',
    tier: 'weak',
    capperUsername: 'SHIVA',
    units: 6.3,
    wins: 9,
    losses: 8,
    pushes: 1
  },
  {
    teamAbbr: 'DAL',
    state: 'claimed',
    tier: 'weak',
    capperUsername: 'SHIVA',
    units: 4.8,
    wins: 8,
    losses: 7,
    pushes: 0
  },
  {
    teamAbbr: 'NYK',
    state: 'claimed',
    tier: 'weak',
    capperUsername: 'SHIVA',
    units: 3.2,
    wins: 7,
    losses: 6,
    pushes: 1
  },
  {
    teamAbbr: 'CHI',
    state: 'claimed',
    tier: 'weak',
    capperUsername: 'SHIVA',
    units: 2.1,
    wins: 6,
    losses: 5,
    pushes: 0
  },
  {
    teamAbbr: 'SAC',
    state: 'claimed',
    tier: 'weak',
    capperUsername: 'SHIVA',
    units: 0.7,
    wins: 5,
    losses: 4,
    pushes: 1
  },

  // UNCLAIMED TERRITORIES (18 remaining teams)
  { teamAbbr: 'BKN', state: 'unclaimed' },
  { teamAbbr: 'TOR', state: 'unclaimed' },
  { teamAbbr: 'CLE', state: 'unclaimed' },
  { teamAbbr: 'DET', state: 'unclaimed' },
  { teamAbbr: 'IND', state: 'unclaimed' },
  { teamAbbr: 'ATL', state: 'unclaimed' },
  { teamAbbr: 'CHA', state: 'unclaimed' },
  { teamAbbr: 'ORL', state: 'unclaimed' },
  { teamAbbr: 'WAS', state: 'unclaimed' },
  { teamAbbr: 'MIN', state: 'unclaimed' },
  { teamAbbr: 'OKC', state: 'unclaimed' },
  { teamAbbr: 'POR', state: 'unclaimed' },
  { teamAbbr: 'UTA', state: 'unclaimed' },
  { teamAbbr: 'LAC', state: 'unclaimed' },
  { teamAbbr: 'HOU', state: 'unclaimed' },
  { teamAbbr: 'MEM', state: 'unclaimed' },
  { teamAbbr: 'NOP', state: 'unclaimed' },
  { teamAbbr: 'SAS', state: 'unclaimed' },
]

