import { supabase } from './supabase';
import type { Database } from './types';
import { ScoringEngine } from './scoring-engine';
import { AIEvaluator } from './ai-evaluator';
import { DeterministicEvaluator } from './deterministic';

export type Round = Database['public']['Tables']['rounds']['Row'];
export type Challenge = Database['public']['Tables']['challenges']['Row'];
export type Hint = Database['public']['Tables']['hints']['Row'];

export class RoundEngine {
  static async getRound(roundId: string) {
    const { data: round, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();
    if (error) throw error;
    return round;
  }

  static async getChallenges(roundId: string) {
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('round_id', roundId)
      .order('order_index');
    if (error) throw error;
    return challenges;
  }

  static async getHints(challengeId: string) {
    const { data: hints, error } = await supabase
      .from('hints')
      .select('id, content, point_cost, order_index')
      .eq('challenge_id', challengeId)
      .order('order_index');
    if (error) throw error;
    return hints;
  }

  static async startRoundSession(teamId: string, roundId: string) {
    // Upsert or insert a round session to track start time
    const { data, error } = await supabase
      .from('round_sessions')
      .upsert({
        team_id: teamId,
        round_id: roundId,
        started_at: new Date().toISOString(),
      }, { onConflict: 'team_id, round_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async evaluateChallenge(challenge: Challenge, answer: string) {
    const config = challenge.configuration as any;
    const type = config.evaluation_type || 'manual';

    if (type === 'deterministic') {
      const passed = DeterministicEvaluator.evaluate(answer, config.expected_output, config.match_type || 'exact');
      return { passed, score: passed ? 100 : 0, feedback: passed ? "Correct" : "Incorrect" };
    } else if (type === 'ai') {
      return await AIEvaluator.evaluate(answer, config.rubric || '', { 
        provider: config.ai_provider || 'openai', 
        model: config.ai_model || 'gpt-4o-mini' 
      });
    }

    return { passed: false, score: 0, feedback: "Unsupported evaluation type" };
  }

  static async submitAnswer(teamId: string, roundSessionId: string, challenge: Challenge, answer: string, attemptCount: number, hintsUsed: number) {
    // 1. Evaluate
    const evalResult = await this.evaluateChallenge(challenge, answer);
    const isCorrect = evalResult.passed;

    // 2. Submit score
    const submission = await ScoringEngine.submitAnswer(
      teamId,
      roundSessionId,
      challenge.id,
      answer,
      isCorrect,
      attemptCount,
      hintsUsed
    );

    return { submission, evaluation: evalResult };
  }
}
