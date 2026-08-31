import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';
import { BYOKConnect } from '../components/BYOKConnect';
import { byokSession, BYOKConfig, AIProvider } from '../lib/byok-service';
import { ClockIcon, ShieldIcon } from '../components/icons';
import { ConfirmDialog } from '../components/ui';

// Import challenge components (We'll build these next)
import { VisualChallenge } from '../components/challenges/VisualChallenge';
import { JailbreakChallenge } from '../components/challenges/JailbreakChallenge';
import { PolyglotChallenge } from '../components/challenges/PolyglotChallenge';
import { LieDetectorChallenge } from '../components/challenges/LieDetectorChallenge';
import { PromptZipperChallenge } from '../components/challenges/PromptZipperChallenge';

interface Challenge {
  id: string;
  round_id: string;
  title: string;
  description: string;
  type: string; // 'VISUAL', 'JAILBREAK', 'POLYGLOT', 'LIE_DETECTOR', 'PROMPT_ZIPPER'
  base_points: number;
  configuration: any;
  order_index: number;
}

interface BossRoundProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

export default function BossRound({ roundId, navigate }: BossRoundProps) {
  const { currentEvent } = useEventStore();
  const { currentTeam } = useTeamStore();
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [roundSession, setRoundSession] = useState<any>(null);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState<any>(null);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const deadlineRef = useRef<string | null>(null);
  const isRoundActive = useRef(true);

  // BYOK State
  const [showBYOKConnect, setShowBYOKConnect] = useState(false);
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);

  useEffect(() => {
    if (roundId && currentTeam?.id) initializeRound();
  }, [roundId, currentTeam?.id]);

  useEffect(() => {
    if (!roundSession?.id) return;
    const heartbeatInterval = setInterval(() => {
      if (isRoundActive.current) {
        supabase.rpc('record_session_heartbeat', { p_round_session_id: roundSession.id }).then();
      }
    }, 15000);

    if (timeLeft <= 0 || !deadlineRef.current) return;
    const timer = setInterval(() => {
      const remaining = Math.floor((new Date(deadlineRef.current!).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        if (roundSession?.status === 'IN_PROGRESS') handleSubmitRound();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    
    return () => { clearInterval(heartbeatInterval); clearInterval(timer); };
  }, [roundSession?.status, roundSession?.id, timeLeft]);

  const initializeRound = async () => {
    try {
      setLoading(true); setError(null);
      
      const { data: roundData, error: roundError } = await supabase.from('rounds').select('*').eq('id', roundId).single();
      if (roundError) throw roundError;
      setRound(roundData);
      
      let { data: sessionData, error: sessionError } = await supabase.from('round_sessions')
        .select('*').eq('team_id', currentTeam!.id).eq('round_id', roundId).single();
      
      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
      
      if (!sessionData) {
        const { data: newSession, error: createError } = await supabase.from('round_sessions')
          .insert({ team_id: currentTeam!.id, round_id: roundId, started_at: new Date().toISOString() })
          .select().single();
        if (createError) throw createError;
        sessionData = newSession;
      }
      setRoundSession(sessionData);
      
      const { data: challengesData, error: chalError } = await supabase.from('challenges')
        .select('*').eq('round_id', roundId).order('order_index');
      if (chalError) throw chalError;
      setChallenges(challengesData);
      
      let deadline = sessionData.deadline_at;
      if (!deadline) {
        deadline = new Date(Date.now() + (roundData.duration_minutes || 60) * 60 * 1000).toISOString();
      }
      deadlineRef.current = deadline;
      setTimeLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
      
    } catch (err: any) {
      console.error('Error initializing round:', err);
      setError(err.message || 'Failed to load round');
    } finally {
      setLoading(false);
    }
  };

  const currentChallenge = challenges[currentChallengeIndex];

  // BYOK Check whenever challenge changes
  useEffect(() => {
    if (!currentChallenge) return;
    const byokConfig = currentChallenge.configuration?.byok as BYOKConfig;
    if (byokConfig?.enabled) {
      const foundProvider = byokConfig.required_providers.find(p => byokSession.hasKey(p));
      if (foundProvider) {
        setActiveProvider(foundProvider);
        setShowBYOKConnect(false);
      } else {
        setActiveProvider(null);
        setShowBYOKConnect(true);
      }
    } else {
      setShowBYOKConnect(false);
      setActiveProvider(null);
    }
  }, [currentChallengeIndex, currentChallenge]);

  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const handleSubmitRound = () => {
    setConfirmSubmit(true);
  };

  const executeSubmitRound = async () => {
    setConfirmSubmit(false);
    try {
      isRoundActive.current = false;
      const { error: submitError } = await supabase.rpc('submit_round_session', {
        p_round_session_id: roundSession!.id,
      });
      if (submitError) throw submitError;
      if (navigate) navigate('dashboard');
    } catch (err: any) {
      console.error('Error submitting:', err);
      setError('Failed to submit round');
    }
  };

  const renderChallengeComponent = () => {
    if (!currentChallenge) return null;
    
    // Pass necessary props to the challenge components
    const commonProps = {
      challenge: currentChallenge,
      teamId: currentTeam!.id,
      roundSessionId: roundSession!.id,
      activeProvider,
      onComplete: () => {
        // Automatically move to next challenge if completed
        if (currentChallengeIndex < challenges.length - 1) {
          setCurrentChallengeIndex(prev => prev + 1);
        }
      }
    };

    switch (currentChallenge.type) {
      case 'VISUAL':
        return <VisualChallenge {...commonProps} />;
      case 'JAILBREAK':
        return <JailbreakChallenge {...commonProps} />;
      case 'POLYGLOT':
        return <PolyglotChallenge {...commonProps} />;
      case 'LIE_DETECTOR':
        return <LieDetectorChallenge {...commonProps} />;
      case 'PROMPT_ZIPPER':
        return <PromptZipperChallenge {...commonProps} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
            <h2 className="text-2xl font-bold mb-4">{currentChallenge.title}</h2>
            <p className="text-gray-400 mb-8 max-w-2xl">{currentChallenge.description}</p>
            <div className="bg-yellow-900/20 text-yellow-500 border border-yellow-700/50 p-4 rounded-lg">
              Engine for '{currentChallenge.type}' is currently under construction!
            </div>
          </div>
        );
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-bold">Loading Boss Round...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500 font-bold bg-gray-900">{error}</div>;
  if (!currentChallenge) return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-400">No challenges found.</div>;

  const byokConfig = currentChallenge.configuration?.byok as BYOKConfig;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans">
      {confirmSubmit && (
        <ConfirmDialog
          title="Finish Round?"
          message="Are you sure you want to finish this round? Your progress will be submitted."
          confirmLabel="Finish Round"
          cancelLabel="Keep Going"
          variant="primary"
          onConfirm={executeSubmitRound}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}
      {/* BYOK Modal */}
      {showBYOKConnect && byokConfig && (
        <BYOKConnect 
          config={byokConfig}
          teamId={currentTeam!.id}
          roundSessionId={roundSession.id}
          challengeId={currentChallenge.id}
          onConnected={(provider) => {
            setActiveProvider(provider);
            setShowBYOKConnect(false);
          }}
          onCancel={() => setShowBYOKConnect(false)}
        />
      )}

      {/* Header */}
      <div className="bg-black/40 border-b border-gray-800 px-6 py-4 flex items-center justify-between shadow-2xl backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 uppercase tracking-wider">
            {round?.name || 'The Boss Round'}
          </h1>
          <p className="text-sm text-gray-400 mt-1 font-mono">Stage {currentChallengeIndex + 1} // {challenges.length}</p>
        </div>
        <div className="flex items-center gap-6">
          {activeProvider && (
            <div className="px-3 py-1.5 bg-green-900/30 border border-green-500/30 rounded-md flex items-center gap-2 text-sm text-green-400">
              <ShieldIcon className="w-4 h-4" />
              Connected: {activeProvider}
            </div>
          )}
          <div className="px-4 py-2 bg-gray-800/80 rounded-lg flex items-center gap-2 border border-gray-700">
            <ClockIcon className="w-5 h-5 text-purple-400" />
            <span className="font-mono text-xl font-bold tracking-wider">{formatTime(timeLeft)}</span>
          </div>
          <button onClick={handleSubmitRound} className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-pink-900/50">
            Extract Data
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stages Sidebar */}
        <div className="w-64 bg-gray-900/50 border-r border-gray-800 overflow-y-auto">
          {challenges.map((c, i) => (
            <button 
              key={c.id} 
              onClick={() => setCurrentChallengeIndex(i)}
              className={`w-full text-left p-4 border-b border-gray-800 transition-all ${currentChallengeIndex === i ? 'bg-gray-800 border-l-4 border-l-purple-500 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
            >
              <div className="font-bold text-sm tracking-wide">{c.title || `Stage ${i + 1}`}</div>
              <div className="text-xs opacity-60 mt-1 font-mono uppercase">{c.type.replace('_', ' ')} • {c.base_points} PTS</div>
            </button>
          ))}
        </div>

        {/* Dynamic Engine Container */}
        <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-gray-900 relative">
          {renderChallengeComponent()}
        </div>
      </div>
    </div>
  );
}
