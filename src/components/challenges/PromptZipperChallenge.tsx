import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendAIRequest, AIProvider } from '../../lib/byok-service';
import { PlayIcon, CheckCircleIcon, ExclamationCircleIcon, ShieldIcon } from '../icons';

interface PromptZipperChallengeProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  activeProvider: AIProvider | null;
  onComplete: () => void;
}

export function PromptZipperChallenge({ challenge, teamId, roundSessionId, activeProvider, onComplete }: PromptZipperChallengeProps) {
  const [promptText, setPromptText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  // Challenge config extracts
  const originalPrompt = challenge.configuration?.scenario_data?.original_prompt || 'Write a very long and detailed explanation of quantum physics, but make sure to include the word "BANANA" exactly once, and ensure the entire response is written in the style of a 1920s mobster, and do not use any punctuation marks whatsoever except for commas.';
  const maxChars = challenge.configuration?.scenario_data?.max_chars || 150;
  const expectedKeyword = challenge.configuration?.expected_output || 'BANANA'; // Extremely simplified check

  useEffect(() => {
    setCharCount(promptText.length);
  }, [promptText]);

  const handleEvaluate = async () => {
    if (!promptText.trim()) return;
    
    if (charCount > maxChars) {
      setError(`Prompt exceeds maximum length of ${maxChars} characters.`);
      return;
    }
    
    setEvaluating(true);
    setLlmOutput('');
    setEvaluationResult(null);
    setError(null);
    
    try {
      let aiResponseText = "";
      
      if (activeProvider) {
        const aiResponse = await sendAIRequest(
          activeProvider,
          teamId,
          roundSessionId,
          challenge.id,
          {
            messages: [
              { role: 'user', content: promptText }
            ],
            model: challenge.configuration?.byok?.allowed_models?.[0] || 'gpt-3.5-turbo',
            maxTokens: challenge.configuration?.byok?.max_tokens_per_request || 500,
          }
        );
        
        if (!aiResponse.success) {
          throw new Error(aiResponse.error || 'AI Request failed');
        }
        
        aiResponseText = aiResponse.content || '';
        setLlmOutput(aiResponseText);
      } else {
        throw new Error("API Key required to run the Zipper Engine");
      }
      
      // Grade output
      // True token golfing would compare the LLM output of the user's prompt vs the original prompt.
      // For this implementation, we just check if it triggers the required behavior (expected keyword).
      const isMatch = expectedKeyword ? aiResponseText.toLowerCase().includes(expectedKeyword.toLowerCase()) : false;
      const score = isMatch ? challenge.base_points : 0;
      
      const evalResult = {
        passed: isMatch,
        score,
        feedback: isMatch ? "Compression successful. Target behavior retained." : "Behavior lost during compression. Target output failed."
      };
      
      setEvaluationResult(evalResult);
      
      // Save attempt
      await supabase.rpc('create_challenge_attempt', {
        p_team_id: teamId,
        p_challenge_id: challenge.id,
        p_round_session_id: roundSessionId,
        p_payload: {
          prompt_text: promptText,
          llm_output: aiResponseText,
          compression_ratio: (promptText.length / originalPrompt.length).toFixed(2),
          evaluation: evalResult
        }
      });
      
    } catch (err: any) {
      console.error('Zipper Evaluation error:', err);
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const percentUsed = Math.min(100, (charCount / maxChars) * 100);
  const isOverLimit = charCount > maxChars;

  return (
    <div className="flex flex-col h-full p-6 gap-6 max-w-5xl mx-auto">
      
      <div className="bg-purple-950/30 rounded-xl p-6 border border-purple-900/50 shadow-2xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-widest text-purple-400 uppercase flex items-center gap-2">
            <ShieldIcon className="w-6 h-6" /> PROMPT COMPRESSION ENGINE
          </h2>
          <p className="text-gray-400 mt-2 max-w-2xl text-sm">{challenge.description}</p>
        </div>
        
        {/* Token/Char Counter Ring */}
        <div className="flex items-center justify-center relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-800" />
            <circle 
              cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" 
              strokeDasharray="251.2" 
              strokeDashoffset={251.2 - (251.2 * percentUsed) / 100}
              className={`transition-all duration-500 ${isOverLimit ? 'text-red-500' : 'text-purple-500'}`} 
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`text-xl font-bold font-mono ${isOverLimit ? 'text-red-500' : 'text-white'}`}>{charCount}</span>
            <span className="text-[10px] text-gray-500 uppercase">/ {maxChars} max</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex gap-6 min-h-[400px]">
        {/* Original Prompt */}
        <div className="w-1/2 bg-gray-900 rounded-xl border border-gray-800 flex flex-col shadow-xl overflow-hidden opacity-75">
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 font-bold text-sm text-gray-400">
            ORIGINAL PAYLOAD ({(originalPrompt.length)} chars)
          </div>
          <div className="flex-1 p-6 font-mono text-sm text-gray-500 whitespace-pre-wrap overflow-y-auto italic bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')]">
            {originalPrompt}
          </div>
        </div>
        
        {/* User Input & Result */}
        <div className="w-1/2 flex flex-col gap-6">
          <div className="flex-1 bg-black rounded-xl border border-purple-900/30 flex flex-col shadow-xl overflow-hidden relative">
            <div className="bg-purple-950/30 px-4 py-2 border-b border-purple-900/30 font-bold flex justify-between items-center text-sm text-purple-400">
              COMPRESSED PAYLOAD
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Write a shorter prompt that achieves the exact same output behavior..."
              className={`flex-1 bg-transparent p-6 font-mono text-sm focus:outline-none resize-none ${isOverLimit ? 'text-red-400 placeholder-red-900/50' : 'text-purple-300 placeholder-purple-900/30'}`}
              spellCheck="false"
            />
            <div className="p-4 border-t border-purple-900/30 bg-black flex justify-between items-center">
              {error && <span className="text-red-500 text-xs font-bold">{error}</span>}
              <button
                onClick={handleEvaluate}
                disabled={evaluating || !activeProvider || !promptText.trim() || isOverLimit}
                className="ml-auto px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-900 disabled:text-gray-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                {evaluating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <><PlayIcon className="w-4 h-4" /> TEST COMPRESSION</>
                )}
              </button>
            </div>
          </div>
          
          {/* Result Area */}
          <div className="h-1/3 bg-gray-900 rounded-xl border border-gray-800 flex flex-col shadow-xl overflow-hidden">
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 font-bold text-xs text-gray-500">
              BEHAVIOR ANALYSIS
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {llmOutput ? (
                <div className="space-y-4">
                  {evaluationResult && (
                    <div className={`p-4 rounded-lg border flex items-center justify-between ${evaluationResult.passed ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                      <div>
                        <h3 className="text-xs font-bold uppercase mb-1 flex items-center gap-2">
                          {evaluationResult.passed ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                          <span className={evaluationResult.passed ? 'text-green-400' : 'text-red-400'}>
                            {evaluationResult.passed ? 'INTEGRITY MAINTAINED' : 'BEHAVIORAL DRIFT DETECTED'}
                          </span>
                        </h3>
                        <div className="text-sm text-gray-300">{evaluationResult.feedback}</div>
                      </div>
                      {evaluationResult.passed && (
                        <button 
                          onClick={onComplete}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg"
                        >
                          Next
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-gray-400 font-mono text-xs p-2 bg-black rounded border border-gray-800">
                    <span className="text-gray-600 uppercase">OUTPUT TRACE: </span>
                    {llmOutput.length > 150 ? llmOutput.substring(0, 150) + '...' : llmOutput}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                  Run compression test to compare behavior.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
