import { useState, useEffect } from 'react';
import { Button, Modal, FormField, TextInput, TextArea, ConfirmDialog } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Page } from '../../components/Layout';
import { useAdminStore } from '../../stores/adminStore';
import { CheckCircleIcon, ShieldIcon, AlertTriangleIcon, TargetIcon } from '../../components/icons';

interface Submission {
  id: string;
  team_id: string;
  challenge_id: string;
  status: string;
  content: string;
  attempt_number: number;
  score: number | null;
  evaluation_result: any;
  submitted_at: string;
  source_table: string;
  team: { name: string };
  challenge: { title: string; type: string; base_points: number };
}

export default function SubmissionsReview({ navigate }: { navigate: (p: Page) => void }) {
  const { activeEvent } = useAdminStore();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const [reviewModal, setReviewModal] = useState<Submission | null>(null);
  const [reviewScore, setReviewScore] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSubmissions = async () => {
    if (!activeEvent) return;
    setLoading(true);

    // Get all teams in this event
    const { data: teams } = await supabase.from('teams').select('id, name').eq('event_id', activeEvent.id);
    if (!teams || teams.length === 0) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const teamIds = teams.map(t => t.id);
    const teamMap = new Map(teams.map(t => [t.id, t]));

    // Get all challenges in this event's rounds
    const { data: rounds } = await supabase.from('rounds').select('id').eq('event_id', activeEvent.id);
    const roundIds = (rounds || []).map(r => r.id);
    const { data: challenges } = await supabase.from('challenges').select('id, title, type, base_points').in('round_id', roundIds);
    const chalMap = new Map((challenges || []).map(c => [c.id, c]));

    // Get submissions that are EVALUATED or SUBMITTED
    const { data: subs } = await supabase
      .from('vw_all_submissions')
      .select('*')
      .in('team_id', teamIds)
      .in('status', ['SUBMITTED', 'EVALUATED'])
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (subs) {
      setSubmissions(subs.map(s => ({
        ...s,
        team: teamMap.get(s.team_id)!,
        challenge: chalMap.get(s.challenge_id)!
      })).filter(s => s.challenge)); // filter out any missing challenges
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
  }, [activeEvent]);

  const handleApplyReview = async () => {
    if (!reviewModal || !reviewScore) return;
    setSaving(true);
    
    const pointsDelta = parseInt(reviewScore);

    // If adjusting an already evaluated submission, we just insert a score event and optionally update the submission score.
    // If it's a new evaluation, we update the submission status to EVALUATED and its score.

    const newTotalScore = (reviewModal.score || 0) + pointsDelta;

    // 1. Update submission via RPC
    const { error: rpcError } = await supabase.rpc('admin_review_submission', {
      p_submission_id: reviewModal.id,
      p_source_table: reviewModal.source_table,
      p_score: reviewModal.status === 'SUBMITTED' ? pointsDelta : newTotalScore,
      p_review_reason: reviewReason || 'Manual Admin Review',
      p_admin_id: (await supabase.auth.getUser()).data.user?.id
    });
    
    if (rpcError) {
      console.error('Failed to update submission score:', rpcError);
    }

    // 2. Insert Score Event
    await supabase.from('score_events').insert({
      team_id: reviewModal.team_id,
      challenge_id: reviewModal.challenge_id,
      submission_id: reviewModal.id,
      event_type: reviewModal.status === 'SUBMITTED' ? 'BASE_SCORE' : 'ADMIN_ADJUSTMENT',
      points: pointsDelta,
      reason: reviewReason || 'Manual Admin Review'
    });

    // 3. Activity Log
    await supabase.from('activity_logs').insert({
      action: 'ADMIN_SCORE_ADJUSTMENT',
      team_id: reviewModal.team_id,
      details: { submission_id: reviewModal.id, points_delta: pointsDelta, reason: reviewReason }
    });

    setSaving(false);
    setReviewModal(null);
    setReviewScore('');
    setReviewReason('');
    await loadSubmissions();
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-gray-500">Please select an active event from the sidebar.</div>;
  }

  return (
    <div className="p-8 space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-heading">Submissions Review</h1>
          <p className="text-gray-500 text-sm mt-1">Manually grade submissions or adjust scores for {activeEvent.name}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[200px_200px_100px_100px_150px_1fr] px-6 py-4 border-b border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em] font-heading bg-gray-50/50">
          <span>Team</span>
          <span>Challenge</span>
          <span>Status</span>
          <span>Score</span>
          <span>Submitted</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400">Loading submissions...</div>
        ) : submissions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-2xl mb-2">📝</div>
            <div className="text-sm text-gray-500 font-medium">No recent submissions found</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[700px] overflow-y-auto">
            {submissions.map(s => (
              <div key={s.id} className="grid grid-cols-[200px_200px_100px_100px_150px_1fr] px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 pr-4">
                  <button onClick={() => navigate(`admin-team-${s.team_id}` as Page)} className="text-sm font-bold text-gray-900 hover:text-orange-600 truncate transition-colors text-left block w-full">
                    {s.team.name}
                  </button>
                  <div className="text-[10px] text-gray-400 mt-0.5">Attempt {s.attempt_number}</div>
                </div>
                
                <div className="min-w-0 pr-4">
                  <div className="text-sm font-bold text-gray-700 truncate">{s.challenge.title}</div>
                  <div className="text-[10px] font-mono text-gray-400 mt-0.5">{s.challenge.type} • {s.challenge.base_points} PTS</div>
                </div>
                
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black font-heading tracking-wider ${
                    s.status === 'EVALUATED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {s.status}
                  </span>
                </div>
                
                <div className="text-sm font-bold text-gray-900">
                  {s.score !== null ? s.score : '—'}
                </div>

                <div className="text-[11px] text-gray-500 font-mono">
                  {new Date(s.submitted_at).toLocaleString()}
                </div>

                <div className="flex items-center justify-end">
                  <Button variant="outline" className="text-xs py-1.5 px-3 h-auto" onClick={() => {
                    setReviewModal(s);
                    setReviewScore(s.status === 'SUBMITTED' ? s.challenge.base_points.toString() : '0');
                  }}>
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewModal && (
        <Modal title={`Review Submission: ${reviewModal.team.name}`} onClose={() => setReviewModal(null)} size="lg" footer={
          <>
            <Button variant="outline" onClick={() => setReviewModal(null)}>Cancel</Button>
            <Button onClick={handleApplyReview} disabled={saving || !reviewScore}>
              {reviewModal.status === 'SUBMITTED' ? 'Grade Submission' : 'Apply Adjustment'}
            </Button>
          </>
        }>
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">Challenge Information</div>
              <div className="text-sm font-bold text-gray-900">{reviewModal.challenge.title}</div>
              <div className="text-xs text-gray-500 mt-1">Type: {reviewModal.challenge.type} • Max Points: {reviewModal.challenge.base_points}</div>
            </div>

            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">Submission Payload</div>
              <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">{reviewModal.content}</pre>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <FormField label={reviewModal.status === 'SUBMITTED' ? 'Score to Award' : 'Points Adjustment (+/-)'} required>
                <TextInput type="number" value={reviewScore} onChange={setReviewScore} />
              </FormField>
              <FormField label="Reason (Optional)">
                <TextInput value={reviewReason} onChange={setReviewReason} placeholder="e.g. Creative bonus, late penalty" />
              </FormField>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
