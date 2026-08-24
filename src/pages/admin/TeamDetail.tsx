import { useState, useEffect } from 'react';
import { Button, ConfirmDialog, AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { UsersIcon, ShieldIcon, BanIcon, CheckCircleIcon, ArrowRightIcon, TrophyIcon, ClockIcon } from '../../components/icons';

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
    score: number;
    scoreEvents: any[];
  } | null>(null);
  
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    
    const [teamRes, partsRes, sessRes, logRes, subRes, scoreEventRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase.from('participants').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('team_sessions').select('*').eq('team_id', teamId).single(),
      supabase.from('activity_logs').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(50),
      supabase.from('submissions').select('score').eq('team_id', teamId).eq('status', 'EVALUATED'),
      supabase.from('score_events').select('points, reason').eq('team_id', teamId)
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
        score: totalScore,
        scoreEvents: scoreEventRes.data || []
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [teamId]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading team details...</div>;
  }

  if (!data || !data.team) {
    return <div className="p-8 text-center text-gray-500">Team not found.</div>;
  }

  const { team, participants, session, logs, score } = data;

  const isOnline = session?.last_heartbeat ? (new Date().getTime() - new Date(session.last_heartbeat).getTime() < 90000) : false;

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black font-heading shadow-md">
            {team.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-gray-900 font-heading leading-none">{team.name}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider ${
                team.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {team.status}
              </span>
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

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-2 space-y-6">
          
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
                <div className="relative border-l border-gray-100 ml-3 space-y-6">
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

        </div>
      </div>
    </div>
  );
}
