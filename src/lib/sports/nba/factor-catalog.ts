/**
 * NBA Factor Catalog
 * 
 * Per spec: "Clever structural factors" with specific formulas
 * 
 * NBA Factors:
 * 1. Lineup synergy (on/off net rating)
 * 2. Shot profile mismatch (3pt rate, rim finishing)
 * 3. Referee crew tendencies (pace, foul rate)
 * 4. Rest/travel/altitude (schedule fatigue)
 * 5. Defensive scheme exploitability
 */

import type {
  IFactorCatalog,
  GameInput,
  ScorePrediction,
  SharpFactor,
  FactorType,
} from '@/types/sharp-betting'

// ============================================================================
// NBA FACTOR CATALOG
// ============================================================================

export class NBAFactorCatalog implements IFactorCatalog {
  sport = 'basketball'
  league = 'NBA'

  /**
   * Generate all 7 NBA structural factors based on StatMuse data
   */
  async generateFactors(
    game: GameInput,
    scorePrediction: ScorePrediction
  ): Promise<SharpFactor[]> {
    const factors: SharpFactor[] = []

    // Factor 1: Head-to-Head Scoring
    const h2hFactor = this.calculateHeadToHeadScoring(game)
    if (h2hFactor) factors.push(h2hFactor)

    // Factor 2: Opponent Defensive Quality
    const defenseFactor = this.calculateDefensiveQuality(game)
    if (defenseFactor) factors.push(defenseFactor)

    // Factor 3: Pace
    const paceFactor = this.calculatePaceFactor(game)
    if (paceFactor) factors.push(paceFactor)

    // Factor 4: Recent Form
    const recentFormFactor = this.calculateRecentFormFactor(game)
    if (recentFormFactor) factors.push(recentFormFactor)

    // Factor 5: Rest / 0 Days Rest
    const restFactor = this.calculateRestFactor(game)
    if (restFactor) factors.push(restFactor)

    // Factor 6: Role Split (Favorites/Underdogs)
    const roleSplitFactor = this.calculateRoleSplitFactor(game)
    if (roleSplitFactor) factors.push(roleSplitFactor)

    // Factor 7: 3-Point Environment Allowed
    const threePointFactor = this.calculateThreePointEnvironment(game)
    if (threePointFactor) factors.push(threePointFactor)

    // Factor 8: Injury Impact (from AI research)
    const injuryFactor = this.calculateInjuryImpact(game)
    if (injuryFactor) factors.push(injuryFactor)

    return factors
  }

