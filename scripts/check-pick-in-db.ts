/**
 * Script to check what data is actually stored in the database for a specific pick
 * Usage: npx tsx scripts/check-pick-in-db.ts <pick_id>
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkPickData(pickId: string) {
  console.log('\n🔍 Checking pick data for:', pickId)
  console.log('='.repeat(80))

  // 1. Get the pick record
  console.log('\n📋 STEP 1: Fetching pick record...')
  const { data: pick, error: pickError } = await admin
    .from('picks')
    .select('*')
    .eq('id', pickId)
    .single()

  if (pickError) {
    console.error('❌ Error fetching pick:', pickError.message)
    return
  }

  if (!pick) {
    console.error('❌ Pick not found')
    return
  }

  console.log('✅ Pick found:')
  console.log({
    id: pick.id,
    run_id: pick.run_id,
    sport: pick.sport,
    matchup: pick.matchup,
    confidence: pick.confidence,
    units: pick.units,
    pick_type: pick.pick_type,
    selection: pick.selection,
    created_at: pick.created_at
  })

  // 2. Get the run record
  console.log('\n📋 STEP 2: Fetching run record...')
  const { data: run, error: runError } = await admin
    .from('runs')
    .select('*')
    .eq('run_id', pick.run_id)
    .single()

  if (runError) {
    console.error('❌ Error fetching run:', runError.message)
    return
  }

  if (!run) {
    console.error('❌ Run not found')
    return
  }

  console.log('✅ Run found:')
  console.log({
    id: run.id,
    run_id: run.run_id,
    game_id: run.game_id,
    capper: run.capper,
    bet_type: run.bet_type,
    units: run.units,
    confidence: run.confidence,
    pick_type: run.pick_type,
    selection: run.selection,
    created_at: run.created_at,
    updated_at: run.updated_at
  })

  // 3. Check factor_contributions
  console.log('\n📊 STEP 3: Checking factor_contributions...')
  if (!run.factor_contributions) {
    console.error('❌ factor_contributions is NULL')
  } else if (Array.isArray(run.factor_contributions) && run.factor_contributions.length === 0) {
    console.error('❌ factor_contributions is EMPTY ARRAY')
  } else if (Array.isArray(run.factor_contributions)) {
    console.log(`✅ factor_contributions has ${run.factor_contributions.length} factors`)
    console.log('\nFactor contributions:')
    run.factor_contributions.forEach((fc: any, idx: number) => {
      console.log(`  ${idx + 1}. ${fc.name || fc.key}:`, {
        key: fc.key,
        weight: fc.weight,
        contribution: fc.contribution,
        overScore: fc.weighted_contributions?.overScore,
        underScore: fc.weighted_contributions?.underScore
      })
    })
  } else {
    console.error('❌ factor_contributions has unexpected format:', typeof run.factor_contributions)
  }

  // 4. Check predicted scores
  console.log('\n🎯 STEP 4: Checking predicted scores...')
  console.log({
    predicted_total: run.predicted_total || '❌ NULL/0',
    predicted_home_score: run.predicted_home_score || '❌ NULL/0',
    predicted_away_score: run.predicted_away_score || '❌ NULL/0',
    baseline_avg: run.baseline_avg || '❌ NULL',
    market_total: run.market_total || '❌ NULL'
  })

  if (!run.predicted_total || run.predicted_total === 0) {
    console.error('❌ predicted_total is missing or zero')
  } else {
    console.log(`✅ predicted_total: ${run.predicted_total}`)
  }

  if (!run.predicted_home_score || run.predicted_home_score === 0) {
    console.error('❌ predicted_home_score is missing or zero')
  } else {
    console.log(`✅ predicted_home_score: ${run.predicted_home_score}`)
  }

  if (!run.predicted_away_score || run.predicted_away_score === 0) {
    console.error('❌ predicted_away_score is missing or zero')
  } else {
    console.log(`✅ predicted_away_score: ${run.predicted_away_score}`)
  }

  // 5. Check bold predictions
  console.log('\n💡 STEP 5: Checking bold_predictions...')
  if (!run.bold_predictions) {
    console.error('❌ bold_predictions is NULL')
  } else {
    console.log('✅ bold_predictions exists')
    console.log(JSON.stringify(run.bold_predictions, null, 2))
  }

  // 6. Check for duplicate runs
  console.log('\n🔄 STEP 6: Checking for duplicate runs...')
  const { data: duplicateRuns, error: duplicateError } = await admin
    .from('runs')
    .select('id, run_id, game_id, units, confidence, created_at, updated_at')
    .eq('game_id', run.game_id)
    .order('created_at', { ascending: false })

  if (duplicateError) {
    console.error('❌ Error checking duplicates:', duplicateError.message)
  } else if (duplicateRuns && duplicateRuns.length > 1) {
    console.warn(`⚠️ Found ${duplicateRuns.length} runs for this game:`)
    duplicateRuns.forEach((r: any, idx: number) => {
      console.log(`  ${idx + 1}. run_id: ${r.run_id}, units: ${r.units}, created: ${r.created_at}, updated: ${r.updated_at}`)
    })
  } else {
    console.log('✅ No duplicate runs found')
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Check complete!\n')
}

// Get pick ID from command line args
const pickId = process.argv[2]

if (!pickId) {
  console.error('❌ Usage: npx tsx scripts/check-pick-in-db.ts <pick_id>')
  console.error('Example: npx tsx scripts/check-pick-in-db.ts 56d51cf4-bb22-4f98-937a-059e752b7315')
  process.exit(1)
}

checkPickData(pickId).catch(console.error)

