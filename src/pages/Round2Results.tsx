import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { CheckCircleIcon, CircleIcon, AlertTriangleIcon } from '../components/icons';

interface Round2ResultsProps {
  roundId: string;
  navigate: (page: any) => void;
}

export default function Round2Results({ roundId, navigate }: Round2ResultsProps) {
  const { currentTeam } = useTeamStore();
  
  const [session, setSession] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTeam?.id || !roundId) return;
    loadResults();
  }, [currentTeam?.id, roundId]);

  const loadResults = async () => {
    try {
      setLoading(true);

      // Load session
      const { data: sessionData, error: sessionError } = await supabase
        .from('round2_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Load all submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('round2_submissions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .order('created_at', { ascending: true });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

    } catch (err: any) {
      console.error('Error loading results:', err);
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0F1E]">
        <div className="text-[#00F0FF] text-xl">Loading results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0F1E]">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  const totalScore = session?.total_score || 0;
  const subRoundScores = [
    session?.sub_round_1_score || 0,
    session?.sub_round_2_score || 0,
    session?.sub_round_3_score || 0,
    session?.sub_round_4_score || 0
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#00F0FF] mb-2">Round 2: Prompt Heist</h1>
          <p className="text-2xl text-gray-300">Complete!</p>
        </div>

        {/* Total Score Card */}
        <div className="bg-gradient-to-br from-[#00F0FF]/20 to-[#1A1F2E] border-2 border-[#00F0FF] rounded-xl p-8 mb-8 text-center">
          <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Total Score</p>
          <p className="text-6xl font-bold text-[#00F0FF]">{totalScore.toFixed(1)}</p>
          <p className="text-gray-400 mt-2">out of 800 points</p>
        </div>

        {/* Sub-Round Scores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {['Precision', 'Constraint', 'Context', 'Debugging'].map((type, idx) => (
            <div key={idx} className="bg-[#1A1F2E]/60 border border-[#00F0FF]/20 rounded-lg p-6 text-center">
              <p className="text-gray-400 text-sm mb-2">Sub-Round {idx + 1}</p>
              <p className="text-[#00F0FF] font-semibold mb-1">{type}</p>
              <p className="text-3xl font-bold text-white">{subRoundScores[idx].toFixed(1)}</p>
              <p className="text-gray-400 text-sm mt-1">/ 200</p>
            </div>
          ))}
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-[#1A1F2E]/60 border border-[#00F0FF]/20 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-[#00F0FF] mb-6">Question Breakdown</h2>
          
          <div className="space-y-4">
            {submissions.map((sub, idx) => {
              const details = sub.evaluation_details || {};
              const breakdown = details.breakdown || {};
              
              return (
                <div key={sub.id} className="bg-[#0A0F1E]/60 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500" />
                      <div>
                        <p className="font-semibold text-white">Question {idx + 1}</p>
                        <p className="text-sm text-gray-400">{sub.time_taken_seconds}s</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#00F0FF]">{sub.total_score.toFixed(1)}</p>
                      <p className="text-sm text-gray-400">/ 50</p>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Hidden Tests</p>
                      <p className="text-white font-semibold">{(breakdown.hiddenTestScore || 0).toFixed(1)} / 32</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Constraints</p>
                      <p className="text-white font-semibold">{(breakdown.constraintScore || 0).toFixed(1)} / 10</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Grammar</p>
                      <p className="text-white font-semibold">{(breakdown.grammarScore || 0).toFixed(1)} / 10</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Time Bonus</p>
                      <p className="text-white font-semibold">{(breakdown.timeBonus || 0).toFixed(1)} / 2.5</p>
                    </div>
                  </div>

                  {/* Feedback */}
                  {details.feedback && details.feedback.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <p className="text-sm text-yellow-400 font-semibold mb-1">Feedback:</p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {details.feedback.map((fb: string, i: number) => (
                          <li key={i}>• {fb}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate({ type: 'dashboard' })}
            className="px-8 py-3 bg-[#00F0FF] text-[#0A0F1E] font-semibold rounded-lg hover:bg-[#00D4E6] transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
