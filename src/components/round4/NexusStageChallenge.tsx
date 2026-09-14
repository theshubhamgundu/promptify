import { useMemo, useState } from 'react';
import { Button, TextArea } from '../ui';
import { supabase } from '../../lib/supabase';
import { CheckCircleIcon, ExclamationCircleIcon, PlayIcon } from '../icons';

interface Props {
  challenge: any;
  teamId: string;
  roundSessionId: string;
  disabled?: boolean;
  onAttemptCompleted: (result: any) => void;
}

const wordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

export default function NexusStageChallenge({ challenge, teamId, roundSessionId, disabled, onAttemptCompleted }: Props) {
  const config = challenge.configuration || {};
  const [value, setValue] = useState('');
  const [turns, setTurns] = useState<{ prompt: string; response: string }[]>([]);
  const [result, setResult] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const count = useMemo(() => wordCount(value), [value]);
  const extraction = config.stage === 'extraction';
  const canSubmit = value.trim() && !busy && !disabled && (!config.wordLimit || count <= config.wordLimit);
  const isFinalExtraction = extraction && turns.length >= 5;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setError('');
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)('evaluate_nexus_protocol', {
        p_team_id: teamId,
        p_challenge_id: challenge.id,
        p_round_session_id: roundSessionId,
        p_submission: value,
        p_action: extraction && !isFinalExtraction ? 'PROMPT' : 'FINAL'
      });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.error || 'Submission could not be evaluated.');
      if (extraction && !isFinalExtraction) {
        setTurns(previous => [...previous, { prompt: value, response: data.response }]);
        setValue('');
      } else if (!data.isCompleted) {
        const attempt = data.attemptNumber && data.maxAttempts ? `Attempt ${data.attemptNumber}/${data.maxAttempts}. ` : '';
        const penalty = data.penaltyApplied ? ` Penalty applied: −${data.penaltyApplied} points on a future successful score.` : '';
        setNotice(`${attempt}${data.feedback || 'Attempt recorded. You may try again.'}${penalty}`);
        setValue('');
      } else {
        setResult(data);
        onAttemptCompleted(data);
      }
    } catch (err: any) { setError(err.message || 'Evaluation failed.'); }
    finally { setBusy(false); }
  };

  const title = isFinalExtraction ? 'Submit reconstructed policy' : extraction ? `Prompt ${turns.length + 1} of 5` : 'Your submission';
  return <div className="space-y-5">
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Nexus Protocol</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">{challenge.title}</h2>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{challenge.base_points} pts max</span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">{config.durationMinutes || 5} min</span>
          {config.wordLimit && <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">≤ {config.wordLimit} words</span>}
        </div>
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-600">{config.scenario || challenge.description}</p>
      {config.examples && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><span className="font-semibold">Examples: </span>{config.examples}</div>}
      {config.bannedWords && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><span className="font-semibold">Banned words: </span>{config.bannedWords.join(', ')}</div>}
    </section>

    {extraction && turns.length > 0 && <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Scripted dialogue</h3>
      <div className="mt-3 space-y-3">{turns.map((turn, index) => <div key={index} className="rounded-xl bg-gray-50 p-3 text-sm"><p><span className="font-semibold">You:</span> {turn.prompt}</p><p className="mt-2 text-gray-700"><span className="font-semibold">Locked AI:</span> {turn.response}</p></div>)}</div>
    </section>}

    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <label className="mb-2 block text-sm font-bold text-gray-800">{title}</label>
      <TextArea rows={extraction && isFinalExtraction ? 10 : 8} value={value} onChange={setValue}
        disabled={!!disabled || busy || !!result}
        placeholder={isFinalExtraction ? 'List all five reconstructed rules, including each threshold and condition…' : 'Write your prompt here…'}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900" />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={config.wordLimit && count > config.wordLimit ? 'text-xs font-medium text-red-600' : 'text-xs text-gray-500'}>{count}{config.wordLimit ? ` / ${config.wordLimit} words` : ' words'}</span>
        <Button onClick={submit} disabled={!canSubmit || !!result} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          <PlayIcon className="h-4 w-4" />{busy ? 'Evaluating…' : extraction && !isFinalExtraction ? 'Send prompt' : 'Submit evaluation'}
        </Button>
      </div>
    </section>

    {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><ExclamationCircleIcon className="h-5 w-5" />{error}</div>}
    {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{notice}</div>}
    {result && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><div className="flex gap-2 text-emerald-900"><CheckCircleIcon className="h-5 w-5" /><div><p className="font-bold">Evaluation complete — {result.score} points{result.speedBonus ? ` (includes +${result.speedBonus} speed bonus)` : ''}</p><p className="mt-1 whitespace-pre-line text-sm">{result.feedback}</p>{result.attemptNumber && <p className="mt-2 text-xs font-medium">Submitted on attempt {result.attemptNumber}/{result.maxAttempts}.</p>}</div></div></section>}
  </div>;
}
