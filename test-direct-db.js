// Test direct database access to verify the schema works
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://mevirooooypfjbsrmzrk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ldmlyb29vb3lwZmpic3JtcnJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTU0NzQwOCwiZXhwIjIwNDUxMjM0MDh9.FGez_nPoWZA5NKbJP54e5JsgJILrWB7rBUD4vx6iZZA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDirectDB() {
  console.log('🧪 Testing Direct Database Access...')
  
  try {
    // Test 1: Check if table exists and is accessible
    console.log('📊 Testing table access...')
    const { data: testData, error: testError } = await supabase
      .from('capper_profiles')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('❌ Table access failed:', testError)
      return
    }
    
    console.log('✅ Table access successful:', testData)
    
    // Test 2: Try to insert a test record
    console.log('📊 Testing insert...')
    const testRecord = {
      capper_code: 'SHIVA',
      label: 'Test Profile',
      config: {
        factors: [
          { id: 'pace', weight: 0.5, enabled: true }
        ],
        thresholds: {
          play_abs: 0.55,
          units_map: [[0.55, 1]]
        },
        weights_sum: 0.5
      }
    }
    
    const { data: insertData, error: insertError } = await supabase
      .from('capper_profiles')
      .insert(testRecord)
      .select()
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError)
    } else {
      console.log('✅ Insert successful:', insertData)
      
      // Test 3: Clean up test record
      if (insertData && insertData[0]) {
        const { error: deleteError } = await supabase
          .from('capper_profiles')
          .delete()
          .eq('profile_id', insertData[0].profile_id)
        
        if (deleteError) {
          console.error('⚠️ Cleanup failed:', deleteError)
        } else {
          console.log('✅ Cleanup successful')
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

testDirectDB()
