import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sendAIRequest, AIProvider } from '../../lib/byok-service';
import { PlayIcon, ShieldIcon, CheckCircleIcon, ExclamationCircleIcon, ImageIcon } from '../icons';

interface VisualChallengeProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  activeProvider: AIProvider | null;
  onComplete: () => void;
}

export function VisualChallenge({ challenge, teamId, roundSessionId, activeProvider, onComplete }: VisualChallengeProps) {
  const [promptText, setPromptText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Challenge config extracts
  const targetImage = challenge.configuration?.scenario_data?.target_image_url || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e'; // fallback
  const expectedKeyword = challenge.configuration?.expected_output || '';

  const handleEvaluate = async () => {
    if (!promptText.trim()) return;
    
    setEvaluating(true);
    setLlmOutput('');
    setEvaluationResult(null);
    setError(null);
    
    try {
      let aiResponseText = "";
      
      if (activeProvider) {
        // Send a multi-modal request (Assuming ai-gateway forwards it correctly)
        // Some providers might need specific formatting for images.
        // For simplicity, we assume the provider supports standard text + image_url array formats.
        const aiResponse = await sendAIRequest(
          activeProvider,
          teamId,
          roundSessionId,
          challenge.id,
          {
            // @ts-ignore - Extending the message structure slightly for Vision
            messages: [
              {
                role: 'user', 
                content: [
                  { type: 'text', text: promptText },
                  { type: 'image_url', image_url: { url: targetImage } }
                ]
              }
            ],
            model: challenge.configuration?.byok?.allowed_models?.[0] || 'gpt-4o', // Must use a vision model
            maxTokens: challenge.configuration?.byok?.max_tokens_per_request || 500,
          }
        );
        
        if (!aiResponse.success) {
          throw new Error(aiResponse.error || 'AI Request failed');
        }
        
        aiResponseText = aiResponse.content || '';
        setLlmOutput(aiResponseText);
      } else {
        throw new Error("API Key required to run the Visual Engine");
      }
      
      // Grade output
      const isMatch = expectedKeyword ? aiResponseText.toLowerCase().includes(expectedKeyword.toLowerCase()) : true;
      const score = isMatch ? challenge.base_points : 0;
      
      const evalResult = {
        passed: isMatch,
        score,
        feedback: isMatch ? "Visual features correctly identified." : "The AI failed to identify the expected features based on your prompt."
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
      console.error('Visual Evaluation error:', err);
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="flex h-full p-6 gap-6">
      {/* Left Panel: The Subject Image */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-xl">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ImageIcon className="text-purple-400 w-5 h-5" /> 
            Target Anomaly
          </h2>
          <div className="aspect-square w-full rounded-lg overflow-hidden border-2 border-purple-500/30 relative">
            <img 
              src={targetImage} 
              alt="Target Anomaly" 
              className="w-full h-full object-cover"
            />
            {/* Scanline overlay effect */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
          </div>
          <div className="mt-4 text-sm text-gray-400 leading-relaxed">
            {challenge.description}
          </div>
        </div>
      </div>
      
      {/* Right Panel: Prompt & Execution */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Terminal Input */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden flex-1 max-h-[50%]">
          <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 font-bold flex justify-between items-center text-sm">
            <span className="text-gray-300">VISION DECODER TERMINAL</span>
          </div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Instruct the AI how to analyze the image..."
            className="flex-1 bg-transparent p-4 text-purple-400 font-mono text-sm focus:outline-none resize-none placeholder-purple-800/50"
            spellCheck="false"
          />
          <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-between items-center">
            {error && <span className="text-red-400 text-xs font-bold">{error}</span>}
            <button
              onClick={handleEvaluate}
              disabled={evaluating || !activeProvider || !promptText.trim()}
              className="ml-auto px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center gap-2"
            >
              {evaluating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <><PlayIcon className="w-4 h-4" /> EXTRACT DATA</>
              )}
            </button>
          </div>
        </div>
        
        {/* Results */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden flex-1">
          <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 font-bold text-sm text-gray-300">
            DECODED SIGNAL
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {llmOutput ? (
              <div className="space-y-4">
                <div className="bg-black/50 p-4 rounded-lg border border-gray-700 font-mono text-sm text-gray-300 whitespace-pre-wrap">
                  {llmOutput}
                </div>
                {evaluationResult && (
                  <div className={`p-4 rounded-lg border flex items-center justify-between ${evaluationResult.passed ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                    <div>
                      <h3 className="text-xs font-bold uppercase mb-1 flex items-center gap-2">
                        {evaluationResult.passed ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <ExclamationCircleIcon className="w-4 h-4 text-red-400" />}
                        <span className={evaluationResult.passed ? 'text-green-400' : 'text-red-400'}>
                          {evaluationResult.passed ? 'TARGET IDENTIFIED' : 'TARGET MISSED'}
                        </span>
                      </h3>
                      <div className="text-sm text-gray-300">{evaluationResult.feedback}</div>
                    </div>
                    {evaluationResult.passed && (
                      <button 
                        onClick={onComplete}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg"
                      >
                        Next Stage
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600">
                <ShieldIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>Awaiting visual extraction...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
