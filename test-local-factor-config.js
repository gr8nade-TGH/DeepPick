// Test the factor config API locally
const API_URL = 'http://localhost:3001/api/shiva/factors/save'

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
  console.log('🧪 Testing Factor Config API Locally...')
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

// Test with invalid payload to check validation
async function testInvalidPayload() {
  console.log('\n🧪 Testing Invalid Payload...')
  
  const invalidPayload = {
    "capper_code": "SHIVA",
    "config": {
      "factors": [
        {"id": "invalid_factor", "weight": 0.5, "enabled": true}
      ],
      "thresholds": {
        "play_abs": 0.55,
        "units_map": [[0.55, 1]]
      },
      "weights_sum": 0.5 // Invalid - doesn't match calculated sum
    }
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidPayload)
    })
    
    const responseData = await response.json()
    console.log('📊 Invalid Payload Response Status:', response.status)
    console.log('📋 Invalid Payload Response:', JSON.stringify(responseData, null, 2))
    
  } catch (error) {
    console.error('💥 Invalid Payload Error:', error.message)
  }
}

// Run tests
testFactorConfig().then(() => testInvalidPayload())
