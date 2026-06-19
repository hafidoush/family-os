-- ============================================================
-- FAMILY OS — Tables catégories (recettes + activités)
-- Coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── CATEGORIES RECETTES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories_recettes (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE categories_recettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_recettes: own rows only" ON categories_recettes
  USING (user_id = auth.uid());
CREATE POLICY "categories_recettes: insert own" ON categories_recettes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS categories_recettes_user_id_idx    ON categories_recettes(user_id);
CREATE INDEX IF NOT EXISTS categories_recettes_updated_at_idx ON categories_recettes(user_id, updated_at);
CREATE TRIGGER categories_recettes_set_updated_at
  BEFORE UPDATE ON categories_recettes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── CATEGORIES ACTIVITES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories_activites (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE categories_activites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_activites: own rows only" ON categories_activites
  USING (user_id = auth.uid());
CREATE POLICY "categories_activites: insert own" ON categories_activites
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS categories_activites_user_id_idx    ON categories_activites(user_id);
CREATE INDEX IF NOT EXISTS categories_activites_updated_at_idx ON categories_activites(user_id, updated_at);
CREATE TRIGGER categories_activites_set_updated_at
  BEFORE UPDATE ON categories_activites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
