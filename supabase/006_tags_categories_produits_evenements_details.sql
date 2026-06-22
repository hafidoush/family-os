-- ============================================================
-- FAMILY OS — Tables manquantes : tags, categories_produits, evenements_details
-- Coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── TAGS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags: own rows only" ON tags
  USING (user_id = auth.uid());
CREATE POLICY "tags: insert own" ON tags
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS tags_user_id_idx    ON tags(user_id);
CREATE INDEX IF NOT EXISTS tags_updated_at_idx ON tags(user_id, updated_at);
CREATE TRIGGER tags_set_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── CATEGORIES PRODUITS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories_produits (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE categories_produits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_produits: own rows only" ON categories_produits
  USING (user_id = auth.uid());
CREATE POLICY "categories_produits: insert own" ON categories_produits
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS categories_produits_user_id_idx    ON categories_produits(user_id);
CREATE INDEX IF NOT EXISTS categories_produits_updated_at_idx ON categories_produits(user_id, updated_at);
CREATE TRIGGER categories_produits_set_updated_at
  BEFORE UPDATE ON categories_produits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── EVENEMENTS DETAILS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evenements_details (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE evenements_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evenements_details: own rows only" ON evenements_details
  USING (user_id = auth.uid());
CREATE POLICY "evenements_details: insert own" ON evenements_details
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS evenements_details_user_id_idx    ON evenements_details(user_id);
CREATE INDEX IF NOT EXISTS evenements_details_updated_at_idx ON evenements_details(user_id, updated_at);
CREATE TRIGGER evenements_details_set_updated_at
  BEFORE UPDATE ON evenements_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
