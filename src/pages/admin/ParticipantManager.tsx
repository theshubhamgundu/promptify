import { useState, useEffect } from 'react';
import { Button, TextInput, Select, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { UsersIcon, SearchIcon, ShieldIcon, BanIcon, CheckCircleIcon } from '../../components/icons';

interface Participant {
  id: string;
  team_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  team: {
    name: string;
    access_code: string;
  };
}

export default function ParticipantManager({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [deleteTarget, setDeleteTarget] = useState<Participant | null>(null);

  const loadData = async () => {
    if (!activeEvent) return;
    setLoading(true);

    // Get teams for event
    const { data: teams } = await supabase.from('teams').select('id, name, access_code').eq('event_id', activeEvent.id);
    if (!teams || teams.length === 0) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    const teamMap = new Map(teams.map(t => [t.id, t]));
    const teamIds = teams.map(t => t.id);

    // Get participants
    const { data: parts } = await supabase.from('participants').select('*').in('team_id', teamIds).order('created_at', { ascending: false });
    
    if (parts) {
      setParticipants(parts.map(p => ({
        ...p,
        team: teamMap.get(p.team_id)!
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeEvent]);

  const toggleStatus = async (p: Participant) => {
    const newStatus = p.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const { error } = await supabase.from('participants').update({ status: newStatus }).eq('id', p.id);
    if (!error) {
      await supabase.from('activity_logs').insert({
        action: newStatus === 'SUSPENDED' ? 'PARTICIPANT_SUSPENDED' : 'PARTICIPANT_RESUMED',
        team_id: p.team_id,
        details: { participant_id: p.id, email: p.email }
      });
      await loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('participants').delete().eq('id', deleteTarget.id);
    if (!error) await loadData();
    setDeleteTarget(null);
  };

  const filtered = participants.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.team.name.toLowerCase().includes(q);
    }
    return true;
  });

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Participant Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Manage individual participants across all teams in {activeEvent.name}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-transparent focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 rounded-xl text-sm transition-all outline-none"
          />
        </div>
        <div className="w-48">
          <Select 
            value={statusFilter} 
            onChange={setStatusFilter} 
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' }
            ]} 
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_150px_100px_120px_120px] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50/50">
          <span>Name & Email</span>
          <span>Team</span>
          <span>Role</span>
          <span>Status</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Loading participants...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-2xl mb-2">👥</div>
            <div className="text-sm text-gray-500 font-medium">No participants found</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filtered.map(p => (
              <div key={p.id} className="grid grid-cols-[1fr_1fr_150px_100px_120px_120px] px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 pr-4">
                  <div className="text-sm font-bold text-gray-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">{p.email}</div>
                </div>
                
                <div className="min-w-0 pr-4">
                  <button onClick={() => navigate(`admin-team-${p.team_id}` as Page)} className="text-sm font-bold text-gray-900 hover:text-orange-600 truncate transition-colors text-left block w-full">
                    {p.team.name}
                  </button>
                  <div className="text-[10px] font-mono text-gray-400 mt-0.5">Code: {p.team.access_code}</div>
                </div>
                
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider ${
                    p.role === 'LEADER' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.role === 'LEADER' && <ShieldIcon className="w-3 h-3" />}
                    {p.role}
                  </span>
                </div>
                
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider ${
                    p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
                    {p.status}
                  </span>
                </div>

                <div className="text-[11px] text-gray-400 font-mono">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button 
                    onClick={() => toggleStatus(p)}
                    title={p.status === 'ACTIVE' ? 'Suspend Participant' : 'Resume Participant'}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      p.status === 'ACTIVE' ? 'text-gray-400 hover:bg-amber-50 hover:text-amber-600' : 'text-red-500 bg-red-50 hover:bg-green-50 hover:text-green-600'
                    }`}
                  >
                    {p.status === 'ACTIVE' ? <BanIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setDeleteTarget(p)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Participant"
          message={`Are you sure you want to permanently remove ${deleteTarget.name} from team ${deleteTarget.team.name}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
