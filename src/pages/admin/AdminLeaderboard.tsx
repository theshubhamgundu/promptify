import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';

interface TeamScore {
  team_id: string;
  team_name: string;
  total_score: number;
  round_scores: Record<string, number>;
  status?: string;
}

interface RoundInfo {
  id: string;
  name: string;
  order_index: number;
  type: string;
}

export default function AdminLeaderboard({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadScores = async () => {
    if (!activeEvent) return;

    // 1. Get teams for active event
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('event_id', activeEvent.id);

    if (teamsError) {
      setScores([]);
      setLoading(false);
      alert("Error fetching teams: " + teamsError.message);
      return;
    }

    if (!teams || teams.length === 0) {
      setScores([]);
      setLoading(false);
      return;
    }

    // 2. Get rounds for this event
    const { data: roundsData } = await supabase
      .from('rounds')
      .select('id, name, order_index, type')
      .eq('event_id', activeEvent.id)
      .order('order_index');

    if (roundsData) setRounds(roundsData);

    const teamIds = teams.map(t => t.id);
    const teamMap = new Map(teams.map(t => [t.id, { name: t.name, status: t.status }]));

    // Initialize score accumulator for each team
    const scoreAccum = new Map<string, { total: number; byRound: Record<string, number> }>();
    teamIds.forEach(id => scoreAccum.set(id, { total: 0, byRound: {} }));

    // 3. Query EACH round-specific submission table and aggregate scores
    // Round 2: round2_submissions (total_score)
    try {
      const { data: r2 } = await supabase
        .from('round2_submissions')
        .select('team_id, total_score')
        .in('team_id', teamIds);
      if (r2) {
        const r2RoundId = roundsData?.find(r => r.type === 'ROUND2_HEIST')?.id || 'round2';
        r2.forEach(s => {
          const entry = scoreAccum.get(s.team_id);
          if (entry) {
            const score = s.total_score || 0;
            entry.total += score;
            entry.byRound[r2RoundId] = (entry.byRound[r2RoundId] || 0) + score;
          }
        });
      }
    } catch (e) { /* table might not exist */ }

    // Round 3: vision_submissions (total_score)
    try {
      const { data: vs } = await supabase
        .from('vision_submissions')
        .select('team_id, total_score')
        .in('team_id', teamIds);
      if (vs) {
        const vsRoundId = roundsData?.find(r => r.type === 'VISION_CHALLENGE')?.id || 'round3';
        vs.forEach(s => {
          const entry = scoreAccum.get(s.team_id);
          if (entry) {
            const score = s.total_score || 0;
            entry.total += score;
            entry.byRound[vsRoundId] = (entry.byRound[vsRoundId] || 0) + score;
          }
        });
      }
    } catch (e) { /* table might not exist */ }

    // Generic submissions table (if any exist there)
    try {
      const { data: subs } = await supabase
        .from('submissions')
        .select('team_id, score, round_id, status')
        .eq('status', 'EVALUATED')
        .in('team_id', teamIds);
      if (subs) {
        subs.forEach(s => {
          const entry = scoreAccum.get(s.team_id);
          if (entry) {
            const score = s.score || 0;
            entry.total += score;
            if (s.round_id) {
              entry.byRound[s.round_id] = (entry.byRound[s.round_id] || 0) + score;
            }
          }
        });
      }
    } catch (e) { /* table might not exist */ }

    // Score events (manual adjustments / penalties)
    try {
      const { data: scoreEvents } = await supabase
        .from('score_events')
        .select('team_id, points')
        .in('team_id', teamIds);
      if (scoreEvents) {
        scoreEvents.forEach(se => {
          const entry = scoreAccum.get(se.team_id);
          if (entry) {
            entry.total += (se.points || 0);
            entry.byRound['adjustments'] = (entry.byRound['adjustments'] || 0) + (se.points || 0);
          }
        });
      }
    } catch (e) { /* table might not exist */ }

    // 4. Build ranked list
    const ranked = Array.from(scoreAccum.entries())
      .map(([teamId, data]) => ({
        team_id: teamId,
        team_name: teamMap.get(teamId)?.name || 'Unknown',
        status: teamMap.get(teamId)?.status,
        total_score: Math.round(data.total * 100) / 100,
        round_scores: data.byRound,
      }))
      .sort((a, b) => b.total_score - a.total_score);

    setScores(ranked);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadScores();

    // Real-time subscriptions
    const channels = [
      supabase.channel('lb-r2').on('postgres_changes', { event: '*', schema: 'public', table: 'round2_submissions' }, () => loadScores()).subscribe(),
      supabase.channel('lb-vs').on('postgres_changes', { event: '*', schema: 'public', table: 'vision_submissions' }, () => loadScores()).subscribe(),
      supabase.channel('lb-se').on('postgres_changes', { event: '*', schema: 'public', table: 'score_events' }, () => loadScores()).subscribe(),
    ];

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [activeEvent]);

  const medalEmojis = ['🥇', '🥈', '🥉'];

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  // Get a short round label from the round name
  const getRoundLabel = (roundId: string) => {
    if (roundId === 'adjustments') return '±';
    const round = rounds.find(r => r.id === roundId);
    if (!round) return roundId.slice(0, 4);
    // Extract "Stage X" or "Round X" pattern, or use order_index
    return `R${round.order_index}`;
  };

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Master Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Live aggregated scores for {activeEvent.name}
            {lastUpdated && (
              <span className="text-gray-400 ml-2">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); loadScores(); }}
            className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            ↻ Refresh
          </button>
          <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700 font-bold uppercase tracking-wide">Live</span>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-5">
          <div className="text-3xl font-black text-blue-700 font-heading">{scores.length}</div>
          <div className="text-xs text-blue-500 font-bold uppercase tracking-wide mt-1">Teams</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 p-5">
          <div className="text-3xl font-black text-amber-700 font-heading">
            {scores.length > 0 ? scores[0].total_score.toFixed(1) : '0'}
          </div>
          <div className="text-xs text-amber-500 font-bold uppercase tracking-wide mt-1">Top Score</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 p-5">
          <div className="text-3xl font-black text-green-700 font-heading">
            {scores.filter(s => s.total_score > 0).length}
          </div>
          <div className="text-xs text-green-500 font-bold uppercase tracking-wide mt-1">Active Scorers</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading scores...</div>
      ) : scores.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-sm text-gray-500 font-semibold">No teams found for this event</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_repeat(auto-fill,100px)_120px] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50"
            style={{ gridTemplateColumns: `60px 1fr ${rounds.map(() => '80px').join(' ')} 120px` }}
          >
            <span>Rank</span>
            <span>Team</span>
            {rounds.sort((a, b) => a.order_index - b.order_index).map(r => (
              <span key={r.id} className="text-center" title={r.name}>R{r.order_index}</span>
            ))}
            <span className="text-right">Total</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {scores.map((team, i) => (
              <div
                key={team.team_id}
                className={`grid px-6 py-4 items-center transition-all hover:bg-gray-50 ${
                  i < 3 ? 'bg-orange-50/30' : ''
                }`}
                style={{ gridTemplateColumns: `60px 1fr ${rounds.map(() => '80px').join(' ')} 120px` }}
              >
                {/* Rank */}
                <div>
                  {i < 3 ? (
                    <span className="text-xl">{medalEmojis[i]}</span>
                  ) : (
                    <span className="text-sm font-black text-gray-400 font-heading">#{i + 1}</span>
                  )}
                </div>

                {/* Team Name */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    i < 3
                      ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="text-sm font-black font-heading">
                      {team.team_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{team.team_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {team.status === 'SUSPENDED' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold">FROZEN</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-round scores */}
                {rounds.sort((a, b) => a.order_index - b.order_index).map(r => {
                  const roundScore = team.round_scores[r.id] || 0;
                  return (
                    <div key={r.id} className="text-center">
                      <span className={`text-sm font-bold ${roundScore > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                        {roundScore > 0 ? roundScore.toFixed(1) : '—'}
                      </span>
                    </div>
                  );
                })}

                {/* Total Score */}
                <div className="text-right">
                  <span className={`text-lg font-black font-heading ${
                    i === 0 ? 'text-orange-600' : i < 3 ? 'text-gray-800' : 'text-gray-600'
                  }`}>
                    {team.total_score.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
