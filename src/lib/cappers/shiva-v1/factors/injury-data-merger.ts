/**
 * Injury Data Merger
 * 
 * Merges MySportsFeeds official injury data with web search results
 * Identifies conflicts, key players, and prepares data for AI analysis
 */

import type {
  PlayerInjuryData,
  TeamInjurySummary,
  MergedInjuryData,
  InjuryImpactClassification
} from '@/lib/data-sources/types/player-injury'
import type { NewsEdge, InjuryFinding } from '../news'
import {
  fetchTeamPlayerStats,
  getInjuredPlayers,
  getKeyPlayers,
  getInjuredKeyPlayers
} from '@/lib/data-sources/mysportsfeeds-players'
import { getTeamAbbrev } from '@/lib/data-sources/team-mappings'

/**
 * Classify injury impact based on player importance and injury status
 */
function classifyInjuryImpact(
  injuredPlayers: PlayerInjuryData[],
  keyPlayers: PlayerInjuryData[]
): InjuryImpactClassification {
  if (injuredPlayers.length === 0) {
    return {
      severity: 'none',
      impactScore: 0,
      reasoning: 'No injured players'
    }
  }
  
  // Calculate impact based on injured key players
  const injuredKeyPlayers = injuredPlayers.filter(p => 
    keyPlayers.some(kp => kp.player.id === p.player.id)
  )
  
  let totalImpact = 0
  const reasons: string[] = []
  
  for (const player of injuredKeyPlayers) {
    const ppg = player.averages.avgPoints
    const mpg = player.averages.avgMinutes
    const status = player.player.currentInjury?.playingProbability
    
    // Base impact on PPG
    let playerImpact = 0
    if (ppg >= 25) {
      playerImpact = -8 // Star player
      reasons.push(`${player.player.lastName} (${ppg.toFixed(1)} PPG) - Star player`)
    } else if (ppg >= 20) {
      playerImpact = -6 // All-star level
      reasons.push(`${player.player.lastName} (${ppg.toFixed(1)} PPG) - All-star level`)
    } else if (ppg >= 15) {
      playerImpact = -4 // Key contributor
      reasons.push(`${player.player.lastName} (${ppg.toFixed(1)} PPG) - Key contributor`)
    } else if (ppg >= 10) {
      playerImpact = -2 // Role player
      reasons.push(`${player.player.lastName} (${ppg.toFixed(1)} PPG) - Role player`)
    } else {
      playerImpact = -1 // Bench player
      reasons.push(`${player.player.lastName} (${ppg.toFixed(1)} PPG) - Bench player`)
    }
    
    // Adjust for injury status
    if (status === 'QUESTIONABLE') {
      playerImpact *= 0.5 // 50% impact if questionable
    } else if (status === 'DOUBTFUL') {
      playerImpact *= 0.75 // 75% impact if doubtful
    }
    // OUT = 100% impact (no adjustment)
    
    totalImpact += playerImpact
  }
  
  // Compound effect for multiple injuries
  if (injuredKeyPlayers.length > 1) {
    totalImpact *= 1.3 // 30% multiplier for depth issues
    reasons.push(`Multiple key injuries (${injuredKeyPlayers.length}) - depth concerns`)
  }
  
  // Determine severity
  let severity: InjuryImpactClassification['severity']
  if (Math.abs(totalImpact) >= 8) {
    severity = 'critical'
  } else if (Math.abs(totalImpact) >= 5) {
    severity = 'major'
  } else if (Math.abs(totalImpact) >= 3) {
    severity = 'moderate'
  } else if (Math.abs(totalImpact) >= 1) {
    severity = 'minor'
  } else {
    severity = 'none'
  }
  
  return {
    severity,
    impactScore: Math.max(-10, Math.min(10, totalImpact)), // Clamp to -10 to +10
    reasoning: reasons.join('; ')
  }
}

/**
 * Create team injury summary from player data
 */
function createTeamInjurySummary(
  teamName: string,
  players: PlayerInjuryData[]
): TeamInjurySummary {
  const teamAbbrev = getTeamAbbrev(teamName)
  const injuredPlayers = getInjuredPlayers(players)
  const keyPlayers = getKeyPlayers(players)
  const injuryImpact = classifyInjuryImpact(injuredPlayers, keyPlayers)
  
  return {
    teamName,
    teamAbbrev,
    totalPlayers: players.length,
    injuredPlayers,
    keyPlayers,
    injuryImpact
  }
}

/**
 * Merge MySportsFeeds data with web search injury news
 * 
 * @param awayTeam - Away team name
 * @param homeTeam - Home team name
 * @param injuryNews - Web search injury findings (optional)
 * @returns Merged injury data from all sources
 */
