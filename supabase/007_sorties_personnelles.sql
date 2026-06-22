-- ============================================================
-- FAMILY OS — Table sorties_personnelles
-- Coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS sorties_personnelles (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

ALTER TABLE sorties_personnelles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sorties_personnelles: own rows only" ON sorties_personnelles
  USING (user_id = auth.uid());

CREATE POLICY "sorties_personnelles: insert own" ON sorties_personnelles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS sorties_personnelles_user_id_idx    ON sorties_personnelles(user_id);
CREATE INDEX IF NOT EXISTS sorties_personnelles_updated_at_idx ON sorties_personnelles(user_id, updated_at);

CREATE TRIGGER sorties_personnelles_set_updated_at
  BEFORE UPDATE ON sorties_personnelles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
