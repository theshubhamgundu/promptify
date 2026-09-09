import { useState, useMemo } from 'react';
import { Button, TextArea, TextInput } from '../ui';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../lib/sound';
import { DocumentTextIcon, PlayIcon, CheckCircleIcon, ExclamationCircleIcon, ShieldIcon, SparklesIcon, SearchIcon, TargetIcon } from '../icons';
import { sendAIRequest, byokSession, type AIProvider } from '../../lib/byok-service';

interface ZipperProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  participantId?: string;
  onAttemptCompleted: (result: any) => void;
  disabled?: boolean;
}

export default function PromptZipperChallenge({
  challenge,
  teamId,
  roundSessionId,
  participantId,
  onAttemptCompleted,
  disabled = false
}: ZipperProps) {
  const config = challenge.configuration || {};
  const wordLimit = config.wordLimit || 100;
  const sourceDoc = config.sourceDocument || "Technical specification document...";
  const probeQuestions: { id: string; question: string; expectedKeywords: string[]; points: number }[] = config.probeQuestions || [];

  const [compressedPrompt, setCompressedPrompt] = useState('');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{
    wordCount: number;
    wordLimit: number;
    questionsCorrect: number;
    questionsTotal: number;
    accuracyScore: number;
    compressionScore: number;
    constraintScore: number;
    totalScore: number;
    probeDetails?: { question: string; correct: boolean }[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live word counter
  const wordCount = useMemo(() => {
    const trimmed = compressedPrompt.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [compressedPrompt]);

  const isOverLimit = wordCount > wordLimit;

  const handleEvaluate = async () => {
    if (!compressedPrompt.trim() || isOverLimit || isEvaluating || disabled) return;

    setIsEvaluating(true);
    setEvalResult(null);
    sounds.click();

    try {
      // Evaluate probe questions against model context
      const probeResults: { question: string; correct: boolean; expected: string[]; actual: string }[] = [];

      const activeProviders: AIProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ', 'MISTRAL', 'COHERE'];
      const activeKey = activeProviders.find(p => byokSession.hasKey(p));

      for (const probe of probeQuestions) {
        let answer = '';
        if (activeKey) {
          const aiRes = await sendAIRequest(activeKey, teamId, roundSessionId, challenge.id, {
            messages: [
              {
                role: 'system',
                content: `You are answering questions based EXCLUSIVELY on the compressed briefing prompt provided by the user below:\n\n${compressedPrompt}`
              },
              { role: 'user', content: probe.question }
            ],
            model: 'gpt-4o-mini',
            temperature: 0.2
          });
          answer = aiRes.content || '';
        } else {
          // Verification check: check if the compressed prompt contains any of the required keywords
          const lowerPrompt = compressedPrompt.toLowerCase();
          const hasKeyword = probe.expectedKeywords.some(kw => lowerPrompt.includes(kw.toLowerCase()));
          answer = hasKeyword ? `Fact confirmed in compressed text.` : `Information missing from prompt.`;
        }

        const lowerAnswer = (answer + ' ' + compressedPrompt).toLowerCase();
        const isCorrect = probe.expectedKeywords.some(kw => lowerAnswer.includes(kw.toLowerCase()));

        probeResults.push({
          question: probe.question,
          correct: isCorrect,
          expected: probe.expectedKeywords,
          actual: answer
        });
      }

      // Compute scoring
      const questionsCorrect = probeResults.filter(p => p.correct).length;
      const questionsTotal = probeQuestions.length || 5;

      const accuracyScore = Math.round((questionsCorrect / questionsTotal) * 105);
      const compressionScore = Math.max(0, Math.round(((wordLimit - wordCount) / wordLimit) * 30));
      const constraintScore = isOverLimit ? 0 : 15;
      const totalScore = accuracyScore + compressionScore + constraintScore;

      const { data, error } = await (supabase.rpc as any)('evaluate_prompt_zipper', {
        p_team_id: teamId,
        p_challenge_id: challenge.id,
        p_round_session_id: roundSessionId,
        p_participant_id: participantId || null,
        p_compressed_prompt: compressedPrompt,
        p_word_count: wordCount,
        p_word_limit: wordLimit,
        p_probes_correct: questionsCorrect,
        p_probes_total: questionsTotal,
        p_accuracy_score: accuracyScore,
        p_compression_score: compressionScore,
        p_constraint_score: constraintScore,
        p_total_score: totalScore
      });

      if (error) throw error;

      setEvalResult({
        wordCount,
        wordLimit,
        questionsCorrect,
        questionsTotal,
        accuracyScore,
        compressionScore,
        constraintScore,
        totalScore,
        probeDetails: probeResults
      });

      if (questionsCorrect >= 3) {
        sounds.success();
      } else {
        sounds.error();
      }

      onAttemptCompleted(data || { totalScore, isCompleted: true });

    } catch (err: any) {
      console.error('Prompt zipper evaluation error:', err);
      sounds.error();
      setErrorMessage(err.message || 'Error evaluating prompt compression');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-red-900">{errorMessage}</div>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="text-xs text-red-700 hover:text-red-900 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Challenge Instructions & Objective Card */}
      <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-blue-700 font-heading font-bold text-sm">
            <DocumentTextIcon className="w-5 h-5 text-blue-600" />
            <span>Challenge 4: Semantic Prompt Compression & Information Density</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
              Limit: ≤ {wordLimit} Words
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
              Base Points: {challenge.base_points || 150}
            </span>
          </div>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{challenge.description}</p>
      </div>

      {/* Two-Column Side-by-Side Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Source Document Reader */}
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col h-[540px]">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Source Technical Specifications
              </span>
            </div>
            <div className="w-44">
              <TextInput
                value={docSearchQuery}
                onChange={setDocSearchQuery}
                placeholder="Search document..."
                className="bg-gray-50 border-gray-200 focus:bg-white text-xs py-1"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap select-text bg-gray-50/70 p-4 rounded-xl border border-gray-200 font-mono">
            {sourceDoc}
          </div>
        </div>

        {/* Right: Compressed Prompt Composer & Live Feedback */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Compressed Prompt Formulation
                </span>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isOverLimit 
                  ? 'bg-red-100 text-red-700 border border-red-200' 
                  : wordCount >= 85 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {wordCount} of {wordLimit} words
              </span>
            </div>

            <label className="text-xs font-medium text-gray-500 mb-2">
              Distill all operational constants, technical metrics, and key parameters into a concise summary:
            </label>

            <TextArea
              rows={8}
              value={compressedPrompt}
              onChange={setCompressedPrompt}
              placeholder="Enter your compressed technical summary here..."
              className="w-full bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl p-3.5 text-xs text-gray-900 resize-none flex-1 font-mono leading-relaxed placeholder-gray-400"
              disabled={disabled || isEvaluating}
            />

            {isOverLimit && (
              <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1.5">
                <ExclamationCircleIcon className="w-4 h-4" />
                Prompt exceeds limit by {wordCount - wordLimit} words. Please trim text before submitting.
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleEvaluate}
                disabled={!compressedPrompt.trim() || isOverLimit || isEvaluating || disabled}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                {isEvaluating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Running Automated Information Probe Tests...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Run Compression Evaluation
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Evaluation Results Card */}
          {evalResult && (
            <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4 text-xs animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <span className="font-bold text-sm text-gray-900">Compression Evaluation Results</span>
                <span className="text-blue-600 font-extrabold text-sm">
                  +{evalResult.totalScore} Points Earned
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-[10px] text-gray-500 font-medium">Accuracy</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {evalResult.accuracyScore} pts ({evalResult.questionsCorrect}/{evalResult.questionsTotal})
                  </div>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-[10px] text-gray-500 font-medium">Density</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {evalResult.compressionScore} pts
                  </div>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-[10px] text-gray-500 font-medium">Compliance</div>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {evalResult.constraintScore} pts
                  </div>
                </div>
              </div>

              {evalResult.probeDetails && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-gray-500 font-semibold uppercase">Knowledge Validation Queries:</div>
                  {evalResult.probeDetails.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200/80">
                      <span className="text-gray-700 truncate max-w-sm font-medium">{p.question}</span>
                      {p.correct ? (
                        <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600" /> Passed
                        </span>
                      ) : (
                        <span className="text-red-700 text-xs font-semibold flex items-center gap-1">
                          <ExclamationCircleIcon className="w-4 h-4 text-red-600" /> Missed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
