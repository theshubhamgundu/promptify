/**
 * Zero-Cost Prompt Evaluation Engine
 * No AI API calls - 100% deterministic scoring
 * Designed for 600+ teams with zero budget
 */

interface EvaluationResult {
  totalScore: number;
  maxScore: number;
  breakdown: CriterionScore[];
  feedback: string[];
  passed: boolean;
}

interface CriterionScore {
  name: string;
  score: number;
  maxScore: number;
  passed: boolean;
  feedback: string;
}

interface Constraint {
  type: 'length' | 'tone' | 'must_include' | 'must_avoid' | 'structure' | 'format' | 'efficiency';
  requirement: any;
  weight: number;
}

// ============================================
// SUB-ROUND 1: PROMPT PRECISION EVALUATOR
// ============================================

export function evaluatePrecision(prompt: string): EvaluationResult {
  const criteria: CriterionScore[] = [];
  
  // 1. Tone Specification (20 points)
  const hasTone = checkForToneSpecification(prompt);
  criteria.push({
    name: 'Tone Specification',
    score: hasTone ? 20 : 0,
    maxScore: 20,
    passed: hasTone,
    feedback: hasTone 
      ? 'Prompt clearly specifies desired tone' 
      : 'Missing tone specification (professional, casual, formal, etc.)'
  });
  
  // 2. Length Requirement (20 points)
  const hasLength = checkForLengthRequirement(prompt);
  criteria.push({
    name: 'Length Requirement',
    score: hasLength ? 20 : 0,
    maxScore: 20,
    passed: hasLength,
    feedback: hasLength 
      ? 'Prompt specifies output length' 
      : 'Missing length specification (word count, sentence count, etc.)'
  });
  
  // 3. Format Specification (25 points)
  const hasFormat = checkForFormatSpecification(prompt);
  criteria.push({
    name: 'Format Specification',
    score: hasFormat ? 25 : 0,
    maxScore: 25,
    passed: hasFormat,
    feedback: hasFormat 
      ? 'Prompt defines output format/structure' 
      : 'Missing format specification (paragraphs, list, sections, etc.)'
  });
  
  // 4. Audience/Context (20 points)
  const hasAudience = checkForAudienceTarget(prompt);
  criteria.push({
    name: 'Audience/Context',
    score: hasAudience ? 20 : 0,
    maxScore: 20,
    passed: hasAudience,
    feedback: hasAudience 
      ? 'Prompt identifies target audience or context' 
      : 'Missing audience specification (who is this for?)'
  });
  
  // 5. Prompt Efficiency (15 points)
  const efficiencyScore = checkPromptEfficiency(prompt);
  criteria.push({
    name: 'Prompt Efficiency',
    score: efficiencyScore,
    maxScore: 15,
    passed: efficiencyScore >= 10,
    feedback: efficiencyScore >= 10 
      ? 'Prompt is concise and efficient' 
      : 'Prompt is too verbose or contains unnecessary instructions'
  });
  
  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  
  return {
    totalScore,
    maxScore: 100,
    breakdown: criteria,
    feedback: criteria.filter(c => !c.passed).map(c => c.feedback),
    passed: totalScore >= 60
  };
}

function checkForToneSpecification(prompt: string): boolean {
  const toneKeywords = [
    'tone', 'style', 'professional', 'casual', 'formal', 'friendly', 
    'conversational', 'authoritative', 'empathetic', 'enthusiastic',
    'serious', 'playful', 'respectful', 'persuasive'
  ];
  const lower = prompt.toLowerCase();
  return toneKeywords.some(kw => lower.includes(kw));
}

function checkForLengthRequirement(prompt: string): boolean {
  const lengthIndicators = [
    /\d+\s*(word|words|characters|chars|sentences|paragraphs)/i,
    /brief|concise|short|long|detailed/i,
    /approximately|around|about\s+\d+/i
  ];
  return lengthIndicators.some(pattern => pattern.test(prompt));
}

function checkForFormatSpecification(prompt: string): boolean {
  const formatKeywords = [
    'format', 'structure', 'paragraph', 'list', 'bullet', 'numbered',
    'heading', 'section', 'table', 'json', 'markdown', 'outline',
    'introduction', 'conclusion', 'organize', 'arrange'
  ];
  const lower = prompt.toLowerCase();
  return formatKeywords.some(kw => lower.includes(kw));
}

function checkForAudienceTarget(prompt: string): boolean {
  const audienceIndicators = [
    'audience', 'reader', 'user', 'customer', 'client', 'stakeholder',
    'technical', 'non-technical', 'expert', 'beginner', 'professional',
    'for', 'targeting', 'intended for'
  ];
  const lower = prompt.toLowerCase();
  return audienceIndicators.some(kw => lower.includes(kw));
}

