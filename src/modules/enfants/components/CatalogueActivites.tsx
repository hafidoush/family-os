import { useState } from 'react';
import './catalogue.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { newEntity } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import type { Activite, PlanificationActivite } from '../../../shared/types';
import SortiesModule from '../../sorties';
import { ActiviteForm } from './ActiviteForm';

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

const DIFFICULTE_CONFIG: Record<string, { label: string; color: string }> = {
  facile:    { label: 'Facile',    color: '#22C55E' },
  moyen:     { label: 'Moyen',     color: '#F59E0B' },
  difficile: { label: 'Difficile', color: '#EF4444' },
};

const PREPARATIONS: Record<string, string> = {
  'Bac riz coloré': 'La veille : mélanger le riz avec quelques gouttes de colorant alimentaire et laisser sécher toute la nuit à plat sur du papier.',
  'Bac glace pingouins': 'La veille : congeler des glaçons. Le jour J : sortir 30 min avant pour que la glace ne soit pas trop dure.',
  'Bac glace objets': 'La veille : placer les petits objets dans des moules à glaçons, remplir d\'eau et congeler.',
  'Bac mousse sensorielle': 'Juste avant : mélanger la mousse à raser avec le colorant. À faire au moment car la mousse s\'affaisse.',
  'Bac mousse colorée': 'Juste avant : préparer la mousse colorée par zones dans le bac. Prévoir des vêtements qui ne craignent rien.',
  'Lavage de voitures cacao': 'Juste avant : diluer le cacao dans l\'eau tiède. Prévoir une serviette et des vêtements imperméables.',
  'Bac dinosaures archéologie': 'La veille ou le matin : enfouir les dinosaures dans le sable ou la farine. Laisser durcir si possible.',
  'Bac semoule cachée': '5 min avant : cacher les objets sous la semoule. Varier les emplacements à chaque session.',
  'Bac épices': '5 min avant : verser chaque épice dans un bol séparé. Vérifier qu\'aucune épice n\'est irritante pour les yeux.',
  'Mini marché': '15 min avant : étiqueter les aliments avec des prix simples (1, 2, 3). Préparer les pièces jouets dans un porte-monnaie.',
  'Chasse aux trésors': '20 min avant : rédiger ou dessiner les indices, cacher le trésor et placer les indices dans l\'ordre.',
  'Parcours moteur jardin': '15 min avant : installer et sécuriser le parcours. Vérifier que le sol est dégagé et sans danger.',
  'Activité multi-étapes': '10 min avant : rassembler tout le matériel et lire les étapes entièrement avant de commencer.',
  'Collage quantités': '5 min avant : imprimer ou préparer les fiches avec les chiffres. Disposer les gommettes par couleur.',
  'Dictée imagée': '5 min avant : préparer les fiches et choisir les images adaptées au niveau de l\'enfant.',
  'Puzzle de quantités': 'Vérifier que toutes les pièces sont présentes avant de commencer.',
  'Lego fin': 'Trier les pièces par couleur ou taille si activité guidée. Pour construction libre, verser directement.',
};

function getPreparation(nom: string): string | null {
  return PREPARATIONS[nom] ?? null;
}

function useActivitesCatalogue() {
  const activites = useLiveQuery(
    () => db.activites.filter((a) => !a.archive).toArray(),
    []
  );
  return { activites: activites ?? [], isLoading: activites === undefined };
}

// ── Carte déroulante ─────────────────────────────────────────────────────────

interface ActiviteCardProps {
  activite: Activite;
  onAddToPlanning: (activite: Activite) => void;
}

