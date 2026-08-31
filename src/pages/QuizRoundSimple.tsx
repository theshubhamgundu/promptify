import { useState, useEffect } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { CheckCircleIcon, CircleIcon, ClockIcon } from '../components/icons';
import { ConfirmDialog } from '../components/ui';
import { SECOND_YEAR_QUESTIONS, THIRD_YEAR_QUESTIONS, FOURTH_YEAR_QUESTIONS, calculateScore, type QuizQuestion } from '../data/quiz-questions';

interface QuizRoundSimpleProps {
  roundId?: string;
  navigate?: (page: any) => void;
}

export default function QuizRoundSimple({ roundId, navigate }: QuizRoundSimpleProps) {
  const { currentTeam } = useTeamStore();
  
  // Determine which question set to use based on round ID or other logic
  const [questions] = useState<QuizQuestion[]>(() => {
    // Parse roundId to determine which quiz to use
    // Expected format: "quiz-{uuid}" from database round
    // We'll use 2nd year as default for now
    // You can enhance this logic to check round metadata from database
    
    // For demo: Use roundId string to determine quiz level
    if (roundId?.includes('4th') || roundId?.includes('fourth')) {
      return FOURTH_YEAR_QUESTIONS;
    } else if (roundId?.includes('3rd') || roundId?.includes('third')) {
      return THIRD_YEAR_QUESTIONS;
    } else {
      // Default to 2nd year
      return SECOND_YEAR_QUESTIONS;
    }
  });
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
  const [markedQuestions, setMarkedQuestions] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [securityViolationCount, setSecurityViolationCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'warning' | 'error' | 'success' } | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  
  const showToast = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Security: Disable right-click, copy, paste, screenshots
  useEffect(() => {
    const preventRightClick = (e: MouseEvent) => {
      e.preventDefault();
      if (securityViolationCount < 4) {
        setSecurityViolationCount(prev => prev + 1);
        showToast(`⚠️ Right-click disabled! Warning ${securityViolationCount + 1}/5`, 'warning');
      } else {
        showToast('🚫 Too many violations! Auto-submitting quiz...', 'error');
        setTimeout(() => handleSubmitQuiz(), 1000);
      }
    };
    
    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      if (securityViolationCount < 4) {
        setSecurityViolationCount(prev => prev + 1);
        showToast(`⚠️ Copy disabled! Warning ${securityViolationCount + 1}/5`, 'warning');
      } else {
        showToast('🚫 Too many violations! Auto-submitting quiz...', 'error');
        setTimeout(() => handleSubmitQuiz(), 1000);
      }
    };
    
    const preventPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      if (securityViolationCount < 4) {
        setSecurityViolationCount(prev => prev + 1);
        showToast(`⚠️ Paste disabled! Warning ${securityViolationCount + 1}/5`, 'warning');
      } else {
        showToast('🚫 Too many violations! Auto-submitting quiz...', 'error');
        setTimeout(() => handleSubmitQuiz(), 1000);
      }
    };
    
    const preventScreenshot = (e: KeyboardEvent) => {
      // Prevent PrintScreen, Ctrl+P, F12, Ctrl+Shift+I/J/C
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.key === 'p') ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'I', 'J', 'C'].includes(e.key))
      ) {
        e.preventDefault();
        if (securityViolationCount < 4) {
          setSecurityViolationCount(prev => prev + 1);
          showToast(`⚠️ Action blocked! Warning ${securityViolationCount + 1}/5`, 'warning');
        } else {
          showToast('🚫 Too many violations! Auto-submitting quiz...', 'error');
          setTimeout(() => handleSubmitQuiz(), 1000);
        }
        return false;
      }
    };
    
    if (!isSubmitted) {
      document.addEventListener('contextmenu', preventRightClick);
      document.addEventListener('copy', preventCopy);
      document.addEventListener('paste', preventPaste);
      document.addEventListener('keydown', preventScreenshot);
      document.addEventListener('keyup', preventScreenshot);
    }
    
    return () => {
      document.removeEventListener('contextmenu', preventRightClick);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('paste', preventPaste);
      document.removeEventListener('keydown', preventScreenshot);
      document.removeEventListener('keyup', preventScreenshot);
    };
  }, [isSubmitted, securityViolationCount]);
  
  // Security: Detect tab switching and warn (max 3 times)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted) {
        if (tabSwitchCount < 2) {
          setTabSwitchCount(prev => prev + 1);
          showToast(`⚠️ Tab switching not allowed! Warning ${tabSwitchCount + 1}/3`, 'warning');
        } else {
          showToast('🚫 Too many tab switches! Auto-submitting quiz...', 'error');
          setTimeout(() => handleSubmitQuiz(), 1000);
        }
      }
    };
    
    if (!isSubmitted) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSubmitted, tabSwitchCount]);
  
  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);
  
  const handleOptionSelect = (questionId: string, optionLabel: string, questionType: string) => {
    if (isSubmitted) return;
    
    const currentAnswer = answers.get(questionId) || [];
    
    let newAnswer: string[];
    if (questionType === 'SINGLE_ANSWER') {
      newAnswer = [optionLabel];
    } else {
      // Multi-select: toggle
      if (currentAnswer.includes(optionLabel)) {
        newAnswer = currentAnswer.filter(a => a !== optionLabel);
      } else {
        newAnswer = [...currentAnswer, optionLabel].sort();
      }
    }
    
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, newAnswer);
    setAnswers(newAnswers);
  };
  
  const handleSubmitQuiz = () => {
    if (isSubmitted) return;
    
    setIsSubmitted(true);
    
    // Calculate score
    const scoreResult = calculateScore(questions, answers);
    
    // Score is calculated client-side for display; the authoritative score is recorded via submit_round_session RPC
    // Show success message and navigate to dashboard
    showToast(`✅ Quiz submitted! Score: ${scoreResult.totalScore}/${scoreResult.totalPoints}`, 'success');
    setTimeout(() => {
      if (navigate) {
        navigate('dashboard');
      }
    }, 2000);
  };
  
  const handleEndQuiz = () => {
    setConfirmSubmit(true);
  };
  
  const toggleMarkQuestion = () => {
    const newMarked = new Set(markedQuestions);
    if (newMarked.has(currentQuestion.id)) {
      newMarked.delete(currentQuestion.id);
    } else {
      newMarked.add(currentQuestion.id);
    }
    setMarkedQuestions(newMarked);
  };
  
  if (showResults) {
    const scoreResult = calculateScore(questions, answers);
    
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center">
              <div className="text-5xl mb-3">🏆</div>
              <h1 className="text-3xl font-bold mb-1">Quiz Complete!</h1>
              <p className="text-lg opacity-90">Prompt Engineering Fundamentals</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-xs opacity-90 mb-1">Score</p>
                <p className="text-2xl font-bold">
                  {scoreResult.totalScore} / {scoreResult.totalPoints}
                </p>
                <p className="text-xs mt-0.5 opacity-75">
                  {Math.round((scoreResult.totalScore / scoreResult.totalPoints) * 100)}%
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <CheckCircleIcon className="w-6 h-6 mx-auto mb-1" />
                <p className="text-xs opacity-90 mb-1">Correct Answers</p>
                <p className="text-2xl font-bold">
                  {scoreResult.correctCount} / {questions.length}
                </p>
                <p className="text-xs mt-0.5 opacity-75">
                  {Math.round((scoreResult.correctCount / questions.length) * 100)}% accuracy
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <ClockIcon className="w-6 h-6 mx-auto mb-1" />
                <p className="text-xs opacity-90 mb-1">Time Taken</p>
                <p className="text-2xl font-bold">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-xs mt-0.5 opacity-75">Time remaining</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scrollable Results Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-4">
              {questions.map((question, idx) => {
                const userAnswer = answers.get(question.id) || [];
                const result = scoreResult.results[idx];
                
                return (
                  <div
                    key={question.id}
                    className={`bg-white rounded-lg shadow-sm p-5 border-l-4 ${
                      result.isCorrect ? 'border-green-500' : 'border-red-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                            Q{question.questionNumber}
                          </span>
                          {result.isCorrect ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircleIcon className="w-4 h-4" />
                              <span className="text-sm font-medium">Correct</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600">
                              <span className="text-sm font-medium">✗ Incorrect</span>
                            </div>
                          )}
                          <span className="text-xs text-gray-600">
                            {result.pointsEarned} / {question.points} pts
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                          {question.questionText}
                        </p>
                        
                        {/* Display image if question has one - Larger and clearer in results */}
                        {question.imageUrl && (
                          <div className="mt-4 bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                            <img 
                              src={question.imageUrl} 
                              alt={`Question ${question.questionNumber} reference image`}
                              className="w-full max-w-3xl mx-auto rounded-lg shadow-lg border border-gray-300"
                              style={{ imageRendering: 'crisp-edges' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Options */}
                    <div className="space-y-2 mt-3">
                      {question.options.map((option) => {
                        const isSelected = userAnswer.includes(option.label);
                        const isCorrect = question.correctAnswers.includes(option.label);
                        
                        let optionClass = 'bg-gray-50 border-gray-200';
                        if (isCorrect && isSelected) {
                          optionClass = 'bg-green-50 border-green-500';
                        } else if (isCorrect && !isSelected) {
                          optionClass = 'bg-green-50 border-green-300';
                        } else if (!isCorrect && isSelected) {
                          optionClass = 'bg-red-50 border-red-500';
                        }
                        
                        return (
                          <div
                            key={option.label}
                            className={`p-2.5 rounded-lg border-2 ${optionClass}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-sm text-gray-900">{option.label}.</span>
                              <span className="text-sm text-gray-700 flex-1">{option.text}</span>
                              {isCorrect && (
                                <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {!result.isCorrect && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-medium text-blue-900 mb-0.5">Correct Answer:</p>
                        <p className="text-sm text-blue-800">
                          {question.correctAnswers.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Fixed Footer Actions */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => navigate && navigate('dashboard')}
                className="px-6 py-2.5 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-all"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => navigate && navigate('leaderboard')}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
              >
                View Leaderboard
              </button>
            </div>
          </div>
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
    <div className="fixed inset-0 flex bg-gray-100">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg animate-slide-down ${
          toast.type === 'error' ? 'bg-red-500 text-white' :
          toast.type === 'success' ? 'bg-green-500 text-white' :
          'bg-yellow-500 text-gray-900'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {toast.message}
          </div>
        </div>
      )}
      
      {confirmSubmit && (
        <ConfirmDialog
          title="Submit Quiz?"
          message="Are you sure you want to submit your quiz? You cannot change answers after submission."
          confirmLabel="Submit Quiz"
          cancelLabel="Cancel"
          variant="primary"
          onConfirm={() => { setConfirmSubmit(false); handleSubmitQuiz(); }}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}
      
      {/* Quiz Progress Sidebar on Left */}
      <div className="w-72 bg-white border-r border-gray-200 shadow-lg flex flex-col overflow-y-auto">
        {/* Progress Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl">🏆</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">
                YOUR PROGRESS
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{answeredCount}</span>
                <span className="text-lg text-gray-500">/ {questions.length}</span>
              </div>
              <div className="text-xs text-gray-600">Answered</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div 
              className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            ></div>
          </div>
          <div className="text-right text-xs font-semibold text-gray-600">
            {Math.round((answeredCount / questions.length) * 100)}%
          </div>
        </div>
        
        {/* Question Navigation */}
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <h3 className="text-sm font-bold text-gray-700 uppercase">Question Navigation</h3>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gray-300"></div>
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-400"></div>
              <span>Marked</span>
            </div>
          </div>
          
          {/* Question Grid */}
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = answers.has(q.id) && answers.get(q.id)!.length > 0;
              const isMarked = markedQuestions.has(q.id);
              const isCurrent = idx === currentQuestionIndex;
              
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`aspect-square rounded-lg text-sm font-bold transition-all ${
                    isCurrent
                      ? 'bg-purple-600 text-white ring-2 ring-purple-300 scale-105'
                      : isMarked
                      ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                      : isAnswered
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Main Quiz Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm px-6 py-3">
          <div className="flex items-center justify-between">
            <button className="px-5 py-2 bg-purple-600 text-white rounded-full font-bold text-sm">
              Question {currentQuestion.questionNumber}
            </button>
            
            <button 
              onClick={toggleMarkQuestion}
              className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                markedQuestions.has(currentQuestion.id)
                  ? 'bg-yellow-400 border-yellow-500 text-gray-900'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              🏳️ {markedQuestions.has(currentQuestion.id) ? 'Marked' : 'Mark for Review'}
            </button>
            
            <button
              onClick={handleEndQuiz}
              className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
            >
              End Quiz
            </button>
          </div>
        </div>
        
        {/* Scrollable Question Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Question Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                  📝
                </div>
                <div className="flex-1">
                  <p className="text-base text-gray-800 leading-relaxed">
                    {currentQuestion.questionText}
                  </p>
                </div>
                <div className="text-3xl">💡</div>
              </div>
              
              {/* Display image - Smaller size */}
              {currentQuestion.imageUrl && (
                <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <img 
                    src={currentQuestion.imageUrl} 
                    alt={`Question ${currentQuestion.questionNumber}`}
                    className="w-full max-w-xl mx-auto rounded-lg"
                    style={{ 
                      imageRendering: 'auto',
                      maxHeight: '300px',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              )}
              
              <div className="text-sm font-semibold text-purple-600 mb-3">
                What is the main issue?
              </div>
              
              {/* Options */}
              <div className="space-y-2.5">
                {currentQuestion.options.map((option) => {
                  const isSelected = currentAnswer.includes(option.label);
                  const colors = {
                    A: { bg: 'bg-purple-50', border: 'border-purple-300', selected: 'bg-purple-100 border-purple-500', text: 'text-purple-700' },
                    B: { bg: 'bg-orange-50', border: 'border-orange-300', selected: 'bg-orange-100 border-orange-500', text: 'text-orange-700' },
                    C: { bg: 'bg-cyan-50', border: 'border-cyan-300', selected: 'bg-cyan-100 border-cyan-500', text: 'text-cyan-700' },
                    D: { bg: 'bg-pink-50', border: 'border-pink-300', selected: 'bg-pink-100 border-pink-500', text: 'text-pink-700' }
                  }[option.label] || { bg: 'bg-gray-50', border: 'border-gray-300', selected: 'bg-gray-100 border-gray-500', text: 'text-gray-700' };
                  
                  return (
                    <button
                      key={option.label}
                      onClick={() => handleOptionSelect(
                        currentQuestion.id,
                        option.label,
                        currentQuestion.questionType
                      )}
                      disabled={isSubmitted}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `${colors.selected} shadow-md`
                          : `${colors.bg} ${colors.border} hover:${colors.selected}`
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex-shrink-0 w-8 h-8 rounded ${
                          isSelected ? colors.text.replace('text-', 'bg-') : 'bg-white'
                        } border-2 ${colors.border} flex items-center justify-center font-bold ${
                          isSelected ? 'text-white' : colors.text
                        }`}>
                          {option.label}
                        </div>
                        <span className="text-gray-800 text-sm flex-1">
                          {option.text}
                        </span>
                        {isSelected && (
                          <div className={`w-5 h-5 rounded-full ${colors.text.replace('text-', 'bg-')} flex items-center justify-center text-white text-xs`}>
                            ✓
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-200 shadow-md px-6 py-4">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <button
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-2.5 bg-white border-2 border-purple-300 text-purple-700 rounded-lg font-bold hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            
            <div className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 ${
              timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
            }`}>
              <ClockIcon className="w-5 h-5" />
              <span className="font-mono">{formatTime(timeLeft)}</span>
            </div>
            
            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={() => {
                  setConfirmSubmit(true);
                }}
                disabled={isSubmitted}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50"
              >
                {isSubmitted ? '✓ Submitted' : 'Submit →'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold hover:shadow-lg"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
