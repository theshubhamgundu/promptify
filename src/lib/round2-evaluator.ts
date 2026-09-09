/**
 * Round 2: Prompt Heist - Evaluation Engine
 * 
 * 100% deterministic evaluation:
 * - Hidden test execution via LLM at temp=0 (only to execute team's prompt)
 * - Constraint checking via regex/rules (deterministic)
 * - Grammar checking via heuristics (deterministic)
 * - Score calculation via formula (deterministic)
 * - Relevance gate + bonus elements scoring system
 * 
 * NO live LLM judgment for scoring!
 */

import type { Round2Question, ConstraintRule } from './round2-questions';
import { 
  checkRelevanceGate, 
  calculateBonusElements, 
  getQuestionIdFromIndex, 
  getScoringParams,
  type RelevanceGateResult,
  type BonusElementsResult
} from './round2-scoring-params';

// =============================================================================
// TYPES
// =============================================================================

export interface EvaluationResult {
  questionId: string;
  totalScore: number; // Out of 50
  maxScore: number; // Always 50
  timeTakenSeconds: number;
  breakdown: {
    hiddenTestScore: number; // Max 32 points (HiddenTestPass% × 0.8 × 40)
    grammarScore: number; // Max 10 points (GrammarScore × 2)
    constraintScore: number; // Max 10 points (ConstraintScore × 2)
    timeBonus: number; // Max 2.5 points (TimeBonus × 0.5)
    relevanceGateScore?: number; // Relevance gate pass/fail
    bonusElementsScore?: number; // Bonus elements points
  };
  hiddenTestResults: HiddenTestResult[];
  constraintResults: ConstraintResult[];
  grammarIssues: GrammarIssue[];
  feedback: string[];
  relevanceGateResult?: RelevanceGateResult;
  bonusElementsResult?: BonusElementsResult;
}

export interface HiddenTestResult {
  testId: string;
  description: string;
  passed: boolean;
  reason?: string;
  output?: string;
}

export interface ConstraintResult {
  constraintType: string;
  description: string;
  passed: boolean;
  weight: number;
  reason?: string;
}

export interface GrammarIssue {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

// =============================================================================
// CONSTRAINT VALIDATORS
// =============================================================================

/**
 * Check exact word count
 */
export function checkExactWordCount(text: string, targetCount: number): boolean {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length === targetCount;
}

/**
 * Check max word count
 */
export function checkMaxWordCount(text: string, maxCount: number): boolean {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length <= maxCount;
}

/**
 * Check paragraph count (blank line separated)
 */
export function checkParagraphCount(text: string, targetCount: number): boolean {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  return paragraphs.length === targetCount;
}

/**
 * Check sentences per paragraph
 */
export function checkSentencesPerParagraph(text: string, sentencesPerParagraph: number): boolean {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length !== sentencesPerParagraph) {
      return false;
    }
  }
  
  return paragraphs.length > 0;
}

/**
 * Check line count
 */
export function checkLineCount(text: string, targetCount: number): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  return lines.length === targetCount;
}

/**
 * Check max words per line
 */
export function checkMaxWordsPerLine(text: string, maxWords: number): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  for (const line of lines) {
    const words = line.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length > maxWords) {
      return false;
    }
  }
  
  return lines.length > 0;
}

/**
 * Check numbered list format (1. 2. 3.)
 */
export function checkNumberedListFormat(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const numberedLines = lines.filter(line => /^\d+\.\s+/.test(line.trim()));
  return numberedLines.length > 0 && numberedLines.length === lines.length;
}

/**
 * Check bullet point format in specific section
 */
export function checkBulletCountInSection(text: string, sectionName: string, targetCount: number): boolean {
  const regex = new RegExp(`${sectionName}[:\\s]*([\\s\\S]*?)(?=\\n\\s*[A-Z][a-z]+:|$)`, 'i');
  const match = text.match(regex);
  
  if (!match) return false;
  
  const sectionContent = match[1];
  const bullets = sectionContent.match(/^[\s]*[•\-\*]\s+/gm) || [];
  
  return bullets.length === targetCount;
}

/**
 * Check if text is ALL CAPS
 */
export function checkAllCaps(text: string): boolean {
  const letterOnly = text.replace(/[^A-Za-z]/g, '');
  if (letterOnly.length === 0) return false;
  return letterOnly === letterOnly.toUpperCase();
}

