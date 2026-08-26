# Round 2: Prompt Heist - Complete Specification

## Overview
**Duration:** 40 minutes total  
**Format:** 4 sub-rounds × 10 minutes each  
**Total Score:** 600 points  
**Core Skill:** Prompt Engineering

---

## Sub-Round Structure

### 1. Prompt Precision (10 min, 100 points)
**Challenge Type:** Ambiguity → Clarity  
**Scenario:** Participant receives a vague, messy requirement  
**Task:** Create a precise, unambiguous prompt that produces the desired output

**Example:**
```
VAGUE REQUIREMENT:
"Write something about our company for social media"

PARTICIPANT MUST CREATE A PROMPT THAT:
- Specifies tone (professional, casual, inspiring?)
- Defines length (tweet, post, article?)
- Clarifies purpose (recruitment, product launch, announcement?)
- Sets format (with hashtags? emojis? call-to-action?)
```

**Evaluation Criteria:**
- Clarity of instructions (30%)
- Context provision (20%)
- Output specification (25%)
- Constraint definition (15%)
- Prompt efficiency (10%)

**UI Flow:**
```
1. Show vague scenario
2. Text area for prompt writing
3. "Test Prompt" button → runs through BYOK AI
4. Shows AI output + evaluation scores
5. 3 attempts allowed
6. Submit final prompt
```

---

### 2. Constraint Mastery (10 min, 150 points)
**Challenge Type:** Constraint Puzzle  
**Scenario:** Must satisfy 6-8 simultaneous constraints  
**Task:** Write a single prompt that makes the AI produce output meeting ALL constraints

**Example Constraints:**
```
CREATE A PROMPT THAT GENERATES:
✓ Tone: Professional yet friendly
✓ Length: Exactly 150-200 words
✓ Must include: "innovation", "sustainability", "community"
✓ Cannot use: "world-class", "cutting-edge", "revolutionary"
✓ Format: 3 paragraphs
✓ First sentence must be a question
✓ Must end with a call-to-action
✓ Target audience: Technical professionals
```

**Evaluation Criteria:**
- Tone compliance (15 pts)
- Length accuracy (15 pts)
- Required content inclusion (30 pts)
- Prohibited style avoidance (20 pts)
- Output structure (10 pts)
- Prompt efficiency (10 pts)

**Scoring Logic:**
- Each constraint = pass/fail
- Partial credit for "close enough" (e.g., 195 words when 150-200 required)
- Penalty for overly long prompts (efficiency matters)

**UI Flow:**
```
1. Display all constraints clearly (checklist format)
2. Prompt writing area
3. Live constraint checker (if possible)
4. "Evaluate" → runs AI + checks constraints
5. Visual feedback: ✓ for met, ✗ for failed
6. 3 attempts with different prompts
7. Submit best attempt
```

---

### 3. Context Engineering (10 min, 150 points)
**Challenge Type:** Signal from Noise  
**Scenario:** Large, noisy information dump (10-15 paragraphs)  
**Task:** Design a prompt that makes AI extract ONLY relevant info and ignore distractions

**Example:**
```
CONTEXT PROVIDED:
[Long document about company history, financials, products, 
employee bios, office locations, random trivia, irrelevant details]

TASK:
"Extract and summarize the company's Q4 product launches in 50 words"

PARTICIPANT MUST WRITE A PROMPT THAT:
- Ignores 80% of the noise
- Finds the 3-4 relevant sentences
- Produces accurate summary
- Doesn't hallucinate details not in context
```

**Evaluation Criteria:**
- Information accuracy (40%)
- Noise filtering (25%)
- Hallucination prevention (20%)
- Output format adherence (15%)

**Tricky Elements:**
- Context contains contradictory information
- Context has similar-sounding but irrelevant details
- Tests whether participant uses "ignore X" vs "focus on Y" strategies

**UI Flow:**
```
1. Show large context document (scrollable)
2. Show extraction task
3. Prompt writing area
4. "Run Extraction" → AI processes
5. Side-by-side: AI output vs Expected output
6. Highlight matching/missing elements
7. 3 attempts
```

---

