import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { newEntity } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import type { Activite, PlanificationActivite } from '../../../shared/types';

const CATEGORIES_ORDER = [
  'Sensoriel',
  'Motricité fine',
  'Pré-écriture',
  'Construction et logique',
  'Mathématiques',
  'Langage et prélecture',
  'Motricité globale',
  'Nature et découverte',
  'Vie pratique',
  'Créativité',
];

const CATEGORIES_ICONS: Record<string, string> = {
  'Sensoriel': '🪣',
  'Motricité fine': '✂️',
  'Pré-écriture': '✏️',
  'Construction et logique': '🧱',
  'Mathématiques': '🔢',
  'Langage et prélecture': '📖',
  'Motricité globale': '🤸',
  'Nature et découverte': '🌿',
  'Vie pratique': '🏠',
  'Créativité': '🎨',
};

const STATUT_LABELS: Record<string, string> = {
  planifiee: 'Planifiée',
  realisee:  'Réalisée',
  annulee:   'Annulée',
};

function useActivites() {
  const planifications = useLiveQuery(
    () => db.planificationsActivites.filter((p) => !p.archive).toArray(),
    []
  );
  const activites = useLiveQuery(
    () => db.activites.filter((a) => !a.archive).toArray(),
    []
  );
  return {
    planifications: planifications ?? [],
    activites: activites ?? [],
    isLoading: planifications === undefined || activites === undefined,
  };
}

function getActiviteNom(activites: Activite[], activiteId: string): string {
  return activites.find((a) => a.id === activiteId)?.nom ?? '—';
}

function getActiviteCat(activites: Activite[], activiteId: string): string {
  return activites.find((a) => a.id === activiteId)?.categorie ?? '';
}

function formatHeure(date?: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function EnfantsAvatars({ enfantId }: { enfantId: string }) {
  const enfants = useLiveQuery(
    () => db.membres.filter((m) => m.role === 'enfant' && m.actif).toArray(),
    []
  ) ?? [];

  const toShow = enfantId === 'tous' ? enfants : enfants.filter((e) => e.id === enfantId);

  return (
    <div className="activite-card__avatars">
      {toShow.map((e) => (
        <div
          key={e.id}
          className="activite-card__avatar"
          style={{ background: e.couleur ?? '#E5E7EB' }}
          title={e.prenom}
        >
          {e.prenom[0]}
        </div>
      ))}
    </div>
  );
}

interface AddPlanifFormProps {
  activites: Activite[];
  filterCat: string;
  onClose: () => void;
}

function AddPlanifForm({ activites, filterCat, onClose }: AddPlanifFormProps) {
  const [categorie, setCategorie] = useState(filterCat ?? '');
  const [activiteId, setActiviteId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [heure, setHeure] = useState('');
  const [saving, setSaving] = useState(false);

  // Catégories disponibles parmi les activités existantes
  const catsDisponibles = CATEGORIES_ORDER.filter((cat) =>
    activites.some((a) => a.categorie === cat)
  );

  const filtered = categorie
    ? activites.filter((a) => a.categorie === categorie)
    : activites;

  async function handleSave() {
    if (!activiteId || !date) return;
    setSaving(true);
    try {
      const datePrevue = heure ? new Date(`${date}T${heure}`) : new Date(date);
      const planif: PlanificationActivite = {
        ...newEntity<PlanificationActivite>({
          activite: activiteId,
          enfant: 'tous',
          datePrevue: datePrevue.toISOString(),
          statut: 'planifiee',
        }),
      };
      await db.planificationsActivites.add(planif);
      emit('planification.status_changed', { planifId: planif.id, statut: 'planifiee' });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="enfants-form">
      <div className="enfants-form__field">
        <label className="enfants-form__label">Catégorie</label>
        <select
          className="enfants-form__select"
          value={categorie}
          onChange={(e) => { setCategorie(e.target.value); setActiviteId(''); }}
        >
          <option value="">Toutes les catégories...</option>
          {catsDisponibles.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORIES_ICONS[cat] ?? ''} {cat}
            </option>
          ))}
        </select>
      </div>
      <div className="enfants-form__field">
        <label className="enfants-form__label">Activité</label>
        <select
          className="enfants-form__select"
          value={activiteId}
          onChange={(e) => setActiviteId(e.target.value)}
          disabled={!categorie}
        >
          <option value="">{categorie ? 'Choisir une activité...' : '← Choisissez une catégorie d\'abord'}</option>
          {filtered.map((a) => (
            <option key={a.id} value={a.id}>{a.nom}</option>
          ))}
        </select>
      </div>
      <div className="enfants-form__row">
        <div className="enfants-form__field">
          <label className="enfants-form__label">Date</label>
          <input type="date" className="enfants-form__input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="enfants-form__field">
          <label className="enfants-form__label">Heure (opt.)</label>
          <input type="time" className="enfants-form__input" value={heure} onChange={(e) => setHeure(e.target.value)} />
        </div>
      </div>
      <div className="enfants-form__actions">
        <button className="enfants-form__btn-cancel" onClick={onClose}>Annuler</button>
        <button
          className="enfants-form__btn-save"
          onClick={handleSave}
          disabled={!activiteId || !date || saving}
        >
          {saving ? '...' : 'Planifier'}
        </button>
      </div>
    </div>
  );
}

