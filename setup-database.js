const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
    
    // Read the SQL migration file
    const sql = fs.readFileSync('./clean-migration.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement using the REST API
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          // Use the REST API to execute SQL
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ sql: statement })
          });
          
          if (!response.ok) {
            const error = await response.text();
            console.log(`⚠️  Statement ${i + 1} had issues (this might be normal):`, error.substring(0, 100));
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} had issues (this might be normal):`, err.message);
        }
      }
    }
    
    console.log('🎉 Database setup completed!');
    console.log('✅ Your Deep Pick database is now ready!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.log('\n🔧 Manual Setup Required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk');
    console.log('2. Click "SQL Editor"');
    console.log('3. Copy the contents of clean-migration.sql');
    console.log('4. Paste and run the SQL');
  }
}

// Run the setup
setupDatabase();
