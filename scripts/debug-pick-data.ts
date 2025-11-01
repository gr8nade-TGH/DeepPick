/**
 * Debug script to check what data is saved in the database for a specific pick
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugPickData(pickId: string) {
  console.log(`\n🔍 Investigating pick: ${pickId}\n`)

  // Get pick data
  const { data: pick, error: pickError } = await supabase
    .from('picks')
    .select('*')
    .eq('pick_id', pickId)
    .single()

  if (pickError) {
    console.error('❌ Error fetching pick:', pickError)
    return
  }

  console.log('📋 PICK DATA:')
  console.log(JSON.stringify(pick, null, 2))

  // Get run data
  const { data: run, error: runError } = await supabase
    .from('runs')
    .select('*')
    .eq('run_id', pick.run_id)
    .single()

  if (runError) {
    console.error('❌ Error fetching run:', runError)
    return
  }

  console.log('\n📊 RUN DATA:')
  console.log(JSON.stringify(run, null, 2))

  // Check specific fields
  console.log('\n🔍 CRITICAL FIELDS CHECK:')
  console.log('factor_contributions:', run.factor_contributions ? `✅ ${Array.isArray(run.factor_contributions) ? run.factor_contributions.length : 'NOT ARRAY'} factors` : '❌ NULL/EMPTY')
  console.log('predicted_total:', run.predicted_total ? `✅ ${run.predicted_total}` : '❌ NULL/EMPTY')
  console.log('predicted_home_score:', run.predicted_home_score ? `✅ ${run.predicted_home_score}` : '❌ NULL/EMPTY')
  console.log('predicted_away_score:', run.predicted_away_score ? `✅ ${run.predicted_away_score}` : '❌ NULL/EMPTY')
  console.log('bold_predictions:', run.bold_predictions ? `✅ HAS DATA` : '❌ NULL/EMPTY')
  console.log('baseline_avg:', run.baseline_avg ? `✅ ${run.baseline_avg}` : '❌ NULL/EMPTY')
  console.log('market_total:', run.market_total ? `✅ ${run.market_total}` : '❌ NULL/EMPTY')

  if (run.factor_contributions && Array.isArray(run.factor_contributions)) {
    console.log('\n📈 FACTOR CONTRIBUTIONS DETAIL:')
    run.factor_contributions.forEach((fc: any, idx: number) => {
      console.log(`  ${idx + 1}. ${fc.name || fc.key}:`)
      console.log(`     - weight_percentage: ${fc.weight_percentage || fc.weight_total_pct || 'MISSING'}`)
      console.log(`     - weighted_contributions: ${fc.weighted_contributions ? 'YES' : 'NO'}`)
      if (fc.weighted_contributions) {
        console.log(`       - overScore: ${fc.weighted_contributions.overScore}`)
        console.log(`       - underScore: ${fc.weighted_contributions.underScore}`)
      }
    })
  }

  if (run.bold_predictions) {
    console.log('\n🎯 BOLD PREDICTIONS:')
    console.log(JSON.stringify(run.bold_predictions, null, 2))
  }

  // Check metadata (old format fallback)
  if (run.metadata) {
    console.log('\n📦 METADATA (OLD FORMAT):')
    console.log(JSON.stringify(run.metadata, null, 2))
  }
}

// Get pick ID from command line or use default
const pickId = process.argv[2] || '7d619625-a258-4d4e-86e1-d32d4eb6dc19'

debugPickData(pickId)
  .then(() => {
    console.log('\n✅ Debug complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

