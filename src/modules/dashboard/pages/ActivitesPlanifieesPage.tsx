import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../core/db/database';
import { withUpdate } from '../../../core/db/helpers';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useActivitesPlacer } from '../hooks/useActivitesPlacer';
import type { PlanificationActivite as PlanifType } from '../../../shared/types';
import './ActivitesPlanifieesPage.css';

// ── Données préparation ───────────────────────────────────────────────────────

const PREPARATIONS: Record<string, string> = {
  'Bac riz coloré': 'La veille : mélanger le riz avec quelques gouttes de colorant alimentaire et laisser sécher toute la nuit à plat sur du papier.',
  'Bac glace pingouins': 'La veille : congeler des glaçons. Le jour J : sortir 30 min avant pour que la glace ne soit pas trop dure.',
  'Bac glace objets': "La veille : placer les petits objets dans des moules à glaçons, remplir d'eau et congeler.",
  'Bac mousse sensorielle': 'Juste avant : mélanger la mousse à raser avec le colorant. À faire au moment car la mousse s\'affaisse.',
  'Bac mousse colorée': 'Juste avant : préparer la mousse colorée par zones dans le bac. Prévoir des vêtements qui ne craignent rien.',
  'Lavage de voitures cacao': 'Juste avant : diluer le cacao dans l\'eau tiède. Prévoir une serviette et des vêtements imperméables.',
  'Bac dinosaures archéologie': 'La veille ou le matin : enfouir les dinosaures dans le sable ou la farine. Laisser durcir si possible.',
  'Bac semoule cachée': '5 min avant : cacher les objets sous la semoule. Varier les emplacements à chaque session.',
  'Bac épices': "5 min avant : verser chaque épice dans un bol séparé. Vérifier qu'aucune épice n'est irritante pour les yeux.",
  'Mini marché': '15 min avant : étiqueter les aliments avec des prix simples (1, 2, 3). Préparer les pièces jouets dans un porte-monnaie.',
  'Chasse aux trésors': '20 min avant : rédiger ou dessiner les indices, cacher le trésor et placer les indices dans l\'ordre.',
  'Parcours moteur jardin': '15 min avant : installer et sécuriser le parcours. Vérifier que le sol est dégagé et sans danger.',
  'Activité multi-étapes': '10 min avant : rassembler tout le matériel et lire les étapes entièrement avant de commencer.',
  'Collage quantités': '5 min avant : imprimer ou préparer les fiches avec les chiffres. Disposer les gommettes par couleur.',
  'Dictée imagée': "5 min avant : préparer les fiches et choisir les images adaptées au niveau de l'enfant.",
  'Puzzle de quantités': 'Vérifier que toutes les pièces sont présentes avant de commencer.',
  'Lego fin': 'Trier les pièces par couleur ou taille si activité guidée. Pour construction libre, verser directement.',
};

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

// ── Types de retour du hook ───────────────────────────────────────────────────

type PlanifWithActivite = Omit<PlanifType, 'activite'> & {
  activite: import('../../../shared/types').Activite | undefined;
  membre: import('../../../shared/types').Membre | undefined;
};

// ── Carte déroulante ──────────────────────────────────────────────────────────

