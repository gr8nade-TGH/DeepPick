import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100)
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

export function calculateROI(unitsWon: number, unitsLost: number, unitsBet: number): number {
  if (unitsBet === 0) return 0
  return ((unitsWon - unitsLost) / unitsBet) * 100
}

export function calculateWinRate(wins: number, totalPicks: number): number {
  if (totalPicks === 0) return 0
  return (wins / totalPicks) * 100
}

export function calculateUnits(odds: number, units: number): number {
  if (odds > 0) {
    return (odds / 100) * units
  } else {
    return (100 / Math.abs(odds)) * units
  }
}

export function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`
  }
  return odds.toString()
}

export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1
  } else {
    return (100 / Math.abs(odds)) + 1
  }
}

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) {
    return (decimal - 1) * 100
  } else {
    return -100 / (decimal - 1)
  }
}

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'low':
      return 'text-red-400'
    case 'medium':
      return 'text-yellow-400'
    case 'high':
      return 'text-green-400'
    case 'very_high':
      return 'text-neon-green'
    default:
      return 'text-gray-400'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'won':
      return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'lost':
      return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'pushed':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'active':
      return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'pending':
      return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    default:
      return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  }
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substr(0, maxLength) + '...'
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatSportName(sport: string): string {
  const sportMap: Record<string, string> = {
    nfl: 'NFL',
    nba: 'NBA',
    mlb: 'MLB',
    nhl: 'NHL',
    ncaaf: 'NCAA Football',
    ncaab: 'NCAA Basketball',
    soccer: 'Soccer',
    tennis: 'Tennis',
    golf: 'Golf',
  }
  return sportMap[sport] || capitalizeFirst(sport)
}

export function formatBetType(betType: string): string {
  const betTypeMap: Record<string, string> = {
    moneyline: 'Moneyline',
    spread: 'Spread',
    total: 'Total',
    player_prop: 'Player Prop',
    team_prop: 'Team Prop',
    futures: 'Futures',
  }
  return betTypeMap[betType] || capitalizeFirst(betType)
}

export function getSportIcon(sport: string): string {
  const iconMap: Record<string, string> = {
    nfl: '🏈',
    nba: '🏀',
    mlb: '⚾',
    nhl: '🏒',
    ncaaf: '🏈',
    ncaab: '🏀',
    soccer: '⚽',
    tennis: '🎾',
    golf: '⛳',
  }
  return iconMap[sport] || '🏆'
}

export function calculateStreak(picks: Array<{ status: string }>): { current: number; type: 'win' | 'loss' | null } {
  if (picks.length === 0) return { current: 0, type: null }
  
  let currentStreak = 0
  let currentType: 'win' | 'loss' | null = null
  
  for (let i = picks.length - 1; i >= 0; i--) {
    const pick = picks[i]
    if (pick.status === 'won') {
      if (currentType === 'win' || currentType === null) {
        currentStreak++
        currentType = 'win'
      } else {
        break
      }
    } else if (pick.status === 'lost') {
      if (currentType === 'loss' || currentType === null) {
        currentStreak++
        currentType = 'loss'
      } else {
        break
      }
    } else {
      break
    }
  }
  
  return { current: currentStreak, type: currentType }
}
