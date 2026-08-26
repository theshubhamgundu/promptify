import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { CheckCircleIcon, XCircleIcon, TrophyIcon, ClockIcon, TargetIcon } from '../components/icons';

interface QuizResult {
  question_number: number;
  question_text: string;
  question_type: string;
  points: number;
  selected_options: string[];
  is_correct: boolean;
  points_earned: number;
  correct_options: string[];
  options: Array<{
    option_label: string;
    option_text: string;
    is_correct: boolean;
  }>;
}

interface QuizResultsProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

export default function QuizResults({ roundId, navigate }: QuizResultsProps) {
  const { currentTeam } = useTeamStore();
  
  const [results, setResults] = useState<QuizResult[]>([]);
  const [quizSession, setQuizSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  
  useEffect(() => {
    if (roundId && currentTeam?.id) {
      loadResults();
    }
  }, [roundId, currentTeam?.id]);
  
  const loadResults = async () => {
    try {
      setLoading(true);
      
      // Get quiz session
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          round:rounds(name)
        `)
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .single();
      
      if (sessionError) throw sessionError;
      setQuizSession(sessionData);
      
      // Get all answers with question details
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select(`
          *,
          question:quiz_questions(
            question_number,
            question_text,
            question_type,
            points,
            options:quiz_options(
              option_label,
              option_text,
              is_correct,
              order_index
            )
          )
        `)
        .eq('round_session_id', sessionData.round_session_id)
        .order('question(question_number)');
      
      if (answersError) throw answersError;
      
      // Transform data
      const resultsData = answersData.map((answer: any) => ({
        question_number: answer.question.question_number,
        question_text: answer.question.question_text,
        question_type: answer.question.question_type,
        points: answer.question.points,
        selected_options: answer.selected_options,
        is_correct: answer.is_correct,
        points_earned: answer.points_earned,
        correct_options: answer.question.options
          .filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.option_label)
          .sort(),
        options: answer.question.options.sort((a: any, b: any) => a.order_index - b.order_index),
      }));
      
      setResults(resultsData);
      
    } catch (err: any) {
      console.error('Error loading results:', err);
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <XCircleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Results</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate && navigate('dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  const scorePercentage = quizSession
    ? Math.round((quizSession.total_score / (quizSession.total_questions * (results[0]?.points || 1))) * 100)
    : 0;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <TrophyIcon className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-2">Quiz Complete!</h1>
            <p className="text-xl opacity-90">{quizSession?.round?.name}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <TargetIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm opacity-90 mb-1">Score</p>
              <p className="text-3xl font-bold">
                {quizSession?.total_score} / {quizSession?.total_questions * (results[0]?.points || 1)}
              </p>
              <p className="text-sm mt-1 opacity-75">{scorePercentage}%</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <CheckCircleIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm opacity-90 mb-1">Correct Answers</p>
              <p className="text-3xl font-bold">
                {quizSession?.correct_answers} / {quizSession?.total_questions}
              </p>
              <p className="text-sm mt-1 opacity-75">
                {Math.round((quizSession?.correct_answers / quizSession?.total_questions) * 100)}% accuracy
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <ClockIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm opacity-90 mb-1">Time Taken</p>
              <p className="text-3xl font-bold">
                {Math.floor((quizSession?.time_remaining_seconds || 0) / 60)}:{((quizSession?.time_remaining_seconds || 0) % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-sm mt-1 opacity-75">Time remaining</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Results Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Answer Review</h2>
          <button
            onClick={() => setShowAnswers(!showAnswers)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            {showAnswers ? 'Hide' : 'Show'} Correct Answers
          </button>
        </div>
        
        <div className="space-y-6">
          {results.map((result) => (
            <div
              key={result.question_number}
              className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${
                result.is_correct ? 'border-green-500' : 'border-red-500'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                      Q{result.question_number}
                    </span>
                    {result.is_correct ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircleIcon className="w-5 h-5" />
                        <span className="font-medium">Correct</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircleIcon className="w-5 h-5" />
                        <span className="font-medium">Incorrect</span>
                      </div>
                    )}
                    <span className="text-sm text-gray-600">
                      {result.points_earned} / {result.points} points
                    </span>
                  </div>
                  <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {result.question_text}
                  </p>
                </div>
              </div>
              
              {/* Options */}
              <div className="space-y-2">
                {result.options.map((option: any) => {
                  const isSelected = result.selected_options.includes(option.option_label);
                  const isCorrect = option.is_correct;
                  
                  let optionClass = 'bg-gray-50 border-gray-200';
                  if (showAnswers) {
                    if (isCorrect && isSelected) {
                      optionClass = 'bg-green-50 border-green-500';
                    } else if (isCorrect && !isSelected) {
                      optionClass = 'bg-green-50 border-green-300';
                    } else if (!isCorrect && isSelected) {
                      optionClass = 'bg-red-50 border-red-500';
                    }
                  } else if (isSelected) {
                    optionClass = result.is_correct
                      ? 'bg-green-50 border-green-500'
                      : 'bg-red-50 border-red-500';
                  }
                  
                  return (
                    <div
                      key={option.option_label}
                      className={`p-3 rounded-lg border-2 ${optionClass}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-gray-900">
                          {option.option_label}.
                        </span>
                        <span className="text-gray-700 flex-1">
                          {option.option_text}
                        </span>
                        {showAnswers && isCorrect && (
                          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        {isSelected && !showAnswers && (
                          <span className="text-xs font-medium text-gray-600 flex-shrink-0">
                            Your answer
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Explanation */}
              {showAnswers && !result.is_correct && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-1">Correct Answer:</p>
                  <p className="text-sm text-blue-800">
                    {result.correct_options.join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => navigate && navigate('dashboard')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate && navigate('leaderboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
