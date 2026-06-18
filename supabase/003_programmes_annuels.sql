-- ── Migration 003 : PROGRAMMES ANNUELS ──────────────────────────────────────
-- Synchronisation des parcours annuels générés par IA (ou manuels) entre appareils

CREATE TABLE IF NOT EXISTS programmes_annuels (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE programmes_annuels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programmes_annuels: own rows only" ON programmes_annuels USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS programmes_annuels_user_updated_idx ON programmes_annuels(user_id, updated_at);
CREATE TRIGGER programmes_annuels_set_updated_at
  BEFORE UPDATE ON programmes_annuels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
