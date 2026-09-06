import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { useServerCountdown } from '../hooks/useServerTimer';
import { ConfirmDialog } from '../components/ui';
import { sounds } from '../lib/sound';
import {
  EyeIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
  AlertTriangleIcon, ArrowRightIcon, ZapIcon, TargetIcon,
  LockIcon, SendIcon, PlayIcon, VolumeIcon, VolumeXIcon,
} from '../components/icons';
import type { Page } from '../components/Layout';

// ── Types ─────────────────────────────────────────────────────────────
interface Challenge {
  id: string;
  title: string;
  description: string;
  order_index: number;
  base_points: number;
  max_attempts: number;
  configuration: {
    mediaUrl: string;
    mediaType: 'image' | 'video';
    evaluationType: 'EXACT_MATCH' | 'NUMERIC' | 'NORMALIZED_TEXT';
    correctAnswer: string;
    instructions?: string;
    scoring?: {
      basePoints: number;
      attemptBonuses: number[];
      speedBonuses: { maxSeconds: number; bonus: number }[];
      hintPenalties?: number[];
    };
  };
}

interface ChallengeSession {
  id: string;
  challenge_id: string;
  started_at: string;
  completed_at: string | null;
  deadline_at: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'TIMEOUT';
  total_time_seconds: number | null;
  attempts_used: number;
  is_correct: boolean;
  score: number;
}

interface SubmissionResult {
  success: boolean;
  isCorrect?: boolean;
  score?: number;
  attemptNumber?: number;
  attemptsRemaining?: number;
  timeTaken?: number;
  status?: string;
  error?: string;
}

