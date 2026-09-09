/**
 * Round 3: Vision Challenge - Deterministic Evaluator
 * 
 * 100% deterministic weighted pattern matching evaluation:
 * - Each pattern has a regex and weight
 * - Score = sum of matched pattern weights
 * - No AI judge, instant evaluation, zero cost
 * 
 * Scoring:
 * - Tier 1 (Easy): Max 10 points per question
 * - Tier 2 (Medium): Max 15 points per question
 * - Tier 3 (Hard): Max 20 points per question
 */

import type { VisionQuestion, EvaluationPattern } from './round3-questions';

export interface VisionEvaluationResult {
  questionId: string;
  totalScore: number; // Actual score achieved
  maxScore: number; // Max possible (10, 15, or 20 based on tier)
  passed: boolean; // Not strictly needed, but kept for compatibility
  timeTakenSeconds: number;
  matchedPatterns: Array<{
    pattern: string;
    label: string;
    weight: number;
    matched: boolean;
  }>;
  feedback: string[];
}

// =============================================================================
// PATTERN MATCHING
// =============================================================================

/**
 * Test if a pattern matches the AI response text
 */
function matchPattern(responseText: string, pattern: RegExp): boolean {
  return pattern.test(responseText);
}

/**
 * Evaluate all patterns and calculate score
 */
function evaluatePatterns(
  responseText: string,
  patterns: EvaluationPattern[]
): {
  matchedPatterns: Array<{ pattern: string; label: string; weight: number; matched: boolean }>;
  totalScore: number;
  maxScore: number;
} {
  const matchedPatterns = patterns.map(p => ({
    pattern: p.pattern.source,
    label: p.label,
    weight: p.weight,
    matched: matchPattern(responseText, p.pattern)
  }));
  
  const totalScore = matchedPatterns
    .filter(p => p.matched)
    .reduce((sum, p) => sum + p.weight, 0);
  
  const maxScore = patterns.reduce((sum, p) => sum + p.weight, 0);
  
  return { matchedPatterns, totalScore, maxScore };
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate a Round 3 Vision Challenge submission (deterministically)
 * 
 * @param question - The vision question being evaluated
 * @param aiResponse - The AI's response text (generated from participant's prompt)
 * @param timeTakenSeconds - How long the participant took
 */
export function evaluateRound3Submission(
  question: VisionQuestion,
  aiResponse: string,
  timeTakenSeconds: number
): VisionEvaluationResult {
  
  // Evaluate all patterns
  const { matchedPatterns, totalScore, maxScore } = evaluatePatterns(
    aiResponse,
    question.evaluationPatterns
  );
  
  // Calculate pass threshold (not really used for scoring, but kept for compatibility)
  // We'll say passed if score >= 60% of max
  const passed = totalScore >= (maxScore * 0.6);
  
  // Generate feedback
  const feedback: string[] = [];
  
  const matchedCount = matchedPatterns.filter(p => p.matched).length;
  const totalCount = matchedPatterns.length;
  const matchRate = (matchedCount / totalCount) * 100;
  
  if (matchRate >= 80) {
    feedback.push(`✅ Excellent! Matched ${matchedCount}/${totalCount} elements (${matchRate.toFixed(0)}%)`);
  } else if (matchRate >= 60) {
    feedback.push(`✓ Good job! Matched ${matchedCount}/${totalCount} elements (${matchRate.toFixed(0)}%)`);
  } else if (matchRate >= 40) {
    feedback.push(`⚠️ Fair. Matched ${matchedCount}/${totalCount} elements (${matchRate.toFixed(0)}%)`);
  } else {
    feedback.push(`❌ Needs improvement. Only matched ${matchedCount}/${totalCount} elements (${matchRate.toFixed(0)}%)`);
  }
  
  // List missed high-value patterns
  const missedHighValue = matchedPatterns
    .filter(p => !p.matched && p.weight >= 2.5)
    .slice(0, 3); // Top 3 missed high-value patterns
  
  if (missedHighValue.length > 0) {
    feedback.push(`Missing high-value elements: ${missedHighValue.map(p => p.label).join(', ')}`);
  }
  
  // Score summary
  feedback.push(`Score: ${totalScore.toFixed(1)}/${maxScore.toFixed(1)} points`);
  
  return {
    questionId: question.id,
    totalScore: Math.round(totalScore * 10) / 10, // Round to 1 decimal
    maxScore: question.maxScore,
    passed,
    timeTakenSeconds,
    matchedPatterns,
    feedback
  };
}

// =============================================================================
// HELPER FUNCTIONS FOR DB QUERIES
// =============================================================================

/**
 * Get best score for a team on a specific question
 */
export async function getVisionBestScore(
  teamId: string,
  challengeId: string
): Promise<number> {
  try {
    const { supabase } = await import('./supabase');
    const { data } = await supabase
      .from('vision_submissions')
      .select('total_score')
      .eq('team_id', teamId)
      .eq('challenge_id', challengeId)
      .order('total_score', { ascending: false })
      .limit(1)
      .single();
    
    return data?.total_score || 0;
  } catch {
    return 0;
  }
}

/**
 * Get remaining attempts for a team on a specific question
 */
export async function getVisionRemainingAttempts(
  teamId: string,
  challengeId: string,
  maxAttempts: number
): Promise<number> {
  try {
    const { supabase } = await import('./supabase');
    const { count } = await supabase
      .from('vision_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('challenge_id', challengeId);
    
    return Math.max(0, maxAttempts - (count || 0));
  } catch {
    return maxAttempts;
  }
}
