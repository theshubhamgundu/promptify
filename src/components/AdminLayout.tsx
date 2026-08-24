import { ReactNode } from 'react';
import { HomeIcon, TargetIcon, UsersIcon, TrophyIcon, BookIcon, ShieldIcon, BrainIcon, ZapIcon } from './icons';
import type { Page } from './Layout';

interface AdminLayoutProps {
  page: Page;
  navigate: (p: Page) => void;
  children: ReactNode;
}

const navItems = [
  { id: 'admin',              label: 'Command Center', Icon: HomeIcon,   section: 'main' },
  { id: 'admin-events',       label: 'Events',         Icon: ZapIcon,    section: 'manage' },
  { id: 'admin-teams',        label: 'Teams',          Icon: UsersIcon,  section: 'manage' },
  { id: 'admin-rounds',       label: 'Rounds',         Icon: TargetIcon, section: 'manage' },
  { id: 'admin-leaderboard',  label: 'Leaderboard',    Icon: TrophyIcon, section: 'analytics' },
  { id: 'admin-logs',         label: 'Activity Logs',  Icon: ShieldIcon, section: 'analytics' },
];

export default function AdminLayout({ page, navigate, children }: AdminLayoutProps) {
  const manageSections = navItems.filter(n => n.section === 'manage');
  const analyticsSections = navItems.filter(n => n.section === 'analytics');
  const mainSection = navItems.filter(n => n.section === 'main');

  return (
    <div className="flex h-screen bg-[#f9f7f4] overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="w-[260px] flex-shrink-0 bg-[#f9f7f4] border-r border-gray-200 flex flex-col relative">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-orange-500/[0.03] to-transparent pointer-events-none" />
        
        {/* Logo */}
        <div className="px-6 pt-7 pb-6 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <BrainIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[13px] font-black text-gray-900 font-heading tracking-wide">COORDINATOR</div>
              <div className="text-[10px] text-orange-600 font-bold font-heading tracking-widest">CONTROL CENTER</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 overflow-y-auto relative z-10 space-y-6">
          {/* Main */}
          <div>
            {mainSection.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id as Page)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-orange-500/10 to-orange-500/5 text-orange-700 shadow-sm border border-orange-500/20'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:border hover:border-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    active ? 'bg-orange-500/15 text-orange-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <item.Icon className="w-4 h-4" />
                  </div>
                  <span>{item.label}</span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
                </button>
              );
            })}
          </div>

          {/* Management section */}
          <div>
            <div className="px-3.5 mb-2.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] font-heading">Management</div>
            <div className="space-y-0.5">
              {manageSections.map((item) => {
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* Analytics section */}
          <div>
            <div className="px-3.5 mb-2.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] font-heading">Analytics & Security</div>
            <div className="space-y-0.5">
              {analyticsSections.map((item) => {
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
                  </button>
                );
              })}
            </div>
          </div>
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
              {navItems.find(n => n.id === page)?.label || 'Command Center'}
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
