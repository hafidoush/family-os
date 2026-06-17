-- ============================================================
-- FAMILY OS — Tables de synchronisation (suite)
-- Coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1. HUMEURS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS humeurs (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE humeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "humeurs: own rows only" ON humeurs USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS humeurs_user_updated_idx ON humeurs(user_id, updated_at);
CREATE TRIGGER humeurs_set_updated_at BEFORE UPDATE ON humeurs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. ACTIVITES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activites (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE activites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activites: own rows only" ON activites USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS activites_user_updated_idx ON activites(user_id, updated_at);
CREATE TRIGGER activites_set_updated_at BEFORE UPDATE ON activites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. PLANIFICATIONS ACTIVITES ──────────────────────────────
CREATE TABLE IF NOT EXISTS planifications_activites (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE planifications_activites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planifications_activites: own rows only" ON planifications_activites USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS planif_activites_user_updated_idx ON planifications_activites(user_id, updated_at);
CREATE TRIGGER planif_activites_set_updated_at BEFORE UPDATE ON planifications_activites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. PIECES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pieces (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pieces: own rows only" ON pieces USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS pieces_user_updated_idx ON pieces(user_id, updated_at);
CREATE TRIGGER pieces_set_updated_at BEFORE UPDATE ON pieces FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. PROJETS MAISON ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projets_maison (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE projets_maison ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projets_maison: own rows only" ON projets_maison USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS projets_maison_user_updated_idx ON projets_maison(user_id, updated_at);
CREATE TRIGGER projets_maison_set_updated_at BEFORE UPDATE ON projets_maison FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6. SOUVENIRS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS souvenirs (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE souvenirs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "souvenirs: own rows only" ON souvenirs USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS souvenirs_user_updated_idx ON souvenirs(user_id, updated_at);
CREATE TRIGGER souvenirs_set_updated_at BEFORE UPDATE ON souvenirs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7. REUNIONS FAMILLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS reunions_famille (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE reunions_famille ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reunions_famille: own rows only" ON reunions_famille USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS reunions_famille_user_updated_idx ON reunions_famille(user_id, updated_at);
CREATE TRIGGER reunions_famille_set_updated_at BEFORE UPDATE ON reunions_famille FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 8. ROUTINES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routines (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routines: own rows only" ON routines USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS routines_user_updated_idx ON routines(user_id, updated_at);
CREATE TRIGGER routines_set_updated_at BEFORE UPDATE ON routines FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 9. ROUTINE ITEMS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routine_items (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE routine_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_items: own rows only" ON routine_items USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS routine_items_user_updated_idx ON routine_items(user_id, updated_at);
CREATE TRIGGER routine_items_set_updated_at BEFORE UPDATE ON routine_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 10. ENFANTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enfants (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE enfants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enfants: own rows only" ON enfants USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS enfants_user_updated_idx ON enfants(user_id, updated_at);
CREATE TRIGGER enfants_set_updated_at BEFORE UPDATE ON enfants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 11. NOTES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes: own rows only" ON notes USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON notes(user_id, updated_at);
CREATE TRIGGER notes_set_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 12. SELF CARE ITEMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS self_care_items (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE self_care_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_care_items: own rows only" ON self_care_items USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS self_care_items_user_updated_idx ON self_care_items(user_id, updated_at);
CREATE TRIGGER self_care_items_set_updated_at BEFORE UPDATE ON self_care_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 13. SPORT SESSIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sport_sessions (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE sport_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sport_sessions: own rows only" ON sport_sessions USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS sport_sessions_user_updated_idx ON sport_sessions(user_id, updated_at);
CREATE TRIGGER sport_sessions_set_updated_at BEFORE UPDATE ON sport_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 14. CROISSANCE MESURES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS croissance_mesures (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE croissance_mesures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "croissance_mesures: own rows only" ON croissance_mesures USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS croissance_mesures_user_updated_idx ON croissance_mesures(user_id, updated_at);
CREATE TRIGGER croissance_mesures_set_updated_at BEFORE UPDATE ON croissance_mesures FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 15. SESSIONS PREPARATION ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions_preparation (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE sessions_preparation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_preparation: own rows only" ON sessions_preparation USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS sessions_preparation_user_updated_idx ON sessions_preparation(user_id, updated_at);
CREATE TRIGGER sessions_preparation_set_updated_at BEFORE UPDATE ON sessions_preparation FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 16. COMPETENCES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competences (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE competences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competences: own rows only" ON competences USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS competences_user_updated_idx ON competences(user_id, updated_at);
CREATE TRIGGER competences_set_updated_at BEFORE UPDATE ON competences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 17. COMPETENCES SUIVI ────────────────────────────────────
CREATE TABLE IF NOT EXISTS competences_suivi (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE competences_suivi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competences_suivi: own rows only" ON competences_suivi USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS competences_suivi_user_updated_idx ON competences_suivi(user_id, updated_at);
CREATE TRIGGER competences_suivi_set_updated_at BEFORE UPDATE ON competences_suivi FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 18. ELEMENTS RELIGION ────────────────────────────────────
CREATE TABLE IF NOT EXISTS elements_religion (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE elements_religion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elements_religion: own rows only" ON elements_religion USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS elements_religion_user_updated_idx ON elements_religion(user_id, updated_at);
CREATE TRIGGER elements_religion_set_updated_at BEFORE UPDATE ON elements_religion FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 19. WISHLIST ITEMS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist_items (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_items: own rows only" ON wishlist_items USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS wishlist_items_user_updated_idx ON wishlist_items(user_id, updated_at);
CREATE TRIGGER wishlist_items_set_updated_at BEFORE UPDATE ON wishlist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 20. ENVELOPPES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enveloppes (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE enveloppes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enveloppes: own rows only" ON enveloppes USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS enveloppes_user_updated_idx ON enveloppes(user_id, updated_at);
CREATE TRIGGER enveloppes_set_updated_at BEFORE UPDATE ON enveloppes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 21. TRANSACTIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions: own rows only" ON transactions USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS transactions_user_updated_idx ON transactions(user_id, updated_at);
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 22. PROGRAMMES PEDAGOGIQUES ──────────────────────────────
CREATE TABLE IF NOT EXISTS programmes_pedagogiques (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE programmes_pedagogiques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programmes_pedagogiques: own rows only" ON programmes_pedagogiques USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS programmes_pedagogiques_user_updated_idx ON programmes_pedagogiques(user_id, updated_at);
CREATE TRIGGER programmes_pedagogiques_set_updated_at BEFORE UPDATE ON programmes_pedagogiques FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 23. ACTIVITES PROGRAMME ──────────────────────────────────
CREATE TABLE IF NOT EXISTS activites_programme (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE activites_programme ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activites_programme: own rows only" ON activites_programme USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS activites_programme_user_updated_idx ON activites_programme(user_id, updated_at);
CREATE TRIGGER activites_programme_set_updated_at BEFORE UPDATE ON activites_programme FOR EACH ROW EXECUTE FUNCTION set_updated_at();
