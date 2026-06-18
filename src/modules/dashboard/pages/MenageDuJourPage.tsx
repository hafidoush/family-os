import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { TacheService } from '../../maison/services/TacheService';
import { nextDueDate } from '../../menage/utils/nextDueDate';
import './MenageDuJourPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

function endOfWeek(): Date {
  const d = startOfDay(); d.setDate(d.getDate() + 6); d.setHours(23, 59, 59, 999); return d;
}

function getEmoji(titre: string): string {
  const t = titre.toLowerCase();
  if (t.includes('aspir') || t.includes('balay')) return '🧹';
  if (t.includes('lessive') || t.includes('linge'))  return '🧺';
  if (t.includes('vaisselle'))                        return '🍽️';
  if (t.includes('salle de bain') || t.includes('douche') || t.includes('wc') || t.includes('toilette')) return '🚿';
  if (t.includes('fenêtre') || t.includes('vitre'))  return '🪟';
  if (t.includes('lit') || t.includes('draps'))       return '🛏️';
  if (t.includes('poubelle') || t.includes('déchet')) return '🗑️';
  if (t.includes('sol') || t.includes('serpillère'))  return '🫧';
  if (t.includes('cuisine') || t.includes('plan de travail')) return '🍳';
  if (t.includes('poussière'))                        return '🧽';
  if (t.includes('rangement') || t.includes('ranger')) return '📦';
  return '🏡';
}

const FREQ_LABEL: Record<string, string> = {
  quotidienne:    'Quotidien',
  hebdomadaire:   'Hebdomadaire',
  bihebdomadaire: 'Tous les 2 sem.',
  mensuelle:      'Mensuel',
  trimestrielle:  'Trimestriel',
  semestrielle:   'Semestriel',
  annuelle:       'Annuel',
};

// ─── Hook données ─────────────────────────────────────────────────────────────

function useTaches() {
  return useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();

    const today     = startOfDay();
    const eow       = endOfWeek();
    const todayTime = today.getTime();

    const completedToday: typeof all   = [];
    const enRetard:       typeof all   = [];
    const aujourd_hui:    typeof all   = [];
    const cetteSemaine:   typeof all   = [];

    for (const t of all) {
      const due = nextDueDate(t);
      if (!due) continue;

      const dueTime = startOfDay(due).getTime();

      // Complétée aujourd'hui → section Aujourd'hui, case cochée
      if (t.statut === 'fait' && t.completeeLe) {
        const d = startOfDay(new Date(t.completeeLe));
        if (d.getTime() === todayTime) { completedToday.push(t); continue; }
        // Complétée un autre jour : si nextDueDate est dans le futur cette semaine
        // → montrer comme "à faire" dans Cette semaine (prochaine échéance)
        // Si nextDue <= aujourd'hui → elle est due à nouveau (en retard ou aujourd'hui)
      }

      // Classer par nextDueDate (pour toutes les tâches, fait ou non)
      if (dueTime < todayTime) {
        // Due à nouveau et dépassée → En retard (on affiche comme à_faire)
        enRetard.push({ ...t, statut: 'a_faire' });
      } else if (dueTime === todayTime) {
        // Due aujourd'hui → si déjà faite aujourd'hui on l'a capturée plus haut
        if (t.statut !== 'fait') aujourd_hui.push(t);
      } else if (due <= eow) {
        // Prochaine échéance dans la semaine → Cette semaine (non comptabilisée dans la jauge)
        cetteSemaine.push({ ...t, statut: 'a_faire' });
      }
      // Au-delà de la semaine → on n'affiche pas
    }

    const sort = (arr: typeof all) =>
      [...arr].sort((a, b) => (a.statut === 'fait' ? 1 : 0) - (b.statut === 'fait' ? 1 : 0));

    return {
      aujourd_hui:  sort([...aujourd_hui, ...completedToday]),
      enRetard:     sort(enRetard),
      cetteSemaine: sort(cetteSemaine),
    };
  }, []);
}

async function toggle(id: string, statut: string) {
  if (statut === 'fait') await TacheService.rouvrir(id);
  else await TacheService.completerTache(id);
}

