import { useState, useRef, useCallback } from 'react';
import { useNavigate }        from 'react-router-dom';
import { useLiveQuery }      from 'dexie-react-hooks';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { useTodayEvents, useWeekEvents } from '../hooks/useTodayEvents';
import { toISODate }         from '../../../shared/utils/formatDate';
import { db }                from '../../../core/db/database';
import { MenageModal }        from './WidgetMenage';
import { ActivitesModal }     from './WidgetActivites';
import { useTachesDuJourEngine } from '../../menage/hooks/useTachesDuJourEngine';
import type { FrequenceTache } from '@shared/types/entities';
import './WidgetProgrammeDuJour.css';

function todayPretKey() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `activites_materiel_pret_${ymd}`;
}

// ─── Modal générique pour aperçu card dashboard ───────────────────────────────

interface PreviewItem {
  id: string;
  label: string;
  sublabel?: string;
  done?: boolean;
}

function PreviewModal({
  color, modalBg, title, meta, progPct, items, ctaLabel, emptyText, onCta, onClose,
}: {
  color: string;
  modalBg: string;
  title: string;
  meta: string;
  progPct: number;
  items: PreviewItem[];
  ctaLabel: string;
  emptyText: string;
  onCta: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [thumbPct, setThumbPct] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const max = scrollHeight - clientHeight;
    setScrolled(scrollTop > 40);
    setThumbPct(max > 0 ? scrollTop / max : 0);
  }, []);

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="wm-modal-overlay" onClick={onClose}>
      <div className="wm-modal" style={{ background: modalBg }} onClick={e => e.stopPropagation()}>

        {/* ── En-tête fixe ── */}
        <div className="wm-modal__top">
          <button className="wm-modal__close" onClick={onClose} aria-label="Fermer">✕</button>
          <div className="wm-modal__header">
            <span className="wm-modal__title" style={{ color: '#1E1C2E' }}>{title}</span>
            <span className="wm-modal__meta" style={{ color: color }}>{meta}</span>
          </div>
          {progPct > 0 && (
            <div className="wm-modal__prog-bar">
              <div className="wm-modal__prog-fill" style={{ width: `${progPct}%`, background: color }} />
            </div>
          )}
        </div>

        {/* ── Zone scrollable ── */}
        <div className="wm-modal__scroll-wrap">
          <div className="wm-modal__scroll" ref={scrollRef} onScroll={onScroll}>
            <div className="wm-modal__tasks">
              {items.length === 0 ? (
                <p className="wm-modal__empty">{emptyText}</p>
              ) : (
                items.map(item => (
                  <div key={item.id} className={`wm-modal__task${item.done ? ' done' : ''}`} style={{ cursor: 'default' }}>
                    <span
                      className="wm-modal__task-check"
                      style={item.done
                        ? { background: color, borderColor: color }
                        : { borderColor: color + '88' }
                      }
                    >
                      {item.done && '✓'}
                    </span>
                    <span className="wm-modal__task-titre">{item.label}</span>
                    {item.sublabel && (
                      <span style={{ fontSize: 11, color: '#9B8DB5', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {items.length > 4 && (
            <div className="wm-scroll-track">
              <div className="wm-scroll-thumb" style={{ top: `${thumbPct * 70}%`, background: color + 'A0' }} />
            </div>
          )}

          {scrolled && (
            <button className="wm-scroll-top" style={{ color }} onClick={scrollToTop} aria-label="Retour en haut">↑</button>
          )}
        </div>

        {/* ── CTA fixe en bas ── */}
        <div className="wm-modal__bottom">
          <button className="wm-modal__cta" style={{ background: color }} onClick={onCta}>
            {ctaLabel}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Widget principal ─────────────────────────────────────────────────────────

export function WidgetProgrammeDuJour() {
  const navigate   = useNavigate();
  const [menageModalOpen,    setMenageModalOpen]    = useState(false);
  const [activitesModalOpen, setActivitesModalOpen] = useState(false);
  const [planningModalOpen,  setPlanningModalOpen]  = useState(false);
  const [prochainModalOpen,  setProchainModalOpen]  = useState(false);
  const [pretActivites,      setPretActivites]      = useState(() => !!localStorage.getItem(todayPretKey()));

  const today      = toISODate(new Date());
  const activites  = useTodayActivites() ?? [];
  const evenements = useTodayEvents()    ?? [];

  const progActivites = useLiveQuery(
    () => db.activitesProgramme
      .filter(a => !a.archive && !a.deletedAt && a.datePlanifiee === today)
      .toArray(),
    [today],
    []
  ) ?? [];

  // ENFANTS — % activités réalisées
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
  const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

  // Données enrichies pour la card Activités
  const activCats = [...new Set(
    activites.map(a => (a.activite as { categorie?: string } | undefined)?.categorie).filter(Boolean) as string[]
  )];
  const activRestantes = totalActiv - faitesActiv;
  const activDureeMin = activites
    .filter(a => a.statut !== 'realisee')
    .reduce((s, a) => s + ((a.activite as { dureeEstimee?: number } | undefined)?.dureeEstimee ?? 15), 0);

  // Items pour les modals
  const activitesItems: PreviewItem[] = [
    ...activites.map(a => ({ id: String(a.id), label: (a.activite as { nom?: string } | undefined)?.nom ?? '–', done: a.statut === 'realisee' })),
    ...progActivites.map(a => ({ id: String(a.id) + '_p', label: a.titre ?? '', done: a.statutRealisation === 'realise' })),
  ];

  const planningItems: PreviewItem[] = evenements.map(e => {
    const d = new Date(e.dateDebut);
    const heure = e.journeeEntiere ? 'Journée' : `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
    // Le Planning affiche des événements, pas des tâches — pas de notion de "fait"
    return { id: String(e.id), label: e.titre ?? '', sublabel: heure, done: false };
  });

  const prochainItems: PreviewItem[] = prochains.map(e => {
    const d = new Date(e.dateDebut);
    return { id: String(e.id), label: e.titre ?? '', sublabel: JOURS[d.getDay()] };
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
        <div
          className={`programme-card programme-card--enfants${pretActivites ? ' programme-card--pret' : ''}`}
          onClick={() => setActivitesModalOpen(true)}
          role="button"
          tabIndex={0}
        >
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--activite">ACTIVITÉ</span>

          {/* Tags catégories + compteur */}
          <div className="pm-act__tags-row">
            {activCats.slice(0, 2).map(cat => (
              <span key={cat} className="pm-act__cat-tag">{cat}</span>
            ))}
            {activCats.length > 2 && <span className="pm-act__cat-tag">+{activCats.length - 2}</span>}
            <span className="pm-act__count">{faitesActiv}/{totalActiv}</span>
            {pretActivites && <span className="pm-act__pret-badge">Prêt</span>}
          </div>

          <h3 className="programme-card__title">Activités du jour</h3>
          <div className="programme-card__progress-bar">
            <div
              className="programme-card__progress-fill programme-card__progress-fill--activite"
              style={{ width: `${pctActivites}%` }}
            />
          </div>
          <span className="programme-card__progress-label">
            ~{activDureeMin} min · {activRestantes} restante{activRestantes !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Carte PLANNING ── */}
        <div className="programme-card programme-card--planning" onClick={() => setPlanningModalOpen(true)} role="button" tabIndex={0}>
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
        <div className="programme-card programme-card--prochains" onClick={() => setProchainModalOpen(true)} role="button" tabIndex={0}>
          <div className="programme-card__deco" aria-hidden="true" />
          <div className="programme-card__glass" />
          <span className="programme-card__badge programme-card__badge--prochains">Prochains</span>
          <h3 className="programme-card__title">
            {prochains.length} événement{prochains.length !== 1 ? 's' : ''}<br />cette semaine
          </h3>
          {prochains.length > 0 && (
            <ul className="programme-card__events-list">
              {prochains.slice(0, 3).map(e => {
                const d = new Date(e.dateDebut);
                return <li key={e.id}>{JOURS[d.getDay()]} · {e.titre}</li>;
              })}
            </ul>
          )}
        </div>

      </div>
    </section>

    {/* ── Modals ── */}

    {menageModalOpen && (
      <MenageModal onClose={() => setMenageModalOpen(false)} />
    )}

    {activitesModalOpen && (
      <ActivitesModal
        onClose={() => { setActivitesModalOpen(false); setPretActivites(!!localStorage.getItem(todayPretKey())); }}
        onPret={() => setPretActivites(true)}
      />
    )}

    {planningModalOpen && (
      <PreviewModal
        color="#D4990A"
        modalBg="#FDF3DC"
        title="Agenda du jour"
        meta={evenements.length === 0 ? 'Journée libre' : `${evenements.length} événement${evenements.length > 1 ? 's' : ''}`}
        progPct={pctPlanning}
        items={planningItems}
        ctaLabel="Voir le planning"
        emptyText="Aucun événement aujourd'hui"
        onCta={() => { setPlanningModalOpen(false); navigate('/programme-du-jour'); }}
        onClose={() => setPlanningModalOpen(false)}
      />
    )}

    {prochainModalOpen && (
      <PreviewModal
        color="#FD7746"
        modalBg="#FEF0EB"
        title="Cette semaine"
        meta={prochains.length === 0 ? 'Semaine tranquille' : `${prochains.length} événement${prochains.length > 1 ? 's' : ''} à venir`}
        progPct={0}
        items={prochainItems}
        ctaLabel="Voir la semaine"
        emptyText="Semaine tranquille"
        onCta={() => { setProchainModalOpen(false); navigate('/programme-du-jour'); }}
        onClose={() => setProchainModalOpen(false)}
      />
    )}
    </>
  );
}

export default WidgetProgrammeDuJour;
