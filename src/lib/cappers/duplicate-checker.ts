/**
 * Duplicate Pick Prevention
 * 
 * Rules:
 * 1. Can't bet the same game + same bet type twice (even if line changed)
 * 2. Can bet BOTH total and spread on same game (different bet types)
 * 3. Examples:
 *    - ❌ HOU -3 then HOU -4 (same game, same bet type)
 *    - ✅ HOU -3 and Over 48 (same game, different bet types)
 *    - ✅ HOU -3 in one game, HOU -4 in different game (different games)
 */

import { supabaseAdmin } from '@/lib/supabase/server'

export interface ExistingPick {
  id: string
  game_id: string
  pick_type: string
  selection: string
  capper: string
  status: string
}

/**
 * Check if a pick would be a duplicate
 * 
 * @param gameId - The game ID
 * @param pickType - The pick type (moneyline, spread, total_over, total_under)
 * @param capper - The capper making the pick
 * @returns true if duplicate, false if allowed
 */
export async function isDuplicatePick(
  gameId: string,
  pickType: string,
  capper: string
): Promise<{ isDuplicate: boolean; existingPick?: ExistingPick; reason?: string }> {
  
  // Normalize pick types to base types
  // total_over and total_under are both "total" bets
  const basePickType = pickType.startsWith('total_') ? 'total' : pickType
  
  // Query for existing picks on this game by this capper
  const { data: existingPicks, error } = await supabaseAdmin
    .from('picks')
    .select('id, game_id, pick_type, selection, capper, status')
    .eq('game_id', gameId)
    .eq('capper', capper)
    .in('status', ['pending', 'won', 'lost', 'push']) // Don't count cancelled picks
  
  if (error) {
    console.error('Error checking for duplicates:', error)
    return { isDuplicate: false } // Fail open to allow pick
  }
  
  if (!existingPicks || existingPicks.length === 0) {
    return { isDuplicate: false }
  }
  
  // Check each existing pick
  for (const existing of existingPicks) {
    const existingBaseType = existing.pick_type.startsWith('total_') ? 'total' : existing.pick_type
    
    // If same game + same base pick type = DUPLICATE
    if (existingBaseType === basePickType) {
      return {
        isDuplicate: true,
        existingPick: existing,
        reason: `Already have ${existingBaseType} pick on this game: ${existing.selection}`
      }
    }
  }
  
  // Different pick types on same game = ALLOWED
  return { isDuplicate: false }
}

/**
 * Get all existing picks for a capper to filter out games
 * 
 * @param capper - The capper name
 * @returns Map of game_id -> array of pick types already bet
 */
export async function getExistingPicksByGame(
  capper: string
): Promise<Map<string, string[]>> {
  const { data: picks, error } = await supabaseAdmin
    .from('picks')
    .select('game_id, pick_type')
    .eq('capper', capper)
    .in('status', ['pending', 'won', 'lost', 'push'])
  
  if (error) {
    console.error('Error fetching existing picks:', error)
    return new Map()
  }
  
  const picksByGame = new Map<string, string[]>()
  
  for (const pick of picks || []) {
    const baseType = pick.pick_type.startsWith('total_') ? 'total' : pick.pick_type
    
    if (!picksByGame.has(pick.game_id)) {
      picksByGame.set(pick.game_id, [])
    }
    
    picksByGame.get(pick.game_id)!.push(baseType)
  }
  
  return picksByGame
}

/**
 * Filter games to only those that can have new picks
 * 
 * @param games - Array of games to analyze
 * @param capper - The capper name
 * @param pickType - The pick type we want to make
 * @returns Filtered array of games that don't have this pick type yet
 */
export async function filterAvailableGames(
  games: any[],
  capper: string,
  pickType: string
): Promise<any[]> {
  const existingPicks = await getExistingPicksByGame(capper)
  const basePickType = pickType.startsWith('total_') ? 'total' : pickType
  
  return games.filter(game => {
    const gamePicks = existingPicks.get(game.id) || []
    return !gamePicks.includes(basePickType)
  })
}

/**
 * Check if we can make ANY pick on a game (total OR spread OR moneyline)
 * 
 * @param gameId - The game ID
 * @param capper - The capper name
 * @returns Object with available pick types
 */
export async function getAvailablePickTypes(
  gameId: string,
  capper: string
): Promise<{
  canBetTotal: boolean
  canBetSpread: boolean
  canBetMoneyline: boolean
  existingTypes: string[]
}> {
  const { data: picks, error } = await supabaseAdmin
    .from('picks')
    .select('pick_type')
    .eq('game_id', gameId)
    .eq('capper', capper)
    .in('status', ['pending', 'won', 'lost', 'push'])
  
  if (error) {
    console.error('Error checking available pick types:', error)
    return {
      canBetTotal: true,
      canBetSpread: true,
      canBetMoneyline: true,
      existingTypes: []
    }
  }
  
  const existingTypes = (picks || []).map(p => 
    p.pick_type.startsWith('total_') ? 'total' : p.pick_type
  )
  
  return {
    canBetTotal: !existingTypes.includes('total'),
    canBetSpread: !existingTypes.includes('spread'),
    canBetMoneyline: !existingTypes.includes('moneyline'),
    existingTypes: Array.from(new Set(existingTypes))
  }
}

