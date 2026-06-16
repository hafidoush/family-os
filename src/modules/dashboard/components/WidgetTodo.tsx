/**
 * WidgetTodo — "Missions du jour"
 * Design exact ThriveEcho · Pills individuelles · bulle organique jaune-orangé
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDayTasks, TodoItem } from '../hooks/useDayTasks';
import { db } from '../../../core/db/database';
import { newEntity, withUpdate } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import type { Tache } from '../../../shared/types';
import './WidgetTodo.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function getWeekDays(ref: Date) {
  const lundi = new Date(ref);
  const day = lundi.getDay();
  lundi.setDate(lundi.getDate() - (day === 0 ? 6 : day - 1));
  lundi.setHours(0, 0, 0, 0);
  const LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    return { iso: toISO(d), label: LABELS[i], num: d.getDate() };
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function toggleTask(item: TodoItem) {
  const isDone = item.statut === 'fait' || item.statut === 'realisee';
  if (item.type === 'tache') {
    const next = isDone ? 'a_faire' : 'fait';
    await db.taches.update(item.id, withUpdate({ statut: next }));
    if (!isDone) {
      const t = await db.taches.get(item.id);
      if (t) emit(t.recurrence ? 'tache.completed_recurrent' : 'tache.completed_nonrecurrent', { tache: t });
    }
  } else if (item.type === 'activite') {
    const next = isDone ? 'planifiee' : 'realisee';
    await db.planificationsActivites.update(item.id, withUpdate({ statut: next }));
    emit('planification.status_changed', { id: item.id, statut: next });
  }
}

async function addMission(titre: string, dateISO: string) {
  if (!titre.trim()) return;
  await db.taches.add(newEntity<Tache>({
    titre: titre.trim(),
    statut: 'a_faire',
    priorite: 'normale',
    moduleOrigine: 'famille',
    dateEcheance: new Date(dateISO),
    recurrence: false,
    archive: false,
  }));
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function WidgetTodo() {
  const today  = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [addMode, setAddMode]           = useState(false);
  const [draft,   setDraft]             = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const weekDays = getWeekDays(new Date());
  const selectedIdx = weekDays.findIndex((d) => d.iso === selectedDate);
  const tasks = useDayTasks(selectedDate);

  useEffect(() => { if (addMode) inputRef.current?.focus(); }, [addMode]);

  const handleAdd = useCallback(async () => {
    if (!draft.trim()) { setAddMode(false); return; }
    await addMission(draft, selectedDate);
    setDraft('');
    setAddMode(false);
  }, [draft, selectedDate]);

  const pending = tasks?.filter((t) => t.statut !== 'fait' && t.statut !== 'realisee') ?? [];
  const done    = tasks?.filter((t) => t.statut === 'fait'  || t.statut === 'realisee') ?? [];


  const isFirstSelected = selectedIdx === 0;
  const isLastSelected  = selectedIdx === weekDays.length - 1;

  return (
    <div className={[
      'widget-missions area-todo',
      isFirstSelected ? 'missions--edge-left'  : '',
      isLastSelected  ? 'missions--edge-right' : '',
    ].join(' ')}>

      {/* ── Header ── */}
      <div className="missions-header">
        <span className="missions-header__title">Missions du jour</span>
        <span className="missions-header__counter">
          <span className="missions-header__done">{done.length}</span>/{(tasks ?? []).length}
        </span>
      </div>

      {/* ── Bande des jours — pills individuelles ThriveEcho ── */}
      <div className="missions-week">
        {weekDays.map((d, i) => {
          const isSelected = d.iso === selectedDate;
          const isToday    = d.iso === today;
          return (
            <button
              key={d.iso}
              className={[
                'day-pill',
                isSelected ? 'day-pill--selected' : '',
                isToday && !isSelected ? 'day-pill--today' : '',
              ].join(' ')}
              onClick={() => setSelectedDate(d.iso)}
              aria-pressed={isSelected}
            >
              <span className="day-pill__label">{d.label}</span>
              <span className="day-pill__num">{d.num}</span>
            </button>
          );
        })}
      </div>

      {/* ── Carte missions — bulle organique connectée au jour ── */}
      <div className="missions-card">
        {/* Missions */}
        {tasks === undefined ? (
          <div className="missions-card__loading">
            {[1,2,3].map(i => <div key={i} className="missions-skel" style={{ width: `${50 + i * 16}%` }} />)}
          </div>
        ) : (tasks ?? []).length === 0 && !addMode ? (
          <div className="missions-card__empty">
            <span className="missions-card__empty-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>
              </svg>
            </span>
            <p className="missions-card__empty-text">Ta journée t'appartient</p>
          </div>
        ) : (
          <ul className="missions-list">
            {pending.map((item) => <MissionRow key={item.id} item={item} />)}
            {done.length > 0 && pending.length > 0 && (
              <li className="missions-sep">
                <span>{done.length} accomplie{done.length > 1 ? 's' : ''}</span>
              </li>
            )}
            {done.map((item) => <MissionRow key={item.id} item={item} />)}
          </ul>
        )}

        {/* Ajout rapide */}
        {addMode ? (
          <div className="missions-add-row">
            <input
              ref={inputRef}
              className="missions-add-input"
              placeholder="Nouvelle mission…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  handleAdd();
                if (e.key === 'Escape') { setAddMode(false); setDraft(''); }
              }}
            />
            <button className="missions-add-confirm" onClick={handleAdd}>✓</button>
          </div>
        ) : (
          <button className="missions-add-btn" onClick={() => setAddMode(true)}>
            <span className="missions-add-btn__plus">+</span>
            <span>Ajouter une mission</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Ligne de mission ──────────────────────────────────────────────────────────

function MissionRow({ item }: { item: TodoItem }) {
  const isDone = item.statut === 'fait' || item.statut === 'realisee';
  return (
    <li className={`mission-row${isDone ? ' mission-row--done' : ''}`}>
      <button
        className="mission-row__check"
        onClick={() => toggleTask(item)}
        aria-label={isDone ? 'Rouvrir' : 'Valider'}
      >
        {isDone && <span className="mission-row__tick">✓</span>}
      </button>
      <span className="mission-row__titre">{item.titre}</span>
      {item.heure && <span className="mission-row__heure">{item.heure}</span>}
    </li>
  );
}
