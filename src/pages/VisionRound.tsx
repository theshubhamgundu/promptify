import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { useServerCountdown } from '../hooks/useServerTimer';
import { sounds } from '../lib/sound';
import {
  EyeIcon, ClockIcon, CheckCircleIcon, XCircleIcon, UploadIcon,
  AlertTriangleIcon, ArrowRightIcon, ZapIcon, TargetIcon, PlayIcon,
  LockIcon, UnlockIcon, FileIcon, VolumeIcon, VolumeXIcon, XIcon,
} from '../components/icons';
import type { Page } from '../components/Layout';

// ── Types ─────────────────────────────────────────────────────────────
interface SubQuestion {
  id: number;
  unlockAfterSubmit: boolean;
  title: string;
  description: string;
  maxFiles: number;
  points: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  order_index: number;
  base_points: number;
  max_attempts: number;
  time_limit_minutes: number;
  configuration: {
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    requiresFileUpload: boolean;
    acceptedFileTypes: string[];
    maxFileSize: number;
    maxFiles: number;
    minDuration?: number;
    maxDuration?: number;
    instructions: string;
    subQuestions?: SubQuestion[];
    scoring: {
      basePoints: number;
      subQuestionPoints: number[];
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
  score: number;
  submission_data?: {
    mainSubmitted: boolean;
    subQuestionsCompleted: number[];
    files: string[];
  };
}

interface UploadedFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
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
  const [phase, setPhase] = useState<'briefing' | 'main' | 'sub' | 'result' | 'complete'>('briefing');
  const [currentSubQuestion, setCurrentSubQuestion] = useState<number>(-1);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalScore, setTotalScore] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentChallenge = challenges[currentChallengeIdx] || null;
  const currentSession = challengeSessions.find(s => s.challenge_id === currentChallenge?.id) || null;

  const [soundMuted, setSoundMuted] = useState(sounds.isMuted());

  // ── Timer ─────────────────────────────────────────────────────────
  const deadlineStr = currentSession?.deadline_at || null;
  const timeLimit = currentChallenge?.time_limit_minutes || 15;
  const { minutes, seconds: secs, total: timerTotal, percent: timerPercent } = useServerCountdown(
    deadlineStr,
    timeLimit * 60,
    () => handleTimeout()
  );

  // Sound effects
  useEffect(() => {
    if (phase === 'main' || phase === 'sub') {
      if (timerTotal > 0 && timerTotal <= 60 && timerTotal % 15 === 0) {
        sounds.timeUrgent();
      }
    }
  }, [phase, timerTotal]);

  useEffect(() => {
    if (phase === 'complete') {
      sounds.victory();
    }
  }, [phase]);

  // Mark round as completed
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

      const roundInfo = dbRounds.find(r => r.id === roundId);
      setRound(roundInfo || null);

      const { data: challengeData } = await supabase
        .from('challenges')
        .select('*')
        .eq('round_id', roundId)
        .order('order_index');

      if (challengeData) setChallenges(challengeData as Challenge[]);

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
        const total = sessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
        setTotalScore(total);

