import { useState, useMemo } from 'react';
import type { Page } from '../components/Layout';
import {
  BrainIcon, PuzzleIcon, SwordsIcon, CrownIcon, TargetIcon,
  ArrowRightIcon, LockIcon, BellIcon, TrophyIcon, UsersIcon,
  ZapIcon, CheckIcon, AlertTriangleIcon, ClockIcon,
} from '../components/icons';
import { Badge, Card, Button, SectionHeader, ProgressBar } from '../components/ui';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';

interface Round {
  id: string | number;
  key: string;
  name: string;
  sub: string;
  desc: string;
  status: 'upcoming' | 'live' | 'locked' | 'completed';
  maxScore: number;
  duration: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const getIconForType = (type: string) => {
  switch (type) {
    case 'KNOWLEDGE_TEST': return BrainIcon;
    case 'PROMPT_CHALLENGE': return TargetIcon;
    case 'PUZZLE': return PuzzleIcon;
    case 'BATTLE_ROYALE': return SwordsIcon;
    default: return CrownIcon;
  }
};



const importantRules = [
  { icon: <AlertTriangleIcon className="w-4 h-4 text-red-400"  />, text: 'Limited attempts apply to selected challenges.'        },
  { icon: <ZapIcon           className="w-4 h-4 text-amber-500"/>, text: 'Speed bonuses available on some rounds.'               },
  { icon: <AlertTriangleIcon className="w-4 h-4 text-amber-500"/>, text: 'Wrong attempts may cost you points in some challenges.' },
  { icon: <CheckIcon         className="w-4 h-4 text-green-500"/>, text: 'Follow the rules. Be fair. Have fun!'                  },
];

const steps = [
  { num: '01', label: 'Read the problem carefully',      emoji: '📖' },
  { num: '02', label: 'Use AI wisely (BYOK Allowed)',    emoji: '🧠' },
  { num: '03', label: 'Submit within attempts',          emoji: '🚀' },
  { num: '04', label: 'Earn score & climb the leaderboard', emoji: '🏆' },
];

export default function Dashboard({ navigate }: { navigate: (p: Page) => void }) {
  const [hoveredRound, setHoveredRound] = useState<number | null>(null);
  
  const currentTeam = useTeamStore(s => s.currentTeam);
  const members = useTeamStore(s => s.members);
  const dbRounds = useEventStore(s => s.rounds);
  
  const teamName = currentTeam?.name || 'Your Team';

  const mappedRounds: Round[] = useMemo(() => {
    return dbRounds.map((r, idx) => ({
      id: r.order_index,
      key: `round${r.order_index}`,
      name: r.name,
      sub: r.type,
      desc: r.description || '',
      status: r.is_active ? 'upcoming' : 'locked', // We will update this later when we integrate round sessions
      maxScore: 100, // Hardcoded max score per round for now
      duration: `${r.duration_minutes} min`,
      Icon: getIconForType(r.type),
    }));
  }, [dbRounds]);

  return (
    <div className="p-6 space-y-5">
      {/* ── Top stat strip ───────────────────────────────── */}
      <div className="grid grid-cols-[1fr_280px] gap-5">
        <div className="space-y-5">
          {/* Hero banner */}
          <Card className="overflow-hidden animate-slide-up stagger-1">
            <div className="flex min-h-[180px]">
              {/* Left content */}
              <div className="flex-1 p-7 bg-gradient-to-br from-amber-50 via-orange-50/60 to-white relative overflow-hidden">
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-[0.03]">
                  {Array.from({length: 6}).map((_, r) => Array.from({length: 8}).map((_, c) => (
                    <div
                      key={`${r}-${c}`}
                      className="absolute w-6 h-6 border border-orange-500 rounded"
                      style={{ left: c * 48 - 20, top: r * 48 - 20, transform: 'rotate(30deg)' }}
                    />
                  )))}
                </div>

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 bg-orange-100 border border-orange-200 rounded-full px-2.5 py-1 text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 font-heading">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 live-dot" />
                    Live Event
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 font-heading leading-tight mb-1">
                    PROMPT ENGINEERING<br />
                    <span className="gradient-text">CHAMPIONSHIP</span>
                  </h2>
                  <p className="text-gray-500 text-sm mb-1">A battle of creativity, logic, and AI mastery.</p>
                  <p className="text-gray-400 text-sm mb-5">Use your prompts wisely. Outthink. Outperform. Outrank.</p>
                  <Button onClick={() => navigate('rounds')} className="group">
                    View Event Details
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </Button>
                </div>
              </div>

              {/* AI Illustration panel */}
              <div className="w-56 flex-shrink-0 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center relative overflow-hidden">
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-20">
                  {Array.from({length: 25}).map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-orange-400"
                      style={{ left: `${(i % 5) * 25 + 10}%`, top: `${Math.floor(i / 5) * 22 + 5}%` }}
                    />
                  ))}
                </div>

