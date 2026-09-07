-- Migration 021: Admin Audit Logging (Phase 11)

-- ═══════════════════════════════════════════════════════════════════════
-- RPC: Update Team Status (Freeze / Disqualify)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_update_team_status(
    p_team_id UUID,
    p_action TEXT, -- 'FREEZE', 'UNFREEZE', 'DISQUALIFY'
    p_reason TEXT DEFAULT 'Action performed via Admin Dashboard'
) RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_team RECORD;
    v_old_state JSONB;
    v_new_state JSONB;
    v_audit_action audit_action;
BEGIN
    -- Verify admin
    v_admin_id := auth.uid();
    IF auth_user_role() != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Requires admin role';
    END IF;

    -- Get current team state
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found';
    END IF;

    v_old_state := jsonb_build_object(
        'is_frozen', v_team.is_frozen,
        'frozen_reason', v_team.frozen_reason
    );

    -- Apply mutations
    IF p_action = 'FREEZE' THEN
        UPDATE teams 
        SET is_frozen = true, frozen_reason = p_reason, frozen_at = now()
        WHERE id = p_team_id;
        v_audit_action := 'TEAM_FREEZE';
        
    ELSIF p_action = 'UNFREEZE' THEN
        UPDATE teams 
        SET is_frozen = false, frozen_reason = null, frozen_at = null
        WHERE id = p_team_id;
        v_audit_action := 'TEAM_UNFREEZE';
        
    ELSIF p_action = 'DISQUALIFY' THEN
        UPDATE teams 
        SET is_frozen = true, frozen_reason = p_reason, frozen_at = now()
        WHERE id = p_team_id;
        
        -- Also suspend session
        UPDATE team_sessions 
        SET state = 'SUSPENDED' 
        WHERE team_id = p_team_id;

        -- Log to activity
        INSERT INTO activity_logs (action, team_id, details)
        VALUES ('SCORE_OVERRIDE', p_team_id, jsonb_build_object('admin_action', 'DISQUALIFIED', 'reason', p_reason));

        v_audit_action := 'TEAM_DISQUALIFY';
    ELSE
        RAISE EXCEPTION 'Invalid action: %', p_action;
    END IF;

    -- Get new state
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    v_new_state := jsonb_build_object(
        'is_frozen', v_team.is_frozen,
        'frozen_reason', v_team.frozen_reason
    );

    -- Log to admin_audit_logs
    PERFORM log_admin_action(
        v_admin_id,
        v_audit_action,
        'team',
        p_team_id,
        v_team.event_id,
        v_old_state,
        v_new_state,
        p_reason
    );

    RETURN jsonb_build_object('success', true, 'action', p_action, 'team_id', p_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════
-- RPC: Toggle Round Status
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_toggle_round_status(
    p_round_id UUID,
    p_new_status round_status,
    p_reason TEXT DEFAULT 'Status toggled via Admin Dashboard'
) RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_round RECORD;
    v_old_state JSONB;
    v_new_state JSONB;
BEGIN
    -- Verify admin
    v_admin_id := auth.uid();
    IF auth_user_role() != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Requires admin role';
    END IF;

    -- Get current round state
    SELECT * INTO v_round FROM rounds WHERE id = p_round_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Round not found';
    END IF;

    v_old_state := jsonb_build_object('status', v_round.status);

    -- Perform update
    UPDATE rounds SET status = p_new_status WHERE id = p_round_id;

    v_new_state := jsonb_build_object('status', p_new_status);

    -- Log to admin_audit_logs (we use 'EVENT_PAUSE' or 'EVENT_RESUME' because audit_action enum lacks round-specific enum)
    PERFORM log_admin_action(
        v_admin_id,
        CASE WHEN p_new_status = 'LIVE' THEN 'EVENT_RESUME'::audit_action ELSE 'EVENT_PAUSE'::audit_action END,
        'round',
        p_round_id,
        v_round.event_id,
        v_old_state,
        v_new_state,
        p_reason
    );

    RETURN jsonb_build_object('success', true, 'round_id', p_round_id, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