/**
 * Check line ending pattern (e.g., lines 1,3,5 end with "?")
 */
export function checkLineEndingPattern(text: string, lineNumbers: number[], endChar: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  for (const lineNum of lineNumbers) {
    if (lineNum > lines.length) return false;
    const line = lines[lineNum - 1].trim();
    if (!line.endsWith(endChar)) return false;
  }
  
  return true;
}

/**
 * Simple syllable counter (vowel-group heuristic)
 */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length === 0) return 0;
  
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 0;
  
  // Adjust for silent 'e' at end
  if (word.endsWith('e') && count > 1) {
    count--;
  }
  
  return Math.max(1, count);
}

/**
 * Check all words have max syllables
 */
export function checkMaxSyllables(text: string, maxSyllables: number): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  
  for (const word of words) {
    if (countSyllables(word) > maxSyllables) {
      return false;
    }
  }
  
  return words.length > 0;
}

/**
 * Check if text contains verb-first phrases (basic check)
 */
export function checkVerbFirstPhrases(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const verbPrefixes = ['prepare', 'complete', 'review', 'send', 'call', 'write', 'read', 'update', 'check', 'create', 'delete', 'add', 'remove', 'fix', 'test', 'deploy', 'build', 'run', 'start', 'stop', 'open', 'close', 'save', 'load'];
  
  let verbFirstCount = 0;
  for (const line of lines) {
    const cleaned = line.replace(/^[\s☐\-\*•\d\.]+/, '').trim().toLowerCase();
    if (verbPrefixes.some(verb => cleaned.startsWith(verb))) {
      verbFirstCount++;
    }
  }
  
  // At least 70% should be verb-first
  return lines.length > 0 && (verbFirstCount / lines.length) >= 0.7;
}

/**
 * Check for negative words (case-insensitive, with leetspeak variants)
 */
export function checkNegativeWords(text: string): boolean {
  const negativePatterns = [
    /\bb[a4@]d\b/i,
    /\bp[o0][o0]r\b/i,
    /\bd[i1]s[a4@]pp[o0][i1]nt/i,
    /\bt[e3]rr[i1]bl[e3]/i,
    /\b[a4@]wful\b/i,
    /\bh[o0]rr[i1]bl[e3]/i,
    /\bw[o0]rst\b/i,
    /\bd[i1]sgust/i,
    /\bh[a4@]t[e3]\b/i,
    /\bunpl[e3][a4@]s[a4@]nt\b/i
  ];
  
  return !negativePatterns.some(pattern => pattern.test(text));
}

/**
 * Check for "thank" variants (case-insensitive, with leetspeak)
 */
export function checkThankWords(text: string): boolean {
  const thankPatterns = [
    /th[a4@]nk/i,
    /th[a4@]nx/i,
    /th[a4@]nq/i,
    /gr[a4@]t[e3]ful/i
  ];
  
  return !thankPatterns.some(pattern => pattern.test(text));
}

/**
 * Check Hindi line has no Latin characters
 */
export function checkHindiLinePurity(text: string): boolean {
  const lines = text.split('\n');
  const hindiLine = lines.find(line => line.includes('[Hindi]'));
  
  if (!hindiLine) return false;
  
  const contentAfterBracket = hindiLine.split(']')[1] || '';
  const latinChars = contentAfterBracket.match(/[A-Za-z]/g);
  
  return !latinChars || latinChars.length === 0;
}

/**
 * Check Tamil line has no Latin/Hindi characters
 */
export function checkTamilLinePurity(text: string): boolean {
  const lines = text.split('\n');
  const tamilLine = lines.find(line => line.includes('[Tamil]'));
  
  if (!tamilLine) return false;
  
  const contentAfterBracket = tamilLine.split(']')[1] || '';
  const latinChars = contentAfterBracket.match(/[A-Za-z]/g);
  const devanagariRange = /[\u0900-\u097F]/;
  
  return (!latinChars || latinChars.length === 0) && !devanagariRange.test(contentAfterBracket);
}

/**
 * Check line order matches expected
 */
