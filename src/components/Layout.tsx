import { useState, useEffect, useRef } from 'react';
import { useTimer } from '../hooks/useTimer';
import { supabase } from '../lib/supabase';
import {
  HomeIcon, TargetIcon, TrendingUpIcon, TrophyIcon, UsersIcon,
  FileTextIcon, MessageSquareIcon, BellIcon, HelpCircleIcon,
  CopyIcon, ChevronDownIcon, WifiOffIcon, BrainIcon, ShieldIcon, MenuIcon
} from './icons';
import { useTeamStore } from '../stores/teamStore';

export type Page = string;

interface NavItem {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  match?: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard',     label: 'Dashboard',    Icon: HomeIcon },
  { id: 'rounds',        label: 'Stages',       Icon: TargetIcon },
  { id: 'submissions',   label: 'Submissions',  Icon: FileTextIcon },
  { id: 'team',          label: 'Team',         Icon: UsersIcon },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard:         { title: 'Welcome back! 👋', subtitle: 'Think. Prompt. Solve. Win.' },
  rounds:            { title: 'Stages Overview', subtitle: '5 Stages. 5 Challenges. One Champion.' },
  'round1-briefing': { title: 'Stage 1: Genesis', subtitle: 'Foundation & Knowledge Assessment' },
  'round1-question': { title: 'Stage 1: Genesis', subtitle: 'Challenge in Progress' },
  'round1-review':   { title: 'Stage 1: Genesis', subtitle: 'Review Your Answers' },
  'round1-result':   { title: 'Stage 1: Genesis', subtitle: 'Stage Complete ✓' },
  'round2-briefing': { title: 'Stage 2: Node', subtitle: 'Algorithmic Prompt Crafting' },
  'round2-workspace':{ title: 'Stage 2: Node', subtitle: 'Prompt Workspace · Active Session' },
  'round2-result':   { title: 'Stage 2: Node', subtitle: 'Stage Complete ✓' },
  'round3-briefing': { title: 'Stage 3: Vertex', subtitle: 'Multi-Modal Visual Quest' },
  'round3-puzzles':  { title: 'Stage 3: Vertex', subtitle: 'Vision Challenge Matrix' },
  'round3-result':   { title: 'Stage 3: Vertex', subtitle: 'Stage Complete ✓' },
  'round4-briefing': { title: 'Stage 4: Matrix', subtitle: 'Adversarial Defense & Logic' },
  'round4-workspace':{ title: 'Stage 4: Matrix', subtitle: 'Security Protocol Testing' },
  'round4-evaluation':{ title: 'Stage 4: Matrix', subtitle: 'Automated Evaluation' },
  'round4-result':   { title: 'Stage 4: Matrix', subtitle: 'Stage Complete ✓' },
  'round5-brief':    { title: 'Stage 5: Apex', subtitle: 'Complex Systems & Architectural Synthesis' },
  'round5-workspace':{ title: 'Stage 5: Apex', subtitle: 'Systems Engineering Workspace' },
  'round5-submission':{ title: 'Stage 5: Apex', subtitle: 'Final Synthesis Submission' },
  'round5-evaluation':{ title: 'Stage 5: Apex', subtitle: 'Evaluation in Progress…' },
  submissions:       { title: 'Submission History', subtitle: 'Your submitted attempts' },
  'final-results':   { title: 'Final Results', subtitle: 'Championship complete 🏆' },
};

interface LayoutProps {
  page: Page;
  navigate: (p: Page) => void;
  children: React.ReactNode;
  offline?: boolean;
  onSessionAlert?: () => void;
}

