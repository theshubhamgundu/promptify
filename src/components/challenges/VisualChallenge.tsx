import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AIProvider } from '../../lib/byok-service';
import { useVisionEvaluation } from '../../hooks/useVisionEvaluation';
import { getVisionBestScore, getVisionRemainingAttempts } from '../../lib/round3-evaluator';
import { PlayIcon, ShieldIcon, CheckCircleIcon, ExclamationCircleIcon, EyeIcon, ClockIcon } from '../icons';

interface VisualChallengeProps {
  challenge: any; // VisionQuestion from round3-questions.ts
  teamId: string;
  roundSessionId: string; // This is the round3_session ID
  onComplete: () => void;
}

export function VisualChallenge({ challenge, teamId, roundSessionId, onComplete }: VisualChallengeProps) {
  const [promptText, setPromptText] = useState('');
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [bestScore, setBestScore] = useState<number>(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(3);
  const [startTime] = useState(Date.now());
  
  // Auto-detect active provider
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);
  
  useEffect(() => {
    // Import byokSession dynamically to avoid circular dependency
    import('../../lib/byok-service').then(({ byokSession }) => {
      const providers: AIProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ', 'MISTRAL', 'COHERE'];
      const found = providers.find(p => byokSession.hasKey(p));
      if (found) {
        setActiveProvider(found);
      }
    });
  }, []);
  
  const { submitAndEvaluate, submitting, evaluating, error } = useVisionEvaluation();

  // Challenge is actually a VisionQuestion
  const questionId = challenge.id;
  const targetImage = challenge.imageUrl;
  const maxAttempts = 3; // Fixed for all questions
  
  // Load best score and remaining attempts
  useEffect(() => {
    async function load() {
      const [score, attempts] = await Promise.all([
        getVisionBestScore(teamId, questionId),
        getVisionRemainingAttempts(teamId, questionId, maxAttempts)
      ]);
      
      setBestScore(score);
      setRemainingAttempts(attempts);
    }
    
    load();
  }, [teamId, questionId, maxAttempts]);

  const handleEvaluate = async () => {
    if (!promptText.trim()) return;
    if (remainingAttempts <= 0) {
      return;
    }
    
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    const result = await submitAndEvaluate({
      teamId,
      challengeId: questionId,
      roundSessionId,
      participantPrompt: promptText,
      referenceImageURL: targetImage,
      challengeData: challenge,
      activeProvider,
      timeTaken
    });
    
    if (result.success && result.evaluation) {
      setEvaluationResult(result.evaluation);
      
      // Update best score if improved
      if (result.evaluation.totalScore > bestScore) {
        setBestScore(result.evaluation.totalScore);
      }
      
      // Update remaining attempts
      setRemainingAttempts(prev => Math.max(0, prev - 1));
      
      // Check if passed (score >= 60% of max)
      const passingThreshold = challenge.maxScore * 0.6;
      if (result.evaluation.totalScore >= passingThreshold) {
        // Update round3_session to mark question as completed and add score
        await supabase.rpc('complete_round3_question', {
          p_session_id: roundSessionId,
          p_question_id: questionId,
          p_tier: challenge.tier,
          p_score: result.evaluation.totalScore
        });
        
        setTimeout(() => onComplete(), 2000);
      }
    }
  };

      const isPassed = evaluationResult && evaluationResult.passed;
      const isProcessing = submitting || evaluating;

      return (
        <div className="flex h-full p-6 gap-6 bg-gray-50">
          {/* Left Panel: The Subject Image */}
          <div className="w-1/3 flex flex-col gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
                <EyeIcon className="text-blue-600 w-5 h-5" /> 
                Target Image
              </h2>
              <div 
                className="aspect-square w-full rounded-lg overflow-hidden border-2 border-gray-300 relative select-none"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              >
                <img 
                  src={targetImage} 
                  alt="Challenge Image" 
                  className="w-full h-full object-cover pointer-events-none"
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                />
                {/* Overlay to prevent interaction */}
                <div className="absolute inset-0 pointer-events-none select-none"></div>
              </div>
              <div className="mt-4 text-sm text-gray-700 leading-relaxed">
                {challenge.description}
              </div>
              
              {/* Stats */}
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Best Score:</span>
                  <span className="text-green-600 font-bold">{bestScore.toFixed(1)}/{challenge.maxScore}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Attempts Left:</span>
                  <span className="text-blue-600 font-bold">{remainingAttempts}/{maxAttempts}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Panel: Prompt & Execution */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Input Area */}
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col shadow-sm overflow-hidden flex-1 max-h-[50%]">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 font-bold flex justify-between items-center text-sm">
                <span className="text-gray-900">Your Description</span>
                {remainingAttempts === 0 && (
                  <span className="text-red-600 text-xs">NO ATTEMPTS LEFT</span>
                )}
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe what you see in the image... Be specific and detailed!"
                className="flex-1 bg-white p-4 text-gray-900 text-sm focus:outline-none resize-none placeholder-gray-400"
                spellCheck="false"
                disabled={isProcessing || remainingAttempts === 0}
              />
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                {error && <span className="text-red-600 text-xs font-bold">{error}</span>}
                {isProcessing && (
                  <span className="text-blue-600 text-xs font-bold">
                    Evaluating...
                  </span>
                )}
                <button
                  onClick={handleEvaluate}
                  disabled={isProcessing || !promptText.trim() || remainingAttempts === 0}
                  className="ml-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center gap-2"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <><PlayIcon className="w-4 h-4" /> SUBMIT</>
                  )}
                </button>
              </div>
            </div>
            
            {/* Results */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden flex-1">
              <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 font-bold text-sm text-gray-300">
                EVALUATION RESULTS
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {evaluationResult ? (
                  <div className="space-y-4">
                    {/* Score Card */}
                    <div className={`p-4 rounded-lg border-2 ${
                      isPassed 
                        ? 'bg-green-900/20 border-green-500' 
                        : 'bg-orange-900/20 border-orange-500'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          {isPassed ? (
                            <><CheckCircleIcon className="w-6 h-6 text-green-400" /> PASSED</>
                          ) : (
                            <><ClockIcon className="w-6 h-6 text-orange-400" /> TRY AGAIN</>
                          )}
                        </h3>
                        <div className="text-3xl font-black text-white">
                          {evaluationResult.totalScore.toFixed(1)}<span className="text-lg text-gray-400">/{evaluationResult.maxScore}</span>
                        </div>
                      </div>
                      
                      {/* Pattern Match Summary */}
                      <div className="mb-3 text-sm">
                        <div className="text-gray-300">
                          Matched <span className="font-bold text-white">
                            {evaluationResult.matchedPatterns.filter((p: any) => p.matched).length}/
                            {evaluationResult.matchedPatterns.length}
                          </span> elements
                        </div>
                      </div>
                      
                      {/* Feedback */}
                      <div className="text-xs text-gray-300 border-t border-gray-700 pt-3 space-y-1">
                        {evaluationResult.feedback.map((line: string, i: number) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                    

                    {/* Action Button */}
                    {isPassed ? (
                      <button 
                        onClick={onComplete}
                        className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all"
                      >
                        Continue to Next Challenge →
                      </button>
                    ) : remainingAttempts > 0 ? (
                      <button 
                        onClick={() => {
                          setPromptText('');
                          setEvaluationResult(null);
                        }}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
                      >
                        Try Again ({remainingAttempts} attempts left)
                      </button>
                    ) : (
                      <div className="w-full px-4 py-3 bg-red-900/50 border-2 border-red-500 text-red-200 font-bold rounded-lg text-center">
                        No attempts remaining. Best score: {bestScore.toFixed(1)}/100
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600">
                    <ShieldIcon className="w-12 h-12 mb-2 opacity-50" />
                    <p>Describe the image and click SUBMIT</p>
                    <p className="text-xs mt-2">Your description will be evaluated instantly</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