function checkPromptEfficiency(prompt: string): number {
  const wordCount = prompt.split(/\s+/).length;
  
  // Optimal: 30-100 words
  if (wordCount >= 30 && wordCount <= 100) return 15;
  
  // Acceptable: 100-150 words
  if (wordCount > 100 && wordCount <= 150) return 12;
  
  // Too brief: < 30 words
  if (wordCount < 30) return 8;
  
  // Too verbose: > 150 words
  return Math.max(0, 15 - Math.floor((wordCount - 150) / 20));
}

// ============================================
// SUB-ROUND 2: CONSTRAINT MASTERY EVALUATOR
// ============================================

export function evaluateConstraints(
  prompt: string,
  output: string,
  constraints: Constraint[]
): EvaluationResult {
  const criteria: CriterionScore[] = [];
  
  constraints.forEach(constraint => {
    let score = 0;
    let feedback = '';
    let passed = false;
    
    switch (constraint.type) {
      case 'length':
        const result = checkLengthConstraint(output, constraint.requirement);
        score = result.passed ? constraint.weight : (result.partial ? constraint.weight * 0.5 : 0);
        feedback = result.feedback;
        passed = result.passed;
        break;
        
      case 'tone':
        const toneResult = checkToneConstraint(output, constraint.requirement);
        score = toneResult.passed ? constraint.weight : 0;
        feedback = toneResult.feedback;
        passed = toneResult.passed;
        break;
        
      case 'must_include':
        const includeResult = checkMustInclude(output, constraint.requirement);
        score = (includeResult.matchCount / includeResult.totalRequired) * constraint.weight;
        feedback = includeResult.feedback;
        passed = includeResult.matchCount === includeResult.totalRequired;
        break;
        
      case 'must_avoid':
        const avoidResult = checkMustAvoid(output, constraint.requirement);
        score = avoidResult.passed ? constraint.weight : 0;
        feedback = avoidResult.feedback;
        passed = avoidResult.passed;
        break;
        
      case 'structure':
        const structureResult = checkStructure(output, constraint.requirement);
        score = structureResult.passed ? constraint.weight : 0;
        feedback = structureResult.feedback;
        passed = structureResult.passed;
        break;
        
      case 'efficiency':
        const effResult = checkPromptEfficiencyAdvanced(prompt, constraint.requirement);
        score = effResult.score;
        feedback = effResult.feedback;
        passed = effResult.passed;
        break;
    }
    
    criteria.push({
      name: constraint.type.replace('_', ' ').toUpperCase(),
      score: Math.round(score),
      maxScore: constraint.weight,
      passed,
      feedback
    });
  });
  
  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxScore = constraints.reduce((sum, c) => sum + c.weight, 0);
  
  return {
    totalScore: Math.round(totalScore),
    maxScore,
    breakdown: criteria,
    feedback: criteria.filter(c => !c.passed).map(c => c.feedback),
    passed: totalScore >= maxScore * 0.7
  };
}

function checkLengthConstraint(
  output: string, 
  requirement: { min?: number; max?: number; exact?: number }
): { passed: boolean; partial: boolean; feedback: string } {
  const wordCount = output.split(/\s+/).filter(w => w.length > 0).length;
  
  if (requirement.exact) {
    const passed = wordCount === requirement.exact;
    const partial = Math.abs(wordCount - requirement.exact) <= 5;
    return {
      passed,
      partial,
      feedback: passed 
        ? `Exactly ${requirement.exact} words ✓` 
        : `Expected ${requirement.exact} words, got ${wordCount}`
    };
  }
  
  if (requirement.min && requirement.max) {
    const passed = wordCount >= requirement.min && wordCount <= requirement.max;
    const partial = 
      (wordCount >= requirement.min - 10 && wordCount <= requirement.max + 10);
    return {
      passed,
      partial,
      feedback: passed 
        ? `Word count ${wordCount} within range [${requirement.min}-${requirement.max}] ✓` 
        : `Expected ${requirement.min}-${requirement.max} words, got ${wordCount}`
    };
  }
  
  return { passed: false, partial: false, feedback: 'Invalid length requirement' };
}

