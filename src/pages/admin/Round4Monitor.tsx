import { useState, useEffect } from 'react';
import { Button, Modal, TextInput } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  UsersIcon,
  ClockIcon,
  ShieldIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SearchIcon,
  RefreshIcon
} from '../../components/icons';
import type { Page } from '../../components/Layout';

interface Round4MonitorProps {
  navigate: (p: Page) => void;
}

export default function Round4Monitor({ navigate }: Round4MonitorProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamSession, setSelectedTeamSession] = useState<any>(null);
  const [extendingMinutes, setExtendingMinutes] = useState('5');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch Round 4 challenges and active sessions
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get Round 4
      const { data: rData } = await supabase
        .from('rounds')
        .select('id, name')
        .eq('type', 'AI_ADVERSARIAL')
        .single();

      if (rData) {
        // Fetch Challenges
        const { data: cData } = await supabase
          .from('challenges')
          .select('id, title, type, base_points, order_index')
          .eq('round_id', rData.id)
          .order('order_index', { ascending: true });

        setChallenges(cData || []);

        // Fetch Teams
        const { data: tData } = await supabase
          .from('teams')
          .select('id, name, access_code');

        setTeams(tData || []);

        // Fetch Challenge Sessions
        const { data: csData } = await supabase
          .from('challenge_sessions')
          .select('*')
          .order('updated_at', { ascending: false });

        setSessions(csData || []);
      }
    } catch (err) {
      console.error('Error loading Round 4 monitor data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Realtime subscription to challenge_sessions
    const sub = supabase
      .channel('admin-round4-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_sessions' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  // Admin Controls
  const handleExtendTime = async () => {
    if (!selectedTeamSession) return;
    setIsProcessing(true);

    try {
      const minutes = parseInt(extendingMinutes, 10) || 5;
      const currentDeadline = new Date(selectedTeamSession.deadline_at);
      const newDeadline = new Date(currentDeadline.getTime() + minutes * 60000).toISOString();

      await supabase
        .from('challenge_sessions')
        .update({ deadline_at: newDeadline, status: 'IN_PROGRESS' })
        .eq('id', selectedTeamSession.id);

      // Audit Log
      await supabase.from('activity_logs').insert({
        team_id: selectedTeamSession.team_id,
        action: 'ADMIN_TIME_EXTENDED',
        details: { minutesAdded: minutes, newDeadline }
      });

      setSelectedTeamSession(null);
      loadData();
    } catch (err) {
      console.error('Failed to extend time:', err);
      alert('Error extending time');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAttempts = async () => {
    if (!selectedTeamSession) return;
    if (!confirm('Are you sure you want to reset attempts for this challenge?')) return;

    setIsProcessing(true);
    try {
      await supabase
        .from('challenge_sessions')
        .update({ attempts_used: 0, status: 'IN_PROGRESS' })
        .eq('id', selectedTeamSession.id);

      setSelectedTeamSession(null);
      loadData();
    } catch (err) {
      console.error('Failed to reset attempts:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.access_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono font-bold text-orange-500 uppercase tracking-widest">
            LIVE TELEMETRY
          </div>
          <h1 className="text-2xl font-black font-heading text-white">
            Round 4: AI Adversarial Live Monitor
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            <TextInput
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search team..."
              className="pl-9 bg-gray-900 border-gray-800 text-xs py-2"
            />
          </div>
          <Button onClick={loadData} variant="outline" className="text-xs py-2 flex items-center gap-1.5">
            <RefreshIcon className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Monitor Grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-black/60 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="p-4">TEAM NAME</th>
                <th className="p-4">R4.1 PROMPT BREACH</th>
                <th className="p-4">R4.2 CIPHER</th>
                <th className="p-4">R4.3 TURING TEST</th>
                <th className="p-4">R4.4 PROMPT ZIPPER</th>
                <th className="p-4 text-right">TOTAL SCORE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTeams.map(team => {
                const teamSessions = sessions.filter(s => s.team_id === team.id);
                const totalScore = teamSessions.reduce((acc, s) => acc + (s.score || 0), 0);

                return (
                  <tr key={team.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{team.name}</div>
                      <div className="text-[10px] text-gray-500">{team.access_code}</div>
                    </td>

                    {/* Challenges R4.1 to R4.4 */}
                    {challenges.map(c => {
                      const cSession = teamSessions.find(s => s.challenge_id === c.id);

                      if (!cSession) {
                        return (
                          <td key={c.id} className="p-4 text-gray-600">
                            <span className="text-[11px] font-mono">Not Started</span>
                          </td>
                        );
                      }

                      const isTimeout = cSession.status === 'TIMEOUT';
                      const isCompleted = cSession.status === 'COMPLETED';

                      return (
                        <td key={c.id} className="p-4">
                          <button
                            onClick={() => setSelectedTeamSession({ ...cSession, teamName: team.name, challengeTitle: c.title })}
                            className="text-left group cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              {isCompleted ? (
                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                              ) : isTimeout ? (
                                <ExclamationCircleIcon className="w-3.5 h-3.5 text-red-400" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                              )}
                              <span className={`font-bold ${
                                isCompleted ? 'text-emerald-400' : isTimeout ? 'text-red-400' : 'text-orange-400'
                              }`}>
                                {cSession.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-300">
                              Score: <span className="font-bold text-white">+{cSession.score || 0}</span> | Att: {cSession.attempts_used || 0}
                            </div>
                          </button>
                        </td>
                      );
                    })}

                    <td className="p-4 text-right font-bold text-base text-orange-400">
                      {totalScore} PTS
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Action Modal for Selected Challenge Session */}
      {selectedTeamSession && (
        <Modal
          title={`Override Controls: ${selectedTeamSession.teamName}`}
          onClose={() => setSelectedTeamSession(null)}
        >
          <div className="space-y-4 p-2 text-xs font-mono">
            <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl space-y-1">
              <div className="text-gray-400">CHALLENGE: <span className="text-white font-bold">{selectedTeamSession.challengeTitle}</span></div>
              <div className="text-gray-400">CURRENT STATUS: <span className="text-orange-400 font-bold">{selectedTeamSession.status}</span></div>
              <div className="text-gray-400">CURRENT SCORE: <span className="text-white font-bold">{selectedTeamSession.score || 0} pts</span></div>
              <div className="text-gray-400">DEADLINE: <span className="text-gray-300">{new Date(selectedTeamSession.deadline_at).toLocaleTimeString()}</span></div>
            </div>

            <div className="space-y-2">
              <label className="text-gray-300 block font-bold">Extend Time Limit (Minutes):</label>
              <div className="flex items-center gap-2">
                <TextInput
                  type="number"
                  value={extendingMinutes}
                  onChange={e => setExtendingMinutes(e.target.value)}
                  className="w-28 bg-black/60 border-gray-700"
                />
                <Button onClick={handleExtendTime} disabled={isProcessing} className="bg-orange-500 hover:bg-orange-600">
                  + Add Minutes
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-800 flex justify-between">
              <Button variant="outline" onClick={handleResetAttempts} disabled={isProcessing} className="text-red-400 border-red-900 hover:bg-red-950">
                Reset Attempts to 0
              </Button>
              <Button variant="outline" onClick={() => setSelectedTeamSession(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
