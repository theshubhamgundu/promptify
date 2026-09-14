-- Round 5: Apex — domain-assigned deterministic question bank.
-- Q2 ground truth intentionally remains configuration-driven: select the final
-- public dataset first, compute its values once, then fill each challenge's
-- configuration.q2GroundTruth before the event.

CREATE TABLE IF NOT EXISTS team_round5_domains (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('Healthcare','Fintech','Agriculture','Education','E-commerce','Logistics')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, round_id)
);

CREATE OR REPLACE FUNCTION assign_round5_domain(p_team_id UUID, p_round_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_domain TEXT;
BEGIN
  SELECT domain INTO v_domain FROM team_round5_domains WHERE team_id = p_team_id AND round_id = p_round_id;
  IF v_domain IS NOT NULL THEN RETURN v_domain; END IF;
  v_domain := (ARRAY['Healthcare','Fintech','Agriculture','Education','E-commerce','Logistics'])[1 + mod(abs(hashtext(p_team_id::text)), 6)];
  INSERT INTO team_round5_domains(team_id, round_id, domain) VALUES (p_team_id, p_round_id, v_domain);
  RETURN v_domain;
END $$;

-- Replace only the active Stage 5 question definitions. Existing sessions are
-- preserved; run this before participants begin the revised round.
DO $$
DECLARE v_round UUID;
BEGIN
  SELECT id INTO v_round FROM rounds WHERE order_index = 5 ORDER BY created_at DESC LIMIT 1;
  IF v_round IS NULL THEN RETURN; END IF;
  DELETE FROM challenges WHERE round_id = v_round;
  UPDATE rounds SET name = 'Stage 5: Apex', description = 'Domain-specific build, data analysis, and full-stack delivery.', type = 'AI_GRANDMASTER', duration_minutes = 40, scoring_config = '{"totalPoints":300,"questions":3}'::jsonb WHERE id = v_round;
  INSERT INTO challenges(round_id,title,description,type,order_index,base_points,max_attempts,configuration) VALUES
    (v_round, 'Q1 — Domain Registration Form', 'Create and submit one self-contained HTML registration form.', 'CODE_INPUT', 1, 100, 1, '{"durationMinutes":10,"questionKind":"REGISTRATION_FORM"}'::jsonb),
    (v_round, 'Q2 — Large Dataset Drip Analysis', 'Use Colab and pandas to answer four chained dataset questions.', 'TEXT_INPUT', 2, 100, 1, '{"durationMinutes":10,"questionKind":"DATASET_DRIP","datasets":{"Fintech":{"name":"Credit Card Fraud Detection","url":"https://www.kaggle.com/mlg-ulb/creditcardfraud","numericColumn":"CONFIGURE BEFORE EVENT","categoryColumn":"CONFIGURE BEFORE EVENT"},"Logistics":{"name":"NYC Yellow Taxi Trip Records","url":"https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page","numericColumn":"CONFIGURE BEFORE EVENT","categoryColumn":"CONFIGURE BEFORE EVENT"},"E-commerce":{"name":"Brazilian E-Commerce (Olist)","url":"https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce","numericColumn":"CONFIGURE BEFORE EVENT","categoryColumn":"CONFIGURE BEFORE EVENT"},"Education":{"name":"Student Performance Factors","url":"https://www.kaggle.com/datasets/rutaba393/student-performance-dataset","numericColumn":"CONFIGURE BEFORE EVENT","categoryColumn":"CONFIGURE BEFORE EVENT"},"Healthcare":{"name":"Diabetes 130-US Hospitals","url":"https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008","numericColumn":"CONFIGURE BEFORE EVENT","categoryColumn":"CONFIGURE BEFORE EVENT"},"Agriculture":{"name":"CONFIGURE AFTER MANUAL DATASET VERIFICATION","url":"","numericColumn":"CONFIGURE BEFORE EVENT","categoryColumn":"CONFIGURE BEFORE EVENT"}},"q2GroundTruth":{}}'::jsonb),
    (v_round, 'Q3 — Full MERN Domain App', 'Submit a public repository, deployment URL, and complete AI prompt sheet.', 'FILE_UPLOAD', 3, 100, 1, '{"durationMinutes":20,"questionKind":"MERN_APP"}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION submit_apex_answer(
  p_team_id UUID, p_round_session_id UUID, p_challenge_id UUID, p_payload JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  c challenges; raw_score NUMERIC := 0; html TEXT := COALESCE(p_payload->>'html','');
  d TEXT; expected JSONB; answers JSONB; n INTEGER; feedback JSONB := '[]'::jsonb; status submission_status := 'EVALUATED'; v_score INTEGER := 0;
BEGIN
  SELECT * INTO c FROM challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND OR c.round_id <> (SELECT round_id FROM round_sessions WHERE id = p_round_session_id AND team_id = p_team_id) THEN RAISE EXCEPTION 'Invalid Apex session or challenge'; END IF;
  IF EXISTS (SELECT 1 FROM submissions WHERE team_id=p_team_id AND round_session_id=p_round_session_id AND challenge_id=p_challenge_id) THEN RAISE EXCEPTION 'This question has already been submitted'; END IF;
  d := assign_round5_domain(p_team_id, c.round_id);

  IF c.configuration->>'questionKind' = 'REGISTRATION_FORM' THEN
    IF html ~* '<label[^>]*for=' THEN raw_score := raw_score + 8; feedback := feedback || jsonb_build_array(jsonb_build_object('label','proper label-input linking','passed',true)); END IF;
    IF html ~* '(maxlength|pattern=)' THEN raw_score := raw_score + 8; END IF;
    IF html ~* '<meta[^>]*viewport' THEN raw_score := raw_score + 6; END IF;
    IF html ~* 'type=["'']email["'']' THEN raw_score := raw_score + 6; END IF;
    IF html ~* 'required' THEN raw_score := raw_score + 8; END IF;
    IF html ~* '(<button[^>]*disabled|loading)' THEN raw_score := raw_score + 6; END IF;
    IF (d='Healthcare' AND html ~* '(medical.{0,20}license|license.{0,20}number)') OR (d='Fintech' AND html ~* '\mPAN\M') OR (d='Agriculture' AND html ~* 'land.{0,20}(holding|size)') OR (d='Education' AND html ~* 'previous.{0,20}institution') OR (d='E-commerce' AND html ~* '\mGST\M') OR (d='Logistics' AND html ~* 'vehicle.{0,20}type') THEN raw_score := raw_score + 10; END IF;
    IF (d='Healthcare' AND html ~* 'speciali[sz]ation') OR (d='Fintech' AND html ~* 'risk.{0,20}profile') OR (d='Agriculture' AND html ~* 'crop.{0,20}type') OR (d='Education' AND html ~* '(course|stream)') OR (d='E-commerce' AND html ~* 'business.{0,20}category') OR (d='Logistics' AND html ~* 'license.{0,20}class') THEN raw_score := raw_score + 10; END IF;
    IF (d='Healthcare' AND html ~* 'years?.{0,20}(experience|exp)') OR (d='Fintech' AND html ~* '(KYC|document.{0,20}upload)') OR (d='Agriculture' AND html ~* 'irrigation') OR (d='Education' AND html ~* '(entrance.{0,20}exam|exam.{0,20}score)') OR (d='E-commerce' AND html ~* 'warehouse.{0,20}location') OR (d='Logistics' AND html ~* 'route.{0,20}(zone|preference)') THEN raw_score := raw_score + 10; END IF;
    v_score := round(raw_score * 100 / 72.0);
  ELSIF c.configuration->>'questionKind' = 'DATASET_DRIP' THEN
    expected := (c.configuration->'q2GroundTruth')->d; answers := p_payload->'answers';
    IF expected IS NULL OR expected = 'null'::jsonb THEN RAISE EXCEPTION 'Q2 ground truth has not been configured by an administrator'; END IF;
    FOR n IN 0..3 LOOP
      IF (expected->>n) ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        IF abs((answers->>n)::numeric - (expected->>n)::numeric) <= greatest(abs((expected->>n)::numeric) * .01, .5) THEN v_score := v_score + 25; END IF;
      ELSIF lower(trim(COALESCE(answers->>n,''))) = lower(trim(expected->>n)) THEN v_score := v_score + 25; END IF;
    END LOOP;
  ELSE
    -- Q3 is recorded now and scored by the deterministic Playwright/GitHub worker.
    status := 'EVALUATING'; v_score := 0;
  END IF;
  INSERT INTO submissions(team_id,challenge_id,round_session_id,content,attempt_number,status,score,evaluation_result,submitted_at)
  VALUES(p_team_id,p_challenge_id,p_round_session_id,p_payload::text,1,status,v_score,jsonb_build_object('domain',d,'score',v_score,'feedback',feedback),now());
  IF status = 'EVALUATED' THEN UPDATE round_sessions AS rs SET score = rs.score + v_score WHERE rs.id = p_round_session_id; END IF;
  RETURN jsonb_build_object('score',v_score,'status',status,'domain',d,'feedback',feedback);
END $$;
