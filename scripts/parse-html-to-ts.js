;;;;;;;;;;;;;;;;;;;;ll/.--;/**
 * Parse HTML quiz files and generate TypeScript quiz data
 * Run with: node scripts/parse-html-to-ts.js
 */

const fs = require('fs');
const path = require('path');

// Read HTML files
const promptEngineeringHtml = fs.readFileSync(
  path.join(__dirname, '../Prompt_Engineering_Question_Bank.htm'),
  'utf-8'
);

const fourthYearHtml = fs.readFileSync(
  path.join(__dirname, '../4thyrs.htm'),
  'utf-8'
);

// Helper to clean HTML text
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract questions from a section
function extractQuestions(html, startMarker, endMarker, yearLevel) {
  const startIndex = html.indexOf(startMarker);
  const endIndex = endMarker ? html.indexOf(endMarker, startIndex) : html.length;
  const section = html.substring(startIndex, endIndex);
  
  const questions = [];
  const questionRegex = /<p[^>]*><b><span[^>]*>Q(\d+)<\/span>[^<]*<\/b><\/p>([\s\S]*?)(?=<p[^>]*><b><span[^>]*>Q\d+<\/span>|<h1|<h2|$)/gi;
  
  let match;
  while ((match = questionRegex.exec(section)) !== null) {
    const questionNum = parseInt(match[1]);
    const questionBlock = match[2];
    
    // Extract question text (paragraphs before options)
    const textParts = [];
    const textRegex = /<p class=MsoNormal[^>]*>(?!<b>)([^<]+(?:<[^>]+>[^<]*)*?)<\/p>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(questionBlock)) !== null) {
      const text = cleanText(textMatch[1]);
      if (text && !text.match(/^[A-D]\./)) {
        textParts.push(text);
      }
    }
    
    // Extract options
    const options = [];
    const optionRegex = /<p[^>]*><b>([A-D])\.\s*<\/b>([^<]+(?:<[^>]+>[^<]*)*?)(?=<\/p>)/g;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(questionBlock)) !== null) {
      options.push({
        label: optionMatch[1],
        text: cleanText(optionMatch[2])
      });
    }
    
    if (textParts.length > 0 && options.length > 0) {
      questions.push({
        id: `${yearLevel}-q${questionNum}`,
        questionNumber: questionNum,
        questionText: textParts.join('\n\n'),
        options,
        yearLevel
      });
    }
  }
  
  return questions;
}

// Extract answers
function extractAnswers(html, sectionMarker) {
  const answers = {};
  const startIndex = html.indexOf(sectionMarker);
  if (startIndex === -1) return answers;
  
  const section = html.substring(startIndex, startIndex + 10000);
  
  // Look for answer patterns like "Q1: A" or "1. A" or similar
  const answerRegex = /Q?(\d+)[:\.\s]+([A-D](?:,\s*[A-D])*)/gi;
  let match;
  while ((match = answerRegex.exec(section)) !== null) {
    const questionNum = parseInt(match[1]);
    const answerLetters = match[2].split(/,\s*/).map(a => a.trim());
    answers[questionNum] = answerLetters;
  }
  
  return answers;
}

// Parse all questions
console.log('Parsing 2nd Year questions...');
const secondYearQuestions = extractQuestions(
  promptEngineeringHtml,
  'Round 1 � 2nd Year',
  'Round 1 � 3rd Year',
  '2nd'
);
console.log(`Found ${secondYearQuestions.length} 2nd year questions`);

console.log('Parsing 3rd Year questions...');
const thirdYearQuestions = extractQuestions(
  promptEngineeringHtml,
  'Round 1 � 3rd Year',
  'Answer Key',
  '3rd'
);
console.log(`Found ${thirdYearQuestions.length} 3rd year questions`);

console.log('Parsing 4th Year questions...');
const fourthYearQuestions = extractQuestions(
  fourthYearHtml,
  '<body',
  null,
  '4th'
);
console.log(`Found ${fourthYearQuestions.length} 4th year questions`);

// Extract answers for 4th year (they're in the HTML)
console.log('Extracting 4th year answers from HTML...');
const fourthYearAnswerRegex = /<b>(?:Answer|Correct):\s*([A-D](?:,\s*[A-D])*)<\/b>/gi;
let answerMatch;
let answerIndex = 0;
while ((answerMatch = fourthYearAnswerRegex.exec(fourthYearHtml)) !== null) {
  if (fourthYearQuestions[answerIndex]) {
    const answers = answerMatch[1].split(/,\s*/).map(a => a.trim());
    fourthYearQuestions[answerIndex].correctAnswers = answers;
    fourthYearQuestions[answerIndex].questionType = answers.length > 1 ? 'MULTI_SELECT' : 'SINGLE_ANSWER';
    fourthYearQuestions[answerIndex].points = answers.length > 1 ? 2 : 1;
    answerIndex++;
  }
}

console.log('\n=== Summary ===');
console.log(`2nd Year: ${secondYearQuestions.length} questions`);
console.log(`3rd Year: ${thirdYearQuestions.length} questions`);
console.log(`4th Year: ${fourthYearQuestions.length} questions (${fourthYearQuestions.filter(q => q.correctAnswers).length} with answers)`);
console.log('\nManual step required:');
console.log('- Extract 2nd and 3rd year answers from "Answer Key" section');
console.log('- Update quiz-questions.ts with correct answers');

// Generate TypeScript file structure
const output = `// This file was auto-generated from HTML quiz files
// You need to manually add the correct answers for 2nd and 3rd year questions

export interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  questionType: 'SINGLE_ANSWER' | 'MULTI_SELECT';
  imageUrl?: string;
  points: number;
  options: QuizOption[];
  correctAnswers: string[];
}

export interface QuizOption {
  label: string;
  text: string;
}

// 2nd YEAR QUESTIONS (30 questions)
export const SECOND_YEAR_QUESTIONS: QuizQuestion[] = ${JSON.stringify(secondYearQuestions, null, 2)};

// 3rd YEAR QUESTIONS (36 questions)  
export const THIRD_YEAR_QUESTIONS: QuizQuestion[] = ${JSON.stringify(thirdYearQuestions, null, 2)};

// 4th YEAR QUESTIONS (29 questions)
export const FOURTH_YEAR_QUESTIONS: QuizQuestion[] = ${JSON.stringify(fourthYearQuestions, null, 2)};
`;

fs.writeFileSync(
  path.join(__dirname, '../src/data/quiz-questions-generated.ts'),
  output
);

console.log('\n✅ Generated: src/data/quiz-questions-generated.ts');
console.log('⚠️  Next: Manually extract answers from Answer Key section and add to questions');
