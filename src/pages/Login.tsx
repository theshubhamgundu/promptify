import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { TeamService } from '../lib/services/teamService';
import { EventService } from '../lib/services/eventService';
import { Toast } from '../components/ui';

interface LoginProps {
  onLogin: (isAdmin: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [teamCode, setTeamCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

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
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-[#070707] text-white flex flex-col justify-between selection:bg-[#ff5500] selection:text-black relative">
      
      {/* Background Grid Lines */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      {/* Top Navigation / Logo Bar */}
      <header className="relative z-30 px-6 sm:px-10 pt-3.5 sm:pt-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3.5 group cursor-pointer">
          <div className="relative">
            <img 
              src="/assets/logo.png" 
              alt="Prompt Championship" 
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-contain border border-white/20 p-1 bg-black/40 shadow-sm transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="leading-tight">
            <div className="font-display text-white text-sm sm:text-base tracking-wider flex items-center gap-1.5">
              PROMPT
              <span className="px-1.5 py-0.2 bg-[#ff5500] text-black text-[9px] font-black rounded tracking-widest uppercase">PRO</span>
            </div>
            <div className="font-display text-white/90 text-xs sm:text-sm tracking-wider">CHAMPIONSHIP</div>
          </div>
        </div>

        {/* Circular Stamp / Seal in Top Right Corner */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 transform rotate-12 hover:rotate-180 transition-transform duration-700 select-none cursor-pointer">
          <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-md">
            {/* Outer dotted/dashed stamp border */}
            <circle cx="50" cy="50" r="45" fill="#fcfaf4" stroke="#000000" strokeWidth="2.5" strokeDasharray="3,2" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#000000" strokeWidth="1.2" />

            {/* Curving Text Path */}
            <path id="headerStampTextPath" d="M 50,50 m -30,0 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0" fill="none" />
            <text fontSize="7.5" fontWeight="900" letterSpacing="2.5" fill="#000" className="font-space">
              <textPath href="#headerStampTextPath" startOffset="0%">
                • THINK • PROMPT • SOLVE • WIN
              </textPath>
            </text>

            {/* Center Orange Brain Icon */}
            <g transform="translate(38, 38)">
              <circle cx="12" cy="12" r="10" fill="#ff5500" />
              <path d="M8 12 Q 12 8 16 12 Q 12 16 8 12" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="relative z-20 flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 py-1 sm:py-2 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center overflow-hidden">
        
        {/* Left Column: Typography & Action Trigger */}
        <div className="lg:col-span-6 flex flex-col justify-center py-1">
          
          {/* Large Hero Title */}
          <div className="relative mb-3 sm:mb-4">
            <h1 className="font-display text-[48px] sm:text-[68px] lg:text-[80px] leading-[0.86] tracking-tight uppercase select-none">
              <span className="text-white block hover:translate-x-1 transition-transform">THINK.</span>
              <span className="text-[#ff5500] block hover:translate-x-1 transition-transform">PROMPT.</span>
              <span className="text-white block hover:translate-x-1 transition-transform">SOLVE.</span>
              <span className="text-[#ff5500] block hover:translate-x-1 transition-transform">WIN.</span>
            </h1>
          </div>

          {/* Subtitle with High Contrast Callout */}
          <p className="text-gray-300 text-xs sm:text-sm max-w-md font-space leading-relaxed mb-6 sm:mb-8">
            The ultimate championship for creators, coders and AI thinkers.{' '}
            <span className="text-[#ff5500] font-bold underline decoration-[#ff5500]/50 underline-offset-4">One precision prompt</span> can dominate the leaderboard.
          </p>

          {/* Action Button: Let's Cook 🔥 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[#ff5500] hover:bg-[#ff681a] text-black font-space font-black text-sm sm:text-base tracking-wider uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0 cursor-pointer border-2 border-black"
            >
              <span>LET'S COOK 🔥</span>
              <span className="text-base sm:text-lg transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1">↗</span>
            </button>

            {/* Quick Helper Tag */}
            <div className="hidden sm:flex flex-col text-[10px] text-gray-400 font-space leading-tight">
              <span className="text-white font-bold">Participant Portal</span>
              <span>Click to authenticate & enter</span>
            </div>
          </div>
        </div>

        {/* Right Column: Enlarged Prompt Workspace Illustration */}
        <div className="lg:col-span-6 relative flex items-center justify-center h-[410px] sm:h-[490px] lg:h-[530px]">
          
          {/* Main Visual: Enlarged Transparent Prompt Workspace Cutout */}
          <div className="relative w-full h-full flex items-center justify-center select-none pointer-events-none overflow-visible">
            <img 
              src="/assets/prompt-workspace-transparent.png" 
              alt="Prompt Engineering Workspace" 
              className="w-full h-full max-h-[580px] object-contain scale-115 sm:scale-130 lg:scale-135 transition-transform duration-700 hover:scale-140"
            />
          </div>

        </div>
      </main>

      {/* Challenge at a Glance Banner Footer */}
      <footer className="relative z-20 w-full bg-[#f0ebe3] text-black border-t-2 border-black/80 px-4 sm:px-8 lg:px-12 py-2 sm:py-3 flex items-center justify-between flex-shrink-0 shadow-lg select-none">
        <div className="flex items-center w-full justify-between max-w-7xl mx-auto overflow-x-auto scrollbar-none gap-2 sm:gap-4">
          
          {/* Section 1: The Challenge at a Glance */}
          <div className="flex flex-col justify-center flex-shrink-0 pr-2">
            <div className="font-display text-[11px] sm:text-xs lg:text-sm text-black uppercase leading-[1.1] tracking-tight">
              THE CHALLENGE
            </div>
            <div className="font-display text-[11px] sm:text-xs lg:text-sm text-black uppercase leading-[1.1] tracking-tight">
              AT A GLANCE
            </div>
            {/* Wavy Underline */}
            <svg viewBox="0 0 60 12" className="w-14 sm:w-16 h-2.5 text-black mt-0.5">
              <path d="M2 7 C 8 2, 14 12, 20 7 C 26 2, 32 12, 38 7 C 44 2, 50 12, 58 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Divider */}
          <div className="h-8 sm:h-10 w-px bg-black/25 flex-shrink-0" />

          {/* Section 2: 5 ROUNDS */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 sm:px-4">
            <span className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#ff5500] leading-none">
              5
            </span>
            <span className="font-space font-extrabold text-[9px] sm:text-[11px] uppercase tracking-wider text-black underline underline-offset-2">
              ROUNDS
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 sm:h-10 w-px bg-black/25 flex-shrink-0" />

          {/* Section 3: 1100 MAX POINTS */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 sm:px-4">
            <span className="font-display text-2xl sm:text-3xl lg:text-4xl text-black leading-none">
              1100
            </span>
            <span className="font-space font-extrabold text-[9px] sm:text-[11px] uppercase tracking-wider text-black underline underline-offset-2">
              MAX POINTS
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 sm:h-10 w-px bg-black/25 flex-shrink-0" />

          {/* Section 4: 6 HOURS */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 sm:px-4">
            <span className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#ff5500] leading-none">
              6
            </span>
            <span className="font-space font-extrabold text-[9px] sm:text-[11px] uppercase tracking-wider text-black underline underline-offset-2">
              HOURS
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 sm:h-10 w-px bg-black/25 flex-shrink-0" />

          {/* Section 5: BIG IDEAS. BIGGER IMPACT. Badge + Doodle Arrow */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-2">
            <div className="bg-[#111111] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-md transform -rotate-1 border border-black">
              <div className="font-display text-[9px] sm:text-[11px] text-white tracking-wide uppercase leading-tight">
                BIG IDEAS.
              </div>
              <div className="font-display text-[9px] sm:text-[11px] text-[#ff5500] tracking-wide uppercase leading-tight">
                BIGGER IMPACT.
              </div>
            </div>

            {/* Hand-drawn arrow */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 text-black transform rotate-12 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 C 10 18, 14 12, 17 6" />
              <path d="M12 5 L 18 5 L 18 11" />
            </svg>
          </div>

        </div>
      </footer>

      {/* Participant Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div 
            className="relative w-full max-w-md bg-[#121212] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(255,85,0,0.25)] text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <img 
                src="/assets/logo.png" 
                alt="Prompt Championship" 
                className="w-12 h-12 object-contain drop-shadow-md" 
              />
              <div>
                <h2 className="font-display text-xl tracking-tight uppercase">PARTICIPANT LOGIN</h2>
                <p className="text-xs text-gray-400 font-space">Enter credentials to unlock the battleground</p>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-space font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  Team Code / Email
                </label>
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PC5247"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/15 focus:border-[#ff5500] focus:ring-1 focus:ring-[#ff5500] rounded-xl text-sm font-mono font-semibold text-white placeholder:text-gray-600 outline-none transition-all"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-space font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/15 focus:border-[#ff5500] focus:ring-1 focus:ring-[#ff5500] rounded-xl text-sm text-white placeholder:text-gray-600 outline-none transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-4 bg-[#ff5500] hover:bg-[#ff6a1f] text-black font-space font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-[#ff5500]/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>ENTER COMPETITION</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-500 font-space">
              <span>PORTAL ACTIVE</span>
              <span>LIVE SYSTEM</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