export function SectionActivites() {
  const { planifications, activites, isLoading } = useActivites();
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('');

  // Catégories présentes dans les planifications
  const catsPresentes = CATEGORIES_ORDER.filter((cat) =>
    planifications.some((p) => getActiviteCat(activites, p.activite) === cat)
  );

  // Filtrer les planifications selon la catégorie
  const filtered = filterCat
    ? planifications.filter((p) => getActiviteCat(activites, p.activite) === filterCat)
    : planifications;

  const sorted = [...filtered].sort(
    (a, b) => new Date(a.datePrevue).getTime() - new Date(b.datePrevue).getTime()
  );

  async function handleToggleStatut(planif: PlanificationActivite) {
    if (planif.statut === 'realisee') return;
    await db.planificationsActivites.update(planif.id, {
      statut: 'realisee',
      updatedAt: new Date(),
    });
    emit('planification.status_changed', { planifId: planif.id, statut: 'realisee' });
  }

  return (
    <div className="enfants-section">
      <div className="enfants-section__header">
        <h2 className="enfants-section__title">
          Activités <span>planifiées</span>
        </h2>
        <button
          className="enfants-add-btn"
          style={{ background: '#A78BFA', boxShadow: '0 4px 12px #A78BFA40' }}
          onClick={() => setShowForm(true)}
        >
          <span>+</span> Ajouter
        </button>
      </div>

      {showForm && (
        <AddPlanifForm
          activites={activites}
          filterCat={filterCat}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Filtres par catégorie */}
      {catsPresentes.length > 1 && (
        <div className="religion-categories">
          <button
            className={['religion-cat-btn', filterCat === '' ? 'religion-cat-btn--active' : ''].join(' ')}
            onClick={() => setFilterCat('')}
          >
            Toutes
          </button>
          {catsPresentes.map((cat) => (
            <button
              key={cat}
              className={['religion-cat-btn', filterCat === cat ? 'religion-cat-btn--active' : ''].join(' ')}
              onClick={() => setFilterCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <>
          <div className="enfants-skeleton" />
          <div className="enfants-skeleton" />
          <div className="enfants-skeleton" />
        </>
      )}

      {!isLoading && sorted.length === 0 && !showForm && (
        <div className="enfants-empty">
          <span className="enfants-empty__icon">⚡</span>
          <p className="enfants-empty__text">
            {filterCat ? `Aucune activité "${filterCat}" planifiée` : 'Aucune activité planifiée'}
          </p>
        </div>
      )}

      {!isLoading && sorted.map((planif) => {
        const cat = getActiviteCat(activites, planif.activite);
        const heure = formatHeure(planif.datePrevue);
        return (
          <div
            key={planif.id}
            className="activite-card"
            onClick={() => handleToggleStatut(planif)}
            role="button"
            tabIndex={0}
          >
            <EnfantsAvatars enfantId={planif.enfant ?? 'tous'} />
            <div className="activite-card__content">
              <p className="activite-card__name">
                {getActiviteNom(activites, planif.activite)}
              </p>
              <p className="activite-card__meta">
                {new Date(planif.datePrevue).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
                {heure && ` · ${heure}`}
                {cat && ` · ${cat}`}
              </p>
            </div>
            <span className={`activite-card__badge activite-card__badge--${planif.statut}`}>
              {STATUT_LABELS[planif.statut] ?? planif.statut}
            </span>
          </div>
        );
      })}
    </div>
  );
}
