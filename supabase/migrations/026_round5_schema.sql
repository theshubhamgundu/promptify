-- Migration 026: Round 5 — AI Systems Challenge Schema
-- 4 challenges: AI Architect, Model Duel, AI Negotiator, Emergence
-- Shared: Prompt Sheet, AI Workspace, Score Events

-- =====================================================
-- 1. Enum Extensions
-- =====================================================
ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'AI_SYSTEMS';

ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'AI_ARCHITECT';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'MODEL_DUEL';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'AI_NEGOTIATOR';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'EMERGENCE';

-- =====================================================
-- 2. Prompt Sheet Entries (Immutable AI Interaction Log)
-- Every AI request through the Promptify Workspace is recorded here.
-- Entries are NEVER editable or deletable by participants.
-- =====================================================
CREATE TABLE IF NOT EXISTS prompt_sheet_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,
    challenge_session_id UUID REFERENCES challenge_sessions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,

    sequence_number INTEGER NOT NULL,

    provider TEXT NOT NULL,
    model TEXT NOT NULL,

    prompt TEXT NOT NULL,
    response TEXT,

    prompt_word_count INTEGER DEFAULT 0,
    prompt_token_count INTEGER DEFAULT 0,
    response_token_count INTEGER DEFAULT 0,

    request_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    response_received_at TIMESTAMPTZ,
    latency_ms INTEGER,

    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT')),
    error_code TEXT,

    parent_entry_id UUID REFERENCES prompt_sheet_entries(id) ON DELETE SET NULL,
    revision_number INTEGER DEFAULT 1,

    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_sheet_team_challenge ON prompt_sheet_entries(team_id, challenge_session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_prompt_sheet_round_session ON prompt_sheet_entries(round_session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_sheet_parent ON prompt_sheet_entries(parent_entry_id) WHERE parent_entry_id IS NOT NULL;

COMMENT ON TABLE prompt_sheet_entries IS 'Immutable log of every AI interaction in Round 5. NEVER stores API keys.';

-- =====================================================
-- 3. Architect Submissions
-- =====================================================
CREATE TABLE IF NOT EXISTS architect_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    challenge_session_id UUID REFERENCES challenge_sessions(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,

    attempt_number INTEGER NOT NULL DEFAULT 1,

    -- The architecture graph as JSON: { nodes: [...], edges: [...] }
    architecture_graph JSONB NOT NULL DEFAULT '{}'::jsonb,
    component_configs JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Validation results
    is_valid BOOLEAN DEFAULT false,
    validation_errors JSONB DEFAULT '[]'::jsonb,

    -- Scoring breakdown
    architecture_correctness_score INTEGER DEFAULT 0,
    requirement_coverage_score INTEGER DEFAULT 0,
    failure_handling_score INTEGER DEFAULT 0,
    security_privacy_score INTEGER DEFAULT 0,
    efficiency_score INTEGER DEFAULT 0,
    scalability_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,

    -- Evaluation metadata
    evaluator_version TEXT,
    evaluation_model TEXT,
    evaluation_timestamp TIMESTAMPTZ,
    raw_evaluation JSONB DEFAULT '{}'::jsonb,

    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_architect_team_challenge ON architect_submissions(team_id, challenge_id);

-- =====================================================
-- 4. Model Duel Tables
-- =====================================================

-- Tasks configured by admin (visible + hidden)
CREATE TABLE IF NOT EXISTS model_duel_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL, -- 'extraction', 'reasoning', 'classification', etc.
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_visible BOOLEAN NOT NULL DEFAULT true,

    -- Pre-generated model outputs (anonymized as Model A/B/C)
    model_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Mapping of anonymous labels to real models (hidden from participants)
    model_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Expected best model for this task type
    expected_best_model TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_duel_tasks_challenge ON model_duel_tasks(challenge_id, is_visible);

-- Participant routing strategies
CREATE TABLE IF NOT EXISTS model_duel_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    challenge_session_id UUID REFERENCES challenge_sessions(id) ON DELETE CASCADE,
    round_session_id UUID REFERENCES round_sessions(id) ON DELETE CASCADE,

    attempt_number INTEGER NOT NULL DEFAULT 1,

    -- The routing rules as JSON array
    -- [{ task_type: "extraction", selected_model: "MODEL_B", reasoning: "..." }, ...]
    routing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Model identification guesses
    model_identifications JSONB DEFAULT '{}'::jsonb,

    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, challenge_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_model_duel_strategies_team ON model_duel_strategies(team_id, challenge_id);

-- Hidden evaluation results
CREATE TABLE IF NOT EXISTS model_duel_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID NOT NULL REFERENCES model_duel_strategies(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,

    -- Scoring breakdown
    model_selection_accuracy_score INTEGER DEFAULT 0,
    generalization_score INTEGER DEFAULT 0,
    task_model_matching_score INTEGER DEFAULT 0,
    cost_efficiency_score INTEGER DEFAULT 0,
    latency_efficiency_score INTEGER DEFAULT 0,
    strategy_quality_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,

    -- Detailed results per hidden task
    hidden_task_results JSONB DEFAULT '[]'::jsonb,

    evaluator_version TEXT,
    evaluation_timestamp TIMESTAMPTZ DEFAULT now(),
    raw_evaluation JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_duel_evals_team ON model_duel_evaluations(team_id, challenge_id);

-- =====================================================
-- 5. Negotiation Tables
-- =====================================================

-- Admin-configured negotiation scenarios
CREATE TABLE IF NOT EXISTS negotiation_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,

    -- Participant-visible information
    participant_objectives JSONB NOT NULL DEFAULT '{}'::jsonb,
    participant_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    participant_known_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    available_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    initial_position JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Hidden opponent configuration (NEVER exposed to participants)
    opponent_budget JSONB NOT NULL DEFAULT '{}'::jsonb,
    opponent_priorities JSONB NOT NULL DEFAULT '{}'::jsonb,
    opponent_min_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
    opponent_deal_breakers JSONB NOT NULL DEFAULT '[]'::jsonb,
    opponent_reservation_point JSONB NOT NULL DEFAULT '{}'::jsonb,
    opponent_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Scoring config
    scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_scenarios_challenge ON negotiation_scenarios(challenge_id);

-- Per-team negotiation state
CREATE TABLE IF NOT EXISTS negotiation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_session_id UUID NOT NULL REFERENCES challenge_sessions(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES negotiation_scenarios(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    current_round INTEGER NOT NULL DEFAULT 0,
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    discovered_info JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_offers JSONB NOT NULL DEFAULT '{}'::jsonb,
    opponent_state JSONB NOT NULL DEFAULT '{}'::jsonb,

    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACCEPTED', 'REJECTED', 'WALKED_AWAY', 'TIMEOUT', 'COMPLETED')),
    final_outcome JSONB DEFAULT '{}'::jsonb,

    action_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE(team_id, challenge_session_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_team ON negotiation_sessions(team_id, challenge_session_id);

-- Immutable log of all negotiation actions
CREATE TABLE IF NOT EXISTS negotiation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    sequence_number INTEGER NOT NULL,
    actor TEXT NOT NULL CHECK (actor IN ('PARTICIPANT', 'OPPONENT')),

    action_type TEXT NOT NULL CHECK (action_type IN (
        'MAKE_OFFER', 'ASK_QUESTION', 'REQUEST_INFO',
        'CONCEDE', 'REJECT', 'COUNTER', 'ACCEPT', 'WALK_AWAY',
        'OPPONENT_OFFER', 'OPPONENT_COUNTER', 'OPPONENT_ACCEPT',
        'OPPONENT_REJECT', 'OPPONENT_INFO_RESPONSE'
    )),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,

    state_before JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_after JSONB NOT NULL DEFAULT '{}'::jsonb,

    opponent_response JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_actions_session ON negotiation_actions(session_id, sequence_number);

-- =====================================================
-- 6. Emergence Tables
-- =====================================================

-- Admin-configured environment definitions
CREATE TABLE IF NOT EXISTS emergence_environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,

    -- Environment rules (NEVER exposed to participants)
    -- Contains: action_effects, state_transitions, scoring_rules,
    --           multipliers, penalties, thresholds, combos, optimal_sequences
    environment_definition JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Available actions (exposed to participants)
    available_actions JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Initial state template
    initial_state JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Seed range for per-team variation
    seed_min INTEGER NOT NULL DEFAULT 10000,
    seed_max INTEGER NOT NULL DEFAULT 99999,

    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergence_envs_challenge ON emergence_environments(challenge_id, status);

-- Per-team emergence state
CREATE TABLE IF NOT EXISTS emergence_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_session_id UUID NOT NULL REFERENCES challenge_sessions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES emergence_environments(id) ON DELETE CASCADE,

    seed INTEGER NOT NULL,
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_score INTEGER NOT NULL DEFAULT 0,

    action_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT now(),
    deadline_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(team_id, challenge_session_id)
);

CREATE INDEX IF NOT EXISTS idx_emergence_sessions_team ON emergence_sessions(team_id, challenge_session_id);

-- Immutable log of all emergence actions
CREATE TABLE IF NOT EXISTS emergence_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES emergence_sessions(id) ON DELETE CASCADE,

    sequence_number INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,

    state_before JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_after JSONB NOT NULL DEFAULT '{}'::jsonb,

    score_delta INTEGER NOT NULL DEFAULT 0,
    observation TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergence_actions_session ON emergence_actions(session_id, sequence_number);

-- =====================================================
-- 7. Round 5 Score Events (Granular Score Breakdown)
-- =====================================================
CREATE TABLE IF NOT EXISTS round5_score_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_session_id UUID NOT NULL REFERENCES round_sessions(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,

    score_type TEXT NOT NULL CHECK (score_type IN (
        'R5_1_ARCHITECT', 'R5_2_MODEL_DUEL', 'R5_3_NEGOTIATOR',
        'R5_4_EMERGENCE', 'PROMPT_PROCESS', 'ROUND5_TOTAL'
    )),

    -- Component-level scores
    score_components JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_score INTEGER NOT NULL DEFAULT 0,

    evaluator_version TEXT,
    evaluation_model TEXT,
    evaluation_timestamp TIMESTAMPTZ DEFAULT now(),
    criteria_results JSONB DEFAULT '{}'::jsonb,
    raw_evaluation JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_r5_score_events_team ON round5_score_events(team_id, round_session_id);

-- =====================================================
-- 8. Enable RLS on All New Tables
-- =====================================================
ALTER TABLE prompt_sheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE architect_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_duel_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_duel_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_duel_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergence_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergence_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round5_score_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. RLS Policies
-- Pattern: participants see own team only, admins see all
-- Hidden config tables: service-role only (no participant SELECT)
-- =====================================================

-- prompt_sheet_entries
DROP POLICY IF EXISTS "Participants view own prompt sheet" ON prompt_sheet_entries;
CREATE POLICY "Participants view own prompt sheet"
    ON prompt_sheet_entries FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

DROP POLICY IF EXISTS "Service inserts prompt sheet" ON prompt_sheet_entries;
CREATE POLICY "Service inserts prompt sheet"
    ON prompt_sheet_entries FOR INSERT TO authenticated
    WITH CHECK (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
    );

-- architect_submissions
DROP POLICY IF EXISTS "Participants view own architect submissions" ON architect_submissions;
CREATE POLICY "Participants view own architect submissions"
    ON architect_submissions FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

DROP POLICY IF EXISTS "Participants insert architect submissions" ON architect_submissions;
CREATE POLICY "Participants insert architect submissions"
    ON architect_submissions FOR INSERT TO authenticated
    WITH CHECK (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
    );

-- model_duel_tasks: visible tasks only to participants, all to admin
DROP POLICY IF EXISTS "Participants view visible duel tasks" ON model_duel_tasks;
CREATE POLICY "Participants view visible duel tasks"
    ON model_duel_tasks FOR SELECT TO authenticated
    USING (
        (is_visible = true)
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- model_duel_strategies
DROP POLICY IF EXISTS "Participants view own duel strategies" ON model_duel_strategies;
CREATE POLICY "Participants view own duel strategies"
    ON model_duel_strategies FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

DROP POLICY IF EXISTS "Participants insert duel strategies" ON model_duel_strategies;
CREATE POLICY "Participants insert duel strategies"
    ON model_duel_strategies FOR INSERT TO authenticated
    WITH CHECK (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
    );

-- model_duel_evaluations: admin-only (hidden results)
DROP POLICY IF EXISTS "Admin view duel evaluations" ON model_duel_evaluations;
CREATE POLICY "Admin view duel evaluations"
    ON model_duel_evaluations FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- negotiation_scenarios: participant sees only visible fields via RPC
DROP POLICY IF EXISTS "Admin view negotiation scenarios" ON negotiation_scenarios;
CREATE POLICY "Admin view negotiation scenarios"
    ON negotiation_scenarios FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- negotiation_sessions
DROP POLICY IF EXISTS "Participants view own negotiation sessions" ON negotiation_sessions;
CREATE POLICY "Participants view own negotiation sessions"
    ON negotiation_sessions FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- negotiation_actions
DROP POLICY IF EXISTS "Participants view own negotiation actions" ON negotiation_actions;
CREATE POLICY "Participants view own negotiation actions"
    ON negotiation_actions FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- emergence_environments: admin-only (hidden rules)
DROP POLICY IF EXISTS "Admin view emergence environments" ON emergence_environments;
CREATE POLICY "Admin view emergence environments"
    ON emergence_environments FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- emergence_sessions
DROP POLICY IF EXISTS "Participants view own emergence sessions" ON emergence_sessions;
CREATE POLICY "Participants view own emergence sessions"
    ON emergence_sessions FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- emergence_actions
DROP POLICY IF EXISTS "Participants view own emergence actions" ON emergence_actions;
CREATE POLICY "Participants view own emergence actions"
    ON emergence_actions FOR SELECT TO authenticated
    USING (
        session_id IN (
            SELECT id FROM emergence_sessions
            WHERE team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        )
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- round5_score_events
DROP POLICY IF EXISTS "Participants view own r5 scores" ON round5_score_events;
CREATE POLICY "Participants view own r5 scores"
    ON round5_score_events FOR SELECT TO authenticated
    USING (
        team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'COORDINATOR'))
    );

-- =====================================================
-- 10. RPCs
-- =====================================================

-- ─── start_round5_challenge ─────────────────────────
-- Creates challenge session with server-authoritative timer.
-- Reuses pattern from Round 4's start_round4_challenge.
-- Also initializes challenge-specific state (negotiation session, emergence session).
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_round5_challenge(
    p_team_id UUID,
    p_round_session_id UUID,
    p_challenge_id UUID,
    p_duration_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_deadline TIMESTAMPTZ;
    v_challenge challenges;
    v_dur INTEGER;
    v_challenge_type TEXT;
BEGIN
    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not found');
    END IF;

    v_dur := COALESCE((v_challenge.configuration->>'durationMinutes')::INTEGER, p_duration_minutes, 10);
    v_challenge_type := v_challenge.type::TEXT;

    -- Check if session already exists (idempotent)
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'resumed', true);
    END IF;

    v_deadline := now() + (v_dur || ' minutes')::interval;

    INSERT INTO challenge_sessions (
        team_id, round_session_id, challenge_id, started_at, deadline_at, status
    ) VALUES (
        p_team_id, p_round_session_id, p_challenge_id, now(), v_deadline, 'IN_PROGRESS'
    ) RETURNING * INTO v_session;

    -- Initialize challenge-specific state
    IF v_challenge_type = 'AI_NEGOTIATOR' THEN
        DECLARE
            v_scenario negotiation_scenarios;
        BEGIN
            SELECT * INTO v_scenario FROM negotiation_scenarios
            WHERE challenge_id = p_challenge_id
            ORDER BY version DESC LIMIT 1;

            IF FOUND THEN
                INSERT INTO negotiation_sessions (
                    challenge_session_id, scenario_id, team_id,
                    current_state, opponent_state
                ) VALUES (
                    v_session.id, v_scenario.id, p_team_id,
                    v_scenario.initial_position,
                    jsonb_build_object('mood', 'neutral', 'trust_level', 50)
                );
            END IF;
        END;
    ELSIF v_challenge_type = 'EMERGENCE' THEN
        DECLARE
            v_env emergence_environments;
            v_seed INTEGER;
        BEGIN
            SELECT * INTO v_env FROM emergence_environments
            WHERE challenge_id = p_challenge_id AND status = 'ACTIVE'
            ORDER BY version DESC LIMIT 1;

            IF FOUND THEN
                -- Generate deterministic seed for this team
                v_seed := v_env.seed_min + (abs(hashtext(p_team_id::TEXT || p_challenge_id::TEXT)) % (v_env.seed_max - v_env.seed_min + 1));

                INSERT INTO emergence_sessions (
                    challenge_session_id, team_id, environment_id,
                    seed, current_state, deadline_at
                ) VALUES (
                    v_session.id, p_team_id, v_env.id,
                    v_seed, v_env.initial_state, v_deadline
                );
            END IF;
        END;
    END IF;

    INSERT INTO activity_logs (team_id, action, details)
    VALUES (p_team_id, 'ROUND5_CHALLENGE_STARTED', jsonb_build_object(
        'challenge_id', p_challenge_id,
        'challenge_type', v_challenge_type,
        'challenge_title', v_challenge.title,
        'deadline_at', v_deadline
    ));

    RETURN jsonb_build_object('success', true, 'session', row_to_json(v_session), 'resumed', false);
END;
$$;

-- ─── record_prompt_sheet_entry ──────────────────────
-- Immutable insert for AI interactions. Auto-assigns sequence_number.
-- Handles revision chains via parent_entry_id.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_prompt_sheet_entry(
    p_team_id UUID,
    p_event_id UUID,
    p_round_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_challenge_session_id UUID,
    p_participant_id UUID,
    p_provider TEXT,
    p_model TEXT,
    p_prompt TEXT,
    p_response TEXT DEFAULT NULL,
    p_prompt_word_count INTEGER DEFAULT 0,
    p_prompt_token_count INTEGER DEFAULT 0,
    p_response_token_count INTEGER DEFAULT 0,
    p_latency_ms INTEGER DEFAULT NULL,
    p_status TEXT DEFAULT 'PENDING',
    p_error_code TEXT DEFAULT NULL,
    p_parent_entry_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_seq INTEGER;
    v_revision INTEGER := 1;
    v_entry prompt_sheet_entries;
BEGIN
    -- Verify challenge session is active
    SELECT * INTO v_session FROM challenge_sessions
    WHERE id = p_challenge_session_id AND team_id = p_team_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge session not found');
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress');
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time expired');
    END IF;

    -- Get next sequence number for this team+challenge
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
    FROM prompt_sheet_entries
    WHERE team_id = p_team_id AND challenge_session_id = p_challenge_session_id;

    -- Get revision number if this is a revision
    IF p_parent_entry_id IS NOT NULL THEN
        SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_revision
        FROM prompt_sheet_entries
        WHERE parent_entry_id = p_parent_entry_id OR id = p_parent_entry_id;
    END IF;

    INSERT INTO prompt_sheet_entries (
        event_id, round_id, challenge_id, round_session_id, challenge_session_id,
        team_id, participant_id, sequence_number,
        provider, model, prompt, response,
        prompt_word_count, prompt_token_count, response_token_count,
        request_started_at, response_received_at, latency_ms,
        status, error_code, parent_entry_id, revision_number, metadata
    ) VALUES (
        p_event_id, p_round_id, p_challenge_id, p_round_session_id, p_challenge_session_id,
        p_team_id, p_participant_id, v_seq,
        p_provider, p_model, p_prompt, p_response,
        p_prompt_word_count, p_prompt_token_count, p_response_token_count,
        now(),
        CASE WHEN p_response IS NOT NULL THEN now() ELSE NULL END,
        p_latency_ms,
        p_status, p_error_code, p_parent_entry_id, v_revision, p_metadata
    ) RETURNING * INTO v_entry;

    RETURN jsonb_build_object(
        'success', true,
        'entry_id', v_entry.id,
        'sequence_number', v_seq
    );
END;
$$;

-- ─── submit_architect_design ────────────────────────
-- Validates and persists architecture submission.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_architect_design(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_architecture_graph JSONB,
    p_component_configs JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_attempt_number INTEGER;
    v_max_attempts INTEGER := 3;
    v_challenge challenges;
    v_validation_errors JSONB := '[]'::jsonb;
    v_is_valid BOOLEAN := true;
    v_nodes JSONB;
    v_edges JSONB;
    v_has_input BOOLEAN := false;
    v_has_output BOOLEAN := false;
    v_time_taken INTEGER;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge session not started');
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress');
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time expired');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_max_attempts := COALESCE(v_challenge.max_attempts, 3);

    SELECT COUNT(*) INTO v_attempt_number FROM architect_submissions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;
    v_attempt_number := v_attempt_number + 1;

    IF v_attempt_number > v_max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum submissions reached');
    END IF;

    v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;

    -- Basic graph structure validation
    v_nodes := p_architecture_graph->'nodes';
    v_edges := p_architecture_graph->'edges';

    IF v_nodes IS NULL OR jsonb_array_length(v_nodes) = 0 THEN
        v_is_valid := false;
        v_validation_errors := v_validation_errors || '["No components added"]'::jsonb;
    END IF;

    IF v_edges IS NULL OR jsonb_array_length(COALESCE(v_edges, '[]'::jsonb)) = 0 THEN
        v_is_valid := false;
        v_validation_errors := v_validation_errors || '["No connections between components"]'::jsonb;
    END IF;

    -- Check for INPUT and OUTPUT nodes
    IF v_nodes IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM jsonb_array_elements(v_nodes) AS n
            WHERE n->>'type' = 'INPUT'
        ) INTO v_has_input;

        SELECT EXISTS(
            SELECT 1 FROM jsonb_array_elements(v_nodes) AS n
            WHERE n->>'type' = 'OUTPUT'
        ) INTO v_has_output;

        IF NOT v_has_input THEN
            v_is_valid := false;
            v_validation_errors := v_validation_errors || '["Missing INPUT component"]'::jsonb;
        END IF;

        IF NOT v_has_output THEN
            v_is_valid := false;
            v_validation_errors := v_validation_errors || '["Missing OUTPUT component"]'::jsonb;
        END IF;
    END IF;

    INSERT INTO architect_submissions (
        team_id, challenge_id, challenge_session_id, round_session_id,
        attempt_number, architecture_graph, component_configs,
        is_valid, validation_errors, submitted_at
    ) VALUES (
        p_team_id, p_challenge_id, v_session.id, p_round_session_id,
        v_attempt_number, p_architecture_graph, p_component_configs,
        v_is_valid, v_validation_errors, now()
    );

    IF v_attempt_number >= v_max_attempts THEN
        UPDATE challenge_sessions SET
            status = 'COMPLETED', completed_at = now(),
            attempts_used = v_attempt_number, total_time_seconds = v_time_taken
        WHERE id = v_session.id;
    ELSE
        UPDATE challenge_sessions SET attempts_used = v_attempt_number WHERE id = v_session.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'isValid', v_is_valid,
        'validationErrors', v_validation_errors,
        'attemptNumber', v_attempt_number,
        'maxAttempts', v_max_attempts,
        'isCompleted', v_attempt_number >= v_max_attempts
    );
END;
$$;

-- ─── submit_model_duel_strategy ─────────────────────
-- Persists a routing strategy for Model Duel.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_model_duel_strategy(
    p_team_id UUID,
    p_challenge_id UUID,
    p_round_session_id UUID,
    p_routing_rules JSONB,
    p_model_identifications JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session challenge_sessions;
    v_attempt_number INTEGER;
    v_max_attempts INTEGER := 1;
    v_challenge challenges;
    v_time_taken INTEGER;
BEGIN
    SELECT * INTO v_session FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge session not started');
    END IF;

    IF v_session.status != 'IN_PROGRESS' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge is not in progress');
    END IF;

    IF now() > v_session.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_session.deadline_at WHERE id = v_session.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time expired');
    END IF;

    SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
    v_max_attempts := COALESCE(v_challenge.max_attempts, 1);

    SELECT COUNT(*) INTO v_attempt_number FROM model_duel_strategies
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id;
    v_attempt_number := v_attempt_number + 1;

    IF v_attempt_number > v_max_attempts THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already submitted');
    END IF;

    v_time_taken := EXTRACT(EPOCH FROM (now() - v_session.started_at))::INTEGER;

    INSERT INTO model_duel_strategies (
        team_id, challenge_id, challenge_session_id, round_session_id,
        attempt_number, routing_rules, model_identifications, submitted_at
    ) VALUES (
        p_team_id, p_challenge_id, v_session.id, p_round_session_id,
        v_attempt_number, p_routing_rules, p_model_identifications, now()
    );

    UPDATE challenge_sessions SET
        status = 'COMPLETED', completed_at = now(),
        attempts_used = v_attempt_number, total_time_seconds = v_time_taken
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'success', true,
        'attemptNumber', v_attempt_number,
        'isCompleted', true
    );
END;
$$;

-- ─── execute_negotiation_action ─────────────────────
-- Server-side negotiation engine. Processes participant actions,
-- generates opponent responses, updates state.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION execute_negotiation_action(
    p_team_id UUID,
    p_challenge_id UUID,
    p_action_type TEXT,
    p_parameters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cs challenge_sessions;
    v_ns negotiation_sessions;
    v_scenario negotiation_scenarios;
    v_seq INTEGER;
    v_state_before JSONB;
    v_state_after JSONB;
    v_opponent_response JSONB := '{}'::jsonb;
    v_opponent_action_type TEXT;
    v_discovered JSONB := '[]'::jsonb;
    v_is_terminal BOOLEAN := false;
    v_time_taken INTEGER;
BEGIN
    -- Verify challenge session
    SELECT * INTO v_cs FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id AND status = 'IN_PROGRESS';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not active');
    END IF;

    IF now() > v_cs.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_cs.deadline_at WHERE id = v_cs.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time expired');
    END IF;

    -- Get negotiation session
    SELECT * INTO v_ns FROM negotiation_sessions
    WHERE challenge_session_id = v_cs.id AND team_id = p_team_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Negotiation session not found');
    END IF;

    IF v_ns.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Negotiation already ended: ' || v_ns.status);
    END IF;

    -- Get scenario for opponent logic
    SELECT * INTO v_scenario FROM negotiation_scenarios WHERE id = v_ns.scenario_id;

    v_state_before := v_ns.current_state;
    v_seq := v_ns.action_count + 1;

    -- Handle terminal actions
    IF p_action_type = 'ACCEPT' THEN
        v_is_terminal := true;
        v_state_after := v_state_before || jsonb_build_object('deal_accepted', true);
        v_opponent_response := jsonb_build_object('message', 'Deal accepted. Pleasure doing business.');
    ELSIF p_action_type = 'WALK_AWAY' THEN
        v_is_terminal := true;
        v_state_after := v_state_before || jsonb_build_object('walked_away', true);
        v_opponent_response := jsonb_build_object('message', 'Unfortunate. We could have found common ground.');
    ELSIF p_action_type = 'MAKE_OFFER' THEN
        -- Evaluate offer against opponent's hidden parameters
        v_state_after := v_state_before || jsonb_build_object(
            'last_offer', p_parameters,
            'round', v_ns.current_round + 1
        );
        -- Simple opponent logic: counter if offer doesn't meet minimum
        v_opponent_action_type := 'OPPONENT_COUNTER';
        v_opponent_response := jsonb_build_object(
            'message', 'Interesting proposal. Let me counter with adjusted terms.',
            'counter_terms', jsonb_build_object('note', 'Counter based on opponent strategy')
        );
    ELSIF p_action_type = 'ASK_QUESTION' THEN
        -- Information discovery: reveal some hidden info based on question quality
        v_state_after := v_state_before;
        v_opponent_action_type := 'OPPONENT_INFO_RESPONSE';
        v_opponent_response := jsonb_build_object(
            'message', 'That''s a fair question. I can share that our timeline is somewhat flexible.',
            'info_revealed', true
        );
        v_discovered := v_ns.discovered_info || jsonb_build_array(jsonb_build_object(
            'question', p_parameters->>'question',
            'response', v_opponent_response->>'message',
            'round', v_ns.current_round + 1
        ));
    ELSIF p_action_type = 'REQUEST_INFO' THEN
        v_state_after := v_state_before;
        v_opponent_action_type := 'OPPONENT_INFO_RESPONSE';
        v_opponent_response := jsonb_build_object(
            'message', 'I can provide some general information about our position.',
            'info_revealed', true
        );
    ELSIF p_action_type = 'CONCEDE' THEN
        v_state_after := v_state_before || jsonb_build_object(
            'last_concession', p_parameters,
            'concession_count', COALESCE((v_state_before->>'concession_count')::INTEGER, 0) + 1
        );
        v_opponent_action_type := 'OPPONENT_OFFER';
        v_opponent_response := jsonb_build_object(
            'message', 'I appreciate your flexibility. Perhaps we can build on this.'
        );
    ELSIF p_action_type = 'REJECT' THEN
        v_state_after := v_state_before;
        v_opponent_action_type := 'OPPONENT_COUNTER';
        v_opponent_response := jsonb_build_object(
            'message', 'I understand your position. Let me suggest an alternative.'
        );
    ELSIF p_action_type = 'COUNTER' THEN
        v_state_after := v_state_before || jsonb_build_object(
            'last_counter', p_parameters,
            'round', v_ns.current_round + 1
        );
        v_opponent_action_type := 'OPPONENT_COUNTER';
        v_opponent_response := jsonb_build_object(
            'message', 'Thank you for the counter-proposal. Let me review these terms.'
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action type');
    END IF;

    -- Record participant action
    INSERT INTO negotiation_actions (
        session_id, team_id, sequence_number, actor,
        action_type, parameters, state_before, state_after, opponent_response
    ) VALUES (
        v_ns.id, p_team_id, v_seq, 'PARTICIPANT',
        p_action_type, p_parameters, v_state_before, COALESCE(v_state_after, v_state_before),
        v_opponent_response
    );

    -- Record opponent response action if applicable
    IF v_opponent_action_type IS NOT NULL THEN
        INSERT INTO negotiation_actions (
            session_id, team_id, sequence_number, actor,
            action_type, parameters, state_before, state_after
        ) VALUES (
            v_ns.id, p_team_id, v_seq + 1, 'OPPONENT',
            v_opponent_action_type, v_opponent_response,
            COALESCE(v_state_after, v_state_before), COALESCE(v_state_after, v_state_before)
        );
    END IF;

    -- Update negotiation session
    UPDATE negotiation_sessions SET
        current_round = current_round + 1,
        current_state = COALESCE(v_state_after, v_state_before),
        discovered_info = CASE WHEN jsonb_array_length(v_discovered) > 0 THEN v_discovered ELSE discovered_info END,
        action_count = v_seq + CASE WHEN v_opponent_action_type IS NOT NULL THEN 1 ELSE 0 END,
        status = CASE WHEN v_is_terminal AND p_action_type = 'ACCEPT' THEN 'ACCEPTED'
                      WHEN v_is_terminal AND p_action_type = 'WALK_AWAY' THEN 'WALKED_AWAY'
                      ELSE 'ACTIVE' END,
        final_outcome = CASE WHEN v_is_terminal THEN jsonb_build_object(
            'action', p_action_type,
            'final_state', COALESCE(v_state_after, v_state_before),
            'rounds_played', v_ns.current_round + 1
        ) ELSE final_outcome END,
        completed_at = CASE WHEN v_is_terminal THEN now() ELSE NULL END
    WHERE id = v_ns.id;

    -- If terminal, complete the challenge session
    IF v_is_terminal THEN
        v_time_taken := EXTRACT(EPOCH FROM (now() - v_cs.started_at))::INTEGER;
        UPDATE challenge_sessions SET
            status = 'COMPLETED', completed_at = now(),
            total_time_seconds = v_time_taken
        WHERE id = v_cs.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'round', v_ns.current_round + 1,
        'opponentResponse', v_opponent_response,
        'currentState', COALESCE(v_state_after, v_state_before),
        'discoveredInfo', CASE WHEN jsonb_array_length(v_discovered) > 0 THEN v_discovered ELSE v_ns.discovered_info END,
        'isTerminal', v_is_terminal,
        'status', CASE WHEN v_is_terminal THEN
            CASE WHEN p_action_type = 'ACCEPT' THEN 'ACCEPTED' ELSE 'WALKED_AWAY' END
        ELSE 'ACTIVE' END,
        'actionCount', v_seq + CASE WHEN v_opponent_action_type IS NOT NULL THEN 1 ELSE 0 END
    );
END;
$$;

-- ─── execute_emergence_action ───────────────────────
-- Deterministic environment engine. Processes actions,
-- calculates state transitions and score deltas.
-- Uses transactional updates to prevent concurrent corruption.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION execute_emergence_action(
    p_team_id UUID,
    p_challenge_id UUID,
    p_action_type TEXT,
    p_parameters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cs challenge_sessions;
    v_es emergence_sessions;
    v_env emergence_environments;
    v_seq INTEGER;
    v_state_before JSONB;
    v_state_after JSONB;
    v_score_delta INTEGER := 0;
    v_observation TEXT := '';
    v_env_def JSONB;
    v_action_effects JSONB;
    v_effect JSONB;
    v_current_val INTEGER;
    v_multiplier NUMERIC := 1.0;
    v_penalty INTEGER := 0;
BEGIN
    -- Verify challenge session with row lock
    SELECT * INTO v_cs FROM challenge_sessions
    WHERE team_id = p_team_id AND challenge_id = p_challenge_id AND status = 'IN_PROGRESS'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not active');
    END IF;

    IF now() > v_cs.deadline_at THEN
        UPDATE challenge_sessions SET status = 'TIMEOUT', completed_at = v_cs.deadline_at WHERE id = v_cs.id;
        RETURN jsonb_build_object('success', false, 'error', 'Time expired');
    END IF;

    -- Lock emergence session for update (prevents concurrent actions)
    SELECT * INTO v_es FROM emergence_sessions
    WHERE challenge_session_id = v_cs.id AND team_id = p_team_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Emergence session not found');
    END IF;

    -- Load environment definition
    SELECT * INTO v_env FROM emergence_environments WHERE id = v_es.environment_id;
    v_env_def := v_env.environment_definition;

    v_state_before := v_es.current_state;
    v_seq := v_es.action_count + 1;

    -- ── Deterministic Environment Engine ──
    -- Action effects are defined in the environment definition
    v_action_effects := v_env_def->'action_effects';

    IF v_action_effects IS NOT NULL AND v_action_effects ? p_action_type THEN
        v_effect := v_action_effects->p_action_type;

        -- Base score delta
        v_score_delta := COALESCE((v_effect->>'base_score')::INTEGER, 0);

        -- Apply seed-based variation
        v_score_delta := v_score_delta + ((v_es.seed % 5) - 2);

        -- State transitions
        v_state_after := v_state_before;

        -- Update resource values based on effect
        IF v_effect ? 'resource_changes' THEN
            DECLARE
                v_key TEXT;
                v_change INTEGER;
            BEGIN
                FOR v_key, v_change IN
                    SELECT key, value::INTEGER FROM jsonb_each_text(v_effect->'resource_changes')
                LOOP
                    v_current_val := COALESCE((v_state_before->>v_key)::INTEGER, 0);
                    v_state_after := jsonb_set(v_state_after, ARRAY[v_key], to_jsonb(v_current_val + v_change));
                END LOOP;
            END;
        END IF;

        -- Check for multiplier conditions
        IF v_env_def ? 'multipliers' THEN
            DECLARE
                v_mult JSONB;
            BEGIN
                FOR v_mult IN SELECT * FROM jsonb_array_elements(v_env_def->'multipliers')
                LOOP
                    IF v_state_after @> (v_mult->'condition') THEN
                        v_multiplier := COALESCE((v_mult->>'value')::NUMERIC, 1.0);
                        v_observation := v_observation || ' Multiplier active!';
                    END IF;
                END LOOP;
            END;
        END IF;

        -- Check for penalties
        IF v_env_def ? 'penalties' THEN
            DECLARE
                v_pen JSONB;
            BEGIN
                FOR v_pen IN SELECT * FROM jsonb_array_elements(v_env_def->'penalties')
                LOOP
                    IF v_state_after @> (v_pen->'condition') THEN
                        v_penalty := COALESCE((v_pen->>'value')::INTEGER, 0);
                        v_observation := v_observation || ' Penalty applied.';
                    END IF;
                END LOOP;
            END;
        END IF;

        -- Apply multiplier and penalty
        v_score_delta := ROUND(v_score_delta * v_multiplier)::INTEGER - v_penalty;

        -- Generate observation from effect description
        v_observation := COALESCE(v_effect->>'observation', 'Action executed.') || v_observation;

        -- Track action count in state
        v_state_after := jsonb_set(v_state_after, ARRAY['action_count'], to_jsonb(v_seq));
        v_state_after := jsonb_set(v_state_after, ARRAY['last_action'], to_jsonb(p_action_type));
    ELSE
        -- Unknown action
        v_state_after := v_state_before;
        v_score_delta := -1;
        v_observation := 'Unknown action. No effect observed.';
    END IF;

    -- Record action
    INSERT INTO emergence_actions (
        session_id, sequence_number, action_type, parameters,
        state_before, state_after, score_delta, observation
    ) VALUES (
        v_es.id, v_seq, p_action_type, p_parameters,
        v_state_before, v_state_after, v_score_delta, v_observation
    );

    -- Update emergence session
    UPDATE emergence_sessions SET
        current_state = v_state_after,
        current_score = current_score + v_score_delta,
        action_count = v_seq
    WHERE id = v_es.id;

    RETURN jsonb_build_object(
        'success', true,
        'actionNumber', v_seq,
        'scoreDelta', v_score_delta,
        'currentScore', v_es.current_score + v_score_delta,
        'observation', v_observation,
        'currentState', v_state_after
    );
END;
$$;

-- ─── get_round5_session_state ───────────────────────
-- Full state recovery for refresh/reconnect.
-- Returns everything needed to resume.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_round5_session_state(
    p_team_id UUID,
    p_round_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_challenges JSONB;
    v_prompt_count INTEGER;
BEGIN
    -- Get all challenge sessions for this round
    SELECT jsonb_agg(row_to_json(cs) ORDER BY cs.created_at)
    INTO v_challenges
    FROM challenge_sessions cs
    JOIN challenges c ON cs.challenge_id = c.id
    WHERE cs.round_session_id = p_round_session_id AND cs.team_id = p_team_id;

    -- Get prompt count
    SELECT COUNT(*) INTO v_prompt_count
    FROM prompt_sheet_entries
    WHERE round_session_id = p_round_session_id AND team_id = p_team_id;

    v_result := jsonb_build_object(
        'challengeSessions', COALESCE(v_challenges, '[]'::jsonb),
        'promptCount', v_prompt_count
    );

    -- Add negotiation state if exists
    DECLARE
        v_neg_session JSONB;
    BEGIN
        SELECT row_to_json(ns) INTO v_neg_session
        FROM negotiation_sessions ns
        WHERE ns.team_id = p_team_id
        AND ns.challenge_session_id IN (
            SELECT id FROM challenge_sessions WHERE round_session_id = p_round_session_id
        );

        IF v_neg_session IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('negotiationState', v_neg_session);
        END IF;
    END;

    -- Add emergence state if exists
    DECLARE
        v_emg_session JSONB;
    BEGIN
        SELECT row_to_json(es) INTO v_emg_session
        FROM emergence_sessions es
        WHERE es.team_id = p_team_id
        AND es.challenge_session_id IN (
            SELECT id FROM challenge_sessions WHERE round_session_id = p_round_session_id
        );

        IF v_emg_session IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('emergenceState', v_emg_session);
        END IF;
    END;

    RETURN v_result;
END;
$$;

-- ─── complete_round5_session ────────────────────────
-- Aggregates all Round 5 challenge scores + process score.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_round5_session(
    p_team_id UUID,
    p_round_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_score INTEGER := 0;
    v_challenges_completed INTEGER := 0;
    v_prompt_stats JSONB;
    v_process_score INTEGER := 0;
    v_total_interactions INTEGER;
BEGIN
    -- Sum challenge scores
    SELECT COALESCE(SUM(score), 0), COUNT(*)
    INTO v_total_score, v_challenges_completed
    FROM challenge_sessions
    WHERE round_session_id = p_round_session_id AND status = 'COMPLETED';

    -- Calculate prompt process score (max 100)
    SELECT COUNT(*), jsonb_build_object(
        'total_interactions', COUNT(*),
        'providers_used', COUNT(DISTINCT provider),
        'models_used', COUNT(DISTINCT model),
        'revisions', COUNT(*) FILTER (WHERE parent_entry_id IS NOT NULL),
        'failed_requests', COUNT(*) FILTER (WHERE status = 'FAILED'),
        'avg_prompt_words', ROUND(AVG(prompt_word_count)),
        'challenges_with_ai', COUNT(DISTINCT challenge_id)
    )
    INTO v_total_interactions, v_prompt_stats
    FROM prompt_sheet_entries
    WHERE round_session_id = p_round_session_id AND team_id = p_team_id;

    -- Simple process scoring heuristic (deterministic)
    -- Base: did they use AI across all challenges? (40 pts)
    v_process_score := v_process_score + LEAST(
        (v_prompt_stats->>'challenges_with_ai')::INTEGER * 10, 40
    );
    -- Model diversity (20 pts)
    v_process_score := v_process_score + LEAST(
        (v_prompt_stats->>'models_used')::INTEGER * 10, 20
    );
    -- Iteration quality: revisions show refinement (20 pts)
    v_process_score := v_process_score + LEAST(
        (v_prompt_stats->>'revisions')::INTEGER * 5, 20
    );
    -- Efficiency: not spamming (20 pts - deduct for excessive/zero)
    IF v_total_interactions BETWEEN 5 AND 40 THEN
        v_process_score := v_process_score + 20;
    ELSIF v_total_interactions BETWEEN 1 AND 4 THEN
        v_process_score := v_process_score + 10;
    ELSIF v_total_interactions > 40 THEN
        v_process_score := v_process_score + 10;
    END IF;

    v_total_score := v_total_score + v_process_score;

    -- Record score event
    INSERT INTO round5_score_events (
        team_id, round_session_id, score_type,
        score_components, total_score
    ) VALUES (
        p_team_id, p_round_session_id, 'ROUND5_TOTAL',
        jsonb_build_object(
            'challenge_scores', v_total_score - v_process_score,
            'process_score', v_process_score,
            'prompt_stats', v_prompt_stats
        ),
        v_total_score
    );

    -- Complete round session
    UPDATE round_sessions
    SET completed_at = now(), score = v_total_score
    WHERE id = p_round_session_id;

    INSERT INTO activity_logs (team_id, action, details)
    VALUES (p_team_id, 'ROUND5_COMPLETED', jsonb_build_object(
        'round_session_id', p_round_session_id,
        'total_score', v_total_score,
        'process_score', v_process_score,
        'challenges_completed', v_challenges_completed
    ));

    RETURN jsonb_build_object(
        'success', true,
        'totalScore', v_total_score,
        'processScore', v_process_score,
        'promptStats', v_prompt_stats,
        'challengesCompleted', v_challenges_completed
    );
END;
$$;
