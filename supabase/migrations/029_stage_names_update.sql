-- Migration 029: Update Stage / Round Names
-- Updates round names to simple, professional Stage names

UPDATE rounds 
SET name = 'Stage 1: Genesis',
    description = 'Foundation knowledge and precision AI reasoning assessment.'
WHERE order_index = 1;

UPDATE rounds 
SET name = 'Stage 2: Node',
    description = 'Algorithmic prompt engineering and semantic constraint optimization.'
WHERE order_index = 2;

UPDATE rounds 
SET name = 'Stage 3: Vertex',
    description = 'Multi-modal perception, visual spatial decoding, and visual synthesis.'
WHERE order_index = 3;

UPDATE rounds 
SET name = 'Stage 4: Matrix',
    description = 'Adversarial defense, prompt injection resilience, and logic hardening.'
WHERE order_index = 4;

UPDATE rounds 
SET name = 'Stage 5: Apex',
    description = 'Complex systems engineering, multi-step pipeline orchestration, and emergence synthesis.'
WHERE order_index = 5;
