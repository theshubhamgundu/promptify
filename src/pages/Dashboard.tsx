import { useState, useMemo } from 'react';
import type { Page } from '../components/Layout';
import {
  BrainIcon, PuzzleIcon, SwordsIcon, CrownIcon, TargetIcon,
  ArrowRightIcon, LockIcon, BellIcon, TrophyIcon, UsersIcon,
  ZapIcon, CheckIcon, AlertTriangleIcon, ClockIcon, EyeIcon, ShieldIcon
} from '../components/icons';
import { Badge, Card, Button, SectionHeader, ProgressBar } from '../components/ui';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { BYOKConnect, BYOKConnected } from '../components/BYOKConnect';
import { AITestChat } from '../components/AITestChat';
import { byokSession, AIProvider, BYOKConfig } from '../lib/byok-service';
import { sounds } from '../lib/sound';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Round {
  id: string | number;
  key: string;
  name: string;
  sub: string;
  desc: string;
  status: 'upcoming' | 'live' | 'locked' | 'completed';
  maxScore: number;
  duration: string;
  type?: string;
  orderIndex: number;
  Icon: React.ComponentType<{ className?: string }>;
}

const getIconForType = (type: string) => {
  switch (type) {
    case 'QUIZ':
    case 'KNOWLEDGE_TEST': return BrainIcon;
    case 'PROMPT':
    case 'PROMPT_CHALLENGE': return TargetIcon;
    case 'VISION_CHALLENGE': return EyeIcon;
    case 'AI_ADVERSARIAL': return ShieldIcon;
    case 'AI_SYSTEMS': return ZapIcon;
    case 'BATTLE_ROYALE': return ShieldIcon;
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
  
  // BYOK State
  const [showBYOKConnect, setShowBYOKConnect] = useState(false);
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);
  
  useEffect(() => {
    // Check if we already have any provider keys configured
    const providers: AIProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'MISTRAL', 'GROQ', 'COHERE'];
    const found = providers.find(p => byokSession.hasKey(p));
    if (found) {
      setActiveProvider(found);
    }
  }, []);
  
  const currentTeam = useTeamStore(s => s.currentTeam);
  const members = useTeamStore(s => s.members);
  const currentEvent = useEventStore(s => s.currentEvent);
  const dbRounds = useEventStore(s => s.rounds);
  const setRounds = useEventStore(s => s.setRounds);
  
  // Track completed rounds for current team
  const [completedRounds, setCompletedRounds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    async function refreshRounds() {
      if (currentEvent?.id) {
        const { data } = await supabase.from('rounds').select('*').eq('event_id', currentEvent.id).order('order_index');
        if (data) {
          setRounds(data as any);
        }
      }
    }
    refreshRounds();
  }, [currentEvent?.id, setRounds]);
  
  // Fetch completed rounds for current team
  useEffect(() => {
    async function fetchCompletedRounds() {
      if (currentTeam?.id) {
        const { data } = await supabase
          .from('round_sessions')
          .select('round_id')
          .eq('team_id', currentTeam.id)
          .eq('status', 'COMPLETED');
        
        if (data) {
          setCompletedRounds(new Set(data.map(rs => rs.round_id)));
        } else {
          setCompletedRounds(new Set());
        }
      }
    }
    fetchCompletedRounds();
    
    // Set up real-time subscription to round_sessions
    const channel = supabase
      .channel(`dashboard-rounds-${currentTeam?.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round_sessions',
        filter: `team_id=eq.${currentTeam?.id}`
      }, () => {
        console.log('Round sessions changed, refreshing...');
        fetchCompletedRounds();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTeam?.id]);
  
  const teamName = currentTeam?.name || 'Your Team';

  const mappedRounds: Round[] = useMemo(() => {
    return dbRounds.map((r, idx) => {
      const isCompleted = completedRounds.has(r.id);
      return {
        id: r.id, // Use actual UUID for navigation
        key: `round${r.order_index}`,
        name: r.name,
        sub: r.type,
        type: r.type, // Added to use in onClick
        orderIndex: r.order_index,
        desc: r.description || '',
        status: isCompleted ? 'completed' : (r.is_active ? 'upcoming' : 'locked'),
        maxScore: r.challenges?.length > 0 ? r.challenges.reduce((sum: number, c: any) => sum + (c.base_points || 0), 0) : 200, // Sum of challenge base_points; falls back to 200
        duration: `${r.duration_minutes} min`,
        Icon: getIconForType(r.type),
      };
    });
  }, [dbRounds, completedRounds]);

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
            <div className="grid grid-cols-5 gap-4 lg:gap-5">
              {mappedRounds.map((round, i) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  hovered={hoveredRound === i}
                  onHover={() => setHoveredRound(i)}
                  onLeave={() => setHoveredRound(null)}
                  onClick={() => { 
                    if (round.status === 'locked') {
                      sounds.error();
                      return;
                    }
                    if (round.status === 'completed') {
                      sounds.error();
                      // Round already completed - admin can reset if needed
                      return;
                    }
                    
                    sounds.start();
                    if (round.type === 'QUIZ' || round.type === 'KNOWLEDGE_TEST') {
                        navigate(`quiz-${round.id}` as any);
                      } else if (round.type === 'ROUND2_HEIST' || round.title?.includes('Round 2') || round.title?.includes('Prompt Heist')) {
                        navigate(`round2-heist-${round.id}` as any);
                      } else if (round.type === 'PROMPT' || round.type === 'PROMPT_CHALLENGE') {
                        navigate(`prompt-heist-${round.id}` as any);
                      } else if (round.type === 'VISION_CHALLENGE') {
                        navigate(`vision-${round.id}` as any);
                      } else if (round.type === 'AI_ADVERSARIAL' || round.type === 'ADVERSARIAL_CHALLENGE') {
                        navigate(`round4-${round.id}` as any);
                      } else if (round.type === 'AI_SYSTEMS' || round.type === 'SYSTEMS_CHALLENGE') {
                        navigate(`round5-${round.id}` as any);
                      } else {
                        navigate(`round-${round.id}` as any);
                      }
                  }}
                  animDelay={i * 60}
                />
              ))}
            </div>
          </div>


        </div>

        {/* ── Right sidebar ─────────────────────────────── */}
        <div className="space-y-4">
          {/* BYOK Configuration Card */}
          <Card className="p-4 animate-slide-left stagger-1 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <SectionHeader icon={<ZapIcon className="w-4 h-4 text-indigo-600" />} title="AI Tools Config" />
            
            {activeProvider ? (
              <div className="mt-3 space-y-3">
                <BYOKConnected 
                  provider={activeProvider} 
                  onDisconnect={() => {
                    byokSession.clearKey(activeProvider);
                    setActiveProvider(null);
                  }} 
                />
                
                {/* Test Chat */}
                <AITestChat provider={activeProvider} />
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Some stages require your own API key to use LLMs. Configure it now to save time later.
                </p>
                <Button 
                  onClick={() => setShowBYOKConnect(true)} 
                  variant="outline" 
                  className="w-full text-xs py-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                >
                  Connect API Key →
                </Button>
              </div>
            )}
          </Card>

          {/* Trophy motivational */}
          <Card className="p-5 overflow-hidden relative animate-slide-left stagger-2 bg-gradient-to-br from-amber-50 to-orange-50 border-orange-100">
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
      
      {showBYOKConnect && (
        <BYOKConnect 
          config={{ 
            enabled: true, 
            required_providers: ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ', 'MISTRAL', 'COHERE'],
            allowed_models: [], max_requests: 50, max_tokens_per_request: 1000, 
            max_total_tokens: 50000, allowed_tools: false, allowed_web_access: false, timeout_seconds: 30
          }}
          onConnected={(provider) => {
            setActiveProvider(provider);
            setShowBYOKConnect(false);
          }}
          onCancel={() => setShowBYOKConnect(false)}
        />
      )}
    </div>
  );
}

// ── Round Card ────────────────────────────────────────────────────────
function RoundCard({ round, hovered, onClick, onHover, onLeave, animDelay }: {
  round: Round; hovered: boolean; onClick: () => void;
  onHover: () => void; onLeave: () => void; animDelay: number;
}) {
  const locked = round.status === 'locked';
  const completed = round.status === 'completed';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`
        rounded-2xl border p-4 sm:p-5 cursor-pointer transition-all duration-200 animate-slide-up min-h-[240px] flex flex-col
        ${completed
          ? 'border-green-300 bg-green-50 opacity-90'
          : hovered && !locked
          ? 'border-orange-300 bg-orange-50 shadow-lg shadow-orange-100/50 -translate-y-1'
          : locked
          ? 'border-gray-100 bg-white opacity-75'
          : 'border-gray-100 bg-white shadow-sm hover:border-orange-200'}
      `}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      {/* Round badge + status */}
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black font-heading transition-all ${
          completed ? 'bg-green-500 text-white' :
          locked ? 'bg-gray-800 text-white' : hovered ? 'bg-orange-500 text-white scale-110' : 'bg-orange-500 text-white'
        }`}>
          {completed ? '✓' : round.orderIndex}
        </div>
        {locked
          ? <LockIcon className="w-4 h-4 text-gray-300" />
          : completed
          ? <span className="text-xs font-bold text-green-600">COMPLETED</span>
          : round.status === 'live'
          ? <span className="w-2.5 h-2.5 rounded-full bg-green-500 live-dot" />
          : null
        }
      </div>

      {/* Icon */}
      <div className={`flex justify-center mb-4 transition-all duration-200 ${locked ? 'opacity-30' : hovered ? 'scale-110 text-orange-500' : 'text-orange-400'}`}>
        <round.Icon className="w-10 h-10" />
      </div>

      {/* Name */}
      <div className="text-center mb-3">
        <div className="text-base font-black text-gray-900 font-heading leading-tight">{round.name}</div>
        <div className="text-[11px] text-gray-400 mt-1">{round.sub}</div>
      </div>

      {/* Status pill */}
      <div className="flex justify-center mb-3">
        {completed
          ? <Badge variant="live" className="bg-green-100 text-green-700">COMPLETED ✓</Badge>
          : locked
          ? <Badge variant="locked">LOCKED</Badge>
          : <Badge variant={round.status === 'live' ? 'live' : 'upcoming'}>{round.status.toUpperCase()}</Badge>
        }
      </div>

      <div className="text-xs text-gray-500 text-center leading-relaxed mb-4 flex-grow line-clamp-3">
        {round.desc}
      </div>

      {/* Meta */}
      <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2 text-center mt-auto">
        <div>
          <div className="text-[10px] text-gray-400 font-heading mb-0.5">Duration</div>
          <div className="text-sm font-bold text-gray-700">{round.duration}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 font-heading mb-0.5">Max Score</div>
          <div className="text-lg font-black text-orange-500 font-heading leading-none">{round.maxScore}</div>
        </div>
      </div>
    </div>
  );
}
