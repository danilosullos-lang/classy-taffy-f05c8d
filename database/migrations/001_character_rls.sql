-- Per-user row-level security for character saves.
-- The API sets app.user_id with set_config(..., true) inside each transaction.
ALTER TABLE aetheria_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE aetheria_characters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aetheria_characters_user_scope ON aetheria_characters;
CREATE POLICY aetheria_characters_user_scope
  ON aetheria_characters
  FOR ALL
  TO PUBLIC
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
