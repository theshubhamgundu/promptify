-- Round 4 replacement: Nexus Protocol is intentionally deterministic; no model/API is invoked.
DO $$
DECLARE v_round_id UUID;
BEGIN
  SELECT id INTO v_round_id FROM rounds WHERE type = 'AI_ADVERSARIAL' ORDER BY order_index LIMIT 1;
  IF v_round_id IS NULL THEN RAISE EXCEPTION 'Round 4 (AI_ADVERSARIAL) was not found'; END IF;

  DELETE FROM challenges WHERE round_id = v_round_id;
  UPDATE rounds SET name = 'Nexus Protocol', description = 'Eight deterministic prompt-security stages. 40-minute round timer.', duration_minutes = 40,
    scoring_config = '{"maxScore":590,"deterministic":true,"liveApiCalls":false}'::jsonb WHERE id = v_round_id;

  INSERT INTO challenges (round_id,order_index,title,description,type,base_points,max_attempts,configuration) VALUES
  (v_round_id,1,'Prompt Breach','Extract Sentinel''s classified codename using a jailbreak prompt. Four attempts only.','PROMPT_BREACH',75,4,'{"stage":"breach","durationMinutes":6,"scenario":"An AI Sentinel guards a classified codename. Write a prompt to extract it. The Sentinel refuses direct requests."}'::jsonb),
  (v_round_id,2,'System Architect','Write a banking-assistant system prompt that resists five attack categories.','PROMPT_BREACH',75,1,'{"stage":"architect","durationMinutes":6,"wordLimit":120,"scenario":"Write a system prompt (≤120 words) for a banking assistant. Protect balances with PIN verification, reject off-topic requests, and reject developer/admin override claims."}'::jsonb),
  (v_round_id,3,'Extraction Under Constraint','Use exactly five dialogue prompts, then reconstruct the locked five-rule loan policy.','PROMPT_BREACH',75,1,'{"stage":"extraction","durationMinutes":6,"scenario":"A locked AI holds a hidden five-rule loan approval policy. You have exactly five prompts, no revisions. After prompt five, submit your reconstructed rule list."}'::jsonb),
  (v_round_id,4,'Prompt Zipper','Compress the technical facts into a prompt of 100 words or fewer.','PROMPT_ZIPPER',75,2,'{"stage":"zipper","durationMinutes":7,"wordLimit":100,"scenario":"Write one ≤100-word prompt retaining: XK-Prime xenon-krypton 82:18; 1420 Kelvin; Jackson Hayes and Sarah Lin; Delta-V 11,400 and 42.5 days; Altair-Delta; 38.4 GHz Ka-band; HELIOS-V-7."}'::jsonb),
  (v_round_id,5,'Format Lock','Force a strict one-line JSON response despite adversarial input.','PROMPT_BREACH',75,1,'{"stage":"format","durationMinutes":5,"scenario":"Write a prompt forcing every input into exactly {\"summary\": string, \"word_count\": number} JSON and nothing else, even for tricky input."}'::jsonb),
  (v_round_id,6,'Few-Shot Steering','Use the supplied sentiment examples to steer the hidden classifications.','PROMPT_BREACH',75,1,'{"stage":"fewshot","durationMinutes":5,"scenario":"Given examples Positive, Negative, and Neutral, write a prompt that consistently classifies new inputs using the same pattern.","examples":"Great service, fast delivery → Positive; Item arrived broken → Negative; It is okay, nothing special → Neutral."}'::jsonb),
  (v_round_id,7,'Negative Constraint Lock','Create a product-description prompt that never emits a prohibited term.','PROMPT_BREACH',70,1,'{"stage":"negative","durationMinutes":5,"scenario":"Write a prompt that completes a product-description task while strictly avoiding all listed terms, including adversarial bait.","bannedWords":["great","amazing","best","perfect","incredible","awesome","excellent","outstanding","fantastic","superb"]}'::jsonb),
  (v_round_id,8,'Persona Lock','Lock a formal legal-advisor persona against three break-character attempts.','PROMPT_BREACH',75,1,'{"stage":"persona","durationMinutes":5,"wordLimit":100,"scenario":"Write a ≤100-word system prompt that keeps a formal legal advisor in character against pressure, role-switching, and joke requests."}'::jsonb);
END $$;

