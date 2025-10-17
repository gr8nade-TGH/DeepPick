import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xckbsyeaywrfzvcahhtk.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVheXdyZnp2Y2FoaHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk5OTQsImV4cCI6MjA3NjI3NTk5NH0.X_FRhkUhefhTeiGRRNBckxusVFurEJ_bZMy1BImaCpI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
