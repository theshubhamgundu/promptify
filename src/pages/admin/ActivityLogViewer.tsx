import { useState, useEffect } from 'react';
import { AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ShieldIcon, AlertTriangleIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';

interface ActivityLog {
  id: string;
  team_id: string | null;
  user_id: string | null;
  action: string;
  details: any;
  created_at: string;
}

const actionConfig: Record<string, { color: string; dot: string; bg: string }> = {
  LOGIN_SUCCESS:          { color: 'text-green-600',  dot: 'bg-green-500',  bg: 'bg-green-50/50' },
  LOGIN_FAILURE:          { color: 'text-red-600',    dot: 'bg-red-500',    bg: 'bg-red-50/50' },
  TAB_SWITCH:             { color: 'text-amber-600',  dot: 'bg-amber-500',  bg: 'bg-amber-50/50' },
  COPY_PASTE_DETECTED:    { color: 'text-orange-600', dot: 'bg-orange-500', bg: 'bg-orange-50/50' },
  RAPID_SUBMISSION:       { color: 'text-red-600',    dot: 'bg-red-500',    bg: 'bg-red-50/50' },
  IDLE_DETECTED:          { color: 'text-yellow-600', dot: 'bg-yellow-500', bg: 'bg-yellow-50/50' },
  FOCUS_LOST:             { color: 'text-gray-500',   dot: 'bg-gray-400',   bg: '' },
  FOCUS_REGAINED:         { color: 'text-blue-600',   dot: 'bg-blue-500',   bg: '' },
  UNAUTHORIZED_EXTENSION: { color: 'text-red-600',    dot: 'bg-red-500',    bg: 'bg-red-50' },
  ROUND_STARTED:          { color: 'text-blue-600',   dot: 'bg-blue-500',   bg: '' },
  ROUND_COMPLETED:        { color: 'text-green-600',  dot: 'bg-green-500',  bg: '' },
  SUBMISSION_CREATED:     { color: 'text-indigo-600', dot: 'bg-indigo-500', bg: '' },
  SCORE_OVERRIDE:         { color: 'text-red-600',    dot: 'bg-red-500',    bg: 'bg-red-50/50' },
};

const suspiciousActions = ['TAB_SWITCH', 'COPY_PASTE_DETECTED', 'RAPID_SUBMISSION', 'IDLE_DETECTED', 'UNAUTHORIZED_EXTENSION'];

export default function ActivityLogViewer({ navigate }: { navigate: (p: Page) => void }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'suspicious'>('all');

  useEffect(() => {
    loadLogs();

    const channel = supabase
      .channel('activity-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs(prev => [payload.new as ActivityLog, ...prev].slice(0, 200));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(l => {
    if (filter === 'suspicious' && !suspiciousActions.includes(l.action)) return false;
    return true;
  });

  const suspiciousCount = logs.filter(l => suspiciousActions.includes(l.action)).length;
  const tabSwitchCount = logs.filter(l => l.action === 'TAB_SWITCH').length;
  const extensionCount = logs.filter(l => l.action === 'UNAUTHORIZED_EXTENSION').length;

  const statCards = [
    { label: 'Total Events',      value: logs.length,      color: 'text-gray-900',   border: 'border-gray-100', bg: 'bg-white' },
    { label: 'Suspicious',        value: suspiciousCount,  color: suspiciousCount > 0 ? 'text-red-600' : 'text-gray-900', border: suspiciousCount > 0 ? 'border-red-200' : 'border-gray-100', bg: suspiciousCount > 0 ? 'bg-red-50' : 'bg-white' },
    { label: 'Tab Switches',      value: tabSwitchCount,   color: tabSwitchCount > 0 ? 'text-amber-600' : 'text-gray-900', border: tabSwitchCount > 0 ? 'border-amber-200' : 'border-gray-100', bg: tabSwitchCount > 0 ? 'bg-amber-50' : 'bg-white' },
    { label: 'Extension Blocks',  value: extensionCount,   color: extensionCount > 0 ? 'text-red-600' : 'text-gray-900', border: extensionCount > 0 ? 'border-red-200' : 'border-gray-100', bg: extensionCount > 0 ? 'bg-red-50' : 'bg-white' },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Activity & Integrity Log</h1>
          <p className="text-gray-500 text-sm">Real-time audit trail with anti-cheat flagging</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-700 font-bold uppercase tracking-wide">Live Stream</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4 text-center shadow-sm`}>
            <div className={`text-2xl font-black font-heading ${s.color}`}>
              <AnimatedNumber to={s.value} />
            </div>
            <div className="text-[10px] text-gray-400 font-heading uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all ${
            filter === 'all'
              ? 'bg-orange-50 text-orange-600 border border-orange-200 shadow-sm'
              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Events
        </button>
        <button
          onClick={() => setFilter('suspicious')}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all flex items-center gap-1.5 ${
            filter === 'suspicious'
              ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm'
              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <AlertTriangleIcon className="w-3.5 h-3.5" />
          Suspicious Only ({suspiciousCount})
        </button>
      </div>

      {/* Log stream */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[180px_1fr_120px_1fr] px-6 py-3 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50/50">
          <span>Timestamp</span>
          <span>Action</span>
          <span>Team</span>
          <span>Details</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400">Loading activity logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-2xl mb-2">📡</div>
              <div className="text-sm text-gray-500">No activity logs found.</div>
            </div>
          ) : filteredLogs.map(l => {
            const conf = actionConfig[l.action] || { color: 'text-gray-500', dot: 'bg-gray-400', bg: '' };
            const isSuspicious = suspiciousActions.includes(l.action);
            return (
              <div 
                key={l.id} 
                className={`grid grid-cols-[180px_1fr_120px_1fr] px-6 py-3 items-center border-b border-gray-50 transition-colors hover:bg-gray-50/80 ${conf.bg}`}
              >
                <span className="text-xs text-gray-500 font-mono">
                  {new Date(l.created_at).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${conf.dot} ${isSuspicious ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs font-black font-heading ${conf.color}`}>
                    {l.action}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {l.team_id ? l.team_id.slice(0, 8) + '…' : '—'}
                </span>
                <span className="text-xs text-gray-600 truncate">
                  {l.details ? JSON.stringify(l.details) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
