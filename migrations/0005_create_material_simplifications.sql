CREATE TABLE IF NOT EXISTS material_simplifications (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  feature_kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_updated_at_snapshot TEXT,
  prompt_hash TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('generating', 'ready', 'failed')),
  generated_markdown TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  generated_at TEXT,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_material_simplifications_identity
  ON material_simplifications(material_id, feature_kind, provider, model, source_hash, prompt_hash, config_hash);

CREATE INDEX IF NOT EXISTS idx_material_simplifications_material_id
  ON material_simplifications(material_id);

CREATE INDEX IF NOT EXISTS idx_material_simplifications_status
  ON material_simplifications(status);
