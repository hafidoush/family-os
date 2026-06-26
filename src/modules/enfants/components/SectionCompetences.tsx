import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { useEnfantsStore } from '../stores/enfantsStore';
import { useEnfants } from '../hooks/useEnfants';
import { newEntity } from '../../../core/db/helpers';
import type { Competence, CompetenceSuivi } from '../../../shared/types';

async function deduplicateCompetences(): Promise<void> {
  const all = await db.competences.toArray();
  const seen = new Map<string, string>(); // "domaine|nom" → id à garder
  const toDelete: string[] = [];
  for (const c of all) {
    const key = `${c.domaine}|${c.nom.trim().toLowerCase()}`;
    if (seen.has(key)) {
      toDelete.push(c.id);
    } else {
      seen.set(key, c.id);
    }
  }
  if (toDelete.length > 0) {
    await db.competences.bulkDelete(toDelete);
    await db.competencesSuivi
      .filter((s) => toDelete.includes(s.competence))
      .delete();
  }
}

// ── Domaines ──────────────────────────────────────────────────────────────────

const DOMAINES: { key: string; label: string; icon: string }[] = [
  { key: 'langage',          label: 'Langage & Lecture',      icon: '📚' },
  { key: 'pre_ecriture',     label: 'Graphisme / Pré-écriture', icon: '✍️' },
  { key: 'mathematiques',    label: 'Mathématiques',          icon: '🔢' },
  { key: 'decouverte_monde', label: 'Découverte du monde',    icon: '🌍' },
  { key: 'cognitif',         label: 'Cognitif',               icon: '🧠' },
  { key: 'social_emotionnel',label: 'Social & Émotionnel',    icon: '🫶' },
  { key: 'vie_pratique',     label: 'Vie pratique',           icon: '🧽' },
  { key: 'creativite',       label: 'Créativité',             icon: '🎨' },
  { key: 'religion',         label: 'Religion',               icon: '🌙' },
  { key: 'motricite',        label: 'Motricité globale',      icon: '🤸' },
];

// ── Statuts ───────────────────────────────────────────────────────────────────

const STATUT_CONFIG = {
  non_commence: { label: 'À commencer', bg: 'hsl(240,8%,96%)',     color: 'hsl(240,5%,55%)',   icon: '○' },
  en_cours:     { label: 'En cours',    bg: 'hsl(48,95%,92%)',     color: 'hsl(38,85%,42%)',   icon: '◐' },
  acquis:       { label: 'Acquis',      bg: 'hsl(142,55%,92%)',    color: 'hsl(142,50%,32%)',  icon: '●' },
} as const;

type StatutLocal = keyof typeof STATUT_CONFIG;

// Mappe les valeurs Dexie (a_travailler) → local (non_commence)
function toLocal(statut: string): StatutLocal {
  if (statut === 'a_travailler' || statut === 'non_commence') return 'non_commence';
  if (statut === 'en_cours') return 'en_cours';
  if (statut === 'acquis') return 'acquis';
  return 'non_commence';
}

