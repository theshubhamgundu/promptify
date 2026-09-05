-- =====================================================
-- ROUND 5 CHALLENGES SEED — Run AFTER 028_round5_insert_fix.sql
-- =====================================================
-- This inserts the 4 challenges + their data for Round 5.
-- Uses plain SQL (no DO block) to avoid RLS issues.
-- =====================================================

-- Get the round ID we just created
-- We use a CTE so we can reference it in multiple inserts

-- R5.1: AI Architect
INSERT INTO challenges (round_id, title, description, type, order_index, base_points, max_attempts, configuration)
SELECT r.id,
    'R5.1 — AI Architect',
    'Design a complete AI-powered system architecture for a real-world problem.',
    'AI_ARCHITECT'::challenge_type, 1, 200, 3,
    '{"durationMinutes": 10, "byok": {"enabled": true, "required_providers": ["GOOGLE","OPENAI","ANTHROPIC"], "max_requests": 50, "max_tokens_per_request": 4000, "timeout_seconds": 30}, "scenario": {"title": "Enterprise Customer Support AI System", "business_objective": "Build an AI system for enterprise customer support.", "available_components": ["LLM","DATABASE","SEARCH","CALCULATOR","EXTERNAL_API","HUMAN_ESCALATION","CLASSIFICATION","VALIDATION"]}, "scoring": {"architecture_correctness": 60, "requirement_coverage": 40, "failure_handling": 35, "security_privacy": 25, "efficiency": 20, "scalability": 20}}'::jsonb
FROM rounds r WHERE r.name = 'Round 5 — AI Systems Challenge';

-- R5.2: Model Duel
INSERT INTO challenges (round_id, title, description, type, order_index, base_points, max_attempts, configuration)
SELECT r.id,
    'R5.2 — Model Duel',
    'Analyze model outputs, identify strengths, and build a routing strategy.',
    'MODEL_DUEL'::challenge_type, 2, 200, 1,
    '{"durationMinutes": 10, "byok": {"enabled": true, "required_providers": ["GOOGLE","OPENAI","ANTHROPIC"], "max_requests": 30, "timeout_seconds": 30}, "models": {"MODEL_A": {"real_name": "gemini-2.0-flash"}, "MODEL_B": {"real_name": "gpt-4o-mini"}, "MODEL_C": {"real_name": "claude-3-haiku"}}, "scoring": {"model_selection_accuracy": 70, "generalization": 50, "task_model_matching": 35, "cost_efficiency": 20, "latency_efficiency": 15, "strategy_quality": 10}}'::jsonb
FROM rounds r WHERE r.name = 'Round 5 — AI Systems Challenge';

-- R5.3: AI Negotiator
INSERT INTO challenges (round_id, title, description, type, order_index, base_points, max_attempts, configuration)
SELECT r.id,
    'R5.3 — AI Negotiator',
    'Navigate a dynamic negotiation. Make strategic decisions, discover hidden information.',
    'AI_NEGOTIATOR'::challenge_type, 3, 250, 1,
    '{"durationMinutes": 10, "byok": {"enabled": true, "required_providers": ["GOOGLE","ANTHROPIC"], "max_requests": 40, "timeout_seconds": 30}, "scoring": {"final_outcome": 100, "value_achieved": 50, "information_discovery": 35, "strategic_decisions": 30, "concession_efficiency": 20, "risk_management": 15}}'::jsonb
FROM rounds r WHERE r.name = 'Round 5 — AI Systems Challenge';

-- R5.4: Emergence
INSERT INTO challenges (round_id, title, description, type, order_index, base_points, max_attempts, configuration)
SELECT r.id,
    'R5.4 — Emergence',
    'Enter an unknown system. Discover its rules through experimentation. Optimize your score.',
    'EMERGENCE'::challenge_type, 4, 250, NULL,
    '{"durationMinutes": 10, "byok": {"enabled": true, "required_providers": ["GOOGLE","OPENAI","ANTHROPIC"], "max_requests": 30, "timeout_seconds": 30}, "scoring": {"final_performance": 200, "discovery_efficiency": 60, "experiment_efficiency": 40, "strategic_adaptation": 30, "action_efficiency": 20}}'::jsonb
