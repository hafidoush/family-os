import { useState } from 'react';
import type { SportState, JournalEntry } from '../sportTypes';
import { genId, getTodayStr } from '../sportUtils';
import './VueJournal.css';

interface Props {
  state: SportState;
  update: (patch: Partial<SportState>) => void;
  setState: React.Dispatch<React.SetStateAction<SportState>>;
  sessions: any[];
}

const MOODS = ['😔', '😐', '🙂', '😊', '🔥'];

export function VueJournal({ state, update, sessions }: Props) {
  const [mood, setMood] = useState('😊');
  const [energie, setEnergie] = useState(7);
  const [motivation, setMotivation] = useState(7);
  const [sommeil, setSommeil] = useState(7);
  const [texte, setTexte] = useState('');
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  function handleSave() {
    const entry: JournalEntry = {
      id: genId(),
      date: getTodayStr(),
      mood,
      energie,
      motivation,
      sommeil,
      texte,
    };
    update({ journalEntries: [...state.journalEntries, entry] });
    setTexte('');
  }

  // Calendar
  const today = getTodayStr();
  const journalDates = new Set(state.journalEntries.map(e => e.date));
  const sessionDates = new Set(sessions.map((s: any) => new Date(s.date).toISOString().split('T')[0]));

  const firstDay = new Date(calMonth.y, calMonth.m, 1).getDay();
  const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
  const monthStr = new Date(calMonth.y, calMonth.m).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(firstDay === 0 ? 6 : firstDay - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dayStr(d: number) {
    return `${calMonth.y}-${String(calMonth.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const recent = [...state.journalEntries].reverse().slice(0, 10);

  return (
    <div className="vue-journal">
      <div className="vue-journal__title">📔 Journal</div>

      {/* Formulaire */}
      <div className="journal-card">
        <div className="journal-card__title">Entrée du jour</div>

        <div className="journal-moods">
          {MOODS.map(m => (
            <button
              key={m}
              className={`journal-mood-btn${mood === m ? ' journal-mood-btn--active' : ''}`}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="journal-sliders">
          <div className="journal-slider-row">
            <div className="journal-slider-row__label">Énergie</div>
            <input type="range" min="0" max="10" value={energie} onChange={e => setEnergie(Number(e.target.value))} />
            <div className="journal-slider-row__val">{energie}/10</div>
          </div>
          <div className="journal-slider-row">
            <div className="journal-slider-row__label">Motivation</div>
            <input type="range" min="0" max="10" value={motivation} onChange={e => setMotivation(Number(e.target.value))} />
            <div className="journal-slider-row__val">{motivation}/10</div>
          </div>
        </div>

        <div className="journal-sommeil">
          <label>Sommeil (heures)</label>
          <input type="number" min="0" max="12" step="0.5" value={sommeil} onChange={e => setSommeil(Number(e.target.value))} />
        </div>

        <textarea
          className="journal-textarea"
          placeholder="Comment s'est passée ta journée ?"
          value={texte}
          onChange={e => setTexte(e.target.value)}
        />

        <button className="journal-save-btn" onClick={handleSave}>✓ Enregistrer</button>
      </div>

      {/* Calendrier */}
      <div className="journal-card">
        <div className="journal-card__title">Calendrier du mois</div>
        <div className="journal-cal">
          <div className="journal-cal__header">
            <button className="journal-cal__nav" onClick={() => setCalMonth(p => {
              const d = new Date(p.y, p.m - 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })}>‹</button>
            <div className="journal-cal__month">{monthStr}</div>
            <button className="journal-cal__nav" onClick={() => setCalMonth(p => {
              const d = new Date(p.y, p.m + 1);
              return { y: d.getFullYear(), m: d.getMonth() };
            })}>›</button>
          </div>
          <div className="journal-cal__grid">
            {['L','M','M','J','V','S','D'].map((d, i) => (
              <div key={i} className="journal-cal__dow">{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="journal-cal__day journal-cal__day--empty" />;
              const ds = dayStr(d);
              const hasJ = journalDates.has(ds);
              const hasS = sessionDates.has(ds);
              const isToday = ds === today;
              let cls = 'journal-cal__day';
              if (hasS) cls += ' journal-cal__day--seance';
              else if (hasJ) cls += ' journal-cal__day--journal';
              if (isToday) cls += ' journal-cal__day--today';
              return <div key={i} className={cls}>{d}</div>;
            })}
          </div>
        </div>
      </div>

      {/* Entrées récentes */}
      {recent.length > 0 && (
        <div className="journal-card">
          <div className="journal-card__title">Entrées récentes</div>
          <div className="journal-entries">
            {recent.map(e => (
              <div key={e.id} className="journal-entry">
                <div className="journal-entry__header">
                  <span className="journal-entry__mood">{e.mood}</span>
                  <span className="journal-entry__date">{e.date}</span>
                  <span className="journal-entry__scores">⚡{e.energie} 🎯{e.motivation} 💤{e.sommeil}h</span>
                </div>
                {e.texte && <div className="journal-entry__text">{e.texte}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
