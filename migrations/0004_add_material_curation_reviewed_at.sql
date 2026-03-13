ALTER TABLE materials ADD COLUMN curation_reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_materials_curation_reviewed_at ON materials(curation_reviewed_at);
