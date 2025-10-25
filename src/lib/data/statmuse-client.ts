import * as cheerio from 'cheerio'

export class StatMuseClient {
  private baseUrl: string = 'https://www.statmuse.com'

  /**
   * Constructs a StatMuseClient instance.
   */
  constructor() {}

  /**
   * Generates a StatMuse query URL from a natural language question.
   * @param sport The sport (e.g., 'nfl', 'nba', 'mlb').
   * @param question The natural language question (e.g., "aaron rodgers last 4 games touchdowns").
   * @returns The full URL for the StatMuse query.
   */
  private generateQueryUrl(sport: string, question: string): string {
    const encodedQuestion = encodeURIComponent(question.replace(/\s/g, '-'))
    return `${this.baseUrl}/${sport}/ask/${encodedQuestion}`
  }

  /**
   * Queries StatMuse with a natural language question and scrapes the answer.
   * @param sport The sport (e.g., 'nfl', 'nba', 'mlb').
   * @param question The natural language question.
   * @returns The answer from StatMuse as a string, or null if not found.
   */
  async query(sport: string, question: string): Promise<string | null> {
    const url = this.generateQueryUrl(sport, question)
    console.log(`[StatMuse] Querying: ${url}`)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      if (!response.ok) {
        console.error(`[StatMuse] Failed to fetch ${url}: ${response.status} ${response.statusText}`)
        return null
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Attempt to find the answer in common StatMuse locations
      // The main answer is often in the <title> tag or a specific div
      let answer = $('title').text() // Often contains the answer directly

      // Look for a more specific answer container if available
      const qaAnswer = $('.qa__answer').first().text().trim()
      if (qaAnswer) {
        answer = qaAnswer
      } else {
        // Fallback to other potential elements if needed
        const mainContent = $('div[class*="answer-container"]').first().text().trim()
        if (mainContent) {
          answer = mainContent
        }
      }

      // Filter out generic page titles
      const pageTitle = $('head title').text()
      if (answer && answer !== pageTitle && answer.length > 10) {
        console.log(`[StatMuse] Answer found for "${question}": ${answer}`)
        return answer
      }

      console.log(`[StatMuse] No specific answer found for "${question}" on ${url}`)
      return null
    } catch (error) {
      console.error(`[StatMuse] Error querying StatMuse for "${question}":`, error)
      return null
    }
  }

  /**
   * Queries multiple questions in parallel.
   * @param sport The sport (e.g., 'nfl', 'nba', 'mlb').
   * @param questions Array of natural language questions.
   * @returns Array of results with questions and answers.
   */
  async queryBatch(sport: string, questions: string[]): Promise<Array<{ question: string; answer: string | null }>> {
    const promises = questions.map(async (question) => ({
      question,
      answer: await this.query(sport, question)
    }))

    return Promise.all(promises)
  }
}
