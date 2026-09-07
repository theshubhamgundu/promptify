import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Page } from '../../components/Layout';
import { Users, Activity, Target, Shield, Clock, BrainCircuit, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui';

interface Round5MonitorProps {
  navigate: (p: Page) => void;
}

export default function Round5Monitor({ navigate }: Round5MonitorProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, paused: 0 });
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  useEffect(() => {
    fetchTeams();
    const sub = supabase.channel('r5-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_sessions' }, fetchTeams)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_sessions' }, fetchTeams)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchTeams() {
    // Get teams currently in Round 5
    const { data: rsData } = await supabase
      .from('round_sessions')
      .select('*, teams(id, name, organization), rounds!inner(type)')
      .eq('rounds.type', 'AI_SYSTEMS')
      .order('started_at', { ascending: false });

    if (!rsData) return;

    let active = 0, completed = 0;
    
    // Enrich with challenge session data
    const enriched = await Promise.all(rsData.map(async (rs) => {
      const { data: csData } = await supabase
        .from('challenge_sessions')
        .select('*, challenges(title, type)')
        .eq('round_session_id', rs.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (rs.completed_at) completed++;
      else active++;

      return {
        ...rs,
        currentChallenge: csData
      };
    }));

    setTeams(enriched);
    setStats({ active, completed, paused: 0 });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Round 5 Monitor</h1>
          <p className="text-slate-400">Live AI Systems Challenge Tracking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900 border-slate-800">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Teams</p>
                <p className="text-3xl font-bold text-white">{teams.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active</p>
                <p className="text-3xl font-bold text-emerald-400">{stats.active}</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-full">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Team Progress</h2>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 rounded-tl-lg">Team</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Current Challenge</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Started</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-medium text-white">
                      {t.teams.name}
                      <div className="text-xs text-slate-500">{t.teams.organization}</div>
                    </td>
                    <td className="px-6 py-4">
                      {t.completed_at ? (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium">Completed</span>
                      ) : (
                        <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-medium">Active</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {t.currentChallenge ? (
                        <div className="flex flex-col">
                          <span className="text-slate-300">{t.currentChallenge.challenges?.title}</span>
                          <span className="text-xs text-slate-500">{t.currentChallenge.status}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {t.score || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(t.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No teams currently in Round 5.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
