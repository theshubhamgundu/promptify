/**
 * Round 3: Vision Challenge Auto-Evaluator
 * 
 * Uses AI-as-Judge to automatically evaluate vision challenge submissions
 * NO IMAGE STORAGE - only text processing
 */

import { supabase } from './supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface VisionEvaluationResult {
  accuracy_score: number; // 0-40
  accuracy_reasoning: string;
  completeness_score: number; // 0-30
  completeness_reasoning: string;
  prompt_quality_score: number; // 0-20
  prompt_quality_reasoning: string;
  specificity_score: number; // 0-10
  specificity_reasoning: string;
  total_score: number; // 0-100
  overall_feedback: string;
}

export interface ScoringRubric {
  expected_elements: {
    key_objects?: string[];
    key_concepts?: string[];
    required_details?: string[];
    [key: string]: any;
  };
  accuracy_weight: number;
  completeness_weight: number;
  prompt_quality_weight: number;
  specificity_weight: number;
  passing_score: number;
}

// =============================================================================
// JUDGE AI SYSTEM PROMPT
// =============================================================================

const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for a prompt engineering competition focused on vision AI capabilities.

Your task: Evaluate how well a participant's prompt enabled an AI to analyze an image.

## Evaluation Criteria:

1. **ACCURACY (0-40 points)**: Does the AI's response correctly identify the key elements and concepts from the image? Are there any factual errors or hallucinations?

2. **COMPLETENESS (0-30 points)**: Did the AI provide all the required information specified in the challenge? Are all expected elements covered?

3. **PROMPT QUALITY (0-20 points)**: Was the participant's prompt clear, well-structured, and effective? Did it guide the AI to produce a high-quality response?

4. **SPECIFICITY (0-10 points)**: Did the response include specific details rather than generic descriptions?

## Guidelines:

- Be objective and consistent in scoring
- Base scores strictly on the rubric provided
- Provide brief, actionable reasoning for each score
- The AI's response quality reflects the participant's prompt engineering skill
- Return only valid JSON in the specified format

## Critical Notes:

- You are evaluating the AI's RESPONSE, which demonstrates how good the participant's PROMPT was
- A perfect prompt should produce a response that is accurate, complete, specific, and relevant
- Poor responses indicate poor prompts, even if the participant "tried hard"`;

// =============================================================================
// EVALUATION PROMPT BUILDER
// =============================================================================

function buildEvaluationPrompt(params: {
  challengeTitle: string;
  challengeDescription: string;
  rubric: ScoringRubric;
  participantPrompt: string;
  aiResponse: string;
}): string {
  return `# CHALLENGE CONTEXT

**Title**: ${params.challengeTitle}
**Description**: ${params.challengeDescription}

**Expected Elements**:
${JSON.stringify(params.rubric.expected_elements, null, 2)}

---

# SUBMISSION TO EVALUATE

## Participant's Prompt:
\`\`\`
${params.participantPrompt}
\`\`\`

## AI's Response (generated using participant's prompt):
\`\`\`
${params.aiResponse}
\`\`\`

---

# YOUR TASK

Evaluate this submission and return ONLY valid JSON in this exact format:

\`\`\`json
{
  "accuracy_score": <number 0-40>,
  "accuracy_reasoning": "<brief explanation>",
  "completeness_score": <number 0-30>,
  "completeness_reasoning": "<brief explanation>",
  "prompt_quality_score": <number 0-20>,
  "prompt_quality_reasoning": "<brief explanation>",
  "specificity_score": <number 0-10>,
  "specificity_reasoning": "<brief explanation>",
  "total_score": <sum of all scores 0-100>,
  "overall_feedback": "<1-2 sentences of constructive feedback>"
}
\`\`\`

Return ONLY the JSON, no additional text.`;
}

// =============================================================================
// CALL JUDGE AI
// =============================================================================

