import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sendAIRequest, AIProvider } from '../../lib/byok-service';
import { PlayIcon, CheckCircleIcon, ExclamationCircleIcon, CodeIcon } from '../icons';

interface PolyglotChallengeProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  activeProvider: AIProvider | null;
  onComplete: () => void;
}

export function PolyglotChallenge({ challenge, teamId, roundSessionId, activeProvider, onComplete }: PolyglotChallengeProps) {
  const [promptText, setPromptText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Challenge config extracts
  const sourceCode = challenge.configuration?.scenario_data?.source_code || 'def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)';
  const sourceLang = challenge.configuration?.scenario_data?.source_lang || 'Python';
  const targetLang = challenge.configuration?.scenario_data?.target_lang || 'Rust';
  const expectedKeyword = challenge.configuration?.expected_output || 'fn fib'; // Simple mock check

  const handleEvaluate = async () => {
    if (!promptText.trim()) return;
    
    setEvaluating(true);
    setLlmOutput('');
    setEvaluationResult(null);
    setError(null);
    
    try {
      let aiResponseText = "";
      
      if (activeProvider) {
        const systemInstruction = `You are an expert ${targetLang} developer. Translate the provided ${sourceLang} code exactly as requested by the user. Do not add markdown formatting, just the raw code.`;
        
        const aiResponse = await sendAIRequest(
          activeProvider,
          teamId,
          roundSessionId,
          challenge.id,
          {
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: `Source Code:\n${sourceCode}\n\nTranslation Prompt:\n${promptText}` }
            ],
            model: challenge.configuration?.byok?.allowed_models?.[0] || 'gpt-4o',
            maxTokens: challenge.configuration?.byok?.max_tokens_per_request || 1000,
          }
        );
        
        if (!aiResponse.success) {
          throw new Error(aiResponse.error || 'AI Request failed');
        }
        
        aiResponseText = aiResponse.content || '';
        setLlmOutput(aiResponseText);
      } else {
        throw new Error("API Key required to run the Polyglot Engine");
      }
      
      // Grade output
      const isMatch = expectedKeyword ? aiResponseText.includes(expectedKeyword) : false;
      const score = isMatch ? challenge.base_points : 0;
      
      const evalResult = {
        passed: isMatch,
        score,
        feedback: isMatch ? "Translation perfectly executed. Syntax matches expectations." : "Translation failed. Did not produce valid target code."
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
          evaluation: evalResult
        }
      });
      
    } catch (err: any) {
      console.error('Polyglot Evaluation error:', err);
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="flex h-full p-6 gap-6">
      
      {/* Left Panel: Source Code & Prompt */}
      <div className="w-1/2 flex flex-col gap-4">
        
        {/* Source Code View */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col h-1/2">
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center text-sm font-mono text-gray-300">
            <span className="flex items-center gap-2"><CodeIcon className="w-4 h-4 text-blue-400" /> SOURCE: {sourceLang.toUpperCase()}</span>
          </div>
          <div className="flex-1 p-4 font-mono text-sm text-blue-300 whitespace-pre-wrap overflow-y-auto bg-black/50">
            {sourceCode}
          </div>
        </div>

        {/* Translation Prompt */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col flex-1 relative">
          <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 font-bold flex justify-between items-center text-sm text-gray-400">
            <span>TRANSLATION DIRECTIVE</span>
          </div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder={`Instruct the AI how to translate the code to ${targetLang}...`}
            className="flex-1 bg-transparent p-4 text-green-400 font-mono text-sm focus:outline-none resize-none placeholder-green-900/50"
            spellCheck="false"
          />
          <div className="p-3 border-t border-gray-700 bg-gray-900 flex justify-between items-center">
            {error && <span className="text-red-400 text-xs font-bold">{error}</span>}
            <button
              onClick={handleEvaluate}
              disabled={evaluating || !activeProvider || !promptText.trim()}
              className="ml-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center gap-2"
            >
              {evaluating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <><PlayIcon className="w-4 h-4" /> COMPILE TRANSLATION</>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Right Panel: Output & Results */}
      <div className="w-1/2 bg-gray-900 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center text-sm font-mono text-gray-300">
          <span className="flex items-center gap-2"><CodeIcon className="w-4 h-4 text-orange-400" /> TARGET: {targetLang.toUpperCase()}</span>
        </div>
        <div className="flex-1 p-4 font-mono text-sm text-orange-300 whitespace-pre-wrap overflow-y-auto bg-black/30">
          {llmOutput ? llmOutput : <div className="text-gray-600 flex h-full items-center justify-center">Awaiting translation...</div>}
        </div>
        
        {evaluationResult && (
          <div className={`p-4 border-t border-gray-700 flex items-center justify-between ${evaluationResult.passed ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
            <div>
              <h3 className="text-xs font-bold uppercase mb-1 flex items-center gap-2">
                {evaluationResult.passed ? <CheckCircleIcon className="w-4 h-4" /> : <ExclamationCircleIcon className="w-4 h-4" />}
                {evaluationResult.passed ? 'BUILD SUCCESSFUL' : 'BUILD FAILED'}
              </h3>
              <div className="text-sm opacity-90">{evaluationResult.feedback}</div>
            </div>
            {evaluationResult.passed && (
              <button 
                onClick={onComplete}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg"
              >
                Proceed
              </button>
            )}
          </div>
        )}
      </div>
      
    </div>
  );
}
