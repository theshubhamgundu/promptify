import { useState, useEffect } from 'react';
import { ProgressBar, Card, SectionHeader } from '../components/ui';
import { TrendingUpIcon, TrophyIcon, ZapIcon, LightbulbIcon } from '../components/icons';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';

interface RoundData {
  round: string;
  score: number;
  max: number;
  status: 'upcoming' | 'active' | 'locked' | 'completed';
  color: string;
}

export default function MyProgress() {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const currentEvent = useEventStore(s => s.currentEvent);
  
  const [roundProgress, setRoundProgress] = useState<RoundData[]>([]);
  
  const [topicScores, setTopicScores] = useState([
    { topic: 'Prompt Engineering', score: 0, max: 100 },
    { topic: 'AI Fundamentals', score: 0, max: 100 },
    { topic: 'Problem Solving', score: 0, max: 100 },
    { topic: 'Code & Data', score: 0, max: 100 },
    { topic: 'Creativity', score: 0, max: 100 },
  ]);

  const [stats, setStats] = useState({
    hintsUsed: 0,
    roundsCompleted: 0,
    questionsAttempted: 0,
    promptsSubmitted: 0
  });

  useEffect(() => {
    if (!currentTeam || !currentEvent) return;

    const fetchProgress = async () => {
      // Fetch rounds
      const { data: rounds } = await supabase
        .from('rounds')
        .select('id, name, order_index')
        .eq('event_id', currentEvent.id)
        .order('order_index');

      if (!rounds) return;

      // Fetch round sessions
      const { data: sessions } = await supabase
        .from('round_sessions')
        .select('round_id, score, status')
        .eq('team_id', currentTeam.id);

      // Fetch submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, score, evaluation_result')
        .eq('team_id', currentTeam.id);

      // Process
      const newRoundProgress = rounds.map((r, i) => {
        const session = sessions?.find(s => s.round_id === r.id);
        const maxScore = 100; // Will be dynamic later
        return {
          round: r.name,
          score: session?.score || 0,
          max: maxScore,
          status: session?.status === 'COMPLETED' ? 'completed' : session?.status === 'ACTIVE' ? 'active' : 'locked',
          color: i % 2 === 0 ? 'orange' : 'amber'
        } as RoundData;
      });
      
      setRoundProgress(newRoundProgress);
      
      setStats({
        hintsUsed: 0,
        roundsCompleted: sessions?.filter(s => s.status === 'COMPLETED').length || 0,
        questionsAttempted: submissions?.length || 0,
        promptsSubmitted: submissions?.length || 0
      });
    };

    fetchProgress();
  }, [currentTeam, currentEvent]);

  const totalScore = roundProgress.reduce((acc, r) => acc + r.score, 0);
  const totalMax = roundProgress.reduce((acc, r) => acc + r.max, 0);

  return (
    <div className="p-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Score', value: `${totalScore}`, sub: `out of ${totalMax}`, icon: <TrophyIcon className="w-5 h-5 text-orange-500" />, highlight: true },
          { label: 'Current Rank', value: '—', sub: 'not yet ranked', icon: <TrendingUpIcon className="w-5 h-5 text-gray-400" />, highlight: false },
          { label: 'Speed Bonuses', value: '0', sub: 'earned', icon: <ZapIcon className="w-5 h-5 text-amber-500" />, highlight: false },
          { label: 'Hints Used', value: '0', sub: 'total deductions: 0', icon: <LightbulbIcon className="w-5 h-5 text-amber-500" />, highlight: false },
        ].map((s) => (
          <Card key={s.label} className={`p-4 ${s.highlight ? 'border-orange-100 bg-orange-50' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
              <div>
                <div className="text-[11px] text-gray-400 uppercase tracking-wide">{s.label}</div>
                <div className={`text-2xl font-bold font-heading ${s.highlight ? 'text-orange-600' : 'text-gray-900'}`}>{s.value}</div>
                <div className="text-xs text-gray-400">{s.sub}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* Left */}
        <div className="space-y-5">
          {/* Round Progress */}
          <Card className="p-5">
            <SectionHeader title="Round Progress" />
            <div className="space-y-4">
              {roundProgress.map((r, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-heading ${
                        r.status === 'upcoming' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>{i + 1}</span>
                      <span className="font-medium text-gray-700">{r.round}</span>
                    </div>
                    <span className={`font-bold font-heading ${r.score > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                      {r.score}/{r.max}
                    </span>
                  </div>
                  <ProgressBar value={r.score} max={r.max} color={r.color as 'orange' | 'violet' | 'amber'} />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <div className="flex items-center gap-2">
                <ProgressBar value={totalScore} max={totalMax} color="orange" className="w-32" />
                <span className="font-bold text-gray-900 font-heading">{totalScore}/{totalMax}</span>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Rounds Completed', value: `${stats.roundsCompleted} / ${roundProgress.length || 5}` },
              { label: 'Questions Attempted', value: stats.questionsAttempted.toString() },
              { label: 'Prompts Submitted', value: stats.promptsSubmitted.toString() },
              { label: 'Puzzles Solved', value: stats.questionsAttempted.toString() }, 
              { label: 'Accuracy', value: stats.questionsAttempted > 0 ? `${Math.round((stats.promptsSubmitted / stats.questionsAttempted) * 100)}%` : '—' },
              { label: 'Avg Response Time', value: '—' },
            ].map((s) => (
              <Card key={s.label} className="p-4 text-center">
                <div className="text-xl font-bold text-gray-900 font-heading">{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Timeline */}
          <Card className="p-5">
            <SectionHeader title="Activity Timeline" />
            <div className="text-sm text-gray-400 text-center py-8">
              No activity yet. Complete your first round to see timeline.
            </div>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-5">
          {/* Skill breakdown */}
          <Card className="p-5">
            <SectionHeader title="Skill Breakdown" />
            <div className="space-y-3">
              {topicScores.map((t) => (
                <div key={t.topic}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{t.topic}</span>
                    <span className="font-semibold text-gray-400">—</span>
                  </div>
                  <ProgressBar value={t.score} max={t.max} />
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-gray-400 text-center">Skills unlock as you complete rounds.</div>
          </Card>

          {/* Score chart (visual bars) */}
          <Card className="p-5">
            <SectionHeader title="Score vs Max" />
            <div className="flex items-end gap-2 h-32 mt-2">
              {roundProgress.map((r, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex-1 w-full relative flex items-end">
                    <div className="w-full bg-gray-100 rounded-t-sm h-full" />
                    {r.score > 0 && (
                      <div
                        className="absolute bottom-0 w-full bg-orange-400 rounded-t-sm transition-all"
                        style={{ height: `${(r.score / r.max) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400">{i + 1}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px]">
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400" /> Your score</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100" /> Maximum</div>
            </div>
          </Card>

          {/* Insights */}
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
            <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 font-heading">Tips</div>
            <div className="space-y-2 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0">💡</span>
                Complete Round 1 first to unlock subsequent rounds.
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0">⚡</span>
                Look for speed bonuses in Rounds 2 and 3.
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0">🎯</span>
                Use hints sparingly — they reduce available score.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