### 4. Prompt Debugging (10 min, 200 points)
**Challenge Type:** Forensic Analysis  
**Scenario:** Given a BROKEN prompt + several BAD AI outputs  
**Task:** Diagnose the failure and rewrite the prompt to fix it

**Example:**
```
BROKEN PROMPT:
"Write a professional email to the client about the delay"

BAD OUTPUTS GENERATED:
Output 1: Too casual ("Hey! So... we're running late lol")
Output 2: Too vague (doesn't mention what's delayed)
Output 3: No solution offered
Output 4: Wrong tone (sounds defensive)

PARTICIPANT MUST:
1. Identify ALL failure modes
2. Rewrite prompt to fix them
3. Test that new prompt works
```

**Failure Categories:**
- Tone mismatch
- Missing context
- Ambiguous instructions
- No output format specified
- Conflicting requirements
- Instruction hierarchy unclear

**Evaluation Criteria:**
- Correct diagnosis (30%)
- Prompt fixes applied (40%)
- Output quality (20%)
- Edge case handling (10%)

**UI Flow:**
```
1. Show broken prompt
2. Show 3-4 bad outputs it produced
3. Checklist: "What's wrong?" (optional hint)
4. Rewrite area
5. "Test Fix" → runs new prompt
6. Compare: old output vs new output
7. 2 attempts for rewrite
```

---

## Technical Architecture

### Database Schema

```sql
-- Prompt challenges table
CREATE TABLE prompt_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds(id),
  sub_round_number INT NOT NULL, -- 1-4
  challenge_type TEXT NOT NULL, -- 'precision', 'constraint', 'context', 'debugging'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scenario_data JSONB NOT NULL, -- challenge-specific data
  evaluation_criteria JSONB NOT NULL,
  max_points INT NOT NULL,
  time_limit_seconds INT NOT NULL DEFAULT 600,
  max_attempts INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario data examples:
-- For Precision:
{
  "vague_requirement": "Write something about our company",
  "expected_elements": ["tone", "length", "format", "audience"],
  "sample_good_output": "..."
}

-- For Constraint:
{
  "constraints": [
    {"type": "tone", "requirement": "professional yet friendly", "weight": 15},
    {"type": "length", "min": 150, "max": 200, "weight": 15},
    {"type": "must_include", "keywords": ["innovation"], "weight": 30},
    {"type": "must_avoid", "keywords": ["world-class"], "weight": 20},
    {"type": "structure", "requirement": "3 paragraphs", "weight": 10},
    {"type": "efficiency", "max_prompt_length": 300, "weight": 10}
  ]
}

-- For Context:
{
  "noisy_context": "Long document text...",
  "task": "Extract Q4 product launches",
  "relevant_sentences": ["sentence 4", "sentence 12", "sentence 23"],
  "irrelevant_keywords": ["office", "employee", "history"],
  "expected_output": "Summary text..."
}

-- For Debugging:
{
  "broken_prompt": "Write a professional email",
  "bad_outputs": [
    {"output": "Hey! Running late lol", "issue": "tone_too_casual"},
    {"output": "We apologize for delays", "issue": "too_vague"}
  ],
  "failure_modes": ["missing_context", "tone_not_specified", "no_format"],
  "sample_fixed_prompt": "..."
}

-- Prompt submissions table
CREATE TABLE prompt_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id),
  round_session_id UUID REFERENCES round_sessions(id),
  challenge_id UUID REFERENCES prompt_challenges(id),
  attempt_number INT NOT NULL, -- 1, 2, or 3
  prompt_text TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- AI evaluation results
  ai_output TEXT,
  evaluation_scores JSONB, -- breakdown by criteria
  total_score DECIMAL(5,2),
  
  -- Metadata
  prompt_length INT,
  execution_time_ms INT,
  is_final_submission BOOLEAN DEFAULT FALSE
);

-- Session tracking
CREATE TABLE prompt_round_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id),
  round_id UUID REFERENCES rounds(id),
  current_sub_round INT DEFAULT 1, -- 1-4
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Sub-round scores
  sub_round_1_score INT DEFAULT 0,
  sub_round_2_score INT DEFAULT 0,
  sub_round_3_score INT DEFAULT 0,
  sub_round_4_score INT DEFAULT 0,
  
  total_score INT DEFAULT 0,
  status TEXT DEFAULT 'IN_PROGRESS' -- IN_PROGRESS, COMPLETED
);
```

