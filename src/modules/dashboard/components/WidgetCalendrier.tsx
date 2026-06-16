import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTodayEvents, useWeekEvents } from '../hooks/useTodayEvents';
import { useDashboardStore } from '../stores/dashboardStore';
import { formatTime } from '../../../shared/utils/formatDate';
import { EvenementQuickSheet } from './EvenementQuickSheet';
import { db } from '../../../core/db/database';
import { newEntity, withUpdate } from '../../../core/db/helpers';
import { getNocesLabel } from '../../../shared/utils/noces';
import type { Tache, Evenement } from '../../../shared/types';
import './WidgetCalendrier.css';

// Calcule le titre affiché pour un événement — gère les noces de mariage dynamiquement
function getTitreAffiche(evt: Evenement): string {
  const desc = evt.description ?? ''
  const match = desc.match(/mariage:(\d{4})/)
  if (!match) return evt.titre
  const annéeMariage = parseInt(match[1], 10)
  const annéeEvt = new Date(evt.dateDebut).getFullYear()
  const ans = annéeEvt - annéeMariage
  return `${getNocesLabel(ans)} ♥ (${ans} ans)`
}

// ─── Icônes ───────────────────────────────────────────────────────────────────

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const CakeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1"/>
    <path d="M2 21h20"/>
    <path d="M7 8v2M12 8v2M17 8v2"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
  </svg>
);
const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const PinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
  </svg>
);
const SunIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

const TYPE_ICONS: Record<string, React.ReactNode> = {
  rendez_vous: <CalendarIcon />,
  anniversaire: <CakeIcon />,
  sortie:       <SparkleIcon />,
  rappel:       <BellIcon />,
};

// ─── Hook tâches rapides du jour ──────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().split('T')[0]; }

function useTodayQuickTasks() {
  const today = toISO(new Date());
  return useLiveQuery(async () => {
    return db.taches
      .filter(t =>
        !t.deletedAt &&
        !t.archive &&
        t.statut !== 'fait' &&
        t.dateEcheance != null &&
        toISO(new Date(t.dateEcheance as unknown as string)) === today &&
        t.moduleOrigine === 'dashboard_today'
      )
      .toArray();
  }, []);
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function WidgetCalendrier() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft,     setDraft]     = useState('');
  const [addMode,   setAddMode]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const today  = useTodayEvents();
  const week   = useWeekEvents();
  const tasks  = useTodayQuickTasks();
  const { weekViewOpen } = useDashboardStore();

  // Prochains événements : semaine en cours, à partir d'aujourd'hui, triés par date
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const upcomingEvents = (week ?? [])
    .filter(e => new Date(e.dateDebut) >= startOfToday)
    .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())
    .slice(0, 4);

  const events = weekViewOpen ? week : today;

  // ── Ajout tâche rapide ──────────────────────────────────────────────────────
  const handleAddTask = useCallback(async () => {
    if (!draft.trim()) { setAddMode(false); return; }
    const today = toISO(new Date());
    await db.taches.add(newEntity<Tache>({
      titre:         draft.trim(),
      statut:        'a_faire',
      priorite:      'normale',
      moduleOrigine: 'dashboard_today',
      dateEcheance:  new Date(today),
      recurrence:    false,
      archive:       false,
    }));
    setDraft('');
    setAddMode(false);
  }, [draft]);

  const handleCheck = useCallback(async (id: string) => {
    await db.taches.update(id, withUpdate<Tache>({ statut: 'fait' }));
  }, []);

  const handleDeleteEvent = useCallback(async (id: string) => {
    await db.evenements.update(id, { deletedAt: new Date() });
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  handleAddTask();
    if (e.key === 'Escape') { setAddMode(false); setDraft(''); }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (today === undefined) {
    return (
      <div className="calendrier-groupe area-calendrier">
        <div className="widget-card widget-card--fused-top">
          <div className="widget-header">
            <span className="widget-title">Aujourd'hui</span>
          </div>
          {[1, 2].map(i => <div key={i} className="widget-skeleton tall" />)}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="calendrier-groupe area-calendrier">

      {/* ── Carte principale : événements ── */}
      <div className="widget-card widget-card--fused-top widget-calendrier">
        <div className="widget-header">
          <span className="widget-title">Prochains événements</span>
          <button
            className="widget-add-btn"
            onClick={() => setSheetOpen(true)}
            title="Ajouter un événement"
            aria-label="Ajouter un événement"
          >
            <PlusIcon />
          </button>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="widget-empty">
            <span className="widget-empty-icon"><SunIcon /></span>
            <span>Rien de prévu cette semaine</span>
          </div>
        ) : (
          <ul className="widget-calendrier__list">
            {upcomingEvents.map(evt => (
              <li key={evt.id} className="widget-calendrier__item">
                <span className="widget-calendrier__type-icon">
                  {TYPE_ICONS[evt.type] ?? <PinIcon />}
                </span>
                <div className="widget-calendrier__info">
                  <span className="widget-calendrier__titre">{getTitreAffiche(evt)}</span>
                  <span className="widget-calendrier__heure">
                    {new Date(evt.dateDebut).toLocaleDateString('fr-FR', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                    {!evt.journeeEntiere && evt.heureDebut ? ` · ${evt.heureDebut}` : ''}
                  </span>
                </div>
                <button
                  className="widget-calendrier__delete"
                  onClick={() => handleDeleteEvent(evt.id)}
                  title="Supprimer"
                  aria-label="Supprimer l'événement"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>

    {sheetOpen && (
      <EvenementQuickSheet onClose={() => setSheetOpen(false)} />
    )}
    </>
  );
}
