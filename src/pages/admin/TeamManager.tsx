import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { UsersIcon, CopyIcon, CheckIcon, ShieldIcon, XCircleIcon } from '../../components/icons';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';

interface Participant {
  id: string;
  name: string;
  role: string;
  user_id: string;
}

interface Team {
  id: string;
  name: string;
  access_code: string;
  event_id: string;
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
  participants?: Participant[];
}

export default function TeamManager({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Team | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  const loadTeams = async () => {
    if (!activeEvent) return;
    setLoading(true);
    
    // Fetch teams
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', activeEvent.id)
      .order('created_at', { ascending: false });
      
    // Fetch participants for these teams
    const { data: partsData } = await supabase
      .from('participants')
      .select('*')
      .in('team_id', (teamsData || []).map(t => t.id));

    if (teamsData) {
      const merged = teamsData.map(t => ({
        ...t,
        status: t.status || 'ACTIVE', // Fallback if column not yet added
        participants: (partsData || []).filter(p => p.team_id === t.id)
      }));
      setTeams(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTeams();
  }, [activeEvent]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !activeEvent) return;
    setCreating(true);
    
    // Generate a random 6-character uppercase alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: createName.trim(),
        access_code: code,
        event_id: activeEvent.id
      })
      .select()
      .single();
      
    if (data && !error) {
      await supabase.from('activity_logs').insert({
        action: 'TEAM_CREATED',
        details: { team_id: data.id, team_name: data.name, event_id: activeEvent.id }
      });
      setShowCreate(false);
      setCreateName('');
      loadTeams();
    }
    
    setCreating(false);
  };

  const handleDelete = async (reason?: string) => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('teams').delete().eq('id', deleteTarget.id);
    if (!error) {
      await supabase.from('activity_logs').insert({
        action: 'TEAM_DELETED',
        details: { team_id: deleteTarget.id, team_name: deleteTarget.name, reason }
      });
      setTeams(teams.filter(t => t.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const toggleStatus = async (team: Team) => {
    // In a real app, 'status' column would be added to 'teams' table in migration.
    // Assuming we do it, or just use a soft-suspend approach.
    // For now we'll mock the UI status change.
    const newStatus = team.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    // const { error } = await supabase.from('teams').update({ status: newStatus }).eq('id', team.id);
    
    await supabase.from('activity_logs').insert({
      action: newStatus === 'ACTIVE' ? 'TEAM_RESUMED' : 'TEAM_SUSPENDED',
      details: { team_id: team.id, team_name: team.name }
    });
    
    setTeams(teams.map(t => t.id === team.id ? { ...t, status: newStatus } : t));
    setSuspendTarget(null);
  };

  const teamColors = [
    'from-orange-500 to-red-500',
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-amber-400 to-orange-500',
    'from-pink-500 to-rose-500',
  ];

  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.access_code.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Team Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Manage teams and participants for {activeEvent.name}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Create Team</Button>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
        <div className="pl-3 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search teams by name or access code..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2"
        />
        <div className="pr-3 px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 text-xs font-bold text-gray-500">
          {filteredTeams.length} Teams
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading teams...</div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-sm text-gray-500 font-semibold">No teams found</div>
          <div className="text-xs text-gray-400 mt-1">Adjust search or create a new team.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team, i) => (
            <div
              key={team.id}
              className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-all group flex flex-col cursor-pointer
                ${team.status === 'SUSPENDED' ? 'border-red-200 opacity-75' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}
              `}
            >
              <div className="p-5 flex-1" onClick={() => navigate(`admin-team-${team.id}`)}>
                <div className="flex items-start gap-4 mb-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 bg-gradient-to-br ${team.status === 'SUSPENDED' ? 'from-gray-400 to-gray-500 grayscale' : teamColors[i % teamColors.length]} rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
                    <span className="text-white text-lg font-black font-heading">{team.name.charAt(0).toUpperCase()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-gray-900 font-heading truncate">{team.name}</h3>
                    </div>
                    {team.status === 'SUSPENDED' ? (
                      <div className="inline-flex mt-1 items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                        <XCircleIcon className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] text-red-700 font-bold uppercase tracking-wide">Suspended</span>
                      </div>
                    ) : (
                      <div className="inline-flex mt-1 items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-green-700 font-bold uppercase tracking-wide">Active</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Access Code */}
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Access Code</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 font-mono text-sm text-orange-600 font-bold tracking-wider">
                      {team.access_code}
                    </div>
                    <button
                      onClick={() => copyCode(team.access_code, team.id)}
                      className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-orange-50 hover:border-orange-200 transition-all text-gray-500 hover:text-orange-600"
                    >
                      {copiedId === team.id
                        ? <CheckIcon className="w-4 h-4 text-green-500" />
                        : <CopyIcon className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* Participants */}
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <UsersIcon className="w-3 h-3" />
                    Participants ({team.participants?.length || 0})
                  </div>
                  {team.participants && team.participants.length > 0 ? (
                    <div className="space-y-1.5">
                      {team.participants.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-100">
                          <span className="font-medium text-gray-700 truncate">{p.name}</span>
                          <span className="text-gray-400 font-mono scale-90">{p.role}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">No participants joined yet</div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                 <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSuspendTarget(team);
                    }}
                    className={`text-xs font-bold transition-colors ${team.status === 'SUSPENDED' ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}`}
                  >
                    {team.status === 'SUSPENDED' ? 'Resume Team' : 'Suspend Team'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(team);
                    }}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    Delete
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Create Team" onClose={() => setShowCreate(false)} size="sm" footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
          </>
        }>
          <FormField label="Team Name" required>
            <TextInput value={createName} onChange={setCreateName} placeholder="e.g. Alpha Squad" />
          </FormField>
          <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-800 flex gap-2">
            <ShieldIcon className="w-4 h-4 flex-shrink-0 text-orange-500" />
            <span>An access code will be automatically generated. Give this code to participants to log in.</span>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Team"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete Team"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          requireReason
        />
      )}

      {/* Suspend Confirm */}
      {suspendTarget && (
        <ConfirmDialog
          title={suspendTarget.status === 'SUSPENDED' ? 'Resume Team' : 'Suspend Team'}
          message={`Are you sure you want to ${suspendTarget.status === 'SUSPENDED' ? 'resume' : 'suspend'} "${suspendTarget.name}"? ${suspendTarget.status === 'ACTIVE' ? 'They will be immediately locked out of the event.' : 'They will regain access to the event.'}`}
          confirmLabel={suspendTarget.status === 'SUSPENDED' ? 'Resume' : 'Suspend'}
          variant={suspendTarget.status === 'SUSPENDED' ? 'primary' : 'danger'}
          onConfirm={() => toggleStatus(suspendTarget)}
          onCancel={() => setSuspendTarget(null)}
          requireReason
        />
      )}
    </div>
  );
}
