/**
 * FAMILY OS — WidgetActivites
 * Dashboard card : progression du jour + prochaine activité.
 * Au clic → ActiviteJourney (vue cartes visuelles).
 */

import { useState } from 'react';
import { useTodayActivites } from '../hooks/useTodayActivites';
import { ActiviteSession, type ActiviteSessionItem } from './ActiviteSession';
import { ActiviteQuickSheet } from './ActiviteQuickSheet';
import { ActiviteJourney } from './ActiviteJourney';
import './WidgetActivites.css';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export function WidgetActivites() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiviteSessionItem | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const activites = useTodayActivites();

  if (activites === undefined) {
    return (
      <div className="widget-card area-activites">
        <div className="widget-header">
          <span className="widget-title">Activités enfants</span>
        </div>
        <div className="widget-skeleton tall" />
      </div>
    );
  }

  const items = activites;
  const totalFaites = items.filter(a => a.statut === 'realisee' || doneIds.has(a.id)).length;
  const total = items.length;
  const progression = total > 0 ? totalFaites / total : 0;

  // Prochaine activité à venir (non réalisée)
  const sorted = [...items].sort((a, b) => {
    if (a.heurePrevue && b.heurePrevue) return a.heurePrevue.localeCompare(b.heurePrevue);
    if (a.heurePrevue) return -1;
    if (b.heurePrevue) return 1;
    return 0;
  });
  const prochaine = sorted.find(a => a.statut !== 'realisee' && !doneIds.has(a.id));

  // Arc SVG pour la progression
  const RADIUS = 18;
  const CIRC = 2 * Math.PI * RADIUS;
  const strokeDash = progression * CIRC;
  const allDone = total > 0 && totalFaites === total;

  return (
    <>
      <div
        className="widget-card area-activites widget-activites"
        onClick={() => total > 0 && setJourneyOpen(true)}
        style={{ cursor: total > 0 ? 'pointer' : 'default' }}
        role={total > 0 ? 'button' : undefined}
        tabIndex={total > 0 ? 0 : undefined}
        onKeyDown={e => total > 0 && e.key === 'Enter' && setJourneyOpen(true)}
      >
        <div className="widget-header">
          <span className="widget-title">Activités enfants</span>
          <button
            className="widget-add-btn"
            onClick={e => { e.stopPropagation(); setSheetOpen(true); }}
            title="Planifier une activité"
            aria-label="Planifier une activité"
          >
            <PlusIcon />
          </button>
        </div>

        {total === 0 ? (
          <div className="widget-empty">
            <span className="widget-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V9l7-6 7 6v10a2 2 0 0 1-2 2h-4"/>
                <polyline points="9 21 9 12 15 12 15 21"/>
              </svg>
            </span>
            <span>Journée tranquille</span>
          </div>
        ) : (
          <div className="wa-summary">
            {/* Anneau de progression */}
            <div className="wa-ring">
              <svg viewBox="0 0 48 48" width="52" height="52">
                <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="rgba(201,184,232,0.3)" strokeWidth="4.5" />
                <circle cx="24" cy="24" r={RADIUS} fill="none"
                  stroke={allDone ? '#34D399' : '#A78BFA'}
                  strokeWidth="4.5" strokeLinecap="round"
                  strokeDasharray={`${strokeDash} ${CIRC}`}
                  transform="rotate(-90 24 24)"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </svg>
              <span className="wa-ring__text">{totalFaites}<span className="wa-ring__total">/{total}</span></span>
            </div>

            <div className="wa-info">
              <span className="wa-info__label">
                {allDone ? '🏆 Toutes réalisées !' : `${totalFaites} sur ${total} réalisées`}
              </span>
              {prochaine && (
                <span className="wa-info__next">
                  Prochain : <strong>{(prochaine.activite as any)?.nom ?? '–'}</strong>
                  {prochaine.heurePrevue && <span className="wa-info__heure"> · {prochaine.heurePrevue}</span>}
                </span>
              )}
              {allDone && total > 0 && (
                <span className="wa-info__next">Belle journée d'activités !</span>
              )}
            </div>

            <span className="wa-chevron" aria-hidden="true">›</span>
          </div>
        )}
      </div>

      {/* Journey view */}
      {journeyOpen && (
        <ActiviteJourney
          onClose={() => setJourneyOpen(false)}
          onStartActivity={(planifId) => {
            setJourneyOpen(false);
            const item = items.find(a => a.id === planifId);
            if (item) {
              setActiveSession({
                planifId: item.id,
                statut: item.statut,
                heurePrevue: item.heurePrevue,
                activite: item.activite as any,
                membre: item.membre as any,
              });
            }
          }}
        />
      )}

      {/* Session activité */}
      {activeSession && (
        <ActiviteSession
          item={activeSession}
          onClose={() => setActiveSession(null)}
          onDone={(id) => {
            setDoneIds(prev => new Set([...prev, id]));
            setTimeout(() => setActiveSession(null), 2000);
          }}
        />
      )}

      {/* Quick add sheet */}
      {sheetOpen && <ActiviteQuickSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
