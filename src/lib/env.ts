import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  THE_ODDS_API_KEY: z.string().min(1).optional(),
  SPORTS_DATA_API_KEY: z.string().min(1).optional(),
  ESPN_API_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  REDIS_TOKEN: z.string().min(1).optional(),
  DRAFTKINGS_API_KEY: z.string().min(1).optional(),
  PRIZEPICKS_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  VERCEL_ANALYTICS_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
})

export const env = envSchema.parse(process.env)

export type Environment = z.infer<typeof envSchema>