#!/usr/bin/env node

/**
 * Model Calibration CLI Script
 * Run calibration analysis and update model parameters
 */

const fetch = require('node-fetch')

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function runCalibration(options = {}) {
  const {
    modelVersion = 'nba_totals_v1',
    sampleSize = 100,
    minConfScore = 1.0
  } = options

  console.log('🧮 Starting model calibration...')
  console.log(`   Model: ${modelVersion}`)
  console.log(`   Sample Size: ${sampleSize}`)
  console.log(`   Min Confidence: ${minConfScore}`)

  try {
    const response = await fetch(`${API_BASE}/api/calibration/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_version: modelVersion,
        sample_size: sampleSize,
        min_conf_score: minConfScore
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (result.success) {
      console.log('✅ Calibration completed successfully!')
      console.log('')
      console.log('📊 Results:')
      console.log(`   Scaling Constant: ${result.calibration.scaling_constant}`)
      console.log(`   Sample Size: ${result.calibration.sample_size}`)
      console.log(`   R-squared: ${result.calibration.r_squared}`)
      console.log('')
      console.log('📈 Hit Rates by Bin:')
      Object.entries(result.calibration.hit_rate_by_bin).forEach(([bin, rate]) => {
        console.log(`   ${bin}: ${(rate * 100).toFixed(1)}%`)
      })
      console.log('')
      console.log('📊 Updated Stats:')
      console.log(`   Total Runs: ${result.stats.totalRuns}`)
      console.log(`   Latest Scaling: ${result.stats.latestScaling}`)
      console.log(`   Avg R-squared: ${result.stats.avgRSquared}`)
      console.log(`   Last Calibrated: ${result.stats.lastCalibrated}`)
    } else {
      console.error('❌ Calibration failed:', result.error)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Error running calibration:', error.message)
    process.exit(1)
  }
}

async function getCalibrationStats(modelVersion = 'nba_totals_v1') {
  console.log(`📊 Fetching calibration stats for ${modelVersion}...`)

  try {
    const response = await fetch(`${API_BASE}/api/calibration/run?model_version=${modelVersion}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (result.success) {
      console.log('📊 Calibration Stats:')
      console.log(`   Total Runs: ${result.stats.totalRuns}`)
      console.log(`   Latest Scaling: ${result.stats.latestScaling}`)
      console.log(`   Avg R-squared: ${result.stats.avgRSquared}`)
      console.log(`   Last Calibrated: ${result.stats.lastCalibrated || 'Never'}`)
    } else {
      console.error('❌ Failed to fetch stats:', result.error)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Error fetching stats:', error.message)
    process.exit(1)
  }
}

// CLI interface
const command = process.argv[2]
const modelVersion = process.argv[3] || 'nba_totals_v1'
const sampleSize = parseInt(process.argv[4]) || 100
const minConfScore = parseFloat(process.argv[5]) || 1.0

switch (command) {
  case 'run':
    runCalibration({ modelVersion, sampleSize, minConfScore })
    break
  case 'stats':
    getCalibrationStats(modelVersion)
    break
  default:
    console.log('Usage:')
    console.log('  node scripts/calibrate-model.js run [modelVersion] [sampleSize] [minConfScore]')
    console.log('  node scripts/calibrate-model.js stats [modelVersion]')
    console.log('')
    console.log('Examples:')
    console.log('  node scripts/calibrate-model.js run')
    console.log('  node scripts/calibrate-model.js run nba_totals_v1 200 2.0')
    console.log('  node scripts/calibrate-model.js stats nba_totals_v1')
    process.exit(1)
}
