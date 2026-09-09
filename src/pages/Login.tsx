import { useState } from 'react';
import { Toast } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { TeamService } from '../lib/services/teamService';
import { EventService } from '../lib/services/eventService';

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
    <div className="min-h-screen bg-[#FAF7F2] dot-bg flex flex-col lg:flex-row overflow-x-hidden">
      {/* ── Left Branding Panel ─────────────────────────────────── */}
      <div
        style={{
          background: "#FF5C00",
        }}
        className="flex-1 lg:border-r-[3px] border-[#111111] relative overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-16 min-h-[420px] lg:min-h-screen"
      >
        {/* Background Depth Ornaments matching homepage */}
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-white/[0.08] pointer-events-none" />
        <div className="absolute top-[28%] -right-24 w-[420px] h-[420px] rounded-full bg-white/[0.07] pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-[460px] h-[460px] rounded-full bg-black/[0.06] pointer-events-none" />
        <div className="absolute bottom-1/3 left-10 w-72 h-72 rounded-full bg-white/[0.04] pointer-events-none" />

        {/* Top Logo — Promptify */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                background: "#FAF7F2",
                border: "2.5px solid #111111",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "3px 3px 0 #111111",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 900,
                  fontSize: 16,
                  color: "#FF5C00",
                }}
              >
                Pf
              </span>
            </div>
            <div>
              <span
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 900,
                  fontSize: 24,
                  color: "#FAF7F2",
                }}
              >
                Promptify<span style={{ color: "#FFD027" }}>.</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center Big Headline */}
        <div className="my-auto py-10 lg:py-0 relative z-10">
          <h1
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
            className="text-[#FAF7F2] text-5xl sm:text-6xl xl:text-7xl"
          >
            Think.<br />
            Prompt.<br />
            Solve.<br />
            Win.
          </h1>
          <p
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 700,
            }}
            className="text-[#FAF7F2] text-base sm:text-lg opacity-90 mt-5 max-w-sm leading-relaxed"
          >
            A battle of creativity, logic, and AI mastery.
          </p>

          {/* Technique chips matching homepage */}
          <div className="flex flex-wrap gap-2 pt-6">
            {[
              { text: "zero-shot", bg: "#2FE69A", fg: "#111111" },
              { text: "few-shot", bg: "#B57CFF", fg: "#111111" },
              { text: "chain-of-thought", bg: "#FFD027", fg: "#111111" },
              { text: "RAG", bg: "#FAF7F2", fg: "#111111" },
            ].map((t) => (
              <span
                key={t.text}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  fontSize: 11,
                  background: t.bg,
                  color: t.fg,
                  border: "2px solid #111111",
                  borderRadius: 999,
                  padding: "4px 12px",
                  boxShadow: "2.5px 2.5px 0 #111111",
                }}
              >
                {t.text}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom decorative anchor tag */}
        <div className="relative z-10 pt-4">
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              color: "#FAF7F2",
              opacity: 0.75,
              letterSpacing: "0.08em",
            }}
          >
            PROMPT CHAMPIONSHIP 2026
          </span>
        </div>
      </div>

      {/* ── Right Login Form ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-12 bg-[#FAF7F2] dot-bg relative overflow-y-auto">
        <div className="w-full max-w-[440px] flex flex-col">
          {/* Back to Homepage */}
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 800,
                fontSize: 13,
                color: "#111111",
                background: "#FAF7F2",
                border: "2px solid #111111",
                borderRadius: 999,
                padding: "8px 18px",
                boxShadow: "3px 3px 0 #111111",
                cursor: "pointer",
              }}
              className="self-start mb-6 inline-flex items-center gap-2 hover:translate-x-[-2px] transition-transform"
            >
              <span className="text-base leading-none">←</span>
              <span>Back to Homepage</span>
            </button>
          )}

          {/* Form Card */}
          <div
            className="w-full shadow-hard"
            style={{
              background: "#FAF7F2",
              border: "2.5px solid #111111",
              borderRadius: 22,
              padding: "36px 30px",
            }}
          >
            {/* Heading */}
            <h2
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 900,
                fontSize: 30,
                color: "#111111",
              }}
              className="tracking-tight mb-2"
            >
              Participant Login
            </h2>
            <p
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: "#111111",
                opacity: 0.7,
              }}
              className="mb-7 leading-normal"
            >
              Enter your team credentials to access the competition portal.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 800,
                    fontSize: 13,
                    color: "#111111",
                  }}
                  className="block mb-1.5"
                >
                  Team Code
                </label>
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PC5247"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111111",
                    background: "#FFFFFF",
                    border: "2px solid #111111",
                    borderRadius: 12,
                    boxShadow: "2px 2px 0 #111111",
                  }}
                  className="w-full px-4 py-3 outline-none focus:border-[#FF5C00] transition-colors"
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 800,
                    fontSize: 13,
                    color: "#111111",
                  }}
                  className="block mb-1.5"
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Team password"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#111111",
                    background: "#FFFFFF",
                    border: "2px solid #111111",
                    borderRadius: 12,
                    boxShadow: "2px 2px 0 #111111",
                  }}
                  className="w-full px-4 py-3 outline-none focus:border-[#FF5C00] transition-colors"
                  required
                />
              </div>

              {/* Enter Competition Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-orange w-full"
                style={{
                  justifyContent: "center",
                  fontSize: 15,
                  padding: "14px",
                  marginTop: 8,
                  borderRadius: 14,
                  boxShadow: "3px 3px 0 #111111",
                }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-[#FAF7F2]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  'Enter Competition →'
                )}
              </button>

              {/* Quick Login Button */}
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
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  background: "#FFD027",
                  color: "#111111",
                  border: "2px solid #111111",
                  borderRadius: 14,
                  padding: "10px 16px",
                  boxShadow: "3px 3px 0 #111111",
                  cursor: "pointer",
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              >
                ⚡ Quick Login (test1234)
              </button>
            </form>
          </div>
        </div>
      </div>
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
