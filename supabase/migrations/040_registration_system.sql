-- ════════════════════════════════════════════════════════════════
-- Migration 040: Team Registration System
-- Handles team registration, unique code generation, email validation
-- ════════════════════════════════════════════════════════════════

-- 1. Extend teams table with registration details
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS registration_email TEXT,
ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS password TEXT, -- Will be set day before event
ADD COLUMN IF NOT EXISTS is_password_sent BOOLEAN DEFAULT false;

-- 2. Create team_members table (replacing participants for registration)
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    member_number INTEGER NOT NULL CHECK (member_number IN (1, 2)),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT, -- 10-digit contact number
    roll_number TEXT NOT NULL,
    year TEXT CHECK (year IN ('1', '2', '3', '4')),
    branch TEXT, -- For VITS students (AI&DS, AIML, CSE, CSM, etc.) - NULL for VFSTR
    section TEXT, -- For VITS students (A, B, C, etc.) - NULL for VFSTR
    college TEXT NOT NULL CHECK (college IN ('VITS', 'VFSTR')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, member_number),
    CONSTRAINT valid_email CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@(gmail\.com|vignanits\.ac\.in)$'
    )
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- 3. Team code sequence for unique 4-digit generation
CREATE SEQUENCE IF NOT EXISTS team_code_sequence START WITH 1000 INCREMENT BY 1;

-- 4. Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policies for team_members (public can insert during registration)
DROP POLICY IF EXISTS "Anyone can view team members" ON team_members;
CREATE POLICY "Anyone can view team members"
    ON team_members FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Teams can view own members" ON team_members;
CREATE POLICY "Teams can view own members"
    ON team_members FOR SELECT
    TO anon, authenticated
    USING (true);

