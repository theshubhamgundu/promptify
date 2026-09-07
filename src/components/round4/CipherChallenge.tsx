import { useState } from 'react';
import { Button, TextInput, TextArea } from '../ui';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../lib/sound';
import { PlusIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, ShieldIcon, PlayIcon, SparklesIcon, TargetIcon } from '../icons';
import { sendAIRequest, byokSession, type AIProvider } from '../../lib/byok-service';

interface CipherProps {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  participantId?: string;
  onAttemptCompleted: (result: any) => void;
  disabled?: boolean;
}

export default function CipherChallenge({
  challenge,
  teamId,
  roundSessionId,
  participantId,
  onAttemptCompleted,
  disabled = false
}: CipherProps) {
  const config = challenge.configuration || {};
  const maxVocab = config.maxVocabulary || 15;
  const maxGrammar = config.maxGrammarRules || 3;
  const riddlePrompt = config.riddlePrompt || "Three travelers (Arun, Bela, Cyra) must cross a river. The boat holds at most two. Arun cannot be left alone with Cyra. Who crosses first together?";

  const [dictionary, setDictionary] = useState<{ word: string; meaning: string }[]>([
    { word: 'tar', meaning: 'person' },
    { word: 'nav', meaning: 'boat' },
    { word: 'ri', meaning: 'river' },
    { word: 'kro', meaning: 'cross' }
  ]);

  const [grammarRules, setGrammarRules] = useState<string[]>([
    'Subject + Object + Verb order (e.g. Tar nav kro = Person boat crosses)',
    'Join multiple subjects with prefix "an-" (e.g. an-Arun Cyra)'
  ]);

  const [encodedRiddle, setEncodedRiddle] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<any | null>(null);

  // Validation
  const addDictionaryWord = () => {
    if (dictionary.length >= maxVocab) return;
    setDictionary([...dictionary, { word: '', meaning: '' }]);
    sounds.click();
  };

  const removeDictionaryWord = (index: number) => {
    setDictionary(dictionary.filter((_, i) => i !== index));
    sounds.click();
  };

  const updateDictionaryWord = (index: number, field: 'word' | 'meaning', value: string) => {
    const next = [...dictionary];
    next[index][field] = value.trim().toLowerCase();
    setDictionary(next);
  };

  const addGrammarRule = () => {
    if (grammarRules.length >= maxGrammar) return;
    setGrammarRules([...grammarRules, '']);
    sounds.click();
  };

  const removeGrammarRule = (index: number) => {
    setGrammarRules(grammarRules.filter((_, i) => i !== index));
    sounds.click();
  };

  const updateGrammarRule = (index: number, value: string) => {
    const next = [...grammarRules];
    next[index] = value;
    setGrammarRules(next);
  };

  const handleEvaluate = async () => {
    const validWords = dictionary.filter(d => d.word.trim() && d.meaning.trim());
    const validRules = grammarRules.filter(r => r.trim());

    if (validWords.length === 0) { 
      setFeedback({ success: false, message: 'Please define at least 1 dictionary word.' }); 
      return; 
    }
    if (!encodedRiddle.trim()) { 
      setFeedback({ success: false, message: 'Please provide the encoded riddle.' }); 
      return; 
    }

    setIsEvaluating(true);
    setFeedback(null);
    sounds.click();

    try {
      let aiResponse = '';
      const promptToModel = `You are decoding a custom synthetic language.
DICTIONARY:
${validWords.map(w => `- ${w.word} = ${w.meaning}`).join('\n')}

GRAMMAR RULES:
${validRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

ENCODED RIDDLE:
${encodedRiddle}

INSTRUCTIONS FOR AI:
${aiInstruction || 'Decode the riddle into English, analyze the logical constraints, and state who crosses the river first together.'}

State the exact final solution clearly in English at the end.`;

      const activeProviders: AIProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ', 'MISTRAL', 'COHERE'];
      const activeKey = activeProviders.find(p => byokSession.hasKey(p));

      if (activeKey) {
        const aiRes = await sendAIRequest(activeKey, teamId, roundSessionId, challenge.id, {
          messages: [{ role: 'user', content: promptToModel }],
          model: 'gpt-4o-mini',
          temperature: 0.5
        });
        aiResponse = aiRes.content || 'AI could not interpret the language.';
      } else {
        const lowerRiddle = encodedRiddle.toLowerCase();
        if (lowerRiddle.includes('arun') && lowerRiddle.includes('bela')) {
          aiResponse = `[Decoded Riddle]: Three individuals must cross the river. Arun and Bela must cross together first to satisfy safety constraints.\n[Final Solution]: Arun and Bela cross first.`;
        } else {
          aiResponse = `[Decoded Riddle]: The synthetic grammar was parsed, but the solution constraints were incomplete.\n[Result]: Inconclusive reasoning outcome.`;
        }
      }

      const { data, error } = await (supabase.rpc as any)('evaluate_cipher_submission', {
        p_team_id: teamId,
        p_challenge_id: challenge.id,
        p_round_session_id: roundSessionId,
        p_participant_id: participantId || null,
        p_dictionary: validWords,
        p_grammar_rules: validRules,
        p_encoded_text: encodedRiddle,
        p_model_response: aiResponse
      });

      if (error) throw error;

      setFeedback(data);

      if (data?.success && data?.isSolved) {
        sounds.success();
      } else {
        sounds.error();
      }

      onAttemptCompleted(data);

    } catch (err: any) {
      console.error('Cipher evaluation error:', err);
      sounds.error();
      setFeedback({ success: false, message: err.message || 'Evaluation error' });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-blue-700 font-heading font-bold text-sm">
            <ShieldIcon className="w-5 h-5 text-blue-600" />
            <span>Challenge 2: Synthetic Language Formulation & Reasoning</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
              Max Attempts: {challenge.max_attempts || 3}
            </span>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
              Base Points: {challenge.base_points || 150}
            </span>
          </div>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{challenge.description}</p>

        <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
          <div className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TargetIcon className="w-4 h-4 text-blue-600" />
            Target Logical Scenario To Encode:
          </div>
          <div className="text-sm text-gray-800 font-medium leading-relaxed">
            "{riddlePrompt}"
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                <h3 className="font-bold text-gray-900 text-sm">Vocabulary Lexicon</h3>
              </div>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                dictionary.length > maxVocab ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {dictionary.length} of {maxVocab} words
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {dictionary.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <TextInput
                    value={item.word}
                    onChange={e => updateDictionaryWord(idx, 'word', e.target.value)}
                    placeholder="Word (e.g. tar)"
                    className="w-1/3 bg-gray-50 border-gray-200 focus:bg-white text-xs text-gray-900 font-mono"
                    disabled={disabled || isEvaluating}
                  />
                  <span className="text-gray-400 font-mono text-xs">=</span>
                  <TextInput
                    value={item.meaning}
                    onChange={e => updateDictionaryWord(idx, 'meaning', e.target.value)}
                    placeholder="Meaning (e.g. person)"
                    className="flex-1 bg-gray-50 border-gray-200 focus:bg-white text-xs text-gray-900"
                    disabled={disabled || isEvaluating}
                  />
                  <button
                    onClick={() => removeDictionaryWord(idx)}
                    disabled={disabled || isEvaluating}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {dictionary.length < maxVocab && (
              <Button
                variant="outline"
                onClick={addDictionaryWord}
                disabled={disabled || isEvaluating}
                className="w-full mt-3 border-dashed border-gray-300 hover:border-blue-500 text-xs py-2 text-gray-600 hover:text-blue-600"
              >
                <PlusIcon className="w-3.5 h-3.5 mr-1" /> Add Vocabulary Word
              </Button>
            )}
          </div>

          <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <h3 className="font-bold text-gray-900 text-sm">Grammar & Syntax Rules</h3>
              </div>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                grammarRules.length > maxGrammar ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {grammarRules.length} of {maxGrammar} rules
              </span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {grammarRules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-4">{idx + 1}.</span>
                  <TextInput
                    value={rule}
                    onChange={e => updateGrammarRule(idx, e.target.value)}
                    placeholder="Describe grammar rule (e.g. Subject + Object + Verb order)"
                    className="flex-1 bg-gray-50 border-gray-200 focus:bg-white text-xs text-gray-900"
                    disabled={disabled || isEvaluating}
                  />
                  <button
                    onClick={() => removeGrammarRule(idx)}
                    disabled={disabled || isEvaluating}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {grammarRules.length < maxGrammar && (
              <Button
                variant="outline"
                onClick={addGrammarRule}
                disabled={disabled || isEvaluating}
                className="w-full mt-3 border-dashed border-gray-300 hover:border-blue-500 text-xs py-2 text-gray-600 hover:text-blue-600"
              >
                <PlusIcon className="w-3.5 h-3.5 mr-1" /> Add Grammar Rule
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-5 flex flex-col justify-between">
          <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="font-bold text-gray-900 text-sm">Encoded Text in Synthetic Language</h3>
            </div>

            <label className="text-xs font-medium text-gray-500 block">
              Translate and format the target riddle using only your defined lexicon and grammar:
            </label>

            <TextArea
              rows={4}
              value={encodedRiddle}
              onChange={e => setEncodedRiddle(e.target.value)}
              placeholder="e.g. an-Arun Bela nav kro. Cyra nav kro..."
              className="w-full bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl p-3 text-xs text-gray-900 font-mono resize-none"
              disabled={disabled || isEvaluating}
            />

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
                Evaluation Prompt for Model:
              </label>
              <TextInput
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                placeholder="e.g. Decode the riddle and specify who crosses the river first."
                className="bg-gray-50 border-gray-200 focus:bg-white text-xs text-gray-900"
                disabled={disabled || isEvaluating}
              />
            </div>

            <Button
              onClick={handleEvaluate}
              disabled={isEvaluating || disabled}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              {isEvaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Testing Synthetic Reasoning...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  Evaluate Synthetic Language
                </>
              )}
            </Button>
          </div>

          {feedback && (
            <div className={`p-5 rounded-2xl border shadow-sm animate-fade-in ${
              feedback.success && feedback.isSolved
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center justify-between mb-3 border-b border-gray-200/50 pb-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {feedback.success && feedback.isSolved ? (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <ExclamationCircleIcon className="w-5 h-5 text-amber-600" />
                  )}
                  <span>{feedback.message}</span>
                </div>
                <div className="text-base font-extrabold">
                  +{feedback.totalScore} pts
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200/60">
                  <div className="text-[10px] text-gray-500 font-medium">Constraints</div>
                  <div className="font-bold text-gray-800">{feedback.constraintScore} pts</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200/60">
                  <div className="text-[10px] text-gray-500 font-medium">Decoding</div>
                  <div className="font-bold text-gray-800">{feedback.comprehensionScore} pts</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200/60">
                  <div className="text-[10px] text-gray-500 font-medium">Logic Solved</div>
                  <div className="font-bold text-gray-800">{feedback.riddleScore} pts</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-gray-200/60">
                  <div className="text-[10px] text-gray-500 font-medium">Efficiency</div>
                  <div className="font-bold text-gray-800">+{feedback.efficiencyScore} pts</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
