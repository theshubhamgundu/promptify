-- =====================================================
-- Round 3: Vision Challenge - Deterministic Evaluation System
-- =====================================================
-- Stores text-only submissions (no image storage!)
-- Uses weighted pattern matching for instant evaluation

-- Round 3 sessions table (tracks overall round progress)
CREATE TABLE IF NOT EXISTS round3_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'TIMEOUT')),
  
  total_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  tier1_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  tier2_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  tier3_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  
  questions_completed TEXT[] DEFAULT '{}', -- Array of question IDs
  time_remaining_seconds INTEGER DEFAULT 2400, -- 40 minutes = 2400 seconds
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_team_round3_session UNIQUE(team_id, round_id)
);

-- Vision submissions table (lightweight - text only)
CREATE TABLE IF NOT EXISTS vision_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  round_session_id UUID NOT NULL REFERENCES round_sessions(id) ON DELETE CASCADE,
  
  -- Input data (text only, ~300 bytes)
  participant_prompt TEXT NOT NULL,
  reference_image_url TEXT NOT NULL, -- URL provided by admin, not uploaded
  
  -- AI Output (text only, ~2KB max)
  ai_response_text TEXT NOT NULL,
  
  -- Evaluation results (JSONB, ~1KB)
  evaluation_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   matchedPatterns: [{ pattern: string, label: string, weight: number, matched: boolean }],
  --   feedback: string[],
  --   timeTakenSeconds: number
  -- }
  
  -- Metadata
  total_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  max_score DECIMAL(5,2) NOT NULL DEFAULT 10, -- 10, 15, or 20 based on tier
  passed BOOLEAN DEFAULT false,
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 3),
  evaluation_status TEXT DEFAULT 'COMPLETED' CHECK (evaluation_status IN ('PENDING', 'EVALUATING', 'COMPLETED', 'FAILED')),
  
  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT now(),
  evaluated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_team_challenge_attempt UNIQUE(team_id, challenge_id, attempt_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_round3_sessions_team ON round3_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_round3_sessions_status ON round3_sessions(status) WHERE status = 'IN_PROGRESS';

CREATE INDEX IF NOT EXISTS idx_vision_team_challenge ON vision_submissions(team_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_vision_score ON vision_submissions(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_vision_status ON vision_submissions(evaluation_status) WHERE evaluation_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_vision_submitted_at ON vision_submissions(submitted_at DESC);

-- RLS Policies for round3_sessions
ALTER TABLE round3_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams can view own round3 sessions" ON round3_sessions;
CREATE POLICY "Teams can view own round3 sessions"
  ON round3_sessions FOR SELECT
  TO authenticated
  USING (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

DROP POLICY IF EXISTS "Teams can insert own round3 sessions" ON round3_sessions;
CREATE POLICY "Teams can insert own round3 sessions"
  ON round3_sessions FOR INSERT
  TO authenticated
  WITH CHECK (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

DROP POLICY IF EXISTS "Teams can update own round3 sessions" ON round3_sessions;
CREATE POLICY "Teams can update own round3 sessions"
  ON round3_sessions FOR UPDATE
  TO authenticated
  USING (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

DROP POLICY IF EXISTS "Admins can view all round3 sessions" ON round3_sessions;
CREATE POLICY "Admins can view all round3 sessions"
  ON round3_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- RLS Policies for vision_submissions
ALTER TABLE vision_submissions ENABLE ROW LEVEL SECURITY;

-- Teams can view their own submissions
DROP POLICY IF EXISTS "Teams can view own vision submissions" ON vision_submissions;
CREATE POLICY "Teams can view own vision submissions"
  ON vision_submissions FOR SELECT
  TO authenticated
  USING (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

-- Teams can insert their own submissions
DROP POLICY IF EXISTS "Teams can insert own vision submissions" ON vision_submissions;
CREATE POLICY "Teams can insert own vision submissions"
  ON vision_submissions FOR INSERT
  TO authenticated
  WITH CHECK (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

-- Admins can view all submissions
DROP POLICY IF EXISTS "Admins can view all vision submissions" ON vision_submissions;
CREATE POLICY "Admins can view all vision submissions"
  ON vision_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Admins can update evaluation results
DROP POLICY IF EXISTS "Admins can update vision evaluations" ON vision_submissions;
CREATE POLICY "Admins can update vision evaluations"
  ON vision_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Function to get team's best score for a challenge
CREATE OR REPLACE FUNCTION get_vision_best_score(
  p_team_id UUID,
  p_challenge_id UUID
)
RETURNS DECIMAL(5,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_best_score DECIMAL(5,2);
BEGIN
  SELECT COALESCE(MAX(total_score), 0)
  INTO v_best_score
  FROM vision_submissions
  WHERE team_id = p_team_id
    AND challenge_id = p_challenge_id
    AND evaluation_status = 'COMPLETED';
    
  RETURN v_best_score;
END;
$$;

-- Function to get team's remaining attempts
CREATE OR REPLACE FUNCTION get_vision_remaining_attempts(
  p_team_id UUID,
  p_challenge_id UUID,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_used_attempts INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_used_attempts
  FROM vision_submissions
  WHERE team_id = p_team_id
    AND challenge_id = p_challenge_id;
    
  RETURN GREATEST(0, p_max_attempts - v_used_attempts);
END;
$$;

-- Function to complete a Round 3 question and update scores
CREATE OR REPLACE FUNCTION complete_round3_question(
  p_session_id UUID,
  p_question_id TEXT,
  p_tier TEXT,
  p_score DECIMAL(5,2)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add question to completed list if not already there
  UPDATE round3_sessions
  SET 
    questions_completed = array_append(
      COALESCE(questions_completed, '{}'),
      p_question_id
    ),
    tier1_score = CASE 
      WHEN p_tier = 'TIER1' THEN tier1_score + p_score 
      ELSE tier1_score 
    END,
    tier2_score = CASE 
      WHEN p_tier = 'TIER2' THEN tier2_score + p_score 
      ELSE tier2_score 
    END,
    tier3_score = CASE 
      WHEN p_tier = 'TIER3' THEN tier3_score + p_score 
      ELSE tier3_score 
    END,
    total_score = total_score + p_score,
    updated_at = now()
  WHERE id = p_session_id
    AND NOT (p_question_id = ANY(COALESCE(questions_completed, '{}')));
END;
$$;

-- Comments
COMMENT ON TABLE round3_sessions IS 'Tracks overall Round 3 progress for each team (30 questions, 40 minutes total)';
COMMENT ON COLUMN round3_sessions.questions_completed IS 'Array of completed question IDs (e.g., {T1-Q1, T2-Q3})';
COMMENT ON COLUMN round3_sessions.time_remaining_seconds IS 'Countdown timer for entire round (40 minutes = 2400 seconds)';

COMMENT ON TABLE vision_submissions IS 'Stores vision challenge submissions with text-only data (no image files stored)';
COMMENT ON COLUMN vision_submissions.reference_image_url IS 'URL of image provided by admin (not uploaded by participant)';
COMMENT ON COLUMN vision_submissions.evaluation_details IS 'Weighted pattern matching evaluation results in JSON format';
COMMENT ON COLUMN vision_submissions.evaluation_status IS 'Status of evaluation process (instant deterministic evaluation)';
COMMENT ON COLUMN vision_submissions.max_score IS 'Maximum possible score for this question tier (10=Tier1, 15=Tier2, 20=Tier3)';
