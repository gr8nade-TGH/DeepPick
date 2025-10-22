// Simple API test to check if the route exists
const API_URL = 'https://deep-pick-lojts8c4d-deep-pick.vercel.app/api/shiva/factors/save'

async function testAPI() {
  console.log('🔍 Testing API endpoint existence...')
  console.log('📤 URL:', API_URL)
  
  try {
    const response = await fetch(API_URL, {
      method: 'GET', // Try GET first to see if route exists
    })
    
    console.log('📊 Status:', response.status)
    console.log('📊 Status Text:', response.statusText)
    console.log('📊 Headers:', Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    console.log('📋 Response (first 500 chars):', text.substring(0, 500))
    
  } catch (error) {
    console.error('💥 Error:', error.message)
  }
}

testAPI()
