type EvaluationCriterion = {
  name: string;
  score: number;
  maxScore: number;
  passed: boolean;
};

type EvaluationResult = {
  totalScore: number;
  maxScore: number;
  passed: boolean;
  breakdown: EvaluationCriterion[];
  feedback: string[];
};

const WORD_RE = /[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g;

const normalizeText = (value: unknown) => String(value ?? '').toLowerCase();

const tokenize = (value: unknown): string[] => normalizeText(value).match(WORD_RE) ?? [];

const wordCount = (value: unknown) => tokenize(value).length;

const sentenceCount = (value: unknown) => {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  return text.split(/[.!?]+/).filter(part => part.trim().length > 0).length || 1;
};

const toConstraintText = (constraint: unknown) => {
  if (typeof constraint === 'string') return constraint;
  if (constraint && typeof constraint === 'object') {
    const typedConstraint = constraint as Record<string, unknown>;
    return String(
      typedConstraint.text ?? typedConstraint.label ?? typedConstraint.name ?? typedConstraint.constraint ?? ''
    );
  }
  return String(constraint ?? '');
};

const scoreCriterion = (name: string, score: number, maxScore: number): EvaluationCriterion => ({
  name,
  score: Math.max(0, Math.min(score, maxScore)),
  maxScore,
  passed: score >= maxScore * 0.7,
});

const buildResult = (criteria: EvaluationCriterion[], feedback: string[]): EvaluationResult => {
  const maxScore = criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
  const totalScore = criteria.reduce((sum, criterion) => sum + Math.max(0, Math.min(criterion.score, criterion.maxScore)), 0);

  return {
    totalScore,
    maxScore,
    passed: totalScore >= maxScore * 0.7,
    breakdown: criteria.map(criterion => ({
      ...criterion,
      score: Math.max(0, Math.min(criterion.score, criterion.maxScore)),
      passed: criterion.score >= criterion.maxScore * 0.7,
    })),
    feedback,
  };
};

export function evaluatePrecision(promptText: string): EvaluationResult {
  const prompt = String(promptText ?? '').trim();
  const words = wordCount(prompt);
  const sentences = sentenceCount(prompt);
  const specificityMarkers = ['exactly', 'precisely', 'clearly', 'step by step', 'format', 'constraints', 'include', 'exclude'];
  const hasSpecificity = specificityMarkers.filter(marker => normalizeText(prompt).includes(marker)).length;
  const vagueWords = ['thing', 'stuff', 'something', 'maybe', 'somehow', 'etc'];
  const vagueHits = vagueWords.filter(word => tokenize(prompt).includes(word)).length;

  const criteria = [
    scoreCriterion('Specificity', Math.min(40, hasSpecificity * 10 + Math.max(0, 10 - Math.abs(words - 24)) * 2), 40),
    scoreCriterion('Conciseness', words >= 12 && words <= 48 ? 25 : Math.max(8, 25 - Math.abs(words - 30)), 25),
    scoreCriterion('Structure', sentences >= 1 ? Math.min(20, sentences * 6) : 0, 20),
    scoreCriterion('Clarity', Math.max(0, 15 - vagueHits * 5), 15),
  ];

  const feedback = [] as string[];
  if (hasSpecificity === 0) feedback.push('Add explicit instructions, constraints, or output format details.');
  if (words < 12) feedback.push('The prompt is probably too short to be precise.');
  if (vagueHits > 0) feedback.push('Replace vague language with concrete terms.');

  return buildResult(criteria, feedback);
}

export function evaluateConstraints(
  promptText: string,
  expectedOutput: string,
  constraints: unknown[] = []
): EvaluationResult {
  const prompt = normalizeText(promptText);
  const output = normalizeText(expectedOutput);
  const constraintTexts = constraints.length > 0 ? constraints.map(toConstraintText).filter(Boolean) : ['Required constraints'];
  const totalConstraints = constraintTexts.length;
  const pointsPerConstraint = totalConstraints > 0 ? 70 / totalConstraints : 70;

  const constraintScores = constraintTexts.map((constraintText, index) => {
    const normalizedConstraint = normalizeText(constraintText);
    const keywords = tokenize(constraintText).filter(word => word.length > 3);
    const keywordHits = keywords.filter(keyword => prompt.includes(keyword) || output.includes(keyword)).length;
    const mentioned = prompt.includes(normalizedConstraint) || output.includes(normalizedConstraint);
    const score = Math.min(
      pointsPerConstraint,
      mentioned ? pointsPerConstraint : Math.max(0, (keywordHits / Math.max(1, keywords.length)) * pointsPerConstraint)
    );

    return scoreCriterion(`Constraint ${index + 1}`, score, pointsPerConstraint);
  });

  const outputWords = wordCount(expectedOutput);
  const lengthCriterion = scoreCriterion(
    'Output Length',
    outputWords > 0 ? Math.max(0, Math.min(15, 15 - Math.max(0, outputWords - 120) / 8)) : 0,
    15
  );

  const promptCriterion = scoreCriterion(
    'Prompt Guidance',
    prompt.includes('must') || prompt.includes('should') || prompt.includes('ensure') ? 15 : 5,
    15
  );

  const feedback = [] as string[];
  if (constraintScores.some(criterion => !criterion.passed)) feedback.push('At least one constraint is not clearly enforced.');
  if (outputWords === 0) feedback.push('Provide an expected output to validate the constraints.');

  return buildResult([...constraintScores, lengthCriterion, promptCriterion], feedback);
}

export function evaluateContextExtraction(
  promptText: string,
  expectedOutput: string,
  noisyContext: string,
  expectedFacts: unknown[] = [],
  maxOutputWords?: number
): EvaluationResult {
  const prompt = normalizeText(promptText);
  const output = normalizeText(expectedOutput);
  const context = normalizeText(noisyContext);
  const facts = expectedFacts.length > 0 ? expectedFacts.map(toConstraintText).filter(Boolean) : [];
  const factKeywords = facts.flatMap(fact => tokenize(fact).filter(word => word.length > 3));
  const hitCount = factKeywords.filter(keyword => output.includes(keyword) || prompt.includes(keyword)).length;
  const factCoverage = factKeywords.length > 0 ? hitCount / factKeywords.length : 1;

  const criteria = [
    scoreCriterion('Fact Coverage', factCoverage * 40, 40),
    scoreCriterion('Noise Handling', prompt.includes('ignore') || prompt.includes('irrelevant') || prompt.includes('only use') ? 25 : 10, 25),
    scoreCriterion('Length Control', typeof maxOutputWords === 'number' && maxOutputWords > 0
      ? Math.max(0, 20 - Math.max(0, wordCount(expectedOutput) - maxOutputWords))
      : 12, 20),
    scoreCriterion('Context Focus', context.length > 0 && output.length > 0 ? 15 : 0, 15),
  ];

  const feedback = [] as string[];
  if (factCoverage < 0.7 && facts.length > 0) feedback.push('The response misses several expected facts.');
  if (maxOutputWords && wordCount(expectedOutput) > maxOutputWords) feedback.push('The output exceeds the requested word limit.');
  if (!prompt.includes('ignore') && !prompt.includes('irrelevant')) feedback.push('Clarify that the model should ignore noisy context.');

  return buildResult(criteria, feedback);
}

export function evaluateDebugging(
  brokenPrompt: string,
  improvedPrompt: string,
  knownIssues: unknown[] = []
): EvaluationResult {
  const broken = normalizeText(brokenPrompt);
  const prompt = normalizeText(improvedPrompt);
  const issues = knownIssues.length > 0 ? knownIssues.map(toConstraintText).filter(Boolean) : [];
  const issueKeywords = issues.flatMap(issue => tokenize(issue).filter(word => word.length > 3));
  const issueHits = issueKeywords.filter(keyword => prompt.includes(keyword)).length;
  const fixLanguageHits = ['fix', 'debug', 'analyze', 'identify', 'resolve', 'test', 'inspect'].filter(word => prompt.includes(word)).length;

  const criteria = [
    scoreCriterion('Issue Awareness', issueKeywords.length > 0 ? (issueHits / issueKeywords.length) * 40 : 20, 40),
    scoreCriterion('Repair Guidance', fixLanguageHits > 0 ? Math.min(25, fixLanguageHits * 8) : 5, 25),
    scoreCriterion('Prompt Improvement', prompt === broken ? 0 : 20, 20),
    scoreCriterion('Specificity', wordCount(improvedPrompt) >= 8 ? 15 : 5, 15),
  ];

  const feedback = [] as string[];
  if (prompt === broken) feedback.push('The revised prompt is too similar to the broken version.');
  if (issueHits < issueKeywords.length && issueKeywords.length > 0) feedback.push('Address more of the known issues directly.');
  if (fixLanguageHits === 0) feedback.push('Add explicit debugging or repair language.');

  return buildResult(criteria, feedback);
}
