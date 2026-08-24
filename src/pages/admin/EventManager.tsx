import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, Select, ConfirmDialog, AnimatedNumber } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ZapIcon, ClockIcon, CheckCircleIcon, AlertTriangleIcon, XCircleIcon } from '../../components/icons';
import { useAdminStore } from '../../stores/adminStore';
import type { Page } from '../../components/Layout';

interface Event {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  max_teams: number | null;
  team_size: number | null;
  timezone: string | null;
  rules: string | null;
  registration_start: string | null;
  registration_end: string | null;
  created_at: string;
}

const statusConfig: Record<string, { color: string; dot: string; label: string }> = {
  DRAFT:             { color: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Draft' },
  REGISTRATION_OPEN: { color: 'text-blue-600',   dot: 'bg-blue-500',   label: 'Registration Open' },
  LIVE:              { color: 'text-green-600',  dot: 'bg-green-500',  label: 'Live' },
  PAUSED:            { color: 'text-amber-600',  dot: 'bg-amber-500',  label: 'Paused' },
  COMPLETED:         { color: 'text-violet-600', dot: 'bg-violet-500', label: 'Completed' },
};

// Valid status transitions
const validTransitions: Record<string, string[]> = {
  DRAFT:             ['REGISTRATION_OPEN'],
  REGISTRATION_OPEN: ['DRAFT', 'LIVE'],
  LIVE:              ['PAUSED', 'COMPLETED'],
  PAUSED:            ['LIVE', 'COMPLETED'],
  COMPLETED:         [],
};

const statusFlow = ['DRAFT', 'REGISTRATION_OPEN', 'LIVE', 'PAUSED', 'COMPLETED'];

const emptyForm = { name: '', description: '', start_time: '', end_time: '', max_teams: '', team_size: '2', timezone: 'Asia/Kolkata', rules: '', registration_start: '', registration_end: '' };

export default function EventManager({ navigate }: { navigate: (p: Page) => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<{ event: Event; checks: { label: string; ok: boolean }[] } | null>(null);
  const { setActiveEvent } = useAdminStore();

  const loadEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) setEvents(data);
    setLoading(false);
  };

  useEffect(() => { loadEvents(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: 'DRAFT',
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      max_teams: form.max_teams ? parseInt(form.max_teams) : null,
      team_size: form.team_size ? parseInt(form.team_size) : 2,
      timezone: form.timezone || 'Asia/Kolkata',
      rules: form.rules.trim() || null,
      registration_start: form.registration_start || null,
      registration_end: form.registration_end || null,
    };
    const { data, error } = await supabase.from('events').insert(payload).select().single();
    if (data && !error) {
      setEvents([data, ...events]);
      setActiveEvent({ id: data.id, name: data.name, status: data.status });
      await logAction('EVENT_CREATED', { event_id: data.id, event_name: data.name });
    }
    setSaving(false);
    setShowCreate(false);
    setForm(emptyForm);
  };

  const handleEdit = async () => {
    if (!editEvent || !form.name.trim()) return;
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      max_teams: form.max_teams ? parseInt(form.max_teams) : null,
      team_size: form.team_size ? parseInt(form.team_size) : 2,
      timezone: form.timezone || 'Asia/Kolkata',
      rules: form.rules.trim() || null,
      registration_start: form.registration_start || null,
      registration_end: form.registration_end || null,
    };
    const { error } = await supabase.from('events').update(payload).eq('id', editEvent.id);
    if (!error) {
      await logAction('EVENT_UPDATED', { event_id: editEvent.id, changes: payload });
      loadEvents();
    }
    setSaving(false);
    setEditEvent(null);
    setForm(emptyForm);
  };

  const handleDelete = async (reason?: string) => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('events').delete().eq('id', deleteTarget.id);
    if (!error) {
      await logAction('EVENT_DELETED', { event_id: deleteTarget.id, event_name: deleteTarget.name, reason });
      setEvents(events.filter(e => e.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const updateStatus = async (event: Event, newStatus: string) => {
    const allowed = validTransitions[event.status] || [];
    if (!allowed.includes(newStatus)) return;

    // If going LIVE, run start checklist
    if (newStatus === 'LIVE' && event.status !== 'PAUSED') {
      const checks = await runStartChecklist(event.id);
      const allOk = checks.every(c => c.ok);
      if (!allOk) {
        setChecklist({ event, checks });
        return;
      }
    }

    const { error } = await supabase.from('events').update({ status: newStatus as any }).eq('id', event.id);
    if (!error) {
      await logAction('EVENT_STATUS_CHANGED', { event_id: event.id, from: event.status, to: newStatus });
      setEvents(events.map(e => e.id === event.id ? { ...e, status: newStatus } : e));
      setActiveEvent({ id: event.id, name: event.name, status: newStatus });
    }
  };

  const runStartChecklist = async (eventId: string): Promise<{ label: string; ok: boolean }[]> => {
    const [rounds, teams, challenges] = await Promise.all([
      supabase.from('rounds').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
      supabase.from('challenges').select('id, round_id', { count: 'exact' }).in(
        'round_id',
        (await supabase.from('rounds').select('id').eq('event_id', eventId)).data?.map(r => r.id) || []
      ),
    ]);

    return [
      { label: 'At least 1 round configured', ok: (rounds.count || 0) > 0 },
      { label: 'At least 1 team registered', ok: (teams.count || 0) > 0 },
      { label: 'Challenges configured', ok: (challenges.count || 0) > 0 },
    ];
  };

  const openEditModal = (event: Event) => {
    setForm({
      name: event.name,
      description: event.description || '',
      start_time: event.start_time ? event.start_time.slice(0, 16) : '',
      end_time: event.end_time ? event.end_time.slice(0, 16) : '',
      max_teams: event.max_teams?.toString() || '',
      team_size: event.team_size?.toString() || '2',
      timezone: event.timezone || 'Asia/Kolkata',
      rules: event.rules || '',
      registration_start: event.registration_start ? event.registration_start.slice(0, 16) : '',
      registration_end: event.registration_end ? event.registration_end.slice(0, 16) : '',
    });
    setEditEvent(event);
  };

  const logAction = async (action: string, details: any) => {
    await supabase.from('activity_logs').insert({ action, details });
  };

  const renderForm = () => (
    <div className="space-y-4">
      <FormField label="Event Name" required>
        <TextInput value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Prompt Engineering Championship 2026" />
      </FormField>
      <FormField label="Description">
        <TextArea value={form.description} onChange={v => setForm({ ...form, description: v })} placeholder="Describe the event..." rows={2} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start Date & Time">
          <TextInput type="datetime-local" value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} />
        </FormField>
        <FormField label="End Date & Time">
          <TextInput type="datetime-local" value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Registration Start">
          <TextInput type="datetime-local" value={form.registration_start} onChange={v => setForm({ ...form, registration_start: v })} />
        </FormField>
        <FormField label="Registration End">
          <TextInput type="datetime-local" value={form.registration_end} onChange={v => setForm({ ...form, registration_end: v })} />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Max Teams">
          <TextInput type="number" value={form.max_teams} onChange={v => setForm({ ...form, max_teams: v })} placeholder="Unlimited" />
        </FormField>
        <FormField label="Team Size">
          <TextInput type="number" value={form.team_size} onChange={v => setForm({ ...form, team_size: v })} placeholder="2" />
        </FormField>
        <FormField label="Timezone">
          <Select value={form.timezone} onChange={v => setForm({ ...form, timezone: v })} options={[
            { value: 'Asia/Kolkata', label: 'IST (Asia/Kolkata)' },
            { value: 'UTC', label: 'UTC' },
            { value: 'America/New_York', label: 'EST (New York)' },
            { value: 'Europe/London', label: 'GMT (London)' },
          ]} />
        </FormField>
      </div>
      <FormField label="Rules & Guidelines">
        <TextArea value={form.rules} onChange={v => setForm({ ...form, rules: v })} placeholder="Competition rules..." rows={3} />
      </FormField>
    </div>
  );

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Event Management</h1>
          <p className="text-gray-500 text-sm">Create, configure, and control the event lifecycle</p>
        </div>
        <Button className="gap-2" onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
          <ZapIcon className="w-4 h-4" />
          Create New Event
        </Button>
      </div>

      {/* Events grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm text-gray-500 font-semibold">No events yet</div>
          <div className="text-xs text-gray-400 mt-1 mb-4">Create your first event to get started.</div>
          <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }}>Create Event</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const sc = statusConfig[event.status] || statusConfig.DRAFT;
            const allowed = validTransitions[event.status] || [];
            return (
              <div key={event.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl flex items-center justify-center border border-orange-100">
                        <ZapIcon className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 font-heading">{event.name}</h3>
                        <p className="text-sm text-gray-500 max-w-lg">{event.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        <span className={`w-2.5 h-2.5 rounded-full ${sc.dot} ${event.status === 'LIVE' ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs font-black font-heading ${sc.color}`}>{sc.label}</span>
                      </div>
                      <button
                        onClick={() => openEditModal(event)}
                        className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 transition-all"
                      >
                        Edit
                      </button>
                      {event.status === 'DRAFT' && (
                        <button
                          onClick={() => setDeleteTarget(event)}
                          className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Event meta */}
                  <div className="flex items-center gap-6 mb-5 text-xs text-gray-500 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span>Start: {event.start_time ? new Date(event.start_time).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span>End: {event.end_time ? new Date(event.end_time).toLocaleString() : '—'}</span>
                    </div>
                    {event.max_teams && (
                      <div className="flex items-center gap-1.5">
                        <span>Max Teams: {event.max_teams}</span>
                      </div>
                    )}
                    {event.team_size && (
                      <div className="flex items-center gap-1.5">
                        <span>Team Size: {event.team_size}</span>
                      </div>
                    )}
                  </div>

                  {/* Status flow — only valid transitions are clickable */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 rounded-xl border border-gray-100">
                    {statusFlow.map((s) => {
                      const isActive = event.status === s;
                      const conf = statusConfig[s];
                      const canTransition = allowed.includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => canTransition && updateStatus(event, s)}
                          disabled={!canTransition && !isActive}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold font-heading transition-all duration-200 ${
                            isActive
                              ? `bg-white shadow-sm border border-gray-200 ${conf.color}`
                              : canTransition
                                ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 cursor-pointer'
                                : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create New Event" onClose={() => setShowCreate(false)} size="lg" footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? 'Creating...' : 'Create Event'}
            </Button>
          </>
        }>
          {renderForm()}
        </Modal>
      )}

      {/* Edit Modal */}
      {editEvent && (
        <Modal title="Edit Event" onClose={() => { setEditEvent(null); setForm(emptyForm); }} size="lg" footer={
          <>
            <Button variant="outline" onClick={() => { setEditEvent(null); setForm(emptyForm); }}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }>
          {renderForm()}
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Event"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This will permanently remove the event and all associated data (teams, rounds, submissions).`}
          confirmLabel="Delete Event"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          requireReason
        />
      )}

      {/* Start Checklist */}
      {checklist && (
        <Modal title="Event Start Checklist" onClose={() => setChecklist(null)} size="md" footer={
          <Button variant="outline" onClick={() => setChecklist(null)}>Close</Button>
        }>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              The event cannot go LIVE until all checklist items pass:
            </p>
            {checklist.checks.map((check, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${check.ok ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
                {check.ok ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${check.ok ? 'text-green-700' : 'text-red-700'}`}>{check.label}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
