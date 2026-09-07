-- ════════════════════════════════════════════════════════════════
-- Migration 041: Round 2 - Prompt Heist (Deceptive Question Set)
-- 16 questions across 4 challenge types with deterministic evaluation
-- ════════════════════════════════════════════════════════════════

-- 1. Round 2 Questions Table
CREATE TABLE IF NOT EXISTS round2_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_type TEXT NOT NULL CHECK (challenge_type IN ('PRECISION', 'CONSTRAINT', 'CONTEXT', 'DEBUGGING')),
    sub_round INTEGER NOT NULL CHECK (sub_round BETWEEN 1 AND 4),
    question_number INTEGER NOT NULL CHECK (question_number BETWEEN 1 AND 4),
    
    -- Question content
    title TEXT NOT NULL,
    scenario_text TEXT NOT NULL,
    visible_example TEXT,
    broken_prompt TEXT, -- For DEBUGGING type only
    
    -- Hidden test cases (array of test scenarios)
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Constraint rules for deterministic checking
    constraint_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Reference answer (ideal prompt)
    reference_answer TEXT NOT NULL,
    
    -- Scoring weights
    max_score INTEGER NOT NULL DEFAULT 50,
    time_limit_seconds INTEGER NOT NULL DEFAULT 150, -- 2.5 minutes
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(challenge_type, question_number)
);

CREATE INDEX idx_round2_questions_type ON round2_questions(challenge_type);
CREATE INDEX idx_round2_questions_sub_round ON round2_questions(sub_round);

-- 2. Round 2 Submissions Table
CREATE TABLE IF NOT EXISTS round2_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES round2_questions(id) ON DELETE CASCADE,
    
    -- Submission content
    prompt_text TEXT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    
    -- Evaluation results (deterministic)
    hidden_test_pass_rate DECIMAL(5,2) DEFAULT 0, -- 0-100%
    grammar_score DECIMAL(5,2) DEFAULT 0, -- 0-10
    constraint_score DECIMAL(5,2) DEFAULT 0, -- 0-10
    time_bonus DECIMAL(5,2) DEFAULT 0, -- 0-5
    
    total_score DECIMAL(6,2) DEFAULT 0, -- Final score out of 50
    
    -- Detailed breakdown
    evaluation_details JSONB DEFAULT '{}'::jsonb,
    test_results JSONB DEFAULT '[]'::jsonb,
    
    -- Timing
    time_taken_seconds INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(team_id, question_id)
);

CREATE INDEX idx_round2_submissions_team ON round2_submissions(team_id);
CREATE INDEX idx_round2_submissions_session ON round2_submissions(round_session_id);
CREATE INDEX idx_round2_submissions_question ON round2_submissions(question_id);

-- 3. Round 2 Session Tracking
CREATE TABLE IF NOT EXISTS round2_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    
    -- Progress tracking (4 sub-rounds, 4 questions each)
    current_sub_round INTEGER DEFAULT 1 CHECK (current_sub_round BETWEEN 1 AND 4),
    current_question INTEGER DEFAULT 1 CHECK (current_question BETWEEN 1 AND 4),
    
    -- Sub-round scores (out of 200 total, 50 per question, 200 per sub-round)
    sub_round_1_score DECIMAL(6,2) DEFAULT 0,
    sub_round_2_score DECIMAL(6,2) DEFAULT 0,
    sub_round_3_score DECIMAL(6,2) DEFAULT 0,
    sub_round_4_score DECIMAL(6,2) DEFAULT 0,
    total_score DECIMAL(7,2) DEFAULT 0,
    
    -- Status tracking
    sub_round_1_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_1_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
    sub_round_2_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_2_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
    sub_round_3_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_3_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
    sub_round_4_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_4_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT now(),
    sub_round_1_started_at TIMESTAMPTZ,
    sub_round_2_started_at TIMESTAMPTZ,
    sub_round_3_started_at TIMESTAMPTZ,
    sub_round_4_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(team_id, round_id)
);

CREATE INDEX idx_round2_sessions_team ON round2_sessions(team_id);
CREATE INDEX idx_round2_sessions_round ON round2_sessions(round_id);

-- 4. Enable RLS
ALTER TABLE round2_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view round2 questions" ON round2_questions;
CREATE POLICY "Anyone can view round2 questions"
    ON round2_questions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Teams can view own round2 submissions" ON round2_submissions;
CREATE POLICY "Teams can view own round2 submissions"
    ON round2_submissions FOR SELECT
    TO authenticated
    USING (team_id IN (SELECT id FROM teams WHERE id = team_id));

DROP POLICY IF EXISTS "Teams can insert round2 submissions" ON round2_submissions;
CREATE POLICY "Teams can insert round2 submissions"
    ON round2_submissions FOR INSERT
    TO authenticated
    WITH CHECK (team_id IN (SELECT id FROM teams WHERE id = team_id));

DROP POLICY IF EXISTS "Teams can view own round2 session" ON round2_sessions;
CREATE POLICY "Teams can view own round2 session"
    ON round2_sessions FOR SELECT
    TO authenticated
    USING (team_id IN (SELECT id FROM teams WHERE id = team_id));

DROP POLICY IF EXISTS "Teams can insert own round2 session" ON round2_sessions;
CREATE POLICY "Teams can insert own round2 session"
    ON round2_sessions FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Teams can update own round2 session" ON round2_sessions;
CREATE POLICY "Teams can update own round2 session"
    ON round2_sessions FOR UPDATE
    TO authenticated
    USING (team_id IN (SELECT id FROM teams WHERE id = team_id));

-- 5. Trigger for updated_at
CREATE TRIGGER update_round2_questions_updated_at 
BEFORE UPDATE ON round2_questions 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