export function checkLineOrder(text: string, expectedOrder: string[]): boolean {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  for (let i = 0; i < expectedOrder.length; i++) {
    if (i >= lines.length) return false;
    if (!lines[i].includes(`[${expectedOrder[i]}]`)) return false;
  }
  
  return true;
}

// =============================================================================
// GRAMMAR CHECKER (Simple Heuristics)
// =============================================================================

export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  
  // Check for double spaces
  if (/\s{2,}/.test(text)) {
    issues.push({
      type: 'spacing',
      message: 'Multiple consecutive spaces found',
      severity: 'warning'
    });
  }
  
  // Check for missing capitalization after periods
  const sentenceCapPattern = /[.!?]\s+[a-z]/g;
  if (sentenceCapPattern.test(text)) {
    issues.push({
      type: 'capitalization',
      message: 'Sentence should start with capital letter',
      severity: 'error'
    });
  }
  
  // Check for missing spaces after punctuation
  const punctuationSpacePattern = /[,;:][A-Za-z]/g;
  if (punctuationSpacePattern.test(text)) {
    issues.push({
      type: 'punctuation',
      message: 'Missing space after punctuation',
      severity: 'warning'
    });
  }
  
  // Check for incomplete sentences (very short sentences without punctuation)
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 50 && !/[.!?]$/.test(trimmed)) {
      // Only flag if it's not a title or header
      if (!/^[A-Z\s]+$/.test(trimmed) && !/^\*\*.*\*\*$/.test(trimmed)) {
        issues.push({
          type: 'sentence',
          message: 'Possible incomplete sentence',
          severity: 'warning'
        });
        break; // Only report once
      }
    }
  }
  
  // Check for repeated words
  const repeatedWordPattern = /\b(\w+)\s+\1\b/gi;
  if (repeatedWordPattern.test(text)) {
    issues.push({
      type: 'repetition',
      message: 'Repeated word detected',
      severity: 'warning'
    });
  }
  
  // STRICTER CHECKS: Common spelling mistakes and typos
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  
  // Track consecutive similar characters (likely typos)
  const typoPattern = /(.)\1{2,}/g; // 3+ same characters in a row
  if (typoPattern.test(text.toLowerCase())) {
    issues.push({
      type: 'spelling',
      message: 'Possible typo: repeated characters detected',
      severity: 'error'
    });
  }
  
  // Check for excessive character count in words (likely keyboard mashing)
  for (const word of words) {
    if (word.length > 20) {
      issues.push({
        type: 'spelling',
        message: `Unusually long word detected: "${word.substring(0, 20)}..."`,
        severity: 'error'
      });
      break;
    }
  }
  
  // Check for low vowel-to-consonant ratio (indicates nonsense words)
  let nonsenseWordCount = 0;
  for (const word of words) {
    if (word.length >= 5) {
      const vowels = (word.match(/[aeiou]/g) || []).length;
      const consonants = (word.match(/[bcdfghjklmnpqrstvwxyz]/g) || []).length;
      
      // If no vowels in a 5+ letter word, likely nonsense
      if (vowels === 0 && consonants >= 5) {
        nonsenseWordCount++;
      }
      
      // If vowel ratio < 15%, likely nonsense
      if (vowels > 0 && consonants > 0) {
        const vowelRatio = vowels / (vowels + consonants);
        if (vowelRatio < 0.15) {
          nonsenseWordCount++;
        }
      }
    }
  }
  
  // If more than 10% of words are nonsense, flag it
  if (words.length > 0 && (nonsenseWordCount / words.length) > 0.1) {
    issues.push({
      type: 'spelling',
      message: `Multiple spelling errors detected (${nonsenseWordCount} suspicious words)`,
      severity: 'error'
    });
  }
  
  // Check for common misspellings and letter substitutions
  const commonMisspellings = [
    /\bw[o0]{2,}rk\b/gi, // woork, w0ork
    /\bt[e3]{2,}st\b/gi, // teest, t3est
    /\bc[o0]{2,}d[e3]\b/gi, // coode, c0de
    /\bp[l1]{2,}[e3]{2,}[a@]s[e3]\b/gi, // pleease
    /\bh[e3]{2,}lp\b/gi, // heeelp
  ];
  
  for (const pattern of commonMisspellings) {
    if (pattern.test(text)) {
      issues.push({
        type: 'spelling',
        message: 'Common misspelling or character substitution detected',
        severity: 'error'
      });
      break;
    }
  }
  
  return issues;
}

