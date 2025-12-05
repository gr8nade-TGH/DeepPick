/**
 * AI Archetype Definitions
 * 
 * Defines all 24 archetypes (12 TOTALS, 12 SPREAD) with their metadata,
 * philosophies, and X/Y/Z factor input definitions.
 */

export type BetType = 'TOTAL' | 'SPREAD'
export type Confidence = 'low' | 'medium' | 'high'
export type Direction = 'over' | 'under' | 'away' | 'home' | 'neutral'

export interface FactorInput {
  key: 'X' | 'Y' | 'Z'
  name: string
  description: string
  range: { min: number; max: number }
  unit?: string
}

export interface ArchetypeDefinition {
  id: string
  name: string
  icon: string
  description: string  // 2 sentences max
  betType: BetType
  philosophy: string
  focusFactors: string[]

  // Factor inputs that Pass 3 must produce
  factorInputs: {
    X: FactorInput
    Y: FactorInput
    Z: FactorInput
  }

  // Prompt templates (to be filled in)
  prompts?: {
    pass1: string
    pass2: string
    pass3: string
  }
}

// ============================================================================
// TOTALS ARCHETYPES (12)
// ============================================================================

export const TOTALS_ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'pace-prophet',
    name: 'The Pace Prophet',
    icon: '🚀',
    description: 'Tempo is destiny. Fast pace creates more possessions, more possessions create more points.',
    betType: 'TOTAL',
    philosophy: 'Pace differential is the #1 predictor of totals',
    focusFactors: ['pace', 'possessions', 'tempo'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Pace Differential',
        description: 'Combined team pace vs league average',
        range: { min: -10, max: 10 },
        unit: 'possessions/game'
      },
      Y: {
        key: 'Y',
        name: 'Recent Matchup Pace',
        description: 'Pace from recent meetings between these teams',
        range: { min: 85, max: 115 },
        unit: 'possessions/game'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'efficiency-expert',
    name: 'The Efficiency Expert',
    icon: '📊',
    description: 'Elite offense meets weak defense. Quality over quantity wins every time.',
    betType: 'TOTAL',
    philosophy: 'ORtg/DRtg matchups reveal scoring potential',
    focusFactors: ['ortg', 'drtg', 'efficiency'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Combined ORtg Differential',
        description: 'Both teams offensive rating vs league average',
        range: { min: -20, max: 20 },
        unit: 'points/100 poss'
      },
      Y: {
        key: 'Y',
        name: 'Combined DRtg Differential',
        description: 'Both teams defensive rating vs league average',
        range: { min: -20, max: 20 },
        unit: 'points/100 poss'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'hot-hand-hunter',
    name: 'The Hot Hand Hunter',
    icon: '🔥',
    description: 'Shooting streaks are real. Hot teams stay hot, cold teams stay cold.',
    betType: 'TOTAL',
    philosophy: '3PT shooting momentum predicts scoring',
    focusFactors: ['3p_pct', '3p_volume', 'shooting_trend'],
    factorInputs: {
      X: {
        key: 'X',
        name: '3PT% Differential',
        description: 'Combined 3PT% vs league average (last 5 games)',
        range: { min: -15, max: 15 },
        unit: 'percentage points'
      },
      Y: {
        key: 'Y',
        name: '3PT Volume Differential',
        description: 'Combined 3PA vs league average',
        range: { min: -10, max: 10 },
        unit: 'attempts/game'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'whistle-hunter',
    name: 'The Whistle Hunter',
    icon: '🎺',
    description: 'Refs control the game. Free throws are free points that inflate totals.',
    betType: 'TOTAL',
    philosophy: 'FT rate + aggressive drivers = easy overs',
    focusFactors: ['ft_rate', 'fouls', 'ref_tendency'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Combined FT Rate Differential',
        description: 'Both teams FT rate vs league average',
        range: { min: -0.15, max: 0.15 },
        unit: 'FTA/FGA ratio'
      },
      Y: {
        key: 'Y',
        name: 'Ref Whistle Tendency',
        description: 'Assigned ref crew foul rate vs league average',
        range: { min: -5, max: 5 },
        unit: 'fouls/game'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'sharp-scholar',
    name: 'The Sharp Scholar',
    icon: '⚖️',
    description: 'Trust the math. Balanced analysis across all variables produces consistent edge.',
    betType: 'TOTAL',
    philosophy: 'No single factor dominates - weighted composite wins',
    focusFactors: ['composite', 'variance', 'balance'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Weighted Composite Score',
        description: 'Multi-factor weighted average signal',
        range: { min: -10, max: 10 },
        unit: 'composite score'
      },
      Y: {
        key: 'Y',
        name: 'Variance Measure',
        description: 'Consistency of factor signals',
        range: { min: 0, max: 5 },
        unit: 'std dev'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'fade-artist',
    name: 'The Fade Artist',
    icon: '📉',
    description: 'Bet against the cold. Eroding defense and declining offense bleed points.',
    betType: 'TOTAL',
    philosophy: 'Defensive erosion tells the truth',
    focusFactors: ['drtg_trend', 'ortg_trend', 'regression'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Defensive Rating Trend',
        description: 'DRtg change over last 10 games',
        range: { min: -10, max: 10 },
        unit: 'points/100 poss'
      },
      Y: {
        key: 'Y',
        name: 'Offensive Rating Trend',
        description: 'ORtg change over last 10 games',
        range: { min: -10, max: 10 },
        unit: 'points/100 poss'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'tempo-tyrant',
    name: 'The Tempo Tyrant',
    icon: '❄️',
    description: 'Slow games grind. Low possessions plus strong defense equals unders.',
    betType: 'TOTAL',
    philosophy: 'Pace + defense together reveal grind-it-out games',
    focusFactors: ['slow_pace', 'defense', 'possessions'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Pace Differential',
        description: 'Combined pace vs league avg (negative = slower)',
        range: { min: -10, max: 10 },
        unit: 'possessions/game'
      },
      Y: {
        key: 'Y',
        name: 'Combined Defensive Strength',
        description: 'Both teams DRtg vs league average',
        range: { min: -15, max: 15 },
        unit: 'points/100 poss'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'injury-assassin',
    name: 'The Injury Assassin',
    icon: '💀',
    description: 'Missing stars change everything. The market adjusts too slowly.',
    betType: 'TOTAL',
    philosophy: 'Injuries create exploitable totals edges',
    focusFactors: ['injuries', 'ppg_impact', 'usage'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'PPG Impact of Injuries',
        description: 'Expected points lost/gained from injuries',
        range: { min: -15, max: 15 },
        unit: 'points/game'
      },
      Y: {
        key: 'Y',
        name: 'Defensive Scheme Change Impact',
        description: 'How injuries affect defensive matchups',
        range: { min: -10, max: 10 },
        unit: 'points/game'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'locksmith',
    name: 'The Locksmith',
    icon: '🔒',
    description: 'Elite defense creates low-scoring games. Lock it down, bet the under.',
    betType: 'TOTAL',
    philosophy: 'Defense wins and limits scoring',
    focusFactors: ['elite_defense', 'opp_fg_pct', 'paint_protection'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Combined Defensive Strength',
        description: 'Both teams defensive rating vs league average',
        range: { min: -15, max: 15 },
        unit: 'points/100 poss'
      },
      Y: {
        key: 'Y',
        name: 'Cold Shooting Factor',
        description: 'Opponent FG% allowed vs league average',
        range: { min: -10, max: 10 },
        unit: 'percentage points'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'grinder-totals',
    name: 'The Grinder',
    icon: '🏔️',
    description: 'Slow, ugly, under. Pace kills scoring, fatigue kills offense.',
    betType: 'TOTAL',
    philosophy: 'Slow pace + cold shooting = grinding unders',
    focusFactors: ['slow_pace', 'shooting_slump', 'fatigue'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Pace Differential',
        description: 'Combined pace vs league avg (negative = under)',
        range: { min: -10, max: 10 },
        unit: 'possessions/game'
      },
      Y: {
        key: 'Y',
        name: 'Shooting Efficiency Decline',
        description: 'Combined eFG% trend (negative = declining)',
        range: { min: -10, max: 10 },
        unit: 'percentage points'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'rest-detective',
    name: 'The Rest Detective',
    icon: '🛏️',
    description: 'Fatigue kills performance. Fresh legs score, tired legs miss.',
    betType: 'TOTAL',
    philosophy: 'Schedule tells the scoring story',
    focusFactors: ['rest_days', 'back_to_back', 'travel'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Rest Advantage Differential',
        description: 'Days rest difference between teams',
        range: { min: -4, max: 4 },
        unit: 'days'
      },
      Y: {
        key: 'Y',
        name: 'Back-to-Back Impact',
        description: 'Expected scoring change from B2B',
        range: { min: -10, max: 10 },
        unit: 'points/game'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'cold-hunter',
    name: 'The Cold Hunter',
    icon: '🧊',
    description: 'Fade the slump. Cold shooting teams dont suddenly heat up.',
    betType: 'TOTAL',
    philosophy: 'Shooting regression favors unders',
    focusFactors: ['cold_shooting', 'regression', 'slump'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Cold Shooting Magnitude',
        description: 'Combined shooting below season average',
        range: { min: -15, max: 15 },
        unit: 'percentage points'
      },
      Y: {
        key: 'Y',
        name: 'Shooting Trend Direction',
        description: 'Is shooting getting worse or recovering?',
        range: { min: -5, max: 5 },
        unit: 'trend score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  }
]

// ============================================================================
// SPREAD ARCHETYPES (12)
// ============================================================================

export const SPREAD_ARCHETYPES: ArchetypeDefinition[] = [
  {
    id: 'hot-hand',
    name: 'The Hot Hand',
    icon: '📈',
    description: 'Shooting streaks are real. Ride the hot teams, fade the cold.',
    betType: 'SPREAD',
    philosophy: 'Recent shooting momentum predicts ATS performance',
    focusFactors: ['fg_pct', '3p_pct', 'shooting_trend'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Shooting Efficiency Differential',
        description: 'eFG% differential between teams',
        range: { min: -15, max: 15 },
        unit: 'percentage points'
      },
      Y: {
        key: 'Y',
        name: 'Shooting Trend Strength',
        description: 'Momentum direction and magnitude',
        range: { min: -10, max: 10 },
        unit: 'trend score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'matchup-master',
    name: 'The Matchup Master',
    icon: '⚔️',
    description: 'Ignore records, focus on matchups. Offense vs defense reveals truth.',
    betType: 'SPREAD',
    philosophy: 'Four factors reveal true team quality',
    focusFactors: ['four_factors', 'matchup', 'efficiency'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Four Factors Differential',
        description: 'Composite four factors advantage',
        range: { min: -20, max: 20 },
        unit: 'composite score'
      },
      Y: {
        key: 'Y',
        name: 'Matchup-Specific Adjustments',
        description: 'Head-to-head style adjustments',
        range: { min: -10, max: 10 },
        unit: 'adjustment points'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'disruptor',
    name: 'The Disruptor',
    icon: '🌀',
    description: 'Chaos wins games. Force turnovers, control destiny.',
    betType: 'SPREAD',
    philosophy: 'Turnovers are the great equalizer',
    focusFactors: ['turnovers', 'steals', 'pressure'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Turnover Differential',
        description: 'Expected turnover margin',
        range: { min: -10, max: 10 },
        unit: 'turnovers/game'
      },
      Y: {
        key: 'Y',
        name: 'Defensive Pressure Rating',
        description: 'Forced turnover rate differential',
        range: { min: -5, max: 5 },
        unit: 'pressure score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'closer',
    name: 'The Closer',
    icon: '🏆',
    description: 'Net rating determines winners. Fundamentals beat narratives.',
    betType: 'SPREAD',
    philosophy: 'Better teams close games and cover',
    focusFactors: ['net_rating', 'clutch', 'closing'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Net Rating Differential',
        description: 'Point differential per 100 possessions',
        range: { min: -20, max: 20 },
        unit: 'points/100 poss'
      },
      Y: {
        key: 'Y',
        name: 'Clutch Performance Rating',
        description: 'Performance in close games',
        range: { min: -10, max: 10 },
        unit: 'clutch score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'injury-hawk',
    name: 'The Injury Hawk',
    icon: '🦅',
    description: 'Lines move slow. Beat the book before they fully adjust to injuries.',
    betType: 'SPREAD',
    philosophy: 'Star absences create 4-7 point swings',
    focusFactors: ['injuries', 'line_movement', 'impact'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Injury Impact on Spread',
        description: 'Expected point swing from injuries',
        range: { min: -10, max: 10 },
        unit: 'points'
      },
      Y: {
        key: 'Y',
        name: 'Line Movement vs Injury News',
        description: 'Has market fully adjusted?',
        range: { min: -5, max: 5 },
        unit: 'adjustment score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'board-bully',
    name: 'The Board Bully',
    icon: '💪',
    description: 'Control the glass, control the game. Rebounding wins ATS.',
    betType: 'SPREAD',
    philosophy: 'Offensive boards = 2nd chances, defensive boards = end possessions',
    focusFactors: ['rebounding', 'second_chance', 'glass'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Rebounding Differential',
        description: 'Expected rebound margin',
        range: { min: -15, max: 15 },
        unit: 'rebounds/game'
      },
      Y: {
        key: 'Y',
        name: 'Second-Chance Points Impact',
        description: 'Extra possessions value',
        range: { min: -10, max: 10 },
        unit: 'points/game'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'cold-blooded',
    name: 'The Cold Blooded',
    icon: '👁️',
    description: 'Ignore the noise. Net rating plus four factors equals truth.',
    betType: 'SPREAD',
    philosophy: 'Sharps trust math, public chases hype',
    focusFactors: ['net_rating', 'four_factors', 'analytics'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Net Rating Differential',
        description: 'True team quality measure',
        range: { min: -20, max: 20 },
        unit: 'points/100 poss'
      },
      Y: {
        key: 'Y',
        name: 'Four Factors Composite',
        description: 'Efficiency metrics composite',
        range: { min: -15, max: 15 },
        unit: 'composite score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'grinder-spread',
    name: 'The Grinder',
    icon: '⛰️',
    description: 'Ball security wins. Low turnover teams frustrate and cover.',
    betType: 'SPREAD',
    philosophy: 'Discipline beats talent',
    focusFactors: ['turnovers', 'ball_security', 'discipline'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Turnover Differential',
        description: 'Ball security advantage',
        range: { min: -10, max: 10 },
        unit: 'turnovers/game'
      },
      Y: {
        key: 'Y',
        name: 'Ball Security Rating',
        description: 'Consistency in protecting ball',
        range: { min: -5, max: 5 },
        unit: 'security score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'ball-mover',
    name: 'The Ball Mover',
    icon: '🤝',
    description: 'Unselfish teams with chemistry cover. High AST/TOV ratio wins.',
    betType: 'SPREAD',
    philosophy: 'Smart decisions create quality shots',
    focusFactors: ['assists', 'ball_movement', 'chemistry'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Assist Efficiency Differential',
        description: 'AST/TOV ratio advantage',
        range: { min: -3, max: 3 },
        unit: 'ratio difference'
      },
      Y: {
        key: 'Y',
        name: 'Ball Movement Rating',
        description: 'Quality of offensive flow',
        range: { min: -10, max: 10 },
        unit: 'movement score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'ice-veins',
    name: 'Ice Veins',
    icon: '🎯',
    description: 'Clutch shooting wins close games. Nerves of steel cover spreads.',
    betType: 'SPREAD',
    philosophy: 'FT% and FG% under pressure separate winners',
    focusFactors: ['clutch_shooting', 'ft_pct', 'pressure'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Clutch Shooting Differential',
        description: 'FG% in final 5 minutes differential',
        range: { min: -15, max: 15 },
        unit: 'percentage points'
      },
      Y: {
        key: 'Y',
        name: 'Pressure Performance Rating',
        description: 'How teams perform when it matters',
        range: { min: -10, max: 10 },
        unit: 'pressure score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'lockdown',
    name: 'The Lockdown',
    icon: '🛡️',
    description: 'Defense travels. Elite perimeter defense limits opponents and covers.',
    betType: 'SPREAD',
    philosophy: 'Great 3PT defense controls modern NBA',
    focusFactors: ['perimeter_defense', '3pt_defense', 'opp_fg'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Perimeter Defense Differential',
        description: 'Opponent 3PT% allowed difference',
        range: { min: -10, max: 10 },
        unit: 'percentage points'
      },
      Y: {
        key: 'Y',
        name: 'Opponent FG% Allowed',
        description: 'Overall defensive efficiency',
        range: { min: -10, max: 10 },
        unit: 'percentage points'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  },

  {
    id: 'point-machine',
    name: 'The Point Machine',
    icon: '🔥',
    description: 'Outscore everyone. Scoring margin is destiny, simple math.',
    betType: 'SPREAD',
    philosophy: 'PPG differential reveals true quality',
    focusFactors: ['scoring_margin', 'ppg', 'consistency'],
    factorInputs: {
      X: {
        key: 'X',
        name: 'Scoring Margin Differential',
        description: 'Average point differential per game',
        range: { min: -20, max: 20 },
        unit: 'points/game'
      },
      Y: {
        key: 'Y',
        name: 'Consistency Rating',
        description: 'Variance in performance',
        range: { min: 0, max: 10 },
        unit: 'consistency score'
      },
      Z: {
        key: 'Z',
        name: 'Confidence Multiplier',
        description: 'AI confidence in the analysis',
        range: { min: 0, max: 1 }
      }
    }
  }
]

// ============================================================================
// COMBINED REGISTRY
// ============================================================================

export const ALL_ARCHETYPES = [...TOTALS_ARCHETYPES, ...SPREAD_ARCHETYPES]

export function getArchetypeById(id: string): ArchetypeDefinition | undefined {
  return ALL_ARCHETYPES.find(a => a.id === id)
}

export function getArchetypesByBetType(betType: BetType): ArchetypeDefinition[] {
  return ALL_ARCHETYPES.filter(a => a.betType === betType)
}

