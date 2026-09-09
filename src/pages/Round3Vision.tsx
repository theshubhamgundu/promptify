/**
 * Round 3: Vision Challenge
 * 
 * 30 questions across 3 tiers (Tier 1: 10pts, Tier 2: 15pts, Tier 3: 20pts)
 * Total: 450 points maximum
 * Time Limit: 40 minutes total
 * 
 * Deterministic evaluation using weighted pattern matching
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { useEventStore } from '../stores/eventStore';
import { VisualChallenge } from '../components/challenges/VisualChallenge';
import { ALL_ROUND3_QUESTIONS, getRound3Question, type DifficultyTier } from '../lib/round3-questions';
import { byokSession, type AIProvider } from '../lib/byok-service';
import type { Page } from '../components/Layout';
import {
  EyeIcon, ClockIcon, CheckCircleIcon, ArrowLeftIcon, LockIcon,
  TargetIcon, TrophyIcon, ZapIcon
} from '../components/icons';

interface Round3Session {
  id: string;
  team_id: string;
  round_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'TIMEOUT';
  total_score: number;
  tier1_score: number;
  tier2_score: number;
  tier3_score: number;
  questions_completed: string[]; // Array of question IDs
  time_remaining_seconds: number;
}

export default function Round3Vision({ roundId, navigate }: { roundId: string; navigate: (p: Page) => void }) {
  const currentTeam = useTeamStore(s => s.currentTeam);
  const dbRounds = useEventStore(s => s.rounds);
  
  // BYOK State - detect active provider
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);

  const [session, setSession] = useState<Round3Session | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(40 * 60); // 40 minutes in seconds
  const [selectedTier, setSelectedTier] = useState<DifficultyTier>('TIER1');

  const round = dbRounds.find(r => r.id === roundId);
  const currentQuestion = currentQuestionId ? getRound3Question(currentQuestionId) : null;

  // Detect active BYOK provider
  useEffect(() => {
    const providers: AIProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ', 'MISTRAL', 'COHERE'];
    const found = providers.find(p => byokSession.hasKey(p));
    if (found) {
      setActiveProvider(found);
    }
  }, []);

  const round = dbRounds.find(r => r.id === roundId);
  const currentQuestion = currentQuestionId ? getRound3Question(currentQuestionId) : null;

  // Load or create session
  useEffect(() => {
    if (!currentTeam || !roundId) return;

    async function loadSession() {
      setLoading(true);

      // Check for existing session
      const { data: existingSession } = await supabase
        .from('round3_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .single();

      if (existingSession) {
        setSession(existingSession as Round3Session);
        setCompletedQuestions(new Set(existingSession.questions_completed || []));
        setTimeRemaining(existingSession.time_remaining_seconds || 0);
      } else {
        // Create new session
        const { data: newSession, error } = await supabase
          .from('round3_sessions')
          .insert({
            team_id: currentTeam!.id,
            round_id: roundId,
            started_at: new Date().toISOString(),
            status: 'IN_PROGRESS',
            total_score: 0,
            tier1_score: 0,
            tier2_score: 0,
            tier3_score: 0,
            questions_completed: [],
            time_remaining_seconds: 40 * 60
          })
          .select()
          .single();

        if (!error && newSession) {
          setSession(newSession as Round3Session);
        }
      }

      setLoading(false);
    }

    loadSession();
  }, [currentTeam, roundId]);

  // Timer countdown
  useEffect(() => {
    if (!session || session.status !== 'IN_PROGRESS' || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = Math.max(0, prev - 1);
        
        // Update DB every 10 seconds
        if (newTime % 10 === 0 && session?.id) {
          supabase
            .from('round3_sessions')
            .update({ time_remaining_seconds: newTime })
            .eq('id', session.id)
            .then();
        }

        // Timeout
        if (newTime === 0 && session?.id) {
          supabase
            .from('round3_sessions')
            .update({ 
              status: 'TIMEOUT',
              completed_at: new Date().toISOString()
            })
            .eq('id', session.id)
            .then();
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session, timeRemaining]);

  // Handle question completion
  const handleQuestionComplete = useCallback(async () => {
    if (!currentQuestion || !session) return;

    // Reload session to get updated scores
    const { data: updatedSession } = await supabase
      .from('round3_sessions')
      .select('*')
      .eq('id', session.id)
      .single();

    if (updatedSession) {
      setSession(updatedSession as Round3Session);
      setCompletedQuestions(new Set(updatedSession.questions_completed || []));
    }

    // Return to question selection
    setCurrentQuestionId(null);
  }, [currentQuestion, session]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get tier questions
  const getTierQuestions = (tier: DifficultyTier) => {
    return ALL_ROUND3_QUESTIONS.filter(q => q.tier === tier);
  };

  // Calculate tier scores
  const getTierScore = (tier: DifficultyTier) => {
    if (tier === 'TIER1') return session?.tier1_score || 0;
    if (tier === 'TIER2') return session?.tier2_score || 0;
    return session?.tier3_score || 0;
  };

  const getTierMaxScore = (tier: DifficultyTier) => {
    const questions = getTierQuestions(tier);
    return questions.reduce((sum, q) => sum + q.maxScore, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Vision Challenge...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-400">
          <p>Failed to load session</p>
          <button
            onClick={() => navigate('dashboard')}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show completion screen
  if (session.status !== 'IN_PROGRESS' || timeRemaining === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
        <div className="max-w-2xl w-full bg-gray-800 rounded-xl border border-gray-700 p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrophyIcon className="w-10 h-10 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Round 3 Complete!</h1>
            <p className="text-gray-400">Vision Challenge</p>
          </div>

          <div className="bg-purple-900/30 rounded-xl p-6 mb-6 text-center border border-purple-700">
            <div className="text-5xl font-black text-purple-400 mb-2">{session.total_score}</div>
            <div className="text-gray-400">Total Points (out of 450)</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-4 text-center border border-gray-600">
              <div className="text-2xl font-bold text-green-400">{session.tier1_score}</div>
              <div className="text-xs text-gray-400 mt-1">Tier 1</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center border border-gray-600">
              <div className="text-2xl font-bold text-yellow-400">{session.tier2_score}</div>
              <div className="text-xs text-gray-400 mt-1">Tier 2</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center border border-gray-600">
              <div className="text-2xl font-bold text-red-400">{session.tier3_score}</div>
              <div className="text-xs text-gray-400 mt-1">Tier 3</div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-400 mb-6">
            Completed {completedQuestions.size} of 30 questions
          </div>

          <button
            onClick={() => navigate('dashboard')}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show individual question challenge
  if (currentQuestion) {
    return (
      <div className="h-screen flex flex-col bg-gray-900">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentQuestionId(null)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <div className="text-sm text-gray-400">Round 3: Vision Challenge</div>
              <div className="text-lg font-bold text-white">{currentQuestion.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg border ${
              timeRemaining > 600 
                ? 'bg-green-900/30 border-green-700' 
                : timeRemaining > 300
                ? 'bg-yellow-900/30 border-yellow-700'
                : 'bg-red-900/30 border-red-700'
            }`}>
              <div className="flex items-center gap-2">
                <ClockIcon className={`w-4 h-4 ${
                  timeRemaining > 600 ? 'text-green-400' : timeRemaining > 300 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className={`text-lg font-mono font-bold ${
                  timeRemaining > 600 ? 'text-green-400' : timeRemaining > 300 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
            <div className="bg-gray-700 px-4 py-2 rounded-lg border border-gray-600">
              <div className="text-xl font-bold text-white">{session.total_score}</div>
              <div className="text-xs text-gray-400">Score</div>
            </div>
          </div>
        </div>

        {/* Challenge Component */}
        <div className="flex-1 overflow-hidden">
          <VisualChallenge
            challenge={currentQuestion}
            teamId={currentTeam!.id}
            roundSessionId={session.id}
            activeProvider={activeProvider}
            onComplete={handleQuestionComplete}
          />
        </div>
      </div>
    );
  }

  // Show question selection grid
  const tier1Questions = getTierQuestions('TIER1');
  const tier2Questions = getTierQuestions('TIER2');
  const tier3Questions = getTierQuestions('TIER3');

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <EyeIcon className="w-8 h-8 text-purple-400" />
                Round 3: Vision Challenge
              </h1>
              <p className="text-gray-400">30 questions • 40 minutes • 450 points total</p>
            </div>
            <button
              onClick={() => navigate('dashboard')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Exit Round
            </button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className={`px-4 py-2 rounded-lg border ${
              timeRemaining > 600 
                ? 'bg-green-900/30 border-green-700' 
                : timeRemaining > 300
                ? 'bg-yellow-900/30 border-yellow-700'
                : 'bg-red-900/30 border-red-700'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <ClockIcon className={`w-4 h-4 ${
                  timeRemaining > 600 ? 'text-green-400' : timeRemaining > 300 ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <span className="text-xs text-gray-400">Time Remaining</span>
              </div>
              <div className={`text-2xl font-mono font-bold ${
                timeRemaining > 600 ? 'text-green-400' : timeRemaining > 300 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>

            <div className="bg-purple-900/30 rounded-lg border border-purple-700 px-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <TargetIcon className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">Total Score</span>
              </div>
              <div className="text-2xl font-bold text-purple-400">{session.total_score}</div>
            </div>

            <div className="bg-gray-700/50 rounded-lg border border-gray-600 px-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircleIcon className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Completed</span>
              </div>
              <div className="text-2xl font-bold text-white">{completedQuestions.size}/30</div>
            </div>

            <div className="bg-gray-700/50 rounded-lg border border-gray-600 px-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <ZapIcon className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Provider</span>
              </div>
              <div className="text-sm font-bold text-white">
                {activeProvider ? activeProvider.provider.toUpperCase() : 'None'}
              </div>
            </div>
          </div>
        </div>

        {/* Tier Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedTier('TIER1')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold transition-all ${
              selectedTier === 'TIER1'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            Tier 1: Easy (10 pts each)
          </button>
          <button
            onClick={() => setSelectedTier('TIER2')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold transition-all ${
              selectedTier === 'TIER2'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            Tier 2: Medium (15 pts each)
          </button>
          <button
            onClick={() => setSelectedTier('TIER3')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold transition-all ${
              selectedTier === 'TIER3'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            Tier 3: Hard (20 pts each)
          </button>
        </div>

        {/* Tier Score Summary */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-gray-400">
              {selectedTier === 'TIER1' && 'Tier 1 Score:'}
              {selectedTier === 'TIER2' && 'Tier 2 Score:'}
              {selectedTier === 'TIER3' && 'Tier 3 Score:'}
            </div>
            <div className="text-2xl font-bold text-white">
              {getTierScore(selectedTier)} / {getTierMaxScore(selectedTier)}
            </div>
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-5 gap-4">
          {getTierQuestions(selectedTier).map(question => {
            const isCompleted = completedQuestions.has(question.id);
            
            return (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionId(question.id)}
                className={`aspect-square rounded-xl border-2 transition-all hover:scale-105 ${
                  isCompleted
                    ? 'bg-green-900/30 border-green-600'
                    : 'bg-gray-800 border-gray-700 hover:border-purple-500'
                }`}
              >
                <div className="p-4 flex flex-col items-center justify-center h-full">
                  {isCompleted ? (
                    <CheckCircleIcon className="w-8 h-8 text-green-400 mb-2" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mb-2">
                      <span className="text-xl font-bold text-gray-300">{question.questionNumber}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 text-center line-clamp-2">{question.title}</div>
                  <div className="text-xs font-bold text-purple-400 mt-1">{question.maxScore} pts</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