/**
 * Calculate grammar score (0-5)
 * STRICTER SCORING: Each error deducts 1 point, each warning deducts 0.5 points
 */
export function calculateGrammarScore(issues: GrammarIssue[]): number {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  // Score = 5 - (errors × 1.0 + warnings × 0.5), capped at [0, 5]
  const deduction = (errorCount * 1.0) + (warningCount * 0.5);
  return Math.max(0, Math.min(5, 5 - deduction));
}

// =============================================================================
// CONSTRAINT EVALUATOR
// =============================================================================

export function evaluateConstraints(
  output: string,
  constraints: ConstraintRule[]
): { results: ConstraintResult[], score: number } {
  const results: ConstraintResult[] = [];
  let passedWeight = 0;
  let totalWeight = 0;
  
  for (const constraint of constraints) {
    totalWeight += constraint.weight;
    let passed = false;
    let reason = '';
    
    // Parse validator and check
    const validator = constraint.validator;
    
    try {
      switch (constraint.type) {
        case 'word_count':
          if (validator.startsWith('exact_count:')) {
            const target = parseInt(validator.split(':')[1]);
            passed = checkExactWordCount(output, target);
            reason = passed ? `Word count is exactly ${target}` : `Word count is not ${target}`;
          } else if (validator.startsWith('max_count:')) {
            const max = parseInt(validator.split(':')[1]);
            passed = checkMaxWordCount(output, max);
            reason = passed ? `Word count under ${max}` : `Word count exceeds ${max}`;
          }
          break;
          
        case 'structure':
          if (validator.startsWith('paragraph_count:')) {
            const target = parseInt(validator.split(':')[1]);
            passed = checkParagraphCount(output, target);
            reason = passed ? `Has ${target} paragraphs` : `Paragraph count mismatch`;
          } else if (validator.startsWith('sentences_per_paragraph:')) {
            const target = parseInt(validator.split(':')[1]);
            passed = checkSentencesPerParagraph(output, target);
            reason = passed ? `Each paragraph has ${target} sentences` : `Sentence count per paragraph incorrect`;
          } else if (validator.startsWith('line_count:')) {
            const target = parseInt(validator.split(':')[1]);
            passed = checkLineCount(output, target);
            reason = passed ? `Has ${target} lines` : `Line count mismatch`;
          } else if (validator.startsWith('bullet_count_section:')) {
            const parts = validator.split(':');
            const section = parts[1];
            const count = parseInt(parts[2]);
            passed = checkBulletCountInSection(output, section, count);
            reason = passed ? `${section} has ${count} bullets` : `${section} bullet count incorrect`;
          } else if (validator.startsWith('numbered_list_count:')) {
            const target = parseInt(validator.split(':')[1]);
            const lines = output.split('\n').filter(l => /^\d+\.\s+/.test(l.trim()));
            passed = lines.length === target;
            reason = passed ? `Has ${target} numbered items` : `Numbered list count incorrect`;
          } else if (validator.startsWith('line_order:')) {
            const order = validator.split(':')[1].split(',');
            passed = checkLineOrder(output, order);
            reason = passed ? 'Line order correct' : 'Line order incorrect';
          }
          break;
          
        case 'format':
          if (validator === 'numbered_list_format') {
            passed = checkNumberedListFormat(output);
            reason = passed ? 'Uses numbered list format' : 'Not using numbered list format';
          }
          break;
          
        case 'regex':
          if (validator.startsWith('line_ending_pattern:')) {
            const parts = validator.split(':');
            const lineNums = parts[1].split(',').map(n => parseInt(n));
            const endChar = parts[2];
            passed = checkLineEndingPattern(output, lineNums, endChar);
            reason = passed ? 'Line endings correct' : 'Line ending pattern incorrect';
          } else {
            // Direct regex match
            const regex = new RegExp(validator, 'i');
            passed = regex.test(output);
            reason = passed ? 'Pattern found' : 'Pattern not found';
          }
          break;
          
        case 'content':
          if (validator.startsWith('max_words_per_line:')) {
            const max = parseInt(validator.split(':')[1]);
            passed = checkMaxWordsPerLine(output, max);
            reason = passed ? `All lines under ${max} words` : `Some lines exceed ${max} words`;
          } else if (validator.startsWith('syllable_check_max:')) {
            const max = parseInt(validator.split(':')[1]);
            passed = checkMaxSyllables(output, max);
            reason = passed ? `All words ≤ ${max} syllables` : `Some words exceed ${max} syllables`;
          } else if (validator === 'verb_first_check') {
            passed = checkVerbFirstPhrases(output);
            reason = passed ? 'Items start with verbs' : 'Items not verb-first';
          } else if (validator === 'negative_word_ban') {
            passed = checkNegativeWords(output);
            reason = passed ? 'No negative words' : 'Contains negative words';
          } else if (validator.includes('thank')) {
            passed = checkThankWords(output);
            reason = passed ? 'No "thank" variants' : 'Contains "thank" variants';
          } else if (validator === 'hindi_line_no_latin') {
            passed = checkHindiLinePurity(output);
            reason = passed ? 'Hindi line pure' : 'Hindi line has Latin characters';
          } else if (validator === 'tamil_line_no_latin_or_hindi') {
            passed = checkTamilLinePurity(output);
            reason = passed ? 'Tamil line pure' : 'Tamil line has Latin/Hindi characters';
          } else if (validator === 'single_issue_check') {
            // Check that output mentions only one issue (no list markers, no "and also")
            const hasListMarkers = /[•\-\*]\s+/g.test(output) || /\d+\.\s+/g.test(output);
            const hasMultipleMarkers = output.split(/and|also|additionally/i).length > 2;
            passed = !hasListMarkers && !hasMultipleMarkers;
            reason = passed ? 'Single issue only' : 'Multiple issues detected';
          } else if (validator === 'strict_structure_only') {
            // Check output only has expected structure (header + list items)
            const lines = output.split('\n').filter(l => l.trim().length > 0);
            const hasHeader = lines[0].includes('**To-Do**');
            const allOthersAreCheckboxes = lines.slice(1).every(l => l.trim().startsWith('☐'));
            passed = hasHeader && allOthersAreCheckboxes;
            reason = passed ? 'Strict structure' : 'Extra content outside structure';
          }
          break;
      }
      
      if (passed) {
        passedWeight += constraint.weight;
      }
      
      results.push({
        constraintType: constraint.type,
        description: constraint.description,
        passed,
        weight: constraint.weight,
        reason
      });
      
    } catch (error) {
      results.push({
        constraintType: constraint.type,
        description: constraint.description,
        passed: false,
        weight: constraint.weight,
        reason: `Validation error: ${error}`
      });
    }
  }
  
  // Score out of 5
  const score = totalWeight > 0 ? (passedWeight / totalWeight) * 5 : 0;
  
  return { results, score };
}

