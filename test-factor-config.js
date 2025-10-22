// Test script for the new factor config API
const API_URL = 'https://deep-pick-lojts8c4d-deep-pick.vercel.app/api/shiva/factors/save'

const testPayload = {
  "capper_code": "SHIVA",
  "label": "SHIVA NBA TOTAL Default",
  "config": {
    "factors": [
      {"id": "pace", "weight": 0.2, "enabled": true},
      {"id": "efg", "weight": 0.3, "enabled": true},
      {"id": "tov", "weight": 0.2, "enabled": true},
      {"id": "orb", "weight": 0.15, "enabled": true},
      {"id": "ftr", "weight": 0.15, "enabled": true}
    ],
    "thresholds": {
      "play_abs": 0.55,
      "units_map": [[0.55, 1], [0.7, 2], [0.85, 3]]
    },
    "weights_sum": 1.0
  }
}

async function testFactorConfig() {
  console.log('🧪 Testing Factor Config API...')
  console.log('📤 Sending request to:', API_URL)
  console.log('📋 Payload:', JSON.stringify(testPayload, null, 2))
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    })
    
    console.log('📊 Response Status:', response.status)
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()))
    
    const responseData = await response.json()
    console.log('📋 Response Body:', JSON.stringify(responseData, null, 2))
    
    if (response.ok) {
      console.log('✅ SUCCESS! Factor config saved successfully')
      console.log('🆔 Profile ID:', responseData.profile_id)
      console.log('🆔 Request ID:', responseData.request_id)
    } else {
      console.log('❌ FAILED! Error response received')
      console.log('🔍 Error Code:', responseData.error?.code)
      console.log('🔍 Error Message:', responseData.error?.message)
      console.log('🔍 Error Details:', responseData.error?.details)
    }
    
  } catch (error) {
    console.error('💥 Network Error:', error.message)
    console.error('🔍 Full Error:', error)
  }
}

// Run the test
testFactorConfig()
