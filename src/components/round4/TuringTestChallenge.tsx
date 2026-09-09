import { useState, useEffect, useRef } from 'react';
import { Button, TextInput, TextArea, Modal } from '../ui';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../lib/sound';
import { UsersIcon, CheckCircleIcon, ExclamationCircleIcon, ShieldIcon, HelpCircleIcon, ClockIcon } from '../icons';
import { sendAIRequest, byokSession, type AIProvider } from '../../lib/byok-service';

interface TuringProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  onAttemptCompleted: (result: any) => void;
  disabled?: boolean;
}

export default function TuringTestChallenge({
  challenge,
  teamId,
  roundSessionId,
  onAttemptCompleted,
  disabled = false
}: TuringProps) {
  const config = challenge.configuration || {};
  const maxQuestions = config.maxQuestions || 7;
  const persona = config.aiPersona || {};

  const [questionInput, setQuestionInput] = useState('');
  const [messages, setMessages] = useState<{
    id: string;
    question: string;
    response?: string;
    sequenceNum: number;
    timestamp: Date;
  }[]>([]);
  const [isWaitingReply, setIsWaitingReply] = useState(false);
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [selectedVerdict, setSelectedVerdict] = useState<'AI' | 'HUMAN' | null>(null);
  const [reasoningText, setReasoningText] = useState('');
  const [isSubmittingVerdict, setIsSubmittingVerdict] = useState(false);
  const [verdictResult, setVerdictResult] = useState<{
    isCorrect: boolean;
    actualIdentity: string;
    score: number;
    efficiencyBonus: number;
    questionsUsed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing interactions if any
  useEffect(() => {
    async function loadInteractions() {
      const { data } = await supabase
        .from('turing_test_interactions')
        .select('*')
        .eq('team_id', teamId)
        .eq('challenge_id', challenge.id)
        .order('sequence_number', { ascending: true });

      if (data && data.length > 0) {
        setMessages(data.map(d => ({
          id: d.id,
          question: d.question,
          response: d.response,
          sequenceNum: d.sequence_number,
          timestamp: new Date(d.created_at)
        })));
      }

      // Check if verdict already submitted
      const { data: vData } = await supabase
        .from('turing_verdicts')
        .select('*')
        .eq('team_id', teamId)
        .eq('challenge_id', challenge.id)
        .maybeSingle();

      if (vData) {
        setVerdictResult({
          isCorrect: vData.is_correct,
          actualIdentity: vData.actual_identity,
          score: vData.score,
          efficiencyBonus: 0,
          questionsUsed: vData.questions_used
        });
      }
    }
    loadInteractions();
  }, [teamId, challenge.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaitingReply]);

  const handleSendQuestion = async () => {
    if (!questionInput.trim() || isWaitingReply || disabled || messages.length >= maxQuestions) return;

    const currentQ = questionInput.trim();
    setQuestionInput('');
    setIsWaitingReply(true);
    sounds.click();

    const startTime = Date.now();

    try {
      let simulatedReply = '';

      // Generate response from AI persona if AI responder
      const activeProviders: AIProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ', 'MISTRAL', 'COHERE'];
      const activeKey = activeProviders.find(p => byokSession.hasKey(p));

      if (activeKey) {
        const aiRes = await sendAIRequest(activeKey, teamId, roundSessionId, challenge.id, {
          messages: [
            {
              role: 'system',
              content: persona.systemPrompt || "You are an anonymous participant in an evaluation interview. Respond naturally, casually, and authentically."
            },
            ...messages.flatMap(m => [
              { role: 'user' as const, content: m.question },
              ...(m.response ? [{ role: 'assistant' as const, content: m.response }] : [])
            ]),
            { role: 'user', content: currentQ }
          ],
          model: 'gpt-4o-mini',
          temperature: 0.8
        });
        simulatedReply = aiRes.content || 'I see what you mean, let me reflect on that.';
      } else {
        // Naturalistic persona response simulator
        const lower = currentQ.toLowerCase();
        if (lower.includes('feel') || lower.includes('emotion') || lower.includes('love')) {
          simulatedReply = "Honestly, it depends on the day. Late evening music always helps me relax and reflect. What about you?";
        } else if (lower.includes('calculate') || lower.includes('multiply') || lower.includes('math')) {
          simulatedReply = "Haha, give me a second! Around 4,200 roughly? Let me know if you need exact precision.";
        } else if (lower.includes('where') || lower.includes('live') || lower.includes('city')) {
          simulatedReply = "I'm located in Bangalore. The tech scene and coffee culture here are pretty energetic.";
        } else {
          simulatedReply = "That's a thoughtful question. In my perspective, it really depends on the surrounding context and individual priorities.";
        }
      }

      // Add human-like typing delay
      await new Promise(r => setTimeout(r, 1000));

      const latencyMs = Date.now() - startTime;

      const { data, error } = await (supabase.rpc as any)('submit_turing_question', {
        p_team_id: teamId,
        p_challenge_id: challenge.id,
        p_round_session_id: roundSessionId,
        p_question: currentQ,
        p_auto_reply: simulatedReply,
        p_latency_ms: latencyMs
      });

      if (error) throw error;

      setMessages(prev => [
        ...prev,
        {
          id: data?.interaction?.id || Math.random().toString(),
          question: currentQ,
          response: simulatedReply,
          sequenceNum: data?.questionNumber || (prev.length + 1),
          timestamp: new Date()
        }
      ]);

      sounds.click();

    } catch (err: any) {
      console.error('Turing question error:', err);
      sounds.error();
      setErrorMessage(err.message || 'Error submitting question');
    } finally {
      setIsWaitingReply(false);
    }
  };

  const handleFinalVerdict = async () => {
    if (!selectedVerdict || isSubmittingVerdict) return;

    setIsSubmittingVerdict(true);
    sounds.click();

    try {
      const { data, error } = await (supabase.rpc as any)('submit_turing_verdict', {
        p_team_id: teamId,
        p_challenge_id: challenge.id,
        p_round_session_id: roundSessionId,
        p_verdict: selectedVerdict,
        p_reasoning: reasoningText
      });

      if (error) throw error;

      if (data?.isCorrect) {
        sounds.victory();
      } else {
        sounds.error();
      }

      setVerdictResult(data);
      setShowVerdictModal(false);
      onAttemptCompleted(data);

    } catch (err: any) {
      console.error('Verdict submission error:', err);
      sounds.error();
      setErrorMessage(err.message || 'Failed to submit verdict');
    } finally {
      setIsSubmittingVerdict(false);
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
            <UsersIcon className="w-5 h-5 text-blue-600" />
            <span>Challenge 3: Turing Discrimination Assessment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
              {messages.length} of {maxQuestions} Questions Used
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
              Base Points: {challenge.base_points || 150}
            </span>
          </div>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{challenge.description}</p>
      </div>

      {/* Main Dialogue Chat Window */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
        {/* Chat Header Bar */}
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-gray-900">
                Anonymous Respondent
              </div>
              <div className="text-[11px] text-gray-500">Blind evaluation dialogue in progress</div>
            </div>
          </div>

          {!verdictResult && (
            <Button
              onClick={() => setShowVerdictModal(true)}
              disabled={messages.length === 0 || disabled}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-4 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <HelpCircleIcon className="w-4 h-4" />
              Submit Final Verdict
            </Button>
          )}
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-gray-50/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center space-y-2">
              <UsersIcon className="w-8 h-8 opacity-40 text-blue-500" />
              <span className="font-medium text-gray-600">Dialogue channel ready.</span>
              <span className="text-gray-400">Ask your first question below to begin analyzing the respondent's identity.</span>
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id} className="space-y-3">
                {/* Team Question */}
                <div className="flex justify-end">
                  <div className="max-w-xl bg-blue-600 text-white p-3.5 rounded-2xl rounded-tr-none shadow-sm space-y-1">
                    <div className="text-[10px] text-blue-100 font-semibold">
                      Your Question #{m.sequenceNum}
                    </div>
                    <div className="text-sm font-normal leading-relaxed">{m.question}</div>
                  </div>
                </div>

                {/* Respondent Reply */}
                {m.response && (
                  <div className="flex justify-start">
                    <div className="max-w-xl bg-white text-gray-800 p-3.5 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm space-y-1">
                      <div className="text-[10px] text-gray-500 font-semibold">
                        Anonymous Respondent
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.response}</div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {isWaitingReply && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-500 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 font-medium">Respondent is typing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Field */}
        {!verdictResult ? (
          <div className="p-4 bg-white border-t border-gray-200 flex items-center gap-3">
            <TextInput
              value={questionInput}
              onChange={setQuestionInput}
              onKeyDown={(e: any) => e.key === 'Enter' && handleSendQuestion()}
              placeholder={
                messages.length >= maxQuestions
                  ? 'Maximum question limit reached. Please submit your final verdict.'
                  : 'Ask a question to evaluate linguistic style, memory, or reasoning...'
              }
              className="flex-1 bg-gray-50 border-gray-200 focus:bg-white text-sm text-gray-900 rounded-xl"
              disabled={disabled || isWaitingReply || messages.length >= maxQuestions}
            />
            <Button
              onClick={handleSendQuestion}
              disabled={!questionInput.trim() || isWaitingReply || disabled || messages.length >= maxQuestions}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 text-xs"
            >
              Ask ({maxQuestions - messages.length} left)
            </Button>
          </div>
        ) : (
          <div className={`p-4 border-t text-xs font-medium flex items-center justify-between ${
            verdictResult.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="flex items-center gap-2">
              {verdictResult.isCorrect ? <CheckCircleIcon className="w-5 h-5 text-emerald-600" /> : <ExclamationCircleIcon className="w-5 h-5 text-red-600" />}
              <span>
                {verdictResult.isCorrect ? 'Verdict Correct!' : 'Verdict Incorrect.'} The respondent was {verdictResult.actualIdentity === 'AI' ? 'an AI model' : 'a human respondent'}.
              </span>
            </div>
            <div className="font-bold text-sm">
              Score: +{verdictResult.score} pts
            </div>
          </div>
        )}
      </div>

      {/* Final Verdict Modal */}
      {showVerdictModal && (
        <Modal
          title="Submit Identity Verdict"
          onClose={() => setShowVerdictModal(false)}
        >
          <div className="space-y-5 p-2">
            <p className="text-xs text-gray-600 leading-relaxed">
              Based on the {messages.length} question(s) asked, select whether you believe the respondent is an <strong>AI Language Model</strong> or a <strong>Human Coordinator</strong>.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedVerdict('AI')}
                className={`p-5 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-2 ${
                  selectedVerdict === 'AI'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-3xl">🤖</span>
                <span className="font-bold text-gray-900 text-sm">AI Model</span>
                <span className="text-[11px] text-gray-500 font-medium">Automated language model</span>
              </button>

              <button
                onClick={() => setSelectedVerdict('HUMAN')}
                className={`p-5 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-2 ${
                  selectedVerdict === 'HUMAN'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-3xl">👤</span>
                <span className="font-bold text-gray-900 text-sm">Human Respondent</span>
                <span className="text-[11px] text-gray-500 font-medium">Live human coordinator</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Reasoning (Optional):
              </label>
              <TextArea
                rows={3}
                value={reasoningText}
                onChange={setReasoningText}
                placeholder="Explain the linguistic, temporal, or logical indicators that influenced your decision..."
                className="w-full bg-gray-50 border-gray-200 focus:bg-white text-xs text-gray-900 rounded-xl resize-none p-3"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowVerdictModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleFinalVerdict}
                disabled={!selectedVerdict || isSubmittingVerdict}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 text-sm"
              >
                {isSubmittingVerdict ? 'Submitting...' : 'Confirm Final Verdict'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