function ActivitePlanifCard({ planif }: { planif: PlanifWithActivite }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(planif.statut === 'realisee');

  const activite = planif.activite;
  if (!activite) return null;

  const preparation = PREPARATIONS[activite.nom] ?? null;
  const emoji = CATEGORIES_ICONS[activite.categorie] ?? '🎯';

  async function handleCommencer(e: React.MouseEvent) {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (!done) {
        await db.planificationsActivites.update(planif.id, withUpdate({ statut: 'realisee' }));
        setDone(true);
      } else {
        await db.planificationsActivites.update(planif.id, withUpdate({ statut: 'planifiee' }));
        setDone(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`activite-card${done ? ' activite-card--realisee' : ''}`}>
      <button
        className="activite-card__header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="activite-card__emoji">{emoji}</span>
        <div className="activite-card__meta">
          <p className="activite-card__nom">{activite.nom}</p>
          <div className="activite-card__pills">
            {activite.dureeEstimee && (
              <span className="activite-card__pill activite-card__pill--purple">⏱ {activite.dureeEstimee} min</span>
            )}
            {activite.ageMin !== undefined && activite.ageMax !== undefined && (
              <span className="activite-card__pill activite-card__pill--blue">{activite.ageMin}–{activite.ageMax} mois</span>
            )}
            {done && <span className="activite-card__pill activite-card__pill--green">Réalisée</span>}
          </div>
        </div>
        <span className="activite-card__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="activite-card__body">
          {activite.objectifPedagogique && (
            <div className="activite-row">
              <span className="activite-row__icon">🎯</span>
              <div>
                <p className="activite-row__label">Objectif</p>
                <p className="activite-row__value">{activite.objectifPedagogique}</p>
              </div>
            </div>
          )}
          {activite.dureeEstimee && (
            <div className="activite-row">
              <span className="activite-row__icon">⏱</span>
              <div>
                <p className="activite-row__label">Durée</p>
                <p className="activite-row__value">{activite.dureeEstimee} minutes</p>
              </div>
            </div>
          )}
          {activite.materiel && activite.materiel.length > 0 && (
            <div className="activite-row">
              <span className="activite-row__icon">🧰</span>
              <div>
                <p className="activite-row__label">Matériel</p>
                <ul className="activite-materiel">
                  {activite.materiel.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            </div>
          )}
          {preparation && (
            <div className="activite-row activite-row--prep">
              <span className="activite-row__icon">📋</span>
              <div>
                <p className="activite-row__label">Préparation en amont</p>
                <p className="activite-row__value">{preparation}</p>
              </div>
            </div>
          )}
          <button
            className={`activite-card__btn-commencer ${done ? 'activite-card__btn-commencer--done' : 'activite-card__btn-commencer--start'}`}
            onClick={handleCommencer}
            disabled={loading}
          >
            {loading ? '...' : done ? '✓ Activité réalisée' : 'Commencer'}
          </button>

          <button
            className="activite-card__btn-replier"
            onClick={() => setExpanded(false)}
            aria-label="Replier la fiche"
          >
            Replier ▲
          </button>
        </div>
      )}
    </div>
  );
}

// ── Composant carte "À placer" ────────────────────────────────────────────────

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const JOURS_SEMAINE_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function getJoursSemaineCourante(): { label: string; labelCourt: string; date: string; isToday: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Lundi de cette semaine
  const lundi = new Date(today);
  const jourSemaine = today.getDay(); // 0=dim, 1=lun…
  const diffLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  lundi.setDate(today.getDate() + diffLundi);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    const isToday = d.getTime() === today.getTime();
    return {
      label: JOURS_SEMAINE_FULL[i],
      labelCourt: JOURS_SEMAINE[i],
      date: d.toISOString().split('T')[0],
      isToday,
    };
  });
}

