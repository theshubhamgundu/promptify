import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, ConfirmDialog, AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { useAuthStore } from '../../stores/authStore';
import { applyPenalty, toggleTeamStatus } from '../../lib/services/adminService';

interface TeamScore {
  team_id: string;
  team_name: string;
  total_score: number;
  base_score: number;
  adjustments: number;
  rounds_completed: number;
  status?: string;
}

export default function AdminLeaderboard({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const { user } = useAuthStore();
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Override Modal
  const [showOverride, setShowOverride] = useState<{ teamId: string, teamName: string, currentScore: number } | null>(null);
  const [pointsDelta, setPointsDelta] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadScores = async () => {
    if (!activeEvent) return;
    
    // 1. Get teams for active event
    const { data: teams } = await supabase.from('teams').select('id, name, status').eq('event_id', activeEvent.id);
    if (!teams || teams.length === 0) {
      setScores([]);
      setLoading(false);
      return;
    }
    
    const teamIds = teams.map(t => t.id);
    const teamInfo = new Map(teams.map(t => [t.id, { name: t.name, status: t.status }]));

    // 2. Get evaluated submissions (Base score)
    const { data: submissions } = await supabase
      .from('vw_all_submissions')
      .select('team_id, score, status, round_id')
      .eq('status', 'EVALUATED')
      .in('team_id', teamIds);

    // 3. Get score events (Adjustments)
    const { data: scoreEvents } = await supabase
      .from('score_events')
      .select('team_id, points, event_type')
      .in('team_id', teamIds);

    const scoreMap = new Map<string, { base: number; adj: number; rounds: Set<string> }>();
    
    teamIds.forEach(id => scoreMap.set(id, { base: 0, adj: 0, rounds: new Set() }));

    if (submissions) {
      submissions.forEach(s => {
        const entry = scoreMap.get(s.team_id)!;
        entry.base += (s.score || 0);
        if (s.round_id) entry.rounds.add(s.round_id);
      });
    }

    if (scoreEvents) {
      scoreEvents.forEach(se => {
        const entry = scoreMap.get(se.team_id)!;
        entry.adj += (se.points || 0);
      });
    }

    const ranked = Array.from(scoreMap.entries())
  .map(([teamId, data]) => ({
    team_id: teamId,
    team_name: teamInfo.get(teamId)?.name || 'Unknown',
    status: teamInfo.get(teamId)?.status,
    base_score: data.base,
    adjustments: data.adj,
    total_score: data.base + data.adj,
    rounds_completed: data.rounds.size,
  }))
  .sort((a, b) => b.total_score - a.total_score);

    setScores(ranked);
    setLoading(false);
  };

  useEffect(() => {
    loadScores();

    // Subscribe to both submissions and score_events
    const subChannel = supabase.channel('admin-leaderboard-subs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => { loadScores(); })
      .subscribe();
      
    const scoreChannel = supabase.channel('admin-leaderboard-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_events' }, () => { loadScores(); })
      .subscribe();

    return () => { 
      supabase.removeChannel(subChannel); 
      supabase.removeChannel(scoreChannel); 
    };
  }, [activeEvent]);

  const handleOverride = async () => {
    if (!showOverride || !pointsDelta || !overrideReason || !user) return;
    setSaving(true);
    
    const points = parseInt(pointsDelta);
    
    // Insert into score_events ledger
    const { error } = await supabase.from('score_events').insert({
      team_id: showOverride.teamId,
      event_type: 'ADMIN_ADJUSTMENT',
      points: points,
      reason: overrideReason,
      admin_id: user?.id
    });
    
    if (!error) {
      await supabase.from('activity_logs').insert({
        action: 'SCORE_OVERRIDE',
        details: { team_id: showOverride.teamId, points_delta: points, reason: overrideReason }
      });
      setShowOverride(null);
      setPointsDelta('');
      setOverrideReason('');
      await loadScores(); // Force reload
    }
    
    setSaving(false);
  };

  const toggleFreeze = async (teamId: string) => {
    // get current status
    const { data } = await supabase.from('teams').select('status').eq('id', teamId).single();
    if (data) {
      const newStatus = data.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await supabase.from('teams').update({ status: newStatus }).eq('id', teamId);
      
      await supabase.from('activity_logs').insert({
        action: newStatus === 'SUSPENDED' ? 'TEAM_FROZEN' : 'TEAM_UNFROZEN',
        team_id: teamId,
        details: { admin_id: user?.id }
      });
      
      // Optionally we might want to also push an announcement or revoke session.
    }
  };

  const medalColors = ['from-amber-300 to-yellow-500', 'from-gray-300 to-gray-400', 'from-orange-500 to-orange-700'];
  const medalEmojis = ['🥇', '🥈', '🥉'];

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Master Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time scores with ledger-based adjustments for {activeEvent.name}</p>
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
          <div className="text-sm text-gray-500 font-semibold">No teams or scores yet</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_120px_120px_120px] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50">
            <span>Rank</span>
            <span>Team</span>
            <span className="text-right">Base</span>
            <span className="text-right">Adjustments</span>
            <span className="text-right">Total Score</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {scores.map((team, i) => (
              <div 
                key={team.team_id}
                className={`grid grid-cols-[60px_1fr_120px_120px_120px] px-6 py-4 items-center transition-all hover:bg-gray-50 group ${
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 font-mono">{team.team_id.slice(0, 8)}</span>
                      {team.rounds_completed > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">{team.rounds_completed} ROUNDS</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Base Score */}
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-500">{team.base_score}</span>
                </div>

                {/* Adjustments */}
                <div className="text-right">
                  <span className={`text-sm font-bold ${team.adjustments > 0 ? 'text-green-500' : team.adjustments < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {team.adjustments > 0 ? '+' : ''}{team.adjustments}
                  </span>
                </div>

                {/* Total Score & Actions */}
                <div className="text-right flex items-center justify-end gap-3">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2">
                    <button 
                      onClick={() => navigate(`admin-team-${team.team_id}` as Page)}
                      className="px-2 py-1.5 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    >
                      View
                    </button>
                      <button 
                        onClick={() => {
                          const points = prompt('Enter penalty points (positive number):');
                          const reason = prompt('Reason for penalty (audit):');
                          if (points && reason) {
                            applyPenalty(team.team_id, parseInt(points), reason).then(() => loadScores());
                          }
                        }}
                        className="px-2 py-1.5 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Apply penalty to team"
                      >
                        Penalty
                      </button>
                    <button 
                      onClick={() => toggleTeamStatus(team.team_id, team.status)}
                      className="px-2 py-1.5 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
                      title={team.status === 'SUSPENDED' ? 'Unfreeze team' : 'Freeze team'}
                    >
                      {team.status === 'SUSPENDED' ? 'Unfreeze' : 'Freeze'}
                    </button>
                    <button 
                      onClick={() => setShowOverride({ teamId: team.team_id, teamName: team.team_name, currentScore: team.total_score })}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 border border-transparent text-[10px] font-bold text-gray-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-all"
                    >
                      Adjust
                    </button>
                  </div>
                  <span className={`text-xl font-black font-heading w-16 ${
                    i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-orange-600' : 'text-gray-900'
                  }`}>
                    <AnimatedNumber to={team.total_score} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverride && (
        <Modal title="Score Adjustment" onClose={() => setShowOverride(null)} size="sm" footer={
          <>
            <Button variant="outline" onClick={() => setShowOverride(null)}>Cancel</Button>
            <Button onClick={handleOverride} disabled={saving || !pointsDelta || !overrideReason}>Apply Adjustment</Button>
          </>
        }>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Team</div>
              <div className="text-sm font-bold text-gray-900">{showOverride.teamName}</div>
              <div className="text-xs text-gray-500 mt-1">Current Score: <span className="font-bold text-gray-900">{showOverride.currentScore} pts</span></div>
            </div>
            
            <FormField label="Points (+/-)" required>
              <TextInput type="number" value={pointsDelta} onChange={setPointsDelta} placeholder="e.g. -50 or 100" />
            </FormField>
            <FormField label="Reason (Audit Ledger)" required>
              <TextArea value={overrideReason} onChange={setOverrideReason} rows={2} placeholder="Explain why this adjustment is being made..." />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