export default function Layout({ page, navigate, children, offline, onSessionAlert }: LayoutProps) {
  const timer   = useTimer(5 * 3600 + 23 * 60 + 47); // We will update this later with server timer
  const [copied, setCopied]       = useState(false);
  const [teamOpen, setTeamOpen]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const navWrapperRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  
  const currentTeam = useTeamStore(s => s.currentTeam);
  const members = useTeamStore(s => s.members);

  const teamName = currentTeam?.name || 'Your Team';
  const teamCode = currentTeam?.access_code || '------';
  const membersCount = members?.length || 0;
  const teamInitials = teamName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const dynamicTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard:         { title: `Welcome back, ${teamName}! 👋`, subtitle: 'Think. Prompt. Solve. Win.' },
    team:              { title: 'Team', subtitle: `${teamName} — ${membersCount} Members` },
  };

  const info = dynamicTitles[page] ?? pageTitles[page] ?? { title: 'HAPPENO TECHNOLOGIES', subtitle: 'Think. Prompt. Solve. Win.' };

  /* scroll-aware header */
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(teamCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isActive = (item: NavItem) => {
    if (item.match) return item.match.some(m => page === m || page.startsWith(m + '-'));
    return page === item.id;
  };

  const [activeAnnouncement, setActiveAnnouncement] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Check for any currently active global announcements
    const checkActiveAnnouncements = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .in('scope', ['GLOBAL', 'TEAM'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        // Simple filter: if scope is TEAM, make sure it matches current team (assuming scope_target_id)
        const ann = data[0];
        if (ann.scope === 'TEAM' && ann.scope_target_id !== currentTeam?.id) return;
        setActiveAnnouncement(ann);
      }
    };
    checkActiveAnnouncements();

    // Subscribe to announcements
    const channel = supabase.channel('public:announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload: any) => {
        if (payload.new && payload.new.is_active) {
          if (payload.new.scope === 'GLOBAL' || (payload.new.scope === 'TEAM' && payload.new.scope_target_id === currentTeam?.id)) {
            setActiveAnnouncement(payload.new);
          }
        } else if (payload.new && !payload.new.is_active && activeAnnouncement?.id === payload.new.id) {
          setActiveAnnouncement(null);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentTeam, activeAnnouncement]);

  useEffect(() => {
    const updateIndicator = () => {
      if (!navWrapperRef.current) return;
      setTimeout(() => {
        const activeBtn = navWrapperRef.current?.querySelector('[data-active="true"]') as HTMLElement;
        if (activeBtn) {
          setIndicator({
            left: activeBtn.offsetLeft,
            width: activeBtn.offsetWidth,
            opacity: 1
          });
        } else {
          setIndicator(prev => ({ ...prev, opacity: 0 }));
        }
      }, 50);
    };
    
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [page]);

  const urgent = parseInt(timer.hours) === 0 && parseInt(timer.minutes) < 10;

  return (
    <div className="flex h-full bg-[#FAF7F2] dot-bg overflow-hidden flex-col">
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-black text-center flex items-center justify-center gap-2 z-[100] border-b-2 border-[#111111] animate-slide-down">
          <WifiOffIcon className="w-4 h-4" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            OFFLINE MODE: Submissions will fail until connection is restored.
          </span>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden relative flex-col">

        {/* Top nav */}
        <header
          style={{
            background: "#FAF7F2",
            borderBottom: "2.5px solid #111111",
          }}
          className={`
            px-6 h-[68px] flex items-center gap-4 flex-shrink-0 relative z-50
            transition-all duration-200
            ${scrolled ? 'shadow-md' : ''}
          `}
        >
          {/* Logo & Title */}
          <div className="flex-1 min-w-0 flex items-center gap-4 sm:gap-5">
            <button
              onClick={() => navigate('dashboard')}
              className="flex items-center gap-2.5 group flex-shrink-0 cursor-pointer"
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  background: "#FF5C00",
                  border: "2px solid #111111",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "2.5px 2.5px 0 #111111",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 900,
                    fontSize: 14,
                    color: "#FAF7F2",
                  }}
                >
                  Pf
                </span>
              </div>
              <div className="leading-none text-left hidden sm:block">
                <span
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 900,
                    fontSize: 20,
                    color: "#111111",
                  }}
                >
                  Promptify<span style={{ color: "#FF5C00" }}>.</span>
                </span>
              </div>
            </button>
            <div className="w-[2px] h-7 bg-[#111111] opacity-15 hidden md:block" />
            <div className="hidden md:block">
              <h1
                style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16, color: "#111111" }}
                className="truncate leading-tight"
              >
                {info.title}
              </h1>
              <p
                style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, color: "#111111", opacity: 0.6 }}
                className="truncate leading-none mt-0.5"
              >
                {info.subtitle}
              </p>
            </div>
          </div>

          {/* ── Right cluster ── */}
          <div className="flex items-center gap-3 flex-shrink-0">

            {/* Team Code */}
            <div
              style={{
                background: "#FFFFFF",
                border: "2px solid #111111",
                borderRadius: 12,
                boxShadow: "2.5px 2.5px 0 #111111",
                padding: "4px 12px",
              }}
              className="hidden sm:flex items-center gap-2"
            >
              <div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    fontWeight: 800,
                    color: "#777",
                    letterSpacing: "0.08em",
                  }}
                >
                  TEAM CODE
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#FF5C00",
                    }}
                  >
                    {teamCode}
                  </span>
                  <button
                    onClick={copy}
                    title="Copy code"
                    className="text-[#111111] hover:text-[#FF5C00] transition-colors cursor-pointer hover:scale-110"
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                  </button>
                  {copied && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#2FE69A",
                      }}
                    >
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>


            {/* Team Dropdown */}
            <div className="relative">
              <button
                onClick={() => setTeamOpen(o => !o)}
                style={{
                  background: "#FFD027",
                  border: "2px solid #111111",
                  borderRadius: 12,
                  boxShadow: "2.5px 2.5px 0 #111111",
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
                className="flex items-center gap-2 group hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    background: "#111111",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FAF7F2",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 900,
                    fontSize: 11,
                  }}
                >
                  {teamInitials}
                </div>
                <div className="text-left hidden sm:block">
                  <div
                    style={{
                      fontFamily: "'Nunito', sans-serif",
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#111111",
                      lineHeight: 1.1,
                    }}
                  >
                    {teamName}
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#111111",
                      opacity: 0.8,
                    }}
                    className="flex items-center gap-1"
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#2FE69A",
                        display: "inline-block",
                        border: "1px solid #111111",
                      }}
                    />
                    {membersCount} online
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-[#111111] transition-transform duration-200 ${teamOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {teamOpen && (
                <div
                  style={{
                    background: "#FAF7F2",
                    border: "2.5px solid #111111",
                    borderRadius: 18,
                    boxShadow: "5px 5px 0 #111111",
                  }}
                  className="absolute right-0 top-full mt-2 w-60 py-2 animate-scale-in origin-top-right z-50"
                >
                  <div className="px-4 py-2.5 border-b-[2px] border-[#111111]/10">
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#777",
                        textTransform: "uppercase",
                      }}
                    >
                      Active Session
                    </div>
                    <div
                      style={{
                        fontFamily: "'Nunito', sans-serif",
                        fontWeight: 900,
                        fontSize: 15,
                        color: "#111111",
                      }}
                    >
                      {teamName}
                    </div>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    {members.map(m => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/5 transition-colors"
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#2FE69A",
                            border: "1px solid #111111",
                            flexShrink: 0,
                          }}
                        />
                        <div className="flex-1">
                          <div
                            style={{
                              fontFamily: "'Nunito', sans-serif",
                              fontWeight: 800,
                              fontSize: 13,
                              color: "#111111",
                            }}
                          >
                            {m.name}
                          </div>
                          <div
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: "#777",
                            }}
                          >
                            {m.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t-[2px] border-[#111111]/10 px-4 py-2.5 space-y-1">
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#111111",
                      }}
                    >
                      ✓ Device Verified
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#111111",
                      }}
                    >
                      ✓ Team Session Active
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#111111",
                      }}
                    >
                      ✓ Secure Connection
                    </div>
                  </div>
                  <div className="border-t-[2px] border-[#111111]/10 p-2 space-y-1">
                    <button 
                      onClick={() => navigate('admin')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#111111] hover:bg-[#FFD027] transition-colors flex items-center gap-2 border border-transparent hover:border-[#111111]"
                    >
                      <span>🛡️</span> Switch to Admin
                    </button>
                    <button 
                      onClick={async () => { 
                        await supabase.auth.signOut();
                        localStorage.removeItem('authState'); 
                        window.location.reload(); 
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border border-transparent hover:border-red-600"
                    >
                      <span>🚪</span> Logout
                    </button>
                  </div>
                  {onSessionAlert && (
                    <div className="border-t-[2px] border-[#111111]/10 px-4 py-2">
                      <button
                        onClick={() => { setTeamOpen(false); onSessionAlert(); }}
                        className="text-[11px] text-amber-700 font-extrabold hover:underline"
                      >
                        ⚠ View session alert
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Offline banner */}
        {offline && (
          <div className="bg-[#FF5C00] border-b-[2.5px] border-[#111111] px-6 py-2.5 flex items-center gap-2.5 flex-shrink-0 animate-slide-down text-[#FAF7F2]">
            <WifiOffIcon className="w-4 h-4 flex-shrink-0" />
            <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13 }}>
              Connection lost — your work is safely stored locally.
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="ml-2 opacity-90">
              Reconnecting…
            </span>
          </div>
        )}

        {/* Page content with scroll */}
        <main ref={mainRef} className="flex-1 overflow-auto">
          {children}
        </main>

      {/* Click-away for team dropdown */}
      {teamOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setTeamOpen(false)} />
      )}

      {/* Global Announcement Overlay */}
      {activeAnnouncement && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-6 sm:p-12 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl border-2 overflow-hidden w-full max-w-lg pointer-events-auto animate-slide-down relative flex flex-col" style={{ borderColor: activeAnnouncement.severity === 'URGENT' ? '#ef4444' : activeAnnouncement.severity === 'WARNING' ? '#f59e0b' : '#3b82f6' }}>
            <div className={`px-5 py-3 border-b text-white font-bold font-heading flex items-center justify-between ${
              activeAnnouncement.severity === 'URGENT' ? 'bg-red-500 border-red-600' : activeAnnouncement.severity === 'WARNING' ? 'bg-amber-500 border-amber-600' : 'bg-blue-500 border-blue-600'
            }`}>
              <div className="flex items-center gap-2">
                <BellIcon className="w-5 h-5 animate-pulse" />
                <span>{activeAnnouncement.severity === 'URGENT' ? 'URGENT ALERT' : activeAnnouncement.severity === 'WARNING' ? 'WARNING' : 'ANNOUNCEMENT'}</span>
              </div>
              <button onClick={() => setActiveAnnouncement(null)} className="text-white/80 hover:text-white">&times;</button>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-black text-gray-900 font-heading mb-2">{activeAnnouncement.title}</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{activeAnnouncement.message}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setActiveAnnouncement(null)} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors">
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
