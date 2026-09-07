-- =====================================================
-- ROUND 2: PROMPT HEIST DATABASE SCHEMA
-- Zero-cost simulated evaluation system
-- =====================================================

-- Prompt challenges configuration
CREATE TABLE IF NOT EXISTS prompt_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  sub_round_number INT NOT NULL CHECK (sub_round_number BETWEEN 1 AND 4),
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('precision', 'constraint', 'context', 'debugging')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scenario_data JSONB NOT NULL DEFAULT '{}',
  evaluation_criteria JSONB NOT NULL DEFAULT '[]',
  max_points INT NOT NULL DEFAULT 100,
  time_limit_seconds INT NOT NULL DEFAULT 600,
  max_attempts INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prompt_challenges_round ON prompt_challenges(round_id);
CREATE INDEX idx_prompt_challenges_sub_round ON prompt_challenges(round_id, sub_round_number);

-- Prompt submissions from teams
CREATE TABLE IF NOT EXISTS prompt_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES prompt_challenges(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  
  -- User input
  prompt_text TEXT NOT NULL,
  expected_output TEXT, -- For constraint/context challenges
  
  -- Evaluation results
  evaluation_scores JSONB DEFAULT '{}',
  total_score DECIMAL(6,2) DEFAULT 0,
  max_score INT DEFAULT 100,
  passed BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  prompt_length INT,
  output_length INT,
  evaluation_feedback JSONB DEFAULT '[]',
  is_final_submission BOOLEAN DEFAULT FALSE,
  
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(team_id, challenge_id, attempt_number)
);

CREATE INDEX idx_prompt_submissions_team ON prompt_submissions(team_id);
CREATE INDEX idx_prompt_submissions_session ON prompt_submissions(round_session_id);
CREATE INDEX idx_prompt_submissions_challenge ON prompt_submissions(challenge_id);

-- Prompt round session tracking
CREATE TABLE IF NOT EXISTS prompt_round_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
  
  -- Progress tracking
  current_sub_round INT DEFAULT 1 CHECK (current_sub_round BETWEEN 1 AND 4),
  sub_round_1_challenge_id UUID REFERENCES prompt_challenges(id),
  sub_round_2_challenge_id UUID REFERENCES prompt_challenges(id),
  sub_round_3_challenge_id UUID REFERENCES prompt_challenges(id),
  sub_round_4_challenge_id UUID REFERENCES prompt_challenges(id),
  
  -- Scores
  sub_round_1_score DECIMAL(6,2) DEFAULT 0,
  sub_round_2_score DECIMAL(6,2) DEFAULT 0,
  sub_round_3_score DECIMAL(6,2) DEFAULT 0,
  sub_round_4_score DECIMAL(6,2) DEFAULT 0,
  total_score DECIMAL(6,2) DEFAULT 0,
  
  -- Status
  sub_round_1_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_1_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  sub_round_2_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_2_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  sub_round_3_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_3_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  sub_round_4_status TEXT DEFAULT 'NOT_STARTED' CHECK (sub_round_4_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  sub_round_1_started_at TIMESTAMPTZ,
  sub_round_2_started_at TIMESTAMPTZ,
  sub_round_3_started_at TIMESTAMPTZ,
  sub_round_4_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  UNIQUE(team_id, round_id)
);

