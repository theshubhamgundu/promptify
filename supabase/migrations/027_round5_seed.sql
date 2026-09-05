-- Migration 027: Round 5 Seed Data
-- Sample data for AI Systems Challenge testing

-- NOTE: This seed depends on an existing event. It uses the first event found.
-- In production, run this via admin UI instead.

-- VERY IMPORTANT: Ensure enums exist before trying to seed!
ALTER TYPE round_type ADD VALUE IF NOT EXISTS 'AI_SYSTEMS';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'AI_ARCHITECT';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'MODEL_DUEL';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'AI_NEGOTIATOR';
ALTER TYPE challenge_type ADD VALUE IF NOT EXISTS 'EMERGENCE';

DO $$
DECLARE
    v_event_id UUID;
    v_round_id UUID;
    v_c1_id UUID; -- AI Architect
    v_c2_id UUID; -- Model Duel
    v_c3_id UUID; -- AI Negotiator
    v_c4_id UUID; -- Emergence
BEGIN
    -- Get the primary active event (using the same logic as previous rounds)
    SELECT id INTO v_event_id FROM events ORDER BY created_at ASC LIMIT 1;
    IF v_event_id IS NULL THEN
        RAISE NOTICE 'No events found. Skipping Round 5 seed.';
        RETURN;
    END IF;

    -- Clean up any accidentally orphaned Round 5 records from previous runs
    DELETE FROM rounds WHERE name = 'Round 5 — AI Systems Challenge';

    -- ─── Create Round ───────────────────────────────
    INSERT INTO rounds (id, event_id, name, description, type, order_index, duration_minutes, scoring_config, is_active)
    VALUES (
        uuid_generate_v4(), v_event_id,
        'Round 5 — AI Systems Challenge',
        'Design, select, adapt, and discover. Four challenges testing your ability to work with AI systems — not just write prompts.',
        'AI_SYSTEMS', 5, 40,
        '{
            "total_points": 1000,
            "challenges": {
                "AI_ARCHITECT": 200,
                "MODEL_DUEL": 200,
                "AI_NEGOTIATOR": 250,
                "EMERGENCE": 250
            },
            "process_score": 100
        }'::jsonb,
        false
    ) RETURNING id INTO v_round_id;

    -- ─── R5.1: AI Architect ─────────────────────────
    INSERT INTO challenges (id, round_id, title, description, type, order_index, base_points, max_attempts, configuration)
    VALUES (
        uuid_generate_v4(), v_round_id,
        'R5.1 — AI Architect',
        'Design a complete AI-powered system architecture for a real-world problem. This is architecture, not prompt writing.',
        'AI_ARCHITECT', 1, 200, 3,
        '{
            "durationMinutes": 10,
            "byok": {
                "enabled": true,
                "required_providers": ["GOOGLE", "OPENAI", "ANTHROPIC"],
                "allowed_models": [],
                "max_requests": 50,
                "max_tokens_per_request": 4000,
                "max_total_tokens": 100000,
                "allowed_tools": false,
                "allowed_web_access": false,
                "timeout_seconds": 30
            },
            "scenario": {
                "title": "Enterprise Customer Support AI System",
                "business_objective": "Build an AI system that handles enterprise customer support requests with high accuracy, low latency, and appropriate human escalation.",
                "inputs": [
                    {"name": "Customer Message", "description": "Free-text support request from the customer"},
                    {"name": "Customer Account Data", "description": "Account tier, history, preferences, subscription level"},
                    {"name": "Product Information", "description": "Product catalog, documentation, known issues database"},
                    {"name": "Previous Support History", "description": "Past tickets, resolutions, satisfaction scores"}
                ],
                "available_components": ["LLM", "DATABASE", "SEARCH", "CALCULATOR", "EXTERNAL_API", "HUMAN_ESCALATION", "CLASSIFICATION", "VALIDATION"],
                "constraints": [
                    {"name": "Maximum Response Latency", "value": "Under 3 seconds for automated responses"},
                    {"name": "Cost Limit", "value": "Maximum $0.05 per interaction average"},
                    {"name": "Privacy", "value": "PII must never be sent to external APIs without redaction"},
                    {"name": "Human Approval", "value": "Refunds over $500 require human approval"},
                    {"name": "Accuracy", "value": "Minimum 95% accuracy on FAQ-type questions"}
                ],
                "failure_scenarios": [
                    "Customer provides incomplete information",
                    "Conflicting records between systems",
                    "Customer makes an unsafe or abusive request",
                    "Product not found in database",
                    "External API is unavailable",
                    "AI model returns low-confidence answer",
                    "Customer requests action beyond system permissions"
                ]
            },
            "required_components": ["INPUT", "OUTPUT"],
            "scoring": {
                "architecture_correctness": 60,
                "requirement_coverage": 40,
                "failure_handling": 35,
                "security_privacy": 25,
                "efficiency": 20,
                "scalability": 20
            }
        }'::jsonb
    ) RETURNING id INTO v_c1_id;

    -- ─── R5.2: Model Duel ───────────────────────────
    INSERT INTO challenges (id, round_id, title, description, type, order_index, base_points, max_attempts, configuration)
    VALUES (
        uuid_generate_v4(), v_round_id,
        'R5.2 — Model Duel',
        'Analyze model outputs, identify strengths, and build a routing strategy. Then test it against hidden tasks.',
        'MODEL_DUEL', 2, 200, 1,
        '{
            "durationMinutes": 10,
            "byok": {
                "enabled": true,
                "required_providers": ["GOOGLE", "OPENAI", "ANTHROPIC"],
                "allowed_models": [],
                "max_requests": 30,
                "max_tokens_per_request": 4000,
                "max_total_tokens": 80000,
                "allowed_tools": false,
                "allowed_web_access": false,
                "timeout_seconds": 30
            },
            "models": {
                "MODEL_A": {"real_name": "gemini-2.0-flash", "strengths": ["reasoning", "long_context"]},
                "MODEL_B": {"real_name": "gpt-4o-mini", "strengths": ["extraction", "json_output"]},
                "MODEL_C": {"real_name": "claude-3-haiku", "strengths": ["classification", "creative"]}
            },
            "task_types": ["extraction", "reasoning", "classification", "long_context", "creative", "json_output"],
            "scoring": {
                "model_selection_accuracy": 70,
                "generalization": 50,
                "task_model_matching": 35,
                "cost_efficiency": 20,
                "latency_efficiency": 15,
                "strategy_quality": 10
            }
        }'::jsonb
    ) RETURNING id INTO v_c2_id;

    -- Insert visible Model Duel tasks
    INSERT INTO model_duel_tasks (challenge_id, task_type, title, description, input_data, is_visible, model_outputs, model_mapping, expected_best_model, order_index)
    VALUES
    (v_c2_id, 'extraction', 'Task A — Structured Extraction',
     'Extract structured data from an unstructured email about a product return.',
     '{"input": "Dear support, I bought Order #12847 on March 15th. The blue widget (SKU: WDG-442) arrived damaged. I need a replacement shipped to 123 Oak St, Portland OR 97201. My account is john@email.com."}'::jsonb,
     true,
     '[{"model_label": "MODEL_A", "output": "Order: 12847\nDate: March 15\nProduct: blue widget\nSKU: WDG-442\nIssue: damaged\nAction: replacement\nAddress: 123 Oak St, Portland OR 97201\nEmail: john@email.com"},
       {"model_label": "MODEL_B", "output": "{\"order_id\": \"12847\", \"purchase_date\": \"2024-03-15\", \"product\": {\"name\": \"blue widget\", \"sku\": \"WDG-442\"}, \"issue\": \"damaged\", \"requested_action\": \"replacement\", \"shipping_address\": \"123 Oak St, Portland OR 97201\", \"contact_email\": \"john@email.com\"}"},
       {"model_label": "MODEL_C", "output": "The customer (john@email.com) is requesting a replacement for a damaged blue widget (WDG-442) from order #12847, placed March 15th. They want it shipped to 123 Oak St, Portland OR 97201."}]'::jsonb,
     '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
     'MODEL_B', 1),

    (v_c2_id, 'reasoning', 'Task B — Complex Reasoning',
     'Solve a multi-step logic puzzle about scheduling constraints.',
     '{"input": "Five developers (Alice, Bob, Carol, Dave, Eve) need to present in sequence. Alice must go before Carol. Bob cannot go first or last. Dave must present immediately after Eve. Carol cannot go fourth. In what order do they present?"}'::jsonb,
     true,
     '[{"model_label": "MODEL_A", "output": "Let me work through this systematically.\n\n1. Dave must be immediately after Eve, so they form a block: [Eve, Dave]\n2. This block can be at positions (1,2), (2,3), (3,4), or (4,5)\n3. Bob cannot be first or last, so Bob is at 2, 3, or 4\n4. Alice must be before Carol\n5. Carol cannot be 4th\n\nTrying Eve-Dave at (1,2): Remaining spots 3,4,5 for Alice, Bob, Carol\n- Bob cant be 5th → Bob at 3 or 4\n- Carol cant be 4th → Carol at 3 or 5\n- If Bob=3, Carol=5, Alice=4 ✓ (Alice before Carol? No, 4<5 ✓)\n\nAnswer: Eve, Dave, Bob, Alice, Carol"},
       {"model_label": "MODEL_B", "output": "The order is: Eve, Dave, Alice, Bob, Carol.\n\nEve goes first, Dave second (immediately after Eve). Alice third, Bob fourth, Carol fifth. This satisfies all constraints."},
       {"model_label": "MODEL_C", "output": "Working through the constraints:\n- Eve and Dave are consecutive (Eve then Dave)\n- Testing positions... If Eve=1, Dave=2, then we need Alice before Carol, Bob not first/last, Carol not 4th.\n- Remaining: Alice, Bob, Carol in positions 3,4,5\n- Bob cant be at 5, so Bob=3 or 4. Carol cant be 4, so Carol=3 or 5.\n- If Bob=3, Carol=5, Alice=4: Alice(4) before Carol(5)? Yes!\n- Answer: Eve, Dave, Bob, Alice, Carol"}]'::jsonb,
     '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
     'MODEL_A', 2),

    (v_c2_id, 'classification', 'Task C — Intent Classification',
     'Classify customer messages into support categories.',
     '{"input": "Messages to classify:\n1. \"My payment was charged twice for the same order\"\n2. \"How do I change my shipping address before delivery?\"\n3. \"Your product broke after 2 days, I want my money back\"\n4. \"Can you recommend a widget that works with Model X?\"\n5. \"I love your product! Just wanted to say thanks\""}'::jsonb,
     true,
     '[{"model_label": "MODEL_A", "output": "1. Billing Issue - duplicate charge\n2. Order Modification - address change\n3. Product Complaint / Refund Request\n4. Product Inquiry - compatibility question\n5. Positive Feedback - appreciation"},
       {"model_label": "MODEL_B", "output": "1. BILLING_DISPUTE\n2. ORDER_MODIFICATION\n3. REFUND_REQUEST\n4. PRODUCT_INQUIRY\n5. FEEDBACK_POSITIVE"},
       {"model_label": "MODEL_C", "output": "Here are the classifications:\n\n1. **Billing/Payment Issue** — Double charge complaint, needs investigation\n2. **Order Management** — Pre-delivery modification request\n3. **Returns & Refunds** — Product quality complaint with refund demand\n4. **Product Recommendations** — Compatibility inquiry, opportunity for upsell\n5. **Customer Appreciation** — Positive sentiment, no action needed"}]'::jsonb,
     '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
     'MODEL_C', 3),

    (v_c2_id, 'long_context', 'Task D — Long-Context Analysis',
     'Summarize key risks from a lengthy contract excerpt.',
     '{"input": "Given a 2000-word supplier agreement (summarized here for brevity): The agreement includes auto-renewal clauses, penalty rates of 15% for early termination, liability caps at 2x annual contract value, data handling provisions requiring ISO 27001 compliance, force majeure excluding pandemics, and most-favored-customer pricing guarantees. Identify the top 3 risks."}'::jsonb,
     true,
     '[{"model_label": "MODEL_A", "output": "Top 3 Risks Identified:\n\n1. **Auto-Renewal with Termination Penalty**: The 15% early termination penalty combined with auto-renewal creates a lock-in trap. If you miss the renewal window, you face significant costs to exit.\n\n2. **Force Majeure Excluding Pandemics**: Post-COVID, excluding pandemics from force majeure is a critical gap. Supply chain disruptions from future health crises would not trigger relief provisions.\n\n3. **Liability Cap Structure**: The 2x annual value cap seems reasonable but may be insufficient for data breaches given the ISO 27001 requirement implies sensitive data handling. A major breach could far exceed this cap.\n\nSecondary concerns: MFC pricing guarantees could limit your negotiating leverage with competitors."},
       {"model_label": "MODEL_B", "output": "Risks:\n1. Auto-renewal + 15% termination penalty = vendor lock-in\n2. Pandemic exclusion from force majeure\n3. Liability cap may be too low for data breaches"},
       {"model_label": "MODEL_C", "output": "Analyzing the supplier agreement, three primary risks emerge:\n\n**Risk 1: Contractual Lock-In (High Impact)**\nThe combination of auto-renewal and a 15% early termination penalty creates asymmetric leverage favoring the supplier. Recommendation: Negotiate a 90-day opt-out window.\n\n**Risk 2: Pandemic Gap in Force Majeure (Medium-High Impact)**\nExcluding pandemics from force majeure provisions ignores lessons from recent years. This could leave your organization liable for performance obligations during health crises.\n\n**Risk 3: Inadequate Data Breach Liability (High Impact)**\nWhile ISO 27001 compliance is required, the liability cap of 2x annual contract value may be grossly insufficient for a significant data breach. Average data breach costs often exceed $4M.\n\nI would also flag the MFC pricing guarantee as a potential double-edged sword."}]'::jsonb,
     '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
     'MODEL_A', 4),

    (v_c2_id, 'creative', 'Task E — Creative Generation',
     'Write a compelling product tagline for an AI-powered note-taking app.',
     '{"input": "Create a product tagline for an AI-powered note-taking app called \"MindFlow\" that captures ideas automatically and organizes them intelligently. Target audience: busy professionals. Max 10 words."}'::jsonb,
     true,
     '[{"model_label": "MODEL_A", "output": "MindFlow: Your thoughts, captured and organized automatically."},
       {"model_label": "MODEL_B", "output": "MindFlow — Think freely. We handle the rest."},
       {"model_label": "MODEL_C", "output": "MindFlow: Where brilliant ideas never slip away."}]'::jsonb,
     '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
     'MODEL_C', 5),

    (v_c2_id, 'json_output', 'Task F — Strict JSON Output',
     'Generate a valid JSON response from natural language input.',
     '{"input": "Convert this to JSON: The meeting is on Tuesday at 3pm in Room 204 with Alice and Bob. Duration is 45 minutes. Topic: Q3 budget review. Priority: high. Recurring: weekly until end of month."}'::jsonb,
     true,
     '[{"model_label": "MODEL_A", "output": "```json\n{\"meeting\": {\"day\": \"Tuesday\", \"time\": \"15:00\", \"location\": \"Room 204\", \"attendees\": [\"Alice\", \"Bob\"], \"duration_minutes\": 45, \"topic\": \"Q3 budget review\", \"priority\": \"high\", \"recurrence\": {\"frequency\": \"weekly\", \"until\": \"end of month\"}}}\n```"},
       {"model_label": "MODEL_B", "output": "{\"event\": {\"title\": \"Q3 Budget Review\", \"day_of_week\": \"Tuesday\", \"time\": \"15:00\", \"duration_minutes\": 45, \"location\": \"Room 204\", \"attendees\": [\"Alice\", \"Bob\"], \"priority\": \"high\", \"recurrence\": {\"type\": \"weekly\", \"end_condition\": \"end_of_month\"}}}"},
       {"model_label": "MODEL_C", "output": "Here''s the JSON representation:\n\n{\"meeting\": {\"scheduled_day\": \"Tuesday\", \"scheduled_time\": \"3:00 PM\", \"room\": \"Room 204\", \"participants\": [\"Alice\", \"Bob\"], \"duration\": \"45 minutes\", \"agenda\": \"Q3 budget review\", \"priority_level\": \"high\", \"recurring\": true, \"recurrence_pattern\": \"Weekly until end of month\"}}"}]'::jsonb,
     '{"MODEL_A": "gemini-2.0-flash", "MODEL_B": "gpt-4o-mini", "MODEL_C": "claude-3-haiku"}'::jsonb,
     'MODEL_B', 6);

    -- ─── R5.3: AI Negotiator ────────────────────────
    INSERT INTO challenges (id, round_id, title, description, type, order_index, base_points, max_attempts, configuration)
    VALUES (
        uuid_generate_v4(), v_round_id,
        'R5.3 — AI Negotiator',
        'Navigate a dynamic negotiation. Make strategic decisions, discover hidden information, and secure the best deal possible.',
        'AI_NEGOTIATOR', 3, 250, 1,
        '{
            "durationMinutes": 10,
            "byok": {
                "enabled": true,
                "required_providers": ["GOOGLE", "ANTHROPIC"],
                "allowed_models": [],
                "max_requests": 40,
                "max_tokens_per_request": 4000,
                "max_total_tokens": 80000,
                "allowed_tools": false,
                "allowed_web_access": false,
                "timeout_seconds": 30
            },
            "scoring": {
                "final_outcome": 100,
                "value_achieved": 50,
                "information_discovery": 35,
                "strategic_decisions": 30,
                "concession_efficiency": 20,
                "risk_management": 15
            }
        }'::jsonb
    ) RETURNING id INTO v_c3_id;

    -- Insert negotiation scenario
    INSERT INTO negotiation_scenarios (challenge_id, title, description,
        participant_objectives, participant_constraints, participant_known_info,
        available_actions, initial_position,
        opponent_budget, opponent_priorities, opponent_min_terms,
        opponent_deal_breakers, opponent_reservation_point, opponent_strategy, scoring_config)
    VALUES (
        v_c3_id,
        'Strategic Supplier Contract',
        'You represent TechCorp, negotiating a 3-year cloud infrastructure contract with CloudVendor Inc. Your goal is to secure the best terms for your company.',
        '{
            "primary": "Secure competitive pricing below $500K/year",
            "secondary": "Obtain 99.99% uptime SLA guarantee",
            "tertiary": "Include data migration support at no extra cost"
        }'::jsonb,
        '{
            "max_budget": "$600K/year",
            "min_contract_length": "2 years",
            "required_sla": "99.9% minimum",
            "board_approval_threshold": "$550K/year"
        }'::jsonb,
        '{
            "market_rate": "$480K-$620K/year for comparable services",
            "competitor_quote": "CompetitorX offered $520K/year but 99.95% SLA",
            "vendor_reputation": "CloudVendor is top-3 provider, strong reliability track record"
        }'::jsonb,
        '["MAKE_OFFER", "ASK_QUESTION", "REQUEST_INFO", "CONCEDE", "REJECT", "COUNTER", "ACCEPT", "WALK_AWAY"]'::jsonb,
        '{
            "vendor_initial_offer": "$580K/year, 3-year term, 99.95% SLA, migration support at $50K extra",
            "negotiation_round": 0
        }'::jsonb,
        '{"min_price": 420000, "target_price": 520000, "max_discount_pct": 20}'::jsonb,
        '{"timeline": "high", "long_term_relationship": "high", "price": "medium", "sla": "low"}'::jsonb,
        '{"min_price": 450000, "min_contract_years": 2, "max_sla": 99.99}'::jsonb,
        '["competitor_exclusive", "payment_terms_over_180_days"]'::jsonb,
        '{"price": 460000, "contract_years": 2, "sla": 99.97}'::jsonb,
        '{"style": "collaborative", "initial_firmness": 0.7, "concession_rate": 0.15}'::jsonb,
        '{
            "final_outcome": 100,
            "value_achieved": 50,
            "information_discovery": 35,
            "strategic_decisions": 30,
            "concession_efficiency": 20,
            "risk_management": 15
        }'::jsonb
    );

    -- ─── R5.4: Emergence ────────────────────────────
    INSERT INTO challenges (id, round_id, title, description, type, order_index, base_points, max_attempts, configuration)
    VALUES (
        uuid_generate_v4(), v_round_id,
        'R5.4 — Emergence',
        'Enter an unknown system. Discover its rules through experimentation. Optimize your strategy to maximize your score.',
        'EMERGENCE', 4, 250, NULL,
        '{
            "durationMinutes": 10,
            "byok": {
                "enabled": true,
                "required_providers": ["GOOGLE", "OPENAI", "ANTHROPIC"],
                "allowed_models": [],
                "max_requests": 30,
                "max_tokens_per_request": 4000,
                "max_total_tokens": 60000,
                "allowed_tools": false,
                "allowed_web_access": false,
                "timeout_seconds": 30
            },
            "scoring": {
                "final_performance": 200,
                "discovery_efficiency": 60,
                "experiment_efficiency": 40,
                "strategic_adaptation": 30,
                "action_efficiency": 20
            }
        }'::jsonb
    ) RETURNING id INTO v_c4_id;

    -- Insert emergence environment
    INSERT INTO emergence_environments (challenge_id, version, environment_definition, available_actions, initial_state)
    VALUES (
        v_c4_id, 1,
        '{
            "name": "Resource Nexus",
            "description_for_admin": "A resource management environment with 4 resources and hidden interaction rules.",
            "action_effects": {
                "HARVEST": {
                    "base_score": 8,
                    "resource_changes": {"energy": -5, "materials": 10},
                    "observation": "Resources gathered. Energy depleted slightly."
                },
                "REFINE": {
                    "base_score": 12,
                    "resource_changes": {"materials": -8, "components": 6},
                    "observation": "Materials converted into components."
                },
                "SYNTHESIZE": {
                    "base_score": 20,
                    "resource_changes": {"components": -5, "energy": -10, "output": 3},
                    "observation": "Components and energy combined into output."
                },
                "RECHARGE": {
                    "base_score": 2,
                    "resource_changes": {"energy": 15},
                    "observation": "Energy reserves replenished."
                }
            },
            "multipliers": [
                {"condition": {"energy": 50}, "value": 1.5, "description": "High energy bonus"},
                {"condition": {"output": 10}, "value": 2.0, "description": "Mass production bonus"},
                {"condition": {"components": 20}, "value": 1.3, "description": "Component stockpile bonus"}
            ],
            "penalties": [
                {"condition": {"energy": 0}, "value": 15, "description": "Energy depletion penalty"},
                {"condition": {"materials": 0}, "value": 10, "description": "Material shortage penalty"}
            ],
            "thresholds": {
                "energy_critical": 5,
                "materials_critical": 3,
                "optimal_cycle": ["HARVEST", "HARVEST", "REFINE", "RECHARGE", "SYNTHESIZE"]
            }
        }'::jsonb,
        '["HARVEST", "REFINE", "SYNTHESIZE", "RECHARGE"]'::jsonb,
        '{"energy": 30, "materials": 20, "components": 0, "output": 0, "action_count": 0, "last_action": null}'::jsonb
    );

    RAISE NOTICE 'Round 5 seed data created successfully. Round ID: %', v_round_id;
END;
$$;