---

## Frontend Components

### 1. PromptChallengeLayout.tsx
```typescript
interface PromptChallengeProps {
  challenge: PromptChallenge;
  subRound: 1 | 2 | 3 | 4;
  timeRemaining: number;
  onSubmit: (prompt: string) => void;
}

// Layout:
// - Top: Timer + Score + Sub-round indicator
// - Left: Challenge brief (scenario, constraints, context)
// - Right: Prompt editor + Test button + Results panel
// - Bottom: Attempt counter + Submit button
```

### 2. PromptEditor.tsx
```typescript
// Features:
// - Syntax highlighting (optional)
// - Character/word counter
// - Efficiency indicator (green/yellow/red based on length)
// - Live constraint checker (for Sub-round 2)
```

### 3. EvaluationPanel.tsx
```typescript
// Shows after "Test Prompt" clicked:
// - AI Output display
// - Criteria breakdown with scores
// - Visual indicators (checkmarks, X marks)
// - Suggestions for improvement (optional)
```

### 4. Sub-round specific components:
- `PrecisionChallenge.tsx`
- `ConstraintChallenge.tsx`
- `ContextChallenge.tsx`
- `DebuggingChallenge.tsx`

---

## Evaluation Engine

### Option A: BYOK (Recommended)
```typescript
async function evaluatePrompt(
  prompt: string, 
  challenge: PromptChallenge,
  teamApiKey: string
) {
  // 1. Run participant's prompt through their AI
  const aiOutput = await callAI({
    provider: 'openai', // or anthropic
    model: 'gpt-4o-mini',
    apiKey: teamApiKey,
    prompt: prompt,
    systemPrompt: challenge.scenario_data.system_context
  });
  
  // 2. Evaluate based on challenge type
  switch(challenge.challenge_type) {
    case 'precision':
      return evaluatePrecision(aiOutput, challenge);
    case 'constraint':
      return evaluateConstraints(aiOutput, challenge);
    case 'context':
      return evaluateContextExtraction(aiOutput, challenge);
    case 'debugging':
      return evaluateDebugging(aiOutput, challenge);
  }
}
```

### Constraint Evaluator Example:
```typescript
function evaluateConstraints(output: string, challenge: PromptChallenge) {
  const constraints = challenge.scenario_data.constraints;
  const scores = {};
  
  constraints.forEach(constraint => {
    switch(constraint.type) {
      case 'length':
        const wordCount = output.split(' ').length;
        const withinRange = wordCount >= constraint.min && wordCount <= constraint.max;
        scores[constraint.type] = withinRange ? constraint.weight : 0;
        break;
        
      case 'tone':
        // Use AI to evaluate tone
        scores[constraint.type] = evaluateTone(output, constraint.requirement);
        break;
        
      case 'must_include':
        const hasAllKeywords = constraint.keywords.every(kw => 
          output.toLowerCase().includes(kw.toLowerCase())
        );
        scores[constraint.type] = hasAllKeywords ? constraint.weight : 0;
        break;
        
      case 'must_avoid':
        const hasProhibited = constraint.keywords.some(kw => 
          output.toLowerCase().includes(kw.toLowerCase())
        );
        scores[constraint.type] = hasProhibited ? 0 : constraint.weight;
        break;
        
      // ... other constraint types
    }
  });
  
  return {
    scores,
    totalScore: Object.values(scores).reduce((a, b) => a + b, 0),
    breakdown: scores
  };
}
```

---

## User Flow

### Overall Round Flow:
```
1. Land on Round 2 page
   ↓
2. See brief intro + rules
   ↓
3. Click "Start Sub-round 1"
   ↓
4. [10 minutes timer starts]
   ↓
5. Read scenario → Write prompt → Test → Revise
   ↓
6. Submit final (or auto-submit at 10:00)
   ↓
7. See score breakdown
   ↓
8. Proceed to Sub-round 2
   ↓
9. Repeat for Sub-rounds 3 & 4
   ↓
10. Final score screen + leaderboard
```

