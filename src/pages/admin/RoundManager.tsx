import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, Select, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { TargetIcon, ClockIcon, GripVerticalIcon, PlusIcon, PencilIcon, TrashIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';

interface Challenge {
  id: string;
  round_id: string;
  order_index: number;
  title: string;
  description: string;
  type: string;
  base_points: number;
  max_attempts: number | null;
  configuration: any;
}

interface Round {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  type: string;
  order_index: number;
  duration_minutes: number | null;
  scoring_config: any;
  is_active: boolean;
  status: string;
  challenges?: Challenge[];
}

const emptyRound = { name: '', description: '', type: 'QUIZ', duration_minutes: '', order_index: '1' };

interface ChallengeFormState {
  // Identity
  title: string;
  description: string;
  instructions: string;
  type: string;
  difficulty: string;
  // Timing & Attempts
  duration_seconds: string;
  base_points: string;
  max_attempts: string;
  // Scoring
  negative_marking: boolean;
  negative_mark_value: string;
  speed_bonus: boolean;
  speed_bonus_max: string;
  hint_penalty: string;
  partial_credit: boolean;
  max_score: string;
  // Evaluation
  evaluation_type: string;
  pass_threshold: string;
  // AI / BYOK
  byok_required: boolean;
  allowed_providers: string[];
  evaluation_model: string;
  ai_temperature: string;
  // Hints
  hint_1: string;
  hint_2: string;
  hint_3: string;
  hint_penalty_per: string;
  // Multiple Choice Options
  options: { id: string; label: string; text: string; is_correct: boolean }[];
}

const emptyChallengeForm: ChallengeFormState = {
  title: '', description: '', instructions: '', type: 'MULTIPLE_CHOICE',
  difficulty: 'MEDIUM', duration_seconds: '600', base_points: '100', max_attempts: '1',
  negative_marking: false, negative_mark_value: '0', speed_bonus: false,
  speed_bonus_max: '0', hint_penalty: '0', partial_credit: false, max_score: '100',
  evaluation_type: 'DETERMINISTIC', pass_threshold: '60',
  byok_required: false, allowed_providers: [], evaluation_model: '',
  ai_temperature: '0.7',
  hint_1: '', hint_2: '', hint_3: '', hint_penalty_per: '5',
  options: [
    { id: 'opt_1', label: 'A', text: '', is_correct: true },
    { id: 'opt_2', label: 'B', text: '', is_correct: false },
    { id: 'opt_3', label: 'C', text: '', is_correct: false },
    { id: 'opt_4', label: 'D', text: '', is_correct: false },
  ],
};

const PROVIDERS = ['openai', 'anthropic', 'gemini', 'mistral', 'cohere', 'groq'];

function validateChallengeForm(form: ChallengeFormState): string[] {
  const errors: string[] = [];
  if (!form.title.trim()) errors.push('Title is required');
  if (!form.description.trim()) errors.push('Description is required');
  if (!form.instructions.trim()) errors.push('Instructions are required');
  if (!form.base_points || parseInt(form.base_points) <= 0) errors.push('Base points must be > 0');
  if (form.byok_required && form.allowed_providers.length === 0) errors.push('Select at least one AI provider when BYOK is required');
  if (form.evaluation_type === 'LLM' && !form.byok_required) errors.push('LLM evaluation requires BYOK to be enabled');
  return errors;
}

function buildConfiguration(form: ChallengeFormState): Record<string, any> {
  return {
    instructions: form.instructions,
    difficulty: form.difficulty,
    duration_seconds: parseInt(form.duration_seconds) || 600,
    scoring: {
      base_points: parseInt(form.base_points) || 0,
      max_score: parseInt(form.max_score) || parseInt(form.base_points) || 100,
      negative_marking: form.negative_marking,
      negative_mark_value: parseFloat(form.negative_mark_value) || 0,
      speed_bonus: form.speed_bonus,
      speed_bonus_max: parseInt(form.speed_bonus_max) || 0,
      hint_penalty: parseFloat(form.hint_penalty) || 0,
      partial_credit: form.partial_credit,
    },
    evaluation: {
      type: form.evaluation_type,
      pass_threshold: parseInt(form.pass_threshold) || 60,
    },
    ai: {
      byok_required: form.byok_required,
      allowed_providers: form.allowed_providers,
      evaluation_model: form.evaluation_model,
      temperature: parseFloat(form.ai_temperature) || 0.7,
    },
    // BYOK config at top level - used by participant-facing pages (PromptHeistRound, BossRound, etc.)
    byok: form.byok_required ? {
      enabled: true,
      required_providers: form.allowed_providers.map(p => p.toUpperCase()),
      allowed_models: form.evaluation_model ? [form.evaluation_model] : ['gpt-3.5-turbo'],
      max_requests: 50,
      max_tokens_per_request: 1000,
      max_total_tokens: 50000,
      allowed_tools: false,
      allowed_web_access: false,
      timeout_seconds: 30,
    } : undefined,
    hints: [form.hint_1, form.hint_2, form.hint_3].filter(h => h.trim()),
    hint_penalty_per: parseFloat(form.hint_penalty_per) || 5,
    options: form.type === 'MULTIPLE_CHOICE' ? form.options : undefined,
  };
}

function formFromConfiguration(chal: Challenge): ChallengeFormState {
  const cfg = chal.configuration || {};
  const scoring = cfg.scoring || {};
  const evaluation = cfg.evaluation || {};
  const ai = cfg.ai || {};
  const hints = cfg.hints || [];
  return {
    title: chal.title, description: chal.description,
    instructions: cfg.instructions || '', type: chal.type,
    difficulty: cfg.difficulty || 'MEDIUM',
    duration_seconds: (cfg.duration_seconds || 600).toString(),
    base_points: chal.base_points.toString(),
    max_attempts: chal.max_attempts?.toString() || '',
    negative_marking: scoring.negative_marking || false,
    negative_mark_value: (scoring.negative_mark_value || 0).toString(),
    speed_bonus: scoring.speed_bonus || false,
    speed_bonus_max: (scoring.speed_bonus_max || 0).toString(),
    hint_penalty: (scoring.hint_penalty || 0).toString(),
    partial_credit: scoring.partial_credit || false,
    max_score: (scoring.max_score || chal.base_points || 100).toString(),
    evaluation_type: evaluation.type || 'DETERMINISTIC',
    pass_threshold: (evaluation.pass_threshold || 60).toString(),
    byok_required: ai.byok_required || false,
    allowed_providers: ai.allowed_providers || [],
    evaluation_model: ai.evaluation_model || '',
    ai_temperature: (ai.temperature || 0.7).toString(),
    hint_1: hints[0] || '', hint_2: hints[1] || '', hint_3: hints[2] || '',
    hint_penalty_per: (cfg.hint_penalty_per || 5).toString(),
    options: cfg.options || emptyChallengeForm.options,
  };
}

export default function RoundManager({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRoundModal, setShowRoundModal] = useState(false);
  const [editRound, setEditRound] = useState<Round | null>(null);
  const [roundForm, setRoundForm] = useState(emptyRound);
  
  const [showChallengeModal, setShowChallengeModal] = useState<{ roundId: string, challenge?: Challenge } | null>(null);
  const [challengeForm, setChallengeForm] = useState<ChallengeFormState>(emptyChallengeForm);
  const [challengeTab, setChallengeTab] = useState<'identity' | 'scoring' | 'evaluation' | 'hints'>('identity');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'ROUND' | 'CHALLENGE', id: string, name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const loadRounds = async () => {
    if (!activeEvent) return;
    setLoading(true);
    const { data: roundsData } = await supabase.from('rounds').select('*').eq('event_id', activeEvent.id).order('order_index');
    if (roundsData) {
      const { data: challengesData } = await supabase.from('challenges').select('*').in('round_id', roundsData.map(r => r.id)).order('order_index');
      setRounds(roundsData.map(r => ({ ...r, challenges: (challengesData || []).filter(c => c.round_id === r.id) })));
    }
    setLoading(false);
  };

  useEffect(() => { loadRounds(); }, [activeEvent]);

  const handleSaveRound = async () => {
    if (!activeEvent || !roundForm.name) return;
    setSaving(true);
    const payload = {
      event_id: activeEvent.id, name: roundForm.name, description: roundForm.description || null,
      type: roundForm.type, duration_minutes: roundForm.duration_minutes ? parseInt(roundForm.duration_minutes) : null,
      order_index: parseInt(roundForm.order_index) || rounds.length + 1, status: 'DRAFT'
    };
    if (editRound) {
      const { error } = await supabase.from('rounds').update(payload).eq('id', editRound.id);
      if (!error) await loadRounds();
    } else {
      const { error } = await supabase.from('rounds').insert(payload);
      if (!error) await loadRounds();
    }
    setSaving(false); setShowRoundModal(false); setEditRound(null);
  };

  const handleDeleteRound = async () => {
    if (!deleteTarget || deleteTarget.type !== 'ROUND') return;
    await supabase.from('rounds').delete().eq('id', deleteTarget.id);
    await loadRounds(); setDeleteTarget(null);
  };

  const toggleRoundStatus = async (round: Round) => {
    const newStatus = round.status === 'LIVE' ? 'DRAFT' : 'LIVE';
    const { error } = await supabase.rpc('admin_toggle_round_status', {
      p_round_id: round.id,
      p_new_status: newStatus,
      p_reason: `Admin toggled round status to ${newStatus}`
    });
    if (error) {
      console.error('Failed to toggle round status:', error);
      await supabase.from('rounds').update({ status: newStatus }).eq('id', round.id);
    }
    await loadRounds();
  };

  const handleSaveChallenge = async () => {
    if (!showChallengeModal || !challengeForm.title) return;
    const errors = validateChallengeForm(challengeForm);
    if (errors.length > 0) { setValidationErrors(errors); return; }
    setSaving(true); setValidationErrors([]);
    const roundId = showChallengeModal.roundId;
    const round = rounds.find(r => r.id === roundId);
    const configuration = buildConfiguration(challengeForm);
    const payload = {
      round_id: roundId, title: challengeForm.title, description: challengeForm.description,
      type: challengeForm.type, base_points: parseInt(challengeForm.base_points) || 0,
      max_attempts: challengeForm.max_attempts ? parseInt(challengeForm.max_attempts) : null,
      order_index: showChallengeModal.challenge ? showChallengeModal.challenge.order_index : (round?.challenges?.length || 0) + 1,
      configuration,
    };
    if (showChallengeModal.challenge) {
      const { error } = await supabase.from('challenges').update(payload).eq('id', showChallengeModal.challenge.id);
      if (!error) {
        const { data: vData } = await supabase.from('challenge_versions').select('version_number').eq('challenge_id', showChallengeModal.challenge.id).order('version_number', { ascending: false }).limit(1);
        const nextV = (vData && vData.length > 0) ? vData[0].version_number + 1 : 2;
        await supabase.from('challenge_versions').insert({
          challenge_id: showChallengeModal.challenge.id, version_number: nextV,
          title: payload.title, description: payload.description, type: payload.type,
          base_points: payload.base_points, max_attempts: payload.max_attempts, configuration,
        });
        await loadRounds();
      }
    } else {
      const { data: newChal, error } = await supabase.from('challenges').insert(payload).select().single();
      if (!error && newChal) {
        await supabase.from('challenge_versions').insert({
          challenge_id: newChal.id, version_number: 1, title: payload.title,
          description: payload.description, type: payload.type, base_points: payload.base_points,
          max_attempts: payload.max_attempts, configuration,
        });
        await loadRounds();
      }
    }
    setSaving(false); setShowChallengeModal(null);
  };

  const handleDeleteChallenge = async () => {
    if (!deleteTarget || deleteTarget.type !== 'CHALLENGE') return;
    await supabase.from('challenges').delete().eq('id', deleteTarget.id);
    await loadRounds(); setDeleteTarget(null);
  };

  const roundIcons: Record<string, string> = { QUIZ: '🧠', PROMPT: '🎯', ESCAPE_ROOM: '🧩', BATTLE: '⚔️', GRANDMASTER: '👑' };

  const hasValidConfig = (chal: Challenge) => {
    const cfg = chal.configuration || {};
    return !!(cfg.instructions && cfg.scoring && cfg.evaluation);
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Round Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Configure rounds, challenges, and timing for {activeEvent.name}</p>
        </div>
        <Button onClick={() => { setRoundForm(emptyRound); setShowRoundModal(true); }}>+ Add Round</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading rounds...</div>
      ) : rounds.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm text-gray-500 font-semibold">No rounds configured</div>
          <Button className="mt-4" onClick={() => { setRoundForm(emptyRound); setShowRoundModal(true); }}>Create First Round</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => {
            const isExpanded = expandedRound === round.id;
            return (
              <div key={round.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all">
                <div className="p-5 flex items-center gap-5 hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">
                    {roundIcons[round.type] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedRound(isExpanded ? null : round.id)}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 text-[11px] font-black text-gray-700">{round.order_index}</span>
                      <h3 className="text-base font-black text-gray-900 font-heading">{round.name}</h3>
                      <span className={`text-[10px] font-black font-heading px-2 py-0.5 rounded-full ${round.status === 'LIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{round.status}</span>
                    </div>
                    {round.description && <p className="text-xs text-gray-500 mt-1 truncate">{round.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-[11px] font-bold text-gray-400 font-heading tracking-wide">
                      <span>TYPE: {round.type}</span>
                      <span>DURATION: {round.duration_minutes || '—'} MIN</span>
                      <span className="text-orange-500">{round.challenges?.length || 0} CHALLENGES</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleRoundStatus(round)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${round.status === 'LIVE' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {round.status === 'LIVE' ? 'Make Draft' : 'Make Live'}
                    </button>
                    <button onClick={() => { setEditRound(round); setRoundForm({ name: round.name, description: round.description || '', type: round.type, duration_minutes: round.duration_minutes?.toString() || '', order_index: round.order_index.toString() }); setShowRoundModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget({ type: 'ROUND', id: round.id, name: round.name })} className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExpandedRound(isExpanded ? null : round.id)} className="w-8 h-8 flex items-center justify-center text-gray-400">
                      <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-black text-gray-500 font-heading uppercase tracking-widest">Challenges</h4>
                      <Button variant="outline" className="text-xs py-1.5 px-3 h-auto" onClick={() => {
                        setChallengeForm(emptyChallengeForm); setChallengeTab('identity'); setValidationErrors([]);
                        setShowChallengeModal({ roundId: round.id });
                      }}>
                        <PlusIcon className="w-3.5 h-3.5" /> Add Challenge
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(!round.challenges || round.challenges.length === 0) ? (
                        <div className="text-center py-6 text-xs text-gray-400 italic">No challenges added yet.</div>
                      ) : (
                        round.challenges.map((chal) => (
                          <div key={chal.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm group">
                            <div className="cursor-move text-gray-300 hover:text-gray-500 p-1"><GripVerticalIcon className="w-4 h-4" /></div>
                            <div className="w-6 h-6 rounded bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black">{chal.order_index}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 truncate">{chal.title}</span>
                                {hasValidConfig(chal) ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-green-100 text-green-700">CONFIGURED</span>
                                ) : (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-100 text-red-600">INCOMPLETE</span>
                                )}
                              </div>
                              <div className="flex gap-3 text-[10px] text-gray-400 font-mono mt-0.5">
                                <span>{chal.type}</span>
                                <span>{chal.base_points} PTS</span>
                                <span>{chal.max_attempts ? `${chal.max_attempts} ATTEMPTS` : 'UNLIMITED'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => {
                                setChallengeForm(formFromConfiguration(chal)); setChallengeTab('identity'); setValidationErrors([]);
                                setShowChallengeModal({ roundId: round.id, challenge: chal });
                              }} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-500">
                                <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget({ type: 'CHALLENGE', id: chal.id, name: chal.title })} className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 text-red-500">
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Round Modal */}
      {showRoundModal && (
        <Modal title={editRound ? 'Edit Round' : 'Create Round'} onClose={() => { setShowRoundModal(false); setEditRound(null); }} size="md" footer={
          <>
            <Button variant="outline" onClick={() => { setShowRoundModal(false); setEditRound(null); }}>Cancel</Button>
            <Button onClick={handleSaveRound} disabled={saving || !roundForm.name}>Save</Button>
          </>
        }>
          <div className="space-y-4">
            <FormField label="Round Name" required>
              <TextInput value={roundForm.name} onChange={v => setRoundForm({ ...roundForm, name: v })} placeholder="e.g. Prompt Engineering" />
            </FormField>
            <FormField label="Description">
              <TextArea value={roundForm.description} onChange={v => setRoundForm({ ...roundForm, description: v })} rows={2} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type" required>
                <Select value={roundForm.type} onChange={v => setRoundForm({ ...roundForm, type: v })} options={[
                  { value: 'QUIZ', label: 'Quiz' }, { value: 'PROMPT', label: 'Prompt Challenge' },
                  { value: 'ESCAPE_ROOM', label: 'AI Escape Room' }, { value: 'BATTLE', label: 'AI Battle' },
                  { value: 'GRANDMASTER', label: 'Grandmaster' }
                ]} />
              </FormField>
              <FormField label="Duration (Minutes)">
                <TextInput type="number" value={roundForm.duration_minutes} onChange={v => setRoundForm({ ...roundForm, duration_minutes: v })} placeholder="Unlimited" />
              </FormField>
            </div>
            <FormField label="Order Index">
              <TextInput type="number" value={roundForm.order_index} onChange={v => setRoundForm({ ...roundForm, order_index: v })} />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ============================================= */}
      {/* CHALLENGE BUILDER — Full Configuration Modal  */}
      {/* ============================================= */}
      {showChallengeModal && (
        <Modal title={showChallengeModal.challenge ? 'Edit Challenge' : 'Add Challenge'} onClose={() => setShowChallengeModal(null)} size="lg" footer={
          <>
            <Button variant="outline" onClick={() => setShowChallengeModal(null)}>Cancel</Button>
            <Button onClick={handleSaveChallenge} disabled={saving || !challengeForm.title}>
              {saving ? 'Saving...' : 'Save Challenge'}
            </Button>
          </>
        }>
          {validationErrors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-bold text-red-700 mb-1">Cannot publish — fix the following:</p>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4 -mt-2">
            {(['identity', 'scoring', 'evaluation', 'hints'] as const).map(tab => (
              <button key={tab} onClick={() => setChallengeTab(tab)}
                className={`px-4 py-2.5 text-xs font-bold capitalize transition-all border-b-2 ${
                  challengeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}>{tab}</button>
            ))}
          </div>

          {/* Identity Tab */}
          {challengeTab === 'identity' && (
            <div className="space-y-4">
              <FormField label="Challenge Title" required>
                <TextInput value={challengeForm.title} onChange={v => setChallengeForm({ ...challengeForm, title: v })} />
              </FormField>
              <FormField label="Description" required>
                <TextArea value={challengeForm.description} onChange={v => setChallengeForm({ ...challengeForm, description: v })} rows={2} />
              </FormField>
              <FormField label="Instructions" required>
                <TextArea value={challengeForm.instructions} onChange={v => setChallengeForm({ ...challengeForm, instructions: v })} rows={3} placeholder="Detailed instructions shown to participants..." />
              </FormField>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Type" required>
                  <Select value={challengeForm.type} onChange={v => setChallengeForm({ ...challengeForm, type: v })} options={[
                    { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' }, { value: 'TEXT_INPUT', label: 'Text Input' },
                    { value: 'AI_PROMPT', label: 'AI Prompt' }, { value: 'CODE_INPUT', label: 'Code Input' },
                    { value: 'FILE_UPLOAD', label: 'File Upload' },
                  ]} />
                </FormField>
                <FormField label="Difficulty">
                  <Select value={challengeForm.difficulty} onChange={v => setChallengeForm({ ...challengeForm, difficulty: v })} options={[
                    { value: 'EASY', label: 'Easy' }, { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HARD', label: 'Hard' }, { value: 'EXPERT', label: 'Expert' },
                  ]} />
                </FormField>
                <FormField label="Duration (Seconds)">
                  <TextInput type="number" value={challengeForm.duration_seconds} onChange={v => setChallengeForm({ ...challengeForm, duration_seconds: v })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Base Points" required>
                  <TextInput type="number" value={challengeForm.base_points} onChange={v => setChallengeForm({ ...challengeForm, base_points: v })} />
                </FormField>
                <FormField label="Max Attempts">
                  <TextInput type="number" value={challengeForm.max_attempts} onChange={v => setChallengeForm({ ...challengeForm, max_attempts: v })} placeholder="Unlimited" />
                </FormField>
              </div>
              
              {challengeForm.type === 'MULTIPLE_CHOICE' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Options</h4>
                    <Button variant="outline" className="text-[10px] py-1 px-2 h-auto" onClick={() => {
                      setChallengeForm({
                        ...challengeForm,
                        options: [...challengeForm.options, { id: `opt_${Date.now()}`, label: String.fromCharCode(65 + challengeForm.options.length), text: '', is_correct: false }]
                      });
                    }}>+ Add Option</Button>
                  </div>
                  <div className="space-y-2">
                    {challengeForm.options.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2 items-start">
                        <label className="flex-shrink-0 mt-2">
                          <input type="checkbox" checked={opt.is_correct} className="w-4 h-4 text-green-600 rounded cursor-pointer"
                            onChange={e => {
                              const newOpts = [...challengeForm.options];
                              newOpts[i].is_correct = e.target.checked;
                              setChallengeForm({ ...challengeForm, options: newOpts });
                            }}
                          />
                        </label>
                        <div className="w-10">
                          <TextInput value={opt.label} onChange={v => {
                            const newOpts = [...challengeForm.options];
                            newOpts[i].label = v;
                            setChallengeForm({ ...challengeForm, options: newOpts });
                          }} placeholder="A" />
                        </div>
                        <div className="flex-1">
                          <TextInput value={opt.text} onChange={v => {
                            const newOpts = [...challengeForm.options];
                            newOpts[i].text = v;
                            setChallengeForm({ ...challengeForm, options: newOpts });
                          }} placeholder="Option text..." />
                        </div>
                        <button onClick={() => {
                          setChallengeForm({
                            ...challengeForm,
                            options: challengeForm.options.filter((_, idx) => idx !== i)
                          });
                        }} className="p-2 text-gray-400 hover:text-red-500 rounded"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scoring Tab */}
          {challengeTab === 'scoring' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Max Score">
                  <TextInput type="number" value={challengeForm.max_score} onChange={v => setChallengeForm({ ...challengeForm, max_score: v })} />
                </FormField>
                <FormField label="Hint Penalty (per hint)">
                  <TextInput type="number" value={challengeForm.hint_penalty} onChange={v => setChallengeForm({ ...challengeForm, hint_penalty: v })} />
                </FormField>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input type="checkbox" checked={challengeForm.negative_marking} onChange={e => setChallengeForm({ ...challengeForm, negative_marking: e.target.checked })} className="rounded" />
                  <div><span className="text-sm font-bold text-gray-900">Negative Marking</span><p className="text-xs text-gray-500">Deduct points for incorrect answers</p></div>
                </label>
                {challengeForm.negative_marking && (
                  <FormField label="Negative Mark Value">
                    <TextInput type="number" value={challengeForm.negative_mark_value} onChange={v => setChallengeForm({ ...challengeForm, negative_mark_value: v })} />
                  </FormField>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input type="checkbox" checked={challengeForm.speed_bonus} onChange={e => setChallengeForm({ ...challengeForm, speed_bonus: e.target.checked })} className="rounded" />
                  <div><span className="text-sm font-bold text-gray-900">Speed Bonus</span><p className="text-xs text-gray-500">Bonus points for faster completion</p></div>
                </label>
                {challengeForm.speed_bonus && (
                  <FormField label="Maximum Speed Bonus">
                    <TextInput type="number" value={challengeForm.speed_bonus_max} onChange={v => setChallengeForm({ ...challengeForm, speed_bonus_max: v })} />
                  </FormField>
                )}
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input type="checkbox" checked={challengeForm.partial_credit} onChange={e => setChallengeForm({ ...challengeForm, partial_credit: e.target.checked })} className="rounded" />
                  <div><span className="text-sm font-bold text-gray-900">Partial Credit</span><p className="text-xs text-gray-500">Award points proportionally for partially correct answers</p></div>
                </label>
              </div>
            </div>
          )}

          {/* Evaluation Tab */}
          {challengeTab === 'evaluation' && (
            <div className="space-y-4">
              <FormField label="Evaluation Type" required>
                <Select value={challengeForm.evaluation_type} onChange={v => setChallengeForm({ ...challengeForm, evaluation_type: v })} options={[
                  { value: 'DETERMINISTIC', label: 'Deterministic (auto-graded)' },
                  { value: 'LLM', label: 'LLM Evaluation (AI-graded)' },
                  { value: 'HYBRID', label: 'Hybrid (deterministic + LLM)' },
                  { value: 'MANUAL', label: 'Manual (admin-graded)' },
                ]} />
              </FormField>
              <FormField label="Pass Threshold (%)">
                <TextInput type="number" value={challengeForm.pass_threshold} onChange={v => setChallengeForm({ ...challengeForm, pass_threshold: v })} />
              </FormField>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-xs font-black text-gray-500 mb-3 uppercase tracking-widest">AI / BYOK Settings</h4>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition mb-3">
                  <input type="checkbox" checked={challengeForm.byok_required} onChange={e => setChallengeForm({ ...challengeForm, byok_required: e.target.checked })} className="rounded" />
                  <div><span className="text-sm font-bold text-gray-900">BYOK Required</span><p className="text-xs text-gray-500">Participants must provide their own API key</p></div>
                </label>
                {challengeForm.byok_required && (
                  <>
                    <FormField label="Allowed Providers">
                      <div className="flex flex-wrap gap-2">
                        {PROVIDERS.map(p => (
                          <label key={p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                            challengeForm.allowed_providers.includes(p) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                            <input type="checkbox" checked={challengeForm.allowed_providers.includes(p)}
                              onChange={e => {
                                const np = e.target.checked ? [...challengeForm.allowed_providers, p] : challengeForm.allowed_providers.filter(x => x !== p);
                                setChallengeForm({ ...challengeForm, allowed_providers: np });
                              }} className="sr-only" />
                            {p}
                          </label>
                        ))}
                      </div>
                    </FormField>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <FormField label="Evaluation Model">
                        <TextInput value={challengeForm.evaluation_model} onChange={v => setChallengeForm({ ...challengeForm, evaluation_model: v })} placeholder="e.g. gpt-4o" />
                      </FormField>
                      <FormField label="Temperature">
                        <TextInput type="number" value={challengeForm.ai_temperature} onChange={v => setChallengeForm({ ...challengeForm, ai_temperature: v })} />
                      </FormField>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Hints Tab */}
          {challengeTab === 'hints' && (
            <div className="space-y-4">
              <FormField label="Hint 1">
                <TextArea value={challengeForm.hint_1} onChange={v => setChallengeForm({ ...challengeForm, hint_1: v })} rows={2} placeholder="First hint (mildest)..." />
              </FormField>
              <FormField label="Hint 2">
                <TextArea value={challengeForm.hint_2} onChange={v => setChallengeForm({ ...challengeForm, hint_2: v })} rows={2} placeholder="Second hint (more specific)..." />
              </FormField>
              <FormField label="Hint 3">
                <TextArea value={challengeForm.hint_3} onChange={v => setChallengeForm({ ...challengeForm, hint_3: v })} rows={2} placeholder="Third hint (most revealing)..." />
              </FormField>
              <FormField label="Penalty per Hint (points)">
                <TextInput type="number" value={challengeForm.hint_penalty_per} onChange={v => setChallengeForm({ ...challengeForm, hint_penalty_per: v })} />
              </FormField>
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type === 'ROUND' ? 'Round' : 'Challenge'}`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          onConfirm={deleteTarget.type === 'ROUND' ? handleDeleteRound : handleDeleteChallenge}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
