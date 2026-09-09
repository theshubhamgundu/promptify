import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { TeamService } from '../lib/services/teamService';
import { EventService } from '../lib/services/eventService';
import { LockIcon } from '../components/icons';
import { Toast } from '../components/ui';

export default function Login({ onLogin, onBackToHome }: { onLogin: (isAdmin: boolean) => void; onBackToHome?: () => void }) {
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
      const loginEmail = teamCode.includes('@') ? teamCode : `${teamCode.toLowerCase()}@example.com`;
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (authError) throw authError;
      
      if (data.session) {
        setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        
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
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 dot-bg" style={{ background: "#FAF7F2" }}>
      {/* Background blobs for depth */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="xMidYMid slice">
        <ellipse cx="10%" cy="20%" rx="200" ry="150" fill="#B57CFF" opacity="0.1" />
        <ellipse cx="90%" cy="80%" rx="250" ry="200" fill="#2FE69A" opacity="0.1" />
        <ellipse cx="50%" cy="50%" rx="300" ry="200" fill="#FFD027" opacity="0.05" />
      </svg>

      {/* Back to Home (top left) */}
      {onBackToHome && (
        <button
          onClick={onBackToHome}
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            background: "#FFFFFF",
            border: "2.5px solid #111111",
            borderRadius: 999,
            boxShadow: "4px 4px 0 #111111",
            padding: "8px 16px",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 800,
            fontSize: 13,
            color: "#111111",
            zIndex: 20,
            cursor: "pointer",
          }}
          className="flex items-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0px_0px_0_#111111] transition-all"
        >
          <span className="text-xl leading-none rotate-180 mb-[2px]">➔</span>
          <span>Homepage</span>
        </button>
      )}

      {/* Login Card */}
      <div 
        className="relative z-10 w-full max-w-[440px] animate-slide-up"
        style={{
          background: "#FFFFFF",
          border: "3px solid #111111",
          borderRadius: 24,
          boxShadow: "8px 8px 0 #111111",
          padding: "32px",
        }}
      >
        {/* Header / Logo */}
        <div className="flex items-center gap-4 mb-8">
          <div 
            style={{
              width: 56, height: 56,
              background: "#FF5C00",
              border: "3px solid #111111",
              borderRadius: 16,
              boxShadow: "3px 3px 0 #111111",
            }}
            className="flex items-center justify-center flex-shrink-0"
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 22, color: "#FAF7F2" }}>
              Pf
            </span>
          </div>
          <div>
            <h1 
              style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: "#111111" }}
              className="text-2xl leading-tight uppercase tracking-tight"
            >
              Participant<br/>Login
            </h1>
          </div>
        </div>

        <p 
          style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, color: "#111111" }}
          className="text-sm opacity-80 mb-8"
        >
          Enter your team credentials to access the competition portal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label 
              style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: "#111111" }}
              className="block text-sm uppercase tracking-wide mb-2"
            >
              Team Code
            </label>
            <input
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              placeholder="e.g. PC5247"
              className="w-full px-4 py-3 outline-none transition-all placeholder:text-[#111111]/30 uppercase focus:bg-white"
              style={{
                background: "#FAF7F2",
                border: "2.5px solid #111111",
                borderRadius: 12,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: "#111111",
                boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.05)",
              }}
              required
            />
          </div>
          
          <div>
            <label 
              style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: "#111111" }}
              className="block text-sm uppercase tracking-wide mb-2"
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 outline-none transition-all placeholder:text-[#111111]/30 focus:bg-white"
              style={{
                background: "#FAF7F2",
                border: "2.5px solid #111111",
                borderRadius: 12,
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                color: "#111111",
                boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.05)",
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 transition-all group disabled:opacity-50 disabled:cursor-not-allowed mt-4 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0px_0px_0_#111111]"
            style={{
              background: "#2FE69A",
              border: "3px solid #111111",
              borderRadius: 14,
              boxShadow: "4px 4px 0 #111111",
              padding: "14px",
              cursor: "pointer",
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: "#111111", fontSize: 16, textTransform: "uppercase" }}>
                <svg className="animate-spin w-5 h-5 text-[#111111]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </span>
            ) : (
              <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: "#111111", fontSize: 16, textTransform: "uppercase" }}>
                  Enter Arena
                </span>
                <span className="text-xl leading-none text-[#111111] font-black">➔</span>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setTeamCode('test1234');
              setPassword('TeamPassword123!');
              setTimeout(() => {
                const form = (e.target as HTMLElement).closest('form');
                if (form) form.requestSubmit();
              }, 50);
            }}
            className="w-full flex items-center justify-center transition-all mt-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0px_0px_0_#111111]"
            style={{
              background: "#FFD027",
              border: "2.5px solid #111111",
              borderRadius: 12,
              boxShadow: "2px 2px 0 #111111",
              padding: "10px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, color: "#111111", fontSize: 13, textTransform: "uppercase" }}>
              Quick Login (TEST1234)
            </span>
          </button>
        </form>

        <div className="mt-8 pt-6 border-t-[3px] border-[#111111] grid grid-cols-3 gap-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-[#2FE69A] border-[2.5px] border-[#111111] flex items-center justify-center mb-1">
              <span className="text-[#111111] font-black text-sm">✓</span>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 10, color: "#111111", textTransform: "uppercase" }}>Verified</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-[#B57CFF] border-[2.5px] border-[#111111] flex items-center justify-center mb-1">
              <LockIcon className="w-4 h-4 text-[#111111]" />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 10, color: "#111111", textTransform: "uppercase" }}>Secure</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-[#FF5C00] border-[2.5px] border-[#111111] flex items-center justify-center mb-1 text-white">
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 11 }}>⏱</span>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 10, color: "#111111", textTransform: "uppercase" }}>Synced</span>
          </div>
        </div>
      </div>
      
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
