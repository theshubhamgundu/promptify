import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';
import { ClockIcon, CheckCircleIcon, CircleIcon, AlertTriangleIcon, ExclamationCircleIcon, LockIcon } from '../components/icons';
import { getAllQuestions, getSubRoundQuestions, type Round2Question } from '../lib/round2-questions';
import { useRound2Evaluation } from '../hooks/useRound2Evaluation';
import { sounds } from '../lib/sound';

interface Round2HeistProps {
  roundId: string;
  navigate: (page: any) => void;
}

export default function Round2Heist({ roundId, navigate }: Round2HeistProps) {
  const { currentTeam } = useTeamStore();
  const { evaluateSubmission, evaluating } = useRound2Evaluation();
  
  const [session, setSession] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentSubRound, setCurrentSubRound] = useState(1); // 1-4
  const [allQuestions] = useState<Round2Question[]>(getAllQuestions()); // All 16 questions
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [promptText, setPromptText] = useState('');
  const [timeLeft, setTimeLeft] = useState(150); // 2.5 minutes per question
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [expandedSubRound, setExpandedSubRound] = useState<number>(1); // Which sub-round folder is expanded
  
  const questionStartTime = useRef<number>(0);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Security: Prevent copy, paste, screenshot, right-click, and detect AI features
  useEffect(() => {
    // AGGRESSIVE Browser AI Detection - Multiple checks
    const detectBrowserAI = () => {
      // @ts-ignore - Check for Chrome AI APIs
      if ('ai' in window || 'ml' in window || navigator.ml || navigator.ai) {
        setError('🚫 BROWSER AI DETECTED! This round requires AI features to be completely disabled. Close Gemini sidebar and refresh.');
        return true;
      }
      
      // @ts-ignore - Check for Chrome-specific AI features
      if (window.chrome && (window.chrome.aiOriginTrial || window.chrome.ai)) {
        setError('🚫 Chrome AI ACTIVE! Disable "Ask Gemini" in chrome://flags, close all AI sidebars, and refresh.');
        return true;
      }
      
      // Check for Edge Copilot
      // @ts-ignore
      if (window.AI || window.copilot) {
        setError('🚫 Microsoft Copilot DETECTED! Disable Edge Copilot and refresh the page.');
        return true;
      }
      
      // AGGRESSIVE: Check for Gemini sidebar and other AI panels
      const aiSelectors = [
        'iframe[src*="gemini"]',
        'iframe[src*="bard"]',
        '[class*="gemini"]',
        '[class*="ai-"]',
        '[id*="gemini"]',
        '[id*="ai-panel"]',
        '[class*="copilot"]',
        '[id*="copilot"]',
        '[class*="assistant"]',
        '[id*="assistant"]',
        '[data-component*="ai"]',
        '[role="complementary"][class*="side"]', // Sidebars
        'google-one-tap-iframe'
      ];
      
      for (const selector of aiSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Extra check: make sure it's not our own UI
          let isExternalAI = false;
          elements.forEach(el => {
            const text = el.textContent?.toLowerCase() || '';
            const classes = el.className?.toLowerCase() || '';
            if (text.includes('gemini') || text.includes('ai can') || classes.includes('gemini')) {
              isExternalAI = true;
            }
          });
          
          if (isExternalAI) {
            setError('🚫 AI SIDEBAR ACTIVE! Close the Gemini/AI panel on the right side of your browser and refresh the page.');
            return true;
          }
        }
      }
      
      // Check for shadow DOM (some extensions use this)
      // @ts-ignore
      if (document.body.shadowRoot) {
        setError('🚫 Browser extension with shadow DOM detected. This may be an AI assistant. Disable and refresh.');
        return true;
      }
      
      return false;
    };

    // Check on mount
    if (detectBrowserAI()) {
      return;
    }
    
    // AGGRESSIVE monitoring - check every 1 second
    const aiMonitorInterval = setInterval(() => {
      if (detectBrowserAI()) {
        clearInterval(aiMonitorInterval);
      }
    }, 1000);

    const handleKeyDown = (e: KeyboardEvent) => {
      // AGGRESSIVE: Prevent screenshot (PrintScreen, Win+PrintScreen, Win+Shift+S)
      if (
        e.key === 'PrintScreen' || 
        (e.metaKey && e.key === 'PrintScreen') ||
        (e.shiftKey && e.metaKey && e.key === 's')
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setToast({ message: '🚫 SCREENSHOTS BLOCKED! This action is not allowed during Round 2.', type: 'error' });
        
        // Flash the screen to ruin any screenshot
        document.body.style.backgroundColor = '#ff0000';
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 100);
        
        return false;
      }
      
      // Prevent developer tools
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setToast({ message: '🚫 Developer tools are blocked', type: 'error' });
        return false;
      }
      
      // Block ALL copy operations (Ctrl+C) - no exceptions
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setToast({ message: '🚫 Copying is completely disabled for Round 2', type: 'error' });
        return false;
      }
      
      // Block ALL paste operations (Ctrl+V) - no exceptions
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setToast({ message: '🚫 Pasting is completely disabled for Round 2', type: 'error' });
        return false;
      }
      
      // Block ALL cut operations (Ctrl+X) - no exceptions
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setToast({ message: '🚫 Cutting text is completely disabled for Round 2', type: 'error' });
        return false;
      }
      
      // Prevent select all (Ctrl+A) - no exceptions
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setToast({ message: '🚫 Select all is disabled for Round 2', type: 'error' });
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setToast({ message: '⚠️ Right-click is disabled during this round', type: 'warning' });
      return false;
    };

    // Block ALL copy events - no exceptions
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
      setToast({ message: '⚠️ Copying is completely disabled for this round', type: 'warning' });
      return false;
    };

    // Block ALL paste events - no exceptions
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setToast({ message: '⚠️ Pasting is completely disabled for this round', type: 'warning' });
      return false;
    };

    // Block ALL cut events - no exceptions
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      setToast({ message: '⚠️ Cutting text is completely disabled for this round', type: 'warning' });
      return false;
    };

    // Completely prevent text selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Detect Chrome AI sidebar/panel - more comprehensive check
    const detectAISidebar = setInterval(() => {
      // Check for AI-related DOM elements with broader patterns
      const aiElements = document.querySelectorAll(
        '[class*="gemini"], [class*="ai-"], [id*="gemini"], [id*="ai-panel"], ' +
        '[class*="copilot"], [id*="copilot"], [class*="assistant"], [id*="assistant"], ' +
        '[aria-label*="AI"], [aria-label*="Copilot"], [aria-label*="Gemini"]'
      );
      
      if (aiElements.length > 0) {
        setError('⚠️ AI panel/sidebar detected. Please close ALL browser AI features (sidebars, panels, extensions) and refresh.');
        clearInterval(detectAISidebar);
        clearInterval(aiMonitorInterval);
      }
    }, 2000);

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('drag', (e) => e.preventDefault(), true);
    document.addEventListener('drop', (e) => e.preventDefault(), true);

    // CSS to prevent text selection everywhere
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    
    // Add meta tag to prevent AI scraping
    const metaAI = document.createElement('meta');
    metaAI.name = 'robots';
    metaAI.content = 'noai, noimageai';
    document.head.appendChild(metaAI);
    
    return () => {
      clearInterval(detectAISidebar);
      clearInterval(aiMonitorInterval);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('drag', (e) => e.preventDefault(), true);
      document.removeEventListener('drop', (e) => e.preventDefault(), true);
      
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.mozUserSelect = '';
      document.body.style.msUserSelect = '';
      
      // Remove meta tag
      if (metaAI.parentNode) {
        metaAI.parentNode.removeChild(metaAI);
      }
    };
  }, []);

  // Load session and questions
  useEffect(() => {
    if (!currentTeam?.id || !roundId) return;
    loadSessionAndQuestions();
  }, [currentTeam?.id, roundId]);

  const loadSessionAndQuestions = async () => {
    try {
      setLoading(true);
      
      // Load round info
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', roundId)
        .single();
      
      if (roundError) throw roundError;
      setRound(roundData);
      
      // Get or create round_session
      let roundSessionId = null;
      const { data: roundSessionData, error: roundSessionError } = await supabase
        .from('round_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .maybeSingle();

      if (roundSessionError && roundSessionError.code !== 'PGRST116') throw roundSessionError;

      if (!roundSessionData) {
        const { data: newRoundSession, error: createRoundSessionError } = await supabase
          .from('round_sessions')
          .insert({
            team_id: currentTeam!.id,
            round_id: roundId,
            started_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createRoundSessionError) throw createRoundSessionError;
        roundSessionId = newRoundSession.id;
      } else {
        roundSessionId = roundSessionData.id;
      }

      // Get or create Round 2 session
      const { data: sessionData, error: sessionError } = await supabase
        .from('round2_sessions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_id', roundId)
        .maybeSingle();

      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;

      if (!sessionData) {
        const { data: newSession, error: createError } = await supabase
          .from('round2_sessions')
          .upsert({
            team_id: currentTeam!.id,
            round_id: roundId,
            round_session_id: roundSessionId,
            current_sub_round: 1,
            current_question: 1,
            sub_round_1_status: 'IN_PROGRESS',
            sub_round_1_started_at: new Date().toISOString()
          }, {
            onConflict: 'team_id,round_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (createError) throw createError;
        setSession(newSession);
      } else {
        setSession(sessionData);
        setCurrentSubRound(sessionData.current_sub_round || 1);
      }

      // Load existing submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('round2_submissions')
        .select('*')
        .eq('team_id', currentTeam!.id)
        .eq('round_session_id', roundSessionId);
      
      if (submissionsError) throw submissionsError;
      
      const answersMap = new Map<string, string>();
      const scoresMap = new Map<string, number>();
      
      submissionsData?.forEach((sub: any) => {
        const question = allQuestions.find(q => sub.question_id === q.id);
        if (question) {
          answersMap.set(question.id, sub.prompt_text);
          scoresMap.set(question.id, sub.total_score || 0);
        }
      });
      
      setAnswers(answersMap);
      setScores(scoresMap);
      
      // Determine current sub-round based on progress
      const unlockedSubRound = calculateUnlockedSubRound(answersMap);
      setCurrentSubRound(unlockedSubRound);
      setExpandedSubRound(unlockedSubRound);
      
      // Set current question to first unanswered in unlocked sub-round
      const firstUnansweredIndex = findFirstUnansweredQuestion(unlockedSubRound, answersMap);
      setCurrentQuestionIndex(firstUnansweredIndex);
      
      // Load prompt for current question if already answered
      const currentQ = allQuestions[firstUnansweredIndex];
      if (currentQ && answersMap.has(currentQ.id)) {
        setPromptText(answersMap.get(currentQ.id) || '');
      }
      
      questionStartTime.current = Date.now();
      startTimer();

    } catch (err: any) {
      console.error('Error loading session:', err);
      setError(err.message || 'Failed to load round');
    } finally {
      setLoading(false);
    }
  };

  // Calculate which sub-round is unlocked based on completed questions
  const calculateUnlockedSubRound = (answersMap: Map<string, string>): number => {
    // Sub-round 1: Questions 0-3 (P1-P4)
    // Sub-round 2: Questions 4-7 (C1-C4)
    // Sub-round 3: Questions 8-11 (CX1-CX4)
    // Sub-round 4: Questions 12-15 (D1-D4)
    
    const subRound1Complete = [0, 1, 2, 3].every(i => answersMap.has(allQuestions[i].id));
    const subRound2Complete = [4, 5, 6, 7].every(i => answersMap.has(allQuestions[i].id));
    const subRound3Complete = [8, 9, 10, 11].every(i => answersMap.has(allQuestions[i].id));
    
    if (subRound3Complete) return 4;
    if (subRound2Complete) return 3;
    if (subRound1Complete) return 2;
    return 1;
  };

  // Find first unanswered question in the given sub-round
  const findFirstUnansweredQuestion = (subRound: number, answersMap: Map<string, string>): number => {
    const startIndex = (subRound - 1) * 4;
    const endIndex = startIndex + 4;
    
    for (let i = startIndex; i < endIndex; i++) {
      if (!answersMap.has(allQuestions[i].id)) {
        return i;
      }
    }
    
    // If all answered in this sub-round, return first question of this sub-round
    return startIndex;
  };

  const startTimer = () => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setTimeLeft(150);
    
    timerInterval.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = () => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setToast({ message: 'Time is up! Auto-submitting...', type: 'warning' });
    setTimeout(() => handleSubmit(), 1000);
  };

  const handleSubmit = async () => {
    if (submitting || evaluating) return;
    
    const currentQ = allQuestions[currentQuestionIndex];
    if (!currentQ) return;
    
    // Check if already submitted
    if (answers.has(currentQ.id)) {
      setToast({ message: 'This question was already submitted', type: 'warning' });
      moveToNextQuestion();
      return;
    }
    
    if (!promptText.trim()) {
      setToast({ message: 'Please write a prompt before submitting', type: 'error' });
      return;
    }

    setSubmitting(true);
    
    try {
      const timeTaken = Math.floor((Date.now() - questionStartTime.current) / 1000);

      const evaluationResult = await evaluateSubmission(currentQ, promptText.trim(), timeTaken);
      
      if (!evaluationResult) throw new Error('Evaluation failed');

      // Use upsert to handle re-submissions (update if exists, insert if new)
      const { data: insertData, error: insertError } = await supabase
        .from('round2_submissions')
        .upsert({
          team_id: currentTeam!.id,
          round_session_id: session.round_session_id,
          question_id: currentQ.id,
          prompt_text: promptText.trim(),
          time_taken_seconds: timeTaken,
          total_score: evaluationResult.totalScore,
          hidden_test_pass_rate: (evaluationResult.hiddenTestResults.filter(t => t.passed).length / evaluationResult.hiddenTestResults.length) * 100,
          grammar_score: evaluationResult.breakdown.grammarScore,
          constraint_score: evaluationResult.breakdown.constraintScore,
          time_bonus: evaluationResult.breakdown.timeBonus,
          evaluation_details: {
            breakdown: evaluationResult.breakdown,
            hiddenTestResults: evaluationResult.hiddenTestResults,
            constraintResults: evaluationResult.constraintResults,
            grammarIssues: evaluationResult.grammarIssues,
            feedback: evaluationResult.feedback
          }
        }, {
          onConflict: 'team_id,question_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      const newAnswers = new Map(answers);
      const newScores = new Map(scores);
      newAnswers.set(currentQ.id, promptText.trim());
      newScores.set(currentQ.id, evaluationResult.totalScore);
      setAnswers(newAnswers);
      setScores(newScores);

      // Check if this completes the current sub-round
      const currentSubRoundIndex = Math.floor(currentQuestionIndex / 4) + 1;
      const currentSubRoundStart = (currentSubRoundIndex - 1) * 4;
      const currentSubRoundEnd = currentSubRoundStart + 4;
      const subRoundQuestions = allQuestions.slice(currentSubRoundStart, currentSubRoundEnd);
      const subRoundComplete = subRoundQuestions.every(q => newAnswers.has(q.id));
      
      console.log(`Sub-round ${currentSubRoundIndex} completion check:`, {
        currentQuestionIndex,
        currentSubRoundIndex,
        questionsInSubRound: subRoundQuestions.map(q => q.id),
        answeredQuestions: Array.from(newAnswers.keys()),
        allAnswered: subRoundComplete
      });
      
      if (subRoundComplete && currentSubRoundIndex < 4) {
        // Unlock next sub-round immediately
        const nextSubRound = currentSubRoundIndex + 1;
        
        // Update database FIRST
        await supabase
          .from('round2_sessions')
          .update({
            current_sub_round: nextSubRound,
            [`sub_round_${currentSubRoundIndex}_status`]: 'COMPLETED',
            [`sub_round_${nextSubRound}_status`]: 'IN_PROGRESS',
            [`sub_round_${nextSubRound}_started_at`]: new Date().toISOString()
          })
          .eq('id', session.id);
        
        // Update local state
        setSession((prev: any) => ({
          ...prev,
          current_sub_round: nextSubRound,
          [`sub_round_${currentSubRoundIndex}_status`]: 'COMPLETED',
          [`sub_round_${nextSubRound}_status`]: 'IN_PROGRESS'
        }));
        
        setCurrentSubRound(nextSubRound);
        setExpandedSubRound(nextSubRound);
        
        setToast({ message: `🎉 Sub-Round ${currentSubRoundIndex} Complete! Sub-Round ${nextSubRound} Unlocked!`, type: 'success' });
        sounds.success();
      } else if (subRoundComplete && currentSubRoundIndex === 4) {
        // Final sub-round complete
        setToast({ message: `🎉 All Sub-Rounds Complete!`, type: 'success' });
        sounds.success();
      } else {
        setToast({ message: `Submitted! Score: ${evaluationResult.totalScore.toFixed(1)}/50`, type: 'success' });
        sounds.success();
      }

      setTimeout(() => moveToNextQuestion(), 1500);

    } catch (err: any) {
      console.error('Submission error:', err);
      setToast({ message: err.message || 'Submission failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const moveToNextQuestion = async () => {
    const currentSubRoundIndex = Math.floor(currentQuestionIndex / 4) + 1;
    const nextIndex = currentQuestionIndex + 1;
    const nextSubRoundIndex = Math.floor(nextIndex / 4) + 1;
    
    // Check if we completed a sub-round
    if (nextSubRoundIndex > currentSubRoundIndex && nextIndex < allQuestions.length) {
      // Check if current sub-round is complete
      const currentSubRoundStart = (currentSubRoundIndex - 1) * 4;
      const currentSubRoundEnd = currentSubRoundStart + 4;
      const currentSubRoundComplete = allQuestions
        .slice(currentSubRoundStart, currentSubRoundEnd)
        .every(q => answers.has(q.id));
      
      if (currentSubRoundComplete) {
        // Unlock next sub-round
        const newSubRound = nextSubRoundIndex;
        setCurrentSubRound(newSubRound);
        setExpandedSubRound(newSubRound);
        
        // Update database
        await supabase
          .from('round2_sessions')
          .update({
            current_sub_round: newSubRound,
            current_question: 1,
            [`sub_round_${currentSubRoundIndex}_status`]: 'COMPLETED',
            [`sub_round_${newSubRound}_status`]: 'IN_PROGRESS',
            [`sub_round_${newSubRound}_started_at`]: new Date().toISOString()
          })
          .eq('id', session.id);
        
        // Update local session state
        setSession((prev: any) => ({
          ...prev,
          current_sub_round: newSubRound,
          current_question: 1,
          [`sub_round_${currentSubRoundIndex}_status`]: 'COMPLETED',
          [`sub_round_${newSubRound}_status`]: 'IN_PROGRESS'
        }));
        
        setToast({ 
          message: `Sub-Round ${currentSubRoundIndex} complete! Sub-Round ${newSubRound} unlocked!`, 
          type: 'success' 
        });
      }
    }
    
    if (nextIndex < allQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      const nextQ = allQuestions[nextIndex];
      setPromptText(answers.get(nextQ.id) || '');
      questionStartTime.current = Date.now();
      startTimer();
    } else {
      // All questions complete
      if (timerInterval.current) clearInterval(timerInterval.current);
      
      // Mark final sub-round complete
      await supabase
        .from('round2_sessions')
        .update({
          sub_round_4_status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      navigate({ type: 'round2-results', roundId });
    }
  };

  const handleQuestionSelect = (index: number) => {
    const questionSubRound = Math.floor(index / 4) + 1;
    
    // Check if this sub-round is unlocked
    if (questionSubRound > currentSubRound) {
      setToast({ 
        message: `Sub-Round ${questionSubRound} is locked. Complete Sub-Round ${currentSubRound} first.`, 
        type: 'warning' 
      });
      return;
    }
    
    sounds.click();
    setCurrentQuestionIndex(index);
    const selectedQ = allQuestions[index];
    setPromptText(answers.get(selectedQ.id) || '');
    questionStartTime.current = Date.now();
    startTimer();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Round 2...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <ExclamationCircleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Round</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => navigate && navigate('dashboard')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQ = allQuestions[currentQuestionIndex];
  const answeredCount = answers.size;
  const isAnswered = answers.has(currentQ.id);
  const wordCount = promptText.trim().split(/\s+/).filter(w => w.length > 0).length;

  const subRoundInfo = [
    { number: 1, name: 'Precision', range: [0, 3], ids: ['P1', 'P2', 'P3', 'P4'] },
    { number: 2, name: 'Constraint', range: [4, 7], ids: ['C1', 'C2', 'C3', 'C4'] },
    { number: 3, name: 'Context', range: [8, 11], ids: ['CX1', 'CX2', 'CX3', 'CX4'] },
    { number: 4, name: 'Debugging', range: [12, 15], ids: ['D1', 'D2', 'D3', 'D4'] }
  ];

  // Helper to get display ID for a question
  const getDisplayId = (questionIndex: number): string => {
    const subRoundIndex = Math.floor(questionIndex / 4);
    const questionInSubRound = questionIndex % 4;
    return subRoundInfo[subRoundIndex].ids[questionInSubRound];
  };

  const challengeTypeLabels: Record<string, string> = {
    PRECISION: 'Precision',
    CONSTRAINT: 'Constraint',
    CONTEXT: 'Context Extraction',
    DEBUGGING: 'Debugging'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row h-screen overflow-hidden select-none">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${
            toast.type === 'error' ? 'bg-red-50 border-2 border-red-500' : 
            toast.type === 'warning' ? 'bg-yellow-50 border-2 border-yellow-500' : 
            'bg-green-50 border-2 border-green-500'
          }`}>
            <AlertTriangleIcon className={`w-6 h-6 ${
              toast.type === 'error' ? 'text-red-600' : 
              toast.type === 'warning' ? 'text-yellow-600' : 
              'text-green-600'
            }`} />
            <span className={`font-medium ${
              toast.type === 'error' ? 'text-red-900' : 
              toast.type === 'warning' ? 'text-yellow-900' : 
              'text-green-900'
            }`}>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar - Sub-Round Navigation */}
      <div className="w-56 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col h-full">
        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-base mb-1">Sub-Rounds</h2>
          <p className="text-xs text-gray-600">{answeredCount}/16 answered</p>
        </div>
        
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
          {subRoundInfo.map((subRound) => {
            const [startIdx, endIdx] = subRound.range;
            const subRoundQuestions = allQuestions.slice(startIdx, endIdx + 1);
            const answeredInSubRound = subRoundQuestions.filter(q => answers.has(q.id)).length;
            const isUnlocked = subRound.number <= currentSubRound;
            const isExpanded = expandedSubRound === subRound.number;
            const isComplete = answeredInSubRound === 4;
            
            return (
              <div key={subRound.number}>
                {/* Sub-Round Header */}
                <button
                  onClick={() => {
                    if (isUnlocked) {
                      sounds.click();
                      setExpandedSubRound(isExpanded ? 0 : subRound.number);
                    }
                  }}
                  disabled={!isUnlocked}
                  className={`w-full px-3 py-2 rounded-lg transition-all ${
                    !isUnlocked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isComplete
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-blue-50 border-2 border-blue-300 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!isUnlocked && <LockIcon className="w-4 h-4" />}
                      <span className="font-bold text-sm">SR{subRound.number}: {subRound.name}</span>
                    </div>
                    {isUnlocked && (
                      <span className="text-xs font-bold">{answeredInSubRound}/4</span>
                    )}
                  </div>
                  {isComplete && (
                    <div className="text-xs text-green-700 mt-1">✓ Complete</div>
                  )}
                  {!isUnlocked && (
                    <div className="text-xs text-gray-500 mt-1">🔒 Locked</div>
                  )}
                </button>
                
                {/* Questions in Sub-Round */}
                {isExpanded && isUnlocked && (
                  <div className="mt-1 ml-2 space-y-1">
                    {subRoundQuestions.map((q, subIdx) => {
                      const globalIdx = startIdx + subIdx;
                      const isAnswered = answers.has(q.id);
                      const isCurrent = globalIdx === currentQuestionIndex;
                      const score = scores.get(q.id);
                      
                      return (
                        <button
                          key={q.id}
                          onClick={() => handleQuestionSelect(globalIdx)}
                          className={`w-full text-left px-2 py-1.5 rounded transition-all text-xs ${
                            isCurrent
                              ? 'bg-blue-600 text-white'
                              : isAnswered
                              ? 'bg-green-50 text-green-900 hover:bg-green-100'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{getDisplayId(globalIdx)}</span>
                            {isAnswered && !isCurrent && (
                              <CheckCircleIcon className="w-3 h-3 text-green-600" />
                            )}
                          </div>
                          {score !== undefined && (
                            <div className="text-xs mt-0.5 font-bold">{score.toFixed(1)}/50</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-6 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{round?.name}</h1>
              <p className="text-xs text-gray-600 mt-0.5">
                {getDisplayId(currentQuestionIndex)} • {challengeTypeLabels[currentQ.challengeType]}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${timeLeft < 30 ? 'bg-red-50' : 'bg-blue-50'}`}>
                <ClockIcon className={`w-5 h-5 ${timeLeft < 30 ? 'text-red-600' : 'text-blue-600'}`} />
                <span className={`font-mono text-base font-bold ${timeLeft < 30 ? 'text-red-900' : 'text-blue-900'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Question Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-4">
            {/* Question Card - More Compact */}
            <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {getDisplayId(currentQuestionIndex)}
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                  {currentQ.maxScore} pts
                </span>
                {isAnswered && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    ✓ Submitted
                  </span>
                )}
              </div>

              <h2 className="text-lg font-bold text-gray-900 mb-3">{currentQ.title}</h2>
              
              <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                {currentQ.scenarioText}
              </div>
            </div>

            {/* Prompt Input - More Compact */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <label className="block text-base font-semibold text-gray-900 mb-2">
                Your Prompt:
              </label>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="Write your prompt here... (Copy/Paste disabled)"
                className="w-full h-40 bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none select-none"
                disabled={submitting || isAnswered}
                spellCheck={false}
                autoComplete="off"
              />
              
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-gray-600">
                  {wordCount} words
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={submitting || evaluating || !promptText.trim() || isAnswered}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all text-sm ${
                    submitting || evaluating || !promptText.trim() || isAnswered
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                  }`}
                >
                  {submitting || evaluating ? 'Evaluating...' : isAnswered ? 'Already Submitted' : 'Submit Answer'}
                </button>
              </div>

              {isAnswered && scores.has(currentQ.id) && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-semibold text-sm">
                    ✓ Score: {scores.get(currentQ.id)?.toFixed(1)}/50 points
                  </p>
                </div>
              )}
            </div>

            {/* Navigation Buttons - More Compact */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => handleQuestionSelect(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                ← Previous
              </button>
              
              {currentQuestionIndex === allQuestions.length - 1 ? (
                <button
                  onClick={() => navigate({ type: 'round2-results', roundId })}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm"
                >
                  View Results
                </button>
              ) : (
                <button
                  onClick={() => handleQuestionSelect(Math.min(allQuestions.length - 1, currentQuestionIndex + 1))}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
