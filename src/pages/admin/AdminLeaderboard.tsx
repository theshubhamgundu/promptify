import { useState, useEffect } from 'react';
import { AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { TrophyIcon, ArrowRightIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';

interface TeamScore {
  team_id: string;
  team_name: string;
  total_score: number;
  rounds_completed: number;
}

export default function AdminLeaderboard({ navigate }: { navigate: (p: Page) => void }) {
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScores();

    const channel = supabase
      .channel('admin-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        loadScores();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadScores = async () => {
    const { data: submissions } = await supabase
      .from('submissions')
      .select('team_id, score, status')
      .eq('status', 'EVALUATED');

    const { data: teams } = await supabase.from('teams').select('id, name');

    if (submissions && teams) {
      const teamMap = new Map(teams.map(t => [t.id, t.name]));
      const scoreMap = new Map<string, { total: number; rounds: Set<string> }>();

      submissions.forEach(s => {
        if (!scoreMap.has(s.team_id)) {
          scoreMap.set(s.team_id, { total: 0, rounds: new Set() });
        }
        const entry = scoreMap.get(s.team_id)!;
        entry.total += (s.score || 0);
      });

      const ranked = Array.from(scoreMap.entries())
        .map(([teamId, data]) => ({
          team_id: teamId,
          team_name: teamMap.get(teamId) || 'Unknown',
          total_score: data.total,
          rounds_completed: data.rounds.size,
        }))
        .sort((a, b) => b.total_score - a.total_score);

      setScores(ranked);
    }
    setLoading(false);
  };

  const medalColors = ['from-amber-300 to-yellow-500', 'from-gray-300 to-gray-400', 'from-orange-500 to-orange-700'];
  const medalEmojis = ['🥇', '🥈', '🥉'];

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Master Leaderboard</h1>
          <p className="text-gray-500 text-sm">Real-time scores with manual override capability</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-700 font-bold uppercase tracking-wide">Live Updates</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading scores...</div>
      ) : scores.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-sm text-gray-500 font-semibold">No scores yet</div>
          <div className="text-xs text-gray-400 mt-1">Scores will appear once teams submit solutions.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_150px_120px] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50/50">
            <span>Rank</span>
            <span>Team</span>
            <span className="text-right">Total Score</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {scores.map((team, i) => (
              <div 
                key={team.team_id}
                className={`grid grid-cols-[60px_1fr_150px_120px] px-6 py-4 items-center transition-all hover:bg-gray-50 ${
                  i < 3 ? 'bg-orange-50/10' : ''
                }`}
              >
                {/* Rank */}
                <div>
                  {i < 3 ? (
                    <span className="text-xl">{medalEmojis[i]}</span>
                  ) : (
                    <span className="text-sm font-black text-gray-400 font-heading">#{i + 1}</span>
                  )}
                </div>

                {/* Team info */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    i < 3 ? `bg-gradient-to-br ${medalColors[i]} shadow-sm text-white` : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="text-sm font-black font-heading">
                      {team.team_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{team.team_name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{team.team_id.slice(0, 12)}…</div>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <span className={`text-xl font-black font-heading ${
                    i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-orange-600' : 'text-gray-900'
                  }`}>
                    <AnimatedNumber to={team.total_score} />
                  </span>
                  <span className="text-xs text-gray-400 ml-1">pts</span>
                </div>

                {/* Actions */}
                <div className="text-right">
                  <button className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-all">
                    Override
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
