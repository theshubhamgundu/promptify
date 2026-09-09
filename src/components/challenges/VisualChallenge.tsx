import { useState, useEffect } from 'react';
import { AIProvider } from '../../lib/byok-service';
import { useVisionEvaluation } from '../../hooks/useVisionEvaluation';
import { getVisionBestScore, getVisionRemainingAttempts } from '../../lib/round3-evaluator';
import { PlayIcon, ShieldIcon, CheckCircleIcon, ExclamationCircleIcon, ImageIcon, ClockIcon } from '../icons';

interface VisualChallengeProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  activeProvider: AIProvider | null;
  onComplete: () => void;
}

export function VisualChallenge({ challenge, teamId, roundSessionId, activeProvider, onComplete }: VisualChallengeProps) {
  const [promptText, setPromptText] = useState('');
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [bestScore, setBestScore] = useState<number>(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(3);
  const [startTime] = useState(Date.now());
  
  const { submitAndEvaluate, submitting, evaluating, error } = useVisionEvaluation();

  // Challenge config extracts
  const targetImage = challenge.configuration?.scenario_data?.target_image_url || 
                      challenge.configuration?.mediaUrl ||
                      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e'; // fallback
  
  const maxAttempts = challenge.max_attempts || 3;
  
  // Load best score and remaining attempts
  useEffect(() => {
    async function load() {
      const [score, attempts] = await Promise.all([
        getVisionBestScore(teamId, challenge.id),
        getVisionRemainingAttempts(teamId, challenge.id, maxAttempts)
      ]);
      
      setBestScore(score);
      setRemainingAttempts(attempts);
    }
    
    load();
  }, [teamId, challenge.id, maxAttempts]);

  const handleEvaluate = async () => {
    if (!promptText.trim()) return;
    if (remainingAttempts <= 0) {
      return;
    }
    
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    const result = await submitAndEvaluate({
      teamId,
      challengeId: challenge.id,
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
      if (result.evaluation.total_score > bestScore) {
        setBestScore(result.evaluation.total_score);
      }
      
      // Update remaining attempts
      setRemainingAttempts(prev => Math.max(0, prev - 1));
      
      // Check if passed
      const passingScore = challenge.configuration?.scoring_rubric?.passing_score || 60;
      if (result.evaluation.total_score >= passingScore) {
        setTimeout(() => onComplete(), 2000);
      }
    }
  };

      const isPassed = evaluationResult && evaluationResult.passed;
      const isProcessing = submitting || evaluating;

      return (
        <div className="flex h-full p-6 gap-6">
          {/* Left Panel: The Subject Image */}
          <div className="w-1/3 flex flex-col gap-4">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-xl">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ImageIcon className="text-purple-400 w-5 h-5" /> 
                Target Image
              </h2>
              <div className="aspect-square w-full rounded-lg overflow-hidden border-2 border-purple-500/30 relative">
                <img 
                  src={targetImage} 
                  alt="Challenge Image" 
                  className="w-full h-full object-cover"
                />
                {/* Scanline overlay effect */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
              </div>
              <div className="mt-4 text-sm text-gray-400 leading-relaxed">
                {challenge.description}
              </div>
              
              {/* Stats */}
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Best Score:</span>
                  <span className="text-green-400 font-bold">{bestScore.toFixed(1)}/100</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Attempts Left:</span>
                  <span className="text-blue-400 font-bold">{remainingAttempts}/{maxAttempts}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Panel: Prompt & Execution */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Terminal Input */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden flex-1 max-h-[50%]">
              <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 font-bold flex justify-between items-center text-sm">
                <span className="text-gray-300">VISION ANALYZER PROMPT</span>
                {remainingAttempts === 0 && (
                  <span className="text-red-400 text-xs">NO ATTEMPTS LEFT</span>
                )}
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Write a prompt to analyze the image... Be specific and detailed to get a high score!"
                className="flex-1 bg-transparent p-4 text-purple-400 font-mono text-sm focus:outline-none resize-none placeholder-purple-800/50"
                spellCheck="false"
                disabled={isProcessing || remainingAttempts === 0}
              />
              <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-between items-center">
                {error && <span className="text-red-400 text-xs font-bold">{error}</span>}
                {isProcessing && (
                  <span className="text-blue-400 text-xs font-bold">
                    {submitting ? 'Calling AI...' : 'Evaluating response...'}
                  </span>
                )}
                <button
                  onClick={handleEvaluate}
                  disabled={isProcessing || !activeProvider || !promptText.trim() || remainingAttempts === 0}
                  className="ml-auto px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center gap-2"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <><PlayIcon className="w-4 h-4" /> ANALYZE</>
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
                          {evaluationResult.totalScore.toFixed(0)}<span className="text-lg text-gray-400">/100</span>
                        </div>
                      </div>
                      
                      {/* Score Breakdown */}
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Keyword Match:</span>
                          <span className="font-bold">{evaluationResult.breakdown.keywordScore.toFixed(1)}/40</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Concept Coverage:</span>
                          <span className="font-bold">{evaluationResult.breakdown.conceptScore.toFixed(1)}/30</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-300">Word Count:</span>
                          <span className="font-bold">{evaluationResult.breakdown.wordCountScore.toFixed(1)}/10</span>
                        </div>
                        {evaluationResult.breakdown.forbiddenPenalty < 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-red-400">Forbidden Words:</span>
                            <span className="font-bold text-red-400">{evaluationResult.breakdown.forbiddenPenalty.toFixed(1)}</span>
                          </div>
                        )}
                        {evaluationResult.breakdown.bonusScore > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-yellow-400">Bonus Elements:</span>
                            <span className="font-bold text-yellow-400">+{evaluationResult.breakdown.bonusScore.toFixed(1)}/20</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Feedback */}
                      <div className="text-xs text-gray-300 border-t border-gray-700 pt-3 space-y-1">
                        {evaluationResult.feedback.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Detailed Analysis (Collapsible) */}
                    <details className="bg-black/30 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm font-bold text-gray-400 hover:text-gray-200">
                        View Detailed Analysis
                      </summary>
                      <div className="mt-3 space-y-3 text-xs text-gray-400">
                        <div>
                          <strong className="text-gray-300">Word Count:</strong> {evaluationResult.details.wordCount}
                        </div>
                        <div>
                          <strong className="text-gray-300">Keywords Matched ({evaluationResult.details.expectedKeywordsMatched.length}):</strong>{' '}
                          {evaluationResult.details.expectedKeywordsMatched.join(', ') || 'None'}
                        </div>
                        {evaluationResult.details.expectedKeywordsMissed.length > 0 && (
                          <div>
                            <strong className="text-orange-400">Keywords Missed ({evaluationResult.details.expectedKeywordsMissed.length}):</strong>{' '}
                            {evaluationResult.details.expectedKeywordsMissed.join(', ')}
                          </div>
                        )}
                        <div>
                          <strong className="text-gray-300">Concepts Matched ({evaluationResult.details.conceptsMatched.length}):</strong>{' '}
                          {evaluationResult.details.conceptsMatched.join(', ') || 'None'}
                        </div>
                        {evaluationResult.details.conceptsMissed.length > 0 && (
                          <div>
                            <strong className="text-orange-400">Concepts Missed ({evaluationResult.details.conceptsMissed.length}):</strong>{' '}
                            {evaluationResult.details.conceptsMissed.join(', ')}
                          </div>
                        )}
                        {evaluationResult.details.forbiddenKeywordsFound.length > 0 && (
                          <div>
                            <strong className="text-red-400">Forbidden Keywords:</strong>{' '}
                            {evaluationResult.details.forbiddenKeywordsFound.join(', ')}
                          </div>
                        )}
                        {evaluationResult.details.bonusElementsMatched.length > 0 && (
                          <div>
                            <strong className="text-yellow-400">Bonus Elements:</strong>
                            <ul className="ml-4 mt-1 space-y-1">
                              {evaluationResult.details.bonusElementsMatched.map((bonus, i) => (
                                <li key={i}>• {bonus.keyword} - {bonus.description} (+{bonus.points}pts)</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                    
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
                    <p>Write a prompt and click ANALYZE</p>
                    <p className="text-xs mt-2">Your response will be evaluated instantly</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
