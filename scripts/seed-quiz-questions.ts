/**
 * Script to parse HTML quiz files and seed questions into database
 * Run with: tsx scripts/seed-quiz-questions.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Types
interface QuizQuestion {
  questionNumber: number;
  questionText: string;
  questionType: 'SINGLE_ANSWER' | 'MULTI_SELECT';
  imageUrl?: string;
  points: number;
  options: QuizOption[];
  correctAnswers: string[];
}

interface QuizOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse Prompt Engineering Question Bank (2nd year - 30 questions)
 */
function parsePromptEngineeringQuestions(htmlContent: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  
  // Regex patterns
  const questionPattern = /<p[^>]*><b><span[^>]*>Q(\d+)<\/span>[^<]*<\/b><\/p>([\s\S]*?)(?=<p[^>]*><b><span[^>]*>Q\d+<\/span>|<h1|$)/gi;
  
  let match;
  while ((match = questionPattern.exec(htmlContent)) !== null) {
    const questionNum = parseInt(match[1]);
    const questionBlock = match[2];
    
    // Extract question text (paragraphs before options)
    const textParts: string[] = [];
    const textPattern = /<p class=MsoNormal[^>]*>(?!<b>)([^<]+)/g;
    let textMatch;
    while ((textMatch = textPattern.exec(questionBlock)) !== null) {
      const text = textMatch[1].trim();
      if (text && !text.match(/^[A-D]\./)) {
        textParts.push(text);
      }
    }
    
    // Extract options
    const options: QuizOption[] = [];
    const optionPattern = /<p[^>]*><b>([A-D])\.\s*<\/b>([^<]+)/g;
    let optionMatch;
    while ((optionMatch = optionPattern.exec(questionBlock)) !== null) {
      options.push({
        label: optionMatch[1],
        text: optionMatch[2].trim(),
        isCorrect: false, // Will be set based on answer key
      });
    }
    
    // Check for image
    const imageMatch = questionBlock.match(/<img[^>]*src="([^"]+)"/);
    const imageUrl = imageMatch ? imageMatch[1] : undefined;
    
    if (textParts.length > 0 && options.length > 0) {
      questions.push({
        questionNumber: questionNum,
        questionText: textParts.join('\n\n'),
        questionType: 'SINGLE_ANSWER', // Most are single answer
        imageUrl,
        points: 1,
        options,
        correctAnswers: [], // Will be populated from answer key
      });
    }
  }
  
  return questions;
}

/**
 * Parse 4th year questions (29 questions, mix of single and multi-select)
 */
function parse4thYearQuestions(htmlContent: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  
  // Pattern to extract questions
  const questionPattern = /<p[^>]*><b>Q(\d+)[^<]*<\/b><\/p>([\s\S]*?)(?=<p[^>]*><b>Q\d+|<div class=MsoNormal align=center|$)/gi;
  
  let match;
  while ((match = questionPattern.exec(htmlContent)) !== null) {
    const questionNum = parseInt(match[1]);
    const questionBlock = match[2];
    
    // Determine question type
    const isMultiSelect = questionBlock.includes('Multi-Select') || questionBlock.includes('TWO');
    
    // Extract question text
    const textParts: string[] = [];
    const paragraphs = questionBlock.match(/<p class=MsoNormal[^>]*>(?!<b>)([^<]+(?:<[^>]+>[^<]*)*)<\/p>/g) || [];
    
    for (const para of paragraphs) {
      const cleaned = para
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned && !cleaned.match(/^[A-D]\.|Answer:|Correct:/i)) {
        textParts.push(cleaned);
      }
    }
    
    // Extract options
    const options: QuizOption[] = [];
    const optionPattern = /<p[^>]*><b>([A-D])\.<\/b>\s*([^<]+(?:<[^>]+>[^<]*)*?)(?=<\/p>)/g;
    let optionMatch;
    while ((optionMatch = optionPattern.exec(questionBlock)) !== null) {
      const optionText = optionMatch[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, ' ')
        .trim();
      
      options.push({
        label: optionMatch[1],
        text: optionText,
        isCorrect: false,
      });
    }
    
    // Extract correct answer
    const correctAnswers: string[] = [];
    const answerMatch = questionBlock.match(/<b>(?:Answer|Correct):\s*([A-D](?:,\s*[A-D])*)<\/b>/i);
    if (answerMatch) {
      const answers = answerMatch[1].split(/,\s*/);
      correctAnswers.push(...answers);
      
      // Mark correct options
      options.forEach(opt => {
        if (answers.includes(opt.label)) {
          opt.isCorrect = true;
        }
      });
    }
    
    if (textParts.length > 0 && options.length > 0) {
      questions.push({
        questionNumber: questionNum,
        questionText: textParts.join('\n\n'),
        questionType: isMultiSelect ? 'MULTI_SELECT' : 'SINGLE_ANSWER',
        points: isMultiSelect ? 2 : 1,
        options,
        correctAnswers,
      });
    }
  }
  
  return questions;
}

