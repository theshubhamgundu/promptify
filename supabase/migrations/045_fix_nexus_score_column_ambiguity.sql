-- 044 originally used a local variable named `score`, which is ambiguous beside
-- challenge_sessions.score in PL/pgSQL UPDATE statements. Rebuild the installed
-- evaluator with a distinct local variable. This migration is safe after the
-- corrected 044 as well, because its replacements then become no-ops.
DO $$
DECLARE v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('evaluate_nexus_protocol(uuid,uuid,uuid,text,text)')) INTO v_definition;
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'evaluate_nexus_protocol was not installed by migration 044';
  END IF;

  v_definition := regexp_replace(v_definition, '\mscore\s+integer\s*:=\s*0', 'v_score INTEGER := 0', 'g');
  v_definition := regexp_replace(v_definition, '\mscore\s*:=', 'v_score :=', 'g');
  v_definition := regexp_replace(v_definition, '\mscore\s*>\s*0', 'v_score > 0', 'g');
  v_definition := regexp_replace(v_definition, '\mscore\s*=\s*score', 'score = v_score', 'g');
  v_definition := regexp_replace(v_definition, 'p_submission\s*,\s*score\)', 'p_submission,v_score)', 'g');
  v_definition := regexp_replace(v_definition, '''score''\s*,\s*score\s*,', '''score'',v_score,', 'g');
  EXECUTE v_definition;
END $$;
