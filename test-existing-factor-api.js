// Test the existing factors config API that we know works
const API_URL = 'http://localhost:3001/api/factors/config'

const testPayload = {
  "capperId": "SHIVA",
  "sport": "NBA",
  "betType": "TOTAL",
  "name": "SHIVA NBA TOTAL Default",
  "description": "Default factor configuration for SHIVA NBA TOTAL",
  "factors": [
    {
      "key": "paceIndex",
      "name": "Matchup Pace Index",
      "description": "Expected game pace vs league average",
      "enabled": true,
      "weight": 20,
      "dataSource": "nba-stats-api",
      "maxPoints": 2.0,
      "sport": "NBA",
      "betType": "TOTAL",
      "scope": "matchup",
      "icon": "⏱️",
      "shortName": "Pace"
    },
    {
      "key": "offForm",
      "name": "Offensive Form vs League",
      "description": "Combined team offensive efficiency vs league average",
      "enabled": true,
      "weight": 20,
      "dataSource": "nba-stats-api",
      "maxPoints": 2.0,
      "sport": "NBA",
      "betType": "TOTAL",
      "scope": "matchup",
      "icon": "🔥",
      "shortName": "Offense"
    },
    {
      "key": "defErosion",
      "name": "Defensive Erosion",
      "description": "Defensive rating decline + injury impact",
      "enabled": true,
      "weight": 20,
      "dataSource": "nba-stats-api",
      "maxPoints": 2.0,
      "sport": "NBA",
      "betType": "TOTAL",
      "scope": "matchup",
      "icon": "🛡️",
      "shortName": "Defense"
    },
    {
      "key": "threeEnv",
      "name": "3-Point Environment & Volatility",
      "description": "3-point attempt rate and recent shooting variance",
      "enabled": true,
      "weight": 20,
      "dataSource": "nba-stats-api",
      "maxPoints": 2.0,
      "sport": "NBA",
      "betType": "TOTAL",
      "scope": "matchup",
      "icon": "🏹",
      "shortName": "3-Point"
    },
    {
      "key": "whistleEnv",
      "name": "Free-Throw / Whistle Environment",
      "description": "Free throw rate and referee whistle tendencies",
      "enabled": true,
      "weight": 20,
      "dataSource": "nba-stats-api",
      "maxPoints": 2.0,
      "sport": "NBA",
      "betType": "TOTAL",
      "scope": "matchup",
      "icon": "⛹️‍♂️",
      "shortName": "FT/Whistle"
    }
  ]
}

async function testExistingAPI() {
  console.log('🧪 Testing Existing Factor Config API...')
  console.log('📤 Sending POST request to:', API_URL)
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
      console.log('🆔 Profile ID:', responseData.profile?.id)
      console.log('🆔 Request ID:', responseData.requestId)
    } else {
      console.log('❌ FAILED! Error response received')
      console.log('🔍 Error:', responseData.error)
      console.log('🔍 Details:', responseData.details)
    }
    
  } catch (error) {
    console.error('💥 Network Error:', error.message)
    console.error('🔍 Full Error:', error)
  }
}

// Test GET first
async function testGetAPI() {
  console.log('\n🧪 Testing GET request...')
  
  try {
    const response = await fetch(`${API_URL}?capperId=SHIVA&sport=NBA&betType=TOTAL`)
    const data = await response.json()
    
    console.log('📊 GET Response Status:', response.status)
    console.log('📋 GET Response:', JSON.stringify(data, null, 2))
    
  } catch (error) {
    console.error('💥 GET Error:', error.message)
  }
}

// Run tests
testGetAPI().then(() => testExistingAPI())