function ActiviteCard({ activite, onAddToPlanning }: ActiviteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const diff = DIFFICULTE_CONFIG[activite.difficulte ?? 'facile'];
  const preparation = getPreparation(activite.nom);

  return (
    <div className={`catalogue-card${expanded ? ' catalogue-card--expanded' : ''}`}>
      <button
        className="catalogue-card__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="catalogue-card__top">
          <span className="catalogue-card__name">{activite.nom}</span>
          <span className="catalogue-card__chevron" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
        <div className="catalogue-card__pills">
          {activite.difficulte && (
            <span
              className="catalogue-pill"
              style={{ color: diff.color, background: `${diff.color}18` }}
            >
              {diff.label}
            </span>
          )}
          {activite.ageMin !== undefined && activite.ageMax !== undefined && (
            <span className="catalogue-pill catalogue-pill--blue">
              {activite.ageMin}–{activite.ageMax} mois
            </span>
          )}
          {activite.dureeEstimee && (
            <span className="catalogue-pill catalogue-pill--purple">
              ⏱ {activite.dureeEstimee} min
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="catalogue-card__body">
          {activite.objectifPedagogique && (
            <div className="catalogue-row">
              <span className="catalogue-row__icon">🎯</span>
              <div className="catalogue-row__content">
                <p className="catalogue-row__label">Objectif</p>
                <p className="catalogue-row__value">{activite.objectifPedagogique}</p>
              </div>
            </div>
          )}

          {activite.dureeEstimee && (
            <div className="catalogue-row">
              <span className="catalogue-row__icon">⏱</span>
              <div className="catalogue-row__content">
                <p className="catalogue-row__label">Durée</p>
                <p className="catalogue-row__value">{activite.dureeEstimee} minutes</p>
              </div>
            </div>
          )}

          {activite.materiel && activite.materiel.length > 0 && (
            <div className="catalogue-row">
              <span className="catalogue-row__icon">🧰</span>
              <div className="catalogue-row__content">
                <p className="catalogue-row__label">Matériel</p>
                <ul className="catalogue-materiel">
                  {activite.materiel.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {preparation && (
            <div className="catalogue-row catalogue-row--prep">
              <span className="catalogue-row__icon">📋</span>
              <div className="catalogue-row__content">
                <p className="catalogue-row__label">Préparation en amont</p>
                <p className="catalogue-row__value">{preparation}</p>
              </div>
            </div>
          )}

          <button
            className="catalogue-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlanning(activite);
            }}
          >
            + Ajouter au planning
          </button>
        </div>
      )}
    </div>
  );
}

// ── Modal ajout planning ──────────────────────────────────────────────────────

interface AddToPlanningModalProps {
  activite: Activite;
  onClose: () => void;
}

function AddToPlanningModal({ activite, onClose }: AddToPlanningModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [heure, setHeure] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    try {
      const datePrevue = heure ? new Date(`${date}T${heure}`) : new Date(date);
      const planif = newEntity<PlanificationActivite>({
        activite: activite.id,
        enfant: 'tous',
        datePrevue: datePrevue.toISOString(),
        statut: 'planifiee',
      });
      await db.planificationsActivites.add(planif);
      emit('planification.status_changed', { planif });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="catalogue-modal-backdrop" onClick={onClose}>
      <div
        className="catalogue-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="catalogue-modal__handle" />
        <p className="catalogue-modal__title">Ajouter au planning</p>
        <p className="catalogue-modal__nom">{activite.nom}</p>

        <div className="enfants-form__field">
          <label className="enfants-form__label">Date</label>
          <input
            type="date"
            className="enfants-form__input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="enfants-form__field">
          <label className="enfants-form__label">Heure (optionnel)</label>
          <input
            type="time"
            className="enfants-form__input"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
          />
        </div>

        <div className="enfants-form__actions">
          <button className="enfants-form__btn-cancel" onClick={onClose}>Annuler</button>
          <button
            className="enfants-form__btn-save"
            style={{ background: '#A78BFA' }}
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

// ── Composant principal ───────────────────────────────────────────────────────

export function CatalogueActivites() {
  const [sousOnglet, setSousOnglet] = useState<'activites' | 'sorties'>('activites');
  const { activites, isLoading } = useActivitesCatalogue();
  const [filterCat, setFilterCat] = useState('');
  const [planningActivite, setPlanningActivite] = useState<Activite | null>(null);
  const [showActiviteForm, setShowActiviteForm] = useState(false);
  const [editActivite, setEditActivite] = useState<Activite | undefined>();

  const catsPresentes = CATEGORIES_ORDER.filter((cat) =>
    activites.some((a) => a.categorie === cat)
  );
  const catsAutres = Array.from(new Set(
    activites.map((a) => a.categorie).filter((c) => c && !CATEGORIES_ORDER.includes(c))
  ));
  const allCats = [...catsPresentes, ...catsAutres];

  const groups = filterCat
    ? [{ cat: filterCat, items: activites.filter((a) => a.categorie === filterCat) }]
    : allCats
        .map((cat) => ({ cat, items: activites.filter((a) => a.categorie === cat) }))
        .filter((g) => g.items.length > 0);

  return (
    <div className="enfants-section">
      <div className="enfants-section__header">
        <h2 className="enfants-section__title">
          Catalogue
        </h2>
      </div>

      {/* Sous-onglets Activités / Sorties */}
      <div style={{ display: 'flex', gap: 8, margin: '0 0 14px', background: 'rgba(201,184,232,0.15)', borderRadius: 14, padding: 4 }}>
        <button
          style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 600, background: sousOnglet === 'activites' ? 'white' : 'transparent', color: sousOnglet === 'activites' ? '#5B4A82' : '#9CA3AF', boxShadow: sousOnglet === 'activites' ? '0 2px 8px rgba(100,80,140,0.1)' : 'none', transition: 'all 0.2s' }}
          onClick={() => setSousOnglet('activites')}
        >📋 Activités</button>
        <button
          style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 600, background: sousOnglet === 'sorties' ? 'white' : 'transparent', color: sousOnglet === 'sorties' ? '#5B4A82' : '#9CA3AF', boxShadow: sousOnglet === 'sorties' ? '0 2px 8px rgba(100,80,140,0.1)' : 'none', transition: 'all 0.2s' }}
          onClick={() => setSousOnglet('sorties')}
        >🗺 Sorties</button>
      </div>

      {sousOnglet === 'sorties' && <SortiesModule />}

      {sousOnglet === 'activites' && allCats.length > 1 && (
        <div className="catalogue-filters">
          <button
            className={`catalogue-filter-btn${filterCat === '' ? ' catalogue-filter-btn--active' : ''}`}
            onClick={() => setFilterCat('')}
          >
            Toutes
          </button>
          {allCats.map((cat) => (
            <button
              key={cat}
              className={`catalogue-filter-btn${filterCat === cat ? ' catalogue-filter-btn--active' : ''}`}
              onClick={() => setFilterCat(cat)}
            >
              {CATEGORIES_ICONS[cat] ?? '🎯'} {cat}
            </button>
          ))}
        </div>
      )}

      {sousOnglet === 'activites' && isLoading && (
        <>
          <div className="enfants-skeleton" />
          <div className="enfants-skeleton" />
          <div className="enfants-skeleton" />
        </>
      )}

      {sousOnglet === 'activites' && !isLoading && groups.map((group) => (
        <div key={group.cat} className="catalogue-group">
          {!filterCat && (
            <div className="catalogue-group__header">
              <span>{CATEGORIES_ICONS[group.cat] ?? '🎯'}</span>
              <span className="catalogue-group__label">{group.cat}</span>
              <span className="catalogue-group__count">{group.items.length}</span>
            </div>
          )}
          {group.items.map((activite) => (
            <ActiviteCard
              key={activite.id}
              activite={activite}
              onAddToPlanning={setPlanningActivite}
            />
          ))}
        </div>
      ))}

      {sousOnglet === 'activites' && planningActivite && (
        <AddToPlanningModal
          activite={planningActivite}
          onClose={() => setPlanningActivite(null)}
        />
      )}

      {/* FAB créer activité */}
      {sousOnglet === 'activites' && (
        <button
          className="catalogue-fab"
          onClick={() => { setEditActivite(undefined); setShowActiviteForm(true); }}
          aria-label="Nouvelle activité"
        >
          +
        </button>
      )}

      {showActiviteForm && (
        <ActiviteForm
          editItem={editActivite}
          onClose={() => { setShowActiviteForm(false); setEditActivite(undefined); }}
        />
      )}
    </div>
  );
}
