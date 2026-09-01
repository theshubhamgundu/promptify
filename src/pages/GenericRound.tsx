import { useState, useEffect } from 'react';
import { Button, Toast } from '../components/ui';
import { useTeamStore } from '../stores/teamStore';
import { RoundEngine, Round, Challenge } from '../lib/round-engine';
import { useServerCountdown } from '../hooks/useServerTimer';
import type { Page } from '../components/Layout';
import { supabase } from '../lib/supabase';

type RoundPhase = 'briefing' | 'workspace' | 'result';

export default function GenericRound({ roundId, navigate }: { roundId: string, navigate: (p: Page) => void }) {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const [round, setRound] = useState<Round | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [phase, setPhase] = useState<RoundPhase>('briefing');
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [roundSession, setRoundSession] = useState<any | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'warning'} | null>(null);
  
  // Calculate end time based on session start time and round duration
  const endTimeStr = roundSession && round 
    ? new Date(new Date(roundSession.started_at).getTime() + round.duration_minutes * 60000).toISOString()
    : new Date().toISOString(); // Fallback, won't be used until phase is workspace

  const { minutes, seconds, percent } = useServerCountdown(endTimeStr, round?.duration_minutes ? round.duration_minutes * 60 : 30 * 60);

  useEffect(() => {
    async function load() {
      if (!roundId || !currentTeam) return;
      try {
        setLoading(true);
        const r = await RoundEngine.getRound(roundId);
        const c = await RoundEngine.getChallenges(roundId);
        setRound(r);
        setChallenges(c);

        const { data: session } = await supabase
          .from('round_sessions')
          .select('*')
          .eq('team_id', currentTeam.id)
          .eq('round_id', roundId)
          .single();

        if (session && session.started_at) {
          setRoundSession(session);
          setPhase('workspace');
        }
      } catch (e) {
        console.error("Failed to load round", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [roundId, currentTeam]);

  const handleStart = async () => {
    if (!currentTeam || !round) return;
    try {
      setLoading(true);
      const session = await RoundEngine.startRoundSession(currentTeam.id, round.id);
      setRoundSession(session);
      setPhase('workspace');
    } catch (e) {
      console.error("Failed to start session", e);
      setToast({ msg: "Failed to start round", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentTeam || !roundSession) return;
    
    const currentChallenge = challenges[currentChallengeIdx];
    if (!currentChallenge) return;

    setSubmitting(true);
    try {
      const res = await RoundEngine.submitAnswer(currentTeam.id, roundSession.id, currentChallenge, answer, 1, 0);
      
      if (res.evaluation.passed) {
        setToast({ msg: `Correct! +${res.evaluation.score} points`, type: "success" });
        if (currentChallengeIdx < challenges.length - 1) {
          setCurrentChallengeIdx(prev => prev + 1);
          setAnswer('');
        } else {
          setPhase('result');
        }
      } else {
        setToast({ msg: `Incorrect: ${res.evaluation.feedback}`, type: "error" });
      }
    } catch (e) {
      console.error(e);
      setToast({ msg: "Submission failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndRound = async () => {
    try {
      if (roundSession?.id) {
        await supabase.rpc('submit_round_session', { p_round_session_id: roundSession.id });
      }
    } catch (err) {
      console.warn('End round failed:', err);
    }
    navigate('dashboard');
  };

  if (loading && !round) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading round configuration...</p>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Round not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {phase === 'briefing' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900 font-heading mb-2">{round.name}</h3>
            <p className="text-gray-500 mb-6">{round.description}</p>
            <p className="text-sm text-gray-500 mb-8">
              {challenges.length} challenges · {round.duration_minutes} minutes once you begin.
            </p>
            <Button onClick={handleStart} className="px-8 py-3 text-lg" disabled={loading}>
              {loading ? 'Starting...' : 'Begin Round →'}
            </Button>
          </div>
        </div>
      )}

      {phase === 'workspace' && challenges.length > 0 && (
        <div className="flex-1 flex min-h-0">
          <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">{round.name}</h2>
              <p className="text-sm text-gray-500">Challenge {currentChallengeIdx + 1} of {challenges.length}</p>
            </div>
            <div className="p-4 space-y-2 flex-1 overflow-y-auto">
              {challenges.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => { setCurrentChallengeIdx(i); setAnswer(''); }}
                  className={`w-full text-left p-3 rounded-lg border-2 ${
                    i === currentChallengeIdx ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">{c.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{c.base_points} pts</div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button onClick={handleEndRound} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                Submit Final
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{challenges[currentChallengeIdx].title}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{round.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 px-4 py-2 rounded-lg font-mono text-lg font-bold text-blue-900">
                  {minutes}:{seconds}
                </div>
                <button onClick={handleEndRound} className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                  End Round
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto grid grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                  <h3 className="font-bold text-lg text-gray-900 mb-3">Challenge</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {challenges[currentChallengeIdx].description}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-lg text-gray-900 mb-3">Your Answer</h3>
                  <textarea
                    className="w-full flex-1 min-h-[220px] resize-none bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm text-gray-900 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="Type your answer here..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleSubmit} disabled={submitting || !answer.trim()}>
                      {submitting ? 'Evaluating...' : 'Submit Answer'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <h3 className="text-3xl font-bold font-heading text-gray-900 mb-3">Round Completed</h3>
            <p className="text-gray-500 mb-8">Your score has been submitted to the leaderboard.</p>
            <Button onClick={() => navigate('dashboard')} className="px-8 py-3">
              Back to Dashboard
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
