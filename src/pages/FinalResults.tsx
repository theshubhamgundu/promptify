import { useState, useEffect } from 'react';
import type { Page } from '../components/Layout';
import { TrophyIcon, StarIcon, CheckCircleIcon, ArrowRightIcon } from '../components/icons';
import { Button, Card, ProgressBar, AnimatedNumber } from '../components/ui';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { LeaderboardEngine } from '../lib/leaderboard-engine';
import { CertificateService } from '../lib/services/certificateService';
import type { CertificateRecord } from '../lib/types';
import { supabase } from '../lib/supabase';

const categories = [
  { label: 'Prompt Quality',     value: 0, icon: '✍️' },
  { label: 'AI Utilization',     value: 0, icon: '🤖' },
  { label: 'Problem Solving',    value: 0, icon: '🧩' },
  { label: 'Speed & Efficiency', value: 0, icon: '⚡' },
  { label: 'Accuracy',           value: 0, icon: '🎯' },
];

export default function FinalResults({ navigate }: { navigate: (p: Page) => void }) {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const currentEvent = useEventStore(s => s.currentEvent);

  const [revealed, setRevealed] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [rank, setRank] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [roundScores, setRoundScores] = useState<any[]>([]);
  const [top3, setTop3] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [maxTotal, setMaxTotal] = useState(0);
  const [teamCert, setTeamCert] = useState<CertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentTeam || !currentEvent) return;

      const lb = await LeaderboardEngine.getLeaderboard(currentEvent.id);
      setTotalParticipants(lb.length);
      const myRank = lb.find(e => e.teamId === currentTeam.id)?.rank || 0;
      setRank(myRank);

      const cert = await CertificateService.getCertificateForTeam(currentEvent.id, currentTeam.id);
      setTeamCert(cert);
      
      const top3Teams = lb.slice(0, 3).map(l => ({
        rank: l.rank,
        name: l.name,
        score: l.score
      }));
      setTop3(top3Teams);

      const { data: rounds } = await supabase
        .from('rounds')
        .select('id, name, order_index')
        .eq('event_id', currentEvent.id)
        .order('order_index');

      const { data: sessions } = await supabase
        .from('round_sessions')
        .select('round_id, score')
        .eq('team_id', currentTeam.id);

      if (rounds) {
        let t = 0;
        let mt = 0;
        const processed = rounds.map((r, i) => {
          const s = sessions?.find(session => session.round_id === r.id);
          const sCore = s?.score || 0;
          const max = 100; // Will be dynamic
          t += sCore;
          mt += max;
          return {
            round: r.order_index,
            name: r.name,
            score: sCore,
            max: max,
            color: i % 2 === 0 ? 'orange' : 'amber'
          };
        });
        setRoundScores(processed);
        setTotal(t);
        setMaxTotal(mt);
      }

      setLoading(false);
      setTimeout(() => { setRevealed(true); setConfetti(true); }, 400);
    }
    loadData();
  }, [currentTeam, currentEvent]);

  if (loading) return <div className="p-6">Calculating final results...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Hero result banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-8 text-white mb-6 text-center">
        {/* Confetti dots */}
        {confetti && Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full opacity-70 animate-fade-in"
            style={{
              background: ['#fff', '#fef3c7', '#d1fae5', '#fee2e2'][i % 4],
              left: `${(i * 5.3) % 100}%`,
              top: `${(i * 7.1) % 100}%`,
              animationDelay: `${i * 80}ms`,
              transform: `scale(${0.5 + (i % 3) * 0.4})`,
            }}
          />
        ))}

        <div className="relative z-10">
          <div className="text-5xl mb-3 animate-pop-in">🏆</div>
          <div className="text-white/70 text-sm font-bold uppercase tracking-widest mb-1 font-heading">Championship Complete</div>
          <h1 className="text-4xl font-black font-heading mb-2">{currentTeam?.name || 'Your Team'}</h1>
          <div className="text-white/80 text-lg mb-5">Ranked <strong className="text-white text-2xl">#{rank}</strong> of {totalParticipants} teams</div>

          <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur rounded-2xl px-6 py-3">
            <div className="text-center">
              <div className="text-[11px] text-white/70 uppercase tracking-wide font-heading">Final Score</div>
              <div className="text-4xl font-black tabular-nums">
                {revealed ? <AnimatedNumber to={total} duration={1200} /> : 0}
              </div>
              <div className="text-white/60 text-sm">out of {maxTotal}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Round breakdown */}
          <Card className="p-5">
            <h3 className="text-sm font-black text-gray-900 font-heading mb-4">Score Breakdown by Round</h3>
            <div className="space-y-4">
              {roundScores.map((r, i) => (
                <div
                  key={r.round}
                  className="animate-slide-right"
                  style={{ animationDelay: `${i * 100 + 400}ms` }}
                >
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black font-heading ${
                        r.round === 5 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {r.round}
                      </div>
                      <span className="font-semibold text-gray-700">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-gray-900 font-heading text-base">{r.score}</span>
                      <span className="text-gray-400 text-xs">/ {r.max}</span>
                      <span className="text-[11px] font-bold text-green-600 bg-green-50 border border-green-100 rounded-full px-1.5 py-0.5">
                        {Math.round((r.score / r.max) * 100)}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={r.score} max={r.max} color={r.color as 'orange' | 'violet' | 'amber'} />
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Total</span>
              <div className="flex items-center gap-2">
                <ProgressBar value={total} max={maxTotal} color="orange" className="w-40" />
                <span className="font-black text-orange-600 font-heading text-lg">{total}</span>
                <span className="text-gray-400 text-sm">/ {maxTotal}</span>
              </div>
            </div>
          </Card>

          {/* Skill scores removed as they depend on categorical tagging not yet in schema */}

          {/* Achievements */}
          <Card className="p-5">
            <h3 className="text-sm font-black text-gray-900 font-heading mb-4">Achievements Unlocked</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { emoji: '🧠', label: 'AI Scholar', desc: 'Scored 70%+ on AI IQ' },
                { emoji: '⚡', label: 'Speed Demon', desc: 'Earned speed bonus' },
                { emoji: '🔓', label: 'Escape Artist', desc: 'Completed all 4 puzzles' },
                { emoji: '🛡️', label: 'Survivor', desc: 'Passed adversarial tests' },
                { emoji: '🎯', label: 'Grandmaster', desc: 'Completed all 5 rounds' },
                { emoji: '🏆', label: 'Top 5 Finish', desc: 'Ranked in top 5' },
              ].map((a, i) => (
                <div
                  key={a.label}
                  className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-3 text-center animate-pop-in"
                  style={{ animationDelay: `${i * 80 + 800}ms` }}
                >
                  <div className="text-2xl mb-1">{a.emoji}</div>
                  <div className="text-xs font-black text-gray-900 font-heading">{a.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{a.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Final rank card */}
          <Card className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100 text-center">
            <TrophyIcon className="w-8 h-8 text-orange-500 mx-auto mb-3" />
            <div className="text-[10px] text-orange-500 font-black uppercase tracking-widest font-heading mb-1">Final Ranking</div>
            <div className="text-6xl font-black text-orange-500 font-heading leading-none mb-1">
              #{revealed ? <AnimatedNumber to={rank} duration={600} /> : rank}
            </div>
            <div className="text-sm text-gray-500">out of {totalParticipants} teams</div>
            <div className="mt-3 pt-3 border-t border-orange-100">
              <div className="text-xs text-gray-500">{Math.max(0, rank - 1)} teams ahead · {Math.max(0, totalParticipants - rank)} behind</div>
            </div>
          </Card>

          {/* Top 3 mini leaderboard */}
          <Card className="p-4">
            <div className="text-[11px] font-black text-orange-500 uppercase tracking-widest mb-3 font-heading">Top 3 Teams</div>
            <div className="space-y-2">
              {top3.map((t) => (
                <div key={t.rank} className={`flex items-center gap-3 p-2.5 rounded-xl ${t.rank === 1 ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black font-heading ${
                    t.rank === 1 ? 'bg-orange-500 text-white' :
                    t.rank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-amber-200 text-amber-700'
                  }`}>{t.rank}</div>
                  <span className="text-sm font-semibold text-gray-800 flex-1">{t.name}</span>
                  <span className="text-sm font-black text-gray-900 font-heading">{t.score}</span>
                </div>
              ))}
              {rank > 3 && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-orange-50 border border-dashed border-orange-200">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black font-heading bg-orange-100 text-orange-600">{rank}</div>
                  <span className="text-sm font-bold text-orange-700 flex-1">{currentTeam?.name || 'You'}</span>
                  <span className="text-sm font-black text-orange-600 font-heading">{total}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Verdict */}
          <Card className="p-4 bg-gray-900 border-0">
            <div className="text-[11px] text-gray-400 font-black uppercase tracking-widest mb-2 font-heading">Overall Verdict</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Excellent performance across all rounds. Your prompt engineering depth and AI problem-solving skills placed you in the <span className="text-orange-400 font-bold">top {totalParticipants > 0 ? Math.round((rank / totalParticipants) * 100) : 100}%</span> of all participants.
            </p>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={() => navigate('leaderboard')} variant="outline" className="w-full justify-between">
              Full Leaderboard <ArrowRightIcon className="w-4 h-4" />
            </Button>
            <Button onClick={() => navigate('progress')} className="w-full justify-between">
              My Progress Report <ArrowRightIcon className="w-4 h-4" />
            </Button>
            <Button onClick={() => navigate('submissions')} variant="outline" className="w-full justify-between">
              All Submissions <ArrowRightIcon className="w-4 h-4" />
            </Button>
          </div>

          {/* Dynamic Certificate Status */}
          {rank <= 5 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">🏆</div>
              <div className="text-xs font-black text-amber-900 font-heading uppercase tracking-wider">Top 5 Finish — Physical Certificate</div>
              <p className="text-[11px] text-amber-800 mt-1">
                Congratulations! As a Top 5 team, your official physical certificate will be awarded at the ceremony.
              </p>
            </div>
          ) : teamCert ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center space-y-2">
              <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
              <div className="text-xs font-black text-green-900 font-heading">
                {teamCert.certificate_type.replace('_', ' ')} E-Certificate Ready
              </div>
              <div className="text-[10px] text-green-700 font-mono">ID: {teamCert.certificate_id}</div>
              <a
                href={teamCert.verification_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm font-heading"
              >
                Verify & View Certificate QR →
              </a>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto mb-1.5" />
              <div className="text-xs font-bold text-green-800 font-heading">
                E-Certificate will be automatically issued once scores are finalized.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
