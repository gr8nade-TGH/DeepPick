// Test the existing factors config API
const API_URL = 'https://deep-pick-lojts8c4d-deep-pick.vercel.app/api/factors/config'

async function testExistingAPI() {
  console.log('🧪 Testing existing Factor Config API...')
  console.log('📤 Sending GET request to:', API_URL)
  
  try {
    // Test GET first
    const getResponse = await fetch(`${API_URL}?capperId=SHIVA&sport=NBA&betType=TOTAL`)
    console.log('📊 GET Response Status:', getResponse.status)
    
    if (getResponse.ok) {
      const getData = await getResponse.json()
      console.log('📋 GET Response:', JSON.stringify(getData, null, 2))
    } else {
      const getText = await getResponse.text()
      console.log('📋 GET Error Response:', getText.substring(0, 500))
    }
    
    // Test POST
    console.log('\n📤 Testing POST...')
    const postPayload = {
      "capperId": "SHIVA",
      "sport": "NBA",
      "betType": "TOTAL",
      "name": "SHIVA NBA TOTAL Default",
      "description": "Default factor configuration for SHIVA NBA TOTAL",
      "factors": [
        {"key": "paceIndex", "name": "Matchup Pace Index", "description": "Expected game pace vs league average", "enabled": true, "weight": 20, "dataSource": "nba-stats-api", "maxPoints": 2.0, "sport": "NBA", "betType": "TOTAL", "scope": "matchup", "icon": "⏱️", "shortName": "Pace"},
        {"key": "offForm", "name": "Offensive Form vs League", "description": "Combined team offensive efficiency vs league average", "enabled": true, "weight": 20, "dataSource": "nba-stats-api", "maxPoints": 2.0, "sport": "NBA", "betType": "TOTAL", "scope": "matchup", "icon": "🔥", "shortName": "Offense"},
        {"key": "defErosion", "name": "Defensive Erosion", "description": "Defensive rating decline + injury impact", "enabled": true, "weight": 20, "dataSource": "nba-stats-api", "maxPoints": 2.0, "sport": "NBA", "betType": "TOTAL", "scope": "matchup", "icon": "🛡️", "shortName": "Defense"},
        {"key": "threeEnv", "name": "3-Point Environment & Volatility", "description": "3-point attempt rate and recent shooting variance", "enabled": true, "weight": 20, "dataSource": "nba-stats-api", "maxPoints": 2.0, "sport": "NBA", "betType": "TOTAL", "scope": "matchup", "icon": "🏹", "shortName": "3-Point"},
        {"key": "whistleEnv", "name": "Free-Throw / Whistle Environment", "description": "Free throw rate and referee whistle tendencies", "enabled": true, "weight": 20, "dataSource": "nba-stats-api", "maxPoints": 2.0, "sport": "NBA", "betType": "TOTAL", "scope": "matchup", "icon": "⛹️‍♂️", "shortName": "FT/Whistle"}
      ]
    }
    
    const postResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postPayload)
    })
    
    console.log('📊 POST Response Status:', postResponse.status)
    const postData = await postResponse.json()
    console.log('📋 POST Response:', JSON.stringify(postData, null, 2))
    
  } catch (error) {
    console.error('💥 Error:', error.message)
  }
}

testExistingAPI()