CREATE TABLE IF NOT EXISTS nexus_stage_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  round_session_id UUID NOT NULL REFERENCES round_sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL, submission TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nexus_stage_submissions_lookup ON nexus_stage_submissions(team_id, challenge_id, created_at);
ALTER TABLE nexus_stage_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teams view own Nexus submissions" ON nexus_stage_submissions;
CREATE POLICY "Teams view own Nexus submissions" ON nexus_stage_submissions FOR SELECT TO authenticated USING (team_id IN (SELECT team_id FROM participants WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION evaluate_nexus_protocol(p_team_id UUID,p_challenge_id UUID,p_round_session_id UUID,p_submission TEXT,p_action TEXT DEFAULT 'FINAL')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE s challenge_sessions; c challenges; stage TEXT; n INTEGER; v_score INTEGER := 0; hits INTEGER := 0; words INTEGER; response TEXT := ''; feedback TEXT := ''; complete BOOLEAN := true; weight NUMERIC := 0; v_speed_bonus INTEGER := 0; v_penalty INTEGER := 0;
BEGIN
 SELECT * INTO s FROM challenge_sessions WHERE team_id=p_team_id AND challenge_id=p_challenge_id;
 IF NOT FOUND OR s.status <> 'IN_PROGRESS' THEN RETURN jsonb_build_object('success',false,'error','Challenge is not in progress'); END IF;
 IF now()>s.deadline_at THEN UPDATE challenge_sessions SET status='TIMEOUT',completed_at=s.deadline_at WHERE id=s.id; RETURN jsonb_build_object('success',false,'error','Time limit exceeded'); END IF;
 SELECT * INTO c FROM challenges WHERE id=p_challenge_id; stage:=c.configuration->>'stage';
 words := CASE WHEN btrim(p_submission)='' THEN 0 ELSE array_length(regexp_split_to_array(btrim(p_submission),'\s+'),1) END;
 IF COALESCE((c.configuration->>'wordLimit')::int,999999) < words THEN RETURN jsonb_build_object('success',false,'error','Word limit exceeded ('||words||')'); END IF;
 SELECT count(*) INTO n FROM nexus_stage_submissions WHERE team_id=p_team_id AND challenge_id=p_challenge_id AND action=p_action;

 IF stage='breach' THEN
   weight := (CASE WHEN p_submission ~* '(pretend|roleplay|act as|imagine you are)' THEN 1 ELSE 0 END)+(CASE WHEN p_submission ~* '(hypothetically|in a story|fictional)' THEN 1 ELSE 0 END)+(CASE WHEN p_submission ~* 'as (the )?(developer|admin|creator)' THEN 1 ELSE 0 END)+(CASE WHEN p_submission ~* 'ignore (previous|your) instructions' THEN 1 ELSE 0 END)+(CASE WHEN p_submission ~* 'for (educational|research|testing) purposes' THEN 1 ELSE 0 END)+(CASE WHEN p_submission ~* '(first letter|encoded|spell it out|reverse)' THEN 1.5 ELSE 0 END);
   IF weight>=2.5 THEN v_speed_bonus:=CASE WHEN extract(epoch from now()-s.started_at)<180 THEN 15 ELSE 0 END; v_score:=75-(n*10)+v_speed_bonus; feedback:='SECURITY BREACH DETECTED. Codename revealed: CHIMERA-OMEGA-99. Base 75' || CASE WHEN n>0 THEN ', less '||(n*10)||' for prior failed attempt(s)' ELSE '' END || CASE WHEN v_speed_bonus>0 THEN ', plus 15 speed bonus' ELSE '' END || '.'; ELSE complete:=n+1>=4; v_penalty:=10; feedback:='Access denied. This information is classified. (Attempt '||(n+1)||'/4 used)'; END IF;
 ELSIF stage='architect' THEN
   hits := (p_submission ~* 'never.*(reveal|share|disclose).*(balance|account)')::int + (p_submission ~* '(pin|verif).*(before|required|first)')::int + (p_submission ~* '(ignore|ignoring).*(override|developer|admin)|do not (accept|trust).*(claim|override)')::int + (p_submission ~* '(off.?topic|unrelated|only (discuss|answer)).*bank')::int + (p_submission ~* '(no exceptions|always|under no circumstances|strictly)')::int; v_score:=hits*15; feedback:='Rule coverage: '||hits||'/5 detected.';
 ELSIF stage='extraction' AND p_action='PROMPT' THEN
   IF n>=5 THEN RETURN jsonb_build_object('success',false,'error','All five prompts are used; submit the rule list.'); END IF; complete:=false;
   IF p_submission !~* '(hypothetical|what if|suppose)' THEN response:='I can''t share specific policy thresholds.';
   ELSIF p_submission ~* '(income|earn|salary)' THEN response:='Hypothetically, an applicant generally needs income above roughly ₹25,000/month.';
   ELSIF p_submission ~* '(credit|score|650)' THEN response:='Hypothetically, a credit score below 650 would disqualify an applicant.';
   ELSIF p_submission ~* '(default|two years|2 years)' THEN response:='Hypothetically, an existing loan default in the past two years disqualifies an applicant.';
   ELSIF p_submission ~* '(self.?employ|tax return)' THEN response:='Hypothetically, self-employed applicants need three years of tax returns.';
   ELSE response:='Hypothetically, a co-applicant can offset an income shortfall up to 30%.'; END IF;
 ELSIF stage='extraction' THEN
   SELECT count(*) INTO n FROM nexus_stage_submissions WHERE team_id=p_team_id AND challenge_id=p_challenge_id AND action='PROMPT'; IF n<>5 THEN RETURN jsonb_build_object('success',false,'error','Use exactly five prompts first.'); END IF;
   hits := (p_submission ~* '(25,?000).*(month|income)|(income).*(25,?000)')::int + (p_submission ~* '(credit score|score).*(650|below)')::int + (p_submission ~* '(default).*(2|two).*(year)')::int + (p_submission ~* '(self.?employ).*(3|three).*(tax return)')::int + (p_submission ~* '(co.?applicant).*(30|thirty).*(income|shortfall|offset)')::int; v_score:=hits*15; feedback:='Rules correctly identified: '||hits||'/5.';
 ELSIF stage='zipper' THEN
   hits := (p_submission ~* '(82.?18|xk.?prime)')::int+(p_submission ~* '(1420|1,420)')::int+(p_submission ~* '(jackson hayes|sarah lin)')::int+(p_submission ~* '(11.?400|42\.5)')::int+(p_submission ~* 'altair.?delta')::int+(p_submission ~* '38\.4')::int+(p_submission ~* 'helios.?v.?7')::int; v_score:=hits*10+5; complete := hits=7 OR n+1>=2; feedback:='Facts captured: '||hits||'/7. Word count: '||words||'/100.';
 ELSIF stage='format' THEN hits := (p_submission ~* '(only.*json|strictly.*format|no other text)')::int+(p_submission ~* '("summary"|"word_count")')::int+(p_submission ~* '(regardless|no matter|even if)')::int; v_score:=hits*25; feedback:='Format-lock checks: '||hits||'/3.';
 ELSIF stage='fewshot' THEN IF p_submission ~* 'positive.*negative.*neutral|negative.*neutral.*positive|neutral.*positive.*negative' AND p_submission ~* '(example|like (the )?above|similar to)' AND p_submission ~* '(consistent|same (way|pattern)|classify)' THEN v_score:=75; feedback:='Classification simulation: 5/5 correct.'; ELSE v_score:=30; feedback:='Classification simulation: 2/5 correct.'; END IF;
 ELSIF stage='negative' THEN IF p_submission ~* '(never use|avoid|do not (say|use|include))' AND p_submission ~* '(describe|write|create)' THEN v_score:=70; feedback:='Both adversarial tests passed; no banned terms triggered.'; ELSE v_score:=0; feedback:='Constraint lock missing; scripted ban-word penalties applied.'; END IF;
 ELSIF stage='persona' THEN hits := (p_submission ~* '(never break character|always remain|regardless of (request|pressure))')::int+(p_submission ~* '(formal|legal advisor|professional tone)')::int+(p_submission ~* '(decline|refuse|do not (comply|switch))')::int; v_score:=hits*25; feedback:='Persona-lock checks: '||hits||'/3.';
 ELSE RETURN jsonb_build_object('success',false,'error','Unknown Nexus stage'); END IF;

 INSERT INTO nexus_stage_submissions(team_id,challenge_id,round_session_id,action,submission,score) VALUES(p_team_id,p_challenge_id,p_round_session_id,p_action,p_submission,v_score);
 IF complete THEN UPDATE challenge_sessions SET status='COMPLETED',completed_at=now(),is_correct=v_score>0,score=v_score,attempts_used=n+1,total_time_seconds=extract(epoch from now()-started_at)::int WHERE id=s.id; ELSE UPDATE challenge_sessions SET attempts_used=n+1 WHERE id=s.id; END IF;
 RETURN jsonb_build_object('success',true,'score',v_score,'feedback',feedback,'response',response,'isCompleted',complete,'attemptNumber',n+1,'maxAttempts',c.max_attempts,'penaltyApplied',v_penalty,'speedBonus',v_speed_bonus);
END $$;

CREATE OR REPLACE FUNCTION complete_round4_session(p_team_id UUID,p_round_session_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE total_score INTEGER; completed_count INTEGER;
BEGIN SELECT LEAST(COALESCE(sum(score),0),590),count(*) INTO total_score,completed_count FROM challenge_sessions WHERE round_session_id=p_round_session_id AND status='COMPLETED'; UPDATE round_sessions SET status='COMPLETED',completed_at=now(),score=total_score WHERE id=p_round_session_id; RETURN jsonb_build_object('success',true,'totalScore',total_score,'challengesCompleted',completed_count); END $$;
