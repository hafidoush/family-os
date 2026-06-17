-- ============================================================
-- FAMILY OS — Tables de synchronisation Supabase
-- Coller dans : Supabase Dashboard → SQL Editor → Run
--
-- Stratégie : chaque ligne = un enregistrement Dexie complet
--   id        → UUID de Dexie (PK)
--   user_id   → lié à auth.users (RLS)
--   data      → payload JSON complet de l'objet Dexie
--   updated_at → pour la sync incrémentale
--   deleted_at → soft delete (null = actif)
-- ============================================================


-- ── Fonction utilitaire : updated_at auto ────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 1. RECETTES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recettes (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE recettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recettes: own rows only" ON recettes
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS recettes_user_id_idx      ON recettes(user_id);
CREATE INDEX IF NOT EXISTS recettes_updated_at_idx   ON recettes(user_id, updated_at);
CREATE TRIGGER recettes_set_updated_at
  BEFORE UPDATE ON recettes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 2. RECETTES INGRÉDIENTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS recettes_ingredients (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE recettes_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recettes_ingredients: own rows only" ON recettes_ingredients
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS recettes_ingredients_user_id_idx    ON recettes_ingredients(user_id);
CREATE INDEX IF NOT EXISTS recettes_ingredients_updated_at_idx ON recettes_ingredients(user_id, updated_at);
CREATE TRIGGER recettes_ingredients_set_updated_at
  BEFORE UPDATE ON recettes_ingredients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 3. MENUS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menus: own rows only" ON menus
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS menus_user_id_idx    ON menus(user_id);
CREATE INDEX IF NOT EXISTS menus_updated_at_idx ON menus(user_id, updated_at);
CREATE TRIGGER menus_set_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 4. MENU SLOTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_slots (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE menu_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_slots: own rows only" ON menu_slots
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS menu_slots_user_id_idx    ON menu_slots(user_id);
CREATE INDEX IF NOT EXISTS menu_slots_updated_at_idx ON menu_slots(user_id, updated_at);
CREATE TRIGGER menu_slots_set_updated_at
  BEFORE UPDATE ON menu_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 5. COURSES ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses_items (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE courses_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses_items: own rows only" ON courses_items
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS courses_items_user_id_idx    ON courses_items(user_id);
CREATE INDEX IF NOT EXISTS courses_items_updated_at_idx ON courses_items(user_id, updated_at);
CREATE TRIGGER courses_items_set_updated_at
  BEFORE UPDATE ON courses_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 6. MEMBRES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membres (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membres: own rows only" ON membres
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS membres_user_id_idx    ON membres(user_id);
CREATE INDEX IF NOT EXISTS membres_updated_at_idx ON membres(user_id, updated_at);
CREATE TRIGGER membres_set_updated_at
  BEFORE UPDATE ON membres
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 7. ÉVÉNEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evenements (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evenements: own rows only" ON evenements
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS evenements_user_id_idx    ON evenements(user_id);
CREATE INDEX IF NOT EXISTS evenements_updated_at_idx ON evenements(user_id, updated_at);
CREATE TRIGGER evenements_set_updated_at
  BEFORE UPDATE ON evenements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 8. TÂCHES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taches (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taches: own rows only" ON taches
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS taches_user_id_idx    ON taches(user_id);
CREATE INDEX IF NOT EXISTS taches_updated_at_idx ON taches(user_id, updated_at);
CREATE TRIGGER taches_set_updated_at
  BEFORE UPDATE ON taches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 9. PENSÉES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pensees (
  id          text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
ALTER TABLE pensees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pensees: own rows only" ON pensees
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS pensees_user_id_idx    ON pensees(user_id);
CREATE INDEX IF NOT EXISTS pensees_updated_at_idx ON pensees(user_id, updated_at);
CREATE TRIGGER pensees_set_updated_at
  BEFORE UPDATE ON pensees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
