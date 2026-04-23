import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://brcrhtnubsvqimdtccyh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyY3JodG51YnN2cWltZHRjY3loIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY1MjY3MiwiZXhwIjoyMDkwMjI4NjcyfQ.JkmGEAC7D0XIN2Mf7kzmj9uPHlwqnKD8PyyJVJcr5Bg'
);

async function run() {
  console.log('Querying pg_policies...');
  const { data, error } = await supabase.rpc('execute_sql', {
    query: "SELECT * FROM pg_policies WHERE tablename = 'profiles';"
  });

  if (error) {
    console.error('RPC Error (execute_sql might not exist):', error.message);
    
    // Attempt querying via postgrest if table is exposed
    const { data: dbData, error: dbError } = await supabase.from('pg_policies').select('*').eq('tablename', 'profiles');
    if (dbError) {
      console.log('Could not read policies via PostgREST either:', dbError.message);
    } else {
      console.log('Polices via PostgREST:', dbData);
    }
  } else {
    console.log('Policies via RPC:', data);
  }
}

run();
