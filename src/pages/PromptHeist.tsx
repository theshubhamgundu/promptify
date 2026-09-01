import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  AlertTriangleIcon,
  BrainIcon,
  LightbulbIcon,
  PuzzleIcon,
  CodeIcon
} from '../components/icons';
import { 
  evaluatePrecision,
  evaluateConstraints,
  evaluateContextExtraction,
  evaluateDebugging
} from '../lib/prompt-evaluator';
import { ConfirmDialog } from '../components/ui';

interface Challenge {
  id: string;
  sub_round_number: number;
  challenge_type: string;
  title: string;
  description: string;
  scenario_data: any;
  evaluation_criteria: any[];
  max_points: number;
  time_limit_seconds: number;
  max_attempts: number;
}

interface PromptSession {
  id: string;
  current_sub_round: number;
  sub_round_1_score: number;
  sub_round_2_score: number;
  sub_round_3_score: number;
  sub_round_4_score: number;
  total_score: number;
  sub_round_1_status: string;
  sub_round_2_status: string;
  sub_round_3_status: string;
  sub_round_4_status: string;
}

interface Submission {
  attempt_number: number;
  total_score: number;
  passed: boolean;
  evaluation_scores: any;
  evaluation_feedback: any[];
}

interface PromptHeistProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

function mapGenericChallenge(c: any, index: number): Challenge {
  const cfg = c.configuration || {};
  return {
    id: c.id,
    sub_round_number: c.sub_round_number ?? c.order_index ?? index + 1,
    challenge_type: cfg.challenge_type || c.challenge_type || 'precision',
    title: c.title,
    description: c.description,
    scenario_data: cfg.scenario_data || cfg,
    evaluation_criteria: cfg.evaluation_criteria || c.evaluation_criteria || [],
    max_points: c.max_points ?? c.base_points ?? 100,
    time_limit_seconds: c.time_limit_seconds || cfg.time_limit_seconds || 600,
    max_attempts: c.max_attempts || cfg.max_attempts || 3,
  };
}

const FALLBACK_CHALLENGES: Challenge[] = [
  {
    id: 'fallback-precision',
    sub_round_number: 1,
    challenge_type: 'precision',
    title: 'Precision: Write a Tight Prompt',
    description: 'Write a clear, specific prompt that would produce a reliable, well-structured answer. Include the task, constraints, and output format.',
    scenario_data: {
      task: 'Write a prompt that asks an AI to summarize a news article into exactly 5 bullet points, each under 20 words, in a neutral tone.',
      instructions: 'Be specific. Mention format, length, tone, and what to include or exclude.',
    },
    evaluation_criteria: [],
    max_points: 150,
    time_limit_seconds: 600,
    max_attempts: 3,
  },
  {
    id: 'fallback-constraint',
    sub_round_number: 2,
    challenge_type: 'constraint',
    title: 'Constraints: Follow Every Rule',
    description: 'Write a prompt AND the expected output that satisfies every constraint listed.',
    scenario_data: {
      task: 'Create a prompt that generates a product description matching all constraints.',
      instructions: 'Your prompt must enforce every constraint. Then write the output you expect the model to produce.',
      constraints: [
        { description: 'Exactly 3 sentences' },
        { description: 'Mention the product name once' },
        { description: 'No exclamation marks' },
        { description: 'Include a concrete benefit' },
      ],
    },
    evaluation_criteria: [],
    max_points: 150,
    time_limit_seconds: 600,
    max_attempts: 3,
  },
  {
    id: 'fallback-context',
    sub_round_number: 3,
    challenge_type: 'context',
    title: 'Context: Extract the Facts',
    description: 'Write a prompt that extracts only the required facts from a noisy document.',
    scenario_data: {
      task: 'Extract the meeting time, location, and attendees from the noisy notes below.',
      instructions: 'Your prompt should ignore filler and return only the requested facts.',
      noisy_context: 'Hey team!! just a recap from yesterday — um we might move it but currently the design sync is Friday 3pm in Lab 4. Priya, Arjun, and Sam must join. Also someone left pizza in the fridge. Ignore the pizza. Parking is full. Friday 3:00 PM, Lab 4.',
      expected_facts: ['Friday 3pm', 'Lab 4', 'Priya', 'Arjun', 'Sam'],
      max_output_words: 40,
    },
    evaluation_criteria: [],
    max_points: 150,
    time_limit_seconds: 600,
    max_attempts: 3,
  },
  {
    id: 'fallback-debugging',
    sub_round_number: 4,
    challenge_type: 'debugging',
    title: 'Debugging: Fix the Broken Prompt',
    description: 'Rewrite the broken prompt so it actually produces the intended result.',
    scenario_data: {
      task: 'Fix this prompt. Keep the original intent but remove ambiguity and add missing constraints.',
      instructions: 'Rewrite the prompt. Do not just restate the problem.',
      broken_prompt: 'Tell me stuff about this maybe in a good way and make it short or long whatever.',
      bad_outputs: [
        { output: 'A rambling paragraph with no structure.', issue: 'no_format' },
        { output: 'Off-topic jokes instead of the requested content.', issue: 'wrong_intent' },
      ],
      known_issues: ['vague', 'no format', 'no audience', 'no length limit'],
    },
    evaluation_criteria: [],
    max_points: 150,
    time_limit_seconds: 600,
    max_attempts: 3,
  },
];

