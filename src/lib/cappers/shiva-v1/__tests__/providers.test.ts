import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { Step3Result, Step4Result } from '../ai/providers'

// Mock StatMuse and News modules
jest.mock('../statmuse')
jest.mock('../news')

let providers: typeof import('../ai/providers')
let statmuse: any
let news: any

beforeEach(async () => {
  jest.clearAllMocks()
  jest.resetModules()
  
  // Re-import to get fresh instances
  providers = await import('../ai/providers')
  statmuse = await import('../statmuse')
  news = await import('../news')
})

describe('SHIVA v1 AI Provider Adapters', () => {
  describe('Step 3: Factors 1-5 (OKC vs HOU)', () => {
    it('generates five factor cards with fresh cache', async () => {
      // Mock StatMuse batch results
      statmuse.runBatch.mockResolvedValueOnce([
        // Home net
        { ok: true, value: 8.5, unit: 'per100', query: 'Oklahoma City Thunder net rating this season', provider: 'statmuse', cache: 'miss', latencyMs: 234 },
        // Away net
        { ok: true, value: 4.2, unit: 'per100', query: 'Houston Rockets net rating this season', provider: 'statmuse', cache: 'miss', latencyMs: 189 },
        // Home last 10
        { ok: true, value: 10.3, unit: 'per100', query: 'Oklahoma City Thunder net rating last 10 games', provider: 'statmuse', cache: 'miss', latencyMs: 245 },
        // Away last 10
        { ok: true, value: 5.5, unit: 'per100', query: 'Houston Rockets net rating last 10 games', provider: 'statmuse', cache: 'miss', latencyMs: 198 },
        // Home PPG vs Away
        { ok: true, value: 118.0, unit: 'ppg', query: 'Oklahoma City Thunder points per game vs Houston Rockets this season', provider: 'statmuse', cache: 'miss', latencyMs: 256 },
        // Away PPG vs Home
        { ok: true, value: 113.5, unit: 'ppg', query: 'Houston Rockets points per game vs Oklahoma City Thunder this season', provider: 'statmuse', cache: 'miss', latencyMs: 203 },
        // Home ORtg
        { ok: true, value: 116.2, unit: 'per100', query: 'Oklahoma City Thunder offensive rating this season', provider: 'statmuse', cache: 'miss', latencyMs: 211 },
        // Away ORtg
        { ok: true, value: 114.6, unit: 'per100', query: 'Houston Rockets offensive rating this season', provider: 'statmuse', cache: 'miss', latencyMs: 188 },
      ])

      // Mock news search results
      news.searchInjuries.mockResolvedValueOnce({
        ok: true,
        findings: [],
        edgePer100: 0,
        windowHours: 48,
        latencyMs: 145,
        cache: 'miss',
      })
      news.searchInjuries.mockResolvedValueOnce({
        ok: true,
        findings: [
          { team: 'Houston Rockets', player: 'Alperen Sengun', status: 'questionable', minutesImpact: -0.5, sourceUrl: 'nba.com' },
        ],
        edgePer100: -0.5,
        windowHours: 48,
        latencyMs: 167,
        cache: 'miss',
      })

      const result = await providers.runStep3({
        homeTeam: 'Oklahoma City Thunder',
        awayTeam: 'Houston Rockets',
        aiProvider: 'perplexity',
        newsWindowHours: 48,
      })

      expect(result.ok).toBe(true)
      expect(result.factors).toHaveLength(5)
      expect(result.meta.cache_hits).toBe(0) // Fresh cache
      expect(result.meta.total_queries).toBe(10) // 8 StatMuse + 2 News

      // Verify Factor 1: Net Rating Differential
      const f1 = result.factors.find(f => f.factor_no === 1)
      expect(f1).toBeDefined()
      expect(f1!.name).toBe('Net Rating Differential')
      expect(f1!.weight_total_pct).toBe(21.0)
      expect(f1!.normalized_value).toBeCloseTo(4.3, 1) // 8.5 - 4.2

      // Verify Factor 2: Recent Form
      const f2 = result.factors.find(f => f.factor_no === 2)
      expect(f2).toBeDefined()
      expect(f2!.normalized_value).toBeCloseTo(4.8, 1) // 10.3 - 5.5

      // Verify Factor 3: H2H
      const f3 = result.factors.find(f => f.factor_no === 3)
      expect(f3).toBeDefined()
      expect(f3!.normalized_value).toBeCloseTo(4.5, 1) // 118.0 - 113.5

      // Verify Factor 4: ORtg Differential
      const f4 = result.factors.find(f => f.factor_no === 4)
      expect(f4).toBeDefined()
      expect(f4!.normalized_value).toBeCloseTo(1.6, 1) // 116.2 - 114.6

      // Verify Factor 5: News/Injury Edge
      const f5 = result.factors.find(f => f.factor_no === 5)
      expect(f5).toBeDefined()
      expect(f5!.normalized_value).toBeCloseTo(0.5, 1) // 0 - (-0.5)

      console.log('Step 3 (Fresh Cache) Output:')
      console.log(JSON.stringify(result, null, 2))
    })

    it('uses cached results on second run', async () => {
      // Mock StatMuse batch results with cache hits
      statmuse.runBatch.mockResolvedValueOnce([
        { ok: true, value: 8.5, unit: 'per100', query: 'Oklahoma City Thunder net rating this season', provider: 'statmuse', cache: 'hit', latencyMs: 5 },
        { ok: true, value: 4.2, unit: 'per100', query: 'Houston Rockets net rating this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
        { ok: true, value: 10.3, unit: 'per100', query: 'Oklahoma City Thunder net rating last 10 games', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 5.5, unit: 'per100', query: 'Houston Rockets net rating last 10 games', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
        { ok: true, value: 118.0, unit: 'ppg', query: 'Oklahoma City Thunder points per game vs Houston Rockets this season', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 113.5, unit: 'ppg', query: 'Houston Rockets points per game vs Oklahoma City Thunder this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
        { ok: true, value: 116.2, unit: 'per100', query: 'Oklahoma City Thunder offensive rating this season', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 114.6, unit: 'per100', query: 'Houston Rockets offensive rating this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
      ])

      news.searchInjuries.mockResolvedValueOnce({
        ok: true,
        findings: [],
        edgePer100: 0,
        windowHours: 48,
        latencyMs: 4,
        cache: 'hit',
      })
      news.searchInjuries.mockResolvedValueOnce({
        ok: true,
        findings: [
          { team: 'Houston Rockets', player: 'Alperen Sengun', status: 'questionable', minutesImpact: -0.5, sourceUrl: 'nba.com' },
        ],
        edgePer100: -0.5,
        windowHours: 48,
        latencyMs: 3,
        cache: 'hit',
      })

      const result = await providers.runStep3({
        homeTeam: 'Oklahoma City Thunder',
        awayTeam: 'Houston Rockets',
        aiProvider: 'perplexity',
        newsWindowHours: 48,
      })

      expect(result.ok).toBe(true)
      expect(result.meta.cache_hits).toBe(10) // All cached
      expect(result.latencyMs).toBeLessThan(100) // Much faster with cache

      console.log('Step 3 (Cached) Output:')
      console.log(JSON.stringify(result, null, 2))
    })
  })

  describe('Step 4: Predictions + Conf7 (OKC vs HOU)', () => {
    const mockStep3Factors = [
      { factor_no: 1 as const, name: 'Net Rating', weight_total_pct: 21.0, raw_values_json: { home_ortg: 116.2, away_ortg: 114.6 }, parsed_values_json: {}, normalized_value: 4.3, caps_applied: false, cap_reason: null },
      { factor_no: 2 as const, name: 'Recent Form', weight_total_pct: 17.5, raw_values_json: {}, parsed_values_json: {}, normalized_value: 4.8, caps_applied: false, cap_reason: null },
      { factor_no: 3 as const, name: 'H2H', weight_total_pct: 14.0, raw_values_json: {}, parsed_values_json: {}, normalized_value: 0.7, caps_applied: false, cap_reason: null },
      { factor_no: 4 as const, name: 'ORtg', weight_total_pct: 7.0, raw_values_json: { home_ortg: 116.2, away_ortg: 114.6 }, parsed_values_json: {}, normalized_value: 1.6, caps_applied: false, cap_reason: null },
      { factor_no: 5 as const, name: 'News', weight_total_pct: 7.0, raw_values_json: {}, parsed_values_json: {}, normalized_value: 0.5, caps_applied: false, cap_reason: null },
    ]

    it('generates predictions and conf7 with fresh cache', async () => {
      // Mock StatMuse batch results
      statmuse.runBatch.mockResolvedValueOnce([
        // Home pace
        { ok: true, value: 100.5, unit: 'pace', query: 'Oklahoma City Thunder pace this season', provider: 'statmuse', cache: 'miss', latencyMs: 223 },
        // Away pace
        { ok: true, value: 97.7, unit: 'pace', query: 'Houston Rockets pace this season', provider: 'statmuse', cache: 'miss', latencyMs: 195 },
        // 3PT stats
        { ok: true, value: 38.2, unit: 'rate', query: 'Oklahoma City Thunder 3 point attempts per game this season', provider: 'statmuse', cache: 'miss', latencyMs: 234 },
        { ok: true, value: 37.0, unit: 'percent', query: 'Oklahoma City Thunder 3 point percentage this season', provider: 'statmuse', cache: 'miss', latencyMs: 198 },
        { ok: true, value: 34.0, unit: 'rate', query: 'Oklahoma City Thunder opponent 3 point attempts per game this season', provider: 'statmuse', cache: 'miss', latencyMs: 245 },
        { ok: true, value: 40.1, unit: 'rate', query: 'Houston Rockets 3 point attempts per game this season', provider: 'statmuse', cache: 'miss', latencyMs: 212 },
        { ok: true, value: 36.1, unit: 'percent', query: 'Houston Rockets 3 point percentage this season', provider: 'statmuse', cache: 'miss', latencyMs: 201 },
        { ok: true, value: 37.9, unit: 'rate', query: 'Houston Rockets opponent 3 point attempts per game this season', provider: 'statmuse', cache: 'miss', latencyMs: 189 },
      ])

      const result = await providers.runStep4({
        homeTeam: 'Oklahoma City Thunder',
        awayTeam: 'Houston Rockets',
        aiProvider: 'openai',
        factors1to5: mockStep3Factors,
      })

      expect(result.ok).toBe(true)
      expect(result.factors).toHaveLength(2) // Factor 6 & 7
      expect(result.meta.cache_hits).toBe(0) // Fresh cache
      expect(result.meta.total_queries).toBe(8)

      // Verify pace calculation
      expect(result.pace_and_predictions.pace_exp).toBeCloseTo(99.07, 1)

      // Verify spread prediction
      expect(result.pace_and_predictions.spread_pred_points).toBeGreaterThan(0) // OKC favored

      // Verify total prediction
      expect(result.pace_and_predictions.total_pred_points).toBeGreaterThan(220)

      // Verify Conf7
      expect(result.pace_and_predictions.conf7_score_value).toBeGreaterThan(1.0)
      expect(result.pace_and_predictions.conf7_score_value).toBeLessThan(5.0)

      console.log('Step 4 (Fresh Cache) Output:')
      console.log(JSON.stringify(result, null, 2))
    })

    it('uses cached results on second run', async () => {
      // Mock StatMuse batch results with cache hits
      statmuse.runBatch.mockResolvedValueOnce([
        { ok: true, value: 100.5, unit: 'pace', query: 'Oklahoma City Thunder pace this season', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 97.7, unit: 'pace', query: 'Houston Rockets pace this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
        { ok: true, value: 38.2, unit: 'rate', query: 'Oklahoma City Thunder 3 point attempts per game this season', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 37.0, unit: 'percent', query: 'Oklahoma City Thunder 3 point percentage this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
        { ok: true, value: 34.0, unit: 'rate', query: 'Oklahoma City Thunder opponent 3 point attempts per game this season', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 40.1, unit: 'rate', query: 'Houston Rockets 3 point attempts per game this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
        { ok: true, value: 36.1, unit: 'percent', query: 'Houston Rockets 3 point percentage this season', provider: 'statmuse', cache: 'hit', latencyMs: 4 },
        { ok: true, value: 37.9, unit: 'rate', query: 'Houston Rockets opponent 3 point attempts per game this season', provider: 'statmuse', cache: 'hit', latencyMs: 3 },
      ])

      const result = await providers.runStep4({
        homeTeam: 'Oklahoma City Thunder',
        awayTeam: 'Houston Rockets',
        aiProvider: 'openai',
        factors1to5: mockStep3Factors,
      })

      expect(result.ok).toBe(true)
      expect(result.meta.cache_hits).toBe(8) // All cached
      expect(result.latencyMs).toBeLessThan(100) // Much faster with cache

      console.log('Step 4 (Cached) Output:')
      console.log(JSON.stringify(result, null, 2))
    })
  })
})

