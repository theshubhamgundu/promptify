/**
 * Round 2: Per-Question Scoring Parameters
 * 
 * Implements relevance gate + bonus elements scoring system:
 * - minWordCount: minimum words to pass relevance gate
 * - coreConcepts: must hit ≥40% to pass gate
 * - requiredElements: bonus patterns that add points (additive, not penalty for absence)
 */

export interface ScoringElement {
  pattern: RegExp;
  label: string;
  weight: number;
}

export interface QuestionScoringParams {
  minWordCount: number;
  coreConcepts: string[];
  requiredElements: ScoringElement[];
}

export interface RelevanceGateResult {
  passed: boolean;
  wordCount: number;
  conceptsMatched: string[];
  conceptMatchRate: number;
  reason?: string;
}

export interface BonusElementsResult {
  totalBonus: number;
  maxBonus: number;
  matchedElements: Array<{
    label: string;
    weight: number;
    matched: boolean;
  }>;
}

/**
 * All 16 questions' scoring parameters
 */
export const QUESTION_SCORING_PARAMS: Record<string, QuestionScoringParams> = {
  // PRECISION CHALLENGES
  'P1': {
    minWordCount: 20,
    coreConcepts: ['word', 'paragraph', 'sentence', 'quote', 'announcement'],
    requiredElements: [
      { pattern: /\bexactly\b.*180|\b180\b.*word/i, label: 'exact 180-word count specified', weight: 3 },
      { pattern: /\bexactly\b.*2\s*sentence|\btwo\s*sentence/i, label: 'exact 2-sentences-per-paragraph specified', weight: 3 },
      { pattern: /"[^"]+"|quote/i, label: 'quote format/handling specified', weight: 2 },
      { pattern: /blank line|paragraph break|\\n\\n/i, label: 'explicit paragraph separation', weight: 2 }
    ]
  },
  
  'P2': {
    minWordCount: 15,
    coreConcepts: ['bullet', 'requirement', 'benefit', 'title', 'job'],
    requiredElements: [
      { pattern: /exactly\s*5|five\s*bullet/i, label: 'exact 5 requirements specified', weight: 3 },
      { pattern: /exactly\s*3|three\s*bullet/i, label: 'exact 3 benefits specified', weight: 3 },
      { pattern: /all\s*caps|uppercase|capital letters/i, label: 'all-caps title specified', weight: 2 },
      { pattern: /under\s*120|120\s*word|word limit/i, label: 'word cap specified', weight: 2 }
    ]
  },
  
  'P3': {
    minWordCount: 15,
    coreConcepts: ['ingredient', 'numbered', 'list', 'prep', 'recipe'],
    requiredElements: [
      { pattern: /numbered list|1\.|numeric/i, label: 'numbered (not bulleted) list specified', weight: 3 },
      { pattern: /8\s*word|under\s*8|eight\s*word/i, label: '8-word-per-line cap specified', weight: 3 },
      { pattern: /"prep:|prep:\s*x\s*mins|prep time/i, label: 'exact "Prep: X mins" format specified', weight: 3 },
      { pattern: /estimate|no.*time.*stated|if.*missing/i, label: 'fallback for missing prep time', weight: 2 }
    ]
  },
  
  'P4': {
    minWordCount: 15,
    coreConcepts: ['english', 'hindi', 'tamil', 'line', 'language'],
    requiredElements: [
      { pattern: /\[english\]/i, label: 'exact [English] bracket format', weight: 2 },
      { pattern: /\[hindi\]/i, label: 'exact [Hindi] bracket format', weight: 2 },
      { pattern: /\[tamil\]/i, label: 'exact [Tamil] bracket format', weight: 2 },
      { pattern: /devanagari|script|no.*latin|no.*roman|zero.*english/i, label: 'explicit script-purity instruction', weight: 3 }
    ]
  },

  // CONSTRAINT CHALLENGES
  'C1': {
    minWordCount: 10,
    coreConcepts: ['word', 'syllable', 'summarize', 'simple'],
    requiredElements: [
      { pattern: /exactly\s*25|25\s*word/i, label: 'exact 25-word count specified', weight: 3 },
      { pattern: /1.?2\s*syllable|two\s*syllable|simple\s*word/i, label: 'syllable restriction specified', weight: 3 },
      { pattern: /count.*before|verify|check.*before/i, label: 'self-verification instruction included', weight: 2 }
    ]
  },
  
  'C2': {
    minWordCount: 15,
    coreConcepts: ['checklist', 'checkbox', 'verb', 'header', 'task'],
    requiredElements: [
      { pattern: /☐|checkbox symbol|"☐ "/i, label: 'exact checkbox symbol specified', weight: 3 },
      { pattern: /\*\*to-do\*\*|bold.*header/i, label: 'exact bold header format specified', weight: 3 },
      { pattern: /verb|command form|action word/i, label: 'verb-first rewriting instruction included', weight: 3 }
    ]
  },
  
  'C3': {
    minWordCount: 15,
    coreConcepts: ['negative', 'thank', 'review', 'response', 'word'],
    requiredElements: [
      { pattern: /bad|poor|disappointing|negative word/i, label: 'explicit negative-word ban list', weight: 2 },
      { pattern: /thank you|thanks/i, label: 'explicit thank-you ban', weight: 2 },
      { pattern: /under\s*40|40\s*word/i, label: 'exact 40-word cap specified', weight: 2 },
      { pattern: /appreciat|value.*feedback|alternative.*express/i, label: 'alternative-gratitude-expression instruction', weight: 3 }
    ]
  },
  
  'C4': {
    minWordCount: 15,
    coreConcepts: ['line', 'question', 'statement', 'poem'],
    requiredElements: [
      { pattern: /exactly\s*6|six\s*line/i, label: 'exact 6-line count specified', weight: 3 },
      { pattern: /odd.*question|1,\s*3,\s*5/i, label: 'odd-line question rule specified', weight: 3 },
      { pattern: /even.*statement|2,\s*4,\s*6/i, label: 'even-line statement rule specified', weight: 3 }
    ]
  },

  // CONTEXT EXTRACTION CHALLENGES
  'CX1': {
    minWordCount: 15,
    coreConcepts: ['sentiment', 'urgent', 'issue', 'transcript', 'line'],
    requiredElements: [
      { pattern: /exactly\s*2\s*line|two\s*line/i, label: 'exact 2-line output format specified', weight: 3 },
      { pattern: /positive.*negative.*mixed|enum/i, label: 'fixed sentiment label set specified', weight: 2 },
      { pattern: /single|one|most urgent|only/i, label: 'single-issue-only instruction (not a list)', weight: 3 }
    ]
  },
  
  'CX2': {
    minWordCount: 15,
    coreConcepts: ['conflict', 'time', 'invite', 'email', 'schedule'],
    requiredElements: [
      { pattern: /"no conflict"|exactly.*no conflict/i, label: 'exact fallback string specified', weight: 3 },
      { pattern: /timezone|implied|subtle/i, label: 'timezone/subtlety awareness instruction', weight: 3 },
      { pattern: /do not assume|only if|genuine/i, label: 'anti-hallucination instruction', weight: 3 }
    ]
  },
  
  'CX3': {
    minWordCount: 15,
    coreConcepts: ['complaint', 'severity', 'rank', 'top'],
    requiredElements: [
      { pattern: /exactly\s*2|top\s*2|two.*only/i, label: 'exact top-2-only instruction specified', weight: 3 },
      { pattern: /severity|impact|not.*emotional|not.*tone/i, label: 'severity-over-tone judgment instruction', weight: 3 },
      { pattern: /drop|exclude|do not include/i, label: 'explicit exclusion of remaining items', weight: 2 }
    ]
  },
  
  'CX4': {
    minWordCount: 15,
    coreConcepts: ['assumption', 'plan', 'unstated', 'business'],
    requiredElements: [
      { pattern: /"no hidden assumption found"|exact.*fallback/i, label: 'exact fallback string specified', weight: 3 },
      { pattern: /not explicitly|not.*written|silently/i, label: 'clear "unstated" definition given', weight: 2 },
      { pattern: /one sentence|single sentence|brief/i, label: 'output length constraint specified', weight: 2 }
    ]
  },

  // DEBUGGING CHALLENGES
  'D1': {
    minWordCount: 15,
    coreConcepts: ['benefit', 'invent', 'real', 'product'],
    requiredElements: [
      { pattern: /do not invent|don't fabricate|only.*real|only.*stated/i, label: 'explicit anti-fabrication instruction', weight: 4 },
      { pattern: /fewer than 3|less than 3|only.*those/i, label: 'handles fewer-than-3-benefits case', weight: 3 },
      { pattern: /most significant|choose.*top/i, label: 'handles more-than-3-benefits case', weight: 2 }
    ]
  },
  
  'D2': {
    minWordCount: 15,
    coreConcepts: ['shorter', 'paragraph', 'percent', 'length'],
    requiredElements: [
      { pattern: /50\%|half|percentage/i, label: 'concrete percentage/number target specified', weight: 4 },
      { pattern: /already short|under\s*20|floor|keep as is/i, label: 'floor/edge-case for already-short input', weight: 3 }
    ]
  },
  
  'D3': {
    minWordCount: 15,
    coreConcepts: ['summarize', 'instruction', 'message', 'ignore'],
    requiredElements: [
      { pattern: /not.*instruction|treat.*as.*data|literal/i, label: 'explicit data-not-instruction framing', weight: 4 },
      { pattern: /no matter|regardless|however.*phrased|nested/i, label: 'robustness against rephrased/nested attacks', weight: 4 },
      { pattern: /never output anything other than/i, label: 'hard output-format lock regardless of input', weight: 2 }
    ]
  },
  
  'D4': {
    minWordCount: 15,
    coreConcepts: ['rating', 'average', 'review', 'number'],
    requiredElements: [
      { pattern: /do not invent|no.*fabricat|not available|no rating/i, label: 'explicit anti-hallucination for missing ratings', weight: 4 },
      { pattern: /normalize|scale|out of 5|out of 10/i, label: 'handles mixed-scale normalization', weight: 4 }
    ]
  }
};

/**
 * Check if submission passes relevance gate
 * Gate requirements: minWordCount AND ≥40% core concept match
 */
export function checkRelevanceGate(
  promptText: string,
  params: QuestionScoringParams
): RelevanceGateResult {
  
  const words = promptText.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Check word count
  if (wordCount < params.minWordCount) {
    return {
      passed: false,
      wordCount,
      conceptsMatched: [],
      conceptMatchRate: 0,
      reason: `Too short: ${wordCount} words (min ${params.minWordCount})`
    };
  }
  
  // Check core concepts
  const promptLower = promptText.toLowerCase();
  const matchedConcepts = params.coreConcepts.filter(concept =>
    promptLower.includes(concept.toLowerCase())
  );
  
  const conceptMatchRate = matchedConcepts.length / params.coreConcepts.length;
  
  if (conceptMatchRate < 0.4) {
    return {
      passed: false,
      wordCount,
      conceptsMatched: matchedConcepts,
      conceptMatchRate,
      reason: `Low concept match: ${(conceptMatchRate * 100).toFixed(0)}% (need ≥40%)`
    };
  }
  
  return {
    passed: true,
    wordCount,
    conceptsMatched: matchedConcepts,
    conceptMatchRate
  };
}

/**
 * Calculate bonus points from required elements
 * These are additive bonuses - absence doesn't penalize beyond base score
 */
export function calculateBonusElements(
  promptText: string,
  params: QuestionScoringParams
): BonusElementsResult {
  
  const matchedElements = params.requiredElements.map(element => ({
    label: element.label,
    weight: element.weight,
    matched: element.pattern.test(promptText)
  }));
  
  const totalBonus = matchedElements
    .filter(e => e.matched)
    .reduce((sum, e) => sum + e.weight, 0);
  
  const maxBonus = params.requiredElements
    .reduce((sum, e) => sum + e.weight, 0);
  
  return {
    totalBonus,
    maxBonus,
    matchedElements
  };
}

/**
 * Get question ID from question index (0-15) -> P1-P4, C1-C4, CX1-CX4, D1-D4
 */
export function getQuestionIdFromIndex(index: number): string {
  const subRound = Math.floor(index / 4);
  const questionInSubRound = (index % 4) + 1;
  
  const prefixes = ['P', 'C', 'CX', 'D'];
  return `${prefixes[subRound]}${questionInSubRound}`;
}

/**
 * Get scoring params for a question by index or ID
 */
export function getScoringParams(questionIdOrIndex: string | number): QuestionScoringParams | null {
  const questionId = typeof questionIdOrIndex === 'number'
    ? getQuestionIdFromIndex(questionIdOrIndex)
    : questionIdOrIndex;
  
  return QUESTION_SCORING_PARAMS[questionId] || null;
}
