import { useState, useEffect } from 'react';
import { Card, Badge, AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  BrainIcon, UsersIcon, TargetIcon, ShieldIcon, TrophyIcon,
  ZapIcon, ArrowRightIcon, ClockIcon, CheckCircleIcon, AlertTriangleIcon
} from '../../components/icons';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';

interface QuickAction {
  label: string;
  desc: string;
  page: Page;
  Icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
}

const quickActions: QuickAction[] = [
  { label: 'Manage Events',     desc: 'Control the championship lifecycle',    page: 'admin-events',       Icon: ZapIcon,    gradient: 'from-violet-50 to-white', iconBg: 'bg-violet-100 text-violet-600' },
  { label: 'Manage Teams',      desc: 'View teams, codes, participants',       page: 'admin-teams',        Icon: UsersIcon,  gradient: 'from-blue-50 to-white',   iconBg: 'bg-blue-100 text-blue-600' },
  { label: 'Manage Rounds',     desc: 'Configure challenges and timing',       page: 'admin-rounds',       Icon: TargetIcon, gradient: 'from-orange-50 to-white', iconBg: 'bg-orange-100 text-orange-600' },
  { label: 'Master Leaderboard', desc: 'Scores, overrides, rankings',          page: 'admin-leaderboard',  Icon: TrophyIcon, gradient: 'from-amber-50 to-white', iconBg: 'bg-amber-100 text-amber-600' },
  { label: 'Activity Logs',     desc: 'Real-time integrity monitoring',        page: 'admin-logs',         Icon: ShieldIcon, gradient: 'from-red-50 to-white',    iconBg: 'bg-red-100 text-red-600' },
];

