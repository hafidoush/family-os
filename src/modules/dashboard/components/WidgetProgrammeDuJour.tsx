import { useNavigate }        from 'react-router-dom';
import { useLiveQuery }      from 'dexie-react-hooks';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents }    from '../hooks/useTodayEvents';
import { useDayTasks }       from '../hooks/useDayTasks';
import { toISODate }         from '../../../shared/utils/formatDate';
import { db }                from '../../../core/db/database';
import { withUpdate }        from '../../../core/db/helpers';
import { nextDueDate }       from '../../menage/utils/nextDueDate';
import type { Pensee }       from '../../../shared/types';
import './WidgetProgrammeDuJour.css';

function formatHeure(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function WidgetProgrammeDuJour() {
  const navigate   = useNavigate();
  const today      = toISODate(new Date());
  const activites  = useTodayActivites() ?? [];
  const evenements = useTodayEvents()    ?? [];
  const allTasks   = useDayTasks(today)  ?? [];

  // ENFANTS — % activités réalisées
  const totalActiv   = activites.length;
  const faitesActiv  = activites.filter(a => a.statut === 'realisee').length;
  const pctActivites = totalActiv > 0 ? Math.round((faitesActiv / totalActiv) * 100) : 0;

  // PLANNING — % événements passés
  const now = new Date();
  const pctPlanning = evenements.length > 0
    ? Math.round((evenements.filter(e => new Date(e.dateDebut) < now).length / evenements.length) * 100)
    : 0;

  // MÉNAGE — aujourd'hui + en retard (même périmètre que la jauge de MenageDuJourPage)
  const menageData = useLiveQuery(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const all = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();

    let total = 0; let faites = 0;
    for (const t of all) {
      // Complétée aujourd'hui → compte dans la jauge
      if (t.statut === 'fait' && t.completeeLe) {
        const d = new Date(t.completeeLe); d.setHours(0,0,0,0);
        if (d.getTime() === todayStart.getTime()) { total++; faites++; continue; }
        continue; // complétée un autre jour → pas dans le périmètre du jour
      }
      // Non faite : inclure si due aujourd'hui ou en retard
      const due = nextDueDate(t);
      if (!due) continue;
      const dueStart = new Date(due); dueStart.setHours(0,0,0,0);
      if (dueStart <= todayStart) { total++; } // aujourd'hui ou retard
    }
    return { total, faites };
  }, [today]) ?? { total: 0, faites: 0 };

  const pctMenage = menageData.total > 0
    ? Math.round((menageData.faites / menageData.total) * 100)
    : 0;

  // À FAIRE — pensées marquées aFaire
  const tachesAFaire = useLiveQuery(
    () => db.pensees
      .filter(p => !p.deletedAt && !p.archive && p.statut !== 'traitee' && !!p.aFaire)
      .toArray(),
    []
  ) ?? [];
  const totalAFaire = tachesAFaire.length;

  return (
    <section className="programme-section">
      <div className="programme-header">
        <h2 className="programme-header__title">Programme du jour</h2>
        <button className="programme-header__voir">Tout voir</button>
      </div>

      <div className="programme-carousel">

        {/* ── Carte ENFANTS ── */}
        <div className="programme-card programme-card--enfants" onClick={() => navigate('/activites-du-jour')} role="button" tabIndex={0}>
          <img className="programme-card__img" src={`${import.meta.env.BASE_URL}65E090F6-C356-4597-9788-880E50DE2E0C.PNG`} alt="" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--lavande">Enfants</span>
          <h3 className="programme-card__title">Activités<br />du jour</h3>
          <div className="programme-card__progress-bar">
            <div
              className="programme-card__progress-fill programme-card__progress-fill--lavande"
              style={{ width: `${pctActivites}%` }}
            />
          </div>
          <span className="programme-card__progress-label">{pctActivites}% effectuées</span>
        </div>

        {/* ── Carte PLANNING ── */}
        <div className="programme-card programme-card--planning" onClick={() => navigate('/programme-du-jour')} role="button" tabIndex={0}>
          <img
            className="programme-card__img"
            src={`${import.meta.env.BASE_URL}BD1C825D-2DF1-4603-A2D1-1ED518BCEE5C.PNG`}
            alt=""
            aria-hidden="true"
          />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--ambre">Planning</span>
          <h3 className="programme-card__title">
            {evenements.length} événement{evenements.length !== 1 ? 's' : ''}<br />aujourd'hui
          </h3>
          <div className="programme-card__progress-bar">
            <div
              className="programme-card__progress-fill programme-card__progress-fill--ambre"
              style={{ width: `${pctPlanning}%` }}
            />
          </div>
          <span className="programme-card__progress-label">{pctPlanning}% effectués</span>
        </div>

        {/* ── Carte MÉNAGE ── */}
        <div className="programme-card programme-card--menage" onClick={() => navigate('/menage-du-jour')} role="button" tabIndex={0}>
          <img
            className="programme-card__img"
            src={`${import.meta.env.BASE_URL}976D5C85-C02B-4388-8519-E06450B11B56.PNG`}
            alt=""
            aria-hidden="true"
          />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--lilas">Ménage</span>
          <h3 className="programme-card__title">Tâches<br />ménagères</h3>
          <div className="programme-card__progress-bar">
            <div
              className="programme-card__progress-fill programme-card__progress-fill--lilas"
              style={{ width: `${pctMenage}%` }}
            />
          </div>
          <span className="programme-card__progress-label">{pctMenage}% effectuées</span>
        </div>

      </div>
    </section>
  );
}

export default WidgetProgrammeDuJour;
