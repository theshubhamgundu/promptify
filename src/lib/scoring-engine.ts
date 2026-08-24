import { supabase } from './supabase';
import type { Database } from './types';

type Submission = Database['public']['Tables']['submissions']['Row'];
type Challenge = Database['public']['Tables']['challenges']['Row'];

export class ScoringEngine {
  static async calculateScore(challengeId: string, isCorrect: boolean, attempts: number, hintsUsed: number): Promise<number> {
    if (!isCorrect) return 0;

    const { data: challenge } = await supabase
      .from('challenges')
      .select('base_points, max_attempts, configuration')
      .eq('id', challengeId)
      .single();

    if (!challenge) return 0;

    const config = challenge.configuration as any;
    const basePoints = challenge.base_points || 0;
    const attemptPenalty = config.attempt_penalty || 0;
    const hintPenalty = config.hint_penalty || 0;

    const penalty = (Math.max(0, attempts - 1) * attemptPenalty) + (hintsUsed * hintPenalty);
    
    return Math.max(0, basePoints - penalty);
  }

  static async submitAnswer(teamId: string, roundSessionId: string, challengeId: string, answer: string, isCorrect: boolean, attempts: number, hintsUsed: number) {
    const score = await this.calculateScore(challengeId, isCorrect, attempts, hintsUsed);
    
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        team_id: teamId,
        round_session_id: roundSessionId,
        challenge_id: challengeId,
        content: answer,
        status: isCorrect ? 'EVALUATED' : 'ERROR',
        attempt_number: attempts,
        score: score,
        evaluation_result: { correct: isCorrect },
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting answer:", error);
      throw error;
    }

    if (isCorrect) {
      // Update round session score
      // Note: Ideally done server-side to prevent race conditions, doing it on frontend requires careful fetching
      const { data: session } = await supabase
        .from('round_sessions')
        .select('score')
        .eq('id', roundSessionId)
        .single();
        
      if (session) {
        await supabase
          .from('round_sessions')
          .update({ score: session.score + score })
          .eq('id', roundSessionId);
      }
    }

    return data;
  }
}