export default function AdminDashboard({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [stats, setStats] = useState({ teams: 0, participants: 0, rounds: 0, submissions: 0 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!activeEvent) return;

      // Teams
      const { data: teamsData, count: teamsCount } = await supabase
        .from('teams')
        .select('id', { count: 'exact' })
        .eq('event_id', activeEvent.id);
        
      const teamIds = (teamsData || []).map(t => t.id);

      // Participants
      const { count: partsCount } = await supabase
        .from('participants')
        .select('id', { count: 'exact', head: true })
        .in('team_id', teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000']);

      // Rounds
      const { count: roundsCount } = await supabase
        .from('rounds')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', activeEvent.id);

      // Submissions (across all teams in this event)
      const { count: subsCount } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .in('team_id', teamIds.length ? teamIds : ['00000000-0000-0000-0000-000000000000']);

      setStats({
        teams: teamsCount || 0,
        participants: partsCount || 0,
        rounds: roundsCount || 0,
        submissions: subsCount || 0,
      });

      // Load recent activity for this event (if logs contain event_id or we filter by team_id)
      // Since activity_logs might not have event_id directly for everything, we fetch all for now
      // A robust implementation would filter by event_id if added to activity_logs
      let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5);
      
      const { data: logs } = await query;
      if (logs) {
        // Attempt to filter client-side for teams in this event, if applicable
        const filteredLogs = logs.filter(l => !l.details?.team_id || teamIds.includes(l.details.team_id));
        setRecentLogs(filteredLogs);
      }
    }
    load();
  }, [activeEvent]);

  const statCards = [
    { label: 'Active Teams', value: stats.teams,  Icon: UsersIcon,  color: 'text-blue-600',    bgColor: 'bg-blue-50',   borderColor: 'border-blue-100',    iconColor: 'text-blue-500' },
    { label: 'Participants', value: stats.participants, Icon: BrainIcon, color: 'text-violet-600',  bgColor: 'bg-violet-50', borderColor: 'border-violet-100',  iconColor: 'text-violet-500' },
    { label: 'Rounds',       value: stats.rounds, Icon: TargetIcon, color: 'text-orange-600',  bgColor: 'bg-orange-50',  borderColor: 'border-orange-100',  iconColor: 'text-orange-500' },
    { label: 'Submissions',  value: stats.submissions, Icon: CheckCircleIcon, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-100', iconColor: 'text-green-500' },
  ];

  const actionLogColors: Record<string, string> = {
    TAB_SWITCH: 'text-amber-600',
    COPY_PASTE_DETECTED: 'text-orange-600',
    UNAUTHORIZED_EXTENSION: 'text-red-600',
    FOCUS_LOST: 'text-gray-500',
    FOCUS_REGAINED: 'text-blue-600',
    IDLE_DETECTED: 'text-yellow-600',
    RAPID_SUBMISSION: 'text-red-600',
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      {/* ── Hero Banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white shadow-sm">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-[0.03]">
          {Array.from({ length: 8 }).map((_, r) => Array.from({ length: 12 }).map((_, c) => (
            <div
              key={`${r}-${c}`}
              className="absolute w-5 h-5 border border-orange-500 rounded"
              style={{ left: c * 60, top: r * 40, transform: 'rotate(45deg)' }}
            />
          )))}
        </div>
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-orange-200/40 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-violet-200/40 rounded-full blur-3xl" />

        <div className="relative z-10 p-8 flex items-center justify-between">
          <div>
            <div className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-4 font-heading
              ${activeEvent.status === 'LIVE' ? 'bg-green-100 border-green-200 text-green-600' : 'bg-orange-100 border-orange-200 text-orange-600'}
            `}>
              <span className={`w-1.5 h-1.5 rounded-full ${activeEvent.status === 'LIVE' ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
              {activeEvent.status === 'LIVE' ? 'Event Live' : 'Coordinator Mode'}
            </div>
            <h1 className="text-3xl font-black text-gray-900 font-heading leading-tight mb-2">
              HAPPENO TECHNOLOGIES<br />
              <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">COMMAND CENTER</span>
            </h1>
            <p className="text-gray-500 text-sm max-w-md">
              Full oversight and control over <strong className="text-gray-700">{activeEvent.name}</strong>. Monitor teams, manage rounds, and ensure competition integrity in real-time.
            </p>
          </div>

          {/* Status indicator */}
          <div className="hidden lg:flex flex-col items-center gap-3 bg-white/60 backdrop-blur border border-gray-100 rounded-2xl p-6 shadow-sm min-w-[160px]">
            <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest font-heading">Event Status</div>
            <div className={`text-2xl font-black font-heading ${
              activeEvent.status === 'LIVE' ? 'text-green-600' : activeEvent.status === 'PAUSED' ? 'text-amber-500' : 'text-gray-600'
            }`}>
              {activeEvent.status}
            </div>
            <div className={`w-3 h-3 rounded-full ${
              activeEvent.status === 'LIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`} />
          </div>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div 
            key={s.label}
            className={`relative overflow-hidden rounded-2xl border ${s.borderColor} ${s.bgColor} p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-white`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between relative z-10">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">{s.label}</div>
                <div className={`text-3xl font-black font-heading ${s.color}`}>
                  <AnimatedNumber to={s.value} />
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bgColor} border ${s.borderColor}`}>
                <s.Icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
            </div>
            {/* Decorative glow */}
            <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full ${s.bgColor} opacity-60 blur-xl`} />
          </div>
        ))}
      </div>

      {/* ── Quick Actions + Recent Activity ──────────────── */}
      <div className="grid grid-cols-[1fr_380px] gap-5">
        {/* Quick Actions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
              <ZapIcon className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-sm font-bold text-gray-900 font-heading">Quick Actions</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {quickActions.map((action) => (
              <button
                key={action.page}
                onClick={() => navigate(action.page)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-gradient-to-r ${action.gradient} hover:shadow-sm transition-all duration-200 group hover:border-gray-200 text-left`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${action.iconBg}`}>
                  <action.Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 font-heading">{action.label}</div>
                  <div className="text-xs text-gray-500">{action.desc}</div>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
              <ShieldIcon className="w-3.5 h-3.5 text-red-500" />
            </div>
            <span className="text-sm font-bold text-gray-900 font-heading">Recent Activity</span>
            <span className="ml-auto text-[10px] text-green-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">📡</div>
                <div className="text-sm text-gray-500 font-medium">Monitoring Active</div>
                <div className="text-xs text-gray-400 mt-1">Activity events will appear here in real-time.</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentLogs.map((log, i) => (
                  <div key={log.id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      ['TAB_SWITCH', 'COPY_PASTE_DETECTED', 'UNAUTHORIZED_EXTENSION', 'RAPID_SUBMISSION', 'SCORE_OVERRIDE'].includes(log.action) 
                        ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold font-heading truncate ${actionLogColors[log.action] || 'text-gray-600'}`}>
                        {log.action}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {log.details?.team_name ? log.details.team_name : (log.details?.team_id ? `Team ${log.details.team_id.slice(0, 8)}…` : 'System')}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => navigate('admin-logs')}
              className="w-full px-4 py-3 border-t border-gray-100 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors text-center bg-gray-50/50"
            >
              View All Activity →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
