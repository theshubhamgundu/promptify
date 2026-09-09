/**
 * Hook for Vision Challenge Evaluation
 * Handles submission and deterministic evaluation
 */

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendAIRequest, type AIProvider } from '../lib/byok-service';
import { evaluateRound3Submission, type VisionEvaluationResult } from '../lib/round3-evaluator';
import { getRound3Question } from '../lib/round3-questions';

export interface VisionSubmissionParams {
  teamId: string;
  challengeId: string;
  roundSessionId: string;
  participantPrompt: string;
  referenceImageURL: string;
  challengeData: any;
  activeProvider: AIProvider | null;
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
      // Step 1: Call participant's Vision AI with their BYOK
      if (!params.activeProvider) {
        throw new Error('No AI provider configured. Please add your API key.');
      }

      const aiResponse = await sendAIRequest(
        params.activeProvider,
        params.teamId,
        params.roundSessionId,
        params.challengeId,
        {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: params.participantPrompt },
                { 
                  type: 'image_url', 
                  image_url: { url: params.referenceImageURL } 
                }
              ]
            }
          ],
          model: params.challengeData.configuration?.byok?.allowed_models?.[0] || 'gpt-4o',
          max_tokens: params.challengeData.configuration?.byok?.max_tokens_per_request || 500
        }
      );

      if (!aiResponse.success) {
        throw new Error(aiResponse.error || 'Vision AI request failed');
      }

      const aiResponseText = aiResponse.content || '';

      // Step 2: Get question definition for evaluation
      const question = getRound3Question(params.challengeId);
      if (!question) {
        throw new Error('Question definition not found');
      }

      setSubmitting(false);
      setEvaluating(true);

      // Step 3: Evaluate deterministically (NO AI judge)
      const evaluation = evaluateRound3Submission(
        question,
        aiResponseText,
        params.timeTaken
      );

      // Step 4: Get next attempt number
      const { data: existingSubmissions } = await supabase
        .from('vision_submissions')
        .select('attempt_number')
        .eq('team_id', params.teamId)
        .eq('challenge_id', params.challengeId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      const attemptNumber = (existingSubmissions?.[0]?.attempt_number || 0) + 1;

      // Step 5: Store submission with evaluation results
      const { error: insertError } = await supabase
        .from('vision_submissions')
        .insert({
          team_id: params.teamId,
          challenge_id: params.challengeId,
          round_session_id: params.roundSessionId,
          participant_prompt: params.participantPrompt,
          reference_image_url: params.referenceImageURL,
          ai_response_text: aiResponseText,
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

      setEvaluating(false);

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