async function callJudgeAI(params: {
  challengeTitle: string;
  challengeDescription: string;
  rubric: ScoringRubric;
  participantPrompt: string;
  aiResponse: string;
}): Promise<VisionEvaluationResult> {
  
  const evaluationPrompt = buildEvaluationPrompt(params);
  
  // Get judge API key from environment
  const judgeApiKey = import.meta.env.VITE_JUDGE_API_KEY || process.env.JUDGE_API_KEY;
  
  if (!judgeApiKey) {
    throw new Error('JUDGE_API_KEY not configured. Cannot perform automatic evaluation.');
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${judgeApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview', // Fast and reliable for judging
        temperature: 0.1, // Low temp for consistent evaluation
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: evaluationPrompt }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Judge API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    // Validate and clamp scores
    return {
      accuracy_score: Math.max(0, Math.min(40, result.accuracy_score || 0)),
      accuracy_reasoning: result.accuracy_reasoning || 'No reasoning provided',
      completeness_score: Math.max(0, Math.min(30, result.completeness_score || 0)),
      completeness_reasoning: result.completeness_reasoning || 'No reasoning provided',
      prompt_quality_score: Math.max(0, Math.min(20, result.prompt_quality_score || 0)),
      prompt_quality_reasoning: result.prompt_quality_reasoning || 'No reasoning provided',
      specificity_score: Math.max(0, Math.min(10, result.specificity_score || 0)),
      specificity_reasoning: result.specificity_reasoning || 'No reasoning provided',
      total_score: Math.max(0, Math.min(100, result.total_score || 0)),
      overall_feedback: result.overall_feedback || 'Evaluation completed'
    };
    
  } catch (error: any) {
    console.error('Judge AI error:', error);
    throw new Error(`Evaluation failed: ${error.message}`);
  }
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

export async function evaluateVisionSubmission(params: {
  submissionId: string;
  challengeData: {
    id: string;
    title: string;
    description: string;
    configuration: {
      scoring_rubric?: ScoringRubric;
    };
  };
  participantPrompt: string;
  aiResponse: string;
}): Promise<VisionEvaluationResult> {
  
  // Update status to EVALUATING
  await supabase
    .from('vision_submissions')
    .update({ evaluation_status: 'EVALUATING' })
    .eq('id', params.submissionId);
  
  try {
    // Get rubric from challenge config or use default
    const rubric: ScoringRubric = params.challengeData.configuration.scoring_rubric || {
      expected_elements: {},
      accuracy_weight: 40,
      completeness_weight: 30,
      prompt_quality_weight: 20,
      specificity_weight: 10,
      passing_score: 60
    };
    
    // Call Judge AI for evaluation
    const evaluation = await callJudgeAI({
      challengeTitle: params.challengeData.title,
      challengeDescription: params.challengeData.description,
      rubric,
      participantPrompt: params.participantPrompt,
      aiResponse: params.aiResponse
    });
    
    // Update submission with evaluation results
    await supabase
      .from('vision_submissions')
      .update({
        evaluation_result: evaluation,
        total_score: evaluation.total_score,
        evaluation_status: 'COMPLETED',
        evaluated_at: new Date().toISOString()
      })
      .eq('id', params.submissionId);
    
    return evaluation;
    
  } catch (error: any) {
    console.error('Evaluation error:', error);
    
    // Mark as failed
    await supabase
      .from('vision_submissions')
      .update({
        evaluation_status: 'FAILED',
        evaluation_result: {
          error: error.message,
          total_score: 0
        }
      })
      .eq('id', params.submissionId);
    
    throw error;
  }
}

// =============================================================================
// HELPER: Get Challenge Best Score
// =============================================================================

export async function getVisionBestScore(
  teamId: string,
  challengeId: string
): Promise<number> {
  const { data } = await supabase.rpc('get_vision_best_score', {
    p_team_id: teamId,
    p_challenge_id: challengeId
  });
  
  return data || 0;
}

// =============================================================================
// HELPER: Get Remaining Attempts
// =============================================================================

export async function getVisionRemainingAttempts(
  teamId: string,
  challengeId: string,
  maxAttempts: number = 3
): Promise<number> {
  const { data } = await supabase.rpc('get_vision_remaining_attempts', {
    p_team_id: teamId,
    p_challenge_id: challengeId,
    p_max_attempts: maxAttempts
  });
  
  return data || 0;
}
