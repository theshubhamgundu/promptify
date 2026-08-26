import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEventStore } from '../stores/eventStore';
import { useTeamStore } from '../stores/teamStore';
import { CheckCircleIcon, CircleIcon, ClockIcon, ExclamationCircleIcon, ShieldExclamationIcon } from '../components/icons';

interface QuizQuestion {
  id: string;
  question_number: number;
  question_text: string;
  question_type: 'SINGLE_ANSWER' | 'MULTI_SELECT';
  image_url?: string;
  points: number;
  options: QuizOption[];
}

interface QuizOption {
  id: string;
  option_label: string;
  option_text: string;
  order_index: number;
}

interface QuizAnswer {
  question_id: string;
  selected_options: string[];
}

interface QuizSession {
  id: string;
  started_at: string;
  time_remaining_seconds: number | null;
  total_questions: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
}

interface SecurityViolation {
  type: 'tab_switch' | 'copy' | 'paste' | 'screenshot' | 'inspect';
  timestamp: Date;
  message: string;
}

interface QuizRoundProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

export default function QuizRound({ roundId, navigate }: QuizRoundProps) {
  const { currentEvent } = useEventStore();
  const { currentTeam } = useTeamStore();
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [roundSession, setRoundSession] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Security monitoring
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [securityWarnings, setSecurityWarnings] = useState(0);
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'warning' | 'error' } | null>(null);
  const isQuizActive = useRef(true);
  
  // Toast notification effect
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  // Security: Tab visibility monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isQuizActive.current) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        
        const violation: SecurityViolation = {
          type: 'tab_switch',
          timestamp: new Date(),
          message: `Tab switch detected (${newCount}/3)`
        };
        setViolations(prev => [...prev, violation]);
        
        if (newCount >= 3) {
          setToast({ 
            message: 'Maximum tab switches exceeded. Quiz will be auto-submitted.', 
            type: 'error' 
          });
          setTimeout(() => handleAutoSubmit('Tab switching limit exceeded'), 2000);
        } else {
          setToast({ 
            message: `Warning: Tab switch detected (${newCount}/3). Quiz will auto-submit after 3 switches.`, 
            type: 'warning' 
          });
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tabSwitchCount]);
  
  // Security: Prevent copy/paste/screenshot/inspect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (inspect)
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        recordSecurityViolation('inspect', 'Developer tools access blocked');
        return false;
      }
      
      // Prevent PrintScreen, Alt+PrintScreen (screenshot)
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        recordSecurityViolation('screenshot', 'Screenshot attempt blocked');
        return false;
      }
      
      // Prevent Ctrl+C (copy)
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        recordSecurityViolation('copy', 'Copy attempt blocked');
        return false;
      }
      
      // Prevent Ctrl+V (paste)
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        recordSecurityViolation('paste', 'Paste attempt blocked');
        return false;
      }
    };
    
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recordSecurityViolation('copy', 'Copy attempt blocked');
      return false;
    };
    
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      recordSecurityViolation('paste', 'Paste attempt blocked');
      return false;
    };
    
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordSecurityViolation('inspect', 'Right-click blocked');
      return false;
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [securityWarnings]);
  
  const recordSecurityViolation = (type: SecurityViolation['type'], message: string) => {
    const newCount = securityWarnings + 1;
    setSecurityWarnings(newCount);
    
    const violation: SecurityViolation = {
      type,
      timestamp: new Date(),
      message: `${message} (${newCount}/5)`
    };
    setViolations(prev => [...prev, violation]);
    
    if (newCount >= 5) {
      setToast({ 
        message: 'Maximum security violations exceeded. Quiz will be auto-submitted.', 
        type: 'error' 
      });
      setTimeout(() => handleAutoSubmit('Security violation limit exceeded'), 2000);
    } else {
      setToast({ 
        message: `${message} (${newCount}/5)`, 
        type: 'warning' 
      });
    }
  };
  
  const handleAutoSubmit = async (reason: string) => {
    if (!isQuizActive.current || submitting) return;
    
    isQuizActive.current = false;
    console.log('Auto-submitting quiz:', reason);
    
    await submitQuizInternal(true, reason);
  };
  
  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (quizSession?.status === 'IN_PROGRESS') {
            handleAutoSubmit('Time expired');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, quizSession?.status]);
  
  useEffect(() => {
    if (roundId && currentTeam?.id) {
      initializeQuiz();
    }
  }, [roundId, currentTeam?.id]);
  
  const initializeQuiz = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get round details
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', roundId)
        .single();
      
      if (roundError) throw roundError;
      setRound(roundData);
      
      // Get or create round session
      let { data: sessionData, error: sessionError } = await supabase
        .from('round_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .single();
      
      if (sessionError && sessionError.code !== 'PGRST116') {
        throw sessionError;
      }
      
      if (!sessionData) {
        // Create new round session
        const { data: newSession, error: createError } = await supabase
          .from('round_sessions')
          .insert({
            team_id: currentTeam!.id,
            round_id: roundId,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (createError) throw createError;
        sessionData = newSession;
      }
      
      setRoundSession(sessionData);
      
      // Start or get quiz session
      const { data: quizSessionData, error: quizError } = await supabase
        .rpc('start_quiz_session', {
          p_team_id: currentTeam!.id,
          p_round_id: roundId,
          p_round_session_id: sessionData.id,
        });
      
      if (quizError) throw quizError;
      
      // Get quiz session details
      const { data: sessionDetails, error: sessionDetailsError } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', quizSessionData)
        .single();
      
      if (sessionDetailsError) throw sessionDetailsError;
      setQuizSession(sessionDetails);
      
      // Load questions with options
      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          options:quiz_options(*)
        `)
        .eq('round_id', roundId)
        .order('order_index');
      
      if (questionsError) throw questionsError;
      setQuestions(questionsData);
      
      // Load existing answers
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select('question_id, selected_options')
        .eq('round_session_id', sessionData.id);
      
      if (answersError) throw answersError;
      
      // Populate answers map
      const answersMap = new Map<string, string[]>();
      answersData?.forEach((answer: QuizAnswer) => {
        answersMap.set(answer.question_id, answer.selected_options);
      });
      setAnswers(answersMap);
      
      // Start timer
      const duration = sessionDetails.time_remaining_seconds 
        ?? roundData.duration_minutes * 60;
      setTimeLeft(duration);
      
    } catch (err: any) {
      console.error('Error initializing quiz:', err);
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOptionSelect = (questionId: string, optionLabel: string, questionType: string) => {
    const currentAnswer = answers.get(questionId) || [];
    
    let newAnswer: string[];
    if (questionType === 'SINGLE_ANSWER') {
      // Replace with new selection
      newAnswer = [optionLabel];
    } else {
      // Toggle multi-select
      if (currentAnswer.includes(optionLabel)) {
        newAnswer = currentAnswer.filter(a => a !== optionLabel);
      } else {
        newAnswer = [...currentAnswer, optionLabel].sort();
      }
    }
    
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, newAnswer);
    setAnswers(newAnswers);
    
    // Auto-save answer
    saveAnswer(questionId, newAnswer);
  };
  
  const saveAnswer = async (questionId: string, selectedOptions: string[]) => {
    try {
      const { error } = await supabase.rpc('submit_quiz_answer', {
        p_team_id: currentTeam!.id,
        p_round_session_id: roundSession!.id,
        p_question_id: questionId,
        p_selected_options: selectedOptions,
      });
      
      if (error) throw error;
    } catch (err: any) {
      console.error('Error saving answer:', err);
    }
  };
  
  const handleSubmitQuiz = async () => {
    if (!confirm('Are you sure you want to submit your quiz? You cannot change answers after submission.')) {
      return;
    }
    
    await submitQuizInternal(false);
  };
  
  const submitQuizInternal = async (isAutoSubmit: boolean, reason?: string) => {
    try {
      setSubmitting(true);
      isQuizActive.current = false;
      
      // Update quiz session status
      const { error: updateError } = await supabase
        .from('quiz_sessions')
        .update({
          submitted_at: new Date().toISOString(),
          time_remaining_seconds: timeLeft,
          status: 'SUBMITTED',
        })
        .eq('id', quizSession!.id);
      
      if (updateError) throw updateError;
      
      // Calculate score
      const { data: score, error: scoreError } = await supabase
        .rpc('calculate_quiz_score', {
          p_round_session_id: roundSession!.id,
        });
      
      if (scoreError) throw scoreError;
      
      // Update round session
      const { error: sessionError } = await supabase
        .from('round_sessions')
        .update({
          completed_at: new Date().toISOString(),
          score: score,
        })
        .eq('id', roundSession!.id);
      
      if (sessionError) throw sessionError;
      
      // Log violations if auto-submitted
      if (isAutoSubmit && violations.length > 0) {
        console.log('Security violations recorded:', violations);
        // You could store violations in DB here
      }
      
      // Navigate to dashboard
      if (navigate) {
        navigate('dashboard');
      }
      
    } catch (err: any) {
      console.error('Error submitting quiz:', err);
      setError(err.message || 'Failed to submit quiz');
      setSubmitting(false);
      isQuizActive.current = true;
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <ExclamationCircleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Quiz</h2>
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
  
  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ExclamationCircleIcon className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <p className="text-gray-600">No questions available for this quiz.</p>
        </div>
      </div>
    );
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers.get(currentQuestion.id) || [];
  const answeredCount = Array.from(answers.values()).filter(a => a.length > 0).length;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${
            toast.type === 'error' 
              ? 'bg-red-50 border-2 border-red-500' 
              : 'bg-yellow-50 border-2 border-yellow-500'
          }`}>
            <ShieldExclamationIcon className={`w-6 h-6 ${
              toast.type === 'error' ? 'text-red-600' : 'text-yellow-600'
            }`} />
            <span className={`font-medium ${
              toast.type === 'error' ? 'text-red-900' : 'text-yellow-900'
            }`}>
              {toast.message}
            </span>
          </div>
        </div>
      )}
      
      {/* Left Sidebar - Question Navigator */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-lg mb-1">Questions</h2>
          <p className="text-sm text-gray-600">
            {answeredCount} of {questions.length} answered
          </p>
        </div>
        
        <div className="p-4 space-y-2">
          {questions.map((question, idx) => {
            const isAnswered = answers.has(question.id) && answers.get(question.id)!.length > 0;
            const isCurrent = idx === currentQuestionIndex;
            
            return (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-md'
                    : isAnswered
                    ? 'bg-green-50 text-green-900 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Question {idx + 1}</span>
                  {isAnswered && !isCurrent && (
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div className="text-xs mt-1 opacity-75">
                  {question.points} {question.points === 1 ? 'pt' : 'pts'}
                  {question.image_url && ' • Has image'}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Submit Button in Sidebar */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSubmitQuiz}
            disabled={submitting}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'End Quiz'}
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{round?.name}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Security Status */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <ShieldExclamationIcon className="w-5 h-5 text-gray-600" />
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      Tabs: {tabSwitchCount}/3 • Warns: {securityWarnings}/5
                    </div>
                  </div>
                </div>
                
                {/* Timer */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeLeft < 300 ? 'bg-red-50' : 'bg-blue-50'
                }`}>
                  <ClockIcon className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                  <span className={`font-mono text-lg font-bold ${
                    timeLeft < 300 ? 'text-red-900' : 'text-blue-900'
                  }`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Question Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              {/* Question Header */}
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  Q{currentQuestion.question_number}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                  {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
                </span>
                {currentQuestion.question_type === 'MULTI_SELECT' && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                    Select Multiple
                  </span>
                )}
              </div>
              
              {/* Question Image - ONLY for image-based questions */}
              {currentQuestion.image_url && (
                <div className="mb-6">
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="w-full max-w-3xl mx-auto rounded-lg shadow-sm"
                    style={{ imageRendering: 'high-quality' }}
                  />
                </div>
              )}
              
              {/* Question Text - ONLY if not image-only question */}
              {currentQuestion.question_text && currentQuestion.question_text.trim() !== '' && (
                <div className="mb-6">
                  <p className="text-xl text-gray-900 leading-relaxed">
                    {currentQuestion.question_text}
                  </p>
                </div>
              )}
              
              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((option) => {
                    const isSelected = currentAnswer.includes(option.option_label);
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleOptionSelect(
                          currentQuestion.id,
                          option.option_label,
                          currentQuestion.question_type
                        )}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {isSelected ? (
                              <CheckCircleIcon className="w-6 h-6 text-blue-600" />
                            ) : (
                              <CircleIcon className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-bold text-gray-900 mr-2">
                              {option.option_label}.
                            </span>
                            <span className="text-gray-700 text-lg">
                              {option.option_text}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
            
            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <button
                onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
