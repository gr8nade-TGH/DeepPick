const fs = require('fs');

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Deep Pick database...');
    
    // Read the SQL migration file
    const sql = fs.readFileSync('./supabase/migrations/001_initial_schema.sql', 'utf8');
    
    console.log('📝 SQL Migration Content:');
    console.log('=====================================');
    console.log(sql);
    console.log('=====================================');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute the migration');
    console.log('\nThis will create all the necessary tables for Deep Pick!');
    
  } catch (error) {
    console.error('❌ Error reading migration file:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();
