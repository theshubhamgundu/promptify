import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const makePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => chars[byte % chars.length]).join('');
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const input = await request.json();
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const loginDomain = Deno.env.get('TEAM_LOGIN_DOMAIN');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const sender = Deno.env.get('REGISTRATION_FROM_EMAIL');
    if (!loginDomain || !resendKey || !sender) return json({ error: 'Registration email is not configured. Contact the organiser.' }, 503);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: registered, error: registrationError } = await admin.rpc('register_team', input);
    if (registrationError) throw registrationError;
    if (!registered?.success) return json({ error: registered?.error || 'Registration failed' }, 400);
    const teamCode = registered.teamCode as string;
    const password = makePassword();
    const loginEmail = `${teamCode.toLowerCase()}@${loginDomain}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: loginEmail, password, email_confirm: true, user_metadata: { team_id: registered.teamId, team_code: teamCode, kind: 'team_login' } });
    if (createError) throw createError;
    const { error: profileError } = await admin.from('users').insert({ id: created.user.id, email: loginEmail, full_name: registered.teamName, role: 'PARTICIPANT' });
    if (profileError) throw profileError;
    const { error: participantError } = await admin.from('participants').insert({ team_id: registered.teamId, user_id: created.user.id, name: registered.teamName, role: 'CAPTAIN' });
    if (participantError) throw participantError;
    const recipients = [input.p_member1_email, input.p_member2_email].filter(Boolean);
    const text = `Registration confirmed for ${registered.teamName}.\n\nTeam code: ${teamCode}\nPassword: ${password}\n\nSign in at the event portal using the team code and password. Keep these credentials private.`;
    const mail = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender, to: recipients, subject: `Promptify registration confirmed — ${teamCode}`, text, html: `<h1>Registration confirmed</h1><p>Team <strong>${registered.teamName}</strong> is registered.</p><p><strong>Team code:</strong> ${teamCode}<br/><strong>Password:</strong> ${password}</p><p>Use these credentials to sign in to the event portal. Keep them private.</p>` }) });
    if (!mail.ok) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from('teams').delete().eq('id', registered.teamId);
      throw new Error('Could not deliver the confirmation email; registration was cancelled.');
    }
    return json({ success: true, teamCode, message: 'Registration complete. Credentials were emailed to both team members.' });
  } catch (error) {
    console.error('register-team failed', error);
    return json({ error: error instanceof Error ? error.message : 'Registration failed' }, 400);
  }
});
