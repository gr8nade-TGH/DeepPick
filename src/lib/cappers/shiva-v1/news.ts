export interface NewsItem {
  player: string
  status: 'out' | 'doubtful' | 'questionable' | 'probable' | 'active'
  expectedMinutesImpact?: number
  sourceUrl: string
  sourceName?: string
  publishedAt?: string
}

export interface NewsFetchParams {
  team: string
  opponent: string
  windowHours: number // default 48; expand to 72 if game starts ≤ 12h
}

export async function fetchTeamNews(params: NewsFetchParams): Promise<NewsItem[]> {
  // Stub: implement prioritized domains, de-dupe, caching, retry/backoff; tag latency
  throw new Error('Not implemented')
}


