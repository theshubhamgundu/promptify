import { useState } from 'react';
import { BrainIcon } from '../components/icons';
import { Button, Toast } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { TeamService } from '../lib/services/teamService';
import { EventService } from '../lib/services/eventService';

export default function Login({ onLogin }: { onLogin: (isAdmin: boolean) => void }) {
  const [teamCode, setTeamCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore(s => s.setSession);
  const setCurrentTeam = useTeamStore(s => s.setCurrentTeam);
  const setMembers = useTeamStore(s => s.setMembers);
  const setCurrentEvent = useEventStore(s => s.setCurrentEvent);
  const setRounds = useEventStore(s => s.setRounds);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // For now we'll do a standard Supabase signInWithPassword since we added it to auth.users
      const loginEmail = teamCode.includes('@') ? teamCode : `${teamCode.toLowerCase()}@example.com`;
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (authError) throw authError;
      
      if (data.session) {
        setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        
        // Check if user is admin
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.session.user.id)
          .single();
          
        const isAdmin = userData?.role === 'ADMIN' || userData?.role === 'COORDINATOR';
        
        if (!isAdmin) {
          const context = await TeamService.getContextForUser(data.session.user.id);
          if (context && context.team) {
            setCurrentTeam(context.team as any);
            setMembers(context.members as any);
            setCurrentEvent(context.event as any);
            
            if (context.event) {
              const rounds = await EventService.getEventRounds(context.event.id);
              setRounds(rounds as any);
            }
          } else {
             throw new Error('Participant team context not found');
          }
        }

        onLogin(isAdmin);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f7f4] flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 relative overflow-hidden flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BrainIcon />
            </div>
            <div>
              <div className="text-white font-bold text-lg font-heading leading-none">PROMPT</div>
              <div className="text-white/80 font-bold text-sm font-heading leading-none">CHAMPIONSHIP</div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-white text-5xl font-bold font-heading leading-tight mb-4">
            Think.<br />Prompt.<br />Solve.<br />Win.
          </h2>
          <p className="text-white/70 text-lg">A battle of creativity, logic,<br />and AI mastery.</p>
        </div>

        <div className="flex items-center gap-6 text-white/60 text-sm">
          <div><span className="text-white font-bold text-xl font-heading">5</span><br />Rounds</div>
          <div className="w-px h-8 bg-white/20" />
          <div><span className="text-white font-bold text-xl font-heading">1100</span><br />Max Points</div>
          <div className="w-px h-8 bg-white/20" />
          <div><span className="text-white font-bold text-xl font-heading">5–6</span><br />Hours</div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full" />
        <div className="absolute -right-10 top-40 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute right-20 -bottom-10 w-64 h-64 bg-white/5 rounded-full" />
      </div>

      {/* Right — form */}
      <div className="flex-1 lg:max-w-md flex flex-col justify-center px-8 lg:px-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
            <BrainIcon />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 font-heading">PROMPT CHAMPIONSHIP</div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 font-heading mb-1">Participant Login</h1>
        <p className="text-gray-500 text-sm mb-8">Enter your team credentials to access the competition portal.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-heading">Team Code</label>
            <input
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              placeholder="e.g. PC5247"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-mono font-semibold text-gray-900 placeholder:text-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-heading">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Team password"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full py-3 mt-2"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </span>
            ) : (
              'Enter Competition →'
            )}
          </Button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-400">
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <div className="text-green-500 font-bold mb-0.5">✓</div>
              Device Verified
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <div className="text-green-500 font-bold mb-0.5">✓</div>
              Secure Session
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <div className="text-orange-500 font-bold mb-0.5">⏱</div>
              Timer Synced
            </div>
          </div>
        </div>
      </div>
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