### Per Sub-round Flow:
```
[Challenge Screen]
├─ Scenario Panel (left)
│  ├─ Challenge description
│  ├─ Constraints/Context/Requirements
│  └─ Example (if applicable)
│
├─ Editor Panel (right)
│  ├─ Prompt text area
│  ├─ Character counter
│  └─ "Test Prompt" button
│
├─ Results Panel (right, appears after test)
│  ├─ AI Output preview
│  ├─ Score breakdown
│  └─ Criteria checklist (✓/✗)
│
└─ Control Bar (bottom)
   ├─ Attempt: 1/3
   ├─ Time: 8:23
   └─ [Submit Final] button
```

---

## ✅ EVALUATION MODE DECISION: ZERO-COST HYBRID

### For 600 Teams with ZERO Budget

**Competition Mode: 100% Simulated (FREE)**
- No API calls
- Deterministic scoring
- Instant results
- Fair for everyone

**Changed Challenge Format:**
Participants submit TWO things:
1. **The Prompt** (their prompt engineering)
2. **Expected Output** (what they think AI would produce)

System evaluates the OUTPUT against constraints, not by calling real AI.

### Why This Works:

**Sub-round 1 (Precision):** Check if prompt has required elements ✅  
**Sub-round 2 (Constraints):** Check if output meets all rules ✅✅✅ (PERFECT)  
**Sub-round 3 (Context):** Compare output to expected answer ✅  
**Sub-round 4 (Debugging):** Check if fixed prompt addresses issues ✅  

### Cost Analysis:
- **Your API costs:** $0.00 ✅
- **Team API costs:** $0.00 ✅
- **Latency:** < 100ms per evaluation ✅
- **Scalability:** 10,000+ teams no problem ✅

### Scoring Philosophy
**Partial Credit System:**
- Each constraint/criterion = weighted score
- Accumulate points for each met requirement
- Deductions for violations (hallucinations, prohibited words, etc.)
- Final score = sum of all criteria scores

### Anti-Cheating
- Plagiarism detection: Compare prompt similarity between teams (Levenshtein distance)
- Output validation: Check if output is copy-pasted from web
- Timing analysis: Flag suspiciously fast submissions
- No external AI calls needed = no way to game the system

---

## Implementation Roadmap

### Phase 1: Database + Schema
- [x] Core tables (prompt_challenges, prompt_submissions)
- [ ] Seed sample challenges for all 4 sub-rounds
- [ ] RLS policies

### Phase 2: Frontend Components
- [ ] PromptChallengeLayout
- [ ] PromptEditor with live feedback
- [ ] EvaluationPanel
- [ ] 4 sub-round specific UIs

### Phase 3: Evaluation Engine
- [ ] BYOK integration (reuse existing system)
- [ ] Constraint checker
- [ ] Context evaluator
- [ ] Debugging scorer

### Phase 4: Testing & Refinement
- [ ] Test with real prompts
- [ ] Tune scoring weights
- [ ] Add helpful error messages
- [ ] Optimize UX for 10-minute time limit

---

## Sample Challenges (To Be Created)

### Sub-round 1: Prompt Precision
- Challenge 1.1: "Make this vague tweet request specific"
- Challenge 1.2: "Turn this meeting note into a structured prompt"

### Sub-round 2: Constraint Mastery
- Challenge 2.1: "Email with 8 constraints"
- Challenge 2.2: "Social post with conflicting tone requirements"

### Sub-round 3: Context Engineering
- Challenge 3.1: "Extract product features from messy doc"
- Challenge 3.2: "Find the real issue in customer complaints"

### Sub-round 4: Prompt Debugging
- Challenge 4.1: "Fix this broken customer service prompt"
- Challenge 4.2: "Debug this technical documentation generator"

---

## Next Steps
1. Get approval on BYOK vs Simulated approach
2. Create sample challenges with real scenarios
3. Build database schema
4. Develop first sub-round UI as prototype
5. Test evaluation logic with real AI

