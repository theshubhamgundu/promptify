import { supabase } from '../supabase';
import { byokSession, sendAIRequest, AIProvider, AIRequest, AIResponse, getBYOKConfig } from '../byok-service';

export interface PromptSheetEntry {
  id: string;
  sequence_number: number;
  provider: string;
  model: string;
  prompt: string;
  response: string | null;
  prompt_word_count: number;
  prompt_token_count: number;
  response_token_count: number;
  latency_ms: number | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  error_code: string | null;
  parent_entry_id: string | null;
  revision_number: number;
  request_started_at: string;
  response_received_at: string | null;
  metadata: any;
}

export class AIWorkspaceService {
  /**
   * Validate if the provider/model is allowed by the challenge configuration
   */
  static validateProvider(challengeConfig: any, provider: AIProvider, model: string): { valid: boolean; error?: string } {
    const byok = getBYOKConfig(challengeConfig);
    if (!byok) {
      return { valid: false, error: 'AI Workspace is not enabled for this challenge' };
    }

    if (!byok.required_providers.includes(provider)) {
      return { valid: false, error: `Provider ${provider} is not allowed for this challenge` };
    }

    if (byok.allowed_models && byok.allowed_models.length > 0 && !byok.allowed_models.includes(model)) {
      return { valid: false, error: `Model ${model} is not allowed for this challenge` };
    }

    return { valid: true };
  }

  /**
   * Check if a valid BYOK session exists for the provider
   */
  static validateBYOK(provider: AIProvider): boolean {
    return byokSession.hasKey(provider);
  }

  /**
   * Execute an AI request and record it in the immutable Prompt Sheet
   */
  static async executeAndRecordRequest(
    eventId: string,
    roundId: string,
    challengeId: string,
    roundSessionId: string,
    challengeSessionId: string,
    teamId: string,
    participantId: string,
    provider: AIProvider,
    model: string,
    prompt: string,
    request: AIRequest,
    parentEntryId?: string,
    metadata: any = {}
  ): Promise<{ success: boolean; response?: AIResponse; entryId?: string; error?: string }> {
    try {
      const startTime = Date.now();
      const promptWordCount = prompt.trim().split(/\s+/).length;
      
      // We don't create a PENDING entry first to reduce latency, 
      // instead we record the whole interaction via the RPC after it finishes.

      // Send the request via secure gateway
      const aiResponse = await sendAIRequest(
        provider,
        teamId,
        roundSessionId,
        challengeId,
        request
      );

      const latency = Date.now() - startTime;
      const status = aiResponse.success ? 'SUCCESS' : 'FAILED';
      
      // Record in prompt sheet
      const { data: entryData, error: recordError } = await supabase.rpc('record_prompt_sheet_entry', {
        p_team_id: teamId,
        p_event_id: eventId,
        p_round_id: roundId,
        p_challenge_id: challengeId,
        p_round_session_id: roundSessionId,
        p_challenge_session_id: challengeSessionId,
        p_participant_id: participantId,
        p_provider: provider,
        p_model: model,
        p_prompt: prompt,
        p_response: aiResponse.success ? aiResponse.content : null,
        p_prompt_word_count: promptWordCount,
        p_prompt_token_count: aiResponse.usage?.inputTokens || 0,
        p_response_token_count: aiResponse.usage?.outputTokens || 0,
        p_latency_ms: latency,
        p_status: status,
        p_error_code: aiResponse.success ? null : aiResponse.error,
        p_parent_entry_id: parentEntryId || null,
        p_metadata: metadata
      });

      if (recordError) {
        console.error('Failed to record prompt sheet entry:', recordError);
        // We still return the AI response to the user even if logging failed, 
        // but this should be flagged.
      }

      if (!aiResponse.success) {
        return {
          success: false,
          error: aiResponse.error,
          entryId: entryData?.entry_id
        };
      }

      return {
        success: true,
        response: aiResponse,
        entryId: entryData?.entry_id
      };
    } catch (error: any) {
      console.error('AI Workspace execution error:', error);
      
      // Try to log the catastrophic failure
      try {
        await supabase.rpc('record_prompt_sheet_entry', {
          p_team_id: teamId,
          p_event_id: eventId,
          p_round_id: roundId,
          p_challenge_id: challengeId,
          p_round_session_id: roundSessionId,
          p_challenge_session_id: challengeSessionId,
          p_participant_id: participantId,
          p_provider: provider,
          p_model: model,
          p_prompt: prompt,
          p_status: 'FAILED',
          p_error_code: error.message || 'Unknown execution error',
          p_parent_entry_id: parentEntryId || null,
          p_metadata: metadata
        });
      } catch (e) {
        // Ignore failure to log the failure
      }

      return {
        success: false,
        error: error.message || 'Failed to execute request'
      };
    }
  }
}