function checkToneConstraint(
  output: string,
  requirement: string
): { passed: boolean; feedback: string } {
  const lower = output.toLowerCase();
  
  // Simple keyword-based tone detection
  const tonePatterns: Record<string, string[]> = {
    'professional': ['hereby', 'kindly', 'pleased', 'regards', 'sincerely', 'furthermore'],
    'casual': ['hey', 'cool', 'awesome', 'yeah', 'gonna', 'wanna'],
    'formal': ['cordially', 'pursuant', 'endeavor', 'accordingly', 'nevertheless'],
    'friendly': ['happy', 'excited', 'glad', 'love', 'enjoy', 'wonderful'],
  };
  
  const requiredTone = requirement.toLowerCase();
  const patterns = tonePatterns[requiredTone] || [];
  
  const matchCount = patterns.filter(p => lower.includes(p)).length;
  const passed = matchCount >= 1; // At least one tone indicator
  
  return {
    passed,
    feedback: passed 
      ? `Tone appears ${requiredTone} ✓` 
      : `Tone doesn't match "${requirement}"`
  };
}

function checkMustInclude(
  output: string,
  keywords: string[]
): { matchCount: number; totalRequired: number; feedback: string } {
  const lower = output.toLowerCase();
  const found = keywords.filter(kw => lower.includes(kw.toLowerCase()));
  const missing = keywords.filter(kw => !lower.includes(kw.toLowerCase()));
  
  return {
    matchCount: found.length,
    totalRequired: keywords.length,
    feedback: missing.length === 0 
      ? `All required keywords present ✓` 
      : `Missing keywords: ${missing.join(', ')}`
  };
}

function checkMustAvoid(
  output: string,
  keywords: string[]
): { passed: boolean; feedback: string } {
  const lower = output.toLowerCase();
  const prohibited = keywords.filter(kw => lower.includes(kw.toLowerCase()));
  
  return {
    passed: prohibited.length === 0,
    feedback: prohibited.length === 0 
      ? `No prohibited words used ✓` 
      : `Prohibited words found: ${prohibited.join(', ')}`
  };
}

function checkStructure(
  output: string,
  requirement: string
): { passed: boolean; feedback: string } {
  const lower = requirement.toLowerCase();
  
  if (lower.includes('paragraph')) {
    const match = requirement.match(/(\d+)\s*paragraph/);
    if (match) {
      const required = parseInt(match[1]);
      const paragraphs = output.split(/\n\n+/).filter(p => p.trim().length > 0);
      const passed = paragraphs.length === required;
      return {
        passed,
        feedback: passed 
          ? `${required} paragraphs ✓` 
          : `Expected ${required} paragraphs, found ${paragraphs.length}`
      };
    }
  }
  
  if (lower.includes('list') || lower.includes('bullet')) {
    const hasListItems = /^[\s]*[-*•]\s/m.test(output) || /^\d+\.\s/m.test(output);
    return {
      passed: hasListItems,
      feedback: hasListItems ? 'List format present ✓' : 'Missing list/bullet format'
    };
  }
  
  return { passed: true, feedback: 'Structure check passed' };
}

function checkPromptEfficiencyAdvanced(
  prompt: string,
  maxLength: number
): { score: number; passed: boolean; feedback: string } {
  const wordCount = prompt.split(/\s+/).length;
  
  if (wordCount <= maxLength) {
    return {
      score: 10,
      passed: true,
      feedback: `Prompt is efficient (${wordCount} words) ✓`
    };
  }
  
  const excess = wordCount - maxLength;
  const penalty = Math.min(10, excess * 0.5);
  
  return {
    score: Math.max(0, 10 - penalty),
    passed: false,
    feedback: `Prompt too long (${wordCount} words, max ${maxLength})`
  };
}

// ============================================
// SUB-ROUND 3: CONTEXT ENGINEERING EVALUATOR
// ============================================

export function evaluateContextExtraction(
  prompt: string,
  output: string,
  contextDocument: string,
  expectedFacts: string[],
  maxOutputWords: number
): EvaluationResult {
  const criteria: CriterionScore[] = [];
  
  // 1. Fact Accuracy (40 points)
  const factsFound = expectedFacts.filter(fact => 
    semanticMatch(output, fact, 0.7)
  );
  const factScore = (factsFound.length / expectedFacts.length) * 40;
  criteria.push({
    name: 'Information Accuracy',
    score: Math.round(factScore),
    maxScore: 40,
    passed: factsFound.length >= expectedFacts.length * 0.8,
    feedback: `Found ${factsFound.length}/${expectedFacts.length} required facts`
  });
  
  // 2. Noise Filtering (25 points)
  const noiseScore = checkNoiseFiltering(output, contextDocument);
  criteria.push(noiseScore);
  
  // 3. Hallucination Prevention (20 points)
  const hallucinationScore = checkHallucinations(output, contextDocument);
  criteria.push(hallucinationScore);
  
  // 4. Output Format (15 points)
  const wordCount = output.split(/\s+/).length;
  const formatPassed = wordCount <= maxOutputWords;
  criteria.push({
    name: 'Output Format',
    score: formatPassed ? 15 : Math.max(0, 15 - (wordCount - maxOutputWords) * 0.5),
    maxScore: 15,
    passed: formatPassed,
    feedback: formatPassed 
      ? `Output length ${wordCount}/${maxOutputWords} words ✓` 
      : `Output too long: ${wordCount}/${maxOutputWords} words`
  });
  
  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  
  return {
    totalScore: Math.round(totalScore),
    maxScore: 100,
    breakdown: criteria,
    feedback: criteria.filter(c => !c.passed).map(c => c.feedback),
    passed: totalScore >= 70
  };
}