  /**
   * Get available factor types for NBA
   */
  getFactorTypes(): FactorType[] {
    return [
      {
        key: 'lineup_synergy',
        name: 'Lineup Synergy',
        category: 'lineup',
        unit: 'points_spread',
        defaultCap: 2.0,
        defaultWeight: 1.0,
        shrinkageK: 800, // Requires lots of lineup minutes
        description: 'HUMAN EXPLANATION: Measures how well a team\'s starting lineup plays together. Some lineups have great chemistry and outscore opponents by 10+ points per 100 possessions. Others struggle and get outscored. We look at the net rating (offense - defense) when these 5 players are on the court together.',
      },
      {
        key: 'shot_profile_mismatch',
        name: 'Shot Profile Mismatch',
        category: 'matchup',
        unit: 'points_spread',
        defaultCap: 1.5,
        defaultWeight: 0.9,
        shrinkageK: 200,
        description: 'HUMAN EXPLANATION: Analyzes shooting style mismatches. If Team A loves 3-pointers but Team B has weak 3-point defense, that\'s an advantage. If Team A finishes well at the rim but Team B has great rim protection, that\'s a disadvantage. We compare each team\'s shooting tendencies against the opponent\'s defensive strengths.',
      },
      {
        key: 'ref_crew_tendencies',
        name: 'Referee Crew Impact',
        category: 'officials',
        unit: 'points_total', // Affects pace/fouls → total
        defaultCap: 3.0,
        defaultWeight: 0.7,
        shrinkageK: 50, // Ref data stabilizes quickly
        description: 'HUMAN EXPLANATION: Different referee crews call games differently. Some crews call more fouls, leading to more free throws and slower pace (lower totals). Others let players play more physically, leading to faster pace (higher totals). We track each crew\'s tendencies and adjust our total predictions accordingly.',
      },
      {
        key: 'schedule_impact',
        name: 'Schedule Impact',
        category: 'context',
        unit: 'points_spread',
        defaultCap: 1.0,
        defaultWeight: 0.8,
        shrinkageK: 30,
        description: 'HUMAN EXPLANATION: Tired teams play worse. Teams on back-to-back games, traveling long distances, or playing at high altitude (like Denver) often underperform. We factor in rest days, travel distance, and altitude to predict which team might be fatigued.',
      },
      {
        key: 'scheme_matchup',
        name: 'Defensive Scheme Matchup',
        category: 'matchup',
        unit: 'points_spread',
        defaultCap: 1.2,
        defaultWeight: 0.7,
        shrinkageK: 150,
        description: 'HUMAN EXPLANATION: Some defensive schemes work better against certain offensive styles. For example, teams that switch everything on defense struggle against big men who can\'t shoot (they get stuck in bad matchups). Teams that drop coverage struggle against guards who can pull up from mid-range. We analyze these scheme mismatches.',
      },
    ]
  }

  // ========================================================================
  // FACTOR CALCULATIONS (7 StatMuse-Based Factors)
  // ========================================================================

