import { useNavigate }        from 'react-router-dom';
import { useLiveQuery }      from 'dexie-react-hooks';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents }    from '../hooks/useTodayEvents';
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

  return (
    <section className="programme-section">
      <div className="programme-header">
        <h2 className="programme-header__title">Au programme aujourd'hui</h2>
        <button className="programme-header__voir" onClick={() => navigate('/programme-du-jour')}>Tout voir</button>
      </div>

      <div className="programme-carousel">

        {/* ── Carte ENFANTS ── */}
        <div className="programme-card programme-card--enfants" onClick={() => navigate('/activites-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--lavande">Enfants</span>
          <h3 className="programme-card__title">Activités<br />du jour</h3>
          <div className="programme-card__progress-bar">
            <div className="programme-card__progress-fill programme-card__progress-fill--lavande" style={{ width: `${pctActivites}%` }} />
          </div>
          <span className="programme-card__progress-label">{pctActivites}% effectuées</span>
        </div>

        {/* ── Carte PLANNING ── */}
        <div className="programme-card programme-card--planning" onClick={() => navigate('/programme-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--ambre">Planning</span>
          <h3 className="programme-card__title">
            {evenements.length} événement{evenements.length !== 1 ? 's' : ''}<br />aujourd'hui
          </h3>
          <div className="programme-card__progress-bar">
            <div className="programme-card__progress-fill programme-card__progress-fill--ambre" style={{ width: `${pctPlanning}%` }} />
          </div>
          <span className="programme-card__progress-label">{pctPlanning}% effectués</span>
        </div>

        {/* ── Carte MÉNAGE ── */}
        <div className="programme-card programme-card--menage" onClick={() => navigate('/menage-du-jour')} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--lilas">Ménage</span>
          <h3 className="programme-card__title">Tâches<br />ménagères</h3>
          <div className="programme-card__progress-bar">
            <div className="programme-card__progress-fill programme-card__progress-fill--lilas" style={{ width: `${pctMenage}%` }} />
          </div>
          <span className="programme-card__progress-label">{pctMenage}% effectuées</span>
        </div>

      </div>
    </section>
  );
}

export default WidgetProgrammeDuJour;
