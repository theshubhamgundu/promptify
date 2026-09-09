import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';

import { byokSession, sendAIRequest, AIProvider, BYOKConfig } from '../lib/byok-service';
import { ClockIcon, CheckCircleIcon, ExclamationCircleIcon, ShieldIcon } from '../components/icons';
import { ConfirmDialog } from '../components/ui';
import { sounds } from '../lib/sound';

// Resolves BYOK config from either configuration.byok (legacy) or configuration.ai (admin form)
function resolveBYOKConfig(configuration: any): BYOKConfig | null {
  // Try top-level byok first (set by updated admin form)
  if (configuration?.byok?.enabled) return configuration.byok as BYOKConfig;
  // Fallback: derive from configuration.ai (older admin path)
  if (configuration?.ai?.byok_required) {
    return {
      enabled: true,
      required_providers: (configuration.ai.allowed_providers || []).map((p: string) => p.toUpperCase()) as any,
      allowed_models: configuration.ai.evaluation_model ? [configuration.ai.evaluation_model] : ['gpt-3.5-turbo'],
      max_requests: 50,
      max_tokens_per_request: 1000,
      max_total_tokens: 50000,
      allowed_tools: false,
      allowed_web_access: false,
      timeout_seconds: 30,
    };
  }
  return null;
}

interface Challenge {
  id: string;
  round_id: string;
  title: string;
  description: string;
  type: string; // 'PROMPT'
  base_points: number;
  configuration: any;
  order_index: number;
}

interface PromptHeistRoundProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

