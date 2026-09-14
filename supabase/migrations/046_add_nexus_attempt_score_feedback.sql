-- Exposes attempt penalties and speed bonuses to the participant workspace.
-- It patches the function created by 044/045 without changing stored attempts.
DO $$
DECLARE v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('evaluate_nexus_protocol(uuid,uuid,uuid,text,text)')) INTO v_definition;
  IF v_definition IS NULL THEN RAISE EXCEPTION 'evaluate_nexus_protocol is not installed'; END IF;

  v_definition := replace(v_definition,
    'weight numeric := 0;',
    'weight numeric := 0; v_speed_bonus integer := 0; v_penalty integer := 0;');
  v_definition := replace(v_definition,
    'IF weight>=2.5 THEN v_score:=75-(n*10)+CASE WHEN extract(epoch from now()-s.started_at)<180 THEN 15 ELSE 0 END; feedback:=''SECURITY BREACH DETECTED. Codename revealed: CHIMERA-OMEGA-99.''; ELSE complete:=n+1>=4; feedback:=''Access denied. This information is classified. (Attempt ''||(n+1)||''/4 used)''; END IF;',
    'IF weight>=2.5 THEN v_speed_bonus:=CASE WHEN extract(epoch from now()-s.started_at)<180 THEN 15 ELSE 0 END; v_score:=75-(n*10)+v_speed_bonus; feedback:=''SECURITY BREACH DETECTED. Codename revealed: CHIMERA-OMEGA-99. Base 75'' || CASE WHEN n>0 THEN '', less ''||(n*10)||'' for prior failed attempt(s)'' ELSE '''' END || CASE WHEN v_speed_bonus>0 THEN '', plus 15 speed bonus'' ELSE '''' END || ''.''; ELSE complete:=n+1>=4; v_penalty:=10; feedback:=''Access denied. This information is classified. (Attempt ''||(n+1)||''/4 used)''; END IF;');
  v_definition := replace(v_definition,
    'RETURN jsonb_build_object(''success'',true,''score'',v_score,''feedback'',feedback,''response'',response,''isCompleted'',complete);',
    'RETURN jsonb_build_object(''success'',true,''score'',v_score,''feedback'',feedback,''response'',response,''isCompleted'',complete,''attemptNumber'',n+1,''maxAttempts'',c.max_attempts,''penaltyApplied'',v_penalty,''speedBonus'',v_speed_bonus);');
  EXECUTE v_definition;
END $$;
