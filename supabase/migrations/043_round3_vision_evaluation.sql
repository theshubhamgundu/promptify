-- =====================================================
-- Round 3: Vision Challenge - Auto-Evaluation System
-- =====================================================
-- Stores text-only submissions (no image storage!)
-- Uses AI-as-Judge for automatic evaluation

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
  
  -- Evaluation results (JSONB, ~1.5KB)
  evaluation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   accuracy_score: 0-40,
  --   accuracy_reasoning: string,
  --   completeness_score: 0-30,
  --   completeness_reasoning: string,
  --   prompt_quality_score: 0-20,
  --   prompt_quality_reasoning: string,
  --   specificity_score: 0-10,
  --   specificity_reasoning: string,
  --   total_score: 0-100,
  --   overall_feedback: string
  -- }
  
  -- Metadata
  total_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER,
  attempt_number INTEGER DEFAULT 1 CHECK (attempt_number BETWEEN 1 AND 3),
  evaluation_status TEXT DEFAULT 'PENDING' CHECK (evaluation_status IN ('PENDING', 'EVALUATING', 'COMPLETED', 'FAILED')),
  
  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT now(),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_team_challenge_attempt UNIQUE(team_id, challenge_id, attempt_number)
);

-- Indexes for performance
CREATE INDEX idx_vision_team_challenge ON vision_submissions(team_id, challenge_id);
CREATE INDEX idx_vision_score ON vision_submissions(total_score DESC);
CREATE INDEX idx_vision_status ON vision_submissions(evaluation_status) WHERE evaluation_status = 'PENDING';
CREATE INDEX idx_vision_submitted_at ON vision_submissions(submitted_at DESC);

-- RLS Policies
ALTER TABLE vision_submissions ENABLE ROW LEVEL SECURITY;

-- Teams can view their own submissions
CREATE POLICY "Teams can view own vision submissions"
  ON vision_submissions FOR SELECT
  TO authenticated
  USING (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

-- Teams can insert their own submissions
CREATE POLICY "Teams can insert own vision submissions"
  ON vision_submissions FOR INSERT
  TO authenticated
  WITH CHECK (team_id = (SELECT id FROM teams WHERE id = auth.uid()::uuid));

-- Admins can view all submissions
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

-- Comments
COMMENT ON TABLE vision_submissions IS 'Stores vision challenge submissions with text-only data (no image files stored)';
COMMENT ON COLUMN vision_submissions.reference_image_url IS 'URL of image provided by admin (not uploaded by participant)';
COMMENT ON COLUMN vision_submissions.evaluation_result IS 'AI-as-Judge evaluation results in JSON format';
COMMENT ON COLUMN vision_submissions.evaluation_status IS 'Status of automatic evaluation process';