                <svg viewBox="0 0 160 180" className="w-44 h-44 relative z-10">
                  {/* Code symbols floating */}
                  <text x="8"  y="32" fontSize="11" fill="#f97316" opacity="0.5" fontFamily="monospace">{'</>'}</text>
                  <text x="120" y="28" fontSize="10" fill="#ea580c" opacity="0.4" fontFamily="monospace">{'{ }'}</text>
                  <text x="128" y="88" fontSize="9"  fill="#f97316" opacity="0.5" fontFamily="monospace">AI</text>
                  <text x="6"  y="120" fontSize="9"  fill="#ea580c" opacity="0.4" fontFamily="monospace">∑</text>

                  {/* Robot body */}
                  <rect x="40" y="82" width="80" height="75" rx="14" fill="#f97316"/>
                  <rect x="44" y="86" width="72" height="71" rx="12" fill="#ea580c" opacity="0.4"/>

                  {/* Head */}
                  <rect x="45" y="42" width="70" height="50" rx="12" fill="#ea580c"/>
                  <rect x="48" y="45" width="64" height="47" rx="10" fill="#f97316" opacity="0.5"/>

                  {/* Visor */}
                  <rect x="52" y="52" width="56" height="22" rx="6" fill="#1f2937" opacity="0.9"/>

                  {/* Eyes inside visor */}
                  <circle cx="68" cy="63" r="6" fill="#f97316"/>
                  <circle cx="92" cy="63" r="6" fill="#f97316"/>
                  <circle cx="70" cy="64" r="3" fill="#fff"/>
                  <circle cx="94" cy="64" r="3" fill="#fff"/>

                  {/* Mouth */}
                  <rect x="62" y="80" width="36" height="5" rx="2.5" fill="white" opacity="0.5"/>

                  {/* Antenna */}
                  <line x1="80" y1="42" x2="80" y2="26" stroke="#ea580c" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="80" cy="22" r="6" fill="#f97316"/>
                  <circle cx="80" cy="22" r="3" fill="white" opacity="0.7"/>

                  {/* Chest panel */}
                  <rect x="54" y="96" width="52" height="36" rx="8" fill="#c2410c" opacity="0.6"/>
                  <rect x="60" y="103" width="14" height="6" rx="3" fill="white" opacity="0.9"/>
                  <rect x="86" y="103" width="14" height="6" rx="3" fill="white" opacity="0.9"/>
                  <rect x="60" y="116" width="40" height="4" rx="2" fill="white" opacity="0.4"/>

                  {/* Arms */}
                  <rect x="16" y="88" width="24" height="48" rx="10" fill="#f97316"/>
                  <rect x="120" y="88" width="24" height="48" rx="10" fill="#f97316"/>
                  <rect x="13" y="120" width="28" height="14" rx="7" fill="#ea580c"/>
                  <rect x="119" y="120" width="28" height="14" rx="7" fill="#ea580c"/>

                  {/* Legs */}
                  <rect x="52" y="154" width="22" height="20" rx="8" fill="#ea580c"/>
                  <rect x="86" y="154" width="22" height="20" rx="8" fill="#ea580c"/>

                  {/* Chat bubble */}
                  <rect x="100" y="42" width="44" height="28" rx="8" fill="white" opacity="0.9"/>
                  <path d="M108 70 L104 76 L112 70" fill="white" opacity="0.9"/>
                  <circle cx="112" cy="56" r="3" fill="#f97316"/>
                  <circle cx="122" cy="56" r="3" fill="#f97316"/>
                  <circle cx="132" cy="56" r="3" fill="#f97316"/>
                </svg>
              </div>
            </div>
          </Card>

