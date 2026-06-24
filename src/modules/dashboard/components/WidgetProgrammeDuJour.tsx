import { useNavigate }        from 'react-router-dom';
import { useLiveQuery }      from 'dexie-react-hooks';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents }    from '../hooks/useTodayEvents';
import { toISODate }         from '../../../shared/utils/formatDate';
import { db }                from '../../../core/db/database';
import { nextDueDate }       from '../../menage/utils/nextDueDate';
import './WidgetProgrammeDuJour.css';

function formatHeure(date: string | Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function initiales(nom: string): string {
  return nom.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  { bg: '#ede7f6', text: '#6d28d9' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#d1fae5', text: '#065f46' },
];

function avatarColor(nom: string) {
  const idx = (nom.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function WidgetProgrammeDuJour() {
  const navigate   = useNavigate();
  const today      = toISODate(new Date());
  const activites  = useTodayActivites() ?? [];
  const evenements = useTodayEvents()    ?? [];

  const menageData = useLiveQuery(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();

    let total = 0; let faites = 0;
    const tachesAujourdhui: string[] = [];

    for (const t of all) {
      if (t.statut === 'fait' && t.completeeLe) {
        const d = new Date(t.completeeLe); d.setHours(0,0,0,0);
        if (d.getTime() === todayStart.getTime()) { total++; faites++; tachesAujourdhui.push(t.titre); continue; }
        continue;
      }
      const due = nextDueDate(t);
      if (!due) continue;
      const dueStart = new Date(due); dueStart.setHours(0,0,0,0);
      if (dueStart <= todayStart) { total++; tachesAujourdhui.push(t.titre); }
    }
    return { total, faites, titres: tachesAujourdhui.slice(0, 2) };
  }, [today]) ?? { total: 0, faites: 0, titres: [] };

  const totalItems = activites.length + evenements.length + (menageData.total > 0 ? 1 : 0);

  if (totalItems === 0) {
    return (
      <section className="pdj-section">
        <div className="pdj-header">
          <h2 className="pdj-title">Au programme aujourd'hui</h2>
        </div>
        <div className="pdj-empty">
          Journée libre — rien de planifié
        </div>
      </section>
    );
  }

  return (
    <section className="pdj-section">
      <div className="pdj-header">
        <h2 className="pdj-title">Au programme aujourd'hui</h2>
        <button className="pdj-voir" onClick={() => navigate('/programme-du-jour')}>
          Tout voir
        </button>
      </div>

      <div className="pdj-list">

        {/* ── Activités enfants ── */}
        {activites.map((a, i) => {
          const nom = (a.activite as any)?.nom ?? 'Activité';
          const membre = (a.membre as any);
          const prenomMembre = membre?.prenom ?? membre?.nom ?? '';
          const heure = a.datePrevue ? formatHeure(a.datePrevue) : null;
          const fait = a.statut === 'realisee';
          const color = prenomMembre ? avatarColor(prenomMembre) : AVATAR_COLORS[0];

          return (
            <button
              key={a.id ?? i}
              className={`pdj-row${fait ? ' pdj-row--done' : ''}`}
              onClick={() => navigate('/activites-du-jour')}
            >
              <span className="pdj-pill pdj-pill--lavande">Enfants</span>
              <span className="pdj-row-body">
                <span className="pdj-row-name">{nom}</span>
                {heure && <span className="pdj-row-time">{heure}</span>}
              </span>
              {prenomMembre && (
                <span
                  className="pdj-avatar"
                  style={{ background: color.bg, color: color.text }}
                >
                  {initiales(prenomMembre)}
                </span>
              )}
              <span className={`pdj-check${fait ? ' pdj-check--done' : ''}`}>
                {fait && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
            </button>
          );
        })}

        {/* ── Événements ── */}
        {evenements.map((e, i) => {
          const heure = formatHeure(e.dateDebut);
          const passe = new Date(e.dateDebut) < new Date();
          return (
            <button
              key={e.id ?? i}
              className={`pdj-row${passe ? ' pdj-row--done' : ''}`}
              onClick={() => navigate('/famille')}
            >
              <span className="pdj-pill pdj-pill--ambre">Planning</span>
              <span className="pdj-row-body">
                <span className="pdj-row-name">{e.titre ?? 'Événement'}</span>
                <span className="pdj-row-time">{heure}</span>
              </span>
              <span className={`pdj-check${passe ? ' pdj-check--done' : ''}`}>
                {passe && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
            </button>
          );
        })}

        {/* ── Ménage ── */}
        {menageData.total > 0 && (
          <button
            className={`pdj-row${menageData.faites === menageData.total ? ' pdj-row--done' : ''}`}
            onClick={() => navigate('/menage-du-jour')}
          >
            <span className="pdj-pill pdj-pill--vert">Ménage</span>
            <span className="pdj-row-body">
              <span className="pdj-row-name">
                {menageData.titres.join(' · ') || 'Tâches ménagères'}
              </span>
              <span className="pdj-row-time">
                {menageData.faites}/{menageData.total} faites
              </span>
            </span>
            <span className={`pdj-check${menageData.faites === menageData.total ? ' pdj-check--done' : ''}`}>
              {menageData.faites === menageData.total && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </span>
          </button>
        )}

      </div>
    </section>
  );
}

export default WidgetProgrammeDuJour;
