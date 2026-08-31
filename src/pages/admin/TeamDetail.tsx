import { useState, useEffect } from 'react';
import { Button, ConfirmDialog, AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { UsersIcon, ShieldIcon, BanIcon, CheckCircleIcon, ArrowRightIcon, TrophyIcon, ClockIcon, AlertTriangleIcon, ZapIcon } from '../../components/icons';

interface TeamDetailProps {
  teamId: string;
  navigate: (p: Page) => void;
}

export default function TeamDetail({ teamId, navigate }: TeamDetailProps) {
  const [data, setData] = useState<{
    team: any;
    participants: any[];
    session: any;
    logs: any[];
    violations: any[];
    score: number;
    scoreEvents: any[];
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; title: string; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    
    const [teamRes, partsRes, sessRes, logRes, subRes, scoreEventRes, violationsRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('participants').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('team_sessions').select('*').eq('team_id', teamId).single(),
      supabase.from('activity_logs').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(50),
      supabase.from('submissions').select('score').eq('team_id', teamId).eq('status', 'EVALUATED'),
      supabase.from('score_events').select('points, reason').eq('team_id', teamId),
      supabase.from('security_violations').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(30)
    ]);

    if (teamRes.data) {
      let totalScore = 0;
      if (subRes.data) subRes.data.forEach(s => totalScore += (s.score || 0));
      if (scoreEventRes.data) scoreEventRes.data.forEach(se => totalScore += (se.points || 0));

      setData({
        team: teamRes.data,
        participants: partsRes.data || [],
        session: sessRes.data,
        logs: logRes.data || [],
        violations: violationsRes.data || [],
        score: totalScore,
        scoreEvents: scoreEventRes.data || []
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Real-time subscription for team updates
    const channel = supabase.channel(`team-detail-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` }, () => {
        loadData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_violations', filter: `team_id=eq.${teamId}` }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamId]);

  // ── Admin Actions ──
  const handleFreeze = async () => {
    setActionLoading('freeze');
    const { error } = await supabase.rpc('admin_update_team_status', {
      p_team_id: teamId,
      p_action: 'FREEZE',
      p_reason: 'Admin manually froze team via dashboard'
    });
    if (error) {
      console.error('Failed to freeze team:', error);
      await supabase.from('teams').update({ is_frozen: true }).eq('id', teamId);
      await supabase.from('activity_logs').insert({
        action: 'SCORE_OVERRIDE',
        team_id: teamId,
        details: { admin_action: 'MANUAL_FREEZE', reason: 'Admin manually froze team' }
      });
    }
    await loadData();
    setActionLoading(null);
    setConfirmAction(null);
  };

  const handleUnfreeze = async () => {
    setActionLoading('unfreeze');
    const { error } = await supabase.rpc('admin_update_team_status', {
      p_team_id: teamId,
      p_action: 'UNFREEZE',
      p_reason: 'Admin manually unfroze team via dashboard'
    });
    if (error) {
      console.error('Failed to unfreeze team:', error);
      await supabase.from('teams').update({ is_frozen: false }).eq('id', teamId);
      await supabase.from('activity_logs').insert({
        action: 'SCORE_OVERRIDE',
        team_id: teamId,
        details: { admin_action: 'MANUAL_UNFREEZE', reason: 'Admin manually unfroze team' }
      });
    }
    await loadData();
    setActionLoading(null);
    setConfirmAction(null);
  };

  const handleDisqualify = async () => {
    setActionLoading('disqualify');
    const { error } = await supabase.rpc('admin_update_team_status', {
      p_team_id: teamId,
      p_action: 'DISQUALIFY',
      p_reason: 'Admin manually disqualified team via dashboard'
    });
    if (error) {
      console.error('Failed to disqualify team:', error);
      // Fallback for when RPC is not yet pushed to DB
      await supabase.from('teams').update({ is_frozen: true }).eq('id', teamId);
      await supabase.from('team_sessions').update({ state: 'SUSPENDED' }).eq('team_id', teamId);
      await supabase.from('activity_logs').insert({
        action: 'SCORE_OVERRIDE',
        team_id: teamId,
        details: { admin_action: 'DISQUALIFIED', reason: 'Admin disqualified team' }
      });
    }
    await loadData();
    setActionLoading(null);
    setConfirmAction(null);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading team details...</div>;
  }

  if (!data || !data.team) {
    return <div className="p-8 text-center text-gray-500">Team not found.</div>;
  }

  const { team, participants, session, logs, violations, score } = data;
  const isFrozen = team.is_frozen === true;
  const isOnline = session?.last_heartbeat ? (new Date().getTime() - new Date(session.last_heartbeat).getTime() < 90000) : false;

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      {/* Frozen Banner */}
      {isFrozen && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🔒</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-black text-red-800 font-heading">TEAM IS FROZEN</div>
            <div className="text-xs text-red-600">This team's session is locked. They cannot submit answers or interact with challenges until an admin unfreezes them.</div>
          </div>
          <Button 
            onClick={() => setConfirmAction({ type: 'unfreeze', title: 'Unfreeze Team', message: `Are you sure you want to unfreeze "${team.name}"? They will regain access to the competition.` })}
            className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2"
          >
            🔓 Unfreeze
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex gap-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-black font-heading shadow-md ${
            isFrozen ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
          }`}>
            {team.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-gray-900 font-heading leading-none">{team.name}</h1>
              {isFrozen ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider bg-red-100 text-red-700 animate-pulse">
                  🔒 FROZEN
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider ${
                  isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isOnline ? '● ONLINE' : '○ OFFLINE'}
                </span>
              )}
            </div>
            <div className="flex gap-4 text-xs text-gray-500 font-mono mt-2">
              <div>ID: {team.id.slice(0, 8)}</div>
              <div>CODE: {team.access_code}</div>
              <div>JOINED: {new Date(team.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest font-heading mb-1">Total Score</div>
          <div className="text-4xl font-black text-amber-500 font-heading">
            <AnimatedNumber to={score} />
          </div>
        </div>
      </div>

      {/* Admin Action Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldIcon className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900 font-heading">Admin Controls</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {!isFrozen ? (
            <Button 
              onClick={() => setConfirmAction({ type: 'freeze', title: 'Freeze Team', message: `Are you sure you want to freeze "${team.name}"? They will immediately lose access to all challenges.` })}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 flex items-center gap-1.5"
            >
              🧊 Freeze Team
            </Button>
          ) : (
            <Button 
              onClick={() => setConfirmAction({ type: 'unfreeze', title: 'Unfreeze Team', message: `Are you sure you want to unfreeze "${team.name}"?` })}
              className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 flex items-center gap-1.5"
            >
              🔓 Unfreeze Team
            </Button>
          )}
          <Button 
            onClick={() => setConfirmAction({ type: 'disqualify', title: 'Disqualify Team', message: `⚠️ This will PERMANENTLY freeze and suspend "${team.name}". Their session will be terminated. This cannot be undone easily. Are you absolutely sure?` })}
            className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <BanIcon className="w-3.5 h-3.5" /> Disqualify
          </Button>
          <Button 
            onClick={loadData}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-4 py-2"
          >
            ↻ Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-2 space-y-6">
          
          {/* Security Violations */}
          {violations.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-red-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2 bg-red-50/50">
                <AlertTriangleIcon className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-red-800 font-heading">Security Violations ({violations.length})</h2>
              </div>
              <div className="divide-y divide-red-50 max-h-64 overflow-y-auto">
                {violations.map((v: any) => (
                  <div key={v.id} className="px-6 py-3 flex items-center justify-between hover:bg-red-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        v.violation_type === 'UNAUTHORIZED_EXTENSION' ? 'bg-red-600' :
                        v.violation_type === 'TAB_SWITCH' ? 'bg-orange-500' :
                        'bg-yellow-500'
                      }`} />
                      <div>
                        <div className="text-xs font-bold text-gray-900">{v.violation_type}</div>
                        <div className="text-[10px] text-gray-500">{v.description}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">{new Date(v.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <UsersIcon className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900 font-heading">Participants ({participants.length}/{team.max_participants || 5})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {participants.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">No participants registered yet.</div>
              ) : participants.map(p => (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {p.name}
                      {p.role === 'LEADER' && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[9px] font-black font-heading tracking-wider">LEADER</span>}
                    </div>
                    <div className="text-[11px] text-gray-500">{p.email}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black font-heading tracking-wider ${
                    p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <ShieldIcon className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900 font-heading">Recent Activity Timeline</h2>
            </div>
            <div className="p-6">
              {logs.length === 0 ? (
                <div className="text-center text-gray-400 text-sm">No activity recorded for this team.</div>
              ) : (
                <div className="relative border-l border-gray-100 ml-3 space-y-6 max-h-96 overflow-y-auto">
                  {logs.map((l, i) => (
                    <div key={l.id} className="relative pl-6">
                      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                        ['TAB_SWITCH', 'UNAUTHORIZED_EXTENSION', 'RAPID_SUBMISSION', 'COPY_PASTE_DETECTED'].includes(l.action) 
                          ? 'bg-red-500' 
                          : l.action.includes('SCORE') ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                      <div className="text-xs font-bold text-gray-900 mb-0.5">{l.action}</div>
                      <div className="text-[10px] text-gray-400 font-mono mb-1">{new Date(l.created_at).toLocaleString()}</div>
                      {l.details && (
                        <div className="bg-gray-50 rounded-lg p-2 text-[10px] font-mono text-gray-600 break-all">
                          {JSON.stringify(l.details)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Session Info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <ClockIcon className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900 font-heading">Active Session</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider flex items-center gap-1.5 ${
                  isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              
              <div>
                <div className="text-xs font-bold text-gray-500 mb-1">State</div>
                <div className="text-sm font-mono bg-gray-50 p-2 rounded-lg text-gray-700">{session?.state || 'NONE'}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 mb-1">Device Binding</div>
                <div className="text-[10px] font-mono bg-gray-50 p-2 rounded-lg text-gray-500 break-all">
                  {session?.device_id || 'Unbound'}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 mb-1">Last Heartbeat</div>
                <div className="text-xs text-gray-900">
                  {session?.last_heartbeat ? new Date(session.last_heartbeat).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <ZapIcon className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-900 font-heading">Quick Stats</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Violations</span>
                <span className={`text-sm font-black font-heading ${violations.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {violations.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Activity Logs</span>
                <span className="text-sm font-black font-heading text-gray-900">{logs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Frozen</span>
                <span className={`text-sm font-black font-heading ${isFrozen ? 'text-red-600' : 'text-green-600'}`}>
                  {isFrozen ? 'YES' : 'NO'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={() => {
            if (confirmAction.type === 'freeze') handleFreeze();
            else if (confirmAction.type === 'unfreeze') handleUnfreeze();
            else if (confirmAction.type === 'disqualify') handleDisqualify();
          }}
          onCancel={() => setConfirmAction(null)}
          danger={confirmAction.type === 'disqualify'}
        />
      )}
    </div>
  );
}