function APlacer() {
  const activites = useActivitesPlacer();
  const [placing, setPlacing] = useState<string | null>(null);
  const jours = getJoursSemaineCourante();
  const today = new Date().toISOString().split('T')[0];

  if (activites.length === 0) return null;

  async function placer(activiteId: string, date: string) {
    await db.activitesProgramme.update(activiteId, withUpdate({
      datePlanifiee: date,
      statutRealisation: 'planifie',
    }));
    setPlacing(null);
  }

  const emoji = (titre: string) => CATEGORIES_ICONS[titre] ?? '🎯';

  return (
    <div className="aplacer-section">
      <h2 className="aplacer-section__titre">À placer cette semaine</h2>
      <p className="aplacer-section__sub">Appuyez sur une activité pour choisir son jour</p>
      <div className="aplacer-list">
        {activites.map(a => (
          <div key={a.id} className={`aplacer-card${placing === a.id ? ' aplacer-card--open' : ''}`}>
            <button
              className="aplacer-card__header"
              onClick={() => setPlacing(placing === a.id ? null : a.id)}
            >
              <span className="aplacer-card__emoji">{emoji(a.titre)}</span>
              <div className="aplacer-card__info">
                <span className="aplacer-card__nom">{a.titre}</span>
                <span className="aplacer-card__prog">{a.programmeNom}</span>
              </div>
              {a.semainePasse && (
                <span className="aplacer-card__badge">Sem. passée</span>
              )}
              {a.duree && (
                <span className="aplacer-card__duree">⏱ {a.duree} min</span>
              )}
            </button>

            {placing === a.id && (
              <div className="aplacer-card__jours">
                {jours.map(j => (
                  <button
                    key={j.date}
                    className={`aplacer-jour${j.isToday ? ' aplacer-jour--today' : ''}${j.date < today ? ' aplacer-jour--past' : ''}`}
                    onClick={() => placer(a.id, j.date)}
                  >
                    <span className="aplacer-jour__label">{j.labelCourt}</span>
                    <span className="aplacer-jour__date">{j.date.slice(8)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section activités programme placées aujourd'hui ───────────────────────────

function ActiviteProgrammeCard({ activite }: { activite: import('../../../shared/types').ActiviteProgramme }) {
  const [done, setDone] = useState(activite.statutRealisation === 'realise');
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    try {
      const newStatut = done ? 'planifie' : 'realise';
      await db.activitesProgramme.update(activite.id, withUpdate({
        statutRealisation: newStatut,
        dateRealisation: done ? undefined : new Date().toISOString().split('T')[0],
      }));
      setDone(!done);
    } finally {
      setLoading(false);
    }
  }

  const emoji = CATEGORIES_ICONS[activite.titre] ?? '🎯';

  return (
    <div className={`activite-card activite-card--programme${done ? ' activite-card--realisee' : ''}`}>
      <div className="activite-card__header" style={{ cursor: 'default' }}>
        <span className="activite-card__emoji">{emoji}</span>
        <div className="activite-card__meta">
          <p className="activite-card__nom">{activite.titre}</p>
          <div className="activite-card__pills">
            {activite.duree && (
              <span className="activite-card__pill activite-card__pill--purple">⏱ {activite.duree} min</span>
            )}
            <span className="activite-card__pill activite-card__pill--blue">Programme</span>
            {done && <span className="activite-card__pill activite-card__pill--green">Réalisée</span>}
          </div>
        </div>
        <button
          className={`activite-card__btn-commencer ${done ? 'activite-card__btn-commencer--done' : 'activite-card__btn-commencer--start'}`}
          style={{ minWidth: 90, fontSize: '0.75rem' }}
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? '...' : done ? '✓ Réalisée' : 'Commencer'}
        </button>
      </div>
    </div>
  );
}

function useTodayProgrammeActivites() {
  const today = new Date().toISOString().split('T')[0];
  return useLiveQuery(
    () => db.activitesProgramme
      .filter(a => !a.archive && !a.deletedAt && a.datePlanifiee === today)
      .toArray(),
    [],
    []
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ActivitesPlanifieesPage() {
  const navigate = useNavigate();
  const planifs = useTodayActivites() ?? [];
  const progActivites = useTodayProgrammeActivites();

  const hasContent = planifs.length > 0 || (progActivites && progActivites.length > 0);

  return (
    <div className="activites-page">
      <header className="activites-page__header">
        <button className="activites-page__back" onClick={() => navigate(-1)} aria-label="Retour">←</button>
        <h1 className="activites-page__title">Activités planifiées</h1>
      </header>

      <div className="activites-page__content">
        {!hasContent ? (
          <div className="activites-page__empty">
            <span className="activites-page__empty-icon">🌿</span>
            <p className="activites-page__empty-text">
              Aucune activité planifiée pour aujourd'hui.<br />
              Placez-en depuis la section ci-dessous.
            </p>
          </div>
        ) : (
          <>
            {planifs.map(p => (
              <ActivitePlanifCard key={p.id} planif={p as PlanifWithActivite} />
            ))}
            {progActivites?.map(a => (
              <ActiviteProgrammeCard key={a.id} activite={a} />
            ))}
          </>
        )}

        <APlacer />
      </div>
    </div>
  );
}
