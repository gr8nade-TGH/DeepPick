/**
 * OpenAI API Proxy
 * Handles LLM requests for injury parsing and other AI tasks
 */

import { z } from 'zod'

const OpenAIRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })),
  temperature: z.number().min(0).max(2).default(0.1),
  response_format: z.object({
    type: z.literal('json_object')
  }).optional()
}).strict()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parse = OpenAIRequestSchema.safeParse(body)
    
    if (!parse.success) {
      return Response.json(
        { error: 'Invalid request body', issues: parse.error.issues },
        { status: 400 }
      )
    }
    
    const { messages, temperature, response_format } = parse.data
    
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use cost-effective model
        messages,
        temperature,
        response_format,
        max_tokens: 1000, // Limit response length
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('[OpenAI] API error:', response.status, error)
      return Response.json(
        { error: 'OpenAI API error', details: error },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    return Response.json({
      choices: data.choices,
      usage: data.usage
    })
    
  } catch (error) {
    console.error('[OpenAI] Request error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
