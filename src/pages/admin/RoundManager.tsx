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
const emptyChallenge = { title: '', description: '', type: 'MULTIPLE_CHOICE', base_points: '100', max_attempts: '3' };

export default function RoundManager({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [editRound, setEditRound] = useState<Round | null>(null);
  const [roundForm, setRoundForm] = useState(emptyRound);
  
  const [showChallengeModal, setShowChallengeModal] = useState<{ roundId: string, challenge?: Challenge } | null>(null);
  const [challengeForm, setChallengeForm] = useState(emptyChallenge);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'ROUND' | 'CHALLENGE', id: string, name: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const loadRounds = async () => {
    if (!activeEvent) return;
    setLoading(true);
    
    const { data: roundsData } = await supabase
      .from('rounds')
      .select('*')
      .eq('event_id', activeEvent.id)
      .order('order_index');

    if (roundsData) {
      const { data: challengesData } = await supabase
        .from('challenges')
        .select('*')
        .in('round_id', roundsData.map(r => r.id))
        .order('order_index');
        
      setRounds(roundsData.map(r => ({
        ...r,
        challenges: (challengesData || []).filter(c => c.round_id === r.id)
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRounds();
  }, [activeEvent]);

  // Round CRUD
  const handleSaveRound = async () => {
    if (!activeEvent || !roundForm.name) return;
    setSaving(true);
    
    const payload = {
      event_id: activeEvent.id,
      name: roundForm.name,
      description: roundForm.description || null,
      type: roundForm.type,
      duration_minutes: roundForm.duration_minutes ? parseInt(roundForm.duration_minutes) : null,
      order_index: parseInt(roundForm.order_index) || rounds.length + 1,
      status: 'DRAFT'
    };

    if (editRound) {
      const { error } = await supabase.from('rounds').update(payload).eq('id', editRound.id);
      if (!error) await loadRounds();
    } else {
      const { error } = await supabase.from('rounds').insert(payload);
      if (!error) await loadRounds();
    }
    
    setSaving(false);
    setShowRoundModal(false);
    setEditRound(null);
  };

  const handleDeleteRound = async () => {
    if (!deleteTarget || deleteTarget.type !== 'ROUND') return;
    const { error } = await supabase.from('rounds').delete().eq('id', deleteTarget.id);
    if (!error) await loadRounds();
    setDeleteTarget(null);
  };

  const toggleRoundStatus = async (round: Round) => {
    const newStatus = round.status === 'LIVE' ? 'DRAFT' : 'LIVE';
    const { error } = await supabase.from('rounds').update({ status: newStatus }).eq('id', round.id);
    if (!error) await loadRounds();
  };

  // Challenge CRUD
  const handleSaveChallenge = async () => {
    if (!showChallengeModal || !challengeForm.title) return;
    setSaving(true);
    
    const roundId = showChallengeModal.roundId;
    const round = rounds.find(r => r.id === roundId);
    
    const payload = {
      round_id: roundId,
      title: challengeForm.title,
      description: challengeForm.description,
      type: challengeForm.type,
      base_points: parseInt(challengeForm.base_points) || 0,
      max_attempts: challengeForm.max_attempts ? parseInt(challengeForm.max_attempts) : null,
      order_index: showChallengeModal.challenge ? showChallengeModal.challenge.order_index : (round?.challenges?.length || 0) + 1,
    };

    if (showChallengeModal.challenge) {
      const { error } = await supabase.from('challenges').update(payload).eq('id', showChallengeModal.challenge.id);
      if (!error) {
        const { data: vData } = await supabase.from('challenge_versions').select('version_number').eq('challenge_id', showChallengeModal.challenge.id).order('version_number', { ascending: false }).limit(1);
        const nextV = (vData && vData.length > 0) ? vData[0].version_number + 1 : 2;
        await supabase.from('challenge_versions').insert({
          challenge_id: showChallengeModal.challenge.id,
          version_number: nextV,
          title: payload.title,
          description: payload.description,
          type: payload.type,
          base_points: payload.base_points,
          max_attempts: payload.max_attempts,
          configuration: {}
        });
        await loadRounds();
      }
    } else {
      const { data: newChal, error } = await supabase.from('challenges').insert(payload).select().single();
      if (!error && newChal) {
        await supabase.from('challenge_versions').insert({
          challenge_id: newChal.id,
          version_number: 1,
          title: payload.title,
          description: payload.description,
          type: payload.type,
          base_points: payload.base_points,
          max_attempts: payload.max_attempts,
          configuration: {}
        });
        await loadRounds();
      }
    }
    
    setSaving(false);
    setShowChallengeModal(null);
  };

  const handleDeleteChallenge = async () => {
    if (!deleteTarget || deleteTarget.type !== 'CHALLENGE') return;
    const { error } = await supabase.from('challenges').delete().eq('id', deleteTarget.id);
    if (!error) await loadRounds();
    setDeleteTarget(null);
  };

  const roundIcons: Record<string, string> = {
    QUIZ: '🧠',
    PROMPT: '🎯',
    ESCAPE_ROOM: '🧩',
    BATTLE: '⚔️',
    GRANDMASTER: '👑',
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
                {/* Round Header */}
                <div className="p-5 flex items-center gap-5 hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">
                    {roundIcons[round.type] || '📋'}
                  </div>
                  
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedRound(isExpanded ? null : round.id)}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 text-[11px] font-black text-gray-700">
                        {round.order_index}
                      </span>
                      <h3 className="text-base font-black text-gray-900 font-heading">{round.name}</h3>
                      <span className={`text-[10px] font-black font-heading px-2 py-0.5 rounded-full ${
                        round.status === 'LIVE' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {round.status}
                      </span>
                    </div>
                    {round.description && <p className="text-xs text-gray-500 mt-1 truncate">{round.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-[11px] font-bold text-gray-400 font-heading tracking-wide">
                      <span>TYPE: {round.type}</span>
                      <span>DURATION: {round.duration_minutes || '—'} MIN</span>
                      <span className="text-orange-500">{round.challenges?.length || 0} CHALLENGES</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleRoundStatus(round)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      round.status === 'LIVE' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}>
                      {round.status === 'LIVE' ? 'Make Draft' : 'Make Live'}
                    </button>
                    <button onClick={() => {
                      setEditRound(round);
                      setRoundForm({
                        name: round.name,
                        description: round.description || '',
                        type: round.type,
                        duration_minutes: round.duration_minutes?.toString() || '',
                        order_index: round.order_index.toString()
                      });
                      setShowRoundModal(true);
                    }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500">
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

                {/* Challenges Section */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-black text-gray-500 font-heading uppercase tracking-widest">Challenges</h4>
                      <Button variant="outline" className="text-xs py-1.5 px-3 h-auto" onClick={() => {
                        setChallengeForm(emptyChallenge);
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
                            <div className="cursor-move text-gray-300 hover:text-gray-500 p-1">
                              <GripVerticalIcon className="w-4 h-4" />
                            </div>
                            <div className="w-6 h-6 rounded bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black">
                              {chal.order_index}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-gray-900 truncate">{chal.title}</div>
                              <div className="flex gap-3 text-[10px] text-gray-400 font-mono mt-0.5">
                                <span>{chal.type}</span>
                                <span>{chal.base_points} PTS</span>
                                <span>{chal.max_attempts ? `${chal.max_attempts} ATTEMPTS` : 'UNLIMITED'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => {
                                setChallengeForm({
                                  title: chal.title,
                                  description: chal.description,
                                  type: chal.type,
                                  base_points: chal.base_points.toString(),
                                  max_attempts: chal.max_attempts?.toString() || ''
                                });
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
                  { value: 'QUIZ', label: 'Quiz' },
                  { value: 'PROMPT', label: 'Prompt Challenge' },
                  { value: 'ESCAPE_ROOM', label: 'AI Escape Room' },
                  { value: 'BATTLE', label: 'AI Battle' },
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

      {/* Challenge Modal */}
      {showChallengeModal && (
        <Modal title={showChallengeModal.challenge ? 'Edit Challenge' : 'Add Challenge'} onClose={() => setShowChallengeModal(null)} size="md" footer={
          <>
            <Button variant="outline" onClick={() => setShowChallengeModal(null)}>Cancel</Button>
            <Button onClick={handleSaveChallenge} disabled={saving || !challengeForm.title}>Save</Button>
          </>
        }>
          <div className="space-y-4">
            <FormField label="Challenge Title" required>
              <TextInput value={challengeForm.title} onChange={v => setChallengeForm({ ...challengeForm, title: v })} />
            </FormField>
            <FormField label="Description">
              <TextArea value={challengeForm.description} onChange={v => setChallengeForm({ ...challengeForm, description: v })} rows={3} />
            </FormField>
            <FormField label="Type" required>
              <Select value={challengeForm.type} onChange={v => setChallengeForm({ ...challengeForm, type: v })} options={[
                { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
                { value: 'PROMPT_MATCH', label: 'Prompt Match' },
                { value: 'CODE_FIX', label: 'Code Fix' },
                { value: 'GENERATIVE', label: 'Generative Output' }
              ]} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Base Points" required>
                <TextInput type="number" value={challengeForm.base_points} onChange={v => setChallengeForm({ ...challengeForm, base_points: v })} />
              </FormField>
              <FormField label="Max Attempts">
                <TextInput type="number" value={challengeForm.max_attempts} onChange={v => setChallengeForm({ ...challengeForm, max_attempts: v })} placeholder="Unlimited" />
              </FormField>
            </div>
          </div>
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
