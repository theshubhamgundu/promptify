import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Round2Question } from '../lib/round2-questions';
import { evaluateRound2Submission, type EvaluationResult, type HiddenTestResult } from '../lib/round2-evaluator';
import { analyzeTypingBehavior, type KeystrokeEvent, type TypingBehaviorScore } from '../lib/round2-typing-analysis';
import { getQuestionIdFromIndex } from '../lib/round2-scoring-params';

/**
 * Extended evaluation result including typing behavior
 */
export interface ExtendedEvaluationResult extends EvaluationResult {
  typingBehavior?: TypingBehaviorScore;
}

/**
 * Hook for evaluating Round 2 submissions
 * Handles LLM execution and evaluation logic
 */
export function useRound2Evaluation() {
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluateSubmission = async (
    question: Round2Question,
    teamPrompt: string,
    timeTakenSeconds: number,
    keystrokeLog?: KeystrokeEvent[],
    questionIndex?: number
  ): Promise<ExtendedEvaluationResult | null> => {
    setEvaluating(true);
    setError(null);

    try {
      // Step 1: Execute team's prompt against hidden test cases
      // For now, we'll simulate this. In production, you'd call your LLM API
      const hiddenTestResults = await executeHiddenTestCases(question, teamPrompt);

      // Step 2: Get model output (use first test output or aggregate)
      const modelOutput = hiddenTestResults[0]?.output || '';

      // Step 3: Get question display ID for scoring params (P1-P4, C1-C4, etc.)
      const questionDisplayId = questionIndex !== undefined 
        ? getQuestionIdFromIndex(questionIndex) 
        : undefined;

      // Step 4: Run full evaluation with scoring params
      const result = evaluateRound2Submission(
        question,
        teamPrompt,
        modelOutput,
        hiddenTestResults,
        timeTakenSeconds,
        questionDisplayId
      );

      // Step 5: Analyze typing behavior if log provided
      let typingBehavior: TypingBehaviorScore | undefined;
      if (keystrokeLog && keystrokeLog.length > 0) {
        typingBehavior = analyzeTypingBehavior(keystrokeLog, teamPrompt);
        
        // Adjust total score based on typing behavior (deduct points for suspicious patterns)
        // Typing behavior max penalty: 10 points (if score is 0)
        const typingScore = typingBehavior.score; // 0-10
        const typingPenalty = 10 - typingScore;
        const adjustedTotal = result.totalScore - typingPenalty;
        
        result.totalScore = Math.max(0, Math.min(50, adjustedTotal));
      }

      return {
        ...result,
        typingBehavior
      };

    } catch (err: any) {
      console.error('Evaluation error:', err);
      setError(err.message || 'Evaluation failed');
      return null;
    } finally {
      setEvaluating(false);
    }
  };

  return { evaluateSubmission, evaluating, error };
}

/**
 * Execute team's prompt against hidden test cases
 * This simulates running the prompt through an LLM at temp=0
 * 
 * In production, you would:
 * 1. Call your LLM API (OpenAI, Anthropic, etc.)
 * 2. For each hidden test, provide the test input to the team's prompt
 * 3. Capture the output
 * 4. Check if output meets expected behavior
 */
async function executeHiddenTestCases(
  question: Round2Question,
  teamPrompt: string
): Promise<HiddenTestResult[]> {
  // TODO: Replace with actual LLM execution
  // For now, return placeholder results
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // For demonstration, we'll do basic validation
  // In production, this would call your LLM API
  const results: HiddenTestResult[] = question.hiddenTests.map(test => {
    // Simulate test execution
    // Check if team's prompt contains relevant keywords from test description
    const hasRelevantContent = containsRelevantKeywords(teamPrompt, test.description);
    
    return {
      testId: test.id,
      description: test.description,
      passed: hasRelevantContent,
      output: `Simulated output for ${test.id}`,
      reason: hasRelevantContent ? 'Test passed' : 'Missing key requirements'
    };
  });

  return results;
}

/**
 * Basic heuristic check for relevant keywords
 * In production, this would be replaced by actual LLM execution
 */
function containsRelevantKeywords(prompt: string, testDescription: string): boolean {
  const promptLower = prompt.toLowerCase();
  
  // Extract key requirements from test description
  const keywords = [
    'exactly', 'precisely', 'format', 'structure', 'count',
    'word', 'sentence', 'paragraph', 'line', 'bullet',
    'number', 'list', 'include', 'exclude', 'must', 'should'
  ];
  
  // Check if prompt contains explicit instructions
  const hasExplicitInstructions = keywords.some(keyword => promptLower.includes(keyword));
  
  // Check prompt length (good prompts are usually detailed)
  const wordCount = prompt.split(/\s+/).length;
  const hasGoodLength = wordCount >= 20 && wordCount <= 200;
  
  return hasExplicitInstructions && hasGoodLength;
}

/**
 * Alternative: Call Supabase Edge Function for server-side evaluation
 * Uncomment this to use server-side evaluation instead
 */
/*
async function callServerSideEvaluation(
  submissionId: string,
  teamPrompt: string,
  questionId: string
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('evaluate-round2', {
    body: {
      submissionId,
      teamPrompt,
      questionId
    }
  });

  if (error) throw error;
  return data;
}
*/