export async function mergeInjuryData(
  awayTeam: string,
  homeTeam: string,
  injuryNews?: NewsEdge
): Promise<MergedInjuryData> {
  const startTime = Date.now()
  console.log('[Injury Merger] Starting data merge...')
  console.log(`[Injury Merger] Teams: ${awayTeam} @ ${homeTeam}`)
  
  try {
    // Fetch MySportsFeeds player stats in parallel
    const [awayPlayers, homePlayers] = await Promise.all([
      fetchTeamPlayerStats(awayTeam),
      fetchTeamPlayerStats(homeTeam)
    ])
    
    console.log(`[Injury Merger] Fetched ${awayPlayers.length} away players, ${homePlayers.length} home players`)
    
    // Create team summaries
    const awayTeamSummary = createTeamInjurySummary(awayTeam, awayPlayers)
    const homeTeamSummary = createTeamInjurySummary(homeTeam, homePlayers)
    
    console.log(`[Injury Merger] Away injuries: ${awayTeamSummary.injuredPlayers.length}, impact: ${awayTeamSummary.injuryImpact.severity}`)
    console.log(`[Injury Merger] Home injuries: ${homeTeamSummary.injuredPlayers.length}, impact: ${homeTeamSummary.injuryImpact.severity}`)
    
    // Process web search news if available
    const recentNews: MergedInjuryData['recentNews'] = []
    if (injuryNews && injuryNews.findings && injuryNews.findings.length > 0) {
      for (const finding of injuryNews.findings) {
        recentNews.push({
          team: finding.team,
          player: finding.player,
          status: finding.status,
          source: finding.sourceUrl,
          timestamp: new Date().toISOString()
        })
      }
      console.log(`[Injury Merger] Added ${recentNews.length} web search findings`)
    }
    
    const dataSourcesUsed: string[] = ['MySportsFeeds Player Stats (STATS addon)']
    if (injuryNews && injuryNews.findings && injuryNews.findings.length > 0) {
      dataSourcesUsed.push('Web Search Injury News')
    }
    
    const mergedData: MergedInjuryData = {
      awayTeam: awayTeamSummary,
      homeTeam: homeTeamSummary,
      recentNews,
      dataSourcesUsed,
      fetchedAt: new Date().toISOString()
    }
    
    console.log(`[Injury Merger] Merge complete in ${Date.now() - startTime}ms`)
    console.log(`[Injury Merger] Data sources: ${dataSourcesUsed.join(', ')}`)
    
    return mergedData
    
  } catch (error) {
    console.error('[Injury Merger] Error merging injury data:', error)
    throw new Error(
      `Failed to merge injury data: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Format merged data for AI prompt
 */
export function formatMergedDataForAI(mergedData: MergedInjuryData): string {
  const lines: string[] = []
  
  // Away team section
  lines.push(`**${mergedData.awayTeam.teamName} (Away Team):**`)
  if (mergedData.awayTeam.injuredPlayers.length === 0) {
    lines.push('- No injured players')
  } else {
    lines.push(`- Injured Players (${mergedData.awayTeam.injuredPlayers.length}):`)
    for (const player of mergedData.awayTeam.injuredPlayers) {
      const p = player.player
      const avg = player.averages
      const injury = p.currentInjury!
      lines.push(
        `  • ${p.firstName} ${p.lastName} (${p.primaryPosition}): ${injury.playingProbability} - ${injury.description}`
      )
      lines.push(
        `    Stats: ${avg.avgPoints.toFixed(1)} PPG, ${avg.avgMinutes.toFixed(1)} MPG, ${avg.avgRebounds.toFixed(1)} RPG, ${avg.avgAssists.toFixed(1)} APG`
      )
    }
  }
  
  lines.push(`- Key Players (${mergedData.awayTeam.keyPlayers.length}):`)
  for (const player of mergedData.awayTeam.keyPlayers.slice(0, 5)) { // Top 5
    const p = player.player
    const avg = player.averages
    const injuryStatus = p.currentInjury ? ` [${p.currentInjury.playingProbability}]` : ''
    lines.push(
      `  • ${p.firstName} ${p.lastName} (${p.primaryPosition}): ${avg.avgPoints.toFixed(1)} PPG, ${avg.avgMinutes.toFixed(1)} MPG${injuryStatus}`
    )
  }
  
  lines.push('')
  
  // Home team section
  lines.push(`**${mergedData.homeTeam.teamName} (Home Team):**`)
  if (mergedData.homeTeam.injuredPlayers.length === 0) {
    lines.push('- No injured players')
  } else {
    lines.push(`- Injured Players (${mergedData.homeTeam.injuredPlayers.length}):`)
    for (const player of mergedData.homeTeam.injuredPlayers) {
      const p = player.player
      const avg = player.averages
      const injury = p.currentInjury!
      lines.push(
        `  • ${p.firstName} ${p.lastName} (${p.primaryPosition}): ${injury.playingProbability} - ${injury.description}`
      )
      lines.push(
        `    Stats: ${avg.avgPoints.toFixed(1)} PPG, ${avg.avgMinutes.toFixed(1)} MPG, ${avg.avgRebounds.toFixed(1)} RPG, ${avg.avgAssists.toFixed(1)} APG`
      )
    }
  }
  
  lines.push(`- Key Players (${mergedData.homeTeam.keyPlayers.length}):`)
  for (const player of mergedData.homeTeam.keyPlayers.slice(0, 5)) { // Top 5
    const p = player.player
    const avg = player.averages
    const injuryStatus = p.currentInjury ? ` [${p.currentInjury.playingProbability}]` : ''
    lines.push(
      `  • ${p.firstName} ${p.lastName} (${p.primaryPosition}): ${avg.avgPoints.toFixed(1)} PPG, ${avg.avgMinutes.toFixed(1)} MPG${injuryStatus}`
    )
  }
  
  // Recent news section
  if (mergedData.recentNews.length > 0) {
    lines.push('')
    lines.push('**Recent Injury News (Web Search - 48hr window):**')
    for (const news of mergedData.recentNews) {
      lines.push(`- ${news.player} (${news.team}): ${news.status} - Source: ${news.source}`)
    }
  }
  
  return lines.join('\n')
}