// ─── Carte tâche ──────────────────────────────────────────────────────────────

function TaskCard({ t }: { t: { id: string; titre: string; statut: string; frequence?: string } }) {
  const done = t.statut === 'fait';
  return (
    <button
      className={`mdj-card${done ? ' mdj-card--done' : ''}`}
      onClick={() => toggle(t.id, t.statut)}
    >
      <div className="mdj-card__icon-wrap">
        {done
          ? <svg className="mdj-card__checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <span className="mdj-card__emoji">{getEmoji(t.titre)}</span>
        }
      </div>
      <span className="mdj-card__titre">{t.titre}</span>
      {t.frequence && (
        <span className="mdj-card__freq">
          {done ? 'Fait ✓' : (FREQ_LABEL[t.frequence] ?? t.frequence)}
        </span>
      )}
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title, items, showProgress = false,
}: {
  title: string;
  items: { id: string; titre: string; statut: string; frequence?: string }[];
  showProgress?: boolean;
}) {
  if (items.length === 0) return null;
  const faites   = items.filter(t => t.statut === 'fait').length;
  const total    = items.length;
  const pct      = Math.round((faites / total) * 100);
  const allDone  = faites === total;

  return (
    <div className="mdj-section">
      <div className="mdj-section__head">
        <span className="mdj-section__label">{title}</span>
        <span className={`mdj-section__tag${allDone ? ' mdj-section__tag--done' : ''}`}>
          {allDone ? '✓ Tout fait' : `${faites} / ${total}`}
        </span>
      </div>
      {showProgress && (
        <div className="mdj-bar">
          <div
            className="mdj-bar__fill"
            style={{
              width: `${pct}%`,
              background: allDone
                ? 'hsl(142, 50%, 52%)'
                : 'linear-gradient(90deg, hsl(262,48%,62%), hsl(280,52%,62%))',
            }}
          />
        </div>
      )}
      <div className="mdj-grid">
        {items.map(t => <TaskCard key={t.id} t={t} />)}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function MenageDuJourPage() {
  const navigate = useNavigate();
  const data = useTaches();

  // Jauge = uniquement aujourd'hui + en retard
  const itemsJauge = [...(data?.aujourd_hui ?? []), ...(data?.enRetard ?? [])];
  const total   = itemsJauge.length;
  const faites  = itemsJauge.filter(t => t.statut === 'fait').length;
  const pct     = total > 0 ? Math.round((faites / total) * 100) : 0;
  const allDone = total > 0 && faites === total;

  return (
    <div className="mdj-page">

      {/* Header */}
      <header className="mdj-header">
        <button className="mdj-back" onClick={() => navigate(-1)} aria-label="Retour">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="mdj-header__info">
          <h1 className="mdj-title">Ménage</h1>
          {total > 0 && (
            <p className="mdj-subtitle">
              {allDone ? 'Tout est fait — bravo ✨' : `${faites} sur ${total} tâches du jour`}
            </p>
          )}
        </div>
        {total > 0 && (
          <div className={`mdj-ring${allDone ? ' mdj-ring--done' : ''}`}>
            <svg viewBox="0 0 36 36" className="mdj-ring__svg">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="mdj-ring__bg"/>
              <circle
                cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset="25"
                strokeLinecap="round"
                className="mdj-ring__fill"
              />
            </svg>
            <span className="mdj-ring__pct">{pct}%</span>
          </div>
        )}
      </header>

      {/* Contenu */}
      <div className="mdj-content">
        {data === undefined ? (
          <>
            <div className="mdj-skeleton" />
            <div className="mdj-skeleton" style={{ height: 160, opacity: 0.6 }} />
          </>
        ) : (
          <>
            <Section title="En retard"     items={data.enRetard}     showProgress />
            <Section title="Aujourd'hui"   items={data.aujourd_hui}  showProgress />
            <Section title="Cette semaine" items={data.cetteSemaine} />

            {total === 0 && data.cetteSemaine.length === 0 && (
              <div className="mdj-empty-state">
                <span>✨</span>
                <p>Aucune tâche prévue</p>
                <p className="mdj-empty-state__sub">Ajoute-en depuis le module Ménage</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
