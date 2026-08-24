import { AIGateway, AIProviderConfig } from './ai-gateway';

export class AIEvaluator {
  static async evaluate(
    answer: string, 
    rubric: string, 
    providerConfig: AIProviderConfig = { provider: 'openai', model: 'gpt-4o-mini' }
  ): Promise<{ passed: boolean; score: number; feedback: string }> {
    const prompt = `
You are an expert judge evaluating a participant's answer in a Prompt Engineering Championship.

RUBRIC:
${rubric}

PARTICIPANT'S ANSWER:
${answer}

Evaluate the answer against the rubric.
Respond ONLY with a valid JSON object in the exact format:
{
  "passed": boolean,
  "score": number (0 to 100),
  "feedback": "string explaining the evaluation"
}
`;

    try {
      const response = await AIGateway.generate(prompt, providerConfig);
      
      // Extract JSON in case the model added markdown blocks
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid response format from AI evaluator.");
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("AI Evaluation failed", error);
      return { passed: false, score: 0, feedback: "Evaluation error occurred." };
    }
  }
}
