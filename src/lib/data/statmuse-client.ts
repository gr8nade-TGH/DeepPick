/**
 * StatMuse Client - Free Sports Stats via Natural Language
 * 
 * StatMuse has a public "ask" endpoint that returns answers to natural language questions
 * This is FREE and doesn't require an API key!
 * 
 * Example: https://www.statmuse.com/nfl/ask/aaron-rodgers-last-4-games-touchdowns
 */

import * as cheerio from 'cheerio'

export interface StatMuseQuery {
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl'
  question: string
}

export interface StatMuseAnswer {
  question: string
  answer: string
  url: string
  extractedValue?: number | string
  confidence: 'high' | 'medium' | 'low'
}

export class StatMuseClient {
  private baseUrls = {
    nfl: 'https://www.statmuse.com/nfl/ask',
    nba: 'https://www.statmuse.com/nba/ask',
    mlb: 'https://www.statmuse.com/mlb/ask',
    nhl: 'https://www.statmuse.com/nhl/ask'
  }

  /**
   * Ask StatMuse a natural language question
   */
  async ask(query: StatMuseQuery): Promise<StatMuseAnswer> {
    const urlQuestion = this.formatQuestion(query.question)
    const url = `${this.baseUrls[query.sport]}/${urlQuestion}`

    try {
      console.log(`🔍 StatMuse query: ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        return {
          question: query.question,
          answer: 'Failed to fetch from StatMuse',
          url,
          confidence: 'low'
        }
      }

      const html = await response.text()
      return this.parseResponse(html, query.question, url)
    } catch (error) {
      console.error('StatMuse error:', error)
      return {
        question: query.question,
        answer: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        url,
        confidence: 'low'
      }
    }
  }

  /**
   * Ask multiple questions in parallel
   */
  async askBatch(queries: StatMuseQuery[]): Promise<StatMuseAnswer[]> {
    const promises = queries.map(q => this.ask(q))
    return Promise.all(promises)
  }

  /**
   * Format question for URL
   */
  private formatQuestion(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .trim()
      .replace(/\s+/g, '-') // Spaces to hyphens
  }

  /**
   * Parse HTML response from StatMuse
   */
  private parseResponse(html: string, question: string, url: string): StatMuseAnswer {
    const $ = cheerio.load(html)
    
    // Try to find answer in multiple places
    let answer = ''
    
    // Method 1: Page title (most reliable)
    const title = $('title').text()
    if (title && !title.includes('StatMuse')) {
      answer = title
    }
    
    // Method 2: Main answer container
    if (!answer) {
      answer = $('.nlg-answer').text() || 
               $('.answer-text').text() || 
               $('[data-cy="answer"]').text()
    }
    
    // Method 3: Meta description
    if (!answer) {
      answer = $('meta[name="description"]').attr('content') || ''
    }

    // Clean up answer
    answer = answer.trim()
    
    // Extract numerical value if present
    const extractedValue = this.extractValue(answer)
    
    // Determine confidence
    const confidence = this.determineConfidence(answer, extractedValue)

    return {
      question,
      answer,
      url,
      extractedValue,
      confidence
    }
  }

  /**
   * Extract numerical or key value from answer
   */
  private extractValue(answer: string): number | string | undefined {
    // Try to extract numbers
    const numberMatch = answer.match(/(\d+\.?\d*)/);
    if (numberMatch) {
      return parseFloat(numberMatch[1])
    }
    
    // Try to extract win-loss record
    const recordMatch = answer.match(/(\d+-\d+)/);
    if (recordMatch) {
      return recordMatch[1]
    }
    
    // Try to extract percentage
    const percentMatch = answer.match(/(\d+\.?\d*)%/);
    if (percentMatch) {
      return parseFloat(percentMatch[1])
    }
    
    return undefined
  }

  /**
   * Determine confidence level in answer
   */
  private determineConfidence(answer: string, extractedValue?: number | string): 'high' | 'medium' | 'low' {
    if (!answer || answer.length < 10) return 'low'
    if (answer.toLowerCase().includes('no data') || answer.toLowerCase().includes('not found')) return 'low'
    if (extractedValue !== undefined) return 'high'
    if (answer.length > 50) return 'medium'
    return 'medium'
  }
}

// Export singleton
let statMuseClient: StatMuseClient | null = null

export function getStatMuseClient(): StatMuseClient {
  if (!statMuseClient) {
    statMuseClient = new StatMuseClient()
  }
  return statMuseClient
}

/**
 * Helper: Generate smart questions for a matchup
 */
export function generateMatchupQuestions(
  homeTeam: string,
  awayTeam: string,
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl'
): StatMuseQuery[] {
  const questions: StatMuseQuery[] = []
  
  // Recent performance
  questions.push({
    sport,
    question: `${homeTeam} last 5 games record`
  })
  
  questions.push({
    sport,
    question: `${awayTeam} last 5 games record`
  })
  
  // Head to head
  questions.push({
    sport,
    question: `${homeTeam} vs ${awayTeam} last 5 meetings`
  })
  
  // Sport-specific
  if (sport === 'nba') {
    questions.push({
      sport,
      question: `${homeTeam} points per game this season`
    })
    
    questions.push({
      sport,
      question: `${awayTeam} points allowed per game`
    })
  } else if (sport === 'nfl') {
    questions.push({
      sport,
      question: `${homeTeam} offensive yards per game`
    })
    
    questions.push({
      sport,
      question: `${awayTeam} defensive yards allowed per game`
    })
  }
  
  return questions
}

