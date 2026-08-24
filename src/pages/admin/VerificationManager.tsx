import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextArea } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { CheckCircleIcon, BanIcon, ClockIcon } from '../../components/icons';

interface VerificationRequest {
  id: string;
  team_id: string;
  status: string;
  requested_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
  team: {
    name: string;
    access_code: string;
  };
  participants: {
    name: string;
    email: string;
    role: string;
  }[];
}

export default function VerificationManager({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRequests = async () => {
    if (!activeEvent) return;
    setLoading(true);

    // 1. Get teams
    const { data: teams } = await supabase.from('teams').select('id, name, access_code').eq('event_id', activeEvent.id);
    if (!teams || teams.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const teamIds = teams.map(t => t.id);

    // 2. Get requests
    const { data: reqs } = await supabase
      .from('verification_requests')
      .select('*')
      .in('team_id', teamIds)
      .order('requested_at', { ascending: false });

    // 3. Get participants
    const { data: parts } = await supabase.from('participants').select('team_id, name, email, role').in('team_id', teamIds);
    
    if (reqs && parts) {
      setRequests(reqs.map(r => ({
        ...r,
        team: teamMap.get(r.team_id)!,
        participants: parts.filter(p => p.team_id === r.team_id)
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();

    // Subscribe to new requests
    const channel = supabase.channel('verification-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, () => {
        loadRequests();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeEvent]);

  const handleApprove = async (id: string, team_id: string) => {
    // 1. Update request
    await supabase.from('verification_requests').update({ 
      status: 'APPROVED', 
      resolved_at: new Date().toISOString() 
    }).eq('id', id);

    // 2. Update team status if not already verified
    await supabase.from('teams').update({ status: 'ACTIVE' }).eq('id', team_id);
    
    // 3. Log
    await supabase.from('activity_logs').insert({
      action: 'VERIFICATION_APPROVED',
      team_id: team_id,
      details: { request_id: id }
    });
    
    await loadRequests();
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(true);
    
    const req = requests.find(r => r.id === rejectModal);
    
    await supabase.from('verification_requests').update({ 
      status: 'REJECTED', 
      rejection_reason: rejectReason,
      resolved_at: new Date().toISOString() 
    }).eq('id', rejectModal);
    
    if (req) {
      await supabase.from('activity_logs').insert({
        action: 'VERIFICATION_REJECTED',
        team_id: req.team_id,
        details: { request_id: req.id, reason: rejectReason }
      });
    }

    setSaving(false);
    setRejectModal(null);
    setRejectReason('');
    await loadRequests();
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  const pending = requests.filter(r => r.status === 'PENDING');
  const resolved = requests.filter(r => r.status !== 'PENDING');

  return (
    <div className="p-8 space-y-8 animate-slide-up">
      <div>
        <h1 className="text-2xl font-black text-gray-900 font-heading">Verification Queue</h1>
        <p className="text-gray-500 text-sm mt-1">Review and approve team entry into {activeEvent.name}</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading requests...</div>
      ) : (
        <>
          {/* PENDING SECTION */}
          <div className="space-y-4">
            <h2 className="text-sm font-black text-gray-900 font-heading tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> 
              Action Required ({pending.length})
            </h2>
            
            {pending.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-gray-900">All caught up!</div>
                <div className="text-xs text-gray-500 mt-1">No pending verification requests.</div>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                {pending.map(req => (
                  <div key={req.id} className="bg-white border border-orange-200 rounded-2xl p-5 shadow-sm shadow-orange-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs font-black text-orange-500 font-heading tracking-wider mb-1">TEAM VERIFICATION</div>
                        <h3 className="text-lg font-bold text-gray-900 leading-none mb-1">{req.team.name}</h3>
                        <div className="text-xs text-gray-400 font-mono">Code: {req.team.access_code} • Request: {new Date(req.requested_at).toLocaleTimeString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setRejectModal(req.id); setRejectReason(''); }}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => handleApprove(req.id, req.team_id)}
                          className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 text-xs font-bold transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="text-[10px] font-black text-gray-400 font-heading tracking-wider mb-2">PARTICIPANTS ({req.participants.length})</div>
                      <div className="space-y-2">
                        {req.participants.map(p => (
                          <div key={p.email} className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-bold text-gray-700">{p.name}</div>
                              <div className="text-[10px] text-gray-500">{p.email}</div>
                            </div>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${p.role === 'LEADER' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'}`}>
                              {p.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RESOLVED SECTION */}
          {resolved.length > 0 && (
            <div className="space-y-4 pt-8 border-t border-gray-100">
              <h2 className="text-sm font-black text-gray-400 font-heading tracking-wide">Recently Resolved ({resolved.length})</h2>
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {resolved.slice(0, 20).map(req => (
                    <div key={req.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          req.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {req.status === 'APPROVED' ? <CheckCircleIcon className="w-4 h-4" /> : <BanIcon className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{req.team.name}</div>
                          <div className="text-xs text-gray-500">
                            {req.status === 'APPROVED' ? 'Approved' : 'Rejected'} at {req.resolved_at ? new Date(req.resolved_at).toLocaleString() : ''}
                          </div>
                          {req.status === 'REJECTED' && req.rejection_reason && (
                            <div className="text-xs text-red-600 mt-1 italic">Reason: {req.rejection_reason}</div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => navigate(`admin-team-${req.team_id}` as Page)} className="text-xs font-bold text-orange-600 hover:underline">
                        View Team
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <Modal title="Reject Verification" onClose={() => setRejectModal(null)} size="sm" footer={
          <>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button onClick={handleReject} disabled={saving || !rejectReason.trim()} className="!bg-red-600 hover:!bg-red-700 !text-white border-transparent">Confirm Rejection</Button>
          </>
        }>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Please provide a reason for rejecting this team. This will be shown to them.</p>
            <FormField label="Rejection Reason" required>
              <TextArea value={rejectReason} onChange={setRejectReason} placeholder="e.g. Missing required team members, invalid email domains..." rows={3} />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
