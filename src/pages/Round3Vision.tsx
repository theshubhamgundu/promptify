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
import type { Page } from '../components/Layout';
import {
  EyeIcon, ClockIcon, CheckCircleIcon, ArrowLeftIcon,
  TargetIcon, TrophyIcon
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

  const [session, setSession] = useState<Round3Session | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(40 * 60); // 40 minutes in seconds
  const [selectedTier, setSelectedTier] = useState<DifficultyTier>('TIER1');

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Vision Challenge...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-600">
          <p>Failed to load session</p>
          <button
            onClick={() => navigate('dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-2xl w-full bg-white rounded-xl border border-gray-200 shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrophyIcon className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Round 3 Complete!</h1>
            <p className="text-gray-600">Vision Challenge</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 mb-6 text-center border-2 border-blue-200">
            <div className="text-5xl font-black text-blue-600 mb-2">{session.total_score}</div>
            <div className="text-gray-700 font-medium">Total Points (out of 450)</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 text-center border-2 border-green-200">
              <div className="text-2xl font-bold text-green-700">{session.tier1_score}</div>
              <div className="text-xs text-gray-600 mt-1 font-medium">Tier 1</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center border-2 border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">{session.tier2_score}</div>
              <div className="text-xs text-gray-600 mt-1 font-medium">Tier 2</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center border-2 border-red-200">
              <div className="text-2xl font-bold text-red-700">{session.tier3_score}</div>
              <div className="text-xs text-gray-600 mt-1 font-medium">Tier 3</div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-600 mb-6">
            Completed {completedQuestions.size} of 30 questions
          </div>

          <button
            onClick={() => navigate('dashboard')}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
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
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentQuestionId(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="text-sm text-gray-600 font-medium">Round 3: Vision Challenge</div>
              <div className="text-lg font-bold text-gray-900">{currentQuestion.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg border-2 ${
              timeRemaining > 600 
                ? 'bg-green-50 border-green-300' 
                : timeRemaining > 300
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-center gap-2">
                <ClockIcon className={`w-4 h-4 ${
                  timeRemaining > 600 ? 'text-green-600' : timeRemaining > 300 ? 'text-yellow-600' : 'text-red-600'
                }`} />
                <span className={`text-lg font-mono font-bold ${
                  timeRemaining > 600 ? 'text-green-900' : timeRemaining > 300 ? 'text-yellow-900' : 'text-red-900'
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-lg border-2 border-blue-200">
              <div className="text-xl font-bold text-blue-900">{session.total_score}</div>
              <div className="text-xs text-gray-600 font-medium">Score</div>
            </div>
          </div>
        </div>

        {/* Challenge Component */}
        <div className="flex-1 overflow-hidden">
          <VisualChallenge
            challenge={currentQuestion}
            teamId={currentTeam!.id}
            roundSessionId={session.id}
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <EyeIcon className="w-6 h-6 text-blue-600" />
                Round 3: Vision Challenge
              </h1>
              <p className="text-sm text-gray-600 font-medium">30 questions • 40 minutes • 450 points</p>
            </div>
            <button
              onClick={() => navigate('dashboard')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium text-sm"
            >
              Exit
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className={`px-3 py-2 rounded-lg border-2 ${
              timeRemaining > 600 
                ? 'bg-green-50 border-green-300' 
                : timeRemaining > 300
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <ClockIcon className={`w-4 h-4 ${
                  timeRemaining > 600 ? 'text-green-600' : timeRemaining > 300 ? 'text-yellow-600' : 'text-red-600'
                }`} />
                <span className="text-xs text-gray-700 font-medium">Time</span>
              </div>
              <div className={`text-xl font-mono font-bold ${
                timeRemaining > 600 ? 'text-green-900' : timeRemaining > 300 ? 'text-yellow-900' : 'text-red-900'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg border-2 border-blue-200 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <TargetIcon className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-700 font-medium">Score</span>
              </div>
              <div className="text-xl font-bold text-blue-900">{session.total_score}</div>
            </div>

            <div className="bg-gray-100 rounded-lg border-2 border-gray-300 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-700 font-medium">Done</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{completedQuestions.size}/30</div>
            </div>
          </div>
        </div>

        {/* Tier Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSelectedTier('TIER1')}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all border-2 text-sm ${
              selectedTier === 'TIER1'
                ? 'bg-green-500 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tier 1 (10 pts)
          </button>
          <button
            onClick={() => setSelectedTier('TIER2')}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all border-2 text-sm ${
              selectedTier === 'TIER2'
                ? 'bg-yellow-500 text-white border-yellow-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tier 2 (15 pts)
          </button>
          <button
            onClick={() => setSelectedTier('TIER3')}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all border-2 text-sm ${
              selectedTier === 'TIER3'
                ? 'bg-red-500 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tier 3 (20 pts)
          </button>
        </div>

        {/* Tier Score */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-700 font-medium">
            {selectedTier === 'TIER1' && 'Tier 1 Score:'}
            {selectedTier === 'TIER2' && 'Tier 2 Score:'}
            {selectedTier === 'TIER3' && 'Tier 3 Score:'}
          </div>
          <div className="text-xl font-bold text-gray-900">
            {getTierScore(selectedTier)} / {getTierMaxScore(selectedTier)}
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-5 gap-3">
          {getTierQuestions(selectedTier).map(question => {
            const isCompleted = completedQuestions.has(question.id);
            
            return (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionId(question.id)}
                className={`aspect-square rounded-lg border-2 transition-all hover:scale-105 shadow-sm ${
                  isCompleted
                    ? 'bg-green-50 border-green-500'
                    : 'bg-white border-gray-200 hover:border-blue-400'
                }`}
              >
                <div className="p-3 flex flex-col items-center justify-center h-full">
                  {isCompleted ? (
                    <CheckCircleIcon className="w-7 h-7 text-green-600 mb-1" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center mb-1">
                      <span className="text-lg font-bold text-gray-700">{question.questionNumber}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-600 text-center line-clamp-2 font-medium mb-1">{question.title}</div>
                  <div className={`text-xs font-bold ${
                    selectedTier === 'TIER1' ? 'text-green-600' :
                    selectedTier === 'TIER2' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>{question.maxScore}pts</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
