import { useState }           from 'react';
import { useNavigate }        from 'react-router-dom';
import { useLiveQuery }      from 'dexie-react-hooks';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents, useWeekEvents } from '../hooks/useTodayEvents';
import { toISODate }         from '../../../shared/utils/formatDate';
import { db }                from '../../../core/db/database';
import { nextDueDate }       from '../../menage/utils/nextDueDate';
import { MenageModal }        from './WidgetMenage';
import { useTachesDuJourEngine } from '../../menage/hooks/useTachesDuJourEngine';
import type { FrequenceTache } from '@shared/types/entities';
import './WidgetProgrammeDuJour.css';

export function WidgetProgrammeDuJour() {
  const navigate   = useNavigate();
  const [menageModalOpen, setMenageModalOpen] = useState(false);
  const today      = toISODate(new Date());
  const activites  = useTodayActivites() ?? [];
  const evenements = useTodayEvents()    ?? [];

  // Activités du programme IA planifiées aujourd'hui
  const progActivites = useLiveQuery(
    () => db.activitesProgramme
      .filter(a => !a.archive && !a.deletedAt && a.datePlanifiee === today)
      .toArray(),
    [today],
    []
  ) ?? [];

  // ENFANTS — % activités réalisées (planif + programme IA)
  const totalActiv   = activites.length + progActivites.length;
  const faitesActiv  = activites.filter(a => a.statut === 'realisee').length
                     + progActivites.filter(a => a.statutRealisation === 'realise').length;
  const pctActivites = totalActiv > 0 ? Math.round((faitesActiv / totalActiv) * 100) : 0;

  // PLANNING — % événements passés
  const now = new Date();
  const pctPlanning = evenements.length > 0
    ? Math.round((evenements.filter(e => new Date(e.dateDebut) < now).length / evenements.length) * 100)
    : 0;

  // MÉNAGE — moteur
  const menageTasks = useTachesDuJourEngine('normal') ?? [];
  const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const isCompletedToday = (t: { statut?: string; completeeLe?: Date | string }) => {
    if (t.statut !== 'fait' || !t.completeeLe) return false;
    const c = new Date(t.completeeLe); c.setHours(0,0,0,0);
    return c.getTime() === todayMidnight;
  };
  const menageFaites   = menageTasks.filter(isCompletedToday).length;
  const menageTotal    = menageTasks.length;
  const menageRestants = menageTotal - menageFaites;
  const menageDurMin   = menageTasks.filter(t => !isCompletedToday(t)).reduce((s, t) => s + (t.dureeEstimee ?? 10), 0);
  const pctMenage      = menageTotal > 0 ? Math.round((menageFaites / menageTotal) * 100) : 0;
  const menageAllDone  = menageTotal > 0 && menageFaites === menageTotal;

  const FREQ_DOT: Partial<Record<FrequenceTache, string>> = {
    quotidienne: '#1D9E75', hebdomadaire: '#378ADD', bihebdomadaire: '#378ADD',
    mensuelle: '#7F77DD', trimestrielle: '#BA7517', semestrielle: '#BA7517', annuelle: '#BA7517',
  };

  // PROCHAINS ÉVÉNEMENTS — semaine hors aujourd'hui
  const allWeekEvents = useWeekEvents() ?? [];
  const nowDate = new Date();
  const todayY = nowDate.getFullYear(), todayM = nowDate.getMonth(), todayD = nowDate.getDate();
  const prochains = allWeekEvents.filter(e => {
    const d = new Date(e.dateDebut);
    return !(d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD);
  });

  return (
    <>
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
        <div className="programme-card programme-card--menage" onClick={() => setMenageModalOpen(true)} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--menage">MÉNAGE</span>
          <div className="pm-menage__dots-row">
            {menageTasks.slice(0, 8).map(t => (
              <span
                key={t.id}
                className="pm-menage__dot"
                style={{
                  background: FREQ_DOT[t.frequence ?? 'ponctuelle'] ?? '#9B8DB5',
                  opacity: isCompletedToday(t) ? 0.2 : 1,
                }}
              />
            ))}
            <span className="pm-menage__counter">{menageFaites}/{menageTotal}</span>
          </div>
          <h3 className="programme-card__title">Tâches ménagères</h3>
          <div className="programme-card__progress-bar">
            <div className="programme-card__progress-fill programme-card__progress-fill--menage" style={{ width: `${pctMenage}%` }} />
          </div>
          <span className="programme-card__progress-label">
            {menageAllDone
              ? 'Tout fait ✓'
              : `~${menageDurMin} min · ${menageRestants} restante${menageRestants > 1 ? 's' : ''}`
            }
          </span>
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

    {menageModalOpen && <MenageModal onClose={() => setMenageModalOpen(false)} />}
    </>
  );
}

export default WidgetProgrammeDuJour;
