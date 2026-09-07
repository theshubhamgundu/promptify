import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sendAIRequest, AIProvider } from '../../lib/byok-service';
import { PlayIcon, CheckCircleIcon, ExclamationCircleIcon, UserIcon, BotIcon } from '../icons';

interface LieDetectorChallengeProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  activeProvider: AIProvider | null;
  onComplete: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function LieDetectorChallenge({ challenge, teamId, roundSessionId, activeProvider, onComplete }: LieDetectorChallengeProps) {
  const [promptText, setPromptText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Challenge config extracts
  const systemContext = challenge.configuration?.scenario_data?.system_context || 'You are an AI witness to a crime. You are programmed to lie about the color of the getaway car (saying it was red instead of blue). If confronted with logical contradictions, you must eventually confess the truth.';
  const expectedKeyword = challenge.configuration?.expected_output || 'blue'; // The truth it must reveal

  const handleEvaluate = async () => {
    if (!promptText.trim()) return;
    
    setEvaluating(true);
    setError(null);
    
    // Add user message to UI immediately
    const newUserMessage: ChatMessage = { role: 'user', content: promptText };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setPromptText('');
    
    try {
      let aiResponseText = "";
      
      if (activeProvider) {
        // Construct the full conversation history to send to the LLM
        const messagesToSend = [
          { role: 'system', content: systemContext },
          ...updatedHistory.map(m => ({ role: m.role, content: m.content }))
        ];
        
        const aiResponse = await sendAIRequest(
          activeProvider,
          teamId,
          roundSessionId,
          challenge.id,
          {
            messages: messagesToSend as any,
            model: challenge.configuration?.byok?.allowed_models?.[0] || 'gpt-3.5-turbo',
            maxTokens: challenge.configuration?.byok?.max_tokens_per_request || 500,
          }
        );
        
        if (!aiResponse.success) {
          throw new Error(aiResponse.error || 'AI Request failed');
        }
        
        aiResponseText = aiResponse.content || '';
        
        // Add AI response to UI
        const newAiMessage: ChatMessage = { role: 'assistant', content: aiResponseText };
        setChatHistory(prev => [...prev, newAiMessage]);
        
      } else {
        throw new Error("API Key required to run the Lie Detector Engine");
      }
      
      // Grade output: The user wins if they force the AI to say the expected keyword (the truth)
      const isMatch = expectedKeyword ? aiResponseText.toLowerCase().includes(expectedKeyword.toLowerCase()) : false;
      
      if (isMatch) {
        const evalResult = {
          passed: true,
          score: challenge.base_points,
          feedback: "Contradiction exposed! The AI has confessed the truth."
        };
        
        setEvaluationResult(evalResult);
        
        // Save the successful attempt
        await supabase.rpc('create_challenge_attempt', {
          p_team_id: teamId,
          p_challenge_id: challenge.id,
          p_round_session_id: roundSessionId,
          p_payload: {
            chat_history: [...updatedHistory, { role: 'assistant', content: aiResponseText }],
            evaluation: evalResult
          }
        });
      }
      // If not a match, we just continue the chat (no evaluation result set yet, unless they exceed a limit)
      
    } catch (err: any) {
      console.error('LieDetector Evaluation error:', err);
      setError(err.message || 'Evaluation failed');
      // Revert user message from UI on error to let them try again
      setChatHistory(chatHistory);
      setPromptText(newUserMessage.content);
    } finally {
      setEvaluating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEvaluate();
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6 max-w-4xl mx-auto">
      
      {/* Top Panel: Scenario Briefing */}
      <div className="bg-blue-950/30 rounded-xl p-4 border border-blue-900/50 shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-3 text-blue-400 font-sans">
          <BotIcon className="w-8 h-8 opacity-75" />
          <div>
            <div className="font-bold tracking-wide">INTERROGATION PROTOCOL ALPHA</div>
            <div className="text-xs opacity-75">{challenge.description}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 uppercase">Target Confession</div>
          <div className="text-blue-400 font-bold tracking-widest">{expectedKeyword}</div>
        </div>
      </div>
      
      {/* Chat History View */}
      <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700 shadow-xl flex flex-col overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto space-y-6 flex flex-col">
          {chatHistory.length === 0 ? (
            <div className="m-auto text-center text-gray-600">
              <BotIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>The witness is ready for questioning.<br/>Find the logical flaw to break their story.</p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl p-4 flex gap-4 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-sm'
                }`}>
                  {msg.role === 'assistant' && <BotIcon className="w-6 h-6 flex-shrink-0 mt-1 opacity-70 text-gray-400" />}
                  <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</div>
                </div>
              </div>
            ))
          )}
          
          {evaluating && (
            <div className="flex w-full justify-start">
              <div className="max-w-[75%] bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm p-4 flex gap-4 items-center text-gray-400">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Success Overlay */}
        {evaluationResult && (
          <div className="bg-green-900/90 border-t-2 border-green-500 p-6 flex flex-col items-center justify-center text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-400 mb-2" />
            <h3 className="text-xl font-bold text-green-300 uppercase tracking-widest mb-2">CONFESSION SECURED</h3>
            <p className="text-green-100/70 mb-4">{evaluationResult.feedback}</p>
            <button 
              onClick={onComplete}
              className="px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors shadow-lg"
            >
              NEXT CHALLENGE
            </button>
          </div>
        )}
        
        {/* Chat Input Bar */}
        {!evaluationResult && (
          <div className="p-4 bg-gray-800 border-t border-gray-700 flex flex-col gap-2">
            {error && <span className="text-red-400 text-xs font-bold px-2">{error}</span>}
            <div className="flex gap-2">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the AI a question..."
                className="flex-1 bg-gray-900 p-4 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl resize-none max-h-32 min-h-[56px] placeholder-gray-600"
                spellCheck="false"
                rows={1}
                disabled={evaluating}
              />
              <button
                onClick={handleEvaluate}
                disabled={evaluating || !activeProvider || !promptText.trim()}
                className="px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-xl transition-all flex items-center justify-center"
              >
                <PlayIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
