import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';
import { BYOKConnect, BYOKConnected } from '../components/BYOKConnect';
import { byokSession, sendAIRequest, AIProvider, BYOKConfig } from '../lib/byok-service';
import { ClockIcon, CheckCircleIcon, ExclamationCircleIcon, ShieldIcon, PlayIcon, LightbulbIcon } from '../components/icons';
import { ConfirmDialog } from '../components/ui';

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
  const [round, setRound] = useState<any>(null);
  
  // BYOK State
  const [showBYOKConnect, setShowBYOKConnect] = useState(false);
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
      setLoading(true); setError(null);
      
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
      setChallenges(challengesData);
      
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
    
    const byokConfig = currentChallenge.configuration?.byok as BYOKConfig;
    if (byokConfig?.enabled) {
      // Do we already have a key in memory for one of the allowed providers?
      const foundProvider = byokConfig.required_providers.find(p => byokSession.hasKey(p));
      if (foundProvider) {
        setActiveProvider(foundProvider);
        setShowBYOKConnect(false);
      } else {
        setActiveProvider(null);
        setShowBYOKConnect(true);
      }
    } else {
      setShowBYOKConnect(false);
      setActiveProvider(null);
    }
  }, [currentChallengeIndex, currentChallenge]);

  const handleEvaluate = async () => {
    if (!currentChallenge || !promptText.trim()) return;
    
    const byokConfig = currentChallenge.configuration?.byok as BYOKConfig;
    if (byokConfig?.enabled && !activeProvider) {
      setShowBYOKConnect(true);
      return;
    }
    
    setEvaluating(true);
    setLlmOutput('');
    setEvaluationResult(null);
    
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
      setError(err.message || 'Evaluation failed');
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
    setError('Failed to submit round after multiple attempts. Please check your connection and try again.');
    isRoundActive.current = true;
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading Prompt Heist...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-600 font-bold">{error}</div>;
  if (!currentChallenge) return <div className="flex items-center justify-center min-h-screen">No challenges found.</div>;

  const byokConfig = currentChallenge.configuration?.byok as BYOKConfig;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {confirmSubmit && (
        <ConfirmDialog
          title="Finish Round?"
          message="Are you sure you want to finish this round? Your progress will be submitted."
          confirmLabel="Finish Round"
          cancelLabel="Keep Going"
          variant="primary"
          onConfirm={executeSubmitRound}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}
      {/* BYOK Modal */}
      {showBYOKConnect && byokConfig && (
        <BYOKConnect 
          config={byokConfig}
          teamId={currentTeam!.id}
          roundSessionId={roundSession.id}
          challengeId={currentChallenge.id}
          onConnected={(provider) => {
            setActiveProvider(provider);
            setShowBYOKConnect(false);
          }}
          onCancel={() => setShowBYOKConnect(false)}
        />
      )}
      
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 uppercase tracking-wider">
            {round?.name || 'Prompt Heist'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Challenge {currentChallengeIndex + 1} of {challenges.length}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-gray-700 rounded-lg flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-orange-400" />
            <span className="font-mono text-xl font-bold">{formatTime(timeLeft)}</span>
          </div>
          <button onClick={handleSubmitRound} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/50">
            End Round
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Challenges) */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          {challenges.map((c, i) => (
            <button 
              key={c.id} 
              onClick={() => setCurrentChallengeIndex(i)}
              className={`w-full text-left p-4 border-b border-gray-700 transition-colors ${currentChallengeIndex === i ? 'bg-gray-700 border-l-4 border-l-orange-500' : 'hover:bg-gray-700/50'}`}
            >
              <div className="font-bold">{c.title || `Challenge ${i + 1}`}</div>
              <div className="text-xs text-gray-400 mt-1">{c.base_points} pts</div>
            </button>
          ))}
        </div>
        
        {/* Workspace */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto gap-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <ShieldIcon className="text-orange-400 w-6 h-6" /> 
              Mission Briefing
            </h2>
            <p className="text-gray-300 leading-relaxed mb-4">{currentChallenge.description}</p>
            
            {activeProvider && (
              <BYOKConnected 
                provider={activeProvider} 
                onDisconnect={() => {
                  byokSession.clearKey(activeProvider);
                  setActiveProvider(null);
                  setShowBYOKConnect(true);
                }} 
              />
            )}
            
            {!activeProvider && byokConfig?.enabled && !showBYOKConnect && (
              <button 
                onClick={() => setShowBYOKConnect(true)}
                className="mt-4 px-4 py-2 bg-orange-600/20 text-orange-400 border border-orange-500/50 rounded-lg font-medium hover:bg-orange-600/30 transition-colors flex items-center gap-2"
              >
                <ShieldIcon className="w-5 h-5" /> Connect API Key
              </button>
            )}
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-6 min-h-[400px]">
            {/* Prompt Editor */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden">
              <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 font-bold flex justify-between items-center text-sm">
                <span className="text-gray-300">SYSTEM PROMPT TERMINAL</span>
                <span className="text-orange-400 animate-pulse">_</span>
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Enter your system prompt to hack the LLM..."
                className="flex-1 bg-transparent p-4 text-green-400 font-mono text-sm focus:outline-none resize-none placeholder-green-800/50"
                spellCheck="false"
              />
              <div className="p-4 border-t border-gray-700 bg-gray-900">
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating || (!activeProvider && byokConfig?.enabled) || !promptText.trim()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex justify-center items-center gap-2"
                >
                  {evaluating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <><PlayIcon className="w-5 h-5" /> EXECUTE PROMPT</>
                  )}
                </button>
              </div>
            </div>
            
            {/* Output & Evaluation */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden">
              <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 font-bold text-sm text-gray-300">
                LLM RESPONSE & ANALYSIS
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {llmOutput && (
                  <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">RAW OUTPUT</h3>
                    <div className="font-mono text-sm text-gray-300 whitespace-pre-wrap">{llmOutput}</div>
                  </div>
                )}
                
                {evaluationResult && (
                  <div className={`p-4 rounded-lg border ${evaluationResult.passed ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                    <h3 className="text-xs font-bold uppercase mb-2 flex items-center gap-2">
                      {evaluationResult.passed ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                      <span className={evaluationResult.passed ? 'text-green-400' : 'text-red-400'}>
                        {evaluationResult.passed ? 'MISSION SUCCESSFUL' : 'MISSION FAILED'}
                      </span>
                    </h3>
                    <div className="text-sm text-gray-300 mb-2">{evaluationResult.feedback}</div>
                    <div className="text-xl font-bold mt-2 font-mono text-white">Score: {evaluationResult.score} pts</div>
                  </div>
                )}
                
                {!llmOutput && !evaluationResult && !evaluating && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                    <LightbulbIcon className="w-12 h-12 mb-2 opacity-50" />
                    <p>Awaiting execution...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
