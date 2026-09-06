-- =====================================================
-- Quick Check: Quiz Reset Status
-- =====================================================
-- Use this to quickly check if quiz reset is working
-- and identify teams with orphaned data issues
-- =====================================================

-- =====================================================
-- 1. Check for orphaned quiz_sessions
-- =====================================================
DO $$
DECLARE
    v_orphaned_count INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_count
    FROM quiz_sessions qs
    WHERE qs.round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = qs.round_session_id
      );
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 ORPHANED QUIZ SESSIONS CHECK';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    IF v_orphaned_count > 0 THEN
        RAISE NOTICE '❌ Found % orphaned quiz_sessions!', v_orphaned_count;
        RAISE NOTICE '   These sessions reference deleted round_sessions.';
        RAISE NOTICE '   This will prevent teams from re-attempting quizzes.';
    ELSE
        RAISE NOTICE '✅ No orphaned quiz_sessions found.';
    END IF;
    RAISE NOTICE '';
END $$;

-- Show details of orphaned quiz_sessions
SELECT 
    'ORPHANED QUIZ_SESSIONS' as issue_type,
    qs.id as quiz_session_id,
    qs.team_id,
    t.name as team_name,
    qs.round_id,
    r.name as round_name,
    qs.round_session_id as invalid_round_session_id,
    qs.status,
    qs.started_at,
    qs.submitted_at
FROM quiz_sessions qs
LEFT JOIN teams t ON qs.team_id = t.id
LEFT JOIN rounds r ON qs.round_id = r.id
WHERE qs.round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions rs 
    WHERE rs.id = qs.round_session_id
  )
ORDER BY qs.started_at DESC;

-- =====================================================
-- 2. Check for orphaned quiz_answers
-- =====================================================
DO $$
DECLARE
    v_orphaned_count INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_count
    FROM quiz_answers qa
    WHERE qa.round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = qa.round_session_id
      );
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 ORPHANED QUIZ ANSWERS CHECK';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    IF v_orphaned_count > 0 THEN
        RAISE NOTICE '❌ Found % orphaned quiz_answers!', v_orphaned_count;
        RAISE NOTICE '   These answers reference deleted round_sessions.';
    ELSE
        RAISE NOTICE '✅ No orphaned quiz_answers found.';
    END IF;
    RAISE NOTICE '';
END $$;

-- Show details of orphaned quiz_answers
SELECT 
    'ORPHANED QUIZ_ANSWERS' as issue_type,
    COUNT(*) as answer_count,
    qa.team_id,
    t.name as team_name,
    qa.round_session_id as invalid_round_session_id
FROM quiz_answers qa
LEFT JOIN teams t ON qa.team_id = t.id
WHERE qa.round_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM round_sessions rs 
    WHERE rs.id = qa.round_session_id
  )
GROUP BY qa.team_id, t.name, qa.round_session_id
ORDER BY answer_count DESC;

-- =====================================================
-- 3. Check for orphaned challenge_attempts
-- =====================================================
DO $$
DECLARE
    v_orphaned_count INT;
BEGIN
    SELECT COUNT(*) INTO v_orphaned_count
    FROM challenge_attempts ca
    WHERE ca.round_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM round_sessions rs 
        WHERE rs.id = ca.round_session_id
      );
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 ORPHANED CHALLENGE ATTEMPTS CHECK';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    IF v_orphaned_count > 0 THEN
        RAISE NOTICE '❌ Found % orphaned challenge_attempts!', v_orphaned_count;
        RAISE NOTICE '   These attempts reference deleted round_sessions.';
    ELSE
        RAISE NOTICE '✅ No orphaned challenge_attempts found.';
    END IF;
    RAISE NOTICE '';
END $$;

-- =====================================================
-- 4. Check CASCADE configuration
-- =====================================================
DO $$
DECLARE
    v_quiz_sessions_cascade TEXT;
    v_quiz_answers_cascade TEXT;
    v_challenge_attempts_cascade TEXT;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '🔍 CASCADE CONFIGURATION CHECK';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    -- Check quiz_sessions FK
    SELECT confdeltype::text INTO v_quiz_sessions_cascade
    FROM pg_constraint
    WHERE conname = 'quiz_sessions_round_session_id_fkey';
    
    IF v_quiz_sessions_cascade = 'c' THEN
        RAISE NOTICE '✅ quiz_sessions.round_session_id has CASCADE delete';
    ELSE
        RAISE NOTICE '❌ quiz_sessions.round_session_id missing CASCADE (currently: %)', 
            CASE v_quiz_sessions_cascade
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE 'UNKNOWN'
            END;
    END IF;
    
    -- Check quiz_answers FK
    SELECT confdeltype::text INTO v_quiz_answers_cascade
    FROM pg_constraint
    WHERE conname = 'quiz_answers_round_session_id_fkey';
    
    IF v_quiz_answers_cascade = 'c' THEN
        RAISE NOTICE '✅ quiz_answers.round_session_id has CASCADE delete';
    ELSE
        RAISE NOTICE '❌ quiz_answers.round_session_id missing CASCADE (currently: %)', 
            CASE v_quiz_answers_cascade
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE 'UNKNOWN'
            END;
    END IF;
    
    -- Check challenge_attempts FK
    SELECT confdeltype::text INTO v_challenge_attempts_cascade
    FROM pg_constraint
    WHERE conname = 'challenge_attempts_round_session_id_fkey';
    
    IF v_challenge_attempts_cascade = 'c' THEN
        RAISE NOTICE '✅ challenge_attempts.round_session_id has CASCADE delete';
    ELSE
        RAISE NOTICE '❌ challenge_attempts.round_session_id missing CASCADE (currently: %)', 
            CASE v_challenge_attempts_cascade
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE 'UNKNOWN'
            END;
    END IF;
    
    RAISE NOTICE '';
END $$;

-- =====================================================
-- 5. Final Summary
-- =====================================================
DO $$
DECLARE
    v_total_issues INT;
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM quiz_sessions qs WHERE qs.round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions rs WHERE rs.id = qs.round_session_id)) +
        (SELECT COUNT(*) FROM quiz_answers qa WHERE qa.round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions rs WHERE rs.id = qa.round_session_id)) +
        (SELECT COUNT(*) FROM challenge_attempts ca WHERE ca.round_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM round_sessions rs WHERE rs.id = ca.round_session_id))
    INTO v_total_issues;
    
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE '📊 SUMMARY';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    IF v_total_issues > 0 THEN
        RAISE NOTICE '❌ ISSUES FOUND: % orphaned records detected!', v_total_issues;
        RAISE NOTICE '';
        RAISE NOTICE '🔧 To fix these issues, run:';
        RAISE NOTICE '   scripts/FIX_QUIZ_RESET_ISSUE.sql';
        RAISE NOTICE '';
        RAISE NOTICE '📖 For more details, see:';
        RAISE NOTICE '   scripts/QUIZ_RESET_FIX_README.md';
    ELSE
        RAISE NOTICE '✅ ALL CHECKS PASSED!';
        RAISE NOTICE '   Quiz reset functionality is working correctly.';
        RAISE NOTICE '   No orphaned records found.';
    END IF;
    RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
