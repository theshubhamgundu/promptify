import { useState, useEffect } from 'react';
import { Button, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { ShieldIcon, ClockIcon, AlertTriangleIcon, CheckCircleIcon, ZapIcon } from '../../components/icons';

interface TeamSession {
  id: string;
  team_id: string;
  device_id: string | null;
  state: string;
  last_heartbeat: string | null;
  team: {
    name: string;
    access_code: string;
  };
}

export default function SessionManager({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [sessions, setSessions] = useState<TeamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<TeamSession | null>(null);

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);

    const { data: teams } = await supabase.from('teams').select('id, name, access_code').eq('event_id', activeEvent.id);
    if (!teams || teams.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const teamMap = new Map(teams.map(t => [t.id, t]));
    const teamIds = teams.map(t => t.id);

    const { data: sess } = await supabase
      .from('team_sessions')
      .select('*')
      .in('team_id', teamIds)
      .order('last_heartbeat', { ascending: false, nullsFirst: false });

    if (sess) {
      setSessions(sess.map(s => ({
        ...s,
        team: teamMap.get(s.team_id)!
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Poll every 30s for heartbeat updates
    return () => clearInterval(interval);
  }, [activeEvent]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    
    // Unbind device and reset state so they are forced to log in again
    const { error } = await supabase.from('team_sessions')
      .update({ 
        device_id: null,
        state: 'CREATED' 
      })
      .eq('id', revokeTarget.id);
      
    if (!error) {
      await supabase.from('activity_logs').insert({
        action: 'SESSION_REVOKED',
        team_id: revokeTarget.team_id,
        details: { session_id: revokeTarget.id, previous_device: revokeTarget.device_id }
      });
      await loadData();
    }
    setRevokeTarget(null);
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  const isOnline = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return false;
    const diff = new Date().getTime() - new Date(lastHeartbeat).getTime();
    return diff < 90000; // 90 seconds
  };

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Active Sessions</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor device bindings and connection health for {activeEvent.name}</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
          <ClockIcon className="w-4 h-4 text-blue-500" />
          <span className="text-xs text-blue-700 font-bold uppercase tracking-wide">Polling 30s</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_200px_150px_120px] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50/50">
          <span>Team</span>
          <span>Status</span>
          <span>Device Binding</span>
          <span>Last Heartbeat</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-2xl mb-2">🔌</div>
            <div className="text-sm text-gray-500 font-medium">No active sessions found</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {sessions.map(s => {
              const online = isOnline(s.last_heartbeat);
              return (
                <div key={s.id} className="grid grid-cols-[1fr_120px_200px_150px_120px] px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 pr-4">
                    <button onClick={() => navigate(`admin-team-${s.team_id}` as Page)} className="text-sm font-bold text-gray-900 hover:text-orange-600 truncate transition-colors text-left block w-full">
                      {s.team.name}
                    </button>
                    <div className="text-[10px] font-mono text-gray-400 mt-0.5">Code: {s.team.access_code}</div>
                  </div>
                  
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider ${
                      online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      {online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>

                  <div className="pr-4">
                    {s.device_id ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 font-mono bg-gray-100 px-2 py-1 rounded w-fit max-w-full">
                        <ShieldIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{s.device_id.slice(0, 16)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unbound</span>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-gray-500">
                    {s.last_heartbeat ? new Date(s.last_heartbeat).toLocaleTimeString() : 'Never'}
                  </div>

                  <div className="text-right">
                    {s.device_id && (
                      <button 
                        onClick={() => setRevokeTarget(s)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-transparent hover:border-red-200 text-xs font-bold transition-colors"
                      >
                        Unbind
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {revokeTarget && (
        <ConfirmDialog
          title="Unbind Device"
          message={`Are you sure you want to unbind the current device for ${revokeTarget.team.name}? They will be forced to log in and verify again.`}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