        if (challengeData) {
          const firstIncomplete = challengeData.findIndex((c: any) =>
            !sessions.find((s: any) => s.challenge_id === c.id && s.status !== 'IN_PROGRESS')
          );

          if (firstIncomplete === -1) {
            setPhase('complete');
          } else {
            setCurrentChallengeIdx(firstIncomplete);
            const existingSession = sessions.find((s: any) => s.challenge_id === challengeData[firstIncomplete].id);
            if (existingSession && existingSession.submission_data?.mainSubmitted) {
              setPhase('sub');
            } else if (existingSession && existingSession.status === 'IN_PROGRESS') {
              // Resume existing session
              setPhase('main');
            } else {
              // Auto-start new challenge session
              const challenge = challengeData[firstIncomplete];
              if (challenge && rs?.id) {
                supabase.rpc('start_challenge_session', {
                  p_team_id: currentTeam!.id,
                  p_round_session_id: rs.id,
                  p_challenge_id: challenge.id,
                  p_duration_minutes: challenge.configuration?.timeLimitMinutes || 15,
                }).then(({ data, error }) => {
                  if (!error && data?.session) {
                    setChallengeSessions(prev => {
                      const exists = prev.find(s => s.challenge_id === challenge.id);
                      if (exists) return prev;
                      return [...prev, data.session as ChallengeSession];
                    });
                    setPhase('main');
                  }
                });
              }
            }
          }
        }
      } else if (challengeData && challengeData.length > 0 && rs?.id) {
        // No sessions yet, auto-start first challenge
        const challenge = challengeData[0];
        supabase.rpc('start_challenge_session', {
          p_team_id: currentTeam!.id,
          p_round_session_id: rs.id,
          p_challenge_id: challenge.id,
          p_duration_minutes: challenge.configuration?.timeLimitMinutes || 15,
        }).then(({ data, error }) => {
          if (!error && data?.session) {
            setChallengeSessions([data.session as ChallengeSession]);
            setPhase('main');
          }
        });
      }

      setLoading(false);
    }

    load();
  }, [roundId, currentTeam]);

  // ── Start challenge ───────────────────────────────────────────────
  const startChallenge = useCallback(async () => {
    if (!currentTeam || !currentChallenge || !roundSession) return;
    sounds.start();

    const { data, error } = await supabase.rpc('start_challenge_session', {
      p_team_id: currentTeam.id,
      p_round_session_id: roundSession.id,
      p_challenge_id: currentChallenge.id,
      p_duration_minutes: currentChallenge.time_limit_minutes,
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

    setPhase('main');
    setUploadedFiles([]);
    setError(null);
  }, [currentTeam, currentChallenge, roundSession]);

  // ── File handling ─────────────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const config = currentChallenge?.configuration;
    if (!config) return;

    const maxFiles = phase === 'main' ? config.maxFiles : currentChallenge.configuration.subQuestions?.[currentSubQuestion]?.maxFiles || 1;

    if (uploadedFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} file(s) allowed`);
      sounds.error();
      return;
    }

    const newFiles: UploadedFile[] = [];
    files.forEach(file => {
      if (!config.acceptedFileTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.type}`);
        sounds.error();
        return;
      }

      if (file.size > config.maxFileSize) {
        setError(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: ${config.maxFileSize / 1024 / 1024}MB)`);
        sounds.error();
        return;
      }

      const preview = URL.createObjectURL(file);
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      newFiles.push({ file, preview, type });
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setError(null);
    sounds.click();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentChallenge, uploadedFiles, phase, currentSubQuestion]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    sounds.click();
  }, []);

  // ── Submit main challenge ─────────────────────────────────────────
  const submitMain = useCallback(async () => {
    if (!currentTeam || !currentChallenge || uploadedFiles.length === 0) {
      setError('Please upload at least one file');
      return;
    }

    // If no session exists, create one first
    if (!currentSession && roundSession) {
      sounds.click();
      const { data, error: sessionError } = await supabase.rpc('start_challenge_session', {
        p_team_id: currentTeam.id,
        p_round_session_id: roundSession.id,
        p_challenge_id: currentChallenge.id,
        p_duration_minutes: currentChallenge.configuration?.timeLimitMinutes || 8,
      });

      if (sessionError || !data?.session) {
        setError('Failed to start challenge session');
        sounds.error();
        return;
      }

      setChallengeSessions(prev => [...prev, data.session as ChallengeSession]);
      
      // Retry submission with new session
      setTimeout(() => submitMain(), 100);
      return;
    }

    if (!currentSession) {
      setError('No active challenge session');
      return;
    }

    const config = currentChallenge.configuration;
    if (uploadedFiles.length !== config.maxFiles) {
      setError(`Please upload exactly ${config.maxFiles} file(s)`);
      return;
    }

    setSubmitting(true);
    setError(null);
    sounds.click();

    try {
      // Upload files to Supabase Storage
      const uploadedUrls: string[] = [];
      for (const { file } of uploadedFiles) {
        const fileName = `${currentTeam.id}/${currentChallenge.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('challenge-submissions')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('challenge-submissions')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      // Update session with submission data
      const submissionData = {
        mainSubmitted: true,
        subQuestionsCompleted: [],
        files: uploadedUrls,
      };

      await supabase
        .from('challenge_sessions')
        .update({
          submission_data: submissionData,
          score: config.scoring.basePoints,
        })
        .eq('id', currentSession.id);

      // Refresh sessions
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

      sounds.success();
      setUploadedFiles([]);

      // Check if there are sub-questions
      if (config.subQuestions && config.subQuestions.length > 0) {
        setPhase('sub');
        setCurrentSubQuestion(0);
      } else {
        setPhase('result');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      sounds.error();
    } finally {
      setSubmitting(false);
    }
  }, [currentTeam, currentChallenge, currentSession, roundSession, uploadedFiles]);

  // ── Submit sub-question ───────────────────────────────────────────
  const submitSubQuestion = useCallback(async () => {
    if (!currentTeam || !currentChallenge || !currentSession || uploadedFiles.length === 0) {
      setError('Please upload at least one file');
      return;
    }

    const subQuestion = currentChallenge.configuration.subQuestions?.[currentSubQuestion];
    if (!subQuestion) return;

    if (uploadedFiles.length !== subQuestion.maxFiles) {
      setError(`Please upload exactly ${subQuestion.maxFiles} file(s)`);
      return;
    }

    setSubmitting(true);
    setError(null);
    sounds.click();

    try {
      // Upload files
      const uploadedUrls: string[] = [];
      for (const { file } of uploadedFiles) {
        const fileName = `${currentTeam.id}/${currentChallenge.id}/sub${subQuestion.id}_${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('challenge-submissions')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('challenge-submissions')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      // Update session
      const existingData = currentSession.submission_data || { mainSubmitted: true, subQuestionsCompleted: [], files: [] };
      const updatedData = {
        ...existingData,
        subQuestionsCompleted: [...(existingData.subQuestionsCompleted || []), subQuestion.id],
        files: [...(existingData.files || []), ...uploadedUrls],
      };

      const newScore = (currentSession.score || 0) + subQuestion.points;

      await supabase
        .from('challenge_sessions')
        .update({
          submission_data: updatedData,
          score: newScore,
        })
        .eq('id', currentSession.id);

      // Refresh sessions
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

      sounds.success();
      setUploadedFiles([]);

      // Move to next sub-question or result
      const subQuestions = currentChallenge.configuration.subQuestions || [];
      if (currentSubQuestion < subQuestions.length - 1) {
        setCurrentSubQuestion(currentSubQuestion + 1);
      } else {
        // Mark as completed
        await supabase
          .from('challenge_sessions')
          .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', currentSession.id);

        setPhase('result');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      sounds.error();
    } finally {
      setSubmitting(false);
    }
  }, [currentTeam, currentChallenge, currentSession, roundSession, uploadedFiles, currentSubQuestion]);

  // ── Handle timeout ────────────────────────────────────────────────
  const handleTimeout = useCallback(() => {
    sounds.error();
    setPhase('result');
    setError('Time expired!');
  }, []);

  // ── Advance to next challenge ─────────────────────────────────────
  const advanceToNext = useCallback(async () => {
    sounds.click();
    if (currentChallengeIdx < challenges.length - 1) {
      const nextIdx = currentChallengeIdx + 1;
      setCurrentChallengeIdx(nextIdx);
      setCurrentSubQuestion(-1);
      setUploadedFiles([]);
      setError(null);
      
      // Auto-start next challenge
      if (currentTeam && roundSession) {
        const nextChallenge = challenges[nextIdx];
        const { data, error } = await supabase.rpc('start_challenge_session', {
          p_team_id: currentTeam.id,
          p_round_session_id: roundSession.id,
          p_challenge_id: nextChallenge.id,
          p_duration_minutes: nextChallenge.configuration?.timeLimitMinutes || 15,
        });

        if (!error && data?.session) {
          setChallengeSessions(prev => {
            const exists = prev.find(s => s.challenge_id === nextChallenge.id);
            if (exists) return prev;
            return [...prev, data.session as ChallengeSession];
          });
        }
      }
      
      setPhase('main');
    } else {
      setPhase('complete');
    }
  }, [currentChallengeIdx, challenges, currentTeam, roundSession]);

  const handleEndRound = () => {
    navigate('dashboard');
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Vision Challenge...</p>
        </div>
      </div>
    );
  }

  // ── Round Complete ────────────────────────────────────────────────
  if (phase === 'complete') {
    const completedSessions = challengeSessions.filter(s => s.status !== 'IN_PROGRESS');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <EyeIcon className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading mb-1">Round Complete!</h1>
            <p className="text-sm text-gray-500">Vision & Creation Challenge</p>
          </div>

          <div className="bg-orange-50 rounded-xl p-6 mb-6 text-center border border-orange-100">
            <div className="text-4xl font-black text-orange-600 font-heading">{totalScore}</div>
            <div className="text-sm text-orange-700 mt-1">Total Points</div>
          </div>

          <div className="space-y-2 mb-6">
            {challenges.map((c, i) => {
              const sess = challengeSessions.find(s => s.challenge_id === c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">{i + 1}</div>
                  <div className="flex-1 text-sm text-gray-700 truncate">{c.title}</div>
                  {sess?.status === 'COMPLETED' ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-gray-300" />
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

  // ── Active UI ─────────────────────────────────────────────────────
  const timerColor = timerTotal > 300 ? 'text-green-700' : timerTotal > 120 ? 'text-amber-700' : 'text-red-700';
  const timerBox = timerTotal > 300 ? 'bg-green-50' : timerTotal > 120 ? 'bg-amber-50' : 'bg-red-50';

  const config = currentChallenge?.configuration;
  const currentSubQ = config?.subQuestions?.[currentSubQuestion];
  const maxFilesAllowed = phase === 'main' ? config?.maxFiles || 1 : currentSubQ?.maxFiles || 1;
  const completedSubQuestions = currentSession?.submission_data?.subQuestionsCompleted || [];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{round?.name || 'Round 3'}</h1>
          <p className="text-sm text-gray-600">Challenge {currentChallengeIdx + 1} of {challenges.length}</p>
        </div>

        <div className="flex items-center gap-2">
          {challenges.map((c, i) => {
            const sess = challengeSessions.find(s => s.challenge_id === c.id);
            const isCurrent = i === currentChallengeIdx;
            const isComplete = sess?.status === 'COMPLETED';
            return (
              <div
                key={c.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent
                    ? 'bg-orange-500 text-white'
                    : isComplete
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {isComplete ? '✓' : i + 1}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {(phase === 'main' || phase === 'sub') && (
            <div className={`${timerBox} px-4 py-2 rounded-lg flex items-center gap-2`}>
              <ClockIcon className={`w-4 h-4 ${timerColor}`} />
              <span className={`text-lg font-mono font-bold ${timerColor}`}>
                {minutes}:{secs}
              </span>
            </div>
          )}
          <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            <div className="text-lg font-bold text-gray-900 leading-none">{totalScore}</div>
            <div className="text-[9px] text-gray-500 uppercase">Score</div>
          </div>
          <button
            onClick={() => {
              const muted = sounds.toggleMute();
              setSoundMuted(muted);
            }}
            className="p-2.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
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

      {/* Timer Bar */}
      {(phase === 'main' || phase === 'sub') && (
        <div className="h-1 bg-gray-200 flex-shrink-0">
          <div
            className={`h-full transition-all duration-1000 ${
              timerTotal > 300 ? 'bg-green-500' : timerTotal > 120 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {phase === 'result' ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-700 font-heading mb-2">Challenge Complete!</h2>
              <div className="text-4xl font-black text-gray-900 font-heading mb-1">+{currentSession?.score || 0}</div>
              <div className="text-sm text-gray-500 mb-6">points earned</div>

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
            {/* Left: Reference Media */}
            {config?.mediaUrl && (
              <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                    Reference {config.mediaType === 'video' ? 'Video' : 'Image'}
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-gray-50">
                  {config.mediaType === 'video' ? (
                    <video
                      src={config.mediaUrl}
                      controls
                      className="max-w-full max-h-full rounded-xl shadow-sm border border-gray-200"
                    />
                  ) : (
                    <img
                      src={config.mediaUrl}
                      alt="Reference"
                      className="max-w-full max-h-full object-contain rounded-xl shadow-sm border border-gray-200 cursor-zoom-in"
                      onClick={() => window.open(config.mediaUrl, '_blank')}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Right: Upload Area */}
            <div className="w-[500px] flex-shrink-0 flex flex-col bg-white max-h-full">
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                {phase === 'main' ? (
                  <>
                    <div className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mb-1">
                      Main Challenge
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 font-heading mb-1.5">
                      {currentChallenge?.title}
                    </h2>
                    <p className="text-xs text-gray-700 leading-snug mb-2">
                      {currentChallenge?.description}
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                      <div className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider mb-0.5">
                        Instructions
                      </div>
                      <p className="text-xs text-blue-900 leading-snug">
                        {config?.instructions}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1.5">
                      <UnlockIcon className="w-4 h-4 text-green-600" />
                      <div className="text-[10px] text-green-600 font-bold uppercase tracking-widest">
                        Bonus Sub-Question {currentSubQuestion + 1}
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 font-heading mb-1.5">
                      {currentSubQ?.title}
                    </h3>
                    <p className="text-xs text-gray-600 leading-snug">
                      {currentSubQ?.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Reward:</span>
                      <span className="font-bold text-green-600">+{currentSubQ?.points} points</span>
                    </div>
                  </>
                )}
              </div>

              {/* Sub-questions Progress */}
              {phase === 'sub' && config?.subQuestions && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
                  <div className="text-[10px] text-gray-500 font-bold uppercase mb-1.5">Sub-Questions Progress</div>
                  <div className="flex gap-2">
                    {config.subQuestions.map((sq, i) => (
                      <div
                        key={sq.id}
                        className={`flex-1 h-2 rounded-full ${
                          completedSubQuestions.includes(sq.id)
                            ? 'bg-green-500'
                            : i === currentSubQuestion
                            ? 'bg-orange-500'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex-shrink-0">
                  <div className="flex items-center gap-2 text-xs text-red-700">
                    <AlertTriangleIcon className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Upload Area */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={config?.acceptedFileTypes.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {uploadedFiles.length === 0 ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-400 hover:bg-orange-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-orange-600"
                  >
                    <UploadIcon className="w-7 h-7" />
                    <div className="text-center">
                      <div className="font-semibold text-sm">Click to upload files</div>
                      <div className="text-xs mt-0.5">
                        Upload {maxFilesAllowed} {config?.acceptedFileTypes.includes('video/mp4') ? 'video' : 'image'}(s)
                      </div>
                    </div>
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      {uploadedFiles.map((uf, i) => (
                        <div key={i} className="relative group">
                          {uf.type === 'image' ? (
                            <img
                              src={uf.preview}
                              alt={`Upload ${i + 1}`}
                              className="w-full h-28 object-cover rounded-lg border border-gray-200"
                            />
                          ) : (
                            <video
                              src={uf.preview}
                              className="w-full h-28 object-cover rounded-lg border border-gray-200"
                            />
                          )}
                          <button
                            onClick={() => removeFile(i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded truncate max-w-[90%]">
                            {uf.file.name}
                          </div>
                        </div>
                      ))}
                    </div>

                    {uploadedFiles.length < maxFilesAllowed && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting}
                        className="w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs text-gray-700 font-medium"
                      >
                        Add More Files ({uploadedFiles.length}/{maxFilesAllowed})
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Submit Button */}
              <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-white">
                <button
                  onClick={phase === 'main' ? submitMain : submitSubQuestion}
                  disabled={submitting || uploadedFiles.length === 0 || uploadedFiles.length !== maxFilesAllowed}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-4 h-4" />
                      Submit {phase === 'main' ? 'Main Challenge' : 'Sub-Question'}
                    </>
                  )}
                </button>
                {uploadedFiles.length > 0 && uploadedFiles.length !== maxFilesAllowed && (
                  <div className="text-[10px] text-gray-500 text-center mt-1.5">
                    Need exactly {maxFilesAllowed} file(s) to submit
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BrainIconSVG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    </svg>
  );
}
