import { useNavigate }        from 'react-router-dom';
import { useLiveQuery }      from 'dexie-react-hooks';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents, useWeekEvents } from '../hooks/useTodayEvents';
import { toISODate }         from '../../../shared/utils/formatDate';
import { db }                from '../../../core/db/database';
import { nextDueDate }       from '../../menage/utils/nextDueDate';
import './WidgetProgrammeDuJour.css';

export function WidgetProgrammeDuJour() {
  const navigate   = useNavigate();
  const today      = toISODate(new Date());
  const activites  = useTodayActivites() ?? [];
  const evenements = useTodayEvents()    ?? [];

  // ENFANTS — % activités réalisées
  const totalActiv   = activites.length;
  const faitesActiv  = activites.filter(a => a.statut === 'realisee').length;
  const pctActivites = totalActiv > 0 ? Math.round((faitesActiv / totalActiv) * 100) : 0;

  // PLANNING — % événements passés
  const now = new Date();
  const pctPlanning = evenements.length > 0
    ? Math.round((evenements.filter(e => new Date(e.dateDebut) < now).length / evenements.length) * 100)
    : 0;

  // MÉNAGE
  const menageData = useLiveQuery(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();

    let total = 0; let faites = 0;
    for (const t of all) {
      if (t.statut === 'fait' && t.completeeLe) {
        const d = new Date(t.completeeLe); d.setHours(0,0,0,0);
        if (d.getTime() === todayStart.getTime()) { total++; faites++; continue; }
        continue;
      }
      const due = nextDueDate(t);
      if (!due) continue;
      const dueStart = new Date(due); dueStart.setHours(0,0,0,0);
      if (dueStart <= todayStart) { total++; }
    }
    return { total, faites };
  }, [today]) ?? { total: 0, faites: 0 };

  const pctMenage = menageData.total > 0
    ? Math.round((menageData.faites / menageData.total) * 100)
    : 0;

  // PROCHAINS ÉVÉNEMENTS — semaine hors aujourd'hui
  const allWeekEvents = useWeekEvents() ?? [];
  const nowDate = new Date();
  const todayY = nowDate.getFullYear(), todayM = nowDate.getMonth(), todayD = nowDate.getDate();
  const prochains = allWeekEvents.filter(e => {
    const d = new Date(e.dateDebut);
    return !(d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD);
  });

  return (
    <section className="programme-section">
      <div className="programme-header">
        <h2 className="programme-header__title">Au programme aujourd'hui</h2>
        <button className="programme-header__voir" onClick={() => navigate('/programme-du-jour')}>Tout voir</button>
      </div>

      <div className="programme-grid">

        {/* ── Carte ACTIVITÉS ── */}
        <div className="programme-card programme-card--enfants" onClick={() => navigate('/activites-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--activite">Activité</span>
          <h3 className="programme-card__title">Activités<br />du jour</h3>
          <div className="programme-card__progress-bar">
            <div className="programme-card__progress-fill programme-card__progress-fill--activite" style={{ width: `${pctActivites}%` }} />
          </div>
          <span className="programme-card__progress-label">{pctActivites}% effectuées</span>
        </div>

        {/* ── Carte PLANNING ── */}
        <div className="programme-card programme-card--planning" onClick={() => navigate('/programme-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--planning">Planning</span>
          <h3 className="programme-card__title">
            {evenements.length} événement{evenements.length !== 1 ? 's' : ''}<br />aujourd'hui
          </h3>
          {evenements.length > 0 && (
            <ul className="programme-card__events-list">
              {evenements.slice(0, 3).map(e => {
                const d = new Date(e.dateDebut);
                const heure = e.journeeEntiere ? '' : `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')} `;
                return <li key={e.id}>{heure}{e.titre}</li>;
              })}
            </ul>
          )}
          {evenements.length === 0 && (
            <>
              <div className="programme-card__progress-bar">
                <div className="programme-card__progress-fill programme-card__progress-fill--planning" style={{ width: `${pctPlanning}%` }} />
              </div>
              <span className="programme-card__progress-label">{pctPlanning}% effectués</span>
            </>
          )}
        </div>

        {/* ── Carte MÉNAGE ── */}
        <div className="programme-card programme-card--menage" onClick={() => navigate('/menage-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--menage">Ménage</span>
          <h3 className="programme-card__title">Tâches<br />ménagères</h3>
          <div className="programme-card__progress-bar">
            <div className="programme-card__progress-fill programme-card__progress-fill--menage" style={{ width: `${pctMenage}%` }} />
          </div>
          <span className="programme-card__progress-label">{pctMenage}% effectuées</span>
        </div>

        {/* ── Carte PROCHAINS ÉVÉNEMENTS ── */}
        <div className="programme-card programme-card--prochains" onClick={() => navigate('/programme-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--prochains">Prochains</span>
          <h3 className="programme-card__title">Prochains<br />événements</h3>
          {prochains.length > 0 ? (
            <ul className="programme-card__events-list">
              {prochains.slice(0, 3).map(e => {
                const d = new Date(e.dateDebut);
                const jours = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
                const label = `${jours[d.getDay()]} `;
                return <li key={e.id}>{label}{e.titre}</li>;
              })}
            </ul>
          ) : (
            <>
              <div className="programme-card__progress-bar">
                <div className="programme-card__progress-fill programme-card__progress-fill--prochains" style={{ width: '0%' }} />
              </div>
              <span className="programme-card__progress-label">Semaine tranquille</span>
            </>
          )}
        </div>

      </div>
    </section>
  );
}

export default WidgetProgrammeDuJour;
