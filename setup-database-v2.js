const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://xckbsyeaywrfzvcahhtk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVheXdyZnp2Y2FoaHRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY5OTk5NCwiZXhwIjoyMDc2Mjc1OTk0fQ.X030bIA1wHARMnfZ8i5V_sizaebC78ZvkxMaD3mZDc8';

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Deep Pick database...');
    
    // Test the connection first
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.log('❌ Database connection failed. Manual setup required.');
      console.log('\n🔧 Manual Setup Instructions:');
      console.log('1. Go to: https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk');
      console.log('2. Click "SQL Editor" in the left sidebar');
      console.log('3. Click "New query"');
      console.log('4. Copy the entire contents of clean-migration.sql');
      console.log('5. Paste it into the SQL editor');
      console.log('6. Click "Run" to execute the migration');
      console.log('\nThis will create all the necessary tables for Deep Pick!');
      return;
    }
    
    console.log('✅ Database connection successful!');
    console.log('🎉 Your Deep Pick database is ready!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Manual Setup Required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk');
    console.log('2. Click "SQL Editor"');
    console.log('3. Copy the contents of clean-migration.sql');
    console.log('4. Paste and run the SQL');
  }
}

// Run the setup
setupDatabase();
