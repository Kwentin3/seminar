ALTER TABLE llm_simplify_settings
ADD COLUMN request_timeout_ms INTEGER NOT NULL DEFAULT 75000;

ALTER TABLE llm_simplify_settings
ADD COLUMN max_source_chars INTEGER NOT NULL DEFAULT 20000;

ALTER TABLE llm_simplify_settings
ADD COLUMN oversized_behavior TEXT NOT NULL DEFAULT 'block'
  CHECK (oversized_behavior IN ('block', 'allow_with_warning'));