function semanticMatch(text: string, target: string, threshold: number = 0.7): boolean {
  const textWords = text.toLowerCase().split(/\s+/);
  const targetWords = target.toLowerCase().split(/\s+/);
  
  const matches = targetWords.filter(word => 
    textWords.some(tw => tw.includes(word) || word.includes(tw))
  );
  
  return matches.length / targetWords.length >= threshold;
}

function checkNoiseFiltering(output: string, context: string): CriterionScore {
  // Check if output is focused and doesn't include irrelevant info
  const contextLength = context.split(/\s+/).length;
  const outputLength = output.split(/\s+/).length;
  const compressionRatio = outputLength / contextLength;
  
  // Good extraction should compress to < 10% of original
  const passed = compressionRatio <= 0.1;
  const score = passed ? 25 : Math.max(0, 25 - (compressionRatio - 0.1) * 100);
  
  return {
    name: 'Noise Filtering',
    score: Math.round(score),
    maxScore: 25,
    passed,
    feedback: passed 
      ? 'Output is focused and concise ✓' 
      : 'Output includes too much irrelevant information'
  };
}

function checkHallucinations(output: string, context: string): CriterionScore {
  // Simple check: if output contains specific details not in context
  const outputSentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const contextLower = context.toLowerCase();
  
  // Check for specific numbers/dates/names not in context
  const numberPattern = /\b\d+(\.\d+)?%?\b/g;
  const outputNumbers = output.match(numberPattern) || [];
  const contextNumbers = context.match(numberPattern) || [];
  
  const suspiciousNumbers = outputNumbers.filter(num => !contextNumbers.includes(num));
  
  const passed = suspiciousNumbers.length === 0;
  const score = Math.max(0, 20 - suspiciousNumbers.length * 5);
  
  return {
    name: 'Hallucination Prevention',
    score,
    maxScore: 20,
    passed,
    feedback: passed 
      ? 'No hallucinated details detected ✓' 
      : `Possible hallucinations: ${suspiciousNumbers.length} unverified details`
  };
}

// ============================================
// SUB-ROUND 4: PROMPT DEBUGGING EVALUATOR
// ============================================

export function evaluateDebugging(
  originalPrompt: string,
  fixedPrompt: string,
  knownIssues: string[]
): EvaluationResult {
  const criteria: CriterionScore[] = [];
  
  knownIssues.forEach(issue => {
    const originalHasIssue = checkIssue(originalPrompt, issue);
    const fixedHasIssue = checkIssue(fixedPrompt, issue);
    
    const fixed = originalHasIssue && !fixedHasIssue;
    const score = fixed ? 50 : 0; // 200 points / 4 issues = 50 each
    
    criteria.push({
      name: `Fix: ${issue}`,
      score,
      maxScore: 50,
      passed: fixed,
      feedback: fixed 
        ? `Issue "${issue}" successfully fixed ✓` 
        : `Issue "${issue}" not properly addressed`
    });
  });
  
  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  
  return {
    totalScore,
    maxScore: 200,
    breakdown: criteria,
    feedback: criteria.filter(c => !c.passed).map(c => c.feedback),
    passed: totalScore >= 140
  };
}

function checkIssue(prompt: string, issue: string): boolean {
  const lower = prompt.toLowerCase();
  
  switch (issue) {
    case 'missing_tone':
      return !checkForToneSpecification(prompt);
      
    case 'missing_context':
      return !/context|background|about|regarding/i.test(prompt);
      
    case 'vague_instructions':
      return prompt.split(/\s+/).length < 20; // Too short = vague
      
    case 'missing_format':
      return !checkForFormatSpecification(prompt);
      
    case 'no_length_spec':
      return !checkForLengthRequirement(prompt);
      
    default:
      return false;
  }
}
