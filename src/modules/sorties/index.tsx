import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db/database';
import { newEntity, softDeleteFields } from '../../core/db/helpers';
import { ConfirmModal } from '../../shared/components/ui/ConfirmModal';
import { SORTIES, CATEGORIES_SORTIES, type Sortie } from './sortiesData';
import type { Evenement, SortiePersonnelle } from '../../shared/types';
import './sorties.css';
import '../enfants/components/catalogue.css';

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

function SortieCard({ sortie, onPlanifier, onEdit }: { sortie: Sortie; onPlanifier: (s: Sortie) => void; onEdit?: (s: Sortie) => void }) {
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

          <div style={{ display: 'flex', gap: 8 }}>
            {onEdit && (
              <button
                className="sortie-card__btn-planifier"
                style={{ background: 'rgba(167,139,250,0.12)', color: '#7C5CBF' }}
                onClick={e => { e.stopPropagation(); onEdit(sortie); }}
              >
                Modifier
              </button>
            )}
            <button
              className="sortie-card__btn-planifier"
              onClick={e => { e.stopPropagation(); onPlanifier(sortie); }}
            >
              Planifier cette sortie
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire nouvelle sortie ────────────────────────────────────────────────

interface SortieFormProps {
  editItem?: SortiePersonnelle
  onClose: () => void
}

function SortieForm({ editItem, onClose }: SortieFormProps) {
  const [nom,                  setNom]                  = useState(editItem?.nom ?? '')
  const [description,          setDescription]          = useState(editItem?.description ?? '')
  const [emoji,                setEmoji]                = useState(editItem?.emoji ?? '🗺')
  const [categorie,            setCategorie]            = useState(editItem?.categorie ?? '')
  const [ageMin,               setAgeMin]               = useState(editItem?.ageMin?.toString() ?? '0')
  const [ageMax,               setAgeMax]               = useState(editItem?.ageMax?.toString() ?? '144')
  const [duree,                setDuree]                = useState(editItem?.dureeEstimee?.toString() ?? '')
  const [tarif,                setTarif]                = useState(editItem?.tarif ?? '')
  const [adresse,              setAdresse]              = useState(editItem?.adresse ?? '')
  const [infosPratiques,       setInfosPratiques]       = useState(editItem?.informationsPratiques ?? '')
  const [objectifs,            setObjectifs]            = useState(editItem?.objectifs ?? '')
  const [saving,               setSaving]               = useState(false)
  const [confirmDelete,        setConfirmDelete]        = useState(false)

  async function handleSave() {
    if (!nom.trim() || !adresse.trim() || !categorie) return
    setSaving(true)
    try {
      const data: Partial<SortiePersonnelle> = {
        nom:                  nom.trim(),
        description:          description.trim(),
        emoji:                emoji || '🗺',
        categorie,
        ageMin:               parseInt(ageMin) || 0,
        ageMax:               parseInt(ageMax) || 144,
        dureeEstimee:         duree ? parseInt(duree) : 60,
        tarif:                tarif.trim() || undefined,
        adresse:              adresse.trim(),
        informationsPratiques: infosPratiques.trim(),
        objectifs:            objectifs.trim() || undefined,
        archive:              false,
      }
      if (editItem) {
        await db.sortiesPersonnelles.update(editItem.id, { ...data, updatedAt: new Date() })
      } else {
        await db.sortiesPersonnelles.add(newEntity<SortiePersonnelle>(data as Omit<SortiePersonnelle, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'>))
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="enfants-form-backdrop" onClick={onClose}>
        <div className="enfants-form-sheet" onClick={e => e.stopPropagation()}>
          <div className="enfants-form-sheet__handle" />
          <p className="enfants-form-sheet__title">
            {editItem ? 'Modifier la sortie' : 'Nouvelle sortie'}
          </p>

          <div className="enfants-form-body">
            {/* Emoji + Nom */}
            <div className="enfants-form__row">
              <div className="enfants-form__field" style={{ flex: '0 0 70px' }}>
                <label className="enfants-form__label">Emoji</label>
                <input className="enfants-form__input" value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} style={{ textAlign: 'center', fontSize: '1.4rem' }} />
              </div>
              <div className="enfants-form__field">
                <label className="enfants-form__label">Nom *</label>
                <input className="enfants-form__input" value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Parc de la Tête d'Or" autoFocus />
              </div>
            </div>

            {/* Catégorie */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Catégorie *</label>
              <select className="enfants-form__input" value={categorie} onChange={e => setCategorie(e.target.value)}>
                <option value="">Choisir…</option>
                {CATEGORIES_SORTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Description */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Description</label>
              <textarea className="enfants-form__textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description de la sortie…" />
            </div>

            {/* Adresse */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Adresse *</label>
              <input className="enfants-form__input" value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Rue, ville…" />
            </div>

            {/* Âge */}
            <div className="enfants-form__row">
              <div className="enfants-form__field">
                <label className="enfants-form__label">Âge min (mois)</label>
                <input className="enfants-form__input" type="number" min="0" value={ageMin} onChange={e => setAgeMin(e.target.value)} />
              </div>
              <div className="enfants-form__field">
                <label className="enfants-form__label">Âge max (mois)</label>
                <input className="enfants-form__input" type="number" min="0" value={ageMax} onChange={e => setAgeMax(e.target.value)} />
              </div>
            </div>

            {/* Durée + Tarif */}
            <div className="enfants-form__row">
              <div className="enfants-form__field">
                <label className="enfants-form__label">Durée (min)</label>
                <input className="enfants-form__input" type="number" min="1" value={duree} onChange={e => setDuree(e.target.value)} placeholder="60" />
              </div>
              <div className="enfants-form__field">
                <label className="enfants-form__label">Tarif</label>
                <input className="enfants-form__input" value={tarif} onChange={e => setTarif(e.target.value)} placeholder="Gratuit" />
              </div>
            </div>

            {/* Informations pratiques */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Informations pratiques</label>
              <textarea className="enfants-form__textarea" rows={2} value={infosPratiques} onChange={e => setInfosPratiques(e.target.value)} placeholder="Parking, transports, horaires…" />
            </div>

            {/* Objectifs */}
            <div className="enfants-form__field">
              <label className="enfants-form__label">Objectifs</label>
              <textarea className="enfants-form__textarea" rows={2} value={objectifs} onChange={e => setObjectifs(e.target.value)} placeholder="Découverte de la nature, motricité…" />
            </div>
          </div>

          <div className="enfants-form__actions">
            {editItem && (
              <button className="enfants-form__btn-delete" onClick={() => setConfirmDelete(true)}>Supprimer</button>
            )}
            <button className="enfants-form__btn-cancel" onClick={onClose}>Annuler</button>
            <button
              className="enfants-form__btn-save"
              onClick={handleSave}
              disabled={!nom.trim() || !adresse.trim() || !categorie || saving}
            >
              {saving ? '…' : editItem ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cette sortie ?"
        message="Elle sera retirée de votre catalogue."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onConfirm={async () => {
          setConfirmDelete(false)
          if (editItem) {
            await db.sortiesPersonnelles.update(editItem.id, softDeleteFields())
            onClose()
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

// ── Tab Bibliothèque ──────────────────────────────────────────────────────────

function BibliothequeTab() {
  const [filterCat, setFilterCat] = useState('');
  const [planifierSortie, setPlanifierSortie] = useState<Sortie | null>(null);
  const [showSortieForm, setShowSortieForm] = useState(false);
  const [editSortie, setEditSortie] = useState<SortiePersonnelle | undefined>();

  const sortiesPersonnelles = useLiveQuery(
    () => db.sortiesPersonnelles.filter(s => !s.archive && !s.deletedAt).toArray(),
    []
  ) ?? [];

  // Fusion sorties statiques + personnelles pour l'affichage
  type SortieDisplay = Sortie | (SortiePersonnelle & { _custom: true });
  const toutesLesSorties: SortieDisplay[] = [
    ...SORTIES,
    ...sortiesPersonnelles.map(s => ({ ...s, _custom: true as const })),
  ];

  const displayed = filterCat
    ? toutesLesSorties.filter(s => s.categorie === filterCat)
    : toutesLesSorties;

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
            <SortieCard
              key={sortie.id}
              sortie={sortie}
              onPlanifier={setPlanifierSortie}
              onEdit={'_custom' in sortie ? (s) => { setEditSortie(s as SortiePersonnelle); setShowSortieForm(true) } : undefined}
            />
          ))
        )}
      </div>

      {planifierSortie && (
        <PlanifierModal sortie={planifierSortie} onClose={() => setPlanifierSortie(null)} />
      )}

      <button
        className="sorties-fab"
        onClick={() => { setEditSortie(undefined); setShowSortieForm(true); }}
        aria-label="Nouvelle sortie"
      >
        +
      </button>

      {showSortieForm && (
        <SortieForm
          editItem={editSortie}
          onClose={() => { setShowSortieForm(false); setEditSortie(undefined); }}
        />
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
