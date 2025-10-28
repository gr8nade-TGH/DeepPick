import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SPORTS_DATA_API_KEY: z.string().min(1).optional(),
  MYSPORTSFEEDS_API_KEY: z.string().min(1).optional(),
  ESPN_API_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  REDIS_TOKEN: z.string().min(1).optional(),
  DRAFTKINGS_API_KEY: z.string().min(1).optional(),
  PRIZEPICKS_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  VERCEL_ANALYTICS_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // AI APIs for enhanced cappers
  PERPLEXITY_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENWEATHER_API_KEY: z.string().min(1).optional(),
  // Feature flags for SHIVA v1
  SHIVA_V1_ENABLED: z.string().optional(),
  SHIVA_V1_UI_ENABLED: z.string().optional(),
  SHIVA_V1_API_ENABLED: z.string().optional(),
  SHIVA_V1_WRITE_ENABLED: z.string().optional(),
  // Client-exposed flags (optional)
  NEXT_PUBLIC_SHIVA_V1_UI_ENABLED: z.string().optional(),
  NEXT_PUBLIC_SHIVA_V1_API_ENABLED: z.string().optional(),
  NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED: z.string().optional(),
})

export const env = envSchema.parse(process.env)

export type Environment = z.infer<typeof envSchema>