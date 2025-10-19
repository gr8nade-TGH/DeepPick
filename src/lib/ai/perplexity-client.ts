/**
 * Perplexity AI Client
 * 
 * Handles AI research with built-in web search
 */

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface PerplexityRequest {
  model: string
  messages: PerplexityMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  search_domain_filter?: string[]
  return_images?: boolean
  return_related_questions?: boolean
  search_recency_filter?: 'day' | 'week' | 'month'
  stream?: boolean
}

interface PerplexityResponse {
  id: string
  model: string
  created: number
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  object: string
  choices: Array<{
    index: number
    finish_reason: string
    message: {
      role: string
      content: string
    }
  }>
  citations?: string[]
}

export class PerplexityClient {
  private apiKey: string
  private baseUrl = 'https://api.perplexity.ai'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PERPLEXITY_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set')
    }
  }

  /**
   * Chat completion with optional web search
   */
  async chat(request: PerplexityRequest): Promise<PerplexityResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Perplexity API error: ${response.status} - ${error}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ Perplexity API error:', error)
      throw error
    }
  }
}

// Export singleton
let perplexityClient: PerplexityClient | null = null

export function getPerplexityClient(): PerplexityClient {
  if (!perplexityClient) {
    perplexityClient = new PerplexityClient()
  }
  return perplexityClient
}
