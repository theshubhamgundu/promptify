import { useState, useEffect } from 'react';
import { RoundLayout } from '../components/RoundLayout';
import { Button, Card, Toast } from '../components/ui';
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

  if (loading && !round) {
    return <div className="p-6">Loading round configuration...</div>;
  }

  if (!round) {
    return <div className="p-6">Round not found.</div>;
  }

  return (
    <>
      {phase === 'briefing' && (
        <RoundLayout title={round.name} subtitle={round.description || ''}>
          <Card className="p-8 text-center max-w-2xl mx-auto mt-10">
            <h3 className="text-2xl font-bold font-heading mb-4">Ready to start?</h3>
            <p className="text-gray-500 mb-8">
              This round has {challenges.length} challenges. 
              You have {round.duration_minutes} minutes to complete them once you begin.
            </p>
            <Button onClick={handleStart} className="px-8 py-3 text-lg" disabled={loading}>
              {loading ? "Starting..." : "Begin Round →"}
            </Button>
          </Card>
        </RoundLayout>
      )}

      {phase === 'workspace' && challenges.length > 0 && (
        <RoundLayout 
          title={round.name}
          headerChildren={
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-heading font-bold">Time Remaining</div>
              <div className="text-2xl font-bold font-mono tracking-tight text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">
                {minutes}:{seconds}
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest font-heading mb-3">Challenge {currentChallengeIdx + 1} of {challenges.length}</div>
                <h3 className="text-xl font-bold text-gray-900 font-heading mb-2">{challenges[currentChallengeIdx].title}</h3>
                <div className="text-sm text-gray-600 prose prose-sm">
                  {challenges[currentChallengeIdx].description}
                </div>
              </Card>
            </div>
            
            <div className="lg:col-span-2 flex flex-col gap-4 h-[600px]">
              <Card className="flex-1 flex flex-col bg-white overflow-hidden p-5">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest font-heading mb-3">Your Answer</div>
                <textarea
                  className="w-full flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  placeholder="Type your answer or prompt here..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    Type: {challenges[currentChallengeIdx].type}
                  </span>
                  <Button onClick={handleSubmit} disabled={submitting || !answer.trim()}>
                    {submitting ? "Evaluating..." : "Submit Answer"}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </RoundLayout>
      )}

      {phase === 'result' && (
        <RoundLayout title={round.name} subtitle="Round Complete">
          <Card className="p-12 text-center max-w-2xl mx-auto mt-10">
            <div className="text-6xl mb-6">🏆</div>
            <h3 className="text-3xl font-bold font-heading mb-4">Round Completed!</h3>
            <p className="text-gray-500 mb-8">
              Great work. Your score has been submitted to the leaderboard.
            </p>
            <Button onClick={() => navigate('rounds')} variant="outline" className="px-8 py-3">
              Back to Overview
            </Button>
          </Card>
        </RoundLayout>
      )}

      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
