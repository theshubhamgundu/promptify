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
    <div className="flex h-full bg-[#f9f7f4] overflow-hidden flex-col">
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-bold text-center flex items-center justify-center gap-2 z-[100] animate-slide-down">
          <WifiOffIcon className="w-4 h-4" />
          <span>You are currently offline. Submissions will fail until connection is restored.</span>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden relative flex-col">

        {/* Top nav */}
        <header
          className={`
            bg-white border-b px-6 h-[68px] flex items-center gap-4 flex-shrink-0 relative z-50
            transition-all duration-200
            ${scrolled ? 'border-gray-200 shadow-sm' : 'border-gray-100 shadow-none'}
          `}
        >
          {/* Logo & Title */}
          <div className="flex-1 min-w-0 flex items-center gap-5">
            <button
              onClick={() => navigate('dashboard')}
              className="flex items-center gap-2.5 group flex-shrink-0"
            >
              <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-200/60 group-hover:scale-105 transition-transform duration-200">
                <BrainIcon />
              </div>
              <div className="leading-none text-left hidden sm:block">
                <div className="text-[13px] font-black text-gray-900 font-heading tracking-wide">PROMPT</div>
                <div className="text-[11px] font-black text-orange-500 font-heading tracking-wider">CHAMPIONSHIP</div>
              </div>
            </button>
            <div className="w-px h-8 bg-gray-100 hidden md:block" />
            <div className="hidden md:block">
              <h1 className="text-[17px] font-bold text-gray-900 font-heading truncate leading-tight">{info.title}</h1>
              <p className="text-[11px] text-gray-400 truncate leading-none mt-0.5">{info.subtitle}</p>
            </div>
          </div>

          {/* ── Right cluster ── */}
          <div className="flex items-center gap-0 flex-shrink-0">

            {/* Team Code */}
            <div className="px-4 text-center">
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mb-0.5 font-heading">Team Code</div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-orange-500 font-heading tracking-wider">{teamCode}</span>
                <button
                  onClick={copy}
                  title="Copy code"
                  className="text-gray-300 hover:text-orange-500 transition-colors duration-150 hover:scale-110"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                </button>
                {copied && (
                  <span className="text-[10px] text-green-600 font-semibold animate-fade-in">Copied!</span>
                )}
              </div>
            </div>

            <div className="w-px h-9 bg-gray-100" />

            {/* Timer */}
            <div className="px-4 text-center">
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mb-0.5 font-heading">Event Timer</div>
              <div
                className={`
                  font-mono text-[15px] font-bold tabular-nums leading-none
                  transition-colors duration-500
                  ${urgent ? 'text-red-500' : 'text-gray-900'}
                `}
              >
                {timer.hours}
                <span className="opacity-25 mx-0.5 text-sm">:</span>
                {timer.minutes}
                <span className="opacity-25 mx-0.5 text-sm">:</span>
                {timer.seconds}
              </div>
            </div>

            <div className="w-px h-9 bg-gray-100" />

            {/* Team */}
            <div className="pl-4 relative">
              <button
                onClick={() => setTeamOpen(o => !o)}
                className="flex items-center gap-2 group"
              >
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-200 group-hover:scale-105 transition-transform">
                  <span className="text-white text-xs font-black font-heading">{teamInitials}</span>
                </div>
                <div className="text-left">
                  <div className="text-[13px] font-bold text-gray-900 font-heading leading-tight">{teamName}</div>
                  <div className="text-[11px] text-gray-400 leading-none flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 live-dot" />
                    {membersCount} online
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${teamOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {teamOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl w-52 py-2 animate-scale-in origin-top-right z-50">
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide font-heading">Active Session</div>
                    <div className="font-bold text-gray-900 font-heading">{teamName}</div>
                  </div>
                  <div className="px-3 py-2 space-y-1">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800">{m.name}</div>
                          <div className="text-[10px] text-gray-400">{m.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-50 px-4 py-2.5 space-y-1">
                    <div className="text-[11px] text-green-600 font-medium">✓ Device Verified</div>
                    <div className="text-[11px] text-green-600 font-medium">✓ Team Session Active</div>
                    <div className="text-[11px] text-green-600 font-medium">✓ Secure Connection</div>
                  </div>
                  <div className="border-t border-gray-50 p-2 space-y-1">
                    <button 
                      onClick={() => navigate('admin')}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-base">🛡️</span> Switch to Admin
                    </button>
                    <button 
                      onClick={async () => { 
                        await supabase.auth.signOut();
                        localStorage.removeItem('authState'); 
                        window.location.reload(); 
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-base">🚪</span> Logout
                    </button>
                  </div>
                  {onSessionAlert && (
                    <div className="border-t border-gray-50 px-4 py-2">
                      <button
                        onClick={() => { setTeamOpen(false); onSessionAlert(); }}
                        className="text-[11px] text-amber-600 font-semibold hover:underline"
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
          <div className="animated-gradient border-b border-red-200 px-6 py-2.5 flex items-center gap-2.5 flex-shrink-0 animate-slide-down">
            <WifiOffIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-red-800 text-sm font-semibold">
              Connection lost — your work is safely stored locally.
            </span>
            <span className="text-red-600 text-sm ml-1 flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Reconnecting…
            </span>
          </div>
        )}

        {/* Page content with scroll */}
        <main ref={mainRef} className="flex-1 overflow-auto pb-24">
          {children}
        </main>

        {/* ── Floating Bottom Navigation ─────────────────────────────────────── */}
        <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 h-[64px] bg-white border border-gray-100 rounded-2xl flex items-center justify-center px-2 sm:px-4 z-50 shadow-xl shadow-gray-200/50">
          {/* Nav Items */}
          <div ref={navWrapperRef} className="flex items-center gap-2 max-w-2xl w-full justify-between sm:justify-center sm:gap-4 md:gap-6 relative h-full">
            
            {/* Sliding Background Indicator (Desktop) */}
            <div 
              className="absolute hidden sm:block top-1/2 -translate-y-1/2 h-10 bg-orange-500 rounded-xl transition-all duration-300 ease-out z-0 shadow-sm shadow-orange-200/50"
              style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
            />
            {/* Sliding Bottom Bar (optional extra flair, darker orange) */}
            <div 
              className="absolute bottom-1 h-[3px] bg-orange-600 rounded-full transition-all duration-300 ease-out z-0"
              style={{ left: indicator.left + (indicator.width * 0.25), width: indicator.width * 0.5, opacity: indicator.opacity }} 
            />

            {navItems.map((item, idx) => {
              const active = isActive(item);
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  title={item.label}
                  data-active={active}
                  className={`
                    flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 sm:px-4 sm:py-2.5 h-full sm:h-auto rounded-xl text-xs sm:text-sm font-medium
                    transition-colors duration-300 relative group w-full sm:w-auto z-10
                    ${active ? 'text-white' : 'text-gray-500 hover:text-orange-500 sm:hover:bg-orange-50'}
                  `}
                >
                  <item.Icon className={`w-5 h-5 sm:w-[18px] sm:h-[18px] flex-shrink-0 relative z-10 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'} mb-1 sm:mb-0`} />
                  <span className="font-heading relative z-10 transition-colors whitespace-nowrap">{item.label}</span>
                  
                  {item.badge && !active && (
                    <span className="absolute top-0 right-1/4 sm:top-2 sm:right-2 w-2 h-2 bg-orange-500 rounded-full border border-white z-10" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

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
