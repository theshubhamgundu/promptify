# Round 2: Prompt Heist - Implementation Plan

## Overview
16 questions across 4 challenge types (Precision, Constraint, Context, Debugging)
- 4 sub-rounds × 4 questions each
- 1 attempt per question
- 2.5 minutes per question  
- 50 points per question (200 points total per sub-round, 800 points total)
- Progressive unlock (complete sub-round to unlock next)

## Scoring Formula
```
Total Score (out of 50) = 
  (HiddenTestPass% × 0.8 × 40) +  // 32 points max
  (GrammarScore × 2) +              // 10 points max from 0-5 score
  (ConstraintScore × 2) +           // 10 points max from 0-5 score  
  (TimeBonus × 0.5)                 // 2.5 points max from 0-5 bonus

Where:
- HiddenTestPass% = (passed_tests / total_tests) × 100
- GrammarScore = 5 - (grammar_errors / 2) capped at [0,5]
- ConstraintScore = constraints_passed / total_constraints × 5
- TimeBonus = max(0, 5 - (time_taken / 30)) for finishing under 2.5min
```

## Files Created

### 1. Database Schema ✅
- `041_round2_prompt_heist.sql` - Tables for questions, submissions, sessions

### 2. Seed Data (TODO)
- `042_round2_seed_questions.sql` - All 16 questions with:
  - Scenario text
  - Hidden test cases (JSON array)
  - Constraint rules (JSON object)
  - Reference answers

### 3. Evaluation Engine (TODO)
- `src/lib/round2-evaluator.ts` - Deterministic evaluation logic:
  - `executeHiddenTests()` - Run prompt against test cases at temp=0
  - `checkConstraints()` - Word count, format, regex validation
  - `checkGrammar()` - Grammar checking (can use simple heuristics)
  - `calculateScore()` - Apply scoring formula

### 4. UI Components (TODO)  
- `src/pages/Round2Heist.tsx` - Main round component
- `src/components/Round2Question.tsx` - Question display + textarea input
- `src/components/Round2Timer.tsx` - 2.5min countdown per question
- `src/components/Round2Results.tsx` - Score breakdown display

### 5. API/RPC Functions (TODO)
- `submit_round2_answer` - Supabase function to:
  1. Validate submission
  2. Call evaluation engine
  3. Store results
  4. Update session progress
  5. Check if sub-round complete
  6. Unlock next sub-round if needed

## Implementation Priority

### Phase 1: Core Infrastructure (DONE)
- [x] Database schema
- [ ] Seed 16 questions
- [ ] Basic evaluation engine structure

### Phase 2: Evaluation Logic  
- [ ] Hidden test execution harness
- [ ] Constraint checkers (word count, format, regex)
- [ ] Grammar checker integration
- [ ] Score calculation

### Phase 3: UI
- [ ] Round 2 page component
- [ ] Question display with textarea
- [ ] Timer component
- [ ] Progressive unlock logic
- [ ] Results display

### Phase 4: Integration
- [ ] Connect to dashboard
- [ ] Add to routing
- [ ] Test end-to-end flow

## Next Steps

1. **Seed Questions**: Create `042_round2_seed_questions.sql` with all 16 questions structured as JSONB
2. **Evaluation Engine**: Build `src/lib/round2-evaluator.ts` with deterministic checks
3. **UI**: Create Round 2 page following existing quiz pattern but with textarea input
4. **Testing**: Verify scoring formula matches expected results

## Notes
- Keep evaluation 100% deterministic - no live LLM judgment
- Only use LLM to execute team's prompt against hidden test cases
- Match existing code style (src/lib/engines pattern)
- Reuse quiz UI patterns where possible
- Store all evaluation details in JSONB for transparency
