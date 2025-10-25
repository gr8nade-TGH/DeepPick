import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function logCronJobExecution(
  jobName: string,
  success: boolean,
  durationMs: number,
  error?: string
) {
  try {
    const supabase = getSupabaseAdmin()
    
    // Get existing job stats
    const { data: existing } = await supabase
      .from('cron_job_status')
      .select('*')
      .eq('job_name', jobName)
      .single()
    
    const now = new Date().toISOString()
    
    if (existing) {
      // Update existing record
      const newTotalRuns = existing.total_runs + 1
      const newSuccessRuns = success ? existing.success_runs + 1 : existing.success_runs
      const newFailedRuns = success ? existing.failed_runs : existing.failed_runs + 1
      
      await supabase
        .from('cron_job_status')
        .update({
          last_run_at: now,
          last_run_status: success ? 'success' : 'failed',
          last_run_duration_ms: durationMs,
          total_runs: newTotalRuns,
          success_runs: newSuccessRuns,
          failed_runs: newFailedRuns,
          last_error: error || null,
          updated_at: now
        })
        .eq('job_name', jobName)
      
      console.log(`✅ Logged cron execution: ${jobName} (${success ? 'success' : 'failed'})`)
    } else {
      // Create new record
      await supabase
        .from('cron_job_status')
        .insert({
          job_name: jobName,
          job_type: 'vercel_cron',
          last_run_at: now,
          last_run_status: success ? 'success' : 'failed',
          last_run_duration_ms: durationMs,
          total_runs: 1,
          success_runs: success ? 1 : 0,
          failed_runs: success ? 0 : 1,
          last_error: error || null,
          created_at: now,
          updated_at: now
        })
      
      console.log(`✅ Created cron status record: ${jobName}`)
    }
  } catch (err) {
    console.warn(`⚠️ Could not log cron execution for ${jobName}:`, err)
  }
}

