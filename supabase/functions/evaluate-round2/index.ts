import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Import evaluation logic (you'd need to port the evaluator to Deno/TS)
// For now, this is a placeholder structure

serve(async (req) => {
  try {
    const { submissionId, teamPrompt, questionId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get question data
    const { data: question, error: questionError } = await supabase
      .from('round2_questions')
      .select('*')
      .eq('id', questionId)
      .single();
    
    if (questionError || !question) {
      throw new Error('Question not found');
    }
    
    // ════════════════════════════════════════════════════════════
    // EVALUATION STEPS
    // ════════════════════════════════════════════════════════════
    
    // 1. Execute team's prompt against hidden test cases at temp=0
    //    This requires calling your LLM provider (OpenAI, Anthropic, etc.)
    //    and running the team's prompt with each test input
    const hiddenTestResults = await executeHiddenTests(teamPrompt, question.hidden_test_cases);
    
    // 2. Get model output from first test (or aggregate)
    const modelOutput = hiddenTestResults[0]?.output || '';
    
    // 3. Check constraints deterministically
    const constraintResults = checkConstraints(modelOutput, question.constraint_rules);
    
    // 4. Check grammar on team's prompt
    const grammarIssues = checkGrammar(teamPrompt);
    const grammarScore = calculateGrammarScore(grammarIssues);
    
    // 5. Calculate scores
    const passedTests = hiddenTestResults.filter((t: any) => t.passed).length;
    const hiddenTestPassRate = (passedTests / hiddenTestResults.length) * 100;
    
    const constraintScore = calculateConstraintScore(constraintResults);
    
    // 6. Get submission for time bonus
    const { data: submission } = await supabase
      .from('round2_submissions')
      .select('time_taken_seconds')
      .eq('id', submissionId)
      .single();
    
    const timeBonus = calculateTimeBonus(submission?.time_taken_seconds || 150);
    
    // 7. Calculate total score
    const breakdown = {
      hiddenTestScore: (hiddenTestPassRate / 100) * 0.8 * 40, // Max 32
      grammarScore: grammarScore * 2, // Max 10
      constraintScore: constraintScore * 2, // Max 10
      timeBonus: timeBonus * 0.5 // Max 2.5
    };
    
    const totalScore = Math.min(
      50,
      breakdown.hiddenTestScore + breakdown.grammarScore + breakdown.constraintScore + breakdown.timeBonus
    );
    
    // 8. Generate feedback
    const feedback = generateFeedback(
      hiddenTestPassRate,
      constraintResults,
      grammarIssues,
      timeBonus
    );
    
    // 9. Build evaluation details
    const evaluationDetails = {
      breakdown,
      hiddenTestResults,
      constraintResults,
      grammarIssues,
      feedback,
      evaluatedAt: new Date().toISOString()
    };
    
    // 10. Update submission
    const { error: updateError } = await supabase.rpc('update_round2_evaluation', {
      p_submission_id: submissionId,
      p_total_score: totalScore,
      p_hidden_test_pass_rate: hiddenTestPassRate,
      p_grammar_score: grammarScore * 2,
      p_constraint_score: constraintScore * 2,
      p_time_bonus: timeBonus * 0.5,
      p_evaluation_details: evaluationDetails
    });
    
    if (updateError) throw updateError;
    
    return new Response(
      JSON.stringify({ success: true, totalScore, breakdown, feedback }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// ════════════════════════════════════════════════════════════════
// Helper Functions (Simplified - implement full logic from evaluator)
// ════════════════════════════════════════════════════════════════

async function executeHiddenTests(prompt: string, testCases: any[]): Promise<any[]> {
  // TODO: Implement actual LLM execution
  // For each test case, run the team's prompt with test input at temp=0
  // Check if output meets expected behavior
  return testCases.map(test => ({
    testId: test.id,
    passed: true, // Placeholder
    output: 'Sample output',
    reason: ''
  }));
}

function checkConstraints(output: string, rules: any[]): any[] {
  // TODO: Implement constraint checking from evaluator
  return rules.map(rule => ({
    type: rule.type,
    passed: true, // Placeholder
    reason: ''
  }));
}

function checkGrammar(text: string): any[] {
  // TODO: Implement grammar checking from evaluator
  return [];
}

function calculateGrammarScore(issues: any[]): number {
  const errorCount = issues.filter((i: any) => i.severity === 'error').length;
  const warningCount = issues.filter((i: any) => i.severity === 'warning').length;
  const deduction = (errorCount + warningCount * 0.5) / 2;
  return Math.max(0, Math.min(5, 5 - deduction));
}

function calculateConstraintScore(results: any[]): number {
  const passed = results.filter((r: any) => r.passed).length;
  return results.length > 0 ? (passed / results.length) * 5 : 0;
}

function calculateTimeBonus(seconds: number): number {
  return Math.max(0, Math.min(5, 5 - (seconds / 30)));
}

function generateFeedback(
  hiddenTestPassRate: number,
  constraintResults: any[],
  grammarIssues: any[],
  timeBonus: number
): string[] {
  const feedback: string[] = [];
  
  if (hiddenTestPassRate < 70) {
    feedback.push(`Only ${hiddenTestPassRate.toFixed(0)}% of hidden tests passed. Review edge cases.`);
  }
  
  const failedConstraints = constraintResults.filter((c: any) => !c.passed);
  if (failedConstraints.length > 0) {
    feedback.push(`${failedConstraints.length} constraint(s) not met.`);
  }
  
  const errors = grammarIssues.filter((i: any) => i.severity === 'error').length;
  if (errors > 0) {
    feedback.push(`${errors} grammar error(s) in your prompt.`);
  }
  
  if (timeBonus === 0) {
    feedback.push('No time bonus - try to complete faster next time.');
  }
  
  return feedback;
}