export default function PromptHeist({ roundId, navigate }: PromptHeistProps) {
  const { currentEvent } = useEventStore();
  const { currentTeam } = useTeamStore();
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [session, setSession] = useState<PromptSession | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [roundSession, setRoundSession] = useState<any>(null);
  
  // Challenge state
  const [promptText, setPromptText] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [attempts, setAttempts] = useState<Submission[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [evaluating, setEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);
  const lastEvaluationRef = useRef<any>(null);
  
  // Keep ref in sync with state
  useEffect(() => { lastEvaluationRef.current = lastEvaluation; }, [lastEvaluation]);
  
  // Timer
  const [timeLeft, setTimeLeft] = useState(600);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals and Toasts
  const [toast, setToast] = useState<{message: string, type: 'error'|'success'|'warning'} | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState<boolean>(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (roundId && currentTeam?.id) {
      initializePromptHeist();
    }
  }, [roundId, currentTeam?.id]);

  // Timer countdown - use ref to avoid stale closure issues
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (timeLeft <= 0 || !currentChallenge) return;
    
    autoSubmittedRef.current = false;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          // Only auto-submit if we haven't already
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            handleAutoSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentChallenge?.id]); // Only restart timer when the challenge changes, NOT on every timeLeft change

  const initializePromptHeist = async () => {
    try {
      setLoading(true);
      
      // Get or create round session
      let { data: roundSessionData, error: sessionError } = await supabase
        .from('round_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .single();
      
      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
      
      if (!roundSessionData) {
        const { data: newSession, error: createError } = await supabase
          .from('round_sessions')
          .insert({
            team_id: currentTeam!.id,
            round_id: roundId,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (createError) throw createError;
        roundSessionData = newSession;
      }
      
      setRoundSession(roundSessionData);

      let promptSession: PromptSession | null = null;
      try {
        const { data: sessionData } = await supabase.rpc('start_prompt_round_session', {
          p_team_id: currentTeam!.id,
          p_round_id: roundId,
          p_round_session_id: roundSessionData.id
        });
        if (sessionData) {
          const { data } = await supabase.from('prompt_round_sessions').select('*').eq('id', sessionData).single();
          promptSession = data;
        }
      } catch {
        promptSession = null;
      }

      setSession(promptSession || {
        id: roundSessionData.id,
        current_sub_round: 1,
        sub_round_1_score: 0,
        sub_round_2_score: 0,
        sub_round_3_score: 0,
        sub_round_4_score: 0,
        total_score: 0,
        sub_round_1_status: 'IN_PROGRESS',
        sub_round_2_status: 'LOCKED',
        sub_round_3_status: 'LOCKED',
        sub_round_4_status: 'LOCKED',
      });

      let challengesData: Challenge[] = [];
      const promptChals = await supabase
        .from('prompt_challenges')
        .select('*')
        .eq('round_id', roundId)
        .order('sub_round_number');

      if (promptChals.data && promptChals.data.length > 0) {
        challengesData = promptChals.data as Challenge[];
      } else {
        const generic = await supabase
          .from('challenges')
          .select('*')
          .eq('round_id', roundId)
          .order('order_index');
        challengesData = (generic.data || []).map(mapGenericChallenge);
      }

      if (challengesData.length === 0) {
        challengesData = FALLBACK_CHALLENGES;
      }

      setChallenges(challengesData);

      const currentSub = promptSession?.current_sub_round || 1;
      const current = challengesData.find((c: Challenge) => c.sub_round_number === currentSub) || challengesData[0];
      
      if (current) {
        setCurrentChallenge(current);
        setTimeLeft(current.time_limit_seconds);
        
        // Load previous attempts
        const { data: submissionsData } = await supabase
          .from('prompt_submissions')
          .select('*')
          .eq('team_id', currentTeam!.id)
          .eq('challenge_id', current.id)
          .order('attempt_number');
        
        if (submissionsData) {
          setAttempts(submissionsData);
          setCurrentAttempt(submissionsData.length + 1);
          
          // Load last attempt text
          if (submissionsData.length > 0) {
            const last = submissionsData[submissionsData.length - 1];
            setPromptText(last.prompt_text);
            setExpectedOutput(last.expected_output || '');
          }
        }
      }
      
    } catch (err: any) {
      console.error('Error initializing:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!currentChallenge || !promptText.trim()) {
      setToast({ message: 'Please write a prompt first!', type: 'warning' });
      return;
    }
    
    setEvaluating(true);
    
    try {
      let evaluation;
      
      // Evaluate based on challenge type
      switch (currentChallenge.challenge_type) {
        case 'precision':
          evaluation = evaluatePrecision(promptText);
          break;
          
        case 'constraint':
          if (!expectedOutput.trim()) {
            setToast({ message: 'Please write both prompt AND expected output for constraint challenges!', type: 'warning' });
            setEvaluating(false);
            return;
          }
          evaluation = evaluateConstraints(
            promptText,
            expectedOutput,
            currentChallenge.scenario_data.constraints
          );
          break;
          
        case 'context':
          if (!expectedOutput.trim()) {
            setToast({ message: 'Please write both prompt AND expected output!', type: 'warning' });
            setEvaluating(false);
            return;
          }
          evaluation = evaluateContextExtraction(
            promptText,
            expectedOutput,
            currentChallenge.scenario_data.noisy_context,
            currentChallenge.scenario_data.expected_facts,
            currentChallenge.scenario_data.max_output_words
          );
          break;
          
        case 'debugging':
          evaluation = evaluateDebugging(
            currentChallenge.scenario_data.broken_prompt,
            promptText,
            currentChallenge.scenario_data.known_issues
          );
          break;
          
        default:
          evaluation = evaluatePrecision(promptText);
          break;
      }
      
      setLastEvaluation(evaluation);
      
      try {
        await supabase.rpc('submit_prompt_attempt', {
          p_team_id: currentTeam!.id,
          p_challenge_id: currentChallenge.id,
          p_round_session_id: roundSession!.id,
          p_attempt_number: currentAttempt,
          p_prompt_text: promptText,
          p_expected_output: expectedOutput,
          p_evaluation_scores: evaluation.breakdown,
          p_total_score: evaluation.totalScore,
          p_max_score: evaluation.maxScore,
          p_passed: evaluation.passed,
          p_feedback: evaluation.feedback,
          p_is_final: false
        });
      } catch (saveErr) {
        console.warn('Could not save attempt to server:', saveErr);
      }
      
      // Add to attempts list
      setAttempts([...attempts, {
        attempt_number: currentAttempt,
        total_score: evaluation.totalScore,
        passed: evaluation.passed,
        evaluation_scores: evaluation.breakdown,
        evaluation_feedback: evaluation.feedback
      }]);
      
      setCurrentAttempt(currentAttempt + 1);
      
    } catch (err: any) {
      console.error('Evaluation error:', err);
      setToast({ message: 'Evaluation failed: ' + err.message, type: 'error' });
    } finally {
      setEvaluating(false);
    }
  };

  const executeFinalSubmission = async () => {
    try {
      setConfirmSubmit(false);
      if (lastEvaluation && currentChallenge && !String(currentChallenge.id).startsWith('fallback-')) {
        await supabase.rpc('submit_prompt_attempt', {
          p_team_id: currentTeam!.id,
          p_challenge_id: currentChallenge.id,
          p_round_session_id: roundSession!.id,
          p_attempt_number: currentAttempt - 1,
          p_prompt_text: promptText,
          p_expected_output: expectedOutput,
          p_evaluation_scores: lastEvaluation.breakdown,
          p_total_score: lastEvaluation.totalScore,
          p_max_score: lastEvaluation.maxScore,
          p_passed: lastEvaluation.passed,
          p_feedback: lastEvaluation.feedback,
          p_is_final: true
        });
        await supabase.rpc('complete_sub_round', {
          p_team_id: currentTeam!.id,
          p_round_id: roundId,
          p_sub_round_number: currentChallenge.sub_round_number,
          p_score: lastEvaluation.totalScore
        });
      }

      if (currentChallenge && currentChallenge.sub_round_number < challenges.length) {
        const next = challenges.find(c => c.sub_round_number === currentChallenge.sub_round_number + 1) || challenges[currentChallenge.sub_round_number];
        setPromptText('');
        setExpectedOutput('');
        setAttempts([]);
        setCurrentAttempt(1);
        setLastEvaluation(null);
        if (next) {
          setCurrentChallenge(next);
          setTimeLeft(next.time_limit_seconds);
          setSession(prev => prev ? { ...prev, current_sub_round: next.sub_round_number } : prev);
        }
      } else {
        await handleEndRound();
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      if (currentChallenge && currentChallenge.sub_round_number < challenges.length) {
        const next = challenges.find(c => c.sub_round_number === currentChallenge.sub_round_number + 1);
        if (next) {
          setCurrentChallenge(next);
          setPromptText('');
          setExpectedOutput('');
          setAttempts([]);
          setCurrentAttempt(1);
          setLastEvaluation(null);
          setTimeLeft(next.time_limit_seconds);
        }
      } else {
        await handleEndRound();
      }
    }
  };

  const handleSubmitFinal = () => {
    setConfirmSubmit(true);
  };

  const handleEndRound = async () => {
    try {
      if (roundSession?.id) {
        await supabase.rpc('submit_round_session', { p_round_session_id: roundSession.id });
      }
      navigate && navigate('dashboard');
    } catch (err: any) {
      setToast({ message: 'Failed to end round: ' + err.message, type: 'error' });
      navigate && navigate('dashboard');
    }
  };

  const handleAutoSubmit = async () => {
    // Use ref to get the CURRENT value, not the stale closure value
    if (lastEvaluationRef.current) {
      await executeFinalSubmission();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSubRoundIcon = (type: string) => {
    switch(type) {
      case 'precision': return <LightbulbIcon className="w-6 h-6" />;
      case 'constraint': return <PuzzleIcon className="w-6 h-6" />;
      case 'context': return <BrainIcon />;
      case 'debugging': return <CodeIcon className="w-6 h-6" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Round 2: Prompt Heist...</p>
        </div>
      </div>
    );
  }

  if (error || !currentChallenge) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'No challenge available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-50 border-2 border-red-500' : toast.type === 'success' ? 'bg-green-50 border-2 border-green-500' : 'bg-yellow-50 border-2 border-yellow-500'}`}>
            <AlertTriangleIcon className={`w-6 h-6 ${toast.type === 'error' ? 'text-red-600' : toast.type === 'success' ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className={`font-medium ${toast.type === 'error' ? 'text-red-900' : toast.type === 'success' ? 'text-green-900' : 'text-yellow-900'}`}>{toast.message}</span>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <ConfirmDialog
          title="Submit Final Answer?"
          message="Are you sure you want to submit this as your final answer? You cannot change it later."
          confirmLabel="Submit"
          cancelLabel="Cancel"
          variant="primary"
          onConfirm={() => {
            if (lastEvaluation && currentChallenge) {
              executeFinalSubmission();
            } else {
              handleEndRound();
            }
          }}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

      {/* Left Sidebar - Progress */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg">Prompt Heist</h2>
          <p className="text-sm text-gray-600">
            Sub-round {session?.current_sub_round} of 4
          </p>
        </div>
        
        <div className="p-4 space-y-2">
          {challenges.map((challenge) => {
            const isActive = challenge.id === currentChallenge?.id;
            const status = (session as any)?.[`sub_round_${challenge.sub_round_number}_status`];
            const score = (session as any)?.[`sub_round_${challenge.sub_round_number}_score`] || 0;
            
            return (
              <div
                key={challenge.id}
                className={`p-3 rounded-lg border-2 ${
                  isActive
                    ? 'border-blue-500 bg-blue-50'
                    : status === 'COMPLETED'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={isActive ? 'text-blue-600' : status === 'COMPLETED' ? 'text-green-600' : 'text-gray-400'}>
                    {getSubRoundIcon(challenge.challenge_type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {challenge.sub_round_number}. {challenge.title.split(':')[0]}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {challenge.max_points} pts
                    </div>
                    {status === 'COMPLETED' && (
                      <div className="text-xs text-green-700 font-medium mt-1">
                        Score: {score}/{challenge.max_points}
                      </div>
                    )}
                  </div>
                  {status === 'COMPLETED' && (
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-gray-200 mt-auto">
          <div className="text-sm text-gray-600">
            Total Score
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {session?.total_score || 0} / 600
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{currentChallenge.title}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Attempt {currentAttempt} of {currentChallenge.max_attempts}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeLeft < 60 ? 'bg-red-50' : 'bg-blue-50'
                }`}>
                  <ClockIcon className={`w-5 h-5 ${timeLeft < 60 ? 'text-red-600' : 'text-blue-600'}`} />
                  <span className={`font-mono text-lg font-bold ${
                    timeLeft < 60 ? 'text-red-900' : 'text-blue-900'
                  }`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <button
                  onClick={handleEndRound}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  End Round
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto grid grid-cols-2 gap-6">
            {/* Left: Challenge */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-bold text-lg mb-3">Challenge</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {currentChallenge.scenario_data?.task || currentChallenge.description}
                  </p>
                  
                  {currentChallenge.scenario_data?.instructions && (
                    <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm text-blue-900 whitespace-pre-wrap">
                        {currentChallenge.scenario_data.instructions}
                      </p>
                    </div>
                  )}
                  
                  {currentChallenge.challenge_type === 'constraint' && currentChallenge.scenario_data?.constraints && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">Constraints:</h4>
                      <div className="space-y-2">
                        {(currentChallenge.scenario_data.constraints || []).map((c: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-600">✓</span>
                            <span className="text-gray-700">{c.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {currentChallenge.challenge_type === 'context' && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-sm mb-2">Context Document:</h4>
                      <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-60 overflow-y-auto">
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">
                          {currentChallenge.scenario_data?.noisy_context || 'No context provided.'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {currentChallenge.challenge_type === 'debugging' && (
                    <div className="mt-4 space-y-3">
                      {currentChallenge.scenario_data?.broken_prompt && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Broken Prompt:</h4>
                        <div className="p-3 bg-red-50 rounded border border-red-200">
                          <code className="text-sm text-red-900">
                            {currentChallenge.scenario_data.broken_prompt}
                          </code>
                        </div>
                      </div>
                      )}
                      
                      {currentChallenge.scenario_data?.bad_outputs && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Bad Outputs:</h4>
                        <div className="space-y-2">
                          {(currentChallenge.scenario_data.bad_outputs || []).map((output: any, idx: number) => (
                            <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                              <div className="text-gray-700 mb-1">{output.output}</div>
                              <div className="text-red-600">Issue: {output.issue?.replace('_', ' ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Attempts History */}
              {attempts.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-bold text-lg mb-3">Previous Attempts</h3>
                  <div className="space-y-2">
                    {attempts.map((attempt) => (
                      <div key={attempt.attempt_number} className="p-3 bg-gray-50 rounded border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Attempt {attempt.attempt_number}</span>
                          <span className={`text-sm font-bold ${
                            attempt.passed ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {Math.round(attempt.total_score)} pts
                          </span>
                        </div>
                        {attempt.evaluation_feedback && attempt.evaluation_feedback.length > 0 && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {attempt.evaluation_feedback.slice(0, 2).map((feedback, idx) => (
                              <div key={idx}>• {feedback}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Right: Editor */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-bold text-lg mb-3">Your Prompt</h3>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Write your prompt here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>{promptText.split(/\s+/).filter(w => w.length > 0).length} words</span>
                  <span>{promptText.length} characters</span>
                </div>
              </div>
              
              {(['constraint', 'context'].includes(currentChallenge.challenge_type)) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-bold text-lg mb-3">Expected Output</h3>
                  <textarea
                    value={expectedOutput}
                    onChange={(e) => setExpectedOutput(e.target.value)}
                    placeholder="What output would your prompt produce?"
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 text-xs text-gray-600">
                    {expectedOutput.split(/\s+/).filter(w => w.length > 0).length} words
                  </div>
                </div>
              )}
              
              {/* Evaluation Results */}
              {lastEvaluation && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-bold text-lg mb-3">Evaluation Results</h3>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700">Total Score</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {Math.round(lastEvaluation.totalScore)} / {lastEvaluation.maxScore}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(lastEvaluation.totalScore / lastEvaluation.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {lastEvaluation.breakdown.map((criterion: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{criterion.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={criterion.passed ? 'text-green-600' : 'text-gray-500'}>
                            {Math.round(criterion.score)}/{criterion.maxScore}
                          </span>
                          {criterion.passed ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-600" />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {lastEvaluation.feedback && lastEvaluation.feedback.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="text-sm font-semibold text-yellow-900 mb-2">Feedback:</div>
                      <div className="space-y-1">
                        {lastEvaluation.feedback.map((fb: string, idx: number) => (
                          <div key={idx} className="text-xs text-yellow-800">• {fb}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating || currentAttempt > currentChallenge.max_attempts}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {evaluating ? 'Evaluating...' : 'Test Prompt'}
                </button>
                
                <button
                  onClick={handleSubmitFinal}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Submit Final
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
