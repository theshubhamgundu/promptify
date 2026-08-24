import { ReactNode, useState, useEffect } from 'react';
import { HomeIcon, TargetIcon, UsersIcon, TrophyIcon, ShieldIcon, BrainIcon, ZapIcon, ClockIcon, CheckCircleIcon } from './icons';
import type { Page } from './Layout';
import { supabase } from '../lib/supabase';
import { useAdminStore } from '../stores/adminStore';

interface AdminLayoutProps {
  page: Page;
  navigate: (p: Page) => void;
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: '',
    items: [
      { id: 'admin', label: 'Overview', Icon: HomeIcon },
    ],
  },
  {
    title: 'Event',
    items: [
      { id: 'admin-events', label: 'Event Management', Icon: ZapIcon },
    ],
  },
  {
    title: 'People',
    items: [
      { id: 'admin-teams', label: 'Teams', Icon: UsersIcon },
      { id: 'admin-participants', label: 'Participants', Icon: UsersIcon },
      { id: 'admin-verification', label: 'Verification Queue', Icon: CheckCircleIcon },
    ],
  },
  {
    title: 'Competition',
    items: [
      { id: 'admin-rounds', label: 'Rounds & Challenges', Icon: TargetIcon },
      { id: 'admin-submissions', label: 'Submissions Review', Icon: TargetIcon },
    ],
  },
  {
    title: 'Live',
    items: [
      { id: 'admin-leaderboard', label: 'Leaderboard', Icon: TrophyIcon },
      { id: 'admin-announcements', label: 'Announcements', Icon: ZapIcon },
    ],
  },
  {
    title: 'Security',
    items: [
      { id: 'admin-sessions', label: 'Active Sessions', Icon: ClockIcon },
      { id: 'admin-logs', label: 'Audit Logs', Icon: ShieldIcon },
    ],
  },
];

export default function AdminLayout({ page, navigate, children }: AdminLayoutProps) {
  const { activeEvent, setActiveEvent } = useAdminStore();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase.from('events').select('id, name, status').order('created_at', { ascending: false });
      if (data && data.length > 0) {
        setEvents(data);
        if (!activeEvent) {
          setActiveEvent({ id: data[0].id, name: data[0].name, status: data[0].status });
        }
      }
    }
    loadEvents();
  }, []);

  const handleEventChange = (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (ev) setActiveEvent({ id: ev.id, name: ev.name, status: ev.status });
  };

  const statusColor = activeEvent?.status === 'LIVE' ? 'bg-green-500' : activeEvent?.status === 'PAUSED' ? 'bg-amber-500' : 'bg-gray-400';

  return (
    <div className="flex h-screen bg-[#f9f7f4] overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="w-[260px] flex-shrink-0 bg-[#f9f7f4] border-r border-gray-200 flex flex-col relative">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-orange-500/[0.03] to-transparent pointer-events-none" />
        
        {/* Logo */}
        <div className="px-6 pt-7 pb-4 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <BrainIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[13px] font-black text-gray-900 font-heading tracking-wide">HAPPENO</div>
              <div className="text-[10px] text-orange-600 font-bold font-heading tracking-widest">CONTROL CENTER</div>
            </div>
          </div>
        </div>

        {/* Event Selector */}
        {events.length > 0 && (
          <div className="px-4 pb-4 relative z-10">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] font-heading px-2 mb-1.5">Active Event</div>
            <div className="relative">
              <select
                value={activeEvent?.id || ''}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800 appearance-none cursor-pointer hover:border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
              >
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${statusColor} ${activeEvent?.status === 'LIVE' ? 'animate-pulse' : ''}`} style={{ display: 'none' }} />
            </div>
            {activeEvent && (
              <div className="flex items-center gap-1.5 px-2 mt-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${activeEvent.status === 'LIVE' ? 'animate-pulse' : ''}`} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{activeEvent.status}</span>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-4 overflow-y-auto relative z-10 space-y-5">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <div className="px-3.5 mb-2 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] font-heading">{section.title}</div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = page === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id as Page)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-orange-500/10 to-orange-500/5 text-orange-700 border border-orange-500/20'
                          : 'text-gray-600 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-100'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        active ? 'bg-orange-500/15 text-orange-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <item.Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.label}</span>
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 relative z-10">
          <button 
            onClick={() => navigate('dashboard')} 
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-all border border-transparent hover:border-orange-100"
          >
            <span className="text-sm">←</span>
            <span>Exit to Participant View</span>
          </button>
        </div>
      </aside>

      {/* ── Main Area ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col bg-white">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 h-16 flex-shrink-0 px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-gray-900 font-heading">
              {navSections.flatMap(s => s.items).find(n => n.id === page)?.label || 'Control Center'}
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[11px] text-gray-400 font-mono">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                <span className="text-xs font-black text-white font-heading">A</span>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900 leading-none">Admin</div>
                <div className="text-[10px] text-gray-500 leading-none mt-0.5">Coordinator</div>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