export default function PromptHeistRound({ roundId, navigate }: PromptHeistRoundProps) {
  const { currentEvent } = useEventStore();
  const { currentTeam } = useTeamStore();
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [roundSession, setRoundSession] = useState<any>(null);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [round, setRound] = useState<any>(null);
  
  // BYOK State (auto-resolved, no UI)
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);
  
  // User input
  const [promptText, setPromptText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [llmOutput, setLlmOutput] = useState<string>('');
  
  const [timeLeft, setTimeLeft] = useState(0);
  const deadlineRef = useRef<string | null>(null);
  const isRoundActive = useRef(true);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (roundId && currentTeam?.id) initializeRound();
  }, [roundId, currentTeam?.id]);

  // Heartbeat & Timer effect
  useEffect(() => {
    if (!roundSession?.id) return;
    const heartbeatInterval = setInterval(() => {
      if (isRoundActive.current) {
        supabase.rpc('record_session_heartbeat', { p_round_session_id: roundSession.id }).then();
      }
    }, 15000);

    if (timeLeft <= 0 || !deadlineRef.current) return;
    const timer = setInterval(() => {
      const remaining = Math.floor((new Date(deadlineRef.current!).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        if (roundSession?.status === 'IN_PROGRESS') handleSubmitRound();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    
    return () => { clearInterval(heartbeatInterval); clearInterval(timer); };
  }, [roundSession?.status, roundSession?.id, timeLeft]);

  const initializeRound = async () => {
    try {
      setLoading(true); setError(null); setActionError(null);
      
      const { data: roundData, error: roundError } = await supabase.from('rounds').select('*').eq('id', roundId).single();
      if (roundError) throw roundError;
      setRound(roundData);
      
      let { data: sessionData, error: sessionError } = await supabase.from('round_sessions')
        .select('*').eq('team_id', currentTeam!.id).eq('round_id', roundId).single();
      
      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
      
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

      if (challengesData && challengesData.length > 0) {
        setChallenges(challengesData);
      } else {
        const promptChals = await supabase.from('prompt_challenges').select('*').eq('round_id', roundId).order('sub_round_number');
        const mapped = (promptChals.data || []).map((c: any, i: number) => ({
          id: c.id,
          round_id: c.round_id,
          title: c.title,
          description: c.description,
          type: c.challenge_type || 'PROMPT',
          base_points: c.max_points || 100,
          configuration: {
            ...(c.scenario_data || {}),
            scenario_data: c.scenario_data,
            challenge_type: c.challenge_type,
            expected_output: c.scenario_data?.expected_output || '',
          },
          order_index: c.sub_round_number ?? i + 1,
        }));
        setChallenges(mapped);
      }
      
      let deadline = sessionData.deadline_at;
      if (!deadline) {
        deadline = new Date(Date.now() + (roundData.duration_minutes || 60) * 60 * 1000).toISOString();
      }
      deadlineRef.current = deadline;
      setTimeLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
      
    } catch (err: any) {
      console.error('Error initializing round:', err);
      setError(err.message || 'Failed to load round');
    } finally {
      setLoading(false);
    }
  };

  const currentChallenge = challenges[currentChallengeIndex];
  
  // Check BYOK requirement whenever challenge changes
  useEffect(() => {
    if (!currentChallenge) return;
    
    // Clear previous inputs
    setPromptText('');
    setLlmOutput('');
    setEvaluationResult(null);
    
    const byokConfig = resolveBYOKConfig(currentChallenge.configuration);
    if (byokConfig?.enabled) {
      const foundProvider = byokConfig.required_providers.find(p => byokSession.hasKey(p));
      setActiveProvider(foundProvider || null);
    } else {
      setActiveProvider(null);
    }
  }, [currentChallengeIndex, currentChallenge]);

  const handleEvaluate = async () => {
    if (!currentChallenge || !promptText.trim()) return;
    
    const byokConfig = resolveBYOKConfig(currentChallenge.configuration);
    if (byokConfig?.enabled && !activeProvider) {
      return;
    }
    
    setEvaluating(true);
    setLlmOutput('');
    setEvaluationResult(null);
    setActionError(null);
    
    try {
      let aiResponseText = "";
      
      // Step 1: Execute Prompt via LLM Edge Function if BYOK enabled
      if (byokConfig?.enabled && activeProvider) {
        const aiResponse = await sendAIRequest(
          activeProvider,
          currentTeam!.id,
          roundSession.id,
          currentChallenge.id,
          {
            messages: [{ role: 'user', content: promptText }],
            model: byokConfig.allowed_models?.[0] || 'gpt-3.5-turbo',
            maxTokens: byokConfig.max_tokens_per_request || 500,
          }
        );
        
        if (!aiResponse.success) {
          // Surface rate limit errors with a friendly message
          const isRateLimit = aiResponse.error?.toLowerCase().includes('rate limit');
          throw new Error(isRateLimit
            ? aiResponse.error
            : aiResponse.error || 'AI Request failed'
          );
        }
        
        aiResponseText = aiResponse.content || '';
        setLlmOutput(aiResponseText);
      } else {
        // Fallback or purely deterministic mock (If no BYOK is required)
        aiResponseText = "Deterministic/Mock Evaluation response";
        setLlmOutput(aiResponseText);
      }
      
      // Step 2: Score the output
      // In a real scenario, this grading could also happen via a separate hidden backend LLM call.
      // For now, we simulate scoring locally and send the attempt to the backend.
      const isMatch = aiResponseText.toLowerCase().includes(currentChallenge.configuration?.expected_output?.toLowerCase() || '');
      const score = isMatch ? currentChallenge.base_points : 0;
      
      const evalResult = {
        passed: isMatch,
        score,
        feedback: isMatch ? "Excellent prompt. Constraints met." : "Prompt failed to produce expected constraints."
      };
      
      setEvaluationResult(evalResult);
      if (isMatch) {
        sounds.success();
      } else {
        sounds.error();
      }
      
      // Step 3: Record Attempt securely in Backend
      await supabase.rpc('create_challenge_attempt', {
        p_team_id: currentTeam!.id,
        p_challenge_id: currentChallenge.id,
        p_round_session_id: roundSession.id,
        p_payload: {
          prompt_text: promptText,
          llm_output: aiResponseText,
          evaluation: evalResult
        }
      });
      
    } catch (err: any) {
      console.error('Evaluation error:', err);
      sounds.error();
      setActionError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleSubmitRound = () => {
    setConfirmSubmit(true);
  };

  const executeSubmitRound = async () => {
    setConfirmSubmit(false);
    isRoundActive.current = false;

    const MAX_RETRIES = 3;
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { error: submitError } = await supabase.rpc('submit_round_session', {
          p_round_session_id: roundSession!.id,
        });
        if (submitError) throw submitError;
        if (navigate) navigate('dashboard');
        return; // success
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 1500;
          console.warn(`Submit attempt ${attempt} failed. Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        }
      }
    }
    console.error('Error submitting after retries:', lastError);
    setActionError('Failed to submit round after multiple attempts. Please check your connection and try again.');
    isRoundActive.current = true;
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const confirmDialog = confirmSubmit ? (
    <ConfirmDialog
      title="Submit Final Answer?"
      message="Are you sure you want to finish this round? Your progress will be submitted."
      confirmLabel="Submit Final"
      cancelLabel="Keep Going"
      variant="primary"
      onConfirm={executeSubmitRound}
      onCancel={() => setConfirmSubmit(false)}
    />
  ) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Round 2: Prompt Heist...</p>
        </div>
      </div>
    );
  }

  if (error || !currentChallenge) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {confirmDialog}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{round?.name || 'Prompt Heist'}</h1>
          <div className="flex items-center gap-3">
            {navigate && (
              <button onClick={() => navigate('dashboard')} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                Exit
              </button>
            )}
            {roundSession && (
              <button onClick={handleSubmitRound} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">
                Submit Final
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-gray-600">{error || 'No challenge available'}</p>
        </div>
      </div>
    );
  }

  const byokConfig = resolveBYOKConfig(currentChallenge.configuration);
  const wordCount = promptText.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {confirmDialog}



      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg">Prompt Heist</h2>
          <p className="text-sm text-gray-600">Challenge {currentChallengeIndex + 1} of {challenges.length}</p>
        </div>

        <div className="p-4 space-y-2 flex-1 overflow-y-auto">
          {challenges.map((c, i) => {
            const isActive = i === currentChallengeIndex;
            return (
              <button
                key={c.id}
                onClick={() => setCurrentChallengeIndex(i)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{c.title || `Challenge ${i + 1}`}</div>
                <div className="text-xs text-gray-600 mt-1">{c.base_points} pts</div>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => navigate && navigate('dashboard')}
            className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentChallenge.title}</h1>
              <p className="text-sm text-gray-600 mt-1">{round?.name || 'Prompt Heist'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeLeft < 60 ? 'bg-red-50' : 'bg-blue-50'}`}>
                <ClockIcon className={`w-5 h-5 ${timeLeft < 60 ? 'text-red-600' : 'text-blue-600'}`} />
                <span className={`font-mono text-lg font-bold ${timeLeft < 60 ? 'text-red-900' : 'text-blue-900'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              {navigate && (
                <button
                  onClick={() => navigate('dashboard')}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Exit
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-3">Challenge</h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {currentChallenge.description}
                </p>
                {currentChallenge.configuration?.instructions && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">
                      {currentChallenge.configuration.instructions}
                    </p>
                  </div>
                )}


              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-3">Your Prompt</h3>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Write your prompt here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>{wordCount} words</span>
                  <span>{promptText.length} characters</span>
                </div>
              </div>

              {llmOutput && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-3">LLM Output</h3>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 font-mono text-sm text-gray-700 whitespace-pre-wrap">
                    {llmOutput}
                  </div>
                </div>
              )}

              {evaluationResult && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-3">Evaluation Results</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700">Total Score</span>
                    <span className="text-2xl font-bold text-blue-600">{evaluationResult.score} pts</span>
                  </div>
                  <div className={`p-3 rounded border ${evaluationResult.passed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {evaluationResult.passed
                        ? <CheckCircleIcon className="w-4 h-4 text-green-600" />
                        : <ExclamationCircleIcon className="w-4 h-4 text-orange-500" />}
                      <span className={`text-sm font-semibold ${evaluationResult.passed ? 'text-green-800' : 'text-yellow-900'}`}>
                        {evaluationResult.passed ? 'Passed' : 'Needs improvement'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{evaluationResult.feedback}</p>
                  </div>
                </div>
              )}

              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {actionError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating || (!activeProvider && !!byokConfig?.enabled) || !promptText.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {evaluating ? 'Evaluating...' : 'Test Prompt'}
                </button>
                {currentChallengeIndex < challenges.length - 1 ? (
                  <button
                    onClick={() => setCurrentChallengeIndex(i => i + 1)}
                    className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
                  >
                    Next Challenge
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitRound}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                  >
                    Submit Final
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
