import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jbzlnjwbvbmhqwkixrwu.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiemxuandidmJtaHF3a2l4cnd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzUxNzA4MSwiZXhwIjoyMTAzMDkzMDgxfQ.7dohQReP7d32u4w6Vut-xOosXwkeYfIcfn9u70K8Bck';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function seedAdmin() {
  console.log('Creating admin user...');
  
  // Create user in auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@championship.com',
    password: 'AdminPassword123!',
    email_confirm: true
  });
  
  if (authError) {
    console.error('Error creating auth user:', authError);
    if (!authError.message.includes('already exists')) {
      return;
    }
  }
  
  // Try to get the user ID if it already existed
  let userId = authData?.user?.id;
  if (!userId) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers.users.find(u => u.email === 'admin@championship.com');
    if (existing) userId = existing.id;
  }
  
  if (userId) {
    console.log('User ID:', userId);
    // Ensure they have the ADMIN role in public.users
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: 'admin@championship.com',
        role: 'ADMIN',
        full_name: 'System Admin'
      });
      
    if (dbError) {
      console.error('Error setting public.users role:', dbError);
    } else {
      console.log('Admin user successfully configured!');
      console.log('Email: admin@championship.com');
      console.log('Password: AdminPassword123!');
    }
  }
}

seedAdmin();