// ── Component ─────────────────────────────────────────────────────────
export default function VisionRound({ roundId, navigate }: { roundId: string; navigate: (p: Page) => void }) {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const dbRounds = useEventStore(s => s.rounds);

  const [round, setRound] = useState<any>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeSessions, setChallengeSessions] = useState<ChallengeSession[]>([]);
  const [roundSession, setRoundSession] = useState<any>(null);

  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [phase, setPhase] = useState<'briefing' | 'active' | 'result' | 'complete'>('briefing');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [totalScore, setTotalScore] = useState(0);

  const answerRef = useRef<HTMLInputElement>(null);
  const currentChallenge = challenges[currentChallengeIdx] || null;
  const currentSession = challengeSessions.find(s => s.challenge_id === currentChallenge?.id) || null;

  const [soundMuted, setSoundMuted] = useState(sounds.isMuted());

  // ── Timer ─────────────────────────────────────────────────────────
  const deadlineStr = currentSession?.deadline_at || null;
  const { minutes, seconds: secs, total: timerTotal, percent: timerPercent } = useServerCountdown(
    deadlineStr,
    8 * 60,
    () => handleTimeout()
  );

  // Sound cue when under 60 seconds
  const lastUrgentSec = useRef<number | null>(null);
  useEffect(() => {
    if (phase === 'active' && timerTotal > 0 && timerTotal <= 60 && timerTotal % 15 === 0) {
      if (lastUrgentSec.current !== timerTotal) {
        lastUrgentSec.current = timerTotal;
        sounds.timeUrgent();
      }
    }
  }, [phase, timerTotal]);

  // Sound cue on completion
  useEffect(() => {
    if (phase === 'complete') {
      sounds.victory();
    }
  }, [phase]);

  // Mark round as completed when phase changes to complete
  useEffect(() => {
    if (phase === 'complete' && roundSession?.id && roundSession.status !== 'COMPLETED') {
      supabase
        .from('round_sessions')
        .update({ 
          status: 'COMPLETED', 
          completed_at: new Date().toISOString(),
          score: totalScore 
        })
        .eq('id', roundSession.id)
        .then(() => console.log('Round marked as COMPLETED'));
    }
  }, [phase, roundSession?.id, roundSession?.status, totalScore]);

  // ── Load round data ───────────────────────────────────────────────
  useEffect(() => {
    if (!roundId || !currentTeam) return;

    async function load() {
      setLoading(true);

      // Get round info
      const roundInfo = dbRounds.find(r => r.id === roundId);
      setRound(roundInfo || null);

      // Get challenges for this round
      const { data: challengeData } = await supabase
        .from('challenges')
        .select('*')
        .eq('round_id', roundId)
        .order('order_index');

      if (challengeData) setChallenges(challengeData as Challenge[]);

      // Get or create round session
      let { data: rs } = await supabase
        .from('round_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .single();

      if (!rs) {
        const { data: newRs } = await supabase
          .from('round_sessions')
          .insert({ team_id: currentTeam!.id, round_id: roundId, started_at: new Date().toISOString() })
          .select()
          .single();
        rs = newRs;
      }
      setRoundSession(rs);

      // Get existing challenge sessions (only if round session exists)
      let sessions = null;
      if (rs?.id) {
        const { data: sessionData } = await supabase
          .from('challenge_sessions')
          .select('*')
          .eq('team_id', currentTeam!.id)
          .eq('round_session_id', rs.id);
        sessions = sessionData;
      }

      if (sessions) {
        setChallengeSessions(sessions as ChallengeSession[]);

        // Calculate total score
        const total = sessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
        setTotalScore(total);

        // Find the first incomplete challenge
        if (challengeData) {
          const firstIncomplete = challengeData.findIndex((c: any) =>
            !sessions.find((s: any) => s.challenge_id === c.id && s.status !== 'IN_PROGRESS')
          );

          if (firstIncomplete === -1) {
            // All challenges done
            setPhase('complete');
          } else {
            setCurrentChallengeIdx(firstIncomplete);
            const existingSession = sessions.find((s: any) => s.challenge_id === challengeData[firstIncomplete].id);
            if (existingSession) {
              setPhase('active');
            }
          }
        }
      }

      setLoading(false);
    }

    load();
  }, [roundId, currentTeam]);

  // ── Start a challenge ─────────────────────────────────────────────
  const startChallenge = useCallback(async () => {
    if (!currentTeam || !currentChallenge || !roundSession) return;
    sounds.start();

    const { data, error } = await supabase.rpc('start_challenge_session', {
      p_team_id: currentTeam.id,
      p_round_session_id: roundSession.id,
      p_challenge_id: currentChallenge.id,
      p_duration_minutes: 8,
    });

    if (error) {
      console.error('Failed to start challenge session:', error);
      sounds.error();
      return;
    }

    const session = data?.session;
    if (session) {
      setChallengeSessions(prev => {
        const exists = prev.find(s => s.challenge_id === currentChallenge.id);
        if (exists) return prev;
        return [...prev, session as ChallengeSession];
      });
    }

    setPhase('active');
    setAnswer('');
    setLastResult(null);
    setTimeout(() => answerRef.current?.focus(), 100);
  }, [currentTeam, currentChallenge, roundSession]);

  // ── Submit answer ─────────────────────────────────────────────────
  const submitAnswer = useCallback(async () => {
    if (!currentTeam || !currentChallenge || !roundSession || !answer.trim()) return;

    setSubmitting(true);
    setLastResult(null);
    sounds.click();

    // Get participant id
    const { data: participant } = await supabase
      .from('participants')
      .select('id')
      .eq('team_id', currentTeam.id)
      .limit(1)
      .single();

    const { data, error } = await supabase.rpc('evaluate_vision_submission', {
      p_team_id: currentTeam.id,
      p_challenge_id: currentChallenge.id,
      p_round_session_id: roundSession.id,
      p_participant_id: participant?.id || null,
      p_answer: answer.trim(),
    });

    setSubmitting(false);

    if (error) {
      sounds.error();
      setLastResult({ success: false, error: error.message });
      return;
    }

    const result = data as SubmissionResult;
    setLastResult(result);
    setAnswer('');

    if (result.isCorrect) {
      sounds.success();
    } else {
      sounds.error();
    }

    // Refresh challenge sessions
    const { data: sessions } = await supabase
      .from('challenge_sessions')
      .select('*')
      .eq('team_id', currentTeam.id)
      .eq('round_session_id', roundSession.id);

    if (sessions) {
      setChallengeSessions(sessions as ChallengeSession[]);
      const total = sessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
      setTotalScore(total);
    }

    if (result.status === 'COMPLETED') {
      setPhase('result');
    }
  }, [currentTeam, currentChallenge, roundSession, answer]);

  // ── Handle timeout ────────────────────────────────────────────────
  const handleTimeout = useCallback(() => {
    sounds.error();
    setPhase('result');
    setLastResult({ success: false, error: 'Time expired!', status: 'TIMEOUT' });
  }, []);

  // ── Advance to next challenge ─────────────────────────────────────
  const advanceToNext = useCallback(() => {
    sounds.click();
    if (currentChallengeIdx < challenges.length - 1) {
      setCurrentChallengeIdx(currentChallengeIdx + 1);
      setPhase('briefing');
      setLastResult(null);
      setAnswer('');
    } else {
      setPhase('complete');
    }
  }, [currentChallengeIdx, challenges.length]);

  const handleEndRound = async () => {
    try {
      if (roundSession?.id) {
        await supabase.rpc('submit_round_session', { p_round_session_id: roundSession.id });
      }
    } catch (err) {
      console.warn('End round submit failed:', err);
    }
    navigate('dashboard');
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Round 3...</p>
        </div>
      </div>
    );
  }

  // ── Round Complete ────────────────────────────────────────────────
  if (phase === 'complete') {
    const completedSessions = challengeSessions.filter(s => s.status !== 'IN_PROGRESS');
    const correctCount = completedSessions.filter(s => s.is_correct).length;
    const totalAttempts = completedSessions.reduce((sum, s) => sum + s.attempts_used, 0);
    const totalTime = completedSessions.reduce((sum, s) => sum + (s.total_time_seconds || 0), 0);
    const accuracy = completedSessions.length > 0 ? Math.round((correctCount / completedSessions.length) * 100) : 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <EyeIcon className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading mb-1">Round Complete</h1>
            <p className="text-sm text-gray-500">Vision & Reasoning Challenge</p>
          </div>

          <div className="bg-orange-50 rounded-xl p-6 mb-6 text-center border border-orange-100">
            <div className="text-4xl font-black text-orange-600 font-heading">{totalScore}</div>
            <div className="text-sm text-orange-700 mt-1">Total Points</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-lg font-bold text-gray-900">{correctCount}/{challenges.length}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Correct</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-lg font-bold text-gray-900">{accuracy}%</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Accuracy</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-lg font-bold text-gray-900">{totalAttempts}/{challenges.length * 3}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Attempts</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-lg font-bold text-gray-900">{Math.floor(totalTime / 60)}m {totalTime % 60}s</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Time</div>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {challenges.map((c, i) => {
              const sess = challengeSessions.find(s => s.challenge_id === c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">{i + 1}</div>
                  <div className="flex-1 text-sm text-gray-700 truncate">{c.title}</div>
                  {sess?.is_correct ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                  )}
                  <div className="text-sm font-bold text-gray-900 w-12 text-right">{sess?.score || 0}</div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate('dashboard')}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Active Round UI ───────────────────────────────────────────────
  const attemptsUsed = currentSession?.attempts_used || 0;
  const maxAttempts = currentChallenge?.max_attempts || 3;
  const attemptsRemaining = maxAttempts - attemptsUsed;

  const timerColor = timerTotal > 300 ? 'text-green-700' : timerTotal > 120 ? 'text-amber-700' : 'text-red-700';
  const timerBox = timerTotal > 300 ? 'bg-green-50' : timerTotal > 120 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{round?.name || 'Round 3'}</h1>
          <p className="text-sm text-gray-600 mt-0.5">Challenge {currentChallengeIdx + 1} of {challenges.length}</p>
        </div>

        <div className="flex items-center gap-2">
          {challenges.map((c, i) => {
            const sess = challengeSessions.find(s => s.challenge_id === c.id);
            const isCurrent = i === currentChallengeIdx;
            const isComplete = sess?.status === 'COMPLETED' || sess?.status === 'TIMEOUT';
            const isCorrect = sess?.is_correct;
            return (
              <div
                key={c.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent
                    ? 'bg-orange-500 text-white'
                    : isComplete
                    ? isCorrect
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {isComplete ? (isCorrect ? '✓' : '✗') : i + 1}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className={`${timerBox} px-4 py-2 rounded-lg flex items-center gap-2`}>
            <ClockIcon className={`w-4 h-4 ${timerColor}`} />
            <span className={`text-lg font-mono font-bold ${timerColor}`}>
              {phase === 'active' ? `${minutes}:${secs}` : '08:00'}
            </span>
          </div>
          <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 text-center">
            <div className="text-lg font-bold text-gray-900 leading-none">{totalScore}</div>
            <div className="text-[9px] text-gray-500 uppercase mt-0.5">Score</div>
          </div>
          <button
            onClick={() => {
              const muted = sounds.toggleMute();
              setSoundMuted(muted);
            }}
            title={soundMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            {soundMuted ? <VolumeXIcon className="w-4 h-4 text-red-500" /> : <VolumeIcon className="w-4 h-4 text-gray-600" />}
          </button>
          <button
            onClick={handleEndRound}
            className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            End Round
          </button>
        </div>
      </div>

      {phase === 'active' && (
        <div className="h-1 bg-gray-200 flex-shrink-0">
          <div
            className={`h-full transition-all duration-1000 ${
              timerTotal > 300 ? 'bg-green-500' : timerTotal > 120 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {phase === 'briefing' ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <TargetIcon className="w-7 h-7 text-orange-500" />
                </div>
                <div className="text-xs text-orange-600 font-bold uppercase tracking-widest mb-2">
                  Challenge {currentChallengeIdx + 1} of {challenges.length}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 font-heading mb-2">
                  {currentChallenge?.title || 'Challenge'}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {currentChallenge?.description}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5 border border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ClockIcon className="w-4 h-4 text-amber-500" />
                  <span><strong>8 minutes</strong> to solve this challenge</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <TargetIcon className="w-4 h-4 text-red-500" />
                  <span><strong>3 attempts</strong> maximum</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <ZapIcon className="w-4 h-4 text-green-600" />
                  <span><strong>Speed & accuracy</strong> earn bonus points</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <BrainIconSVG className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-blue-900 mb-1">External AI Tools Allowed</div>
                    <div className="text-xs text-blue-800/80 leading-relaxed">
                      You may use ChatGPT, Gemini, Claude, or any other AI tool in a separate tab to analyze the media. Submit your final answer here.
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={startChallenge}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5" />
                Start Challenge
              </button>
            </div>
          </div>
        ) : phase === 'result' ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              {currentSession?.is_correct ? (
                <>
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-700 font-heading mb-2">Correct!</h2>
                  <div className="text-4xl font-black text-gray-900 font-heading mb-1">+{currentSession.score}</div>
                  <div className="text-sm text-gray-500 mb-4">points earned</div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="text-sm font-bold text-gray-900">{currentSession.attempts_used}</div>
                      <div className="text-[10px] text-gray-500">Attempts</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="text-sm font-bold text-gray-900">{Math.floor((currentSession.total_time_seconds || 0) / 60)}m {(currentSession.total_time_seconds || 0) % 60}s</div>
                      <div className="text-[10px] text-gray-500">Time</div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircleIcon className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-600 font-heading mb-2">
                    {currentSession?.status === 'TIMEOUT' ? "Time's Up!" : 'Not Solved'}
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    {currentSession?.status === 'TIMEOUT'
                      ? 'The 8-minute timer expired.'
                      : 'All 3 attempts were used.'}
                  </p>
                </>
              )}

              <button
                onClick={advanceToNext}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {currentChallengeIdx < challenges.length - 1 ? (
                  <>Next Challenge <ArrowRightIcon className="w-4 h-4" /></>
                ) : (
                  'View Final Results'
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                  {currentChallenge?.configuration?.mediaType === 'video' ? 'Video' : 'Image'} — Analyze carefully
                </div>
                <div className="text-xs text-gray-400">Click to open in a new tab</div>
              </div>
              <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-gray-50">
                {currentChallenge?.configuration?.mediaType === 'video' ? (
                  <video
                    src={currentChallenge.configuration.mediaUrl}
                    controls
                    className="max-w-full max-h-full rounded-xl shadow-sm border border-gray-200"
                  />
                ) : (
                  <img
                    src={currentChallenge?.configuration?.mediaUrl}
                    alt="Challenge media"
                    className="max-w-full max-h-full object-contain rounded-xl shadow-sm border border-gray-200 cursor-zoom-in bg-white"
                    onClick={() => {
                      window.open(currentChallenge?.configuration?.mediaUrl, '_blank');
                    }}
                  />
                )}
              </div>
            </div>

            <div className="w-[400px] flex-shrink-0 flex flex-col bg-white">
              <div className="p-5 border-b border-gray-100 overflow-y-auto" style={{ maxHeight: '45%' }}>
                <div className="text-xs text-orange-600 font-bold uppercase tracking-widest mb-2">
                  Challenge {currentChallengeIdx + 1}
                </div>
                <h2 className="text-xl font-bold text-gray-900 font-heading mb-3">
                  {currentChallenge?.title}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {currentChallenge?.description}
                </p>

                {currentChallenge?.configuration?.instructions && (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <div className="text-xs text-blue-900 leading-relaxed">
                      {currentChallenge.configuration.instructions}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 font-bold uppercase">Attempts</span>
                  <span className="text-xs text-gray-500">{attemptsUsed} / {maxAttempts} used</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: maxAttempts }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i < attemptsUsed ? 'bg-red-400' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {lastResult && (
                <div className={`px-5 py-3 border-b ${
                  lastResult.isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                }`}>
                  <div className="flex items-center gap-2">
                    {lastResult.isCorrect ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircleIcon className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm font-semibold ${lastResult.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {lastResult.isCorrect ? 'Correct!' : lastResult.error || 'Incorrect — try again'}
                    </span>
                  </div>
                  {lastResult.attemptsRemaining !== undefined && lastResult.attemptsRemaining > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {lastResult.attemptsRemaining} attempt{lastResult.attemptsRemaining !== 1 ? 's' : ''} remaining
                    </div>
                  )}
                </div>
              )}

              <div className="mt-auto p-5 border-t border-gray-100 bg-white">
                <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">
                  Your Answer
                </div>
                <div className="flex gap-2">
                  <input
                    ref={answerRef}
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && answer.trim() && !submitting) {
                        setShowConfirm(true);
                      }
                    }}
                    placeholder="Enter your answer..."
                    disabled={submitting || attemptsRemaining <= 0}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                  />
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!answer.trim() || submitting || attemptsRemaining <= 0}
                    className="px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <SendIcon className="w-4 h-4" />
                    )}
                    Submit
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 mt-2">
                  Each submission uses one attempt. {attemptsRemaining > 0 ? `${attemptsRemaining} remaining.` : 'No attempts remaining.'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Submit Answer?"
          message={`You are about to submit "${answer}" as your answer. This will use 1 of your ${attemptsRemaining} remaining attempts. Are you sure?`}
          confirmLabel="Submit"
          onConfirm={() => {
            setShowConfirm(false);
            submitAnswer();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// Simple Brain icon inline (since BrainIcon is a custom component, not from the `ic` helper)
function BrainIconSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5a3 3 0 10-5.997.125 4 4 0 00-2.526 5.77 4 4 0 00.556 6.588A4 4 0 1012 18z" />
      <path d="M12 5a3 3 0 115.997.125 4 4 0 012.526 5.77 4 4 0 01-.556 6.588A4 4 0 1112 18z" />
      <path d="M15 13a4.5 4.5 0 01-3-4 4.5 4.5 0 01-3 4" />
    </svg>
  );
}
