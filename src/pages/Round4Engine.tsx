import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import { sounds } from '../lib/sound';
import {
  ClockIcon,
  ShieldIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  VolumeIcon,
  VolumeXIcon,
  TrophyIcon,
  ZapIcon,
  TargetIcon
} from '../components/icons';
import type { Page } from '../components/Layout';
import { useTeamStore } from '../stores/teamStore';
import PromptBreachChallenge from '../components/round4/PromptBreachChallenge';
import CipherChallenge from '../components/round4/CipherChallenge';
import TuringTestChallenge from '../components/round4/TuringTestChallenge';
import PromptZipperChallenge from '../components/round4/PromptZipperChallenge';

interface Round4EngineProps {
  roundId: string;
  navigate: (p: Page) => void;
}

export default function Round4Engine({ roundId, navigate }: Round4EngineProps) {
  const currentTeam = useTeamStore(s => s.currentTeam);

  const [round, setRound] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [roundSession, setRoundSession] = useState<any>(null);
  const [challengeSession, setChallengeSession] = useState<any>(null);

  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes default
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(sounds.isMuted());
  const [isRoundFinished, setIsRoundFinished] = useState<boolean>(false);
  const [finalScore, setFinalScore] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleSound = () => {
    const nextMute = sounds.toggleMute();
    setIsMuted(nextMute);
  };

  // 1. Fetch Round and Challenges
  useEffect(() => {
    async function loadRoundData() {
      if (!currentTeam) return;

      setIsLoading(true);
      try {
        // Fetch Round
        const { data: rData } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', roundId)
          .single();

        setRound(rData);

        // Fetch Challenges ordered by index
        const { data: cData } = await supabase
          .from('challenges')
          .select('*')
          .eq('round_id', roundId)
          .order('order_index', { ascending: true });

        if (cData && cData.length > 0) {
          setChallenges(cData);
        }

        // Get or Create Round Session
        let { data: rsData } = await (supabase
          .from('round_sessions') as any)
          .select('*')
          .eq('team_id', currentTeam.id)
          .eq('round_id', roundId)
          .maybeSingle();

        if (!rsData) {
          const { data: newRs, error: insertErr } = await (supabase
            .from('round_sessions') as any)
            .insert({
              team_id: currentTeam.id,
              round_id: roundId,
              started_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();

          if (insertErr) {
            // If duplicate key error due to React Dev StrictMode double-mount, re-fetch existing session
            const { data: retryRs } = await (supabase
              .from('round_sessions') as any)
              .select('*')
              .eq('team_id', currentTeam.id)
              .eq('round_id', roundId)
              .maybeSingle();
            rsData = retryRs;
          } else {
            rsData = newRs;
          }
        }

        setRoundSession(rsData);

        if (rsData?.status === 'COMPLETED') {
          setIsRoundFinished(true);
          setFinalScore(rsData.score || 0);
        }

      } catch (err) {
        console.error('Error initializing Round 4:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadRoundData();
  }, [roundId, currentTeam]);

  // 2. Initialize / Sync Challenge Session whenever active challenge changes
  useEffect(() => {
    if (!challenges[currentIdx] || !roundSession || !currentTeam || isRoundFinished) return;

    const activeChallenge = challenges[currentIdx];

    async function initChallengeSession() {
      try {
        const { data, error } = await (supabase.rpc as any)('start_round4_challenge', {
          p_team_id: currentTeam!.id,
          p_round_session_id: roundSession.id,
          p_challenge_id: activeChallenge.id,
          p_duration_minutes: 10
        });

        if (error) throw error;

        if (data?.session) {
          setChallengeSession(data.session);

          // Calculate server-authoritative time remaining
          const deadline = new Date(data.session.deadline_at).getTime();
          const now = Date.now();
          const remainingSecs = Math.max(0, Math.floor((deadline - now) / 1000));

          setTimeLeft(remainingSecs);
          setIsTimedOut(remainingSecs <= 0 || data.session.status === 'TIMEOUT');

          if (remainingSecs > 0) {
            sounds.start();
          }
        }
      } catch (err) {
        console.error('Failed to start challenge session:', err);
      }
    }

    initChallengeSession();
  }, [currentIdx, challenges, roundSession, currentTeam, isRoundFinished]);

  // 3. Authoritative Timer Loop
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (challengeSession && !isTimedOut && !isRoundFinished) {
      timerRef.current = setInterval(() => {
        const deadline = new Date(challengeSession.deadline_at).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((deadline - now) / 1000));

        setTimeLeft(diff);

        // Sound cues for timer urgency under 60 seconds
        if (diff > 0 && diff <= 60 && diff % 15 === 0) {
          sounds.tick();
        }

        if (diff <= 0) {
          setIsTimedOut(true);
          sounds.error();
          clearInterval(timerRef.current!);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [challengeSession, isTimedOut, isRoundFinished]);

  // Handle Challenge Progression
  const handleNextChallenge = async () => {
    sounds.click();
    if (currentIdx < challenges.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setIsTimedOut(false);
    } else {
      // Complete entire round
      await handleCompleteRound();
    }
  };

  const handleCompleteRound = async () => {
    try {
      const { data } = await (supabase.rpc as any)('complete_round4_session', {
        p_team_id: currentTeam!.id,
        p_round_session_id: roundSession.id
      });

      sounds.victory();
      setFinalScore(data?.totalScore || 0);
      setIsRoundFinished(true);
    } catch (err) {
      console.error('Error completing round 4:', err);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading || !roundSession || !currentTeam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-medium text-gray-500">Loading Assessment Session...</div>
      </div>
    );
  }

  // Final Results Display Screen
  if (isRoundFinished) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <TrophyIcon className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">
            Round 4 Completed
          </h1>
          <p className="text-gray-600 text-sm max-w-lg mx-auto leading-relaxed">
            You have completed all assessment challenges for Round 4. Your performance and scores have been submitted to the leaderboard.
          </p>
        </div>

        <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center shadow-sm space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Score Earned
          </div>
          <div className="text-5xl font-extrabold font-heading text-gray-900">
            {finalScore} <span className="text-xl font-normal text-gray-500">points</span>
          </div>
          <div className="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1.5 pt-2">
            <CheckCircleIcon className="w-4 h-4" />
            Verified and recorded successfully
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate('dashboard')} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm">
            Return to Dashboard
          </Button>
          <Button onClick={() => navigate('leaderboard')} variant="outline" className="px-6 py-2.5 rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50">
            View Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  const currentChallenge = challenges[currentIdx];

  const timerColor = timeLeft <= 60 ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-900 bg-gray-50 border-gray-200';

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <span>Round 4</span>
            <span className="text-gray-300">•</span>
            <span>AI Adversarial & Safety Assessment</span>
          </div>
          <h1 className="text-xl font-bold font-heading text-gray-900 mt-1">
            {currentChallenge?.title || 'Loading Challenge...'}
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Server-authoritative Countdown Timer */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-semibold border ${timerColor}`}>
            <ClockIcon className="w-4 h-4 text-gray-500" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeXIcon className="w-4 h-4 text-gray-400" /> : <VolumeIcon className="w-4 h-4 text-gray-700" />}
          </button>

          {/* Next Challenge Action */}
          <Button
            onClick={handleNextChallenge}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-4 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            {currentIdx < challenges.length - 1 ? (
              <>
                Next Challenge <ArrowRightIcon className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Complete Round <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 4-Stage Step Progression Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {challenges.map((c, i) => {
          const isActive = currentIdx === i;
          const isDone = currentIdx > i;

          return (
            <button
              key={c.id}
              onClick={() => {
                sounds.click();
                setCurrentIdx(i);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-400/30'
                  : isDone
                  ? 'border-gray-200 bg-gray-50/70 text-gray-700 hover:bg-gray-100/60'
                  : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className={isActive ? 'text-blue-700 font-bold' : isDone ? 'text-gray-700' : 'text-gray-400'}>
                  Stage 0{i + 1}
                </span>
                {isDone ? (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                ) : (
                  <span className="text-[11px] font-normal text-gray-500">{c.base_points} pts</span>
                )}
              </div>
              <div className={`text-xs font-semibold truncate ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                {c.title.split(':')[0]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Time Out Alert Banner */}
      {isTimedOut && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>Time expired for this challenge. Submissions are locked. Please proceed to the next stage.</span>
          </div>
          <Button onClick={handleNextChallenge} className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg">
            Proceed Next →
          </Button>
        </div>
      )}

      {/* Render Active Challenge Engine */}
      <div className="min-h-[500px]">
        {currentChallenge?.type === 'PROMPT_BREACH' && (
          <PromptBreachChallenge
            challenge={currentChallenge}
            teamId={currentTeam!.id}
            roundSessionId={roundSession?.id || ''}
            onAttemptCompleted={result => {
              if (result.isCompleted) {
                // Done
              }
            }}
            disabled={isTimedOut}
          />
        )}

        {currentChallenge?.type === 'CIPHER' && (
          <CipherChallenge
            challenge={currentChallenge}
            teamId={currentTeam!.id}
            roundSessionId={roundSession?.id || ''}
            onAttemptCompleted={result => {
              if (result.isCompleted) {
                // Done
              }
            }}
            disabled={isTimedOut}
          />
        )}

        {currentChallenge?.type === 'TURING_TEST' && (
          <TuringTestChallenge
            challenge={currentChallenge}
            teamId={currentTeam!.id}
            roundSessionId={roundSession?.id || ''}
            onAttemptCompleted={result => {
              // Done
            }}
            disabled={isTimedOut}
          />
        )}

        {currentChallenge?.type === 'PROMPT_ZIPPER' && (
          <PromptZipperChallenge
            challenge={currentChallenge}
            teamId={currentTeam!.id}
            roundSessionId={roundSession?.id || ''}
            onAttemptCompleted={result => {
              if (result.isCompleted) {
                // Done
              }
            }}
            disabled={isTimedOut}
          />
        )}
      </div>
    </div>
  );
}

