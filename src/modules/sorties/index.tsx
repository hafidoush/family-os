import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { newEntity } from '../../core/db/helpers';
import { SORTIES, CATEGORIES_SORTIES, type Sortie } from './sortiesData';
import type { Evenement } from '../../shared/types';
import './sorties.css';

// ── Planning Modal ────────────────────────────────────────────────────────────

interface PlanifierModalProps {
  sortie: Sortie;
  onClose: () => void;
}

function PlanifierModal({ sortie, onClose }: PlanifierModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [heure, setHeure] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    try {
      const dateDebut = heure ? new Date(`${date}T${heure}`) : new Date(date);
      const evt = newEntity<Evenement>({
        titre: sortie.nom,
        description: sortie.description,
        type: 'sortie',
        dateDebut,
        journeeEntiere: !heure,
        recurrence: false,
        contexteMedical: false,
        archive: false,
        notes: notes || undefined,
        lieu: sortie.adresse,
      });
      await db.evenements.add(evt);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sorties-modal-backdrop" onClick={onClose}>
      <div className="sorties-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sorties-modal__handle" />
        <p className="sorties-modal__title">Planifier une sortie</p>
        <p className="sorties-modal__nom">{sortie.nom}</p>

        <div className="sorties-modal__field">
          <label className="sorties-modal__label">Date</label>
          <input
            type="date"
            className="sorties-modal__input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className="sorties-modal__field">
          <label className="sorties-modal__label">Heure (optionnel)</label>
          <input
            type="time"
            className="sorties-modal__input"
            value={heure}
            onChange={e => setHeure(e.target.value)}
          />
        </div>

        <div className="sorties-modal__field">
          <label className="sorties-modal__label">Notes (optionnel)</label>
          <input
            type="text"
            className="sorties-modal__input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Prévoir pique-nique, réserver billets..."
          />
        </div>

        <div className="sorties-modal__actions">
          <button className="sorties-modal__btn-cancel" onClick={onClose}>Annuler</button>
          <button
            className="sorties-modal__btn-save"
            onClick={handleSave}
            disabled={!date || saving}
          >
            {saving ? '...' : 'Planifier'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sortie Card ───────────────────────────────────────────────────────────────

function SortieCard({ sortie, onPlanifier }: { sortie: Sortie; onPlanifier: (s: Sortie) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sortie-card">
      <button
        className="sortie-card__header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="sortie-card__emoji">{sortie.emoji}</span>
        <div className="sortie-card__meta">
          <p className="sortie-card__nom">{sortie.nom}</p>
          <div className="sortie-card__pills">
            <span className="sortie-pill sortie-pill--cat">{sortie.categorie}</span>
            {sortie.tarif && <span className="sortie-pill sortie-pill--tarif">{sortie.tarif}</span>}
            <span className="sortie-pill sortie-pill--duree">⏱ {sortie.dureeEstimee} min</span>
          </div>
        </div>
        <span className="sortie-card__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="sortie-card__body">
          <div className="sortie-row">
            <span className="sortie-row__icon">📝</span>
            <div>
              <p className="sortie-row__label">Description</p>
              <p className="sortie-row__value">{sortie.description}</p>
            </div>
          </div>

          <div className="sortie-row">
            <span className="sortie-row__icon">👶</span>
            <div>
              <p className="sortie-row__label">Âge conseillé</p>
              <p className="sortie-row__value">
                {sortie.ageMin === 0 ? 'Dès la naissance' : `Dès ${sortie.ageMin} mois`}
                {sortie.ageMax < 144 ? ` jusqu'à ${sortie.ageMax} mois` : ''}
              </p>
            </div>
          </div>

          <div className="sortie-row">
            <span className="sortie-row__icon">📍</span>
            <div>
              <p className="sortie-row__label">Adresse</p>
              <p className="sortie-row__value">{sortie.adresse}</p>
            </div>
          </div>

          <div className="sortie-row">
            <span className="sortie-row__icon">ℹ️</span>
            <div>
              <p className="sortie-row__label">Informations pratiques</p>
              <p className="sortie-row__value">{sortie.informationsPratiques}</p>
            </div>
          </div>

          {sortie.objectifs && (
            <div className="sortie-row">
              <span className="sortie-row__icon">🎯</span>
              <div>
                <p className="sortie-row__label">Objectifs</p>
                <p className="sortie-row__value">{sortie.objectifs}</p>
              </div>
            </div>
          )}

          <button
            className="sortie-card__btn-planifier"
            onClick={e => { e.stopPropagation(); onPlanifier(sortie); }}
          >
            Planifier cette sortie
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab Bibliothèque ──────────────────────────────────────────────────────────

function BibliothequeTab() {
  const [filterCat, setFilterCat] = useState('');
  const [planifierSortie, setPlanifierSortie] = useState<Sortie | null>(null);

  const displayed = filterCat
    ? SORTIES.filter(s => s.categorie === filterCat)
    : SORTIES;

  return (
    <>
      <div className="sorties-filters">
        <button
          className={`sorties-filter-btn${filterCat === '' ? ' sorties-filter-btn--active' : ''}`}
          onClick={() => setFilterCat('')}
        >
          Toutes
        </button>
        {CATEGORIES_SORTIES.map(cat => (
          <button
            key={cat}
            className={`sorties-filter-btn${filterCat === cat ? ' sorties-filter-btn--active' : ''}`}
            onClick={() => setFilterCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="sorties-content">
        {displayed.length === 0 ? (
          <div className="sorties-empty">
            <span className="sorties-empty__icon">🔍</span>
            <p className="sorties-empty__text">Aucune sortie dans cette catégorie.</p>
          </div>
        ) : (
          displayed.map(sortie => (
            <SortieCard key={sortie.id} sortie={sortie} onPlanifier={setPlanifierSortie} />
          ))
        )}
      </div>

      {planifierSortie && (
        <PlanifierModal sortie={planifierSortie} onClose={() => setPlanifierSortie(null)} />
      )}
    </>
  );
}

// ── Tab Planifiées ────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatHeure(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function PlanifieesTab() {
  const sorties = useLiveQuery(
    () => db.evenements
      .where('type').equals('sortie')
      .and(e => !e.archive && !e.deletedAt)
      .sortBy('dateDebut'),
    []
  ) ?? [];

  if (sorties.length === 0) {
    return (
      <div className="sorties-content">
        <div className="sorties-empty">
          <span className="sorties-empty__icon">🗺</span>
          <p className="sorties-empty__text">
            Aucune sortie planifiée.<br />
            Parcourez la bibliothèque pour en ajouter une.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sorties-content">
      {sorties.map(evt => {
        const sortieRef = SORTIES.find(s => s.nom === evt.titre);
        return (
          <div key={evt.id} className="sortie-planif-item">
            <span className="sortie-planif-item__icon">{sortieRef?.emoji ?? '🗺'}</span>
            <div className="sortie-planif-item__info">
              <p className="sortie-planif-item__nom">{evt.titre}</p>
              <p className="sortie-planif-item__date">
                {formatDate(new Date(evt.dateDebut))}
                {!evt.journeeEntiere && ` à ${formatHeure(new Date(evt.dateDebut))}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Module principal ──────────────────────────────────────────────────────────

export default function SortiesModule() {
  const [tab, setTab] = useState<'bibliotheque' | 'planifiees'>('bibliotheque');

  return (
    <div className="sorties-page">
      <header className="sorties-page__header">
        <h1 className="sorties-page__title">Sorties</h1>
        <p className="sorties-page__subtitle">Idées de sorties en famille à Lyon</p>
      </header>

      <div className="sorties-tabs">
        <button
          className={`sorties-tab${tab === 'bibliotheque' ? ' sorties-tab--active' : ''}`}
          onClick={() => setTab('bibliotheque')}
        >
          Bibliothèque
        </button>
        <button
          className={`sorties-tab${tab === 'planifiees' ? ' sorties-tab--active' : ''}`}
          onClick={() => setTab('planifiees')}
        >
          Planifiées
        </button>
      </div>

      {tab === 'bibliotheque' ? <BibliothequeTab /> : <PlanifieesTab />}
    </div>
  );
}