/**
 * Apply answer key to Prompt Engineering questions
 */
function applyAnswerKey(questions: QuizQuestion[], answerKey: Record<number, string[]>): void {
  questions.forEach(q => {
    const answers = answerKey[q.questionNumber] || [];
    q.correctAnswers = answers;
    
    // Determine if multi-select
    if (answers.length > 1) {
      q.questionType = 'MULTI_SELECT';
      q.points = 2;
    }
    
    // Mark correct options
    q.options.forEach(opt => {
      opt.isCorrect = answers.includes(opt.label);
    });
  });
}

/**
 * Seed questions into database
 */
async function seedQuestions(roundId: string, questions: QuizQuestion[]): Promise<void> {
  console.log(`Seeding ${questions.length} questions for round ${roundId}...`);
  
  for (const q of questions) {
    // Insert question
    const { data: questionData, error: questionError } = await supabase
      .from('quiz_questions')
      .insert({
        round_id: roundId,
        question_number: q.questionNumber,
        question_text: q.questionText,
        question_type: q.questionType,
        image_url: q.imageUrl,
        points: q.points,
        order_index: q.questionNumber,
      })
      .select()
      .single();
    
    if (questionError) {
      console.error(`Error inserting question ${q.questionNumber}:`, questionError);
      continue;
    }
    
    // Insert options
    for (let i = 0; i < q.options.length; i++) {
      const opt = q.options[i];
      const { error: optionError } = await supabase
        .from('quiz_options')
        .insert({
          question_id: questionData.id,
          option_label: opt.label,
          option_text: opt.text,
          is_correct: opt.isCorrect,
          order_index: i,
        });
      
      if (optionError) {
        console.error(`Error inserting option ${opt.label} for question ${q.questionNumber}:`, optionError);
      }
    }
    
    console.log(`✓ Question ${q.questionNumber} seeded with ${q.options.length} options`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Read HTML files
    const promptEngineeringPath = path.join(__dirname, '../Prompt_Engineering_Question_Bank.htm');
    const fourthYearPath = path.join(__dirname, '../4thyrs.htm');
    
    const promptEngineeringHtml = fs.readFileSync(promptEngineeringPath, 'utf-8');
    const fourthYearHtml = fs.readFileSync(fourthYearPath, 'utf-8');
    
    // Parse questions
    console.log('Parsing Prompt Engineering questions...');
    const promptEngineeringQuestions = parsePromptEngineeringQuestions(promptEngineeringHtml);
    
    // Answer key for Prompt Engineering (2nd year)
    // This should be extracted from the HTML or provided separately
    const answerKey: Record<number, string[]> = {
      1: ['A'], 2: ['B'], 3: ['B'], 4: ['B'], 5: ['B'],
      6: ['A'], 7: ['B'], 8: ['B'], 9: ['B'], 10: ['B'],
      11: ['C'], 12: ['B'], 13: ['B'], 14: ['A'], 15: ['B'],
      16: ['B'], 17: ['B'], 18: ['B'], 19: ['A'], 20: ['B'],
      21: ['B'], 22: ['B'], 23: ['B'], 24: ['B'], 25: ['B'],
      26: ['B'], 27: ['B'], 28: ['B'], 29: ['B'], 30: ['B'],
    };
    
    applyAnswerKey(promptEngineeringQuestions, answerKey);
    
    console.log('Parsing 4th year questions...');
    const fourthYearQuestions = parse4thYearQuestions(fourthYearHtml);
    
    console.log(`\nParsed ${promptEngineeringQuestions.length} Prompt Engineering questions`);
    console.log(`Parsed ${fourthYearQuestions.length} 4th year questions`);
    
    // Get or create rounds
    // You'll need to provide the round IDs or create them first
    const ROUND_2ND_YEAR = process.env.ROUND_2ND_YEAR_ID || '';
    const ROUND_4TH_YEAR = process.env.ROUND_4TH_YEAR_ID || '';
    
    if (!ROUND_2ND_YEAR || !ROUND_4TH_YEAR) {
      console.error('Please set ROUND_2ND_YEAR_ID and ROUND_4TH_YEAR_ID environment variables');
      process.exit(1);
    }
    
    // Seed questions
    await seedQuestions(ROUND_2ND_YEAR, promptEngineeringQuestions);
    await seedQuestions(ROUND_4TH_YEAR, fourthYearQuestions);
    
    console.log('\n✓ All questions seeded successfully!');
  } catch (error) {
    console.error('Error seeding questions:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { parsePromptEngineeringQuestions, parse4thYearQuestions, applyAnswerKey, seedQuestions };
