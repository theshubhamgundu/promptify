import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, Select, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { useAuthStore } from '../../stores/authStore';
import { ZapIcon, TrashIcon, CheckCircleIcon, BanIcon } from '../../components/icons';

interface Announcement {
  id: string;
  event_id: string;
  scope: string;
  title: string;
  message: string;
  severity: string;
  is_active: boolean;
  created_at: string;
}

export default function Announcements({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const { session } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    message: '',
    severity: 'INFO',
    scope: 'GLOBAL'
  });

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('event_id', activeEvent.id)
      .order('created_at', { ascending: false });
      
    if (data) setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeEvent]);

  const handlePush = async () => {
    if (!activeEvent || !form.title || !form.message || !session) return;
    setSaving(true);
    
    const { error } = await supabase.from('announcements').insert({
      event_id: activeEvent.id,
      title: form.title,
      message: form.message,
      severity: form.severity,
      scope: form.scope,
      created_by: session.user?.id,
      is_active: true
    });
    
    if (!error) {
      await loadData();
      setShowModal(false);
      setForm({ title: '', message: '', severity: 'INFO', scope: 'GLOBAL' });
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('announcements').update({ is_active: !current }).eq('id', id);
    await loadData();
  };

  const severityColors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-700 border-blue-200',
    WARNING: 'bg-amber-100 text-amber-700 border-amber-200',
    URGENT: 'bg-red-100 text-red-700 border-red-200'
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Live Announcements</h1>
          <p className="text-gray-500 text-sm mt-1">Push real-time alerts to participant screens in {activeEvent.name}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <ZapIcon className="w-4 h-4 mr-2" /> Push Announcement
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px_150px_120px] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50/50">
          <span>Message</span>
          <span>Severity</span>
          <span>Scope</span>
          <span>Pushed At</span>
          <span className="text-right">Status / Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-2xl mb-2">📢</div>
            <div className="text-sm text-gray-500 font-medium">No announcements pushed yet</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[700px] overflow-y-auto">
            {announcements.map(a => (
              <div key={a.id} className="grid grid-cols-[1fr_100px_100px_150px_120px] px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 pr-4">
                  <div className="text-sm font-bold text-gray-900 truncate">{a.title}</div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{a.message}</div>
                </div>
                
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black font-heading tracking-wider border ${severityColors[a.severity] || severityColors.INFO}`}>
                    {a.severity}
                  </span>
                </div>
                
                <div>
                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{a.scope}</span>
                </div>
                
                <div className="text-[11px] text-gray-500 font-mono">
                  {new Date(a.created_at).toLocaleString()}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button 
                    onClick={() => toggleActive(a.id, a.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      a.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                    }`}
                  >
                    {a.is_active ? 'Revoke' : 'Republish'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Push Live Announcement" onClose={() => setShowModal(false)} size="md" footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handlePush} disabled={saving || !form.title || !form.message}>Push Live</Button>
          </>
        }>
          <div className="space-y-4">
            <FormField label="Headline" required>
              <TextInput value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="e.g. 5 Minutes Remaining!" />
            </FormField>
            <FormField label="Message Body" required>
              <TextArea value={form.message} onChange={v => setForm({ ...form, message: v })} rows={3} placeholder="Provide details..." />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Severity" required>
                <Select value={form.severity} onChange={v => setForm({ ...form, severity: v })} options={[
                  { value: 'INFO', label: 'Info (Blue)' },
                  { value: 'WARNING', label: 'Warning (Orange)' },
                  { value: 'URGENT', label: 'Urgent (Red)' }
                ]} />
              </FormField>
              <FormField label="Scope" required>
                <Select value={form.scope} onChange={v => setForm({ ...form, scope: v })} options={[
                  { value: 'GLOBAL', label: 'All Participants' }
                ]} />
              </FormField>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