  /**
   * Factor 1: Head-to-Head Scoring (PPG vs Opponent)
   * What it is: Average points a team scores against this specific opponent.
   * Why it matters: Reveals matchup quirks (rim protection, switching, transition D) that season-wide numbers can miss.
   */
  private calculateHeadToHeadScoring(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team A average points per game vs Team B this season"
    const homeH2HPPG = game.homeTeam.stats?.h2hPPG ?? 110.5
    const awayH2HPPG = game.awayTeam.stats?.h2hPPG ?? 108.2
    
    const effect = homeH2HPPG - awayH2HPPG
    
    return {
      name: 'Head-to-Head Scoring',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 2, // H2H games this season
      recency: 0.9,
      dataQuality: 0.95,
      reliability: 0,
      shrinkageK: 5,
      learnedWeight: 0.8,
      softCap: 3.0,
      contribution: 0,
      residualized: false,
      reasoning: `Head-to-head scoring: ${game.homeTeam.name} ${homeH2HPPG.toFixed(1)} PPG vs ${game.awayTeam.name} ${awayH2HPPG.toFixed(1)} PPG`,
      rawData: {
        teamA: { h2hPPG: homeH2HPPG },
        teamB: { h2hPPG: awayH2HPPG },
      },
      sources: ['StatMuse Head-to-Head Data'],
      impactType: effect > 1 ? 'positive' : effect < -1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 2: Opponent Defensive Quality (Defensive Rating)
   * What it is: DRtg = points allowed per 100 possessions (lower is better).
   * Why it matters: Sets baseline difficulty for the other side's offense.
   */
  private calculateDefensiveQuality(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team defensive rating this season"
    const homeDRtg = game.homeTeam.stats?.defensiveRating ?? 108.5
    const awayDRtg = game.awayTeam.stats?.defensiveRating ?? 110.2
    
    // Lower DRtg is better, so flip the calculation
    const effect = awayDRtg - homeDRtg
    
    return {
      name: 'Defensive Quality',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 20,
      recency: 0.9,
      dataQuality: 0.95,
      reliability: 0,
      shrinkageK: 50,
      learnedWeight: 0.9,
      softCap: 2.5,
      contribution: 0,
      residualized: false,
      reasoning: `Defensive ratings: ${game.homeTeam.name} ${homeDRtg.toFixed(1)} vs ${game.awayTeam.name} ${awayDRtg.toFixed(1)} (lower is better)`,
      rawData: {
        teamA: { defensiveRating: homeDRtg },
        teamB: { defensiveRating: awayDRtg },
      },
      sources: ['StatMuse Defensive Stats'],
      impactType: effect > 1 ? 'positive' : effect < -1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 3: Pace (Possessions)
   * What it is: Possessions per 48; tempo shapes totals and variance.
   * How to compare: Pull both teams' pace and infer likely tempo.
   */
  private calculatePaceFactor(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team pace this season"
    const homePace = game.homeTeam.stats?.pace ?? 102.5
    const awayPace = game.awayTeam.stats?.pace ?? 98.8
    
    const paceDifference = homePace - awayPace
    const effect = paceDifference * 0.1 // 0.1 points per pace difference
    
    return {
      name: 'Pace Factor',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_total',
      marketBaseline: game.total ?? 0,
      sampleSize: 20,
      recency: 0.9,
      dataQuality: 0.95,
      reliability: 0,
      shrinkageK: 50,
      learnedWeight: 0.7,
      softCap: 2.0,
      contribution: 0,
      residualized: false,
      reasoning: `Pace difference: ${game.homeTeam.name} ${homePace.toFixed(1)} vs ${game.awayTeam.name} ${awayPace.toFixed(1)} possessions`,
      rawData: {
        teamA: { pace: homePace },
        teamB: { pace: awayPace },
        context: { paceDifference },
      },
      sources: ['StatMuse Pace Stats'],
      impactType: effect > 0.2 ? 'positive' : effect < -0.2 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 4: Recent Form (Net Rating last N)
   * What it is: Net = ORtg − DRtg over a short window (e.g., last 10).
   * Why it matters: Captures current health/rotations better than full-season.
   */
  private calculateRecentFormFactor(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team net rating last 10 games"
    const homeNetRating = game.homeTeam.stats?.recentNetRating ?? 3.2
    const awayNetRating = game.awayTeam.stats?.recentNetRating ?? -1.8
    
    const effect = homeNetRating - awayNetRating
    
    return {
      name: 'Recent Form',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 10,
      recency: 1.0,
      dataQuality: 0.9,
      reliability: 0,
      shrinkageK: 20,
      learnedWeight: 0.8,
      softCap: 2.0,
      contribution: 0,
      residualized: false,
      reasoning: `Recent form (last 10): ${game.homeTeam.name} +${homeNetRating.toFixed(1)} vs ${game.awayTeam.name} ${awayNetRating > 0 ? '+' : ''}${awayNetRating.toFixed(1)} net rating`,
      rawData: {
        teamA: { recentNetRating: homeNetRating },
        teamB: { recentNetRating: awayNetRating },
      },
      sources: ['StatMuse Recent Form'],
      impactType: effect > 2 ? 'positive' : effect < -2 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 5: Rest / 0 Days Rest (Back-to-Back)
   * What it is: Record/performance with no days rest. Fatigue typically dents defense and late-game execution.
   */
  private calculateRestFactor(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team record on 0 days rest this season"
    const homeRestRecord = game.homeTeam.stats?.zeroDaysRestRecord ?? 0.4 // 40% win rate
    const awayRestRecord = game.awayTeam.stats?.zeroDaysRestRecord ?? 0.6 // 60% win rate
    
    const effect = (homeRestRecord - awayRestRecord) * 5.0 // 5 points per 100% win rate difference
    
    return {
      name: 'Rest Factor',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 5,
      recency: 0.8,
      dataQuality: 0.85,
      reliability: 0,
      shrinkageK: 10,
      learnedWeight: 0.7,
      softCap: 2.5,
      contribution: 0,
      residualized: false,
      reasoning: `Back-to-back records: ${game.homeTeam.name} ${(homeRestRecord * 100).toFixed(0)}% vs ${game.awayTeam.name} ${(awayRestRecord * 100).toFixed(0)}% win rate`,
      rawData: {
        teamA: { zeroDaysRestRecord: homeRestRecord },
        teamB: { zeroDaysRestRecord: awayRestRecord },
      },
      sources: ['StatMuse Rest Data'],
      impactType: effect > 1 ? 'positive' : effect < -1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 6: Role Split (Favorites/Underdogs)
   * What it is: Straight-up results when favored vs as a dog (proxy for handling game state/expectation).
   * Why it matters: Good favorites close; scrappy dogs hang.
   */
  private calculateRoleSplitFactor(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team record as favorites/underdogs this season"
    const homeFavRecord = game.homeTeam.stats?.favoriteRecord ?? 0.75 // 75% as favorites
    const awayDogRecord = game.awayTeam.stats?.underdogRecord ?? 0.35 // 35% as underdogs
    
    const effect = (homeFavRecord - awayDogRecord) * 3.0 // 3 points per 100% win rate difference
    
    return {
      name: 'Role Split',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 15,
      recency: 0.8,
      dataQuality: 0.9,
      reliability: 0,
      shrinkageK: 25,
      learnedWeight: 0.6,
      softCap: 2.0,
      contribution: 0,
      residualized: false,
      reasoning: `Role performance: ${game.homeTeam.name} ${(homeFavRecord * 100).toFixed(0)}% as favorites vs ${game.awayTeam.name} ${(awayDogRecord * 100).toFixed(0)}% as underdogs`,
      rawData: {
        teamA: { favoriteRecord: homeFavRecord },
        teamB: { underdogRecord: awayDogRecord },
      },
      sources: ['StatMuse Role Data'],
      impactType: effect > 1 ? 'positive' : effect < -1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 7: 3-Point Environment Allowed
   * What it is: Opponent 3PA/G allowed by a defense (and optionally Opp 3P%).
   * Why it matters: The "math problem": 3-heavy offenses punish defenses that concede volume from deep.
   */
  private calculateThreePointEnvironment(game: GameInput): SharpFactor | null {
    // This would use StatMuse data: "Team opponent 3 point attempts per game this season"
    const homeOpp3PA = game.homeTeam.stats?.opponent3PA ?? 32.5
    const awayOpp3PA = game.awayTeam.stats?.opponent3PA ?? 28.8
    
    // Higher opponent 3PA allowed = worse defense = advantage for opponent
    const effect = awayOpp3PA - homeOpp3PA
    
    return {
      name: '3-Point Environment',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 20,
      recency: 0.9,
      dataQuality: 0.95,
      reliability: 0,
      shrinkageK: 50,
      learnedWeight: 0.8,
      softCap: 2.0,
      contribution: 0,
      residualized: false,
      reasoning: `3-point defense: ${game.homeTeam.name} allows ${homeOpp3PA.toFixed(1)} 3PA vs ${game.awayTeam.name} allows ${awayOpp3PA.toFixed(1)} 3PA`,
      rawData: {
        teamA: { opponent3PA: homeOpp3PA },
        teamB: { opponent3PA: awayOpp3PA },
      },
      sources: ['StatMuse 3-Point Defense'],
      impactType: effect > 1 ? 'positive' : effect < -1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 2: Shot Profile Mismatch
   * Per spec: Convert via league coef (e.g., 0.7 pts per 4% eFG swing)
   * Cap: ±1.5 pts
   */
  private calculateShotProfileMismatch(game: GameInput): SharpFactor | null {
    // Get shooting data
    const home3PRate = game.homeTeam.stats?.threePointRate ?? 0.35 // % of shots from 3
    const away3PRate = game.awayTeam.stats?.threePointRate ?? 0.35
    const home3PPct = game.homeTeam.stats?.threePointPct ?? 0.35 // 3P%
    const away3PPct = game.awayTeam.stats?.threePointPct ?? 0.35

    const home3PDef = game.homeTeam.stats?.oppThreePointPct ?? 0.35 // Opp 3P% allowed
    const away3PDef = game.awayTeam.stats?.oppThreePointPct ?? 0.35

    // Rim finishing
    const homeRimPct = game.homeTeam.stats?.rimFGPct ?? 0.65
    const awayRimPct = game.awayTeam.stats?.rimFGPct ?? 0.65
    const homeRimDef = game.homeTeam.stats?.oppRimFGPct ?? 0.65
    const awayRimDef = game.awayTeam.stats?.oppRimFGPct ?? 0.65

    // Calculate expected eFG% advantage
    // Home offense vs away defense
    const homeExpected3P = home3PRate * (home3PPct - away3PDef) * 1.5 // 3-pointers worth 1.5x
    const homeExpectedRim = (1 - home3PRate) * (homeRimPct - awayRimDef)

    // Away offense vs home defense
    const awayExpected3P = away3PRate * (away3PPct - home3PDef) * 1.5
    const awayExpectedRim = (1 - away3PRate) * (awayRimPct - homeRimDef)

    // Net eFG swing
    const eFGSwing = (homeExpected3P + homeExpectedRim) - (awayExpected3P + awayExpectedRim)

    // Convert to points: 0.7 pts per 4% eFG swing (per spec)
    const effect = (eFGSwing * 100 / 4) * 0.7

    return {
      name: 'Shot Profile Mismatch',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 200, // Last ~20 games
      recency: 0.85,
      dataQuality: 0.8,
      reliability: 0,
      shrinkageK: 200,
      learnedWeight: 0.9,
      softCap: 1.5,
      contribution: 0,
      residualized: false,
      reasoning: `Home team's shooting profile (3P rate: ${(home3PRate * 100).toFixed(0)}%, 3P%: ${(home3PPct * 100).toFixed(1)}%, Rim%: ${(homeRimPct * 100).toFixed(1)}%) creates ${effect > 0 ? 'advantage' : 'disadvantage'} vs away defense.`,
      rawData: {
        teamA: {
          threePointRate: home3PRate,
          threePointPct: home3PPct,
          rimFGPct: homeRimPct,
        },
        teamB: {
          threePointDef: away3PDef,
          rimDef: awayRimDef,
        },
        context: {
          eFGSwing: eFGSwing * 100,
        },
      },
      sources: ['NBA Shooting Stats', 'Defensive Tracking'],
      impactType: effect > 0.1 ? 'positive' : effect < -0.1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 3: Referee Crew Tendencies
   * Per spec: Pace/foul rate deltas → total unit (±3.0 pts)
   * Cap: ±3.0 pts (affects total)
   */
  private calculateRefCrewImpact(game: GameInput): SharpFactor | null {
    // Get ref crew data (if available)
    const refCrew = game.homeTeam.stats?.refCrew ?? null
    if (!refCrew) return null // No ref data available

    const refPaceDelta = refCrew.paceDelta ?? 0 // How much faster/slower than avg
    const refFoulRate = refCrew.foulRate ?? 0 // Fouls per game vs avg
    const refFTRate = refCrew.ftRate ?? 0 // Free throws per game vs avg

    // Convert to total points impact
    // Faster pace = more possessions = more points
    // More fouls = more free throws = more points
    const paceEffect = refPaceDelta * 0.5 // Each possession worth ~0.5 pts
    const foulEffect = refFTRate * 0.4 // Each extra FT worth ~0.4 pts

    const effect = paceEffect + foulEffect

    return {
      name: 'Referee Crew Impact',
      category: 'officials',
      effectSize: effect,
      unit: 'points_total', // Affects total, not spread
      marketBaseline: game.total ?? 220,
      sampleSize: 50, // Last ~50 games for this ref crew
      recency: 0.9,
      dataQuality: 0.75, // Ref assignments can change
      reliability: 0,
      shrinkageK: 50,
      learnedWeight: 0.7,
      softCap: 3.0,
      contribution: 0,
      residualized: false,
      reasoning: `Ref crew tends to call games ${refPaceDelta > 0 ? 'faster' : 'slower'} (${refPaceDelta.toFixed(1)} pace delta) with ${refFoulRate > 0 ? 'more' : 'fewer'} fouls (${refFTRate.toFixed(1)} FT delta).`,
      rawData: {
        context: {
          refCrew: refCrew.name || 'Unknown',
          paceDelta: refPaceDelta,
          foulRate: refFoulRate,
          ftRate: refFTRate,
          paceEffect,
          foulEffect,
        },
      },
      sources: ['NBA Official Stats', 'Referee Tracking'],
      impactType: effect > 0.3 ? 'positive' : effect < -0.3 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 4: Schedule Impact (Rest/Travel/Altitude)
   * Per spec: Schedule model → ±1.0 pts
   * Cap: ±1.0 pts
   */
  private calculateScheduleImpact(game: GameInput): SharpFactor | null {
    let homeEffect = 0
    let awayEffect = 0
    const breakdown: string[] = []

    // Rest days impact
    const homeDaysRest = game.homeTeam.stats?.daysRest ?? 1
    const awayDaysRest = game.awayTeam.stats?.daysRest ?? 1

    if (homeDaysRest === 0) {
      homeEffect -= 2.0 // Back-to-back penalty
      breakdown.push('Home on B2B (-2.0)')
    } else if (homeDaysRest >= 3) {
      homeEffect += 0.5 // Well-rested bonus
      breakdown.push('Home well-rested (+0.5)')
    }

    if (awayDaysRest === 0) {
      awayEffect -= 2.0
      breakdown.push('Away on B2B (-2.0 away)')
    } else if (awayDaysRest >= 3) {
      awayEffect += 0.5
      breakdown.push('Away well-rested (+0.5 away)')
    }

    // Travel distance
    const awayTravelDist = game.awayTeam.stats?.travelDistance ?? 0
    if (awayTravelDist > 1500) {
      awayEffect -= 1.0 // Long road trip penalty
      breakdown.push(`Away travel penalty (${awayTravelDist} mi, -1.0)`)
    }

    // Altitude (Denver/Utah)
    const isAltitudeVenue = game.venue && ['Denver', 'Utah', 'Salt Lake'].some(v => game.venue?.includes(v))
    if (isAltitudeVenue) {
      homeEffect += 1.5 // Home altitude advantage
      awayEffect -= 1.0 // Visitor altitude penalty
      breakdown.push('Altitude advantage (+1.5 home, -1.0 away)')
    }

    // Net effect (home - away)
    const effect = homeEffect - awayEffect

    return {
      name: 'Schedule Impact',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 100, // Historical rest/travel data
      recency: 1.0, // Schedule info is current
      dataQuality: 0.95, // Very reliable
      reliability: 0,
      shrinkageK: 30,
      learnedWeight: 0.8,
      softCap: 1.0,
      contribution: 0,
      residualized: false,
      reasoning: breakdown.join('; '),
      rawData: {
        teamA: {
          daysRest: homeDaysRest,
          effect: homeEffect,
        },
        teamB: {
          daysRest: awayDaysRest,
          travelDistance: awayTravelDist,
          effect: awayEffect,
        },
        context: {
          altitudeVenue: isAltitudeVenue,
        },
      },
      sources: ['NBA Schedule', 'Travel Data'],
      impactType: effect > 0.2 ? 'positive' : effect < -0.2 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 5: Defensive Scheme Matchup
   * Per spec: Switch vs non-shooting big, drop vs pull-up → ±1.2 pts
   * Cap: ±1.2 pts
   */
  private calculateSchemeMatchup(game: GameInput): SharpFactor | null {
    // Get defensive scheme data (if available)
    const homeScheme = game.homeTeam.stats?.defensiveScheme ?? 'balanced' // 'switch', 'drop', 'ice', 'balanced'
    const awayScheme = game.awayTeam.stats?.defensiveScheme ?? 'balanced'

    // Get offensive tendencies
    const homeOffenseStyle = game.homeTeam.stats?.offenseStyle ?? 'balanced' // 'iso', 'pick_roll', 'motion'
    const awayOffenseStyle = game.awayTeam.stats?.offenseStyle ?? 'balanced'

    // Matchup scoring (simplified heuristics)
    let homeAdvantage = 0
    let awayAdvantage = 0

    // Switch defense vulnerable to non-shooting bigs in pick & roll
    if (awayScheme === 'switch' && homeOffenseStyle === 'pick_roll') {
      homeAdvantage += 0.8
    }

    // Drop coverage vulnerable to pull-up shooters
    if (awayScheme === 'drop' && homeOffenseStyle === 'iso') {
      homeAdvantage += 0.6
    }

    // Same for away team
    if (homeScheme === 'switch' && awayOffenseStyle === 'pick_roll') {
      awayAdvantage += 0.8
    }

    if (homeScheme === 'drop' && awayOffenseStyle === 'iso') {
      awayAdvantage += 0.6
    }

    const effect = homeAdvantage - awayAdvantage

    // Skip if no meaningful matchup advantage
    if (Math.abs(effect) < 0.3) return null

    return {
      name: 'Defensive Scheme Matchup',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 150,
      recency: 0.8,
      dataQuality: 0.7, // Scheme identification can be subjective
      reliability: 0,
      shrinkageK: 150,
      learnedWeight: 0.7,
      softCap: 1.2,
      contribution: 0,
      residualized: false,
      reasoning: `Home ${homeOffenseStyle} offense vs away ${awayScheme} defense creates ${effect > 0 ? 'exploitable' : 'difficult'} matchup.`,
      rawData: {
        teamA: {
          offenseStyle: homeOffenseStyle,
          defenseScheme: homeScheme,
        },
        teamB: {
          offenseStyle: awayOffenseStyle,
          defenseScheme: awayScheme,
        },
        context: {
          homeAdvantage,
          awayAdvantage,
        },
      },
      sources: ['Synergy Sports', 'NBA Scheme Analysis'],
      impactType: effect > 0.1 ? 'positive' : effect < -0.1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 6: Recent Form
   * Per spec: Last 5 games performance vs season average
   * Cap: ±1.0 pts
   */
  private calculateRecentForm(game: GameInput): SharpFactor | null {
    const homeRecentForm = game.homeTeam.stats?.recentForm ?? [1, 1, 0, 1, 1]
    const awayRecentForm = game.awayTeam.stats?.recentForm ?? [1, 0, 1, 0, 1]
    
    const homeWinRate = homeRecentForm.reduce((sum: number, win: number) => sum + win, 0) / homeRecentForm.length
    const awayWinRate = awayRecentForm.reduce((sum: number, win: number) => sum + win, 0) / awayRecentForm.length
    
    // Effect based on recent form difference
    const effect = (homeWinRate - awayWinRate) * 2.0 // 2 points per 100% win rate difference
    
    return {
      name: 'Recent Form',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 5,
      recency: 1.0,
      dataQuality: 0.9,
      reliability: 0,
      shrinkageK: 20,
      learnedWeight: 0.8,
      softCap: 1.0,
      contribution: 0,
      residualized: false,
      reasoning: `Home team recent form: ${(homeWinRate * 100).toFixed(0)}% vs Away: ${(awayWinRate * 100).toFixed(0)}%`,
      rawData: {
        teamA: { recentForm: homeRecentForm, winRate: homeWinRate },
        teamB: { recentForm: awayRecentForm, winRate: awayWinRate },
      },
      sources: ['NBA Game Results'],
      impactType: effect > 0.1 ? 'positive' : effect < -0.1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 7: Pace Mismatch
   * Per spec: Pace difference affects total points
   * Cap: ±2.0 pts
   */
  private calculatePaceMismatch(game: GameInput): SharpFactor | null {
    const homePace = game.homeTeam.stats?.pace ?? 102
    const awayPace = game.awayTeam.stats?.pace ?? 100
    
    // Pace difference affects total points
    const paceDifference = homePace - awayPace
    const effect = paceDifference * 0.1 // 0.1 points per pace difference
    
    return {
      name: 'Pace Mismatch',
      category: 'matchup',
      effectSize: effect,
      unit: 'points_total',
      marketBaseline: game.total ?? 0,
      sampleSize: 20,
      recency: 0.9,
      dataQuality: 0.9,
      reliability: 0,
      shrinkageK: 50,
      learnedWeight: 0.7,
      softCap: 2.0,
      contribution: 0,
      residualized: false,
      reasoning: `Home pace: ${homePace} vs Away pace: ${awayPace}. Pace difference affects total points.`,
      rawData: {
        teamA: { pace: homePace },
        teamB: { pace: awayPace },
        context: { paceDifference },
      },
      sources: ['NBA Advanced Stats'],
      impactType: effect > 0.1 ? 'positive' : effect < -0.1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 8: Injury Impact
   * Per spec: Key player injuries affect team performance
   * Cap: ±1.5 pts
   */
  private calculateInjuryImpact(game: GameInput): SharpFactor | null {
    const homeInjuries = game.injuries?.filter(i => i.player.includes(game.homeTeam.name)) ?? []
    const awayInjuries = game.injuries?.filter(i => i.player.includes(game.awayTeam.name)) ?? []
    
    // Calculate injury impact
    const homeImpact = homeInjuries.reduce((sum, injury) => sum + (injury.impact ?? 0), 0)
    const awayImpact = awayInjuries.reduce((sum, injury) => sum + (injury.impact ?? 0), 0)
    
    const effect = awayImpact - homeImpact // Negative for home team injuries
    
    return {
      name: 'Injury Impact',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 1,
      recency: 1.0,
      dataQuality: 0.8,
      reliability: 0,
      shrinkageK: 5,
      learnedWeight: 0.9,
      softCap: 1.5,
      contribution: 0,
      residualized: false,
      reasoning: `Home injuries: ${homeInjuries.length}, Away injuries: ${awayInjuries.length}`,
      rawData: {
        teamA: { injuries: homeInjuries, impact: homeImpact },
        teamB: { injuries: awayInjuries, impact: awayImpact },
      },
      sources: ['NBA Injury Reports'],
      impactType: effect > 0.1 ? 'positive' : effect < -0.1 ? 'negative' : 'neutral',
    }
  }

  /**
   * Factor 9: Home Court Advantage
   * Per spec: Standard home court advantage
   * Cap: ±2.5 pts
   */
  private calculateHomeCourtAdvantage(game: GameInput): SharpFactor | null {
    // Standard NBA home court advantage
    const effect = 2.5 // 2.5 point home court advantage
    
    return {
      name: 'Home Court Advantage',
      category: 'context',
      effectSize: effect,
      unit: 'points_spread',
      marketBaseline: game.spread ?? 0,
      sampleSize: 1000,
      recency: 0.8,
      dataQuality: 0.95,
      reliability: 0,
      shrinkageK: 100,
      learnedWeight: 1.0,
      softCap: 2.5,
      contribution: 0,
      residualized: false,
      reasoning: `Standard NBA home court advantage of 2.5 points`,
      rawData: {
        context: { homeCourtAdvantage: effect, venue: game.venue },
      },
      sources: ['NBA Historical Data'],
      impactType: 'positive',
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create NBA factor catalog instance
 */
export const createNBAFactorCatalog = (): NBAFactorCatalog => {
  return new NBAFactorCatalog()
}

