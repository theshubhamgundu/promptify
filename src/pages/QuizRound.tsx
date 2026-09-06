import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';
import { CheckCircleIcon, CircleIcon, ClockIcon, ExclamationCircleIcon, AlertTriangleIcon, ShieldIcon } from '../components/icons';
import { ConfirmDialog } from '../components/ui';
import { sounds } from '../lib/sound';

interface Challenge {
  id: string;
  round_id: string;
  title: string;
  description: string;
  type: string;
  base_points: number;
  configuration: any;
  order_index: number;
}

interface SecurityViolation {
  type: 'tab_switch' | 'copy' | 'paste' | 'screenshot' | 'inspect';
  timestamp: Date;
  message: string;
}

interface QuizRoundProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

export default function QuizRound({ roundId, navigate }: QuizRoundProps) {
  const { currentEvent } = useEventStore();
  const { currentTeam } = useTeamStore();
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [roundSession, setRoundSession] = useState<any>(null);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Security monitoring
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [securityWarnings, setSecurityWarnings] = useState(0);
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'warning' | 'error' } | null>(null);
  
  const isQuizActive = useRef(true);
  const deadlineRef = useRef<string | null>(null);
  
  // Toast effect
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  // Security: Tab visibility monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isQuizActive.current) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        
        const violation: SecurityViolation = {
          type: 'tab_switch',
          timestamp: new Date(),
          message: `Tab switch detected (${newCount}/3)`
        };
        setViolations(prev => [...prev, violation]);
        
        if (newCount >= 3) {
          setToast({ message: 'Maximum tab switches exceeded. Quiz will be auto-submitted.', type: 'error' });
          setTimeout(() => handleAutoSubmit('Tab switching limit exceeded'), 2000);
        } else {
          setToast({ message: `Warning: Tab switch detected (${newCount}/3). Quiz will auto-submit after 3 switches.`, type: 'warning' });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tabSwitchCount]);
  
  // Security: Prevent copy/paste/screenshot/inspect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        recordSecurityViolation('inspect', 'Developer tools access blocked');
        return false;
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        recordSecurityViolation('screenshot', 'Screenshot attempt blocked');
        return false;
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        recordSecurityViolation('copy', 'Copy attempt blocked');
        return false;
      }
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        recordSecurityViolation('paste', 'Paste attempt blocked');
        return false;
      }
    };
    const preventAction = (e: Event, type: any, msg: string) => { e.preventDefault(); recordSecurityViolation(type, msg); return false; };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', e => preventAction(e, 'copy', 'Copy attempt blocked'));
    document.addEventListener('paste', e => preventAction(e, 'paste', 'Paste attempt blocked'));
    document.addEventListener('contextmenu', e => preventAction(e, 'inspect', 'Right-click blocked'));
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', e => preventAction(e, 'copy', 'Copy attempt blocked'));
      document.removeEventListener('paste', e => preventAction(e, 'paste', 'Paste attempt blocked'));
      document.removeEventListener('contextmenu', e => preventAction(e, 'inspect', 'Right-click blocked'));
    };
  }, [securityWarnings]);
  
  const recordSecurityViolation = (type: SecurityViolation['type'], message: string) => {
    const newCount = securityWarnings + 1;
    setSecurityWarnings(newCount);
    const violation: SecurityViolation = { type, timestamp: new Date(), message: `${message} (${newCount}/5)` };
    setViolations(prev => [...prev, violation]);
    
    if (newCount >= 5) {
      setToast({ message: 'Maximum security violations exceeded. Quiz will be auto-submitted.', type: 'error' });
      setTimeout(() => handleAutoSubmit('Security violation limit exceeded'), 2000);
    } else {
      setToast({ message: `${message} (${newCount}/5)`, type: 'warning' });
    }
  };

  const handleAutoSubmit = async (reason: string) => {
    if (!isQuizActive.current || submitting) return;
    isQuizActive.current = false;
    await submitQuizInternal(true, reason);
  };
  
  // Heartbeat & Timer effect
  useEffect(() => {
    if (!roundSession?.id) return;
    const heartbeatInterval = setInterval(() => {
      if (isQuizActive.current) {
        supabase.rpc('record_session_heartbeat', { p_round_session_id: roundSession.id }).then();
      }
    }, 15000); // 15 seconds ping

    if (timeLeft <= 0 || !deadlineRef.current) return;
    const timer = setInterval(() => {
      const remaining = Math.floor((new Date(deadlineRef.current!).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        if (roundSession?.status === 'IN_PROGRESS') handleAutoSubmit('Time expired');
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    
    return () => { clearInterval(heartbeatInterval); clearInterval(timer); };
  }, [roundSession?.status, roundSession?.id, timeLeft]);
  
  useEffect(() => {
    if (roundId && currentTeam?.id) initializeQuiz();
  }, [roundId, currentTeam?.id]);
  
  const initializeQuiz = async () => {
    try {
      setLoading(true); setError(null);
      
      const { data: roundData, error: roundError } = await supabase.from('rounds').select('*').eq('id', roundId).single();
      if (roundError) throw roundError;
      setRound(roundData);
      
      let { data: sessionData, error: sessionError } = await supabase.from('round_sessions')
        .select('*').eq('team_id', currentTeam!.id).eq('round_id', roundId).single();
      
      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
      
      // Check if quiz is already completed
      if (sessionData?.status === 'COMPLETED') {
        // Redirect to results page instead of allowing re-attempt
        if (navigate) navigate('dashboard');
        return;
      }
      
      if (!sessionData) {
        const { data: newSession, error: createError } = await supabase.from('round_sessions')
          .insert({ team_id: currentTeam!.id, round_id: roundId, started_at: new Date().toISOString() })
          .select().single();
        if (createError) throw createError;
        sessionData = newSession;
      }
      setRoundSession(sessionData);
      
      const { data: challengesData, error: chalError } = await supabase.from('challenges')
        .select('*').eq('round_id', roundId).order('order_index');
      if (chalError) throw chalError;
      setChallenges(challengesData);
      
      // Load existing answers (via challenge attempts)
      const { data: attemptsData, error: attemptsError } = await supabase.from('challenge_attempts')
        .select('challenge_id, payload').eq('round_session_id', sessionData.id);
      
      if (attemptsError) throw attemptsError;
      
      const answersMap = new Map<string, string[]>();
      attemptsData?.forEach((attempt: any) => {
        if (attempt.payload?.selected_options) {
          answersMap.set(attempt.challenge_id, attempt.payload.selected_options);
        }
      });
      setAnswers(answersMap);
      
      let deadline = sessionData.deadline_at;
      if (!deadline) {
        deadline = new Date(Date.now() + (roundData.duration_minutes || 60) * 60 * 1000).toISOString();
      }
      deadlineRef.current = deadline;
      setTimeLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
      
    } catch (err: any) {
      console.error('Error initializing quiz:', err);
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };
  
  // Analytics Tracking
  const recordAnalytics = (challengeId: string, eventType: string, data: any = {}) => {
    if (!roundSession?.id || !currentTeam?.id) return;
    supabase.from('behavior_analytics').insert({
      team_id: currentTeam.id,
      round_session_id: roundSession.id,
      challenge_id: challengeId,
      event_type: eventType,
      event_data: data
    }).then();
  };

  // Track Views when switching questions
  useEffect(() => {
    if (challenges.length > 0 && challenges[currentChallengeIndex]) {
      recordAnalytics(challenges[currentChallengeIndex].id, 'CHALLENGE_VIEWED');
    }
  }, [currentChallengeIndex, challenges]);

  const handleOptionSelect = async (challengeId: string, optionLabel: string, type: string) => {
    sounds.select();
    const currentAnswer = answers.get(challengeId) || [];
    let newAnswer: string[];
    if (type === 'MULTIPLE_CHOICE' || type === 'SINGLE_ANSWER') { // Assume all multiple_choice for Quiz
      newAnswer = [optionLabel]; // Toggle logic could be added if multi-select
    } else {
      newAnswer = [optionLabel];
    }
    
    const newAnswers = new Map(answers);
    newAnswers.set(challengeId, newAnswer);
    setAnswers(newAnswers);
    
    recordAnalytics(challengeId, 'ANSWER_CHANGED', { from: currentAnswer, to: newAnswer });

    try {
      const { error } = await supabase.rpc('create_challenge_attempt', {
        p_team_id: currentTeam!.id,
        p_round_session_id: roundSession!.id,
        p_challenge_id: challengeId,
        p_participant_id: null,
        p_payload: { selected_options: newAnswer },
      });
      if (error) throw error;
      
      // Optionally run deterministic evaluation right away in background, or wait till end.
      // Usually deterministic evaluation can happen server-side silently on submission.
    } catch (err: any) {
      console.error('Error saving answer:', err);
    }
  };
  
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  
  const handleSubmitQuiz = () => {
    setConfirmSubmit(true);
  };
  
  const submitQuizInternal = async (isAutoSubmit: boolean, reason?: string) => {
    setConfirmSubmit(false);
    setSubmitting(true);
    isQuizActive.current = false;

    // Retry logic with exponential backoff  
    const MAX_RETRIES = 5; // Increased from 3 to 5
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // First, mark round_session as COMPLETED directly
        const { error: updateError } = await supabase
          .from('round_sessions')
          .update({ 
            status: 'COMPLETED',
            completed_at: new Date().toISOString()
          })
          .eq('id', roundSession!.id);
        
        if (updateError) throw updateError;

        // Then call submit function (less critical if this fails)
        try {
          await supabase.rpc('submit_round_session', {
            p_round_session_id: roundSession!.id,
          });
        } catch (rpcErr) {
          console.warn('RPC submit_round_session failed (non-critical):', rpcErr);
          // Don't throw - we already marked as completed
        }

        setRoundSession((prev: any) => prev ? { ...prev, status: 'COMPLETED' } : null);
        if (navigate) navigate('dashboard');
        return; // success — exit
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 2000; // 2s, 4s, 6s, 8s
          console.warn(`Quiz submit attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${delay}ms...`, err);
          await new Promise(res => setTimeout(res, delay));
        }
      }
    }

    // All retries exhausted - try one last direct update
    try {
      console.warn('All retries failed. Attempting direct database update...');
      const { error: forceUpdateError } = await supabase
        .from('round_sessions')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', roundSession!.id);
      
      if (!forceUpdateError) {
        console.log('Direct update succeeded! Navigating to dashboard...');
        setRoundSession((prev: any) => prev ? { ...prev, status: 'COMPLETED' } : null);
        if (navigate) navigate('dashboard');
        return;
      }
    } catch (forceErr) {
      console.error('Force update also failed:', forceErr);
    }

    // Truly failed - but allow manual retry
    console.error('Error submitting quiz after all attempts:', lastError);
    setError(null); // Clear error to allow retry button
    setSubmitting(false);
    setToast({ 
      message: 'Submission failed. Click Submit again to retry.',
      type: 'error'
    });
    isQuizActive.current = true; // Re-enable quiz so they can retry
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }
  
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md">
        <ExclamationCircleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Quiz</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => navigate && navigate('dashboard')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Back to Dashboard</button>
      </div>
    </div>
  );
  
  if (challenges.length === 0) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <ExclamationCircleIcon className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
        <p className="text-gray-600">No questions available for this quiz.</p>
      </div>
    </div>
  );
  
  const currentChallenge = challenges[currentChallengeIndex];
  const currentAnswer = answers.get(currentChallenge.id) || [];
  const answeredCount = Array.from(answers.values()).filter(a => a.length > 0).length;
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-row relative">
      {confirmSubmit && (
        <ConfirmDialog
          title="Submit Final Answer?"
          message="Are you sure you want to submit your quiz? You cannot change answers after submission."
          confirmLabel="Submit"
          cancelLabel="Cancel"
          variant="primary"
          onConfirm={() => submitQuizInternal(false)}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-50 border-2 border-red-500' : 'bg-yellow-50 border-2 border-yellow-500'}`}>
            <AlertTriangleIcon className={`w-6 h-6 ${toast.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`} />
            <span className={`font-medium ${toast.type === 'error' ? 'text-red-900' : 'text-yellow-900'}`}>{toast.message}</span>
          </div>
        </div>
      )}
      
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg mb-1">Questions</h2>
          <p className="text-sm text-gray-600">{answeredCount} of {challenges.length} answered</p>
        </div>
        <div className="p-4 space-y-2 flex-1 overflow-y-auto">
          {challenges.map((chal, idx) => {
            const isAnswered = answers.has(chal.id) && answers.get(chal.id)!.length > 0;
            const isCurrent = idx === currentChallengeIndex;
            return (
              <button key={chal.id} onClick={() => { sounds.click(); setCurrentChallengeIndex(idx); }} className={`w-full text-left px-4 py-3 rounded-lg transition-all ${isCurrent ? 'bg-blue-600 text-white shadow-md' : isAnswered ? 'bg-green-50 text-green-900 hover:bg-green-100' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Question {idx + 1}</span>
                  {isAnswered && !isCurrent && <CheckCircleIcon className="w-5 h-5 text-green-600" />}
                </div>
                <div className="text-xs mt-1 opacity-75">{chal.base_points} pts</div>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button onClick={handleSubmitQuiz} disabled={submitting} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? 'Submitting...' : 'End Quiz'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{round?.name}</h1>
              <p className="text-sm text-gray-600 mt-1">Question {currentChallengeIndex + 1} of {challenges.length}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                <ShieldIcon className="w-5 h-5 text-gray-600" />
                <div className="text-sm font-medium text-gray-900">Tabs: {tabSwitchCount}/3 • Warns: {securityWarnings}/5</div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-50' : 'bg-blue-50'}`}>
                <ClockIcon className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                <span className={`font-mono text-lg font-bold ${timeLeft < 300 ? 'text-red-900' : 'text-blue-900'}`}>{formatTime(timeLeft)}</span>
              </div>
              <button onClick={handleSubmitQuiz} disabled={submitting} className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'End Quiz'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">Q{currentChallengeIndex + 1}</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">{currentChallenge.base_points} points</span>
              </div>
              
              <div className="mb-6"><p className="text-xl text-gray-900 leading-relaxed">{currentChallenge.description}</p></div>
              
              <div className="space-y-3">
                {(currentChallenge.configuration?.options || []).map((option: any) => {
                  const isSelected = currentAnswer.includes(option.label);
                  return (
                    <button key={option.label || option.id} onClick={() => handleOptionSelect(currentChallenge.id, option.label, currentChallenge.type)} className={`w-full text-left p-4 rounded-lg border-2 transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">{isSelected ? <CheckCircleIcon className="w-6 h-6 text-blue-600" /> : <CircleIcon className="w-6 h-6 text-gray-400" />}</div>
                        <div className="flex-1">
                          <span className="font-bold text-gray-900 mr-2">{option.label}.</span>
                          <span className="text-gray-700 text-lg">{option.text}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => { sounds.click(); setCurrentChallengeIndex(Math.max(0, currentChallengeIndex - 1)); }} disabled={currentChallengeIndex === 0} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">← Previous</button>
              {currentChallengeIndex === challenges.length - 1 ? (
                <button onClick={handleSubmitQuiz} disabled={submitting} className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              ) : (
                <button onClick={() => { sounds.click(); setCurrentChallengeIndex(Math.min(challenges.length - 1, currentChallengeIndex + 1)); }} disabled={currentChallengeIndex === challenges.length - 1} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">Next →</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
