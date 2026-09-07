import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { ShieldIcon, AlertTriangleIcon, UsersIcon, ZapIcon, CheckCircleIcon, BanIcon, ClockIcon } from '../../components/icons';

interface TeamStatus {
  id: string;
  name: string;
  access_code: string;
  is_frozen: boolean;
  isOnline: boolean;
  lastHeartbeat: string | null;
  sessionState: string;
  violationCount: number;
}

interface ViolationEvent {
  id: string;
  team_id: string;
  team_name: string;
  violation_type: string;
  description: string;
  created_at: string;
}

export default function LiveMonitor({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [teams, setTeams] = useState<TeamStatus[]>([]);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'frozen' | 'violations'>('all');
  const feedRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (!activeEvent) return;

    // 1. Get all teams for this event
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, access_code, is_frozen')
      .eq('event_id', activeEvent.id);

    if (!teamsData || teamsData.length === 0) {
      setTeams([]);
      setViolations([]);
      setLoading(false);
      return;
    }

    const teamIds = teamsData.map(t => t.id);
    const teamMap = new Map(teamsData.map(t => [t.id, t]));

    // 2. Get sessions
    const { data: sessions } = await supabase
      .from('team_sessions')
      .select('team_id, state, last_heartbeat')
      .in('team_id', teamIds);

    const sessMap = new Map((sessions || []).map(s => [s.team_id, s]));

    // 3. Get violation counts per team
    const { data: violationCounts } = await supabase
      .from('security_violations')
      .select('team_id')
      .in('team_id', teamIds);

    const countMap = new Map<string, number>();
    (violationCounts || []).forEach(v => {
      countMap.set(v.team_id, (countMap.get(v.team_id) || 0) + 1);
    });

    // 4. Get recent violations globally
    const { data: recentViolations } = await supabase
      .from('security_violations')
      .select('*')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })
      .limit(50);

    // Build team statuses
    const now = new Date().getTime();
    const statuses: TeamStatus[] = teamsData.map(t => {
      const sess = sessMap.get(t.id);
      const isOnline = sess?.last_heartbeat ? (now - new Date(sess.last_heartbeat).getTime() < 90000) : false;
      return {
        id: t.id,
        name: t.name,
        access_code: t.access_code,
        is_frozen: t.is_frozen || false,
        isOnline,
        lastHeartbeat: sess?.last_heartbeat || null,
        sessionState: sess?.state || 'NONE',
        violationCount: countMap.get(t.id) || 0,
      };
    });

    // Sort: frozen first, then online, then offline
    statuses.sort((a, b) => {
      if (a.is_frozen !== b.is_frozen) return a.is_frozen ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setTeams(statuses);

    // Build violations feed
    setViolations((recentViolations || []).map(v => ({
      ...v,
      team_name: teamMap.get(v.team_id)?.name || 'Unknown'
    })));

    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Poll every 15 seconds for heartbeats
    const interval = setInterval(loadData, 15000);

    // Real-time subscription for new violations
    const channel = supabase.channel('live-monitor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_violations' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeEvent]);

  // Admin quick actions
  const quickFreeze = async (teamId: string) => {
    await supabase.from('teams').update({ is_frozen: true }).eq('id', teamId);
    await loadData();
  };

  const quickUnfreeze = async (teamId: string) => {
    await supabase.from('teams').update({ is_frozen: false }).eq('id', teamId);
    await loadData();
  };

  // Filter teams
  const filteredTeams = teams.filter(t => {
    if (filter === 'online') return t.isOnline;
    if (filter === 'frozen') return t.is_frozen;
    if (filter === 'violations') return t.violationCount > 0;
    return true;
  });

  const onlineCount = teams.filter(t => t.isOnline).length;
  const frozenCount = teams.filter(t => t.is_frozen).length;
  const violationTeamCount = teams.filter(t => t.violationCount > 0).length;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading live monitor...</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <ShieldIcon className="w-5 h-5" />
            </div>
            Live Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1">Real-time team status, violations, and integrity overview</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-green-700">LIVE</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <button 
          onClick={() => setFilter('all')} 
          className={`bg-white rounded-2xl border p-5 text-left transition-all hover:shadow-md ${filter === 'all' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Total Teams</span>
          </div>
          <div className="text-3xl font-black text-gray-900 font-heading">{teams.length}</div>
        </button>
        <button 
          onClick={() => setFilter('online')} 
          className={`bg-white rounded-2xl border p-5 text-left transition-all hover:shadow-md ${filter === 'online' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Online</span>
          </div>
          <div className="text-3xl font-black text-green-600 font-heading">{onlineCount}</div>
        </button>
        <button 
          onClick={() => setFilter('frozen')} 
          className={`bg-white rounded-2xl border p-5 text-left transition-all hover:shadow-md ${filter === 'frozen' ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <BanIcon className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Frozen</span>
          </div>
          <div className="text-3xl font-black text-red-600 font-heading">{frozenCount}</div>
        </button>
        <button 
          onClick={() => setFilter('violations')} 
          className={`bg-white rounded-2xl border p-5 text-left transition-all hover:shadow-md ${filter === 'violations' ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Flagged</span>
          </div>
          <div className="text-3xl font-black text-amber-600 font-heading">{violationTeamCount}</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Team Grid */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-gray-900 font-heading">
            {filter === 'all' ? 'All Teams' : filter === 'online' ? 'Online Teams' : filter === 'frozen' ? 'Frozen Teams' : 'Flagged Teams'} 
            <span className="text-gray-400 ml-1">({filteredTeams.length})</span>
          </h2>

          {filteredTeams.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
              No teams match this filter.
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
              {filteredTeams.map(t => (
                <div 
                  key={t.id} 
                  className={`bg-white rounded-xl border p-4 flex items-center justify-between transition-all hover:shadow-md cursor-pointer ${
                    t.is_frozen ? 'border-red-200 bg-red-50/30' : t.violationCount > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-gray-100'
                  }`}
                  onClick={() => navigate(`admin-team-${t.id}` as Page)}
                >
                  <div className="flex items-center gap-4">
                    {/* Status Indicator */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black font-heading text-white ${
                      t.is_frozen ? 'bg-red-500' : t.isOnline ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {t.is_frozen ? '🔒' : t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {t.name}
                        {t.is_frozen && <span className="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded tracking-wider">FROZEN</span>}
                        {t.isOnline && !t.is_frozen && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {t.access_code} · {t.sessionState} · {t.lastHeartbeat ? `${Math.round((Date.now() - new Date(t.lastHeartbeat).getTime()) / 1000)}s ago` : 'never'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {t.violationCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                        <AlertTriangleIcon className="w-3 h-3" />
                        {t.violationCount}
                      </span>
                    )}
                    {t.is_frozen ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); quickUnfreeze(t.id); }}
                        className="text-[10px] font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🔓 Unfreeze
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); quickFreeze(t.id); }}
                        className="text-[10px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🧊 Freeze
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Violations Feed */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-900 font-heading flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-red-500" />
            Live Violations Feed
          </h2>
          <div ref={feedRef} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden max-h-[calc(100vh-380px)] overflow-y-auto">
            {violations.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-xs">
                <ShieldIcon className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                No violations detected yet.
                <br />All clear! 🟢
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {violations.map(v => (
                  <div 
                    key={v.id} 
                    className="p-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`admin-team-${v.team_id}` as Page)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        v.violation_type === 'UNAUTHORIZED_EXTENSION' ? 'bg-red-500 animate-pulse' :
                        v.violation_type === 'TAB_SWITCH' ? 'bg-orange-500' :
                        'bg-yellow-500'
                      }`} />
                      <span className="text-[10px] font-black text-gray-300 font-heading tracking-wider">{v.violation_type}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1">{v.team_name}</div>
                    <div className="text-[9px] text-gray-600 font-mono">{new Date(v.created_at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
