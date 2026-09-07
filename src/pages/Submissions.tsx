import { useState, useEffect } from 'react';
import { Card, Badge } from '../components/ui';
import { FileTextIcon } from '../components/icons';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';

interface SubmissionData {
  id: string;
  challenge_id: string;
  attempt_number: number;
  score: number;
  status: string;
  submitted_at: string;
  challenges: {
    round_id: string;
    title?: string;
  };
}

export default function Submissions() {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTeam) return;

    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vw_all_submissions')
          .select('*')
          .eq('team_id', currentTeam.id)
          .order('submitted_at', { ascending: false });

        if (!error && data) {
          setSubmissions(data as any);
        }
      } catch (e) {
        console.error("Error fetching submissions", e);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [currentTeam]);

  const totalScore = submissions.reduce((acc, sub) => acc + (sub.score || 0), 0);

  return (
    <div className="p-6">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          ['Total Submissions', submissions.length.toString()],
          ['Best Score', submissions.length > 0 ? Math.max(...submissions.map(s => s.score || 0)).toString() : '—'],
          ['Total Points Earned', totalScore.toString()]
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">{k}</div>
            <div className="text-2xl font-bold text-gray-900 font-heading">{v}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="px-5 py-3.5 border-b border-gray-50">
          <div className="text-sm font-bold text-gray-900 font-heading">Submission History</div>
          <div className="text-xs text-gray-400">Your submissions only. Previous attempts are preserved.</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                {['Challenge', 'Attempt', 'Score', 'Submitted At', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide font-heading">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-300">
                      <FileTextIcon className="w-10 h-10" />
                      <div className="text-gray-500 font-semibold font-heading">No submissions yet</div>
                      <div className="text-sm text-gray-400">Complete a round and submit your work to see it here.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr key={sub.id} className="border-t border-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.challenge_title || 'Unknown Challenge'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{sub.attempt_number}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 font-heading">{sub.score}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(sub.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sub.status === 'EVALUATED' ? 'success' : 'locked'}>
                        {sub.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 text-xs text-gray-400 text-center">
        You can only view your own submission history. Results are shown after official round closure.
      </div>
    </div>
  );
}
