import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jbzlnjwbvbmhqwkixrwu.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiemxuandidmJtaHF3a2l4cnd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzUxNzA4MSwiZXhwIjoyMTAzMDkzMDgxfQ.7dohQReP7d32u4w6Vut-xOosXwkeYfIcfn9u70K8Bck';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function seedTeam() {
  console.log('Creating participant team...');
  
  const teamCode = 'TEST1234';
  const email = `${teamCode.toLowerCase()}@example.com`;
  const password = 'TeamPassword123!';
  
  // Create user in auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (authError && !authError.message.includes('already exists') && authError.code !== 'email_exists') {
    console.error('Error creating auth user:', authError);
    return;
  }
  
  let userId = authData?.user?.id;
  if (!userId) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers.users.find(u => u.email === email);
    if (existing) userId = existing.id;
  }
  
  if (userId) {
    // 1. Create team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .upsert({
        access_code: teamCode,
        name: 'Team Beta Test',
      }, { onConflict: 'access_code' })
      .select()
      .single();
      
    if (teamError) {
      console.error('Error creating team:', teamError);
      return;
    }
    
    // 2. Add user to public.users as PARTICIPANT
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        role: 'PARTICIPANT',
        full_name: 'Beta Tester'
      });
      
    if (dbError) {
      console.error('Error setting public.users role:', dbError);
      return;
    }

    // 3. Link user to team
    const { error: memberError } = await supabase
      .from('participants')
      .upsert({
        team_id: teamData.id,
        user_id: userId,
        name: 'Beta Tester',
        role: 'CAPTAIN'
      });
      
    if (memberError) {
        console.error('Error linking member to team:', memberError);
    } else {
      console.log('Participant team successfully created!');
      console.log('Team Code / Email:', teamCode);
      console.log('Password:', password);
    }
  }
}

seedTeam();
