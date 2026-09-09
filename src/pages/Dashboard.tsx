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
        maxScore: (r.challenges && r.challenges.length > 0) ? r.challenges.reduce((sum: number, c: any) => sum + (c.base_points || 0), 0) : 200, // Sum of challenge base_points; falls back to 200
        duration: `${r.duration_minutes} min`,
        Icon: getIconForType(r.type),
      };
    });
  }, [dbRounds, completedRounds]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Top section with Hero & Sidebar ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          {/* Hero banner */}
          <div
            style={{
              background: "#FFFFFF",
              border: "2.5px solid #111111",
              borderRadius: 22,
              boxShadow: "5px 5px 0 #111111",
            }}
            className="overflow-hidden animate-slide-up"
          >
            <div className="flex flex-col md:flex-row min-h-[200px]">
              {/* Left content */}
              <div className="flex-1 p-6 sm:p-8 relative overflow-hidden bg-[#FAF7F2]">
                <div className="relative z-10">
                  <div
                    style={{
                      background: "#FF5C00",
                      color: "#FAF7F2",
                      border: "2px solid #111111",
                      borderRadius: 999,
                      boxShadow: "2.5px 2.5px 0 #111111",
                      padding: "4px 14px",
                    }}
                    className="inline-flex items-center gap-2 mb-3"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#2FE69A] border border-[#111111] animate-pulse" />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: 11, letterSpacing: "0.08em" }}>
                      LIVE TOURNAMENT
                    </span>
                  </div>

                  <h2
                    style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900 }}
                    className="text-2xl sm:text-3xl lg:text-4xl text-[#111111] leading-tight mb-2"
                  >
                    PROMPT ENGINEERING<br />
                    <span style={{ color: "#FF5C00" }}>CHAMPIONSHIP</span>
                  </h2>

                  <p
                    style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}
                    className="text-[#111111]/80 text-sm sm:text-base mb-1"
                  >
                    A battle of creativity, logic, and AI mastery.
                  </p>
                  <p
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}
                    className="text-[#111111]/60 text-xs sm:text-sm mb-6"
                  >
                    Use your prompts wisely. Outthink. Outperform. Outrank.
                  </p>

                  <button
                    onClick={() => navigate('rounds')}
                    style={{
                      background: "#FF5C00",
                      color: "#FAF7F2",
                      border: "2.5px solid #111111",
                      borderRadius: 999,
                      boxShadow: "3px 3px 0 #111111",
                      padding: "10px 24px",
                      fontFamily: "'Nunito', sans-serif",
                      fontWeight: 900,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                    className="inline-flex items-center gap-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all group"
                  >
                    <span>View Event Details</span>
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* AI Illustration panel */}
              <div
                style={{
                  background: "#FFD027",
                  borderLeft: "2.5px solid #111111",
                }}
                className="w-full md:w-64 flex-shrink-0 flex items-center justify-center p-6 relative overflow-hidden"
              >
                {/* Background dot pattern */}
                <div className="absolute inset-0 opacity-15">
                  {Array.from({length: 25}).map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-[#111111]"
                      style={{ left: `${(i % 5) * 22 + 8}%`, top: `${Math.floor(i / 5) * 20 + 8}%` }}
                    />
                  ))}
                </div>

                <div className="relative z-10 flex flex-col items-center">
                  <svg viewBox="0 0 160 180" className="w-36 h-36">
                    {/* Code symbols floating */}
                    <text x="8"  y="32" fontSize="12" fill="#111111" fontWeight="bold" opacity="0.6" fontFamily="monospace">{'</>'}</text>
                    <text x="120" y="28" fontSize="11" fill="#111111" fontWeight="bold" opacity="0.6" fontFamily="monospace">{'{ }'}</text>
                    <text x="128" y="88" fontSize="10" fill="#111111" fontWeight="bold" opacity="0.6" fontFamily="monospace">AI</text>

                    {/* Robot body */}
                    <rect x="40" y="82" width="80" height="75" rx="14" fill="#FF5C00" stroke="#111111" strokeWidth="3"/>
                    <rect x="46" y="88" width="68" height="63" rx="10" fill="#FF7A29" stroke="#111111" strokeWidth="2"/>

                    {/* Head */}
                    <rect x="45" y="42" width="70" height="48" rx="12" fill="#FAF7F2" stroke="#111111" strokeWidth="3"/>

                    {/* Visor */}
                    <rect x="52" y="52" width="56" height="22" rx="6" fill="#111111"/>

                    {/* Eyes inside visor */}
                    <circle cx="68" cy="63" r="6" fill="#2FE69A"/>
                    <circle cx="92" cy="63" r="6" fill="#2FE69A"/>
                    <circle cx="70" cy="64" r="2.5" fill="#FAF7F2"/>
                    <circle cx="94" cy="64" r="2.5" fill="#FAF7F2"/>

                    {/* Mouth */}
                    <rect x="64" y="78" width="32" height="4" rx="2" fill="#111111"/>

                    {/* Antenna */}
                    <line x1="80" y1="42" x2="80" y2="24" stroke="#111111" strokeWidth="3" strokeLinecap="round"/>
                    <circle cx="80" cy="20" r="6" fill="#FF5C00" stroke="#111111" strokeWidth="2.5"/>

                    {/* Arms */}
                    <rect x="18" y="90" width="20" height="42" rx="8" fill="#FF5C00" stroke="#111111" strokeWidth="2.5"/>
                    <rect x="122" y="90" width="20" height="42" rx="8" fill="#FF5C00" stroke="#111111" strokeWidth="2.5"/>

                    {/* Legs */}
                    <rect x="52" y="157" width="22" height="18" rx="6" fill="#111111"/>
                    <rect x="86" y="157" width="22" height="18" rx="6" fill="#111111"/>
                  </svg>

                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "2px solid #111111",
                      borderRadius: 999,
                      boxShadow: "2px 2px 0 #111111",
                      padding: "2px 10px",
                    }}
                    className="mt-2 text-center"
                  >
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 900, color: "#111111" }}>
                      5 STAGES • 1100 PTS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Event Rounds ─────────────────────────────── */}
          <div className="animate-slide-up stagger-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    background: "#FF5C00",
                    border: "2px solid #111111",
                    borderRadius: 10,
                    boxShadow: "2.5px 2.5px 0 #111111",
                    padding: "6px",
                  }}
                  className="text-[#FAF7F2]"
                >
                  <TargetIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 20, color: "#111111" }}
                  >
                    Event Stages
                  </h3>
                  <p
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#777" }}
                  >
                    Complete each stage in sequence to climb the leaderboard
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('rounds')}
                style={{
                  background: "#FFFFFF",
                  border: "2px solid #111111",
                  borderRadius: 999,
                  boxShadow: "2.5px 2.5px 0 #111111",
                  padding: "6px 14px",
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 800,
                  fontSize: 12,
                  color: "#111111",
                  cursor: "pointer",
                }}
                className="hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
              >
                View All Stages →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
                      return;
                    }
                    
                    sounds.start();
                    if (round.type === 'QUIZ' || round.type === 'KNOWLEDGE_TEST') {
                      navigate(`quiz-${round.id}` as any);
                    } else if (round.type === 'ROUND2_HEIST' || round.name?.includes('Round 2') || round.name?.includes('Prompt Heist')) {
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
        <div className="space-y-5">
          {/* BYOK Configuration Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "2.5px solid #111111",
              borderRadius: 20,
              boxShadow: "5px 5px 0 #111111",
              padding: "18px",
            }}
            className="animate-slide-left stagger-1"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div
                style={{
                  background: "#B57CFF",
                  border: "2px solid #111111",
                  borderRadius: 10,
                  boxShadow: "2px 2px 0 #111111",
                  padding: "6px",
                  color: "#111111",
                }}
              >
                <ZapIcon className="w-4 h-4" />
              </div>
              <div>
                <h4
                  style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 15, color: "#111111", lineHeight: 1.1 }}
                >
                  AI Tools Config
                </h4>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#777" }}>
                  BYOK Session
                </p>
              </div>
            </div>
            
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
                <p
                  style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}
                  className="text-xs text-[#111111]/70 mb-3 leading-relaxed"
                >
                  Connect your own API key to unlock LLMs and advanced reasoning throughout the event.
                </p>
                <button 
                  onClick={() => setShowBYOKConnect(true)} 
                  style={{
                    background: "#FFD027",
                    color: "#111111",
                    border: "2px solid #111111",
                    borderRadius: 999,
                    boxShadow: "2.5px 2.5px 0 #111111",
                    padding: "8px 16px",
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  className="w-full hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform flex items-center justify-center gap-1.5"
                >
                  <span>Connect API Key</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>

          {/* Tournament Guidelines Card */}
          <div
            style={{
              background: "#FAF7F2",
              border: "2.5px solid #111111",
              borderRadius: 20,
              boxShadow: "5px 5px 0 #111111",
              padding: "18px",
            }}
            className="animate-slide-left stagger-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📋</span>
              <h4
                style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 14, color: "#111111" }}
              >
                Key Guidelines
              </h4>
            </div>

            <div className="space-y-2.5">
              {importantRules.map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#FFFFFF",
                    border: "1.5px solid #111111",
                    borderRadius: 12,
                    padding: "8px 10px",
                  }}
                  className="flex items-start gap-2.5 text-xs text-[#111111] font-semibold"
                >
                  <span className="flex-shrink-0 mt-0.5">{rule.icon}</span>
                  <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, lineHeight: 1.3 }}>{rule.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trophy motivational */}
          <div
            style={{
              background: "#FF5C00",
              color: "#FAF7F2",
              border: "2.5px solid #111111",
              borderRadius: 20,
              boxShadow: "5px 5px 0 #111111",
              padding: "20px",
            }}
            className="relative overflow-hidden text-center animate-slide-left stagger-3"
          >
            <div className="relative z-10">
              <div className="text-3xl mb-1">🏆</div>
              <div
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, opacity: 0.9 }}
                className="mb-1 uppercase tracking-wider"
              >
                Every prompt is a move
              </div>
              <div
                style={{ fontFamily: "'Boogaloo', cursive", fontSize: 24, letterSpacing: "0.02em" }}
                className="leading-tight"
              >
                Make it count!
              </div>
            </div>
            {/* Neo-brutalist circle decorative */}
            <div
              style={{
                position: "absolute",
                right: -20,
                bottom: -20,
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: "#FFD027",
                border: "2px solid #111111",
                opacity: 0.4,
              }}
            />
          </div>
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
      style={{
        background: completed ? "#F0FDF4" : locked ? "#F4F1EA" : "#FFFFFF",
        border: "2.5px solid #111111",
        borderRadius: 20,
        boxShadow: hovered && !locked ? "6px 6px 0 #111111" : "4px 4px 0 #111111",
        transform: hovered && !locked ? "translateY(-3px)" : "none",
        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.8 : 1,
      }}
      className="p-5 flex flex-col justify-between min-h-[290px] relative"
    >
      {/* Top row: Order badge + status pill */}
      <div className="flex items-center justify-between mb-3">
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #111111",
            borderRadius: 10,
            background: completed ? "#2FE69A" : locked ? "#111111" : "#FF5C00",
            color: completed ? "#111111" : "#FAF7F2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "2px 2px 0 #111111",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          {completed ? "✓" : round.orderIndex}
        </div>

        {/* Status indicator */}
        <span
          style={{
            background: completed ? "#2FE69A" : locked ? "#111111" : round.status === 'live' ? "#FF5C00" : "#FFD027",
            color: completed ? "#111111" : locked ? "#FAF7F2" : round.status === 'live' ? "#FAF7F2" : "#111111",
            border: "1.5px solid #111111",
            borderRadius: 999,
            boxShadow: "1.5px 1.5px 0 #111111",
            padding: "2px 8px",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 800,
            fontSize: 9,
            letterSpacing: "0.05em",
          }}
        >
          {completed ? "DONE ✓" : locked ? "LOCKED" : round.status === 'live' ? "LIVE" : "READY"}
        </span>
      </div>

      {/* Icon squircle */}
      <div
        style={{
          width: 54,
          height: 54,
          border: "2px solid #111111",
          borderRadius: 14,
          background: completed ? "#DCFCE7" : locked ? "#E5E0D8" : "#FFF4E5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "8px auto 12px auto",
          boxShadow: "2.5px 2.5px 0 #111111",
        }}
      >
        <round.Icon className={`w-7 h-7 ${completed ? 'text-green-700' : locked ? 'text-gray-500' : 'text-[#FF5C00]'}`} />
      </div>

      {/* Title and Subtitle */}
      <div className="text-center mb-2">
        <div
          style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 15, color: "#111111", lineHeight: 1.2 }}
        >
          {round.name}
        </div>
        <div
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: "#888" }}
          className="mt-0.5"
        >
          {round.sub}
        </div>
      </div>

      {/* Description */}
      <div
        style={{ fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 600, color: "#666" }}
        className="text-center leading-tight mb-4 flex-grow line-clamp-2"
      >
        {round.desc}
      </div>

      {/* Meta Footer */}
      <div
        style={{ borderTop: "2px solid #111111", paddingTop: 8 }}
        className="grid grid-cols-2 gap-2 text-center mt-auto"
      >
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 800, color: "#888" }}>
            DURATION
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 900, color: "#111111" }}>
            {round.duration}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 800, color: "#888" }}>
            MAX PTS
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: "#FF5C00" }}>
            {round.maxScore}
          </div>
        </div>
      </div>
    </div>
  );
}