-- ════════════════════════════════════════════════════════════════
-- RPC: register_team
-- Handles team registration with automatic code generation and email
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION register_team(
    p_team_name TEXT,
    p_member1_name TEXT,
    p_member1_email TEXT,
    p_member1_phone TEXT DEFAULT NULL,
    p_member1_roll TEXT DEFAULT NULL,
    p_member1_year TEXT DEFAULT NULL,
    p_member1_branch TEXT DEFAULT NULL,
    p_member1_section TEXT DEFAULT NULL,
    p_member1_college TEXT DEFAULT 'VITS',
    p_member2_name TEXT DEFAULT NULL,
    p_member2_email TEXT DEFAULT NULL,
    p_member2_phone TEXT DEFAULT NULL,
    p_member2_roll TEXT DEFAULT NULL,
    p_member2_year TEXT DEFAULT NULL,
    p_member2_branch TEXT DEFAULT NULL,
    p_member2_section TEXT DEFAULT NULL,
    p_member2_college TEXT DEFAULT 'VITS',
    p_event_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_id UUID;
    v_team_code TEXT;
    v_code_number INTEGER;
    v_event_id UUID;
    v_registration_email TEXT;
BEGIN
    -- 1. Get or use default event
    IF p_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM events WHERE status = 'REGISTRATION_OPEN' LIMIT 1;
        IF v_event_id IS NULL THEN
            SELECT id INTO v_event_id FROM events ORDER BY created_at DESC LIMIT 1;
        END IF;
    ELSE
        v_event_id := p_event_id;
    END IF;

    -- 2. Validate both members are from same college
    IF p_member1_college != p_member2_college THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Both team members must be from the same college'
        );
    END IF;

    -- 3. Check if emails are already registered
    IF EXISTS (SELECT 1 FROM team_members WHERE email IN (p_member1_email, p_member2_email)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'One or more email addresses are already registered'
        );
    END IF;

    -- 4. Generate unique team code: AIDX + 4 digits
    v_code_number := nextval('team_code_sequence');
    v_team_code := 'AIDX' || LPAD(v_code_number::TEXT, 4, '0');

    -- Ensure uniqueness (in case of sequence reset)
    WHILE EXISTS (SELECT 1 FROM teams WHERE access_code = v_team_code) LOOP
        v_code_number := nextval('team_code_sequence');
        v_team_code := 'AIDX' || LPAD(v_code_number::TEXT, 4, '0');
    END LOOP;

    -- 5. Use first member's email as registration email
    v_registration_email := p_member1_email;

    -- 6. Create team
    INSERT INTO teams (
        event_id,
        name,
        access_code,
        registration_email,
        registered_at
    ) VALUES (
        v_event_id,
        p_team_name,
        v_team_code,
        v_registration_email,
        now()
    ) RETURNING id INTO v_team_id;

    -- 7. Add member 1
    INSERT INTO team_members (
        team_id,
        member_number,
        full_name,
        email,
        phone,
        roll_number,
        year,
        branch,
        section,
        college
    ) VALUES (
        v_team_id,
        1,
        p_member1_name,
        p_member1_email,
        p_member1_phone,
        p_member1_roll,
        p_member1_year,
        p_member1_branch,
        p_member1_section,
        p_member1_college
    );

    -- 8. Add member 2
    INSERT INTO team_members (
        team_id,
        member_number,
        full_name,
        email,
        phone,
        roll_number,
        year,
        branch,
        section,
        college
    ) VALUES (
        v_team_id,
        2,
        p_member2_name,
        p_member2_email,
        p_member2_phone,
        p_member2_roll,
        p_member2_year,
        p_member2_branch,
        p_member2_section,
        p_member2_college
    );

    -- 9. Log activity
    INSERT INTO activity_logs (team_id, action, details)
    VALUES (v_team_id, 'TEAM_REGISTERED', jsonb_build_object(
        'team_name', p_team_name,
        'team_code', v_team_code,
        'member1_email', p_member1_email,
        'member2_email', p_member2_email,
        'college', p_member1_college
    ));

    -- 10. Return success with team code
    RETURN jsonb_build_object(
        'success', true,
        'teamId', v_team_id,
        'teamCode', v_team_code,
        'teamName', p_team_name,
        'message', 'Registration successful! Your team code is: ' || v_team_code
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- RPC: send_team_passwords
-- Admin function to generate and send passwords day before event
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION generate_team_password()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluding similar characters
    v_password TEXT := '';
    v_length INTEGER := 8;
BEGIN
    FOR i IN 1..v_length LOOP
        v_password := v_password || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    RETURN v_password;
END;
$$;

CREATE OR REPLACE FUNCTION assign_passwords_to_all_teams(p_event_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team RECORD;
    v_password TEXT;
    v_count INTEGER := 0;
    v_event_id UUID;
BEGIN
    -- Get event
    IF p_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM events WHERE status = 'REGISTRATION_OPEN' LIMIT 1;
    ELSE
        v_event_id := p_event_id;
    END IF;

    -- Loop through all teams without passwords
    FOR v_team IN 
        SELECT id, name, access_code, registration_email 
        FROM teams 
        WHERE event_id = v_event_id 
        AND (password IS NULL OR password = '')
    LOOP
        -- Generate unique password
        v_password := generate_team_password();
        
        -- Update team
        UPDATE teams 
        SET password = v_password, is_password_sent = false
        WHERE id = v_team.id;
        
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'teamsUpdated', v_count,
        'message', 'Passwords generated for ' || v_count || ' teams. Use admin panel to send emails.'
    );
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- RPC: get_registration_stats
-- Get registration statistics
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_registration_stats(p_event_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
    v_total_teams INTEGER;
    v_vits_teams INTEGER;
    v_vfstr_teams INTEGER;
    v_teams_with_passwords INTEGER;
BEGIN
    IF p_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM events ORDER BY created_at DESC LIMIT 1;
    ELSE
        v_event_id := p_event_id;
    END IF;

    SELECT COUNT(*) INTO v_total_teams FROM teams WHERE event_id = v_event_id;
    
    SELECT COUNT(DISTINCT team_id) INTO v_vits_teams 
    FROM team_members 
    WHERE college = 'VITS' AND team_id IN (SELECT id FROM teams WHERE event_id = v_event_id);
    
    SELECT COUNT(DISTINCT team_id) INTO v_vfstr_teams 
    FROM team_members 
    WHERE college = 'VFSTR' AND team_id IN (SELECT id FROM teams WHERE event_id = v_event_id);
    
    SELECT COUNT(*) INTO v_teams_with_passwords 
    FROM teams 
    WHERE event_id = v_event_id AND password IS NOT NULL AND password != '';

    RETURN jsonb_build_object(
        'totalTeams', v_total_teams,
        'vitsTeams', v_vits_teams,
        'vfstrTeams', v_vfstr_teams,
        'teamsWithPasswords', v_teams_with_passwords,
        'eventId', v_event_id
    );
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- Create view for team details with members
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_team_registrations AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    t.access_code as team_code,
    t.registration_email,
    t.registered_at,
    t.password,
    t.is_password_sent,
    jsonb_agg(
        jsonb_build_object(
            'memberNumber', tm.member_number,
            'name', tm.full_name,
            'email', tm.email,
            'phone', tm.phone,
            'rollNumber', tm.roll_number,
            'year', tm.year,
            'branch', tm.branch,
            'section', tm.section,
            'college', tm.college
        ) ORDER BY tm.member_number
    ) as members
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id, t.name, t.access_code, t.registration_email, t.registered_at, t.password, t.is_password_sent;
