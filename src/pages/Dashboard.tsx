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
  { icon: <AlertTriangleIcon className="w-3.5 h-3.5 text-red-400"  />, text: 'Limited attempts apply to selected challenges.'        },
  { icon: <ZapIcon           className="w-3.5 h-3.5 text-amber-500"/>, text: 'Speed bonuses available on some rounds.'               },
  { icon: <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500"/>, text: 'Wrong attempts may cost you points in some challenges.' },
  { icon: <CheckIcon         className="w-3.5 h-3.5 text-green-500"/>, text: 'Follow the rules. Be fair. Have fun!'                  },
];

export default function Dashboard({ navigate }: { navigate: (p: Page) => void }) {
  const [hoveredRound, setHoveredRound] = useState<number | null>(null);
  
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
    <div className="h-full flex flex-col" style={{ overflow: 'hidden' }}>
      {/* ── Top section with Hero & Sidebar ───────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3 max-w-7xl mx-auto">
          {/* Clean Professional Hero Banner */}
          <div
            className="overflow-hidden animate-slide-up flex flex-col md:flex-row items-stretch relative"
            style={{
              background: "#FAF7F2",
              border: "3px solid #111111",
              borderRadius: 24,
              boxShadow: "6px 6px 0 #111111",
              minHeight: "220px"
            }}
          >
            {/* Multi-color geometric background shapes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" preserveAspectRatio="xMidYMid slice">
              <ellipse cx="0%" cy="0%" rx="200" ry="150" fill="#B57CFF" opacity="0.2" />
              <ellipse cx="100%" cy="100%" rx="250" ry="200" fill="#2FE69A" opacity="0.2" />
              <ellipse cx="50%" cy="50%" rx="300" ry="200" fill="#FFD027" opacity="0.15" />
            </svg>

            {/* Center Content */}
            <div className="flex-1 p-6 sm:p-10 flex flex-col justify-center relative items-center text-center z-10">
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  color: "#FF5C00",
                  textTransform: "uppercase",
                  marginBottom: "16px"
                }}
              >
                Artificial Intelligence and Data Excellence Club presents
              </div>

              <h2
                style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, color: "#111111" }}
                className="text-3xl sm:text-4xl lg:text-5xl leading-[1.1] mb-4 uppercase"
              >
                PROMPT ENGINEERING<br />
                <span style={{ color: "#111111" }}>CHAMPIONSHIP</span>
              </h2>

              <p
                style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, color: "#111111" }}
                className="text-sm sm:text-base opacity-80 max-w-xl mx-auto"
              >
                A battle of creativity, logic, and AI mastery. Outthink the machines and secure your position on the leaderboard.
              </p>
            </div>
          </div>

          {/* ── Right sidebar (Guidelines + Trophy) ─────────────────────────────── */}
          <div className="hidden lg:flex flex-col gap-3">
            {/* Tournament Guidelines Card */}
            <div
              style={{
                background: "#FAF7F2",
                border: "2.5px solid #111111",
                borderRadius: 16,
                boxShadow: "4px 4px 0 #111111",
                padding: "12px 14px",
              }}
              className="animate-slide-left stagger-1 flex-1"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">📋</span>
                <h4
                  style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 13, color: "#111111" }}
                >
                  Key Guidelines
                </h4>
              </div>

              <div className="space-y-1.5">
                {importantRules.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#FFFFFF",
                      border: "1.5px solid #111111",
                      borderRadius: 10,
                      padding: "5px 8px",
                    }}
                    className="flex items-start gap-2 text-xs text-[#111111] font-semibold"
                  >
                    <span className="flex-shrink-0 mt-0.5">{rule.icon}</span>
                    <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 10, lineHeight: 1.3 }}>{rule.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trophy motivational - compact */}
            <div
              style={{
                background: "#FF5C00",
                color: "#FAF7F2",
                border: "2.5px solid #111111",
                borderRadius: 16,
                boxShadow: "4px 4px 0 #111111",
                padding: "12px 14px",
              }}
              className="relative overflow-hidden text-center animate-slide-left stagger-2 flex-shrink-0"
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                <div className="text-2xl">🏆</div>
                <div>
                  <div
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, opacity: 0.9 }}
                    className="uppercase tracking-wider"
                  >
                    Every prompt is a move
                  </div>
                  <div
                    style={{ fontFamily: "'Boogaloo', cursive", fontSize: 18, letterSpacing: "0.02em" }}
                    className="leading-tight"
                  >
                    Make it count!
                  </div>
                </div>
              </div>
              {/* Neo-brutalist circle decorative */}
              <div
                style={{
                  position: "absolute",
                  right: -16,
                  bottom: -16,
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "#FFD027",
                  border: "2px solid #111111",
                  opacity: 0.4,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Event Rounds ─────────────────────────────── */}
      <div className="flex-1 min-h-0 px-4 pb-4 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div
                style={{
                  background: "#FF5C00",
                  border: "2px solid #111111",
                  borderRadius: 8,
                  boxShadow: "2px 2px 0 #111111",
                  padding: "4px",
                }}
                className="text-[#FAF7F2]"
              >
                <TargetIcon className="w-4 h-4" />
              </div>
              <div>
                <h3
                  style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16, color: "#111111" }}
                >
                  Event Stages
                </h3>
                <p
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: "#777" }}
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
                boxShadow: "2px 2px 0 #111111",
                padding: "4px 12px",
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 800,
                fontSize: 11,
                color: "#111111",
                cursor: "pointer",
              }}
              className="hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform hidden sm:block"
            >
              View All →
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pb-2">
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
  const completed = round.status === 'completed';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        background: completed ? "#F0FDF4" : locked ? "#F4F1EA" : "#FFFFFF",
        border: "2.5px solid #111111",
        borderRadius: 16,
        boxShadow: hovered && !locked ? "5px 5px 0 #111111" : "3px 3px 0 #111111",
        transform: hovered && !locked ? "translateY(-2px)" : "none",
        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.8 : 1,
      }}
      className="p-3 sm:p-4 flex flex-col justify-between relative"
    >
      {/* Top row: Order badge + status pill */}
      <div className="flex items-center justify-between mb-2">
        <div
          style={{
            width: 26,
            height: 26,
            border: "2px solid #111111",
            borderRadius: 8,
            background: completed ? "#2FE69A" : locked ? "#111111" : "#FF5C00",
            color: completed ? "#111111" : "#FAF7F2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "2px 2px 0 #111111",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 900,
            fontSize: 11,
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
            boxShadow: "1px 1px 0 #111111",
            padding: "1px 6px",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 800,
            fontSize: 8,
            letterSpacing: "0.05em",
          }}
        >
          {completed ? "DONE ✓" : locked ? "LOCKED" : round.status === 'live' ? "LIVE" : "READY"}
        </span>
      </div>

      {/* Icon squircle */}
      <div
        style={{
          width: 40,
          height: 40,
          border: "2px solid #111111",
          borderRadius: 10,
          background: completed ? "#DCFCE7" : locked ? "#E5E0D8" : "#FFF4E5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "4px auto 8px auto",
          boxShadow: "2px 2px 0 #111111",
        }}
      >
        <round.Icon className={`w-5 h-5 ${completed ? 'text-green-700' : locked ? 'text-gray-500' : 'text-[#FF5C00]'}`} />
      </div>

      {/* Title and Subtitle */}
      <div className="text-center mb-1">
        <div
          style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 12, color: "#111111", lineHeight: 1.2 }}
        >
          {round.name}
        </div>
        <div
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 700, color: "#888" }}
          className="mt-0.5"
        >
          {round.sub}
        </div>
      </div>

      {/* Description */}
      <div
        style={{ fontFamily: "'Nunito', sans-serif", fontSize: 10, fontWeight: 600, color: "#666" }}
        className="text-center leading-tight mb-2 flex-grow line-clamp-2"
      >
        {round.desc}
      </div>

      {/* Meta Footer */}
      <div
        style={{ borderTop: "2px solid #111111", paddingTop: 6 }}
        className="grid grid-cols-2 gap-1 text-center mt-auto"
      >
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 800, color: "#888" }}>
            DURATION
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 900, color: "#111111" }}>
            {round.duration}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 800, color: "#888" }}>
            MAX PTS
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 900, color: "#FF5C00" }}>
            {round.maxScore}
          </div>
        </div>
      </div>
    </div>
  );
}
