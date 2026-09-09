/**
 * Hook for Vision Challenge Evaluation
 * Handles submission and deterministic evaluation
 * NO AI CALLS - evaluates participant's prompt text directly using pattern matching
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { evaluateRound3Submission, type VisionEvaluationResult } from '../lib/round3-evaluator';
import { getRound3Question } from '../lib/round3-questions';

export interface VisionSubmissionParams {
  teamId: string;
  challengeId: string;
  roundSessionId: string;
  participantPrompt: string;
  referenceImageURL: string;
  challengeData: any;
  activeProvider: any; // Not used, kept for compatibility
  timeTaken: number;
}

export function useVisionEvaluation() {
  const [submitting, setSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAndEvaluate = async (
    params: VisionSubmissionParams
  ): Promise<{ success: boolean; evaluation?: VisionEvaluationResult; error?: string }> => {
    
    setSubmitting(true);
    setError(null);

    try {
      // Round 3 uses DETERMINISTIC evaluation - no AI calls!
      // We evaluate the participant's prompt text directly using pattern matching
      
      // Step 1: Get question definition for evaluation
      const question = getRound3Question(params.challengeId);
      if (!question) {
        throw new Error('Question definition not found');
      }

      // Step 2: Evaluate the prompt text deterministically (pattern matching only)
      // We evaluate what the participant WROTE, not what AI would generate
      const evaluation = evaluateRound3Submission(
        question,
        params.participantPrompt, // Evaluate the prompt itself, not AI response
        params.timeTaken
      );

      // Step 3: Get next attempt number
      const { data: existingSubmissions } = await supabase
        .from('vision_submissions')
        .select('attempt_number')
        .eq('team_id', params.teamId)
        .eq('challenge_id', params.challengeId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      const attemptNumber = (existingSubmissions?.[0]?.attempt_number || 0) + 1;

      // Step 4: Store submission with evaluation results
      const { error: insertError } = await supabase
        .from('vision_submissions')
        .insert({
          team_id: params.teamId,
          challenge_id: params.challengeId,
          round_session_id: params.roundSessionId,
          participant_prompt: params.participantPrompt,
          reference_image_url: params.referenceImageURL,
          ai_response_text: params.participantPrompt, // Store the prompt as the "response"
          time_taken_seconds: params.timeTaken,
          attempt_number: attemptNumber,
          evaluation_status: 'COMPLETED',
          total_score: evaluation.totalScore,
          max_score: evaluation.maxScore,
          passed: evaluation.passed,
          evaluation_details: {
            matchedPatterns: evaluation.matchedPatterns,
            feedback: evaluation.feedback,
            timeTakenSeconds: evaluation.timeTakenSeconds
          }
        });

      if (insertError) throw insertError;

      setSubmitting(false);

      return {
        success: true,
        evaluation
      };

    } catch (err: any) {
      console.error('Vision submission error:', err);
      const errorMessage = err.message || 'Submission failed';
      setError(errorMessage);
      setSubmitting(false);
      setEvaluating(false);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  return {
    submitAndEvaluate,
    submitting,
    evaluating,
    error
  };
}