// =============================================================================
// TIME BONUS CALCULATOR
// =============================================================================

export function calculateTimeBonus(timeTakenSeconds: number): number {
  // TimeBonus = max(0, 5 - (time_taken / 30))
  // Max bonus when finishing quickly, 0 bonus at 150 seconds
  const bonus = Math.max(0, 5 - (timeTakenSeconds / 30));
  return Math.min(5, bonus);
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate a Round 2 submission
 * 
 * @param question - The question being evaluated
 * @param teamPrompt - The prompt text submitted by the team
 * @param modelOutput - The output generated by running team's prompt (from hidden tests)
 * @param hiddenTestResults - Results from running hidden test cases
 * @param timeTakenSeconds - How long the team took
 * @param questionDisplayId - Optional display ID (P1-P4, C1-C4, etc.) for scoring params lookup
 */
export function evaluateRound2Submission(
  question: Round2Question,
  teamPrompt: string,
  modelOutput: string,
  hiddenTestResults: HiddenTestResult[],
  timeTakenSeconds: number,
  questionDisplayId?: string
): EvaluationResult {
  
  // 1. Check relevance gate if scoring params available
  let relevanceGateResult: RelevanceGateResult | undefined;
  let bonusElementsResult: BonusElementsResult | undefined;
  let relevanceGateScore = 0;
  let bonusElementsScore = 0;
  
  if (questionDisplayId) {
    const scoringParams = getScoringParams(questionDisplayId);
    if (scoringParams) {
      relevanceGateResult = checkRelevanceGate(teamPrompt, scoringParams);
      bonusElementsResult = calculateBonusElements(teamPrompt, scoringParams);
      
      // Relevance gate: pass = base points, fail = heavy penalty
      relevanceGateScore = relevanceGateResult.passed ? 5 : 0;
      
      // Bonus elements: scale to max 5 points
      bonusElementsScore = bonusElementsResult.maxBonus > 0
        ? (bonusElementsResult.totalBonus / bonusElementsResult.maxBonus) * 5
        : 0;
    }
  }
  
  // 2. Calculate hidden test pass percentage
  const passedTests = hiddenTestResults.filter(t => t.passed).length;
  const totalTests = hiddenTestResults.length;
  const hiddenTestPassPercent = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  
  // 3. Check constraints on model output
  const { results: constraintResults, score: constraintScore } = evaluateConstraints(
    modelOutput,
    question.constraints
  );
  
  // 4. Check grammar on team's prompt
  const grammarIssues = checkGrammar(teamPrompt);
  const grammarScore = calculateGrammarScore(grammarIssues);
  
  // 5. Calculate time bonus
  const timeBonus = calculateTimeBonus(timeTakenSeconds);
  
  // 6. Apply scoring formula with relevance gate + bonus elements
  const breakdown = {
    hiddenTestScore: (hiddenTestPassPercent / 100) * 0.8 * 40, // Max 32 points
    grammarScore: grammarScore * 2, // Max 10 points
    constraintScore: constraintScore * 2, // Max 10 points
    timeBonus: timeBonus * 0.5, // Max 2.5 points
    relevanceGateScore, // Max 5 points
    bonusElementsScore // Max 5 points (scaled from bonus weight)
  };
  
  const totalScore = Math.min(
    50,
    breakdown.hiddenTestScore + 
    breakdown.grammarScore + 
    breakdown.constraintScore + 
    breakdown.timeBonus +
    breakdown.relevanceGateScore +
    breakdown.bonusElementsScore
  );
  
  // 7. Generate feedback
  const feedback: string[] = [];
  
  if (relevanceGateResult && !relevanceGateResult.passed) {
    feedback.push(`❌ Relevance gate failed: ${relevanceGateResult.reason}`);
  }
  
  if (hiddenTestPassPercent < 70) {
    feedback.push(`Only ${passedTests}/${totalTests} hidden tests passed. Review edge cases.`);
  }
  
  if (constraintScore < 4) {
    const failedConstraints = constraintResults.filter(c => !c.passed);
    feedback.push(`${failedConstraints.length} constraint(s) not met: ${failedConstraints.map(c => c.description).join(', ')}`);
  }
  
  if (grammarIssues.length > 0) {
    const errors = grammarIssues.filter(i => i.severity === 'error').length;
    if (errors > 0) {
      feedback.push(`${errors} grammar error(s) in your prompt.`);
    }
  }
  
  if (bonusElementsResult && bonusElementsResult.totalBonus < bonusElementsResult.maxBonus * 0.5) {
    feedback.push(`Only captured ${bonusElementsResult.totalBonus}/${bonusElementsResult.maxBonus} bonus elements. Be more specific!`);
  }
  
  if (timeBonus === 0) {
    feedback.push('No time bonus - try to complete faster next time.');
  }
  
  if (totalScore >= 45) {
    feedback.push('Excellent work! Nearly perfect score.');
  } else if (totalScore >= 35) {
    feedback.push('Good job, but there is room for improvement.');
  }
  
  return {
    questionId: question.id,
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore: question.maxScore,
    timeTakenSeconds,
    breakdown: {
      hiddenTestScore: Math.round(breakdown.hiddenTestScore * 100) / 100,
      grammarScore: Math.round(breakdown.grammarScore * 100) / 100,
      constraintScore: Math.round(breakdown.constraintScore * 100) / 100,
      timeBonus: Math.round(breakdown.timeBonus * 100) / 100,
      relevanceGateScore: Math.round(breakdown.relevanceGateScore * 100) / 100,
      bonusElementsScore: Math.round(breakdown.bonusElementsScore * 100) / 100
    },
    hiddenTestResults,
    constraintResults,
    grammarIssues,
    feedback,
    relevanceGateResult,
    bonusElementsResult
  };
}
