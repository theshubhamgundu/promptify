import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Page } from '../components/Layout';
import { useTeamStore } from '../stores/teamStore';
import { Round5Layout } from '../components/round5/Round5Layout';
import { ChallengeHeader } from '../components/round5/ChallengeHeader';
import { AIWorkspace } from '../components/round5/AIWorkspace';
import { PromptSheet } from '../components/round5/PromptSheet';

// Challenge implementations (Stubbed for now)
import { ArchitectChallenge } from '../components/round5/architect/ArchitectChallenge';
import { ModelDuelChallenge } from '../components/round5/model-duel/ModelDuelChallenge';
import { NegotiatorChallenge } from '../components/round5/negotiator/NegotiatorChallenge';
import { EmergenceChallenge } from '../components/round5/emergence/EmergenceChallenge';

interface Round5EngineProps {
  roundId: string;
  navigate: (p: Page) => void;
}

export default function Round5Engine({ roundId, navigate }: Round5EngineProps) {
  const currentTeam = useTeamStore(s => s.currentTeam);

  const [round, setRound] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  
  const [roundSession, setRoundSession] = useState<any>(null);
  const [challengeSession, setChallengeSession] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRoundFinished, setIsRoundFinished] = useState<boolean>(false);
  const [promptSheetTrigger, setPromptSheetTrigger] = useState<number>(0);

  // Mark round as completed when finished
  useEffect(() => {
    if (isRoundFinished && roundSession?.id && roundSession.status !== 'COMPLETED') {
      supabase
        .from('round_sessions')
        .update({ 
          status: 'COMPLETED', 
          completed_at: new Date().toISOString(),
          score: roundSession.score || 0
        })
        .eq('id', roundSession.id)
        .then(() => console.log('Round 5 marked as COMPLETED'));
    }
  }, [isRoundFinished, roundSession?.id, roundSession?.status, roundSession?.score]);

  // 1. Fetch Round and Challenges
  useEffect(() => {
    async function loadRoundData() {
      if (!currentTeam) return;

      setIsLoading(true);
      try {
        // Fetch Round
        const { data: rData } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', roundId)
          .single();

        setRound(rData);

        // Fetch Challenges ordered by index
        const { data: cData } = await supabase
          .from('challenges')
          .select('*')
          .eq('round_id', roundId)
          .order('order_index', { ascending: true });

        if (cData && cData.length > 0) {
          setChallenges(cData);
        }

        // Get or Create Round Session
        let { data: rsData } = await supabase
          .from('round_sessions')
          .select('*')
          .eq('team_id', currentTeam.id)
          .eq('round_id', roundId)
          .maybeSingle();

        if (!rsData) {
          const { data: newRs, error: insertErr } = await supabase
            .from('round_sessions')
            .insert({
              team_id: currentTeam.id,
              round_id: roundId,
              started_at: new Date().toISOString()
            })
            .select()
            .maybeSingle();
            
          if (insertErr) {
            // If duplicate key error (409) due to concurrent mount, just re-fetch
            const { data: retryRs } = await supabase
              .from('round_sessions')
              .select('*')
              .eq('team_id', currentTeam.id)
              .eq('round_id', roundId)
              .maybeSingle();
            rsData = retryRs;
          } else {
            rsData = newRs;
          }
        }

        if (rsData?.completed_at) {
          setIsRoundFinished(true);
        } else {
          setRoundSession(rsData);
        }
      } catch (e) {
        console.error('Error loading round 5:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadRoundData();
  }, [currentTeam, roundId]);

  // 2. Start current challenge
  useEffect(() => {
    async function startChallenge() {
      if (!roundSession || challenges.length === 0 || isRoundFinished || !currentTeam) return;
      
      const currentChallenge = challenges[currentIdx];
      if (!currentChallenge) return;

      try {
        // Check if challenge session already exists
        let { data: existingSession } = await supabase
          .from('challenge_sessions')
          .select('*')
          .eq('round_session_id', roundSession.id)
          .eq('challenge_id', currentChallenge.id)
          .maybeSingle();

        if (existingSession) {
          setChallengeSession(existingSession);
          if (existingSession.status === 'COMPLETED' || existingSession.status === 'TIMEOUT') {
            handleChallengeComplete();
          }
          return;
        }

        // Create new challenge session
        const durationMinutes = currentChallenge.configuration?.durationMinutes || 10;
        const startTime = new Date();
        const deadlineTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

        const { data: newSession, error } = await supabase
          .from('challenge_sessions')
          .insert({
            team_id: currentTeam.id,
            round_session_id: roundSession.id,
            challenge_id: currentChallenge.id,
            started_at: startTime.toISOString(),
            deadline_at: deadlineTime.toISOString(),
            status: 'IN_PROGRESS'
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating challenge session:', error);
          return;
        }

        setChallengeSession(newSession);
      } catch (e) {
        console.error('Error starting challenge:', e);
      }
    }

    startChallenge();
  }, [currentIdx, roundSession, challenges, currentTeam, isRoundFinished]);

  const handleChallengeComplete = async () => {
    if (currentIdx < challenges.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setChallengeSession(null);
    } else {
      // Complete entire round - just set flag, useEffect will update DB
      setIsRoundFinished(true);
    }
  };

  const handleTimeEnd = () => {
    // Challenge timed out
    handleChallengeComplete();
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-white text-slate-500">Loading...</div>;
  }

  if (isRoundFinished) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 text-slate-600 items-center justify-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Round 5 Complete</h1>
        <p className="text-slate-500 mb-8">You have completed all AI Systems Challenges.</p>
        <button 
          onClick={() => navigate('dashboard')}
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!roundSession || !challenges.length || !challengeSession) {
    return <div className="flex h-screen items-center justify-center bg-white text-slate-500">Preparing challenge...</div>;
  }

  const currentChallenge = challenges[currentIdx];
  const durationMinutes = currentChallenge.configuration?.durationMinutes || 10;
  
  // Render specific challenge component based on type
  let ChallengeComponent = null;
  switch (currentChallenge.type) {
    case 'AI_ARCHITECT':
      ChallengeComponent = <ArchitectChallenge challenge={currentChallenge} challengeSession={challengeSession} onComplete={handleChallengeComplete} />;
      break;
    case 'MODEL_DUEL':
      ChallengeComponent = <ModelDuelChallenge challenge={currentChallenge} challengeSession={challengeSession} onComplete={handleChallengeComplete} />;
      break;
    case 'AI_NEGOTIATOR':
      ChallengeComponent = <NegotiatorChallenge challenge={currentChallenge} challengeSession={challengeSession} onComplete={handleChallengeComplete} />;
      break;
    case 'EMERGENCE':
      ChallengeComponent = <EmergenceChallenge challenge={currentChallenge} challengeSession={challengeSession} onComplete={handleChallengeComplete} />;
      break;
    default:
      ChallengeComponent = <div className="p-8">Unknown challenge type: {currentChallenge.type}</div>;
  }

  return (
    <Round5Layout
      header={
        <ChallengeHeader
          challengeName={currentChallenge.title}
          challengeIndex={currentIdx}
          totalChallenges={challenges.length}
          deadlineAt={challengeSession.deadline_at}
          totalSeconds={durationMinutes * 60}
          score={roundSession.score || 0}
          onTimeEnd={handleTimeEnd}
        />
      }
      leftPanel={ChallengeComponent}
      rightPanel={
        <AIWorkspace
          eventId={round.event_id}
          roundId={round.id}
          challengeId={currentChallenge.id}
          roundSessionId={roundSession.id}
          challengeSessionId={challengeSession.id}
          teamId={currentTeam!.id}
          participantId={currentTeam!.id} // Using team ID as participant ID for now if user auth isn't fully set up in this context
          challengeConfig={currentChallenge.configuration}
          onNewInteraction={() => setPromptSheetTrigger(t => t + 1)}
        />
      }
      promptSheet={
        <PromptSheet 
          challengeSessionId={challengeSession.id}
          refreshTrigger={promptSheetTrigger}
        />
      }
    />
  );
}