FROM rounds r WHERE r.name = 'Round 5 — AI Systems Challenge';

-- Insert Model Duel visible tasks
INSERT INTO model_duel_tasks (challenge_id, task_type, title, description, input_data, is_visible, model_outputs, model_mapping, expected_best_model, order_index)
SELECT c.id, 'extraction', 'Task A — Structured Extraction',
    'Extract structured data from an unstructured email about a product return.',
    '{"input": "Dear support, I bought Order #12847 on March 15th. The blue widget (SKU: WDG-442) arrived damaged. I need a replacement shipped to 123 Oak St, Portland OR 97201. My account is john@email.com."}'::jsonb,
    true,
    '[{"model_label": "MODEL_A", "output": "Order: 12847\nProduct: blue widget\nSKU: WDG-442\nIssue: damaged"},{"model_label": "MODEL_B", "output": "{\"order_id\": \"12847\", \"product\": {\"name\": \"blue widget\", \"sku\": \"WDG-442\"}, \"issue\": \"damaged\"}"},{"model_label": "MODEL_C", "output": "The customer is requesting a replacement for a damaged blue widget from order #12847."}]'::jsonb,
    '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
    'MODEL_B', 1
FROM challenges c WHERE c.title = 'R5.2 — Model Duel';

-- Insert negotiation scenario
INSERT INTO negotiation_scenarios (challenge_id, title, description,
    participant_objectives, participant_constraints, participant_known_info,
    available_actions, initial_position,
    opponent_budget, opponent_priorities, opponent_min_terms,
    opponent_deal_breakers, opponent_reservation_point, opponent_strategy, scoring_config)
SELECT c.id,
    'Strategic Supplier Contract',
    'You represent TechCorp, negotiating a 3-year cloud infrastructure contract.',
    '{"primary": "Secure competitive pricing below $500K/year", "secondary": "Obtain 99.99% uptime SLA"}'::jsonb,
    '{"max_budget": "$600K/year", "min_contract_length": "2 years", "required_sla": "99.9% minimum"}'::jsonb,
    '{"market_rate": "$480K-$620K/year", "competitor_quote": "CompetitorX offered $520K/year"}'::jsonb,
    '["MAKE_OFFER","ASK_QUESTION","REQUEST_INFO","CONCEDE","REJECT","COUNTER","ACCEPT","WALK_AWAY"]'::jsonb,
    '{"vendor_initial_offer": "$580K/year, 3-year term, 99.95% SLA", "negotiation_round": 0}'::jsonb,
    '{"min_price": 420000, "target_price": 520000, "max_discount_pct": 20}'::jsonb,
    '{"timeline": "high", "long_term_relationship": "high", "price": "medium"}'::jsonb,
    '{"min_price": 450000, "min_contract_years": 2, "max_sla": 99.99}'::jsonb,
    '["competitor_exclusive", "payment_terms_over_180_days"]'::jsonb,
    '{"price": 460000, "contract_years": 2, "sla": 99.97}'::jsonb,
    '{"style": "collaborative", "initial_firmness": 0.7, "concession_rate": 0.15}'::jsonb,
    '{"final_outcome": 100, "value_achieved": 50, "information_discovery": 35}'::jsonb
FROM challenges c WHERE c.title = 'R5.3 — AI Negotiator';

-- Insert emergence environment
INSERT INTO emergence_environments (challenge_id, version, environment_definition, available_actions, initial_state)
SELECT c.id, 1,
    '{"name": "Resource Nexus", "action_effects": {"HARVEST": {"base_score": 8, "resource_changes": {"energy": -5, "materials": 10}}, "REFINE": {"base_score": 12, "resource_changes": {"materials": -8, "components": 6}}, "SYNTHESIZE": {"base_score": 20, "resource_changes": {"components": -5, "energy": -10, "output": 3}}, "RECHARGE": {"base_score": 2, "resource_changes": {"energy": 15}}}}'::jsonb,
    '["HARVEST", "REFINE", "SYNTHESIZE", "RECHARGE"]'::jsonb,
    '{"energy": 30, "materials": 20, "components": 0, "output": 0, "action_count": 0}'::jsonb
FROM challenges c WHERE c.title = 'R5.4 — Emergence';
