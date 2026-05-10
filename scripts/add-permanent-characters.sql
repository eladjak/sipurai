-- Wave-12 (Sipurai overhaul) — 2026-05-10
-- Add permanent-character feature: same character across multiple books.
-- Council recommendation: is_permanent boolean + UI checkbox + recall in BookWizard.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_uploaded_image TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'created'
    CHECK (source_type IN ('created', 'uploaded_photo', 'template'));

CREATE INDEX IF NOT EXISTS idx_characters_permanent
  ON characters(created_by, is_permanent) WHERE is_permanent = TRUE;

COMMENT ON COLUMN characters.is_permanent IS
  'When true, character persists across books. BookWizard offers picker.';

COMMENT ON COLUMN characters.user_uploaded_image IS
  'Optional Supabase Storage URL of original photo (child/family) used as image-edit reference.';

COMMENT ON COLUMN characters.source_type IS
  'created = AI-generated from prompts. uploaded_photo = user uploaded real photo. template = pre-built character.';
