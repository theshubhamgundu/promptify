import { useState, useEffect, useRef } from 'react';
import { useLiveDisplay, type DisplayAnnouncement } from '../hooks/useLiveDisplay';
import { supabase } from '../lib/supabase';
import { LeaderboardEngine, type LeaderboardEntry } from '../lib/leaderboard-engine';
import { getScreenPage, subscribeToScreenChanges, type DisplayPageType } from '../lib/screen-sync';

export default function PublicDisplay() {
  // Screen ID parsed from URL query: ?screen=1 (default: 1)
  const [screenId] = useState<number>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const s = parseInt(params.get('screen') || '1', 10);
      if (s >= 1 && s <= 5) return s;
    } catch {}
    return 1;
  });

  const {
    announcements,
    currentSlideIndex,
    rotationProgress,
    pauseRotation,
    resumeRotation,
  } = useLiveDisplay(screenId);

  // Active page assigned to this screen (synced from Admin Portal)
  const [activePage, setActivePage] = useState<DisplayPageType>(() => getScreenPage(screenId));

  const prevAnnouncementsCount = useRef(announcements.length);

  // Listen to remote changes from Admin Portal in real time
  useEffect(() => {
    setActivePage(getScreenPage(screenId));
    const unsubscribe = subscribeToScreenChanges((changedScreenId, newPage) => {
      if (changedScreenId === screenId) {
        setActivePage(newPage);
      }
    });
    return unsubscribe;
  }, [screenId]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenHelper, setShowFullscreenHelper] = useState(true);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (fs) setShowFullscreenHelper(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard shortcuts: Press 'F' or 'F11' to toggle Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Audio chime on urgent announcement
  useEffect(() => {
    if (announcements.length > prevAnnouncementsCount.current) {
      const newest = announcements[0];
      if (newest && newest.priority === 'URGENT') {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
        } catch (e) {
          // Audio blocked or unsupported
        }
      }
    }
    prevAnnouncementsCount.current = announcements.length;
  }, [announcements]);

  const activeAnnouncement: DisplayAnnouncement =
    announcements[currentSlideIndex] || announcements[0] || {
      id: 'default',
      title: 'STARTS IN 10 MINS',
      message: 'Please take your seats and prepare your workstations. Contest Round 1 is starting shortly!',
      priority: 'URGENT',
      pinned: true,
      is_active: true,
      created_at: new Date().toISOString()
    };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-[#faf7f2] bg-no-repeat bg-cover bg-center flex flex-col justify-between overflow-hidden select-none font-sans cursor-pointer"
      style={{ backgroundImage: "url('/assets/announcement_template.png')" }}
      onClick={() => {
        if (!document.fullscreenElement) {
          toggleFullscreen();
        }
      }}
      onDoubleClick={toggleFullscreen}
      onMouseEnter={pauseRotation}
      onMouseLeave={resumeRotation}
    >
      {/* ── Discreet Fullscreen Indicator when in windowed mode ── */}
      {!isFullscreen && showFullscreenHelper && (
        <div className="fixed top-4 right-4 z-50 animate-bounce pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="bg-black/90 hover:bg-black text-white px-4 py-2 rounded-2xl shadow-2xl border-2 border-amber-400 flex items-center gap-2 text-xs font-black font-heading transition-transform active:scale-95"
            title="Click or press 'F' to enter true Fullscreen"
          >
            <span>⛶ Click for Fullscreen</span>
            <span className="bg-amber-400 text-black text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">F</span>
          </button>
        </div>
      )}
      {/* ── Full-Bleed Clean Presentation Screen (Zero buttons or toolbars) ── */}
      <main className="flex-1 flex flex-col items-center justify-center w-full h-full overflow-hidden relative z-10">
        {activePage === 'announcements' && (
          <DisplayAnnouncementsView
            activeAnnouncement={activeAnnouncement}
            announcementsCount={announcements.length}
            rotationProgress={rotationProgress}
          />
        )}
        {activePage === 'leaderboard' && <DisplayLeaderboardView />}
        {activePage === 'rounds' && <DisplayRoundsView />}
        {activePage === 'results' && <DisplayResultsView />}
        {activePage === 'rules' && <DisplayRulesView />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANNOUNCEMENTS VIEW (Pure Pop-Art Typography Canvas)
// ─────────────────────────────────────────────────────────────────────────────
function DisplayAnnouncementsView({
  activeAnnouncement,
  announcementsCount,
  rotationProgress,
}: {
  activeAnnouncement: DisplayAnnouncement;
  announcementsCount: number;
  rotationProgress: number;
}) {
  return (
    <div className="flex-1 flex flex-col justify-between w-full h-full max-w-7xl mx-auto px-6 sm:px-12 py-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="space-y-4 lg:space-y-6 animate-fade-in w-full max-w-5xl" key={activeAnnouncement.id}>
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-display tracking-tight text-slate-950 uppercase leading-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.12)] mx-auto">
            {activeAnnouncement.title}
          </h1>

          {activeAnnouncement.message && (
            <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-slate-900 font-extrabold font-heading leading-tight whitespace-pre-wrap max-w-4xl mx-auto px-4 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              {activeAnnouncement.message}
            </div>
          )}
        </div>
      </div>

      {/* Subtle bottom auto-rotation progress bar if multiple slides */}
      {announcementsCount > 1 && (
        <div className="w-full pb-2 flex justify-center">
          <div className="w-64 max-w-xs bg-slate-400/30 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-orange-500 h-full rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${rotationProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LIVE LEADERBOARD VIEW (Clean Broadcast Podium & Rankings)
// ─────────────────────────────────────────────────────────────────────────────
function DisplayLeaderboardView() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoard = async () => {
    try {
      const data = await LeaderboardEngine.getLeaderboard();
      setLeaderboard(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
    const channel = supabase
      .channel('display_leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => fetchBoard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_events' }, () => fetchBoard())
      .subscribe();

    const interval = setInterval(fetchBoard, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3, 14);

  return (
    <div className="w-full h-full max-w-6xl mx-auto px-8 py-8 flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-4xl sm:text-6xl font-black font-display uppercase tracking-tight text-slate-950 drop-shadow-sm">
          🏆 LIVE EVENT LEADERBOARD
        </h2>
        <p className="text-base sm:text-lg font-bold text-slate-700 font-heading">
          Real-Time Competition Standings & Scores
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-6 max-w-4xl mx-auto w-full items-end">
        {/* Rank 2 */}
        <div className="bg-white/95 border-3 border-black rounded-3xl p-5 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-black flex items-center justify-center font-black text-slate-800 text-xl mb-2">
            🥈
          </div>
          <div className="text-xs font-black uppercase text-slate-500">2nd Place</div>
          <div className="text-lg sm:text-xl font-black text-slate-900 truncate w-full">
            {top3[1]?.name || '—'}
          </div>
          <div className="text-2xl font-black text-purple-600 font-heading">
            {top3[1]?.score || 0} <span className="text-xs font-bold text-slate-500">PTS</span>
          </div>
        </div>

        {/* Rank 1 */}
        <div className="bg-amber-400 border-3 border-black rounded-3xl p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center -translate-y-4">
          <div className="w-14 h-14 rounded-full bg-white border-2 border-black flex items-center justify-center font-black text-3xl mb-2 shadow-sm animate-bounce">
            👑
          </div>
          <div className="text-xs font-black uppercase text-black/80">Current Leader</div>
          <div className="text-xl sm:text-2xl font-black text-black truncate w-full">
            {top3[0]?.name || '—'}
          </div>
          <div className="text-3xl sm:text-4xl font-black text-black font-heading">
            {top3[0]?.score || 0} <span className="text-xs font-bold text-black/70">PTS</span>
          </div>
        </div>

        {/* Rank 3 */}
        <div className="bg-white/95 border-3 border-black rounded-3xl p-5 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-black flex items-center justify-center font-black text-amber-800 text-xl mb-2">
            🥉
          </div>
          <div className="text-xs font-black uppercase text-slate-500">3rd Place</div>
          <div className="text-lg sm:text-xl font-black text-slate-900 truncate w-full">
            {top3[2]?.name || '—'}
          </div>
          <div className="text-2xl font-black text-orange-600 font-heading">
            {top3[2]?.score || 0} <span className="text-xs font-bold text-slate-500">PTS</span>
          </div>
        </div>
      </div>

      {/* Ranks 4+ List */}
      <div className="bg-white/95 border-3 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden max-w-4xl mx-auto w-full flex-1">
        <div className="bg-black text-white px-6 py-3 flex items-center justify-between text-xs font-black uppercase tracking-wider">
          <span>Rank & Team</span>
          <span>Score</span>
        </div>
        <div className="divide-y divide-slate-200 max-h-56 overflow-y-auto">
          {remaining.length === 0 ? (
            <div className="p-4 text-center text-sm font-bold text-slate-500">
              {loading ? 'Loading scores…' : 'No additional ranked teams yet.'}
            </div>
          ) : (
            remaining.map(team => (
              <div key={team.teamId} className="px-6 py-2.5 flex items-center justify-between hover:bg-amber-50">
                <div className="flex items-center gap-4">
                  <span className="w-7 font-mono font-black text-slate-400 text-base">#{team.rank}</span>
                  <span className="font-bold text-slate-900 text-base">{team.name}</span>
                </div>
                <div className="font-black text-slate-900 text-base font-heading">
                  {team.score} <span className="text-xs text-slate-400">PTS</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROUNDS & TIMER VIEW (Active Rounds Timeline & Countdown)
// ─────────────────────────────────────────────────────────────────────────────
function DisplayRoundsView() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('rounds').select('*').order('order_index');
        if (data) setRounds(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="w-full h-full max-w-5xl mx-auto px-8 py-8 flex flex-col justify-center overflow-y-auto">
      <div className="text-center mb-8">
        <h2 className="text-4xl sm:text-6xl font-black font-display uppercase tracking-tight text-slate-950">
          ⏱️ EVENT ROUNDS & TIMELINE
        </h2>
        <p className="text-base sm:text-lg font-bold text-slate-700 font-heading">
          Competition Phases, Timers & Challenge Status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rounds.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white/90 border-3 border-black rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-lg font-bold text-slate-700">
              {loading ? 'Loading rounds…' : 'Round 1: AI IQ & Fundamentals (Active)\nRound 2: Prompt Engineering\nRound 3: Advanced Architectures'}
            </p>
          </div>
        ) : (
          rounds.map((r, i) => (
            <div
              key={r.id || i}
              className={`border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${
                r.status === 'ACTIVE'
                  ? 'bg-amber-300 scale-[1.03]'
                  : r.status === 'COMPLETED'
                  ? 'bg-emerald-100'
                  : 'bg-white/95'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-black text-white">
                  Round {r.order_index || i + 1}
                </span>
                <span
                  className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                    r.status === 'ACTIVE'
                      ? 'bg-red-500 text-white animate-pulse'
                      : r.status === 'COMPLETED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {r.status || 'UPCOMING'}
                </span>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">{r.name}</h3>
              <p className="text-xs sm:text-sm text-slate-700 font-medium mb-4 line-clamp-2">
                {r.description || 'Complete the challenge prompts and submit within time.'}
              </p>

              <div className="flex items-center justify-between text-xs sm:text-sm font-bold border-t-2 border-black/20 pt-3">
                <span>⏱️ {r.duration_minutes || 30} Mins</span>
                <span>⭐ {r.max_score || 100} Max Pts</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FINAL RESULTS VIEW (Championship Podium & Winner Reveal)
// ─────────────────────────────────────────────────────────────────────────────
function DisplayResultsView() {
  const [topTeams, setTopTeams] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const board = await LeaderboardEngine.getLeaderboard();
        setTopTeams(board.slice(0, 5));
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  return (
    <div className="w-full h-full max-w-5xl mx-auto px-8 py-8 flex flex-col justify-center items-center text-center overflow-y-auto">
      <div className="mb-6">
        <div className="inline-block bg-amber-400 border-2 border-black px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-3">
          Grand Championship Podium
        </div>
        <h2 className="text-4xl sm:text-7xl font-black font-display uppercase tracking-tight text-slate-950">
          🎖️ FINAL AWARDS & WINNERS
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-8 items-end">
        {/* 2nd Place */}
        <div className="bg-white/95 border-3 border-black rounded-3xl p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-5xl mb-2">🥈</div>
          <div className="text-xs font-black uppercase text-slate-500">1st Runner Up</div>
          <div className="text-2xl font-black text-slate-900 my-1">{topTeams[1]?.name || 'TBD'}</div>
          <div className="text-3xl font-black text-purple-600 font-heading">{topTeams[1]?.score || 0} PTS</div>
        </div>

        {/* 1st Place Champion */}
        <div className="bg-amber-300 border-4 border-black rounded-3xl p-8 text-center shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] -translate-y-4">
          <div className="text-7xl mb-2 animate-bounce">🏆</div>
          <div className="text-sm font-black uppercase tracking-wider text-black/80">GRAND CHAMPION</div>
          <div className="text-3xl font-black text-black my-2">{topTeams[0]?.name || 'TBD'}</div>
          <div className="text-4xl font-black text-black font-heading">{topTeams[0]?.score || 0} PTS</div>
        </div>

        {/* 3rd Place */}
        <div className="bg-white/95 border-3 border-black rounded-3xl p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-5xl mb-2">🥉</div>
          <div className="text-xs font-black uppercase text-slate-500">2nd Runner Up</div>
          <div className="text-2xl font-black text-slate-900 my-1">{topTeams[2]?.name || 'TBD'}</div>
          <div className="text-3xl font-black text-orange-600 font-heading">{topTeams[2]?.score || 0} PTS</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RULES & GUIDELINES VIEW (Clean Regulations Canvas)
// ─────────────────────────────────────────────────────────────────────────────
function DisplayRulesView() {
  const guidelines = [
    { title: '1. Workstation & Presence', text: 'All participants must remain at designated workstations during live competition rounds.' },
    { title: '2. AI & Tool Usage', text: 'Use allowed AI LLM models only where permitted by specific round briefing rules.' },
    { title: '3. Integrity & Conduct', text: 'Prompt injection or tampering with competition systems results in immediate disqualification.' },
    { title: '4. Submissions & Timer', text: 'All prompt submissions must be finalized before round countdown timers expire.' },
  ];

  return (
    <div className="w-full h-full max-w-5xl mx-auto px-8 py-8 flex flex-col justify-center overflow-y-auto">
      <div className="text-center mb-8">
        <h2 className="text-4xl sm:text-6xl font-black font-display uppercase tracking-tight text-slate-950">
          📋 COMPETITION GUIDELINES & RULES
        </h2>
        <p className="text-base sm:text-lg font-bold text-slate-700 font-heading">
          Promptify Championship Event Regulations
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {guidelines.map((g, idx) => (
          <div
            key={idx}
            className="bg-white/95 border-3 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <h3 className="text-lg font-black text-slate-900 mb-2 font-heading">{g.title}</h3>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">{g.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