function nextStatut(current: StatutLocal): StatutLocal {
  const order: StatutLocal[] = ['non_commence', 'en_cours', 'acquis'];
  return order[(order.indexOf(current) + 1) % order.length];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useCompetences(membreId: string | null) {
  const competences = useLiveQuery(
    () => db.competences.filter((c) => !c.archive).toArray(),
    []
  );

  const suivis = useLiveQuery<CompetenceSuivi[]>(
    () => membreId
      ? db.competencesSuivi
          .where('enfant').equals(membreId)
          .filter((s) => !s.archive)
          .toArray()
      : Promise.resolve([] as CompetenceSuivi[]),
    [membreId]
  );

  return {
    competences: competences ?? [],
    suivis: suivis ?? [],
    isLoading: competences === undefined || suivis === undefined,
  };
}

// ── Composant principal ───────────────────────────────────────────────────────

export function SectionCompetences() {
  const { activeEnfantId } = useEnfantsStore();
  const { competences, suivis, isLoading } = useCompetences(activeEnfantId);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { deduplicateCompetences(); }, []);
  const [newNom, setNewNom] = useState('');
  const [saving, setSaving] = useState(false);
  const [domaineFiltreActif, setDomaineFiltreActif] = useState<string | null>(null);

  const { membres } = useEnfants();
  const enfantColor = activeEnfantId === 'membre-manel' ? '#DBBFEE' : '#6F7ED6';

  const suiviMap = new Map(suivis.map((s) => [s.competence, s]));

  function getStatut(competenceId: string): StatutLocal {
    const s = suiviMap.get(competenceId);
    return s ? toLocal(s.statut) : 'non_commence';
  }

  async function handleToggle(competence: Competence) {
    if (!activeEnfantId) return;
    const existing = suiviMap.get(competence.id);
    const currentLocal = existing ? toLocal(existing.statut) : 'non_commence';
    const nextLocal = nextStatut(currentLocal);
    // Mappe local → DB
    const dbStatut = nextLocal === 'non_commence' ? 'a_travailler' : nextLocal;

    if (existing) {
      await db.competencesSuivi.update(existing.id, {
        statut: dbStatut,
        updatedAt: new Date(),
        dateAcquisition: nextLocal === 'acquis' ? new Date().toISOString().split('T')[0] : undefined,
      });
    } else {
      await db.competencesSuivi.add(
        newEntity<CompetenceSuivi>({
          enfant: activeEnfantId,
          competence: competence.id,
          statut: dbStatut,
          dateAcquisition: nextLocal === 'acquis' ? new Date().toISOString().split('T')[0] : undefined,
          archive: false,
        })
      );
    }
  }

  async function handleAddCompetence() {
    if (!newNom.trim()) return;
    setSaving(true);
    try {
      await db.competences.add(
        newEntity<Competence>({
          nom: newNom.trim(),
          domaine: 'cognitif',
          archive: false,
        })
      );
      setNewNom('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  // Stats globales
  const total = competences.length;
  const acquis = suivis.filter((s) => s.statut === 'acquis').length;
  const enCours = suivis.filter((s) => s.statut === 'en_cours').length;

  // Grouper par domaine dans l'ordre défini
  const domainesAvecComps = DOMAINES.map(d => ({
    ...d,
    items: competences
      .filter(c => c.domaine === d.key)
      .sort((a, b) => (a.ordreSuggere ?? 99) - (b.ordreSuggere ?? 99)),
  })).filter(d => d.items.length > 0);

  // Domaine actif pour le filtre
  const domainesAffiches = domaineFiltreActif
    ? domainesAvecComps.filter(d => d.key === domaineFiltreActif)
    : domainesAvecComps;

  return (
    <div className="enfants-section">
      {/* Sélecteur Manel / Nawfel */}
      <div className="enfants-selector enfants-selector--inline">
        {membres.map((membre) => {
          const slug = membre.id === 'membre-manel' ? 'manel' : 'nawfel';
          const isActive = activeEnfantId === membre.id;
          return (
            <button
              key={membre.id}
              className={[
                'enfants-selector__card',
                `enfants-selector__card--${slug}`,
                isActive ? 'enfants-selector__card--active' : '',
              ].join(' ')}
              onClick={() => useEnfantsStore.getState().setActiveEnfant(membre.id)}
              aria-pressed={isActive}
            >
              <div className={`enfants-selector__avatar enfants-selector__avatar--${slug}`}>
                {membre.prenom?.[0] ?? '?'}
              </div>
              <span className="enfants-selector__name">{membre.prenom}</span>
            </button>
          );
        })}
      </div>

      <div className="enfants-section__header">
        <h2 className="enfants-section__title">
          Compétences de <span>{membres.find(m => m.id === activeEnfantId)?.prenom ?? '…'}</span>
        </h2>
        <button
          className="enfants-add-btn"
          style={{ background: enfantColor, boxShadow: `0 4px 12px ${enfantColor}40` }}
          onClick={() => setShowForm(true)}
        >
          <span>+</span> Ajouter
        </button>
      </div>

      {/* Stats rapides */}
      {total > 0 && (
        <div className="competences-stats">
          <div className="competences-stat">
            <span className="competences-stat__value" style={{ color: 'hsl(142,50%,32%)' }}>{acquis}</span>
            <span className="competences-stat__label">Acquises</span>
          </div>
          <div className="competences-stat">
            <span className="competences-stat__value" style={{ color: 'hsl(38,85%,42%)' }}>{enCours}</span>
            <span className="competences-stat__label">En cours</span>
          </div>
          <div className="competences-stat">
            <span className="competences-stat__value" style={{ color: 'hsl(240,5%,55%)' }}>{total - acquis - enCours}</span>
            <span className="competences-stat__label">À commencer</span>
          </div>
        </div>
      )}

      {/* Filtres domaine */}
      <div className="religion-categories" style={{ marginBottom: 0 }}>
        <button
          className={['religion-cat-btn', !domaineFiltreActif ? 'religion-cat-btn--active' : ''].join(' ')}
          onClick={() => setDomaineFiltreActif(null)}
        >
          Tout
        </button>
        {domainesAvecComps.map(d => (
          <button
            key={d.key}
            className={['religion-cat-btn', domaineFiltreActif === d.key ? 'religion-cat-btn--active' : ''].join(' ')}
            onClick={() => setDomaineFiltreActif(domaineFiltreActif === d.key ? null : d.key)}
          >
            {d.icon} {d.label}
          </button>
        ))}
      </div>

      {/* Formulaire ajout */}
      {showForm && (
        <div className="enfants-form">
          <div className="enfants-form__field">
            <label className="enfants-form__label">Nom de la compétence</label>
            <input
              type="text"
              className="enfants-form__input"
              placeholder="ex: Lire seul, Nager 25m..."
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              autoFocus
            />
          </div>
          <div className="enfants-form__actions">
            <button className="enfants-form__btn-cancel" onClick={() => setShowForm(false)}>Annuler</button>
            <button
              className="enfants-form__btn-save"
              style={{ background: enfantColor }}
              onClick={handleAddCompetence}
              disabled={!newNom.trim() || saving}
            >
              {saving ? '...' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <>
          <div className="enfants-skeleton" />
          <div className="enfants-skeleton" />
        </>
      )}

      {!isLoading && competences.length === 0 && !showForm && (
        <div className="enfants-empty">
          <span className="enfants-empty__icon">⭐</span>
          <p className="enfants-empty__text">Aucune compétence encore ajoutée</p>
        </div>
      )}

      {/* Liste groupée par domaine */}
      {!isLoading && domainesAffiches.map(domaine => (
        <div key={domaine.key}>
          {/* Header domaine */}
          <div className="competences-domaine-header">
            <span className="competences-domaine-header__icon">{domaine.icon}</span>
            <span className="competences-domaine-header__label">{domaine.label}</span>
            <span className="competences-domaine-header__count">
              {domaine.items.filter(c => getStatut(c.id) === 'acquis').length}/{domaine.items.length}
            </span>
          </div>

          {domaine.items.map((comp) => {
            const statut = getStatut(comp.id);
            const cfg = STATUT_CONFIG[statut];
            return (
              <div
                key={comp.id}
                className="activite-card"
                onClick={() => handleToggle(comp)}
                role="button"
                tabIndex={0}
                aria-label={`${comp.nom} — ${cfg.label}, appuyer pour changer`}
              >
                <span style={{ fontSize: 18, color: cfg.color, lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</span>
                <div className="activite-card__content">
                  <p className="activite-card__name">{comp.nom}</p>
                </div>
                <span
                  className="activite-card__badge"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
