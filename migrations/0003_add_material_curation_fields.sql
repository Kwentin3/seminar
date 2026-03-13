ALTER TABLE materials ADD COLUMN material_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE materials ADD COLUMN theme TEXT;
ALTER TABLE materials ADD COLUMN source_updated_at TEXT;
ALTER TABLE materials ADD COLUMN recommended_for_lecture_prep INTEGER NOT NULL DEFAULT 0 CHECK (recommended_for_lecture_prep IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(material_status);
CREATE INDEX IF NOT EXISTS idx_materials_recommended ON materials(recommended_for_lecture_prep);
