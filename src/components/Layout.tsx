import { useState, useEffect, useRef } from 'react';
import { useTimer } from '../hooks/useTimer';
import { supabase } from '../lib/supabase';
import {
  HomeIcon, TargetIcon, TrendingUpIcon, TrophyIcon, UsersIcon,
  FileTextIcon, MessageSquareIcon, BellIcon, HelpCircleIcon,
  CopyIcon, ChevronDownIcon, WifiOffIcon, BrainIcon, ShieldIcon,
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
  { id: 'rounds',        label: 'Rounds',        Icon: TargetIcon, match: ['rounds','round-'] },
  { id: 'progress',      label: 'My Progress',   Icon: TrendingUpIcon },
  { id: 'leaderboard',   label: 'Leaderboard',   Icon: TrophyIcon },
  { id: 'team',          label: 'Team',          Icon: UsersIcon },
  { id: 'submissions',   label: 'Submissions',   Icon: FileTextIcon },
  { id: 'help',          label: 'Help & Rules',  Icon: HelpCircleIcon },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard:         { title: 'Welcome back, Team Alpha! 👋', subtitle: 'Think. Prompt. Solve. Win.' },
  rounds:            { title: 'Rounds Overview', subtitle: '5 Rounds. 5 Challenges. One Champion.' },
  'round1-briefing': { title: 'Round 1: AI IQ', subtitle: 'AI + Tech Quiz · 30 minutes' },
  'round1-question': { title: 'Round 1: AI IQ', subtitle: 'Question in Progress' },
  'round1-review':   { title: 'Round 1: AI IQ', subtitle: 'Review Your Answers' },
  'round1-result':   { title: 'Round 1: AI IQ', subtitle: 'Round Complete ✓' },
  'round2-briefing': { title: 'Round 2: Prompt Heist', subtitle: 'Engineer the perfect prompt.' },
  'round2-workspace':{ title: 'Round 2: Prompt Heist', subtitle: 'Prompt Workspace · 3 attempts' },
  'round2-result':   { title: 'Round 2: Prompt Heist', subtitle: 'Round Complete ✓' },
  'round3-briefing': { title: 'Round 3: AI Escape Room', subtitle: 'Solve. Discover. Escape.' },
  'round3-puzzles':  { title: 'Round 3: AI Escape Room', subtitle: 'Puzzle Board · 4 puzzles' },
  'round3-result':   { title: 'Round 3: AI Escape Room', subtitle: 'Round Complete ✓' },
  'round4-briefing': { title: 'Round 4: AI Battle Royale', subtitle: 'Build. Test. Defend. Survive.' },
  'round4-workspace':{ title: 'Round 4: AI Battle Royale', subtitle: 'AI Testing Laboratory' },
  'round4-evaluation':{ title: 'Round 4: AI Battle Royale', subtitle: 'Hidden Evaluation' },
  'round4-result':   { title: 'Round 4: AI Battle Royale', subtitle: 'Round Complete ✓' },
  'round5-brief':    { title: 'Round 5: AI Grandmaster', subtitle: 'The ultimate AI engineering mission.' },
  'round5-workspace':{ title: 'Round 5: AI Grandmaster', subtitle: 'Mission Workspace' },
  'round5-submission':{ title: 'Round 5: AI Grandmaster', subtitle: 'Final Submission' },
  'round5-evaluation':{ title: 'Round 5: AI Grandmaster', subtitle: 'Evaluation in Progress…' },
  leaderboard:       { title: 'Live Leaderboard', subtitle: 'Updated in real-time' },
  progress:          { title: 'My Progress', subtitle: "Team Alpha's performance" },
  submissions:       { title: 'Submission History', subtitle: 'Your submitted attempts' },
  team:              { title: 'Team', subtitle: 'Team Alpha — 2 Members' },
  help:              { title: 'Help & Rules', subtitle: 'Event guidelines & FAQ' },
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
  const mainRef = useRef<HTMLDivElement>(null);
  
  const currentTeam = useTeamStore(s => s.currentTeam);
  const members = useTeamStore(s => s.members);

  const teamName = currentTeam?.name || 'Your Team';
  const teamCode = currentTeam?.access_code || '------';
  const membersCount = members?.length || 0;
  const teamInitials = teamName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const dynamicTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard:         { title: `Welcome back, ${teamName}! 👋`, subtitle: 'Think. Prompt. Solve. Win.' },
    progress:          { title: 'My Progress', subtitle: `${teamName}'s performance` },
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

  const urgent = parseInt(timer.hours) === 0 && parseInt(timer.minutes) < 10;

  return (
    <div className="flex h-full bg-[#f9f7f4] overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="w-[224px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col relative z-20">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <button
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2.5 group"
          >
            <img 
              src="/assets/logo.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain drop-shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform duration-200" 
            />
            <div className="leading-none">
              <div className="text-[13px] font-black text-gray-900 font-heading tracking-wide">PROMPT</div>
              <div className="text-[11px] font-black text-orange-500 font-heading tracking-wider">CHAMPIONSHIP</div>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-gray-100 mb-3 flex-shrink-0" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          {navItems.map((item, idx) => {
            const active = isActive(item);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 text-left relative group
                  ${active
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-300/50'
                    : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'}
                `}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Active sliding indicator */}
                {active && (
                  <span className="absolute inset-y-1 left-0 w-0.5 bg-white/50 rounded-full" />
                )}

                <item.Icon
                  className={`w-[17px] h-[17px] flex-shrink-0 transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`}
                />
                <span className="font-heading flex-1">{item.label}</span>

                {/* Badge */}
                {item.badge && !active && (
                  <span className="badge-pop w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 font-heading">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Session security strip */}
        <div className="mx-4 mb-3 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldIcon className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-green-700 font-heading">Secure Session</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-auto live-dot" />
          </div>
          <div className="text-[10px] text-green-600 mt-0.5 pl-5">{teamName} · {membersCount} members active</div>
        </div>

        {/* Admin access link */}
        <div className="mx-4 mb-3 flex-shrink-0">
          <button
            onClick={() => navigate('admin')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors border border-dashed border-slate-200"
          >
            <span>⚙️</span>
            <span>Coordinator Panel</span>
          </button>
        </div>

        {/* Logout button */}
        <div className="mx-4 mb-3 flex-shrink-0">
          <button
            onClick={() => {
              localStorage.removeItem('authState');
              window.location.reload();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors border border-red-200"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>

        {/* Bottom wave + help */}
        <div className="relative flex-shrink-0">
          <svg viewBox="0 0 224 56" preserveAspectRatio="none" className="w-full h-12 text-orange-50" fill="currentColor">
            <path d="M0,28 C32,6 64,50 112,28 C160,6 196,44 224,28 L224,56 L0,56 Z" />
          </svg>
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-3.5 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <HelpCircleIcon className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-700 font-heading leading-none">Need Help?</div>
              <button className="text-[11px] text-orange-500 font-semibold hover:underline leading-none mt-0.5">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top nav */}
        <header
          className={`
            bg-white border-b px-6 h-[68px] flex items-center gap-4 flex-shrink-0 relative z-10
            transition-all duration-200
            ${scrolled ? 'border-gray-200 shadow-sm' : 'border-gray-100 shadow-none'}
          `}
        >
          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-gray-900 font-heading truncate leading-tight">{info.title}</h1>
            <p className="text-[11px] text-gray-400 truncate leading-none mt-0.5">{info.subtitle}</p>
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
        <main ref={mainRef} className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

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
  );
}
