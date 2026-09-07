import { useState, useEffect } from 'react';
import type { Page } from '../components/Layout';
import {
  BrainIcon, TargetIcon, PuzzleIcon, SwordsIcon, CrownIcon,
  LockIcon, ClockIcon, ChevronRightIcon, BookIcon, AlertTriangleIcon,
} from '../components/icons';
import { Badge, Button, Card } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';

const resources = [
  { label: 'Event Rules & Guidelines', icon: '📋' },
  { label: 'Prompt Engineering Basics', icon: '💡' },
  { label: 'AI Model Cheatsheet', icon: '🤖' },
  { label: 'Important Links', icon: '🔗' },
];

export default function RoundsOverview({ navigate }: { navigate: (p: Page) => void }) {
  const [selected, setSelected] = useState(0);
  const [rounds, setRounds] = useState<any[]>([]);
  const [roundSessions, setRoundSessions] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const currentEvent = useEventStore(s => s.currentEvent);
  const currentTeam = useTeamStore(s => s.currentTeam);
  
  const startTimer = { minutes: '30', seconds: '45' };

  useEffect(() => {
    async function loadRounds() {
      if (!currentEvent) {
        setError('No active event found. Please contact the administrator.');
        setLoading(false);
        return;
      }
      
      try {
        const { data, error: fetchError } = await supabase
          .from('rounds')
          .select('*')
          .eq('event_id', currentEvent.id)
          .order('order_index');
          
        if (fetchError) {
          console.error('Error loading rounds:', fetchError);
          setError(`Failed to load rounds: ${fetchError.message}`);
        } else if (data) {
          setRounds(data);
          if (data.length === 0) {
            setError('No rounds have been created for this event yet.');
          }
        }

        // Load round sessions to check completion status
        if (currentTeam?.id) {
          const { data: sessions } = await supabase
            .from('round_sessions')
            .select('*')
            .eq('team_id', currentTeam.id);
          
          if (sessions) {
            const sessionsMap = new Map(sessions.map(s => [s.round_id, s]));
            setRoundSessions(sessionsMap);
          }
        }
      } catch (err: any) {
        console.error('Unexpected error loading rounds:', err);
        setError('An unexpected error occurred while loading rounds.');
      } finally {
        setLoading(false);
      }
    }
    
    loadRounds();
  }, [currentEvent, currentTeam?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rounds...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Rounds Available</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm text-blue-900 mb-2"><strong>Event:</strong> {currentEvent?.name || 'None'}</p>
            <p className="text-sm text-blue-900"><strong>Team:</strong> {currentTeam?.name || 'None'}</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (rounds.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No rounds found for this event.</p>
        </div>
      </div>
    );
  }

  const round = rounds[selected];
  const roundSession = roundSessions.get(round?.id);
  const isCompleted = roundSession?.status === 'COMPLETED';
  const locked = !round.is_active; 

  const getIcon = (type: string) => {
    switch(type) {
      case 'QUIZ': return BrainIcon;
      case 'PROMPT': return TargetIcon;
      case 'ESCAPE_ROOM': return PuzzleIcon;
      case 'AI_BATTLE': return SwordsIcon;
      case 'AI_GRANDMASTER': return CrownIcon;
      case 'AI_SYSTEMS': return BrainIcon;
      default: return TargetIcon;
    }
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Round list ─────────────────────────────── */}
        <div className="space-y-3">
          {rounds.map((r, i) => {
            const isActive = selected === i;
            const isLocked = !r.is_active;
            const session = roundSessions.get(r.id);
            const isCompleted = session?.status === 'COMPLETED';
            const Icon = getIcon(r.type);
            
            return (
              <div
                key={r.id}
                onClick={() => setSelected(i)}
                className={`flex items-center gap-5 p-5 rounded-2xl border cursor-pointer transition-all ${
                  isActive
                    ? 'border-orange-300 bg-orange-50/50 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                {/* Number */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold font-heading flex-shrink-0 ${
                  isCompleted ? 'bg-green-500 text-white' : isLocked ? 'bg-gray-900 text-white' : 'bg-orange-500 text-white'
                }`}>
                  {isCompleted ? '✓' : r.order_index}
                </div>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isLocked ? 'bg-gray-50' : 'bg-orange-50'
                } ${isLocked ? 'opacity-50' : ''}`}>
                  <Icon className={`w-6 h-6 ${isLocked ? 'text-gray-400' : 'text-orange-500'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-900 font-heading">{r.name}</span>
                    {isCompleted ? (
                      <Badge variant="success">COMPLETED ✓</Badge>
                    ) : isLocked ? (
                      <Badge variant="locked">LOCKED</Badge>
                    ) : (
                      <Badge variant="live">LIVE</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{r.description}</p>
                </div>

                {/* Timer / lock */}
                <div className="text-right flex-shrink-0">
                  {isActive && !isLocked ? (
                    <div>
                      <div className="text-[10px] text-orange-500 font-bold uppercase tracking-wide mb-0.5">Starts in</div>
                      <div className="text-2xl font-bold text-orange-500 font-mono">{startTimer.minutes}:{startTimer.seconds}</div>
                      <div className="text-[10px] text-gray-400">MIN &nbsp; SEC</div>
                    </div>
                  ) : isLocked ? (
                    <LockIcon className="w-5 h-5 text-gray-300" />
                  ) : null}
                </div>

                <ChevronRightIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-orange-400' : 'text-gray-300'}`} />
              </div>
            );
          })}

          {/* Notice */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <span className="text-amber-500 text-base">ℹ</span>
            <span className="text-sm text-amber-700">Complete each round in order to unlock the next one.</span>
          </div>
        </div>

        {/* ── Detail panel ───────────────────────────── */}
        <div className="space-y-4">
          {/* Round header */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-orange-500 uppercase tracking-widest font-heading">
                {round.name.toUpperCase()}
              </span>
            </div>

            {/* About */}
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookIcon className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 font-heading mb-1">About this Stage</div>
                <p className="text-sm text-gray-500">{round.description}</p>
              </div>
            </div>

            {/* Details grid */}
            <div className="space-y-2 text-sm border-t border-gray-50 pt-4">
              {[
                { label: 'Duration', value: `${round.duration_minutes} Minutes`, icon: <ClockIcon className="w-3.5 h-3.5 text-gray-400" /> },
                { label: 'Type', value: round.type, icon: <TargetIcon className="w-3.5 h-3.5 text-gray-400" /> },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 text-gray-500">
                    {row.icon}
                    {row.label}
                  </div>
                  <div className="font-semibold text-gray-900">{row.value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Enter Round CTA */}
          {!locked && !isCompleted && (
            <Button
              onClick={() => {
                // Navigate to quiz or regular round based on type
                if (round.type === 'QUIZ' || round.type === 'KNOWLEDGE_TEST') {
                  navigate(`quiz-${round.id}` as Page);
                } else if (round.type === 'PROMPT' || round.type === 'PROMPT_CHALLENGE') {
                  navigate(`prompt-heist-${round.id}` as Page);
                } else if (round.type === 'VISION_CHALLENGE') {
                  navigate(`vision-${round.id}` as Page);
                } else if (round.type === 'AI_ADVERSARIAL' || round.type === 'ADVERSARIAL_CHALLENGE') {
                  navigate(`round4-${round.id}` as Page);
                } else if (round.type === 'AI_SYSTEMS' || round.type === 'SYSTEMS_CHALLENGE') {
                  navigate(`round5-${round.id}` as Page);
                } else {
                  navigate(`round-${round.id}` as Page);
                }
              }}
              className="w-full py-3"
            >
              Enter {round.name || `Stage ${round.order_index}`} →
            </Button>
          )}

          {isCompleted && (
            <div className="w-full py-3 px-4 bg-green-50 border border-green-200 rounded-xl text-center">
              <div className="text-green-700 font-semibold">✓ Round Completed</div>
              <div className="text-sm text-green-600 mt-1">Score: {roundSession?.score || 0} points</div>
            </div>
          )}

          {/* Trophy */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-orange-100 p-4 text-center mt-4">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-sm text-gray-600 mb-1">Stay sharp. Stay curious.</div>
            <div className="text-base font-bold text-orange-600 font-heading leading-snug break-words">Let the challenge begin!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