          {/* ── Event Rounds ─────────────────────────────── */}
          <div className="animate-slide-up stagger-2">
            <SectionHeader
              icon={<TargetIcon className="w-4 h-4" />}
              title="Event Rounds"
              action={
                <button onClick={() => navigate('rounds')} className="text-xs text-orange-500 font-bold font-heading hover:underline">
                  View All →
                </button>
              }
            />
            <div className="grid grid-cols-5 gap-2.5">
              {mappedRounds.map((round, i) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  hovered={hoveredRound === i}
                  onHover={() => setHoveredRound(i)}
                  onLeave={() => setHoveredRound(null)}
                  onClick={() => { if (round.status !== 'locked') navigate(`generic-round`); }}
                  animDelay={i * 60}
                />
              ))}
            </div>
          </div>

          {/* ── How it works + Rules ─────────────────────── */}
          <div className="grid grid-cols-2 gap-4 animate-slide-up stagger-3">
            {/* How it works */}
            <Card className="p-5">
              <SectionHeader title="How It Works" />
              <div className="space-y-2.5">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-50 transition-colors duration-150 group"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                      <span className="text-base">{step.emoji}</span>
                    </div>
                    <div>
                      <div className="text-[10px] text-orange-400 font-black uppercase tracking-widest font-heading">{step.num}</div>
                      <div className="text-xs font-semibold text-gray-700 leading-tight">{step.label}</div>
                    </div>
                    {i < steps.length - 1 && (
                      <ArrowRightIcon className="w-3.5 h-3.5 text-gray-200 ml-auto flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Important rules */}
            <Card className="p-5">
              <SectionHeader title="Important" />
              <div className="space-y-3">
                {importantRules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {rule.icon}
                    </div>
                    <span className="text-sm text-gray-600 leading-snug">{rule.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Team Members */}
          <Card className="p-4 animate-slide-left stagger-1">
            <SectionHeader icon={<UsersIcon className="w-4 h-4" />} title="Team Roster" />
            <div className="text-sm font-black text-gray-900 font-heading mb-3">{teamName}</div>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className={`w-9 h-9 ${m.role === 'CAPTAIN' ? 'bg-orange-500' : 'bg-violet-500'} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                    <span className="text-white text-sm font-black font-heading">{m.name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 leading-tight truncate">{m.name}</div>
                  </div>
                  <Badge variant={m.role === 'CAPTAIN' ? 'orange' : 'info'}>{m.role}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50 space-y-1">
              <div className="text-[11px] text-green-600 font-semibold">✓ Device Verified</div>
              <div className="text-[11px] text-green-600 font-semibold">✓ Secure Session Active</div>
            </div>
          </Card>



          {/* Current Rank */}
          <Card className="p-4 animate-slide-left stagger-3">
            <SectionHeader icon={<TrophyIcon className="w-4 h-4" />} title="Your Current Rank" />
            <div className="flex items-center gap-3 py-2">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-black text-gray-200 font-heading">—</span>
              </div>
              <div>
                <div className="font-bold text-gray-700 font-heading">Not Yet Ranked</div>
                <div className="text-xs text-gray-400 mt-0.5">Complete a round to appear on the leaderboard.</div>
              </div>
            </div>
            <Button onClick={() => navigate('leaderboard')} variant="outline" className="w-full mt-2 text-xs py-2">
              View Leaderboard →
            </Button>
          </Card>

          {/* Trophy motivational */}
          <Card className="p-4 overflow-hidden relative animate-slide-left stagger-4 bg-gradient-to-br from-amber-50 to-orange-50 border-orange-100">
            <div className="relative z-10 text-center">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-sm text-gray-600 mb-0.5">Every prompt is a move.</div>
              <div className="text-base font-black text-orange-600 font-heading">Make it count!</div>
            </div>
            {/* Decorative */}
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-orange-200/30 rounded-full" />
            <div className="absolute -left-2 -top-2 w-12 h-12 bg-amber-200/30 rounded-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Round Card ────────────────────────────────────────────────────────
function RoundCard({ round, hovered, onClick, onHover, onLeave, animDelay }: {
  round: Round; hovered: boolean; onClick: () => void;
  onHover: () => void; onLeave: () => void; animDelay: number;
}) {
  const locked = round.status === 'locked';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`
        rounded-2xl border p-3 cursor-pointer transition-all duration-200 animate-slide-up
        ${hovered && !locked
          ? 'border-orange-300 bg-orange-50 shadow-md shadow-orange-100 -translate-y-0.5'
          : locked
          ? 'border-gray-100 bg-white opacity-75'
          : 'border-gray-100 bg-white hover:border-orange-200'}
      `}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      {/* Round badge + status */}
      <div className="flex items-center justify-between mb-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black font-heading transition-all ${
          locked ? 'bg-gray-800 text-white' : hovered ? 'bg-orange-500 text-white scale-110' : 'bg-orange-500 text-white'
        }`}>
          {round.id}
        </div>
        {locked
          ? <LockIcon className="w-3.5 h-3.5 text-gray-300" />
          : round.status === 'live'
          ? <span className="w-2 h-2 rounded-full bg-green-500 live-dot" />
          : null
        }
      </div>

      {/* Icon */}
      <div className={`flex justify-center mb-2 transition-all duration-200 ${locked ? 'opacity-30' : hovered ? 'scale-110 text-orange-500' : 'text-orange-400'}`}>
        <round.Icon className="w-7 h-7" />
      </div>

      {/* Name */}
      <div className="text-center mb-2">
        <div className="text-sm font-black text-gray-900 font-heading leading-tight">{round.name}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{round.sub}</div>
      </div>

      {/* Status pill */}
      <div className="flex justify-center mb-2">
        {locked
          ? <Badge variant="locked">LOCKED</Badge>
          : <Badge variant={round.status === 'live' ? 'live' : 'upcoming'}>{round.status.toUpperCase()}</Badge>
        }
      </div>

      <div className="text-[10px] text-gray-400 text-center leading-tight mb-2.5 line-clamp-2">
        {round.desc}
      </div>

      {/* Meta */}
      <div className="border-t border-gray-50 pt-2 grid grid-cols-2 gap-1 text-center">
        <div>
          <div className="text-[9px] text-gray-400 font-heading">Duration</div>
          <div className="text-[10px] font-bold text-gray-600">{round.duration}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 font-heading">Max Score</div>
          <div className="text-sm font-black text-orange-500 font-heading">{round.maxScore}</div>
        </div>
      </div>
    </div>
  );
}
