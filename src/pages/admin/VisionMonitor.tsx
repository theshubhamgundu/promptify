import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../stores/adminStore';
import type { Page } from '../../components/Layout';
import {
  EyeIcon, ClockIcon, CheckCircleIcon, XCircleIcon, ArrowLeftIcon
} from '../../components/icons';

interface MonitorRow {
  team_id: string;
  team_name: string;
  challenge_title: string;
  status: string;
  attempts: number;
  max_attempts: number;
  time_spent: number;
  score: number;
  started_at: string;
}

export default function VisionMonitor({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [data, setData] = useState<MonitorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!activeEvent) return;

    // We fetch challenge_sessions and join with teams and challenges
    // Since Supabase JS client doesn't do 3-way joins easily without defined foreign keys,
    // we'll fetch them separately or use a custom query approach.
    
    // 1. Get teams
    const { data: teams } = await supabase.from('teams').select('id, name').eq('event_id', activeEvent.id);
    if (!teams) return;
    const teamMap = new Map(teams.map(t => [t.id, t.name]));

    // 2. Get Vision challenges
    const { data: rounds } = await supabase.from('rounds').select('id').eq('event_id', activeEvent.id).eq('type', 'VISION_CHALLENGE');
    if (!rounds || rounds.length === 0) {
      setLoading(false);
      return;
    }
    const roundIds = rounds.map(r => r.id);

    const { data: challenges } = await supabase.from('challenges').select('id, title, max_attempts').in('round_id', roundIds);
    if (!challenges) return;
    const challengeMap = new Map(challenges.map(c => [c.id, c]));

    // 3. Get active and completed sessions
    const { data: sessions } = await supabase
      .from('challenge_sessions')
      .select('*')
      .in('team_id', Array.from(teamMap.keys()))
      .order('updated_at', { ascending: false });

    if (sessions) {
      const rows: MonitorRow[] = sessions
        .filter(s => challengeMap.has(s.challenge_id))
        .map(s => {
          const c = challengeMap.get(s.challenge_id)!;
          
          let timeSpent = s.total_time_seconds || 0;
          if (s.status === 'IN_PROGRESS' && s.started_at) {
            timeSpent = Math.floor((new Date().getTime() - new Date(s.started_at).getTime()) / 1000);
          }

          return {
            team_id: s.team_id,
            team_name: teamMap.get(s.team_id) || 'Unknown Team',
            challenge_title: c.title,
            status: s.status,
            attempts: s.attempts_used || 0,
            max_attempts: c.max_attempts || 3,
            time_spent: timeSpent,
            score: s.score || 0,
            started_at: s.started_at
          };
        });
      setData(rows);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [activeEvent]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading Vision Monitor...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('admin')}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white font-heading">Vision Challenge Monitor</h1>
            <p className="text-sm text-gray-400">Live progress of Round 3 challenges</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm text-green-400 font-bold uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-800 text-xs uppercase tracking-widest text-gray-400 font-bold">
                <th className="p-4">Team</th>
                <th className="p-4">Current/Last Challenge</th>
                <th className="p-4">Status</th>
                <th className="p-4">Time</th>
                <th className="p-4">Attempts</th>
                <th className="p-4 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data.map((row) => (
                <tr key={`${row.team_id}-${row.challenge_title}`} className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{row.team_name}</div>
                  </td>
                  <td className="p-4 text-sm text-gray-300">{row.challenge_title}</td>
                  <td className="p-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                      row.status === 'TIMEOUT' ? 'bg-red-500/10 text-red-400' :
                      'bg-purple-500/10 text-purple-400'
                    }`}>
                      {row.status === 'COMPLETED' && <CheckCircleIcon className="w-3.5 h-3.5" />}
                      {row.status === 'TIMEOUT' && <XCircleIcon className="w-3.5 h-3.5" />}
                      {row.status === 'IN_PROGRESS' && <EyeIcon className="w-3.5 h-3.5" />}
                      {row.status}
                    </div>
                  </td>
                  <td className="p-4 text-sm font-mono text-gray-400">
                    {Math.floor(row.time_spent / 60)}m {row.time_spent % 60}s
                  </td>
                  <td className="p-4 text-sm text-gray-300">
                    <span className={row.attempts >= row.max_attempts ? 'text-red-400 font-bold' : ''}>
                      {row.attempts}
                    </span> / {row.max_attempts}
                  </td>
                  <td className="p-4 text-right font-bold text-white">
                    {row.score}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No active Vision Challenge sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