CREATE INDEX idx_prompt_round_sessions_team ON prompt_round_sessions(team_id);
CREATE INDEX idx_prompt_round_sessions_round ON prompt_round_sessions(round_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Start or get prompt round session
CREATE OR REPLACE FUNCTION start_prompt_round_session(
  p_team_id UUID,
  p_round_id UUID,
  p_round_session_id UUID
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Check if session exists
  SELECT id INTO v_session_id
  FROM prompt_round_sessions
  WHERE team_id = p_team_id AND round_id = p_round_id;
  
  IF v_session_id IS NULL THEN
    -- Create new session
    INSERT INTO prompt_round_sessions (
      team_id,
      round_id,
      round_session_id,
      current_sub_round,
      started_at
    ) VALUES (
      p_team_id,
      p_round_id,
      p_round_session_id,
      1,
      NOW()
    ) RETURNING id INTO v_session_id;
  END IF;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit prompt attempt
CREATE OR REPLACE FUNCTION submit_prompt_attempt(
  p_team_id UUID,
  p_challenge_id UUID,
  p_round_session_id UUID,
  p_attempt_number INT,
  p_prompt_text TEXT,
  p_expected_output TEXT,
  p_evaluation_scores JSONB,
  p_total_score DECIMAL,
  p_max_score INT,
  p_passed BOOLEAN,
  p_feedback JSONB,
  p_is_final BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_submission_id UUID;
  v_prompt_length INT;
  v_output_length INT;
BEGIN
  v_prompt_length := LENGTH(p_prompt_text);
  v_output_length := LENGTH(COALESCE(p_expected_output, ''));
  
  -- Insert or update submission
  INSERT INTO prompt_submissions (
    team_id,
    round_session_id,
    challenge_id,
    attempt_number,
    prompt_text,
    expected_output,
    evaluation_scores,
    total_score,
    max_score,
    passed,
    prompt_length,
    output_length,
    evaluation_feedback,
    is_final_submission,
    submitted_at
  ) VALUES (
    p_team_id,
    p_round_session_id,
    p_challenge_id,
    p_attempt_number,
    p_prompt_text,
    p_expected_output,
    p_evaluation_scores,
    p_total_score,
    p_max_score,
    p_passed,
    v_prompt_length,
    v_output_length,
    p_feedback,
    p_is_final,
    NOW()
  )
  ON CONFLICT (team_id, challenge_id, attempt_number)
  DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    expected_output = EXCLUDED.expected_output,
    evaluation_scores = EXCLUDED.evaluation_scores,
    total_score = EXCLUDED.total_score,
    max_score = EXCLUDED.max_score,
    passed = EXCLUDED.passed,
    prompt_length = EXCLUDED.prompt_length,
    output_length = EXCLUDED.output_length,
    evaluation_feedback = EXCLUDED.evaluation_feedback,
    is_final_submission = EXCLUDED.is_final_submission,
    submitted_at = NOW()
  RETURNING id INTO v_submission_id;
  
  RETURN v_submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete sub-round
CREATE OR REPLACE FUNCTION complete_sub_round(
  p_team_id UUID,
  p_round_id UUID,
  p_sub_round_number INT,
  p_score DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_column_name TEXT;
  v_status_column TEXT;
  v_time_column TEXT;
BEGIN
  v_column_name := 'sub_round_' || p_sub_round_number || '_score';
  v_status_column := 'sub_round_' || p_sub_round_number || '_status';
  v_time_column := 'sub_round_' || p_sub_round_number || '_started_at';
  
  -- Update session
  EXECUTE format('
    UPDATE prompt_round_sessions
    SET %I = $1,
        %I = ''COMPLETED'',
        total_score = sub_round_1_score + sub_round_2_score + sub_round_3_score + sub_round_4_score,
        current_sub_round = LEAST(4, $2 + 1)
    WHERE team_id = $3 AND round_id = $4
  ', v_column_name, v_status_column)
  USING p_score, p_sub_round_number, p_team_id, p_round_id;
  
  -- Check if all sub-rounds completed
  UPDATE prompt_round_sessions
  SET completed_at = NOW()
  WHERE team_id = p_team_id 
    AND round_id = p_round_id
    AND sub_round_1_status = 'COMPLETED'
    AND sub_round_2_status = 'COMPLETED'
    AND sub_round_3_status = 'COMPLETED'
    AND sub_round_4_status = 'COMPLETED'
    AND completed_at IS NULL;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get best submission for challenge
CREATE OR REPLACE FUNCTION get_best_submission(
  p_team_id UUID,
  p_challenge_id UUID
) RETURNS TABLE (
  submission_id UUID,
  attempt_number INT,
  prompt_text TEXT,
  expected_output TEXT,
  total_score DECIMAL,
  max_score INT,
  passed BOOLEAN,
  evaluation_scores JSONB,
  evaluation_feedback JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    ps.attempt_number,
    ps.prompt_text,
    ps.expected_output,
    ps.total_score,
    ps.max_score,
    ps.passed,
    ps.evaluation_scores,
    ps.evaluation_feedback
  FROM prompt_submissions ps
  WHERE ps.team_id = p_team_id
    AND ps.challenge_id = p_challenge_id
  ORDER BY ps.total_score DESC, ps.attempt_number ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE prompt_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_round_sessions ENABLE ROW LEVEL SECURITY;

-- Challenges: Read only for all authenticated users
CREATE POLICY prompt_challenges_select ON prompt_challenges
  FOR SELECT TO authenticated
  USING (true);

-- Submissions: Teams can only see their own
CREATE POLICY prompt_submissions_select ON prompt_submissions
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY prompt_submissions_insert ON prompt_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY prompt_submissions_update ON prompt_submissions
  FOR UPDATE TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- Round sessions: Teams can only see their own
CREATE POLICY prompt_round_sessions_select ON prompt_round_sessions
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY prompt_round_sessions_insert ON prompt_round_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY prompt_round_sessions_update ON prompt_round_sessions
  FOR UPDATE TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- SAMPLE DATA - SUB-ROUND 1: PROMPT PRECISION
-- =====================================================

-- This will be populated via separate seed script
-- Sample challenge structure stored here for reference

COMMENT ON TABLE prompt_challenges IS 'Stores prompt engineering challenges for Round 2: Prompt Heist';
COMMENT ON TABLE prompt_submissions IS 'Tracks all team attempts at prompt challenges with evaluation results';
COMMENT ON TABLE prompt_round_sessions IS 'Manages progression through 4 sub-rounds of Prompt Heist';
