-- Aetheria RPG account and character persistence (PostgreSQL / Neon).
-- Run once in the provider SQL console before enabling the API.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS aetheria_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS aetheria_users_email_lower_uq
  ON aetheria_users (LOWER(email));

CREATE TABLE IF NOT EXISTS aetheria_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES aetheria_users(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 0 AND 5),
  name VARCHAR(20) NOT NULL,
  race VARCHAR(24) NOT NULL,
  class_id VARCHAR(32) NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 80),
  map_id VARCHAR(64) NOT NULL DEFAULT 'talking_island',
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0,"z":0}'::jsonb,
  vitals JSONB NOT NULL DEFAULT '{"hp":100,"mp":50}'::jsonb,
  character_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slot)
);
CREATE UNIQUE INDEX IF NOT EXISTS aetheria_characters_name_lower_uq
  ON aetheria_characters (LOWER(name));
CREATE INDEX IF NOT EXISTS aetheria_characters_user_updated_idx
  ON aetheria_characters (user_id, updated_at DESC);

-- Character rows are isolated by the authenticated API transaction context.
ALTER TABLE aetheria_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE aetheria_characters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aetheria_characters_user_scope ON aetheria_characters;
CREATE POLICY aetheria_characters_user_scope
  ON aetheria_characters
  FOR ALL
  TO PUBLIC
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
